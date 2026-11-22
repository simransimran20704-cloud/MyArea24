import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  DashboardId,
  ActionModalData,
  SavedEntry,
  UserLocation,
  DEFAULT_SAVED_LOCATIONS,
  INITIAL_FALLBACK_LOCATION,
  CartItem,
} from './types';
import { FEATURE_FLAGS } from './config/featureFlags';
import { NAV_ITEMS, INITIAL_SAVED_ITEMS } from './data/mockData';
import {
  useLiveIntelligence,
  askLiveAiAssistant,
  streamLiveAiAssistant,
  LiveAlertItem,
} from './services/liveIntelligence';
import {
  useLiveCommunityMarketplace,
  syncSavedBookmarkToBackend,
  getStoredAuthUser,
  getStoredMerchantProfile,
  getStoredMerchantSession,
  MerchantRegistrationProfile,
} from './services/communityMarketplaceService';
import {
  AUTH_CHANGE_EVENT,
  AUTH_UNAUTHORIZED_EVENT,
  AuthUserProfile,
} from './services/authService';
import {
  realtimeService,
  REALTIME_STATUS_EVENT,
  CIVIC_ALERT_EVENT,
  RealtimeConnectionStatus,
} from './services/realtimeService';
import {
  useLocationStore,
  useCartStore,
  useSavedStore,
  useIntelligenceStore,
  useMarketplaceStore,
  useUIStore,
} from './stores';
import { useTranslation } from 'react-i18next';

import { ErrorBoundary } from './components/ErrorBoundary';
import { ComplianceFooter } from './components/ComplianceFooter';
import { CartConflictModal } from './components/CartConflictModal';
import { DPDPConsentBanner } from './components/DPDPConsentBanner';
import { LocationPermissionPrompt } from './components/LocationPermissionPrompt';
import { NotificationPermissionPrompt } from './components/NotificationPermissionPrompt';
import { AuthPermissionPrompt } from './components/AuthPermissionPrompt';
import { analytics } from './services/analyticsService';

// Code-split dynamic imports for massive initial bundle reduction
const AuthModal = React.lazy(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const CartDrawer = React.lazy(() =>
  import('./components/CartDrawer').then((m) => ({ default: m.CartDrawer }))
);
const ServiceBookingModal = React.lazy(() =>
  import('./components/ServiceBookingModal').then((m) => ({ default: m.ServiceBookingModal }))
);
const MerchantRegistrationModal = React.lazy(() =>
  import('./components/MerchantRegistrationModal').then((m) => ({ default: m.MerchantRegistrationModal }))
);
const MerchantPortal = React.lazy(() =>
  import('./merchant/MerchantPortal').then((m) => ({ default: m.MerchantPortal }))
);

// Main Dashboards (Code-split into individual modular chunks)
const HomeDashboard = React.lazy(() =>
  import('./dashboards/main/HomeDashboard').then((m) => ({ default: m.HomeDashboard }))
);
const BusinessesDashboard = React.lazy(() =>
  import('./dashboards/main/BusinessesDashboard').then((m) => ({ default: m.BusinessesDashboard }))
);
const ProductsDashboard = React.lazy(() =>
  import('./dashboards/main/ProductsDashboard').then((m) => ({ default: m.ProductsDashboard }))
);
const ServicesDashboard = React.lazy(() =>
  import('./dashboards/main/ServicesDashboard').then((m) => ({ default: m.ServicesDashboard }))
);
const OffersDashboard = React.lazy(() =>
  import('./dashboards/main/OffersDashboard').then((m) => ({ default: m.OffersDashboard }))
);
const EventsDashboard = React.lazy(() =>
  import('./dashboards/main/EventsDashboard').then((m) => ({ default: m.EventsDashboard }))
);

// Intelligence Dashboards (Code-split)
const IntelligenceDashboard = React.lazy(() =>
  import('./dashboards/IntelligenceDashboards').then((m) => ({ default: m.IntelligenceDashboard }))
);
const WeatherDashboard = React.lazy(() =>
  import('./dashboards/IntelligenceDashboards').then((m) => ({ default: m.WeatherDashboard }))
);
const AirQualityDashboard = React.lazy(() =>
  import('./dashboards/IntelligenceDashboards').then((m) => ({ default: m.AirQualityDashboard }))
);
const TrafficDashboard = React.lazy(() =>
  import('./dashboards/IntelligenceDashboards').then((m) => ({ default: m.TrafficDashboard }))
);
const AlertsDashboard = React.lazy(() =>
  import('./dashboards/IntelligenceDashboards').then((m) => ({ default: m.AlertsDashboard }))
);
const AiAssistantDashboard = React.lazy(() =>
  import('./dashboards/IntelligenceDashboards').then((m) => ({ default: m.AiAssistantDashboard }))
);

// Community Dashboards (Code-split)
const MapDashboard = React.lazy(() =>
  import('./dashboards/CommunityDashboards').then((m) => ({ default: m.MapDashboard }))
);
const EmergencyDashboard = React.lazy(() =>
  import('./dashboards/CommunityDashboards').then((m) => ({ default: m.EmergencyDashboard }))
);
const MarketRatesDashboard = React.lazy(() =>
  import('./dashboards/CommunityDashboards').then((m) => ({ default: m.MarketRatesDashboard }))
);
const FuelRatesDashboard = React.lazy(() =>
  import('./dashboards/CommunityDashboards').then((m) => ({ default: m.FuelRatesDashboard }))
);
const BulletinsDashboard = React.lazy(() =>
  import('./dashboards/CommunityDashboards').then((m) => ({ default: m.BulletinsDashboard }))
);
const SavedDashboard = React.lazy(() =>
  import('./dashboards/CommunityDashboards').then((m) => ({ default: m.SavedDashboard }))
);
const MyOrdersDashboard = React.lazy(() =>
  import('./dashboards/MyOrdersDashboard').then((m) => ({ default: m.MyOrdersDashboard }))
);

// Location Modal (Code-split)
const LocationPickerModal = React.lazy(() =>
  import('./components/LocationPickerModal').then((m) => ({ default: m.LocationPickerModal }))
);

import {
  Home,
  Store,
  LayoutGrid,
  Package,
  Wrench,
  Tag,
  Calendar,
  Zap,
  Cloud,
  Wind,
  Car,
  AlertTriangle,
  Bot,
  Map as MapIcon,
  ShieldAlert,
  TrendingUp,
  Fuel,
  FileText,
  Heart,
  Sparkles,
  Search,
  MapPin,
  Sun,
  Bell,
  ChevronDown,
  Crown,
  ArrowRight,
  X,
  CheckCircle2,
  ShoppingBag,
  Clock,
  ChevronRight,
  Phone,
  MessageCircle,
  Navigation,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Flag,
} from 'lucide-react';

const ICON_MAP: Record<DashboardId, React.ElementType> = {
  home: Home,
  businesses: Store,
  products: Package,
  services: Wrench,
  offers: Tag,
  events: Calendar,
  intelligence: Zap,
  weather: Cloud,
  'air-quality': Wind,
  traffic: Car,
  alerts: AlertTriangle,
  'ai-assistant': Bot,
  map: MapIcon,
  emergency: ShieldAlert,
  'market-rates': TrendingUp,
  'fuel-rates': Fuel,
  bulletins: FileText,
  saved: Heart,
  'my-orders': ShoppingBag,
};

const SAVED_STORAGE_KEY = 'myarea24_saved_items_v1';

function DashboardLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-2">
      <div className="h-24 rounded-2xl bg-indigo-100/60 flex items-center px-6">
        <div className="h-6 w-48 bg-indigo-200/80 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-40 rounded-2xl bg-slate-200/70" />
        <div className="h-40 rounded-2xl bg-slate-200/70" />
        <div className="h-40 rounded-2xl bg-slate-200/70" />
      </div>
      <div className="h-64 rounded-2xl bg-slate-200/60" />
    </div>
  );
}

function PortalLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg animate-bounce mb-4">
        <Sparkles className="w-6 h-6" />
      </div>
      <h3 className="text-base font-extrabold text-slate-900">Loading Merchant Hub...</h3>
      <p className="text-xs text-slate-500 mt-1">Connecting to local merchant storefront & catalog</p>
    </div>
  );
}

function MobileLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#F3F5FB] flex flex-col justify-between p-4 animate-pulse">
      <div className="h-12 rounded-2xl bg-slate-200/80 mb-4" />
      <div className="space-y-3 flex-1">
        <div className="h-24 rounded-2xl bg-indigo-100/70" />
        <div className="h-36 rounded-2xl bg-slate-200/70" />
        <div className="h-36 rounded-2xl bg-slate-200/70" />
      </div>
      <div className="h-16 rounded-2xl bg-slate-200/80 mt-4" />
    </div>
  );
}

export function App() {
  const { t } = useTranslation();

  const getNavLabel = (id: string, defaultLabel: string) => {
    const map: Record<string, string> = {
      home: t('nav.home'),
      explore: t('nav.explore'),
      local_commerce: t('nav.market'),
      orders: t('nav.orders'),
      saved: t('nav.saved'),
      emergency: t('nav.emergency'),
      weather: t('nav.weather'),
      'air-quality': t('nav.airQuality'),
      traffic: t('nav.traffic'),
      'ai-assistant': t('nav.aiAssistant'),
      'citizen-desk': t('nav.help'),
    };
    return map[id] || defaultLabel;
  };

  // Merchant Registration Profile (Startup Verification State)
  const [merchantProfile, setMerchantProfile] = useState<MerchantRegistrationProfile | null>(() => {
    return getStoredMerchantProfile();
  });

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Route & Deep-linking Resolution:
  // e.g. "/products/p-1" -> mainSegment="products", subParam="p-1"
  const cleanPath = location.pathname.replace(/^\/+/, '').split('?')[0];
  const pathParts = cleanPath.split('/');
  const mainSegment = pathParts[0]?.toLowerCase() || '';
  const subParam = pathParts[1] || '';

  const isMerchantPortal = mainSegment === 'merchant';

  const VALID_CITIZEN_ROUTES: Record<string, DashboardId> = {
    '': 'home',
    home: 'home',
    businesses: 'businesses',
    products: 'products',
    services: 'services',
    offers: 'offers',
    events: 'events',
    intelligence: 'intelligence',
    weather: 'weather',
    'air-quality': 'air-quality',
    traffic: 'traffic',
    alerts: 'alerts',
    'ai-assistant': 'ai-assistant',
    map: 'map',
    emergency: 'emergency',
    'market-rates': 'market-rates',
    'fuel-rates': 'fuel-rates',
    bulletins: 'bulletins',
    saved: 'saved',
    'my-orders': 'my-orders',
    'my-bookings': 'my-orders',
    orders: 'my-orders',
    // Preserved routes for Residential Rental Benchmark:
    // When ENABLE_RESIDENTIAL_RENTAL_BENCHMARK is true, these map to the feature.
    // When false, these routes remain disabled and redirect users to home.
    ...(FEATURE_FLAGS.ENABLE_RESIDENTIAL_RENTAL_BENCHMARK
      ? {
          'rental-benchmark': 'market-rates' as DashboardId,
          rentals: 'market-rates' as DashboardId,
          'residential-benchmark': 'market-rates' as DashboardId,
        }
      : {}),
  };

  const activeDashboard: DashboardId = isMerchantPortal
    ? 'home'
    : (VALID_CITIZEN_ROUTES[mainSegment] || 'home');

  // Explicit route guard for disabled rental benchmark routes:
  // Guarantees that direct navigation to existing or legacy rental routes is strictly blocked and redirected
  const DISABLED_RENTAL_ROUTES = [
    'rentals',
    'rental',
    'rental-benchmark',
    'residential-benchmark',
    'residential',
    'rent',
    'rent-rates',
    'property-benchmark',
  ];

  // Handle unknown paths and disabled rental routes by redirecting to /
  useEffect(() => {
    if (!isMerchantPortal && mainSegment !== '') {
      const isKnownRoute = Boolean(VALID_CITIZEN_ROUTES[mainSegment]);
      const isDisabledRentalRoute =
        !FEATURE_FLAGS.ENABLE_RESIDENTIAL_RENTAL_BENCHMARK &&
        DISABLED_RENTAL_ROUTES.includes(mainSegment);

      if (!isKnownRoute || isDisabledRentalRoute) {
        navigate('/', { replace: true });
      }
    }
  }, [isMerchantPortal, mainSegment, navigate]);

  const handleSwitchToMerchant = () => {
    const session = getStoredMerchantSession();
    if (session && session.isVerified) {
      navigate('/merchant');
    } else {
      setMerchantRegModalOpen(true);
    }
  };

  // 1. Centralized Zustand Stores with Stale-While-Revalidate Caching
  const {
    currentLocation,
    locationModalOpen,
    setLocation,
    openLocationModal,
    closeLocationModal,
    setLocationModalOpen,
  } = useLocationStore();

  const {
    data: liveIntelData,
    fetchIntelligence,
    pushCivicAlert,
  } = useIntelligenceStore();

  const marketplaceStore = useMarketplaceStore();

  const {
    items: cartItems,
    isOpen: cartDrawerOpen,
    addToCart,
    updateQuantity: handleUpdateCartQuantity,
    removeItem: handleRemoveCartItem,
    clearCart: handleClearCart,
    openCart,
    closeCart,
    setCartDrawerOpen,
  } = useCartStore();

  const { savedEntries, savedIds, toggleSave } = useSavedStore();

  const {
    modalData,
    openModal: setModalData,
    closeModal,
    reportModalOpen,
    reportReason,
    openReportModal,
    closeReportModal,
    serviceBookingModalOpen,
    selectedServiceToBook,
    openServiceBooking,
    closeServiceBooking,
    setServiceBookingModalOpen,
    authModalOpen,
    openAuthModal,
    closeAuthModal,
    setAuthModalOpen,
    merchantRegModalOpen,
    openMerchantRegModal,
    closeMerchantRegModal,
    setMerchantRegModalOpen,
    notificationsOpen,
    setNotificationsOpen,
    toggleNotifications,
    profileMenuOpen,
    setProfileMenuOpen,
    toggleProfileMenu,
    mobileMoreOpen,
    setMobileMoreOpen,
  } = useUIStore();

  // Automatic caching and background revalidation for /api/v1/weather
  useEffect(() => {
    fetchIntelligence(currentLocation);
  }, [currentLocation, fetchIntelligence]);

  // Fallback if data is still initializing
  const fallbackIntel = useLiveIntelligence(currentLocation);
  const liveIntel = liveIntelData || fallbackIntel;

  // Automatic caching and background revalidation for /api/v1/businesses and /api/v1/products
  useEffect(() => {
    if (liveIntel) {
      marketplaceStore.fetchMarketplace(liveIntel);
    }
  }, [liveIntel]);

  const marketplace: LiveCommunityMarketplaceState = {
    loading: marketplaceStore.loading,
    businesses: marketplaceStore.businesses,
    products: marketplaceStore.products,
    services: marketplaceStore.services,
    offers: marketplaceStore.offers,
    events: marketplaceStore.events,
    emergencyFacilities: marketplaceStore.emergencyFacilities,
    addBusiness: marketplaceStore.addBusiness,
    addProduct: marketplaceStore.addProduct,
    addService: marketplaceStore.addService,
    addOffer: marketplaceStore.addOffer,
    addEvent: marketplaceStore.addEvent,
    refreshMarketplace: marketplaceStore.refreshMarketplace,
  };

  const urlQ = searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(urlQ);

  useEffect(() => {
    if (urlQ !== searchQuery) {
      setSearchQuery(urlQ);
    }
  }, [urlQ]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    const next = new URLSearchParams(searchParams);
    if (val.trim()) {
      next.set('q', val.trim());
      if (val.trim().length >= 3) {
        analytics.trackSearch(val.trim(), mainSegment || 'all');
      }
    } else {
      next.delete('q');
    }
    setSearchParams(next, { replace: true });
  };

  const [commandOpen, setCommandOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [modalFeedback, setModalFeedback] = useState<'yes' | 'no' | null>(null);

  // Quick AI Assistant Modal State
  const [aiModalPrompt, setAiModalPrompt] = useState<string | null>(null);
  const [aiModalReply, setAiModalReply] = useState<string>('');

  const selectedArea = currentLocation.areaName;
  const [authUser, setAuthUser] = useState<AuthUserProfile | null>(() => getStoredAuthUser());

  // Real-Time WebSockets & Push Notifications State
  const [wsStatus, setWsStatus] = useState<RealtimeConnectionStatus>(() => realtimeService.getStatus());
  const [urgentCivicBanner, setUrgentCivicBanner] = useState<LiveAlertItem | null>(null);

  useEffect(() => {
    // Connect to WebSocket with current area and coordinates
    realtimeService.connect({
      area: currentLocation.areaName,
      lat: currentLocation.coords?.lat,
      lon: currentLocation.coords?.lng,
    });

    const handleWsStatus = (e: any) => {
      setWsStatus(e.detail?.status || 'disconnected');
    };

    const handleLiveCivicAlert = (e: any) => {
      const alert = e.detail?.alert as LiveAlertItem;
      if (alert) {
        pushCivicAlert(alert);
        if (alert.severity === 'Critical') {
          setUrgentCivicBanner(alert);
        } else {
          showToast(`🔔 Civic Notice: ${alert.title}`);
        }
      }
    };

    window.addEventListener(REALTIME_STATUS_EVENT, handleWsStatus);
    window.addEventListener(CIVIC_ALERT_EVENT, handleLiveCivicAlert);

    return () => {
      window.removeEventListener(REALTIME_STATUS_EVENT, handleWsStatus);
      window.removeEventListener(CIVIC_ALERT_EVENT, handleLiveCivicAlert);
    };
  }, []);

  // Update dynamic topic subscriptions when location changes
  useEffect(() => {
    realtimeService.updateSubscriptions({
      area: currentLocation.areaName,
      lat: currentLocation.coords?.lat,
      lon: currentLocation.coords?.lng,
    });
  }, [currentLocation.areaName, currentLocation.coords?.lat, currentLocation.coords?.lng]);

  useEffect(() => {
    const handleAuthChange = (e: any) => {
      setAuthUser(e.detail || null);
    };
    const handleUnauthorized = () => {
      setAuthUser(null);
      showToast('Session expired. Please sign in again.');
    };
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  // Keyboard shortcut Cmd/Ctrl + K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const handleNavigate = (id: DashboardId, queryParams?: Record<string, string>) => {
    const targetPath = id === 'home' ? '/' : `/${id}`;
    let url = targetPath;
    if (queryParams) {
      const q = new URLSearchParams(queryParams).toString();
      if (q) url += `?${q}`;
    }
    analytics.trackPageView(id, targetPath);
    navigate(url);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setMobileMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Deep-linking support for /products/:productId
  useEffect(() => {
    if (mainSegment === 'products' && subParam) {
      const p = marketplace.products.find(
        (item) => String(item.id).toLowerCase() === subParam.toLowerCase()
      );
      if (p) {
        setModalData({
          title: p.name,
          subtitle: `${p.store} • ${p.dist} away`,
          category: `${p.cat} • Offline vs Online Comparison`,
          badge: p.discount || 'Verified Price',
          price: `Local: ${p.price} (Online: ${p.oldPrice || p.price})`,
          location: p.storeAddress,
          description: `${p.freshnessLabel}. Buy directly from ${p.store} at ${p.price} instead of ${p.oldPrice || p.price} on ${p.onlineProvider} (Save ₹${p.savingsAmount}).`,
          primaryActionLabel: 'Reserve for Pickup / Delivery',
          image: p.img,
        });
      }
    }
  }, [mainSegment, subParam, marketplace.products]);

  // Auto-redirect to home when an active dashboard has no valid listings in the current location (only after loading completes)
  useEffect(() => {
    if (
      !marketplace.loading &&
      ['products', 'services', 'offers'].includes(activeDashboard) &&
      !isNavVisible(activeDashboard)
    ) {
      handleNavigate('home');
    }
  }, [activeDashboard, marketplace.loading, marketplace.products.length, marketplace.services.length, marketplace.offers.length]);

  // Synchronize local feedback state when viewing any modal item
  useEffect(() => {
    if (modalData?.title) {
      try {
        const savedFeedback = JSON.parse(localStorage.getItem('myarea24_user_feedback_v1') || '{}');
        setModalFeedback(savedFeedback[modalData.title] || null);
      } catch {
        setModalFeedback(null);
      }
    } else {
      setModalFeedback(null);
    }
  }, [modalData?.title]);

  const handleCloseModal = () => {
    setModalData(null);
    setModalFeedback(null);
    setReportModalOpen(false);
    setReportReason('');
    if (mainSegment === 'products' && subParam) {
      navigate('/products');
    }
  };

  const handleSelectLocation = (loc: UserLocation) => {
    setLocation(loc);
    showToast(`Location updated to ${loc.label} (${loc.areaName})`);
  };

  const handleToggleSave = (entry: SavedEntry) => {
    const wasSaved = savedIds.includes(entry.id);
    toggleSave(entry);
    showToast(wasSaved ? `Removed "${entry.title}" from Saved` : `Saved "${entry.title}" to your favorites!`);
  };

  const handleAddToCart = (item: any) => {
    const success = addToCart(item);
    if (success) {
      showToast(`Added ${item.name || item.title || 'Product'} to cart!`);
    }
  };

  const handleBookService = (service: any) => {
    openServiceBooking(service);
  };

  const handleAskAi = async (prompt: string) => {
    setAiModalPrompt(prompt);
    setAiModalReply('');
    let accText = '';
    await streamLiveAiAssistant(prompt, liveIntel, {
      onChunk: (acc) => {
        accText = acc;
        setAiModalReply(acc);
      },
      onDone: (res) => {
        const fullText = [
          res.responseText,
          res.recommendations.length > 0 ? `\nRecommendations:\n• ${res.recommendations.join('\n• ')}` : '',
          res.sources.length > 0 ? `\n[Sources: ${res.sources.join(' • ')}]` : '',
        ]
          .filter(Boolean)
          .join('\n');
        setAiModalReply(fullText);
      },
    });
  };

  const currentNav = NAV_ITEMS.find((n) => n.id === activeDashboard) || NAV_ITEMS[0];

  const commonProps = {
    onNavigate: handleNavigate,
    onOpenModal: setModalData,
    onAskAi: handleAskAi,
    savedIds,
    onToggleSave: handleToggleSave,
    searchQuery,
    selectedArea,
    currentLocation,
    liveIntel,
    marketplace,
    onAddToCart: handleAddToCart,
    onBookService: handleBookService,
    onOpenCart: () => setCartDrawerOpen(true),
    onOpenLocationPicker: () => setLocationModalOpen(true),
    onOpenMerchantRegistration: () => setMerchantRegModalOpen(true),
  };

  const isNavVisible = (navId: string) => {
    if (navId === 'products') return (marketplace.products || []).length > 0;
    if (navId === 'services') return (marketplace.services || []).length > 0;
    if (navId === 'offers') return (marketplace.offers || []).length > 0;
    if (navId === 'events') return false;
    return true;
  };

  const renderActiveDashboard = () => {
    switch (activeDashboard) {
      case 'home':
        return <HomeDashboard {...commonProps} />;
      case 'businesses':
        return <BusinessesDashboard {...commonProps} />;
      case 'products':
        if (!marketplace.loading && !isNavVisible('products')) {
          return <HomeDashboard {...commonProps} />;
        }
        return <ProductsDashboard {...commonProps} />;
      case 'services':
        if (!marketplace.loading && !isNavVisible('services')) {
          return <HomeDashboard {...commonProps} />;
        }
        return <ServicesDashboard {...commonProps} />;
      case 'offers':
        if (!marketplace.loading && !isNavVisible('offers')) {
          return <HomeDashboard {...commonProps} />;
        }
        return <OffersDashboard {...commonProps} />;
      case 'events':
        return <HomeDashboard {...commonProps} />;
      case 'intelligence':
        return <IntelligenceDashboard {...commonProps} />;
      case 'weather':
        return <WeatherDashboard {...commonProps} />;
      case 'air-quality':
        return <AirQualityDashboard {...commonProps} />;
      case 'traffic':
        return <TrafficDashboard {...commonProps} />;
      case 'alerts':
        return <AlertsDashboard {...commonProps} />;
      case 'ai-assistant':
        return <AiAssistantDashboard {...commonProps} />;
      case 'map':
        return <MapDashboard {...commonProps} />;
      case 'emergency':
        return <EmergencyDashboard {...commonProps} />;
      case 'market-rates':
        return <MarketRatesDashboard {...commonProps} />;
      case 'fuel-rates':
        return <FuelRatesDashboard {...commonProps} />;
      case 'bulletins':
        return <BulletinsDashboard {...commonProps} />;
      case 'saved':
        return <SavedDashboard {...commonProps} savedEntries={savedEntries} />;
      case 'my-orders':
        return <MyOrdersDashboard />;
      default:
        return <HomeDashboard {...commonProps} />;
    }
  };

  if (isMerchantPortal) {
    return (
      <ErrorBoundary
        level="dashboard"
        fallbackTitle="Merchant Portal System Notice"
        onReset={() => navigate('/merchant')}
      >
        <React.Suspense fallback={<PortalLoadingSkeleton />}>
          <MerchantPortal
            marketplace={marketplace}
            currentLocation={currentLocation}
            onSwitchToCitizen={() => {
              navigate('/');
            }}
          />
        </React.Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans">
      {/* URGENT CIVIC EMERGENCY BANNER (NDMA SACHET / FLASH FLOOD WARNING) */}
      {urgentCivicBanner && (
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-red-700 text-white px-4 py-2.5 shadow-sm flex items-center justify-between sticky top-0 z-50 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-300 fill-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-white/20 text-[10px] font-bold uppercase tracking-wider">
                  {urgentCivicBanner.sender || 'NDMA SACHET'}
                </span>
                <p className="text-xs font-bold tracking-tight truncate">{urgentCivicBanner.title}</p>
              </div>
              <p className="text-[11px] text-white/90 line-clamp-1 mt-0.5">{urgentCivicBanner.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              type="button"
              onClick={() => {
                handleNavigate('alerts');
                setUrgentCivicBanner(null);
              }}
              className="px-3 py-1 rounded-md bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold transition cursor-pointer shadow-xs"
            >
              View Advisory →
            </button>
            <button
              type="button"
              onClick={() => setUrgentCivicBanner(null)}
              className="p-1 rounded-md hover:bg-white/20 text-white/80 transition cursor-pointer"
              title="Dismiss Alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          RESPONSIVE UNIFIED SHELL (Mobile + Tablet + Desktop)
          Left Sidebar (hidden on < lg) + Responsive Top Header + Unified Main Body
          + Fixed Mobile Bottom Nav (< lg)
         ===================================================================== */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT SIDEBAR (Desktop Navigation >= lg) */}
        <aside className="hidden lg:flex w-[235px] shrink-0 bg-white border-r border-slate-200/80 flex-col justify-between select-none sticky top-0 h-screen">
          <div className="p-3.5 overflow-y-auto no-scrollbar">
            {/* Brand Logo */}
            <div className="flex items-center justify-between px-2 pt-1 pb-4">
              <button
                type="button"
                onClick={() => handleNavigate('home')}
                className="flex items-center gap-2.5 text-left cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  MyArea<span className="text-blue-600">24</span>
                </span>
              </button>
            </div>

            {/* MAIN SECTION */}
            <nav className="space-y-0.5">
              {NAV_ITEMS.filter((i) => i.section === 'main' && isNavVisible(i.id)).map((item) => {
                const Icon = ICON_MAP[item.id];
                const active = activeDashboard === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                      active
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{getNavLabel(item.id, item.label)}</span>
                  </button>
                );
              })}
            </nav>

            {/* INTELLIGENCE SECTION */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                INTELLIGENCE
              </p>
              <nav className="space-y-0.5">
                {NAV_ITEMS.filter((i) => i.section === 'intelligence').map((item) => {
                  const Icon = ICON_MAP[item.id];
                  const active =
                    activeDashboard === item.id ||
                    (item.id === 'weather' && activeDashboard === 'air-quality') ||
                    (item.id === 'alerts' && activeDashboard === 'bulletins');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                        active
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span>{getNavLabel(item.id, item.label)}</span>
                      </span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold">
                          {item.id === 'alerts' ? liveIntel.alerts.length : item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* COMMUNITY SECTION */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                COMMUNITY
              </p>
              <nav className="space-y-0.5">
                {NAV_ITEMS.filter((i) => i.section === 'community').map((item) => {
                  const Icon = ICON_MAP[item.id];
                  const active =
                    activeDashboard === item.id ||
                    (item.id === 'market-rates' && activeDashboard === 'fuel-rates');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                        active
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span>{getNavLabel(item.id, item.label)}</span>
                      </span>
                      {item.id === 'saved' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-semibold">
                          {savedEntries.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Merchant Partner Onboarding Card at Bottom of Sidebar */}
          <div className="p-3">
            <div
              onClick={handleSwitchToMerchant}
              className="cursor-pointer rounded-xl bg-slate-50 hover:bg-blue-50/50 p-3 border border-slate-200 hover:border-blue-200 transition group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Store className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">Own a Shop?</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    List your local store
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-blue-600 pt-2 border-t border-slate-200/60">
                <span>Merchant Hub</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN AREA (Mobile Header + Desktop Header + Dashboard Content) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* MOBILE TOP HEADER BAR (< lg) */}
          <header className="lg:hidden bg-white/95 backdrop-blur-md text-slate-900 border-b border-slate-200/80 px-3.5 pt-2.5 pb-2.5 sticky top-0 z-30 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => handleNavigate('home')}
                className="cursor-pointer flex items-center gap-2 text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-xs text-white">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="text-base font-bold tracking-tight text-slate-900">
                  MyArea<span className="text-blue-600">24</span>
                </span>
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleNavigate('weather')}
                  className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition border border-slate-200/60"
                >
                  <Sun className="w-3 h-3 text-amber-500 fill-amber-500" /> {liveIntel.weather.temperatureC}°C
                </button>
                <button
                  type="button"
                  onClick={() => setCartDrawerOpen(true)}
                  className="relative px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 transition cursor-pointer text-xs font-semibold shadow-xs"
                  title="View Cart"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {cartItems.length > 0 && (
                    <span className="text-[11px] font-bold">
                      {cartItems.reduce((acc, it) => acc + it.quantity, 0)}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  aria-label="View neighborhood notifications"
                  onClick={() => {
                    setNotificationsOpen((v) => !v);
                    setProfileMenuOpen(false);
                  }}
                  className="relative w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200/60 text-slate-600 flex items-center justify-center cursor-pointer transition"
                >
                  <Bell className="w-3.5 h-3.5" />
                  {liveIntel.alerts.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1 right-1" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="User account and profile menu"
                  onClick={() => {
                    setProfileMenuOpen((v) => !v);
                    setNotificationsOpen(false);
                  }}
                  className="w-7 h-7 rounded-md bg-blue-600 text-white text-xs font-bold flex items-center justify-center cursor-pointer shadow-xs"
                >
                  {localStorage.getItem('myarea24_user_avatar_emoji') || (authUser?.fullName || 'User').charAt(0).toUpperCase()}
                </button>
              </div>
            </div>

            {/* Location Selector Pill */}
            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="w-full mb-2 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between gap-2 text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-slate-900">{currentLocation.label}</span>
                    <span className="text-[11px] font-medium text-slate-500 truncate">
                      • {currentLocation.areaName}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">
                    {currentLocation.fullAddress}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 shrink-0">
                Change
              </span>
            </button>

            {/* Search Bar */}
            <div className="flex items-center gap-1.5">
              <div className="flex-1 bg-slate-100/80 text-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2 border border-slate-200/80 focus-within:border-blue-500 focus-within:bg-white transition">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={currentNav.searchPlaceholder}
                  className="bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(true)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center border border-slate-200 shrink-0 cursor-pointer transition"
                title="All Categories & Sections"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* DESKTOP TOP HEADER BAR (>= lg) */}
          <header className="hidden lg:flex h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 items-center justify-between gap-4 sticky top-0 z-30">
            {/* Left: Location Selector + Global Search */}
            <div className="flex items-center gap-3.5 flex-1 max-w-3xl">
              {/* Location Selector Trigger */}
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="group flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition text-left shrink-0 max-w-[270px] cursor-pointer"
              >
                <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-slate-900 truncate">
                      {currentLocation.label}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 truncate">
                      • {currentLocation.areaName}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 group-hover:text-blue-600 transition" />
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">
                    {currentLocation.fullAddress}
                  </p>
                </div>
              </button>

              {/* Global Search Box */}
              <div
                onClick={() => setCommandOpen(true)}
                className="cursor-pointer flex-1 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg px-3.5 py-1.5 flex items-center justify-between gap-2 transition focus-within:border-blue-500 focus-within:bg-white"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder={currentNav.searchPlaceholder}
                    className="bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none w-full"
                  />
                </div>
                <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-medium text-slate-400 shrink-0">
                  ⌘ K
                </span>
              </div>
            </div>

            {/* Right Header Pills */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Live Weather + AQI Pill */}
              <button
                type="button"
                onClick={() => handleNavigate('weather')}
                className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                title="View Live Local Weather & AQI"
              >
                <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>{liveIntel.weather.temperatureC}°C</span>
                <span
                  className={`text-[10px] font-semibold ${liveIntel.airQuality.colorText} ${liveIntel.airQuality.colorBg} px-1.5 py-0.5 rounded`}
                >
                  AQI {liveIntel.airQuality.aqiValue}
                </span>
              </button>

              {/* Cart Button */}
              <button
                type="button"
                aria-label="View Local Shopping Cart and Checkout"
                onClick={() => setCartDrawerOpen(true)}
                className="relative px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition shadow-xs active:scale-95"
                title="View Local Shopping Cart & Checkout"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-white" />
                <span>Cart</span>
                {cartItems.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-white text-emerald-800 text-[10px] font-bold shadow-xs">
                    {cartItems.reduce((acc, it) => acc + it.quantity, 0)} • ₹{cartItems.reduce((acc, it) => acc + it.price * it.quantity, 0)}
                  </span>
                )}
              </button>

              {/* Notification Bell */}
              <button
                type="button"
                aria-label="Live Neighbourhood Notifications"
                onClick={() => {
                  setNotificationsOpen((v) => !v);
                  setProfileMenuOpen(false);
                }}
                className="relative w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
                title="Live Neighbourhood Notifications"
              >
                <Bell className="w-3.5 h-3.5" />
                {liveIntel.alerts.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
                )}
              </button>

              {/* User Profile Pill */}
              <button
                type="button"
                data-testid="user-profile-button"
                aria-label={authUser ? `Logged in as ${authUser.fullName}` : 'Sign In and Account Profile'}
                onClick={() => {
                  setProfileMenuOpen((v) => !v);
                  setNotificationsOpen(false);
                }}
                className="pl-1.5 pr-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center gap-2 transition cursor-pointer"
                title={authUser ? `Logged in as ${authUser.fullName}` : 'Sign In / Account Profile'}
              >
                <span className="w-6 h-6 rounded-md bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  {localStorage.getItem('myarea24_user_avatar_emoji') || (authUser?.fullName || 'User').charAt(0).toUpperCase()}
                </span>
                <div className="text-left hidden xl:block">
                  <p className="text-xs font-semibold text-slate-800 leading-none">
                    {authUser ? authUser.fullName : 'Sign In'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {authUser ? authUser.email : 'Account'}
                  </p>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </header>

          {/* UNIFIED MAIN CONTENT BODY (Mobile + Desktop) */}
          <main className="flex-1 px-3.5 py-4 pb-24 lg:p-5 lg:pb-8 overflow-y-auto">
            <div className="max-w-[1320px] mx-auto">
              <ErrorBoundary
                level="dashboard"
                fallbackTitle="Dashboard Content Notice"
                onReset={() => handleNavigate('home')}
              >
                <React.Suspense fallback={<DashboardLoadingSkeleton />}>
                  {renderActiveDashboard()}
                </React.Suspense>
              </ErrorBoundary>

              {/* INDIAN COMMERCE & CONSUMER PROTECTION 2020 COMPLIANCE FOOTER */}
              <ComplianceFooter />
            </div>
          </main>
        </div>
      </div>

      {/* =====================================================================
          MOBILE BOTTOM NAVIGATION BAR (< lg)
          Fixed 6-button bar: Home | Map | Stores | Alerts | Orders | More
         ===================================================================== */}
      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] px-2 py-1.5 z-40"
      >
        <div className="grid grid-cols-6 items-center max-w-md mx-auto">
          {/* 1. Home */}
          <button
            type="button"
            onClick={() => {
              setMobileMoreOpen(false);
              handleNavigate('home');
            }}
            className={`flex flex-col items-center justify-center py-1 gap-0.5 transition cursor-pointer ${
              activeDashboard === 'home' && !mobileMoreOpen
                ? 'text-[#2563EB] font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <Home
              className={`w-5 h-5 ${
                activeDashboard === 'home' && !mobileMoreOpen ? 'stroke-[2.5]' : 'stroke-[1.8]'
              }`}
            />
            <span className="text-[10px] leading-tight">Home</span>
          </button>

          {/* 2. Map */}
          <button
            type="button"
            onClick={() => {
              setMobileMoreOpen(false);
              handleNavigate('map');
            }}
            className={`flex flex-col items-center justify-center py-1 gap-0.5 transition cursor-pointer ${
              activeDashboard === 'map' && !mobileMoreOpen
                ? 'text-[#2563EB] font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <MapPin
              className={`w-5 h-5 ${
                activeDashboard === 'map' && !mobileMoreOpen ? 'stroke-[2.5]' : 'stroke-[1.8]'
              }`}
            />
            <span className="text-[10px] leading-tight">Map</span>
          </button>

          {/* 3. Stores / Explore */}
          <button
            type="button"
            onClick={() => {
              setMobileMoreOpen(false);
              handleNavigate('businesses');
            }}
            className={`flex flex-col items-center justify-center py-1 gap-0.5 transition cursor-pointer ${
              ['businesses', 'products', 'services', 'offers', 'events'].includes(activeDashboard) && !mobileMoreOpen
                ? 'text-[#2563EB] font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <Store
              className={`w-5 h-5 ${
                ['businesses', 'products', 'services', 'offers', 'events'].includes(activeDashboard) && !mobileMoreOpen
                  ? 'stroke-[2.5]'
                  : 'stroke-[1.8]'
              }`}
            />
            <span className="text-[10px] leading-tight">Stores</span>
          </button>

          {/* 4. Alerts */}
          <button
            type="button"
            onClick={() => {
              setMobileMoreOpen(false);
              handleNavigate('alerts');
            }}
            className={`flex flex-col items-center justify-center py-1 gap-0.5 transition cursor-pointer ${
              activeDashboard === 'alerts' && !mobileMoreOpen
                ? 'text-[#2563EB] font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div className="relative">
              <Bell
                className={`w-5 h-5 ${
                  activeDashboard === 'alerts' && !mobileMoreOpen ? 'stroke-[2.5]' : 'stroke-[1.8]'
                }`}
              />
              {liveIntel.alerts.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5 ring-2 ring-white" />
              )}
            </div>
            <span className="text-[10px] leading-tight">Alerts</span>
          </button>

          {/* 5. Orders */}
          <button
            type="button"
            onClick={() => {
              setMobileMoreOpen(false);
              handleNavigate('my-orders');
            }}
            className={`flex flex-col items-center justify-center py-1 gap-0.5 transition cursor-pointer ${
              activeDashboard === 'my-orders' && !mobileMoreOpen
                ? 'text-[#2563EB] font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <ShoppingBag
              className={`w-5 h-5 ${
                activeDashboard === 'my-orders' && !mobileMoreOpen ? 'stroke-[2.5]' : 'stroke-[1.8]'
              }`}
            />
            <span className="text-[10px] leading-tight">Orders</span>
          </button>

          {/* 6. More */}
          <button
            type="button"
            onClick={() => setMobileMoreOpen((v) => !v)}
            className={`flex flex-col items-center justify-center py-1 gap-0.5 transition cursor-pointer ${
              mobileMoreOpen
                ? 'text-[#2563EB] font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <LayoutGrid
              className={`w-5 h-5 ${
                mobileMoreOpen ? 'stroke-[2.5]' : 'stroke-[1.8]'
              }`}
            />
            <span className="text-[10px] leading-tight">More</span>
          </button>
        </div>
      </nav>

      {/* =====================================================================
          MOBILE "MORE" CATEGORIZED DRAWER (< lg)
         ===================================================================== */}
      {mobileMoreOpen && (
        <div
          onClick={() => setMobileMoreOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex flex-col justify-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl p-4 max-h-[82vh] overflow-y-auto pb-10 animate-in slide-in-from-bottom-5 duration-200"
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">All Sections & Tools</h3>
                  <p className="text-[11px] text-slate-500">
                    Local discovery, intelligence & community navigation
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close navigation menu drawer"
                onClick={() => setMobileMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Switch to Merchant Mode Banner */}
            <div
              onClick={() => {
                setMobileMoreOpen(false);
                handleSwitchToMerchant();
              }}
              className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shadow-sm border border-purple-800/60 cursor-pointer active:scale-98 transition"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-white">Merchant Business Portal</h4>
                  <p className="text-[10px] text-purple-200">Manage store orders, catalog & leads</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-extrabold shrink-0 shadow-xs">
                Switch ›
              </span>
            </div>

            <div className="space-y-4">
              {/* Explore & Commerce */}
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 px-1">
                  Explore & Local Commerce
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {NAV_ITEMS.filter((i) => i.section === 'main' && i.id !== 'home' && isNavVisible(i.id)).map((item) => {
                    const Icon = ICON_MAP[item.id] || Store;
                    const active = activeDashboard === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          handleNavigate(item.id);
                          setMobileMoreOpen(false);
                        }}
                        className={`p-2.5 rounded-2xl border flex flex-col items-center text-center gap-1.5 transition cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                            : 'bg-slate-50 text-slate-700 border-slate-200/70 hover:bg-indigo-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px] font-bold leading-tight">{getNavLabel(item.id, item.label)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Intelligence & AI */}
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 px-1">
                  Neighbourhood Intelligence & AI
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {NAV_ITEMS.filter((i) => i.section === 'intelligence').map((item) => {
                    const Icon = ICON_MAP[item.id] || Zap;
                    const active = activeDashboard === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          handleNavigate(item.id);
                          setMobileMoreOpen(false);
                        }}
                        className={`p-2.5 rounded-2xl border flex flex-col items-center text-center gap-1.5 transition relative cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                            : 'bg-slate-50 text-slate-700 border-slate-200/70 hover:bg-indigo-50'
                        }`}
                      >
                        {item.badge && (
                          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[8px] font-extrabold">
                            {item.id === 'alerts' ? liveIntel.alerts.length : item.badge}
                          </span>
                        )}
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px] font-bold leading-tight">{getNavLabel(item.id, item.label)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Community & Emergency */}
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 px-1">
                  Community, Rates & Utilities
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {NAV_ITEMS.filter((i) => i.section === 'community').map((item) => {
                    const Icon = ICON_MAP[item.id] || FileText;
                    const active = activeDashboard === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          handleNavigate(item.id);
                          setMobileMoreOpen(false);
                        }}
                        className={`p-2.5 rounded-2xl border flex flex-col items-center text-center gap-1.5 transition cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                            : 'bg-slate-50 text-slate-700 border-slate-200/70 hover:bg-indigo-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px] font-bold leading-tight">{getNavLabel(item.id, item.label)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          NOTIFICATIONS POPOVER (Bell Icon Click on Desktop or Mobile)
         ===================================================================== */}
      {notificationsOpen && (
        <div
          onClick={() => setNotificationsOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-end pt-14 lg:pt-16 px-4 bg-slate-950/20"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-extrabold text-slate-900">
                  Live Area Notifications ({currentLocation.areaName})
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-extrabold">
                {liveIntel.alerts.length} Active
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {liveIntel.alerts.map((al) => (
                <button
                  key={al.id}
                  type="button"
                  onClick={() => handleNavigate('alerts')}
                  className="w-full p-3.5 text-left hover:bg-slate-50 transition flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${al.badgeClass}`}>
                        {al.category}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {al.timeAgo}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900">{al.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{al.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                </button>
              ))}
            </div>
            <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleNavigate('alerts')}
                className="w-full py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
              >
                View All Area Alerts →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          USER PROFILE POPOVER MENU
         ===================================================================== */}
      {profileMenuOpen && (
        <div
          onClick={() => setProfileMenuOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-end pt-14 lg:pt-16 px-4 bg-slate-950/20"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-72 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div
              onClick={() => {
                setProfileMenuOpen(false);
                setAuthModalOpen(true);
              }}
              className="p-3.5 bg-slate-900 text-white flex items-center gap-3 cursor-pointer hover:bg-slate-800 transition"
              title="Click to manage account profile"
            >
              <div className="w-9 h-9 rounded-full bg-blue-600 border border-white/20 flex items-center justify-center font-bold text-xs">
                {localStorage.getItem('myarea24_user_avatar_emoji') || (authUser?.fullName || 'User').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold truncate">
                    {authUser ? authUser.fullName : 'Welcome, Guest'}
                  </p>
                  <span className="px-1.5 py-0.2 rounded bg-white/20 text-white text-[9px] font-medium">
                    {authUser ? (authUser.role === 'merchant' ? 'Merchant' : 'Citizen') : 'Visitor'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 truncate">
                  {authUser ? authUser.email : 'Click to sign in via Email OTP'}
                </p>
              </div>
            </div>
            <div className="p-1.5 space-y-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setAuthModalOpen(true);
                }}
                className="w-full px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center justify-between font-medium text-slate-700 cursor-pointer transition"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />{' '}
                  {authUser ? 'Account & Profile Settings' : 'Sign In / Register via OTP'}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  handleNavigate('my-orders');
                }}
                className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between font-semibold text-slate-700"
              >
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" /> My Orders & Bookings
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('ai-assistant')}
                className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between font-semibold text-slate-700"
              >
                <span className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-violet-600" /> MyArea24 AI Assistant
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('emergency')}
                className="w-full px-3 py-2 rounded-xl hover:bg-rose-50 flex items-center justify-between font-semibold text-rose-600"
              >
                <span className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Emergency SOS Contacts
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <div className="pt-1 border-t border-slate-100">
                <button
                  type="button"
                  data-testid="switch-to-merchant-button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    handleSwitchToMerchant();
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100 flex items-center justify-between font-bold text-indigo-900 border border-indigo-200/60"
                >
                  <span className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-indigo-600" />
                    {merchantProfile?.isVerified
                      ? 'Switch to Merchant Portal'
                      : 'Register as Merchant / Business'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          BLINKIT / UBER STYLE LOCATION PICKER MODAL
         ===================================================================== */}
      <React.Suspense fallback={null}>
        {locationModalOpen && (
          <LocationPickerModal
            isOpen={locationModalOpen}
            onClose={() => setLocationModalOpen(false)}
            currentLocation={currentLocation}
            onSelectLocation={handleSelectLocation}
          />
        )}
      </React.Suspense>


      {/* TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed bottom-20 lg:bottom-5 right-4 lg:right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* COMMAND PALETTE MODAL (Cmd/Ctrl + K) */}
      {commandOpen && (
        <div
          onClick={() => setCommandOpen(false)}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-start justify-center pt-16 sm:pt-20 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
          >
            <div className="p-3.5 border-b border-slate-100 flex items-center gap-2.5">
              <Search className="w-4 h-4 text-indigo-600" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search businesses, products, alerts or jump to any section..."
                className="flex-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 px-1.5"
              >
                ESC
              </button>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto">
              {searchQuery.trim().length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setCommandOpen(false);
                    handleAskAi(searchQuery);
                  }}
                  className="w-full mb-2 p-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center justify-between text-xs font-bold text-indigo-700 transition"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Ask MyArea24 AI: “{searchQuery}”
                  </span>
                  <span>Ask →</span>
                </button>
              )}
              <p className="px-2.5 py-1 text-[10px] font-extrabold uppercase text-slate-400">
                Quick Jump Across MyArea24
              </p>
              <div className="grid grid-cols-2 gap-1">
                {NAV_ITEMS.filter(
                  (item) =>
                    isNavVisible(item.id) &&
                    (!searchQuery || item.label.toLowerCase().includes(searchQuery.toLowerCase()))
                ).map((item) => {
                  const Icon = ICON_MAP[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        handleNavigate(item.id);
                        setCommandOpen(false);
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-indigo-50 text-xs font-semibold text-slate-700 hover:text-indigo-700 text-left transition"
                    >
                      <Icon className="w-4 h-4 text-indigo-500" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK AI ASSISTANT INSIGHT MODAL */}
      {aiModalPrompt && (
        <div
          onClick={() => setAiModalPrompt(null)}
          className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-indigo-100 w-full max-w-lg overflow-hidden"
          >
            <div className="bg-gradient-to-r from-[#0B1739] via-[#1B2B65] to-[#312E81] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src="./assets/crops/ai-robot-umbrella.webp"
                  alt="AI Robot"
                  className="w-10 h-10 rounded-xl bg-white/90 p-0.5 object-contain"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                    <h3 className="text-sm font-extrabold">MyArea24 Local Insights</h3>
                  </div>
                  <p className="text-[11px] text-blue-200">Neighborhood Overview • {selectedArea}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiModalPrompt(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-slate-100 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800">
                “{aiModalPrompt}”
              </div>
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                {aiModalReply}
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAiModalPrompt(null);
                    handleNavigate('ai-assistant');
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  Open Full AI Assistant Dashboard →
                </button>
                <button
                  type="button"
                  onClick={() => setAiModalPrompt(null)}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTION / DETAILS MODAL */}
      {modalData && (
        <div
          onClick={handleCloseModal}
          className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
          >
            {modalData.image && (
              <div className="relative h-44 bg-slate-100 shrink-0">
                <img src={modalData.image} alt={modalData.title} className="w-full h-full object-cover" />
                {modalData.badge && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs font-extrabold shadow">
                    {modalData.badge}
                  </span>
                )}
                {modalData.verified && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-white/95 text-emerald-700 text-[10px] font-bold shadow flex items-center gap-1 border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified
                  </span>
                )}
              </div>
            )}

            <div className="p-5 overflow-y-auto space-y-3.5">
              {reportModalOpen ? (
                /* Report Incorrect Information Subview */
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5 text-rose-600" /> Report Incorrect Information
                    </h4>
                    <button
                      type="button"
                      onClick={() => setReportModalOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Help keep your neighborhood directory accurate. What needs correction for <strong className="text-slate-800">{modalData.title}</strong>?
                  </p>
                  <div className="space-y-1.5">
                    {[
                      'Permanently closed or relocated',
                      'Incorrect phone number or WhatsApp',
                      'Wrong opening hours',
                      'Wrong map pin or address',
                      'Incorrect price or product unavailable',
                    ].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setReportReason(reason)}
                        className={`w-full text-left p-2 rounded-xl text-xs transition border cursor-pointer ${
                          reportReason === reason
                            ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReportModalOpen(false)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={!reportReason}
                      onClick={() => {
                        try {
                          const existingReports = JSON.parse(localStorage.getItem('myarea24_user_reports_v1') || '[]');
                          existingReports.push({
                            title: modalData.title,
                            category: modalData.category,
                            reason: reportReason,
                            timestamp: new Date().toISOString(),
                          });
                          localStorage.setItem('myarea24_user_reports_v1', JSON.stringify(existingReports));
                        } catch {}
                        showToast(`Report saved locally for "${reportReason}". Stored for moderation queue synchronization.`);
                        setReportModalOpen(false);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition shadow"
                    >
                      Submit Report
                    </button>
                  </div>
                </div>
              ) : (
                /* Standard Profile View */
                <>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
                        {modalData.category}
                      </p>
                      {modalData.source && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Source: {modalData.source}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 mt-0.5">{modalData.title}</h3>
                    {modalData.subtitle && (
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">{modalData.subtitle}</p>
                    )}
                  </div>

                  {/* Provenance & Freshness Badge */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    {modalData.verified && (
                      <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified Merchant
                      </span>
                    )}
                    {modalData.freshnessLabel && (
                      <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                        <Clock className="w-3 h-3 text-slate-400" /> {modalData.freshnessLabel}
                      </span>
                    )}
                  </div>

                  {(modalData.price || modalData.rating || modalData.location) && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {modalData.price && (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-extrabold text-slate-900">
                          {modalData.price}
                        </span>
                      )}
                      {modalData.rating && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 font-bold text-amber-700">
                          ★ {modalData.rating}
                        </span>
                      )}
                      {modalData.location && (
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 font-semibold text-blue-700">
                          📍 {modalData.location}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{modalData.description}</p>

                  {/* Primary Action Button (RSVP, Dial SOS, Claim Offer, Order Reserve) */}
                  {modalData.primaryActionLabel && (
                    <button
                      type="button"
                      onClick={() => {
                        if (modalData.phone) {
                          window.location.href = `tel:${modalData.phone.replace(/[^\d+]/g, '')}`;
                        } else if (
                          modalData.primaryActionLabel?.toLowerCase().includes('rsvp') ||
                          modalData.primaryActionLabel?.toLowerCase().includes('register')
                        ) {
                          showToast(`✓ RSVP Confirmed for "${modalData.title}". Added to your local schedule.`);
                        } else if (modalData.primaryActionLabel?.toLowerCase().includes('claim')) {
                          showToast(`✓ Coupon activated! Show this code at ${modalData.title} to redeem.`);
                        } else if (modalData.address || modalData.location) {
                          window.open(
                            `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                              modalData.address || modalData.location || modalData.title
                            )}`,
                            '_blank'
                          );
                        } else {
                          showToast(`Request submitted for "${modalData.title}".`);
                        }
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                      <span>{modalData.primaryActionLabel}</span>
                    </button>
                  )}

                  {/* High-Utility Direct Contact Strip */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Direct Contact & Navigation
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                      {modalData.phone ? (
                        <a
                          href={`tel:${modalData.phone.replace(/[^\d+]/g, '')}`}
                          className="py-2 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1 transition shadow-xs"
                          title="Call directly"
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Call</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => showToast('Phone number not listed for this place.')}
                          className="py-2 px-2 rounded-xl bg-slate-200 text-slate-400 flex items-center justify-center gap-1 cursor-not-allowed"
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span>No Phone</span>
                        </button>
                      )}

                      {modalData.whatsapp || modalData.phone ? (
                        <a
                          href={`https://wa.me/${(() => {
                            const raw = (modalData.whatsapp || modalData.phone || '').replace(/[^\d]/g, '');
                            return raw.length === 10 ? `91${raw}` : raw;
                          })()}?text=${encodeURIComponent(
                            `Hi! I found ${modalData.title} on MyArea24. Could you please share availability / details?`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white flex items-center justify-center gap-1 transition shadow-xs"
                          title="Chat on WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">WhatsApp</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => showToast('WhatsApp not connected for this business.')}
                          className="py-2 px-2 rounded-xl bg-slate-200 text-slate-400 flex items-center justify-center gap-1 cursor-not-allowed"
                        >
                          <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>WhatsApp</span>
                        </button>
                      )}

                      {modalData.address || modalData.location ? (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                            modalData.address || modalData.location || modalData.title
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center gap-1 transition"
                          title="Open Google Maps Directions"
                        >
                          <Navigation className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Directions</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => showToast('Address details unavailable for map directions.')}
                          className="py-2 px-2 rounded-xl bg-slate-200 text-slate-400 flex items-center justify-center gap-1 cursor-not-allowed"
                        >
                          <Navigation className="w-3.5 h-3.5 shrink-0" />
                          <span>Directions</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Feedback Strip: "Was this information useful?" */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="text-[11px] font-semibold text-slate-600">Was this result helpful?</span>
                    {modalFeedback ? (
                      <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Feedback recorded locally!
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setModalFeedback('yes');
                            try {
                              const existing = JSON.parse(localStorage.getItem('myarea24_user_feedback_v1') || '{}');
                              existing[modalData.title] = 'yes';
                              localStorage.setItem('myarea24_user_feedback_v1', JSON.stringify(existing));
                            } catch {}
                            showToast('Feedback saved locally. Thanks for validating this result!');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 text-slate-600 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <ThumbsUp className="w-3 h-3" /> Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModalFeedback('no');
                            try {
                              const existing = JSON.parse(localStorage.getItem('myarea24_user_feedback_v1') || '{}');
                              existing[modalData.title] = 'no';
                              localStorage.setItem('myarea24_user_feedback_v1', JSON.stringify(existing));
                            } catch {}
                            showToast('Feedback saved locally. Result noted for device re-ranking.');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 text-slate-600 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <ThumbsDown className="w-3 h-3" /> No
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Report Incorrect Info Link */}
                  <div className="pt-1 flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => setReportModalOpen(true)}
                      className="text-slate-400 hover:text-rose-600 flex items-center gap-1 font-medium transition cursor-pointer"
                    >
                      <Flag className="w-3 h-3" /> Report incorrect details
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="text-slate-500 hover:text-slate-700 font-bold"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STARTUP MERCHANT REGISTRATION & VERIFICATION MODAL */}
      <React.Suspense fallback={null}>
        {merchantRegModalOpen && (
          <MerchantRegistrationModal
            isOpen={merchantRegModalOpen}
            onClose={() => setMerchantRegModalOpen(false)}
            currentArea={currentLocation.areaName}
            coords={currentLocation.coords}
            defaultMode={merchantProfile ? 'login' : 'register'}
            onSuccess={(profile) => {
              setMerchantProfile(profile);
              setMerchantRegModalOpen(false);
              showToast(`Welcome ${profile.businessName}! Business storefront unlocked.`);
              navigate('/merchant');
            }}
          />
        )}
      </React.Suspense>

      {/* MULTI-STORE CART CONFLICT RESOLUTION MODAL */}
      <CartConflictModal />

      {/* SLIDE-OUT CART DRAWER WITH LIVE ORDER LIFECYCLE */}
      <React.Suspense fallback={null}>
        {cartDrawerOpen && (
          <CartDrawer
            isOpen={cartDrawerOpen}
            onClose={() => setCartDrawerOpen(false)}
            items={cartItems}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveItem={handleRemoveCartItem}
            onClearCart={handleClearCart}
            currentLocation={currentLocation}
            onNavigateToMap={() => handleNavigate('map')}
            onNavigateToProducts={() => {
              setCartDrawerOpen(false);
              handleNavigate('products');
            }}
          />
        )}
      </React.Suspense>

      {/* SERVICE SLOT BOOKING MODAL WITH OTP & LIFECYCLE */}
      <React.Suspense fallback={null}>
        {serviceBookingModalOpen && (
          <ServiceBookingModal
            isOpen={serviceBookingModalOpen}
            onClose={() => {
              setServiceBookingModalOpen(false);
              setSelectedServiceToBook(null);
            }}
            service={selectedServiceToBook}
            currentLocation={currentLocation}
          />
        )}
      </React.Suspense>

      {/* PASSWORDLESS EMAIL OTP AUTH & PROFILE MODAL */}
      <React.Suspense fallback={null}>
        {authModalOpen && (
          <AuthModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            onSuccess={(user) => {
              showToast(`Welcome, ${user.fullName}!`);
              setAuthModalOpen(false);
            }}
          />
        )}
      </React.Suspense>

      {/* DPDP ACT 2023 CONSENT BANNER & STATUTORY PREFERENCES */}
      <LocationPermissionPrompt
        onLocationResolved={handleSelectLocation}
        onOpenManualSelector={() => setLocationModalOpen(true)}
      />
      <NotificationPermissionPrompt />
      <DPDPConsentBanner />
    </div>
  );
}
export default App;
