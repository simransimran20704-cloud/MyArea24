import { create } from 'zustand';
import { UserLocation } from '../types';
import {
  LiveAreaIntelligence,
  LiveAlertItem,
  fetchLiveAreaIntelligence,
} from '../services/liveIntelligence';

const INTELLIGENCE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

function getLocationKey(loc: UserLocation): string {
  const lat = (loc as any).coords?.lat ?? 28.6139;
  const lng = (loc as any).coords?.lng ?? 77.2090;
  return `${lat.toFixed(3)}_${lng.toFixed(3)}_${loc.areaName}`;
}

export interface IntelligenceState {
  data: LiveAreaIntelligence | null;
  loading: boolean;
  isRevalidating: boolean;
  error: string | null;
  lastFetched: number | null;
  cachedKey: string | null;
  currentLocationRef: UserLocation | null;

  fetchIntelligence: (location: UserLocation, force?: boolean) => Promise<LiveAreaIntelligence | null>;
  refetch: () => Promise<LiveAreaIntelligence | null>;
  pushCivicAlert: (alert: LiveAlertItem) => void;
}

export const useIntelligenceStore = create<IntelligenceState>((set, get) => ({
  data: null,
  loading: false,
  isRevalidating: false,
  error: null,
  lastFetched: null,
  cachedKey: null,
  currentLocationRef: null,

  fetchIntelligence: async (location: UserLocation, force = false) => {
    const key = getLocationKey(location);
    const { data, lastFetched, cachedKey, isRevalidating, loading } = get();
    const now = Date.now();

    // 1. Cache hit: fresh data within TTL for the exact same location
    if (!force && data && cachedKey === key && lastFetched && now - lastFetched < INTELLIGENCE_CACHE_TTL_MS) {
      return data;
    }

    // 2. Prevent redundant simultaneous calls
    if (loading || isRevalidating) {
      return data;
    }

    // 3. Background revalidation vs initial load
    const hasExistingData = data !== null && cachedKey === key;
    if (hasExistingData) {
      set({ isRevalidating: true, error: null, currentLocationRef: location });
    } else {
      set({ loading: true, error: null, currentLocationRef: location });
    }

    try {
      const result = await fetchLiveAreaIntelligence(location);
      set({
        data: result,
        loading: false,
        isRevalidating: false,
        error: null,
        lastFetched: Date.now(),
        cachedKey: key,
        currentLocationRef: location,
      });
      return result;
    } catch (err: any) {
      set({
        loading: false,
        isRevalidating: false,
        error: err?.message || 'Could not fetch live weather & intelligence signals.',
      });
      return data;
    }
  },

  refetch: async () => {
    const loc = get().currentLocationRef;
    if (!loc) return null;
    return get().fetchIntelligence(loc, true);
  },

  pushCivicAlert: (newAlert: LiveAlertItem) => {
    const current = get().data;
    if (!current || !newAlert) return;

    const exists = current.alerts.some(
      (a) =>
        a.id === newAlert.id ||
        (a.title === newAlert.title && a.description === newAlert.description)
    );
    if (exists) return;

    set({
      data: {
        ...current,
        alerts: [newAlert, ...current.alerts],
      },
    });
  },
}));
