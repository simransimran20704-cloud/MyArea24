import { DashboardId, ActionModalData, SavedEntry } from '../../types';
import { LiveAreaIntelligence } from '../../services/liveIntelligence';
import { UserLocation } from '../../components/LocationPickerModal';
import { LiveCommunityMarketplaceState } from '../../services/communityMarketplaceService';

export interface DashboardCommonProps {
  onNavigate: (id: DashboardId, queryParams?: Record<string, string>) => void;
  onOpenModal: (data: ActionModalData) => void;
  onAskAi: (prompt: string) => void;
  savedIds: string[];
  onToggleSave: (entry: SavedEntry) => void;
  searchQuery: string;
  selectedArea: string;
  currentLocation: UserLocation;
  liveIntel: LiveAreaIntelligence;
  marketplace?: LiveCommunityMarketplaceState;
  onAddToCart?: (item: any) => void;
  onBookService?: (service: any) => void;
  onOpenCart?: () => void;
  onOpenLocationPicker?: () => void;
  onOpenMerchantRegistration?: () => void;
}

export const EMPTY_MARKETPLACE: LiveCommunityMarketplaceState = {
  loading: false,
  businesses: [],
  products: [],
  services: [],
  offers: [],
  events: [],
  emergencyFacilities: [],
  addBusiness: async () => ({} as any),
  addProduct: async () => ({} as any),
  addService: async () => ({} as any),
  addOffer: async () => ({} as any),
  addEvent: async () => ({} as any),
  refreshMarketplace: () => {},
};
