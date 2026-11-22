import { create } from 'zustand';
import { SavedEntry } from '../types';
import { INITIAL_SAVED_ITEMS } from '../data/mockData';
import { syncSavedBookmarkToBackend } from '../services/communityMarketplaceService';

const SAVED_STORAGE_KEY = 'myarea24_saved_items_v1';

function getStoredSaved(): SavedEntry[] {
  if (typeof window === 'undefined') return INITIAL_SAVED_ITEMS;
  try {
    const raw = localStorage.getItem(SAVED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return INITIAL_SAVED_ITEMS;
}

function persistSaved(entries: SavedEntry[]) {
  try {
    localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

export interface SavedState {
  savedEntries: SavedEntry[];
  savedIds: string[];
  toggleSave: (entry: SavedEntry) => void;
  isSaved: (id: string) => boolean;
}

export const useSavedStore = create<SavedState>((set, get) => ({
  savedEntries: getStoredSaved(),
  get savedIds() {
    return get().savedEntries.map((s) => s.id);
  },

  isSaved: (id: string) => {
    return get().savedEntries.some((s) => s.id === id);
  },

  toggleSave: (entry: SavedEntry) => {
    const prev = get().savedEntries;
    const exists = prev.some((s) => s.id === entry.id);
    let next: SavedEntry[];

    if (exists) {
      next = prev.filter((s) => s.id !== entry.id);
      syncSavedBookmarkToBackend(entry.id, false).catch(() => {});
    } else {
      next = [entry, ...prev];
      syncSavedBookmarkToBackend(entry.id, true).catch(() => {});
    }

    persistSaved(next);
    set({ savedEntries: next });
  },
}));
