import { create } from 'zustand';
import {
  LiveBusinessItem,
  LiveProductItem,
  LiveServiceItem,
  LiveOfferItem,
  LiveEventItem,
  LiveEmergencyFacility,
  fetchLiveMarketplaceModules,
} from '../services/communityMarketplaceService';
import { LiveAreaIntelligence } from '../services/liveIntelligence';

const MARKETPLACE_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache TTL

function getMarketplaceKey(liveIntel: LiveAreaIntelligence): string {
  const { lat, lng, areaName, pincode } = liveIntel.location;
  return `${lat.toFixed(3)}_${lng.toFixed(3)}_${areaName || 'default'}_${pincode || ''}`;
}

export interface MarketplaceState {
  businesses: LiveBusinessItem[];
  products: LiveProductItem[];
  services: LiveServiceItem[];
  offers: LiveOfferItem[];
  events: LiveEventItem[];
  emergencyFacilities: LiveEmergencyFacility[];
  loading: boolean;
  isRevalidating: boolean;
  error: string | null;
  lastFetched: number | null;
  cachedKey: string | null;
  currentIntelRef: LiveAreaIntelligence | null;

  fetchMarketplace: (liveIntel: LiveAreaIntelligence, force?: boolean) => Promise<void>;
  refreshMarketplace: () => Promise<void>;
  addBusiness: (biz: Partial<LiveBusinessItem>) => Promise<LiveBusinessItem>;
  addProduct: (prod: Partial<LiveProductItem>) => Promise<LiveProductItem>;
  addService: (svc: Partial<LiveServiceItem>) => Promise<LiveServiceItem>;
  addOffer: (off: Partial<LiveOfferItem>) => Promise<LiveOfferItem>;
  addEvent: (ev: Partial<LiveEventItem>) => Promise<LiveEventItem>;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => {
  // Listen for cross-tab or merchant updates to revalidate
  if (typeof window !== 'undefined') {
    const handleSync = () => {
      const intel = get().currentIntelRef;
      if (intel) {
        get().fetchMarketplace(intel, true).catch(() => {});
      }
    };
    window.addEventListener('myarea24_marketplace_sync', handleSync);
    window.addEventListener('storage', handleSync);
  }

  return {
    businesses: [],
    products: [],
    services: [],
    offers: [],
    events: [],
    emergencyFacilities: [],
    loading: false,
    isRevalidating: false,
    error: null,
    lastFetched: null,
    cachedKey: null,
    currentIntelRef: null,

    fetchMarketplace: async (liveIntel: LiveAreaIntelligence, force = false) => {
      const key = getMarketplaceKey(liveIntel);
      const { businesses, lastFetched, cachedKey, loading, isRevalidating } = get();
      const now = Date.now();

      // 1. Cache Hit: Data is fresh within TTL for the exact same locality
      if (!force && cachedKey === key && lastFetched && now - lastFetched < MARKETPLACE_CACHE_TTL_MS) {
        return;
      }

      // 2. Prevent concurrent duplicate fetches
      if (loading || isRevalidating) {
        return;
      }

      // 3. Location change vs Stale-While-Revalidate
      const isNewLocation = cachedKey !== key;
      if (isNewLocation) {
        // Location changed: clear previous location items to prevent stale rendering
        set({
          loading: true,
          isRevalidating: false,
          error: null,
          currentIntelRef: liveIntel,
          cachedKey: key,
          businesses: [],
          products: [],
          services: [],
          offers: [],
          events: [],
        });
      } else {
        // Same locality revalidation: keep existing items while fetching in background
        set({ isRevalidating: true, error: null, currentIntelRef: liveIntel });
      }

      try {
        const modules = await fetchLiveMarketplaceModules(liveIntel);
        set({
          businesses: modules.businesses,
          products: modules.products,
          services: modules.services,
          offers: modules.offers,
          events: modules.events,
          emergencyFacilities: modules.emergencyFacilities,
          loading: false,
          isRevalidating: false,
          error: null,
          lastFetched: Date.now(),
          cachedKey: key,
          currentIntelRef: liveIntel,
        });
      } catch (err: any) {
        set({
          loading: false,
          isRevalidating: false,
          error: err?.message || 'Could not fetch local marketplace modules.',
        });
      }
    },

    refreshMarketplace: async () => {
      const intel = get().currentIntelRef;
      if (!intel) return;
      return get().fetchMarketplace(intel, true);
    },

    addBusiness: async (biz: Partial<LiveBusinessItem>): Promise<LiveBusinessItem> => {
      const created: LiveBusinessItem = {
        id: `custom-biz-${Date.now()}`,
        slug: `custom-biz-${Date.now()}`,
        name: biz.name || 'Local Store',
        cat: biz.cat || 'Restaurants',
        sub: `${biz.cat || 'Restaurants'} • Local`,
        description: biz.description || 'Verified storefront.',
        address: biz.address || 'Main Market',
        locality: biz.locality || 'Local',
        city: biz.city || 'India',
        rating: '4.8',
        reviews: '(New)',
        dist: '0.3 km',
        distanceKm: 0.3,
        status: 'Open',
        closes: `Closes ${biz.closingTime || '10:00 PM'}`,
        openingTime: biz.openingTime || '09:00',
        closingTime: biz.closingTime || '22:00',
        phone: biz.phone || '+91 98110 24024',
        whatsapp: biz.phone || '+91 98110 24024',
        img: biz.img || './assets/crops/biz-cafe.webp',
        verified: true,
        trending: true,
        popular: true,
        lat: 28.6139,
        lng: 77.2090,
        activeProductsCount: 1,
        activeOffersCount: 1,
        source: 'Merchant Portal',
      };

      set((state) => ({
        businesses: [created, ...state.businesses],
      }));
      return created;
    },

    addProduct: async (prod: Partial<LiveProductItem>): Promise<LiveProductItem> => {
      const priceNum = prod.localPriceNum || 99;
      const created: LiveProductItem = {
        id: `custom-prod-${Date.now()}`,
        name: prod.name || 'New Item',
        brand: prod.brand || 'Local Merchant',
        cat: prod.cat || 'Groceries',
        price: `₹${priceNum}`,
        localPriceNum: priceNum,
        onlinePriceNum: prod.onlinePriceNum || priceNum + 20,
        onlineProvider: 'Blinkit',
        savingsAmount: Math.max(0, (prod.onlinePriceNum || priceNum + 20) - priceNum),
        savingsPercent: 15,
        betterOffline: true,
        unit: prod.unit || '1 unit',
        store: prod.store || 'Local Store',
        storeAddress: prod.storeAddress || 'Local Market',
        phone: prod.phone || '+91 98110 24024',
        dist: '0.4 km',
        distanceKm: 0.4,
        rating: '4.8',
        reviews: '(10)',
        img: prod.img || './assets/crops/prod-atta.webp',
        freshnessLabel: 'Added Today',
      };

      set((state) => ({
        products: [created, ...state.products],
      }));
      return created;
    },

    addService: async (svc: Partial<LiveServiceItem>): Promise<LiveServiceItem> => {
      const created: LiveServiceItem = {
        id: `custom-svc-${Date.now()}`,
        name: svc.name || 'Local Expert',
        role: svc.role || 'Specialist',
        cat: svc.cat || 'Electrician',
        exp: '5 yrs exp',
        rating: '4.9',
        reviews: '(1)',
        dist: '0.5 km',
        distanceKm: 0.5,
        price: 'Starts ₹399',
        priceNum: 399,
        priceUnit: 'per visit',
        avail: 'Available Today',
        timing: '09:00 AM - 08:00 PM',
        phone: svc.phone || '+91 98112 44101',
        whatsapp: svc.phone || '+91 98112 44101',
        verified: true,
        img: svc.img || './assets/crops/svc-electrician.webp',
        locality: 'Local',
        city: 'India',
        lat: 28.6139,
        lng: 77.2090,
      };

      set((state) => ({
        services: [created, ...state.services],
      }));
      return created;
    },

    addOffer: async (off: Partial<LiveOfferItem>): Promise<LiveOfferItem> => {
      const created: LiveOfferItem = {
        id: `custom-offer-${Date.now()}`,
        title: off.title || 'Special Discount',
        sub: 'Exclusive In-Store Deal',
        description: off.description || 'Redeem at counter.',
        store: off.store || 'Local Merchant',
        storeAddress: off.storeAddress || 'Main Market',
        phone: off.phone || '+91 98110 24024',
        cat: off.cat || 'Food & Dining',
        badge: off.badge || '20% OFF',
        badgeColor: 'bg-emerald-600 text-white',
        code: off.code || 'SAVE20',
        valid: '14 days left',
        claimed: '1 claimed',
        minBill: 'Min bill ₹299',
        dist: '0.4 km',
        distanceKm: 0.4,
        img: off.img || './assets/crops/offer-cafe.webp',
        lat: 28.6139,
        lng: 77.2090,
      };

      set((state) => ({
        offers: [created, ...state.offers],
      }));
      return created;
    },

    addEvent: async (ev: Partial<LiveEventItem>): Promise<LiveEventItem> => {
      const created: LiveEventItem = {
        id: `custom-event-${Date.now()}`,
        title: ev.title || 'Community Event',
        venue: ev.venue || 'Local Community Center',
        area: 'Neighborhood',
        dateDisplay: ev.dateDisplay || 'Upcoming Weekend',
        timeDisplay: ev.timeDisplay || '10:00 AM - 02:00 PM',
        cat: ev.cat || 'Markets & Fairs',
        dist: '0.6 km',
        distanceKm: 0.6,
        price: 'Free Entry',
        free: true,
        rsvp: '50+ expected',
        expectedAttendance: 50,
        parkingPressure: 'LOW',
        trafficImpact: 'LOW',
        exitWeatherAdvisory: 'Clear weather expected.',
        commuteCorridor: 'Main Road',
        source: 'Community Board',
        img: ev.img || './assets/crops/event-farmers.webp',
        lat: 28.6139,
        lng: 77.2090,
      };

      set((state) => ({
        events: [created, ...state.events],
      }));
      return created;
    },
  };
});
