import React, { useState, useEffect } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import {

  MerchantDashboardId,

  MerchantBusinessInfo,

  MerchantProductItem,

  MerchantServiceItem,

  MerchantOfferItem,

  MerchantPostItem,

  MerchantEventItem,

  MerchantReviewItem,

  MerchantConversation,

  MerchantLeadItem,

  MerchantPromotionItem,

  MerchantInvoiceItem,

  MerchantOrderItem,

} from './types';

import {

  EMPTY_MERCHANT_STOREFRONT,

  INITIAL_MERCHANT_PRODUCTS,

  INITIAL_MERCHANT_SERVICES,

  INITIAL_MERCHANT_OFFERS,

  INITIAL_MERCHANT_POSTS,

  INITIAL_MERCHANT_EVENTS,

  INITIAL_MERCHANT_REVIEWS,

  INITIAL_MERCHANT_CONVERSATIONS,

  INITIAL_MERCHANT_LEADS,

  INITIAL_MERCHANT_PROMOTIONS,

  INITIAL_MERCHANT_INVOICES,

  INITIAL_MERCHANT_ORDERS,

} from './data/merchantMockData';

import { CheckCircle2 } from 'lucide-react';

import {

  realtimeService,

  REALTIME_STATUS_EVENT,

  MERCHANT_LEAD_EVENT,

  MERCHANT_INQUIRY_EVENT,

  MERCHANT_REVIEW_EVENT,

  MERCHANT_ORDER_EVENT,

  ORDER_STATUS_EVENT,

  RealtimeConnectionStatus,

} from '../services/realtimeService';

import { MerchantHomeDashboard } from './dashboards/MerchantHomeDashboard';

import { MerchantProfileDashboard } from './dashboards/MerchantProfileDashboard';

import { MerchantProductsDashboard } from './dashboards/MerchantProductsDashboard';

import { MerchantOrdersDashboard } from './dashboards/MerchantOrdersDashboard';

import { MerchantOffersDashboard } from './dashboards/MerchantOffersDashboard';

import { MerchantPostsDashboard } from './dashboards/MerchantPostsDashboard';

import { MerchantEventsDashboard } from './dashboards/MerchantEventsDashboard';

import { MerchantReviewsDashboard } from './dashboards/MerchantReviewsDashboard';

import { MerchantMessagesDashboard } from './dashboards/MerchantMessagesDashboard';

import { MerchantLeadsDashboard } from './dashboards/MerchantLeadsDashboard';

import { MerchantAnalyticsDashboard } from './dashboards/MerchantAnalyticsDashboard';

import { MerchantPromotionsDashboard } from './dashboards/MerchantPromotionsDashboard';

import { MerchantPaymentsDashboard } from './dashboards/MerchantPaymentsDashboard';

import { MerchantSettingsDashboard } from './dashboards/MerchantSettingsDashboard';

import { MerchantActionModals } from './components/MerchantActionModals';

import {

  LiveCommunityMarketplaceState,

  syncMerchantProductToGlobal,

  syncMerchantProductToggle,

  getStoredMerchantProfile,

  getStoredMerchantSession,

  getStoredMerchantAccounts,

  saveMerchantSession,

  clearMerchantSession,

  MerchantRegistrationProfile,

} from '../services/communityMarketplaceService';

import { UserLocation } from '../types';

import { MerchantRegistrationModal } from '../components/MerchantRegistrationModal';

import {

  getMerchantOverview,

  getMerchantProducts,

  getMerchantOrders,

  createMerchantProduct,

  updateMerchantProduct,

  createMerchantService,

  createMerchantOffer,

  createMerchantEvent,

} from './services/merchantApiService';

// Modularized Merchant Sub-Components

import { MerchantAuthRequiredView } from './components/MerchantAuthRequiredView';

import { MerchantDesktopSidebar } from './components/MerchantDesktopSidebar';

import { MerchantDesktopHeader } from './components/MerchantDesktopHeader';

import { MerchantMobileHeader } from './components/MerchantMobileHeader';

import { MerchantMobileNav } from './components/MerchantMobileNav';

import { MerchantMobileMoreDrawer } from './components/MerchantMobileMoreDrawer';

interface MerchantPortalProps {

  onSwitchToCitizen: () => void;

  marketplace?: LiveCommunityMarketplaceState;

  currentLocation?: UserLocation;

}

const STORAGE_KEY = 'myarea24_merchant_portal_state_v1';

function buildMerchantBusinessInfo(profile: MerchantRegistrationProfile): MerchantBusinessInfo {

  const categoryTaglines: Record<string, string> = {

    'Restaurants & Cafes': 'Fresh Local Dining, Delicacies & Express Delivery',

    'Groceries & Daily Staples': 'Daily Farm-Fresh Staples, Fruits & Supermarket Goods',

    '24×7 Pharmacies & Healthcare': 'Certified Healthcare, Prescription Medicines & Emergency Care',

    'Electronics, Mobiles & Repair': 'Authentic Gadgets, Mobile Accessories & Certified Repairs',

    'Home Utility & Repair Services': 'Prompt Neighborhood Electricians, Plumbers & Technicians',

    'Salons, Spa & Grooming': 'Professional Beauty Care, Haircuts & Wellness Treatments',

    'Fitness, Gyms & Sports Arenas': 'Modern Equipment, Certified Trainers & Fitness Community',

    'Clothing, Footwear & Fashion': 'Trending Apparel, Local Boutiques & Tailoring Services',

    'Event Venues & Hall Bookings': 'Banquet Halls, Event Spaces & Community Celebrations',

  };

  const bizId = profile.id || `biz_${profile.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  const tagline = profile.tagline || categoryTaglines[profile.category] || 'Verified Local Merchant Storefront';

  return {

    id: bizId,

    name: profile.businessName,

    tagline,

    category: profile.category,

    ownerName: profile.ownerName,

    ownerRole: 'Owner & Operator',

    locationArea: `${profile.locality || 'Local'}, ${profile.city || 'India'}`,

    pincode: profile.pincode || '',

    fullAddress: profile.fullAddress,

    landmark: `${profile.locality || 'Commercial'} Market`,

    serviceArea: `${profile.locality || 'Neighborhood'} and nearby sectors`,

    phone: profile.phone,

    email: profile.email,

    website: `www.${profile.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.in`,

    rating: 5.0,

    reviewCount: 0,

    verificationStatus: profile.isVerified ? 'Verified' : 'Under Review',

    submissionDate: new Date(profile.registeredAt || Date.now()).toLocaleDateString('en-IN', {

      day: 'numeric',

      month: 'short',

      year: 'numeric',

    }),

    profileCompletion: profile.isVerified ? 100 : 75,

    logo: './assets/crops/biz-card-chai.webp',

    coverImage: './assets/crops/biz-ai-cafe.webp',

  };

}

export function MerchantPortal({ onSwitchToCitizen, marketplace, currentLocation }: MerchantPortalProps) {

  // Active Merchant Session & Profile

  const [session, setSession] = useState<MerchantRegistrationProfile | null>(() => {

    return getStoredMerchantSession();

  });

  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  // Business Storefront: checks verified registration profile first, then fallback

  const [currentBusiness, setCurrentBusiness] = useState<MerchantBusinessInfo>(() => {

    try {

      const activeSession = getStoredMerchantSession();

      if (activeSession && activeSession.isVerified) {

        return buildMerchantBusinessInfo(activeSession);

      }

      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {

        const parsed = JSON.parse(raw);

        if (parsed.currentBusiness) return parsed.currentBusiness;

      }

    } catch {}

    return EMPTY_MERCHANT_STOREFRONT;

  });

  const location = useLocation();

  const navigate = useNavigate();

  const merchantSubroute = location.pathname.replace(/^\/merchant\/?/, '').split('/')[0].toLowerCase();

  const validMerchantDashboards: MerchantDashboardId[] = [

    'overview',

    'profile',

    'products',

    'orders',

    'offers',

    'posts',

    'events',

    'reviews',

    'messages',

    'leads',

    'analytics',

    'promotions',

    'payments',

    'settings',

  ];

  const activeDashboard: MerchantDashboardId = validMerchantDashboards.includes(

    merchantSubroute as MerchantDashboardId

  )

    ? (merchantSubroute as MerchantDashboardId)

    : 'overview';

  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const handleNavigate = (dash: MerchantDashboardId) => {

    navigate(dash === 'overview' ? '/merchant' : `/merchant/${dash}`);

    setMobileMoreOpen(false);

    window.scrollTo({ top: 0, behavior: 'smooth' });

  };

  const [searchQuery, setSearchQuery] = useState('');

  const [modalType, setModalType] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showMerchantToast = (msg: string) => {

    setToastMsg(msg);

    setTimeout(() => setToastMsg(null), 3500);

  };

  useEffect(() => {
    const handleExpired = () => {
      clearMerchantSession();
      setSession(null);
      showMerchantToast('Your merchant session has expired. Please log in again.');
    };
    const handleSessionChanged = (e: any) => {
      const detail = e?.detail;
      if (detail && detail.businessName) {
        setSession(detail);
      } else if (detail === null) {
        setSession(null);
      }
    };
    window.addEventListener('myarea24_merchant_session_expired', handleExpired);
    window.addEventListener('myarea24_merchant_session_changed', handleSessionChanged);
    return () => {
      window.removeEventListener('myarea24_merchant_session_expired', handleExpired);
      window.removeEventListener('myarea24_merchant_session_changed', handleSessionChanged);
    };
  }, []);

  // Helpers for per-business isolated storage

  const loadStoredCollection = <T,>(key: string, bizId: string, demoFallback: T[]): T[] => {

    try {

      const stored = localStorage.getItem(`myarea24_merchant_${key}_${bizId}`);

      if (stored) {

        const parsed = JSON.parse(stored);

        if (Array.isArray(parsed)) return parsed;

      }

    } catch {}

    return demoFallback || [];

  };

  const loadStoredOrders = (bizId: string, bizName: string, demoFallback: MerchantOrderItem[]): MerchantOrderItem[] => {

    try {

      const stored = localStorage.getItem(`myarea24_merchant_orders_${bizId}`);

      let list: MerchantOrderItem[] = [];

      if (stored) {

        const parsed = JSON.parse(stored);

        if (Array.isArray(parsed)) list = parsed;

      } else if (demoFallback && demoFallback.length > 0) {

        list = [...demoFallback];

      }

      // Automatically sync citizen orders placed for this storefront

      const citizenRaw = localStorage.getItem('myarea24_citizen_orders');

      if (citizenRaw) {

        const citizenOrders: any[] = JSON.parse(citizenRaw);

        citizenOrders.forEach((co) => {

          const matches =

            (co.storeName && co.storeName.trim().toLowerCase() === bizName.trim().toLowerCase()) ||

            co.businessId === bizId ||

            co.business_id === bizId;

          if (matches) {

            const already = list.some((it) => it.orderNumber === co.orderNumber || it.id === co.id);

            if (!already) {

              list.unshift({

                id: co.id,

                orderNumber: co.orderNumber,

                businessId: bizId,

                businessName: bizName,

                customerName:

                  co.customerName ||

                  (typeof co.deliveryAddress === 'object' ? co.deliveryAddress?.recipientName : 'Local Citizen'),

                customerPhone:

                  co.customerPhone ||

                  (typeof co.deliveryAddress === 'object' ? co.deliveryAddress?.recipientPhone : '+91 98000 00000'),

                deliveryAddress:

                  typeof co.deliveryAddress === 'string'

                    ? co.deliveryAddress

                    : co.deliveryAddress?.streetAddress || 'Local Residential Address',

                finalPayable: Number(co.finalPayable || 0),

                paymentMethod: co.paymentMethod || 'upi_qr',

                paymentStatus: co.paymentStatus === 'paid' ? 'paid' : co.paymentStatus === 'cod' ? 'cod' : 'pending',

                status: co.status || 'placed',

                items: (co.items || []).map((it: any) => ({

                  productName: it.name || it.product_name,

                  unitPrice: it.price || it.unit_price,

                  quantity: it.quantity,

                  totalPrice: (it.price || it.unit_price) * it.quantity,

                })),

                estimatedDeliveryMins: co.estimatedDeliveryMins || 20,

                createdAt: co.createdAt || new Date().toISOString(),

              });

            }

          }

        });

      }

      return list;

    } catch {

      return bizId === 'biz-daily-brew' ? demoFallback : [];

    }

  };

  // Data Collections (Stored per business)

  const [products, setProducts] = useState<MerchantProductItem[]>(() =>

    loadStoredCollection('products', currentBusiness.id, INITIAL_MERCHANT_PRODUCTS)

  );

  const [services, setServices] = useState<MerchantServiceItem[]>(() =>

    loadStoredCollection('services', currentBusiness.id, INITIAL_MERCHANT_SERVICES)

  );

  const [offers, setOffers] = useState<MerchantOfferItem[]>(() =>

    loadStoredCollection('offers', currentBusiness.id, INITIAL_MERCHANT_OFFERS)

  );

  const [posts, setPosts] = useState<MerchantPostItem[]>(() =>

    loadStoredCollection('posts', currentBusiness.id, INITIAL_MERCHANT_POSTS)

  );

  const [events, setEvents] = useState<MerchantEventItem[]>(() =>

    loadStoredCollection('events', currentBusiness.id, INITIAL_MERCHANT_EVENTS)

  );

  const [reviews, setReviews] = useState<MerchantReviewItem[]>(() =>

    loadStoredCollection('reviews', currentBusiness.id, INITIAL_MERCHANT_REVIEWS)

  );

  const [conversations, setConversations] = useState<MerchantConversation[]>(() =>

    loadStoredCollection('conversations', currentBusiness.id, INITIAL_MERCHANT_CONVERSATIONS)

  );

  const [activeConversationId, setActiveConversationId] = useState<string>(

    () => loadStoredCollection('conversations', currentBusiness.id, INITIAL_MERCHANT_CONVERSATIONS)[0]?.id || ''

  );

  const [leads, setLeads] = useState<MerchantLeadItem[]>(() =>

    loadStoredCollection('leads', currentBusiness.id, INITIAL_MERCHANT_LEADS)

  );

  const [orders, setOrders] = useState<MerchantOrderItem[]>(() =>

    loadStoredOrders(currentBusiness.id, currentBusiness.name, INITIAL_MERCHANT_ORDERS)

  );

  const [promotions, setPromotions] = useState<MerchantPromotionItem[]>(() =>

    loadStoredCollection('promotions', currentBusiness.id, INITIAL_MERCHANT_PROMOTIONS)

  );

  const [invoices] = useState<MerchantInvoiceItem[]>(INITIAL_MERCHANT_INVOICES);

  // Synchronize collections whenever currentBusiness switches

  useEffect(() => {

    const bizId = currentBusiness.id;

    const bizName = currentBusiness.name;

    // Note: products managed authoritatively by Server-First sync below
    const nextServices = loadStoredCollection('services', bizId, INITIAL_MERCHANT_SERVICES);

    const nextOffers = loadStoredCollection('offers', bizId, INITIAL_MERCHANT_OFFERS);

    const nextPosts = loadStoredCollection('posts', bizId, INITIAL_MERCHANT_POSTS);

    const nextEvents = loadStoredCollection('events', bizId, INITIAL_MERCHANT_EVENTS);

    const nextReviews = loadStoredCollection('reviews', bizId, INITIAL_MERCHANT_REVIEWS);

    const nextConversations = loadStoredCollection('conversations', bizId, INITIAL_MERCHANT_CONVERSATIONS);

    const nextLeads = loadStoredCollection('leads', bizId, INITIAL_MERCHANT_LEADS);

    const nextOrders = loadStoredOrders(bizId, bizName, INITIAL_MERCHANT_ORDERS);

    const nextPromotions = loadStoredCollection('promotions', bizId, INITIAL_MERCHANT_PROMOTIONS);

        setServices(nextServices);

    setOffers(nextOffers);

    setPosts(nextPosts);

    setEvents(nextEvents);

    setReviews(nextReviews);

    setConversations(nextConversations);

    setActiveConversationId(nextConversations[0]?.id || '');

    setLeads(nextLeads);

    setOrders(nextOrders);

    setPromotions(nextPromotions);

  }, [currentBusiness.id, currentBusiness.name]);

  // Sync live backend overview telemetry, products, and orders

  useEffect(() => {

    let isMounted = true;

    getMerchantOverview().then((res) => {

      if (res && isMounted && res.business) {

        setCurrentBusiness((prev) => ({

          ...prev,

          viewCount: res.metrics.profileViews,

          directionClicks: res.metrics.directionClicks,

          callClicks: res.metrics.callClicks,

          rating: res.business.rating,

          reviewCount: res.business.reviewCount,

          verificationStatus: res.business.isVerified ? 'Verified' : prev.verificationStatus,

        }));

      }

    });

    // Authoritative Server-First Sync: GET /api/v1/products?business_id=X runs before loading localStorage
    getMerchantProducts(currentBusiness.id, currentBusiness.name).then((serverProds) => {
      if (!isMounted) return;
      if (serverProds !== null) {
        // Authoritative server catalog received
        setProducts(serverProds);
        try {
          localStorage.setItem(`myarea24_merchant_products_${currentBusiness.id}`, JSON.stringify(serverProds));
        } catch {}
      } else {
        // Fallback to offline localStorage cache ONLY when backend is unreachable
        const offlineProds = loadStoredCollection('products', currentBusiness.id, INITIAL_MERCHANT_PRODUCTS);
        setProducts(offlineProds);
      }
    });

    getMerchantOrders().then((serverOrders) => {

      if (serverOrders && isMounted && serverOrders.length > 0) {

        setOrders(serverOrders);

      }

    });

    return () => {

      isMounted = false;

    };

  }, [currentBusiness.id]);

  // Persist collections per business

  useEffect(() => {

    try {

      localStorage.setItem(`myarea24_merchant_products_${currentBusiness.id}`, JSON.stringify(products));

    } catch {}

  }, [products, currentBusiness.id]);

  useEffect(() => {

    try {

      localStorage.setItem(`myarea24_merchant_services_${currentBusiness.id}`, JSON.stringify(services));

    } catch {}

  }, [services, currentBusiness.id]);

  useEffect(() => {

    try {

      localStorage.setItem(`myarea24_merchant_offers_${currentBusiness.id}`, JSON.stringify(offers));

    } catch {}

  }, [offers, currentBusiness.id]);

  useEffect(() => {

    try {

      localStorage.setItem(`myarea24_merchant_posts_${currentBusiness.id}`, JSON.stringify(posts));

    } catch {}

  }, [posts, currentBusiness.id]);

  useEffect(() => {

    try {

      localStorage.setItem(`myarea24_merchant_events_${currentBusiness.id}`, JSON.stringify(events));

    } catch {}

  }, [events, currentBusiness.id]);

  useEffect(() => {

    try {

      localStorage.setItem(`myarea24_merchant_reviews_${currentBusiness.id}`, JSON.stringify(reviews));

    } catch {}

  }, [reviews, currentBusiness.id]);

  useEffect(() => {

    try {

      localStorage.setItem(`myarea24_merchant_conversations_${currentBusiness.id}`, JSON.stringify(conversations));

    } catch {}

  }, [conversations, currentBusiness.id]);

  useEffect(() => {

    try {

      localStorage.setItem(`myarea24_merchant_leads_${currentBusiness.id}`, JSON.stringify(leads));

    } catch {}

  }, [leads, currentBusiness.id]);

  useEffect(() => {

    try {

      localStorage.setItem(`myarea24_merchant_orders_${currentBusiness.id}`, JSON.stringify(orders));

    } catch {}

  }, [orders, currentBusiness.id]);

  useEffect(() => {

    try {

      localStorage.setItem(`myarea24_merchant_promotions_${currentBusiness.id}`, JSON.stringify(promotions));

    } catch {}

  }, [promotions, currentBusiness.id]);

  // Dropdown & Popover States

  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [businessDropdownOpen, setBusinessDropdownOpen] = useState(false);

  // Real-Time WebSockets State & Event Listeners

  const [wsStatus, setWsStatus] = useState<RealtimeConnectionStatus>(() => realtimeService.getStatus());

  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {

    realtimeService.updateSubscriptions({

      businessId: currentBusiness.id,

      area: currentBusiness.locationArea,

    });

    const handleStatus = (e: any) => {

      setWsStatus(e.detail?.status || 'disconnected');

    };

    const handleNewLead = (e: any) => {

      const lead = e.detail?.lead as MerchantLeadItem;

      if (!lead) return;

      setLeads((prev) => [lead, ...prev]);

      showMerchantToast(`🎯 Live Lead: ${lead.customerName} - ${lead.interestedCategory}`);

    };

    const handleNewInquiry = (e: any) => {

      const inq = e.detail?.inquiry;

      if (!inq) return;

      const newMsg = {

        id: `msg-${Date.now()}`,

        sender: 'customer' as const,

        text: inq.message,

        time: 'Just now',

      };

      setConversations((prev) => {

        const existingIdx = prev.findIndex(

          (c) => c.customerName.toLowerCase() === inq.customerName.toLowerCase()

        );

        if (existingIdx >= 0) {

          return prev.map((c, i) =>

            i === existingIdx

              ? {

                  ...c,

                  lastMessage: inq.message,

                  lastTime: 'Just now',

                  unreadCount: (c.unreadCount || 0) + 1,

                  messages: [...c.messages, newMsg],

                }

              : c

          );

        } else {

          const newConv: MerchantConversation = {

            id: `conv-${Date.now()}`,

            customerName: inq.customerName,

            avatar:

              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',

            badge: 'Enquiry',

            lastMessage: inq.message,

            lastTime: 'Just now',

            unreadCount: 1,

            phone: '+91 98112 00000',

            email: `${inq.customerName.toLowerCase().replace(/\s+/g, '.')}@example.com`,

            location: currentBusiness.locationArea,

            memberSince: 'Today',

            tags: ['Live Customer', 'Instant Message'],

            messages: [newMsg],

          };

          return [newConv, ...prev];

        }

      });

      showMerchantToast(`💬 Live Inquiry from ${inq.customerName}: "${inq.message}"`);

    };

    const handleNewReview = (e: any) => {

      const rev = e.detail?.review as MerchantReviewItem;

      if (!rev) return;

      setReviews((prev) => [rev, ...prev]);

      showMerchantToast(`⭐ New ${rev.rating}★ Review from ${rev.customerName}!`);

    };

    const handleNewOrder = (e: any) => {

      const ord = e.detail?.order;

      if (!ord) return;

      const formatted: MerchantOrderItem = {

        id: ord.id || `ord-${Date.now()}`,

        orderNumber: ord.order_number || ord.orderNumber || `MA24-ORD-${Math.floor(1000 + Math.random() * 9000)}`,

        businessId: ord.business_id || ord.businessId || currentBusiness.id,

        businessName: ord.business_name || ord.businessName || currentBusiness.name,

        customerName: ord.customer_name || ord.customerName || 'Local Neighbor',

        customerPhone: ord.customer_phone || ord.customerPhone || '+91 98000 00000',

        deliveryAddress: ord.delivery_address || ord.deliveryAddress || currentBusiness.locationArea,

        finalPayable: Number(ord.final_payable || ord.finalPayable || 350),

        paymentMethod: ord.payment_method || ord.paymentMethod || 'upi_qr',

        paymentStatus: ord.payment_status || ord.paymentStatus || 'paid',

        status: (ord.status as any) || 'placed',

        estimatedDeliveryMins: ord.estimated_delivery_mins || ord.estimatedDeliveryMins || 20,

        createdAt: ord.created_at || ord.createdAt || new Date().toISOString(),

        items: Array.isArray(ord.items)

          ? ord.items.map((it: any) => ({

              productName: it.product_name || it.productName || 'Item',

              unitPrice: Number(it.unit_price || it.unitPrice || 100),

              quantity: Number(it.quantity || 1),

              totalPrice: Number(it.total_price || it.totalPrice || 100),

            }))

          : [],

      };

      setOrders((prev) => [formatted, ...prev.filter((o) => o.orderNumber !== formatted.orderNumber)]);

      showMerchantToast(`🛍️ Live Order: #${formatted.orderNumber} - ₹${formatted.finalPayable} (${formatted.customerName})!`);

    };

    const handleOrderStatusUpdate = (e: any) => {

      const detail = e.detail;

      if (!detail?.orderNumber) return;

      setOrders((prev) =>

        prev.map((o) =>

          o.orderNumber.toLowerCase() === detail.orderNumber.toLowerCase()

            ? { ...o, status: detail.status, paymentStatus: detail.paymentStatus || o.paymentStatus }

            : o

        )

      );

    };

    window.addEventListener(REALTIME_STATUS_EVENT, handleStatus);

    window.addEventListener(MERCHANT_LEAD_EVENT, handleNewLead);

    window.addEventListener(MERCHANT_INQUIRY_EVENT, handleNewInquiry);

    window.addEventListener(MERCHANT_REVIEW_EVENT, handleNewReview);

    window.addEventListener(MERCHANT_ORDER_EVENT, handleNewOrder);

    window.addEventListener(ORDER_STATUS_EVENT, handleOrderStatusUpdate);

    return () => {

      window.removeEventListener(REALTIME_STATUS_EVENT, handleStatus);

      window.removeEventListener(MERCHANT_LEAD_EVENT, handleNewLead);

      window.removeEventListener(MERCHANT_INQUIRY_EVENT, handleNewInquiry);

      window.removeEventListener(MERCHANT_REVIEW_EVENT, handleNewReview);

      window.removeEventListener(MERCHANT_ORDER_EVENT, handleNewOrder);

      window.removeEventListener(ORDER_STATUS_EVENT, handleOrderStatusUpdate);

    };

  }, [currentBusiness.id, currentBusiness.locationArea]);

  // Sync state to localStorage

  useEffect(() => {

    try {

      localStorage.setItem(

        STORAGE_KEY,

        JSON.stringify({

          currentBusiness,

          activeDashboard,

        })

      );

    } catch {}

  }, [currentBusiness, activeDashboard]);

  // Handlers

  const handleSwitchBusiness = (bizOrId: string | MerchantRegistrationProfile) => {

    if (typeof bizOrId === 'string') {

      const accounts = getStoredMerchantAccounts();

      const found = accounts.find((a) => (a.id || a.businessName) === bizOrId);

      if (found) {

        saveMerchantSession(found);

        setSession(found);

        const updatedBiz = buildMerchantBusinessInfo(found);

        setCurrentBusiness(updatedBiz);

        getMerchantProducts(updatedBiz.id, updatedBiz.name).then((serverProds) => {

          if (serverProds !== null) {

            setProducts(serverProds);

            try {

              localStorage.setItem(`myarea24_merchant_products_${updatedBiz.id}`, JSON.stringify(serverProds));

            } catch {}

          }

        });

        setBusinessDropdownOpen(false);

        showMerchantToast(`Switched storefront to ${updatedBiz.name}`);

        return;

      }

      setCurrentBusiness(EMPTY_MERCHANT_STOREFRONT);

    } else {

      saveMerchantSession(bizOrId);

      setSession(bizOrId);

      const updatedBiz = buildMerchantBusinessInfo(bizOrId);

      setCurrentBusiness(updatedBiz);

      getMerchantProducts(updatedBiz.id, updatedBiz.name).then((serverProds) => {

        if (serverProds !== null) {

          setProducts(serverProds);

          try {

            localStorage.setItem(`myarea24_merchant_products_${updatedBiz.id}`, JSON.stringify(serverProds));

          } catch {}

        }

      });

      showMerchantToast(`Switched storefront to ${updatedBiz.name}`);

    }

    setBusinessDropdownOpen(false);

  };

  const handleLockStorefront = () => {

    clearMerchantSession();

    setSession(null);

    showMerchantToast('Storefront locked.');

    onSwitchToCitizen();

  };

  const handleUpdateBusiness = (updated: Partial<MerchantBusinessInfo>) => {

    const nextBiz = { ...currentBusiness, ...updated };

    setCurrentBusiness(nextBiz);

    marketplace?.addBusiness({

      name: nextBiz.name,

      cat: nextBiz.category,

      phone: nextBiz.phone,

      address: nextBiz.fullAddress,

    });

    window.dispatchEvent(new CustomEvent('myarea24_marketplace_sync'));

    showMerchantToast(`Storefront settings updated & synced live.`);

  };

  const handleToggleProductStatus = (id: string) => {

    const target = products.find((p) => p.id === id);

    const nextStatus: 'Active' | 'Paused' = target?.status === 'Active' ? 'Paused' : 'Active';

    const isActive = nextStatus === 'Active';

    setProducts((prev) =>

      prev.map((p) => (p.id === id ? { ...p, status: nextStatus } : p))

    );

    syncMerchantProductToggle(id, isActive);

    const numId = parseInt(id, 10);

    if (!isNaN(numId)) {

      updateMerchantProduct(numId, { availability_status: isActive ? 'in_stock' : 'out_of_stock' });

    }

    showMerchantToast(isActive ? 'Product is Live & In-Stock' : 'Product marked Out of Stock');

  };

  const handleToggleServiceStatus = (id: string) => {

    setServices((prev) =>

      prev.map((s) =>

        s.id === id ? { ...s, status: s.status === 'Active' ? 'Paused' : 'Active' } : s

      )

    );

    showMerchantToast(`Service status updated`);

  };

  const handleToggleOfferStatus = (id: string) => {

    setOffers((prev) =>

      prev.map((o) =>

        o.id === id ? { ...o, status: o.status === 'Active' ? 'Expired' : 'Active' } : o

      )

    );

    showMerchantToast(`Offer status updated`);

  };

  const handleToggleLikePost = (id: string) => {

    setPosts((prev) =>

      prev.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p))

    );

  };

  const handleAddReplyToReview = (reviewId: string, replyText: string) => {

    setReviews((prev) =>

      prev.map((r) =>

        r.id === reviewId

          ? {

              ...r,

              reply: {

                text: replyText,

                date: 'Just now',

              },

            }

          : r

      )

    );

    showMerchantToast(`Reply published to customer review!`);

  };

  const handleSendMessage = (conversationId: string, text: string) => {

    const newMsg = {

      id: `msg-${Date.now()}`,

      sender: 'merchant' as const,

      text,

      time: 'Just now',

    };

    setConversations((prev) =>

      prev.map((c) =>

        c.id === conversationId

          ? {

              ...c,

              lastMessage: text,

              lastTime: 'Just now',

              messages: [...c.messages, newMsg],

            }

          : c

      )

    );

    showMerchantToast(`Message sent to customer.`);

  };

  const handleUpdateLeadStatus = (leadId: string, status: 'New' | 'Contacted' | 'Closed') => {

    setLeads((prev) =>

      prev.map((l) => (l.id === leadId ? { ...l, status } : l))

    );

    showMerchantToast(`Lead status updated to ${status}`);

  };

  const handleUpdateOrderStatus = (orderId: string, status: any) => {

    setOrders((prev) =>

      prev.map((o) => (o.id === orderId ? { ...o, status } : o))

    );

    showMerchantToast(`Order status updated to ${status}`);

  };

  const handleSimulateOrder = () => {

    const randNum = Math.floor(1000 + Math.random() * 9000);

    realtimeService.triggerMerchantOrder({

      orderNumber: `MA24-ORD-${randNum}`,

      customerName: 'Pooja Verma',

      customerPhone: '+91 98112 44999',

      deliveryAddress: `Flat 204, Royal Palms, ${currentBusiness.locationArea}`,

      finalPayable: 450.0,

      paymentMethod: 'upi_qr',

      paymentStatus: 'paid',

      status: 'placed',

      items: [

        {

          productName: products[0]?.name || `${currentBusiness.category.split('&')[0].trim()} Package`,

          unitPrice: 220.0,

          quantity: 1,

          totalPrice: 220.0,

        },

        {

          productName: products[1]?.name || 'Neighborhood Special',

          unitPrice: 230.0,

          quantity: 1,

          totalPrice: 230.0,

        },

      ],

    });

  };

  const renderActiveDashboardContent = () => {

    switch (activeDashboard) {

      case 'overview':

        return (

          <MerchantHomeDashboard

            business={currentBusiness}

            onNavigate={handleNavigate}

            onOpenQuickAction={setModalType}

            products={products}

            services={services}

            offers={offers}

            posts={posts}

            reviews={reviews}

            conversations={conversations}

            leads={leads}

            orders={orders}

          />

        );

      case 'orders':

        return (

          <MerchantOrdersDashboard

            business={currentBusiness}

            orders={orders}

            onUpdateOrderStatus={handleUpdateOrderStatus}

            onSimulateOrder={handleSimulateOrder}

          />

        );

      case 'profile':

        return (

          <MerchantProfileDashboard

            business={currentBusiness}

            onUpdateBusiness={handleUpdateBusiness}

            onNavigate={handleNavigate}

            onOpenQuickAction={setModalType}

          />

        );

      case 'products':

        return (

          <MerchantProductsDashboard

            business={currentBusiness}

            products={products}

            services={services}

            onToggleProductStatus={handleToggleProductStatus}

            onToggleServiceStatus={handleToggleServiceStatus}

            onOpenAddProductModal={() => setModalType('add_product')}

            onOpenAddServiceModal={() => setModalType('add_service')}

            onAddProduct={(newProd) => {

              setProducts((prev) => [newProd, ...prev]);

              createMerchantProduct({

                businessId: currentBusiness.id,

                name: newProd.name,

                category: newProd.category,

                price: newProd.price,

                originalPrice: newProd.originalPrice,

                inStock: newProd.status === 'Active',

                image: newProd.image,

              });

              syncMerchantProductToGlobal(newProd, {

                name: currentBusiness.name,

                address: currentBusiness.fullAddress,

                phone: currentBusiness.phone,

                locality: currentBusiness.locationArea,

              });

              marketplace?.addProduct({

                businessId: currentBusiness.id,

                name: newProd.name,

                brand: currentBusiness.name,

                cat: newProd.category,

                localPriceNum: newProd.price,

                onlinePriceNum: Math.round(newProd.price * 1.18),

                store: currentBusiness.name,

                storeAddress: currentBusiness.fullAddress,

                phone: currentBusiness.phone,

                inStock: newProd.status === 'Active',

                unit: '1 item • Live Storefront',

                img: newProd.image,

              });

              showMerchantToast(`✓ Product "${newProd.name}" added to catalog!`);

            }}

            onUpdateProductImage={(productId, newImageUrl) => {

              setProducts((prev) =>

                prev.map((p) => (p.id === productId ? { ...p, image: newImageUrl } : p))

              );

              const numId = parseInt(productId.replace(/\D/g, ''), 10);

              if (!isNaN(numId)) {

                updateMerchantProduct(numId, { image_url: newImageUrl, image: newImageUrl });

              }

              showMerchantToast('✓ Product photo updated from camera snapshot!');

            }}

          />

        );

      case 'offers':

        return (

          <MerchantOffersDashboard

            business={currentBusiness}

            offers={offers}

            onToggleOfferStatus={handleToggleOfferStatus}

            onOpenCreateOfferModal={() => setModalType('add_offer')}

          />

        );

      case 'posts':

        return (

          <MerchantPostsDashboard

            business={currentBusiness}

            posts={posts}

            onOpenCreatePostModal={() => setModalType('create_post')}

            onToggleLikePost={handleToggleLikePost}

          />

        );

      case 'events':

        return (

          <MerchantEventsDashboard

            business={currentBusiness}

            events={events}

            onOpenCreateEventModal={() => setModalType('create_event')}

          />

        );

      case 'reviews':

        return (

          <MerchantReviewsDashboard

            business={currentBusiness}

            reviews={reviews}

            onAddReplyToReview={handleAddReplyToReview}

            onOpenRequestReviewModal={() => setModalType('request_review')}

          />

        );

      case 'messages':

        return (

          <MerchantMessagesDashboard

            business={currentBusiness}

            conversations={conversations}

            activeConversationId={activeConversationId}

            onSelectConversation={setActiveConversationId}

            onSendMessage={handleSendMessage}

          />

        );

      case 'leads':

        return (

          <MerchantLeadsDashboard

            business={currentBusiness}

            leads={leads}

            onUpdateLeadStatus={handleUpdateLeadStatus}

            onOpenMessageWithLead={() => {

              handleNavigate('messages');

            }}

          />

        );

      case 'analytics':

        return (

          <MerchantAnalyticsDashboard

            business={currentBusiness}

            products={products}

            orders={orders}

            leads={leads}

            reviews={reviews}

          />

        );

      case 'promotions':

        return (

          <MerchantPromotionsDashboard

            business={currentBusiness}

            promotions={promotions}

            onOpenCreatePromoModal={(type) => setModalType(type ? `create_${type}` : 'create_promo')}

          />

        );

      case 'payments':

        return (

          <MerchantPaymentsDashboard

            business={currentBusiness}

            invoices={invoices}

          />

        );

      case 'settings':

        return (

          <MerchantSettingsDashboard

            business={currentBusiness}

            onUpdateBusiness={handleUpdateBusiness}

          />

        );

      default:

        return null;

    }

  };

  // If not authenticated, render the dedicated Lock Screen view

  if (!session) {

    return (

      <MerchantAuthRequiredView

        onLoginClick={() => {

          setAuthModalMode('login');

          setAuthModalOpen(true);

        }}

        onRegisterClick={() => {

          setAuthModalMode('register');

          setAuthModalOpen(true);

        }}

        onSwitchToCitizen={onSwitchToCitizen}

        authModalOpen={authModalOpen}

        authModalMode={authModalMode}

        onCloseAuthModal={() => setAuthModalOpen(false)}

        onAuthSuccess={(profile) => {

          setSession(profile);

          setCurrentBusiness(buildMerchantBusinessInfo(profile));

          setAuthModalOpen(false);

          showMerchantToast(`Authenticated into ${profile.businessName}!`);

        }}

        currentArea={currentLocation?.areaName || 'Your Local Area'}

        coords={currentLocation?.coords}

      />

    );

  }

  const unreadMsgCount = conversations.reduce(

    (acc, c) => acc + (c.unreadCount || 0),

    0

  );

  const newLeadsCount = leads.filter((l) => l.status === 'New').length;

  const hasPlacedOrders = orders.filter((o) => o.status === 'placed').length > 0;

  return (

    <div className="min-h-screen bg-[#F4F6FB] text-slate-900 flex flex-col font-sans">

      <div className="flex flex-1 min-h-0">

        {/* Desktop Sidebar (hidden on < lg) */}

        <MerchantDesktopSidebar

          activeDashboard={activeDashboard}

          onNavigate={handleNavigate}

          onSwitchToCitizen={onSwitchToCitizen}

          orders={orders}

          unreadMsgCount={unreadMsgCount}

          newLeadsCount={newLeadsCount}

        />

        {/* Main Column */}

        <div className="flex-1 flex flex-col min-w-0">

          {/* Mobile Top Header (< lg) */}

          <MerchantMobileHeader

            currentBusiness={currentBusiness}

            onOpenAddProduct={() => setModalType('add_product')}

            onSwitchToCitizen={onSwitchToCitizen}

            onToggleNotifications={() => setNotificationsOpen((v) => !v)}

            hasPlacedOrders={hasPlacedOrders}

          />

          {/* Desktop Top Header (>= lg) */}

          <MerchantDesktopHeader

            currentBusiness={currentBusiness}

            businessDropdownOpen={businessDropdownOpen}

            setBusinessDropdownOpen={setBusinessDropdownOpen}

            onSwitchBusiness={handleSwitchBusiness}

            onOpenRegisterModal={() => {

              setAuthModalMode('register');

              setAuthModalOpen(true);

            }}

            searchQuery={searchQuery}

            setSearchQuery={setSearchQuery}

            onSwitchToCitizen={onSwitchToCitizen}

            onLockStorefront={handleLockStorefront}

            wsStatus={wsStatus}

            isSimulating={isSimulating}

            setIsSimulating={setIsSimulating}

            orders={orders}

            conversations={conversations}

            leads={leads}

            reviews={reviews}

            notificationsOpen={notificationsOpen}

            setNotificationsOpen={setNotificationsOpen}

            profileMenuOpen={profileMenuOpen}

            setProfileMenuOpen={setProfileMenuOpen}

            onNavigate={handleNavigate}

            onShowToast={showMerchantToast}

          />

          {/* Unified Main Content View */}

          <main className="flex-1 px-3.5 py-4 pb-24 lg:p-6 lg:pb-12 overflow-y-auto">

            <div className="max-w-[1360px] mx-auto">

              {renderActiveDashboardContent()}

            </div>

          </main>

        </div>

      </div>

      {/* Mobile Bottom Navigation Bar (< lg) */}

      <MerchantMobileNav

        activeDashboard={activeDashboard}

        mobileMoreOpen={mobileMoreOpen}

        onNavigate={handleNavigate}

        onToggleMore={() => setMobileMoreOpen((v) => !v)}

        hasPlacedOrders={hasPlacedOrders}

        newLeadsCount={newLeadsCount}

      />

      {/* Mobile "More" Drawer (< lg) */}

      <MerchantMobileMoreDrawer

        isOpen={mobileMoreOpen}

        onClose={() => setMobileMoreOpen(false)}

        activeDashboard={activeDashboard}

        onNavigate={handleNavigate}

        onSwitchToCitizen={onSwitchToCitizen}

        onLockStorefront={handleLockStorefront}

        reviewsCount={reviews.length}

        unreadMsgCount={unreadMsgCount}

      />

      {/* Action Modals */}

      <MerchantActionModals

        modalType={modalType}

        onClose={() => setModalType(null)}

        onAddProduct={(newProd) => {

          setProducts((prev) => [newProd, ...prev]);

          createMerchantProduct({

            businessId: currentBusiness.id,

            name: newProd.name,

            category: newProd.category,

            price: newProd.price,

            originalPrice: newProd.originalPrice,

            inStock: newProd.status === 'Active',

            image: newProd.image,

          });

          syncMerchantProductToGlobal(newProd, {

            name: currentBusiness.name,

            address: currentBusiness.fullAddress,

            phone: currentBusiness.phone,

            locality: currentBusiness.locationArea,

          });

          marketplace?.addProduct({

            businessId: currentBusiness.id,

            name: newProd.name,

            brand: currentBusiness.name,

            cat: newProd.category,

            localPriceNum: newProd.price,

            onlinePriceNum: Math.round(newProd.price * 1.18),

            store: currentBusiness.name,

            storeAddress: currentBusiness.fullAddress,

            phone: currentBusiness.phone,

            inStock: newProd.status === 'Active',

            unit: '1 item • Live Storefront',

          });

          window.dispatchEvent(new CustomEvent('myarea24_marketplace_sync'));

          showMerchantToast(`✓ "${newProd.name}" added to catalog & published live!`);

        }}

        onAddService={(newSrv) => {

          setServices((prev) => [newSrv, ...prev]);

          createMerchantService({

            name: newSrv.name,

            category: newSrv.category,

            priceValue: newSrv.priceValue || 500,

            phone: currentBusiness.phone,

            description: newSrv.description,

          });

          marketplace?.addService({

            name: newSrv.name,

            cat: newSrv.category,

            priceNum: newSrv.priceValue || 500,

            phone: currentBusiness.phone,

            locality: currentBusiness.locationArea,

          });

          window.dispatchEvent(new CustomEvent('myarea24_marketplace_sync'));

          showMerchantToast(`✓ Service "${newSrv.name}" registered and published live!`);

        }}

        onAddOffer={(newOffer) => {

          setOffers((prev) => [newOffer, ...prev]);

          createMerchantOffer({

            title: newOffer.title,

            discountText: newOffer.discountText,

            code: newOffer.code,

            image: newOffer.image,

          });

          marketplace?.addOffer({

            businessId: currentBusiness.id,

            title: newOffer.title,

            store: currentBusiness.name,

            badge: newOffer.discountText,

            code: newOffer.code,

            cat: 'Food & Dining',

            valid: '14 days left',

          });

          window.dispatchEvent(new CustomEvent('myarea24_marketplace_sync'));

          showMerchantToast(`✓ Offer "${newOffer.title}" published live for area residents!`);

        }}

        onAddPost={(newPost) => {

          setPosts((prev) => [newPost, ...prev]);

          showMerchantToast(`✓ Community post "${newPost.title}" published!`);

        }}

        onAddEvent={(newEvent) => {

          setEvents((prev) => [newEvent, ...prev]);

          createMerchantEvent({

            title: newEvent.title,

            category: newEvent.category,

            venue: newEvent.venue,

            dateDisplay: newEvent.dateDisplay,

          });

          marketplace?.addEvent({

            title: newEvent.title,

            cat: newEvent.category,

            loc: newEvent.venue,

            time: newEvent.dateDisplay,

          });

          window.dispatchEvent(new CustomEvent('myarea24_marketplace_sync'));

          showMerchantToast(`✓ Event "${newEvent.title}" published live in the local calendar!`);

        }}

        onAddPromotion={(newPromo) => {

          setPromotions((prev) => [newPromo, ...prev]);

          showMerchantToast(`✓ Local boost campaign "${newPromo.title}" launched!`);

        }}

        businessName={currentBusiness.name}

      />

      {/* Live Toast Feedback */}

      {toastMsg && (

        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-purple-500/40 flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-4">

          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />

          <span>{toastMsg}</span>

        </div>

      )}

      {/* Registration Modal */}

      <MerchantRegistrationModal

        isOpen={authModalOpen}

        defaultMode={authModalMode}

        onClose={() => setAuthModalOpen(false)}

        onSuccess={(profile) => {

          setSession(profile);

          setCurrentBusiness(buildMerchantBusinessInfo(profile));

          setAuthModalOpen(false);

          showMerchantToast(`Authenticated into ${profile.businessName}!`);

        }}

        currentArea={currentLocation?.areaName || 'Your Local Area'}

        coords={currentLocation?.coords}

      />

    </div>

  );

}

