import { create } from 'zustand';
import { ActionModalData } from '../types';

export interface UIState {
  modalData: ActionModalData | null;
  reportModalOpen: boolean;
  reportReason: string;
  serviceBookingModalOpen: boolean;
  selectedServiceToBook: any | null;
  authModalOpen: boolean;
  merchantRegModalOpen: boolean;
  notificationsOpen: boolean;
  profileMenuOpen: boolean;
  mobileMoreOpen: boolean;

  openModal: (data: ActionModalData) => void;
  closeModal: () => void;
  openReportModal: (reason?: string) => void;
  closeReportModal: () => void;
  openServiceBooking: (service: any) => void;
  closeServiceBooking: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  openMerchantRegModal: () => void;
  closeMerchantRegModal: () => void;
  toggleNotifications: () => void;
  toggleProfileMenu: () => void;
  setServiceBookingModalOpen: (open: boolean) => void;
  setSelectedServiceToBook: (service: any) => void;
  setAuthModalOpen: (open: boolean) => void;
  setMerchantRegModalOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean | ((v: boolean) => boolean)) => void;
  setProfileMenuOpen: (open: boolean | ((v: boolean) => boolean)) => void;
  setMobileMoreOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  modalData: null,
  reportModalOpen: false,
  reportReason: '',
  serviceBookingModalOpen: false,
  selectedServiceToBook: null,
  authModalOpen: false,
  merchantRegModalOpen: false,
  notificationsOpen: false,
  profileMenuOpen: false,
  mobileMoreOpen: false,

  openModal: (data: ActionModalData) => set({ modalData: data }),
  closeModal: () => set({ modalData: null }),

  openReportModal: (reason = '') => set({ reportModalOpen: true, reportReason: reason }),
  closeReportModal: () => set({ reportModalOpen: false, reportReason: '' }),

  openServiceBooking: (service: any) =>
    set({ serviceBookingModalOpen: true, selectedServiceToBook: service }),
  closeServiceBooking: () =>
    set({ serviceBookingModalOpen: false, selectedServiceToBook: null }),

  openAuthModal: () => set({ authModalOpen: true }),
  closeAuthModal: () => set({ authModalOpen: false }),

  openMerchantRegModal: () => set({ merchantRegModalOpen: true }),
  closeMerchantRegModal: () => set({ merchantRegModalOpen: false }),

  setServiceBookingModalOpen: (open: boolean) => set({ serviceBookingModalOpen: open }),
  setSelectedServiceToBook: (service: any) => set({ selectedServiceToBook: service }),
  setAuthModalOpen: (open: boolean) => set({ authModalOpen: open }),
  setMerchantRegModalOpen: (open: boolean) => set({ merchantRegModalOpen: open }),
  setNotificationsOpen: (openOrFn) =>
    set((state) => ({
      notificationsOpen: typeof openOrFn === 'function' ? openOrFn(state.notificationsOpen) : openOrFn,
    })),
  setProfileMenuOpen: (openOrFn) =>
    set((state) => ({
      profileMenuOpen: typeof openOrFn === 'function' ? openOrFn(state.profileMenuOpen) : openOrFn,
    })),

  toggleNotifications: () =>
    set((state) => ({ notificationsOpen: !state.notificationsOpen, profileMenuOpen: false })),
  toggleProfileMenu: () =>
    set((state) => ({ profileMenuOpen: !state.profileMenuOpen, notificationsOpen: false })),
  setMobileMoreOpen: (open: boolean) => set({ mobileMoreOpen: open }),
}));
