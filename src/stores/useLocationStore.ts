import { create } from 'zustand';
import { UserLocation, INITIAL_FALLBACK_LOCATION } from '../types';

const LOCATION_STORAGE_KEY = 'myarea24_user_current_location';

function getStoredLocation(): UserLocation {
  if (typeof window === 'undefined') return INITIAL_FALLBACK_LOCATION;
  try {
    const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && (parsed.areaName || parsed.label) && parsed.coords) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return INITIAL_FALLBACK_LOCATION;
}

export interface LocationState {
  currentLocation: UserLocation;
  locationModalOpen: boolean;
  setLocation: (location: UserLocation) => void;
  openLocationModal: () => void;
  closeLocationModal: () => void;
  setLocationModalOpen: (open: boolean) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  currentLocation: getStoredLocation(),
  locationModalOpen: false,

  setLocation: (location: UserLocation) => {
    if (location && location.id !== 'loc-unselected') {
      try {
        localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
      } catch {
        // ignore
      }
    }
    set({ currentLocation: location, locationModalOpen: false });
  },

  openLocationModal: () => set({ locationModalOpen: true }),
  closeLocationModal: () => set({ locationModalOpen: false }),
  setLocationModalOpen: (open: boolean) => set({ locationModalOpen: open }),
}));
