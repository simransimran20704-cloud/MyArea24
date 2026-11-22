import { create } from 'zustand';
import { CartItem } from '../types';

const CART_STORAGE_KEY = 'myarea24_cart_items';

function getStoredCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistCart(items: CartItem[]) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export interface CartConflictInfo {
  existingStoreName: string;
  newStoreName: string;
  newItem: any;
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
  conflictInfo: CartConflictInfo | null;
  totalItems: number;
  subtotal: number;
  activeStoreName: string | null;
  addToCart: (item: any) => boolean;
  resolveConflict: (action: 'replace' | 'cancel') => void;
  updateQuantity: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  setCartDrawerOpen: (open: boolean) => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: getStoredCart(),
  isOpen: false,
  conflictInfo: null,
  setCartDrawerOpen: (open: boolean) => set({ isOpen: open }),

  get totalItems() {
    return get().items.reduce((acc, it) => acc + it.quantity, 0);
  },

  get subtotal() {
    return get().items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  },

  get activeStoreName() {
    const items = get().items;
    return items.length > 0 ? (items[0].storeName || items[0].store || null) : null;
  },

  addToCart: (rawItem: any): boolean => {
    let items = get().items;
    const storeName = (rawItem.store || rawItem.storeName || '').trim();
    const currentStore = items.length > 0 ? (items[0].storeName || items[0].store || '').trim() : '';

    // Enforce single-merchant cart policy
    // If the cart already contains items from Store A, prompt to clear cart before adding from Store B
    if (items.length > 0 && storeName && currentStore && currentStore.toLowerCase() !== storeName.toLowerCase()) {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (!window.confirm(`Your cart has items from ${currentStore}. Clear cart to add from ${storeName}?`)) {
          return false;
        }
        persistCart([]);
        set({ items: [], conflictInfo: null });
        items = [];
      } else {
        set({
          conflictInfo: {
            existingStoreName: currentStore,
            newStoreName: storeName,
            newItem: rawItem,
          },
        });
        return false;
      }
    }

    const cleanId = String(rawItem.id || `cart-${Date.now()}`);
    const name = rawItem.name || rawItem.title || 'Product';
    const finalStoreName = storeName || currentStore || 'Neighborhood Store';
    const storeAddress = rawItem.storeAddress || rawItem.address || 'Local Market';

    let unitPrice = 99;
    if (typeof rawItem.price === 'number') {
      unitPrice = rawItem.price;
    } else if (rawItem.localPriceNum && !isNaN(rawItem.localPriceNum)) {
      unitPrice = Number(rawItem.localPriceNum);
    } else if (typeof rawItem.price === 'string') {
      const match = rawItem.price.replace(/[^\d.]/g, '');
      const num = parseFloat(match);
      if (!isNaN(num) && num > 0) unitPrice = num;
    }

    const existingIdx = items.findIndex((it) => it.id === cleanId);
    let nextItems: CartItem[];

    if (existingIdx >= 0) {
      nextItems = items.map((it, idx) =>
        idx === existingIdx ? { ...it, quantity: it.quantity + 1 } : it
      );
    } else {
      nextItems = [
        ...items,
        {
          id: cleanId,
          name,
          price: unitPrice,
          originalPrice: rawItem.oldPrice ? parseFloat(rawItem.oldPrice.replace(/[^\d.]/g, '')) : undefined,
          quantity: 1,
          store: finalStoreName,
          storeName: finalStoreName,
          storeAddress,
          storePhone: rawItem.storePhone || rawItem.merchantPhone || rawItem.phone || rawItem.whatsapp,
          merchantPhone: rawItem.merchantPhone || rawItem.storePhone || rawItem.phone || rawItem.whatsapp,
          whatsapp: rawItem.whatsapp || rawItem.phone || rawItem.storePhone,
          image: rawItem.img || rawItem.image,
          unit: rawItem.unit || '1 unit',
          cat: rawItem.cat,
          dist: rawItem.dist,
        },
      ];
    }

    persistCart(nextItems);
    set({ items: nextItems, conflictInfo: null });
    return true;
  },

  resolveConflict: (action: 'replace' | 'cancel') => {
    const conflict = get().conflictInfo;
    if (action === 'replace' && conflict?.newItem) {
      const rawItem = conflict.newItem;
      const cleanId = String(rawItem.id || `cart-${Date.now()}`);
      const name = rawItem.name || rawItem.title || 'Product';
      const storeName = (rawItem.store || rawItem.storeName || 'Neighborhood Store').trim();
      const storeAddress = rawItem.storeAddress || rawItem.address || 'Local Market';

      let unitPrice = 99;
      if (typeof rawItem.price === 'number') {
        unitPrice = rawItem.price;
      } else if (rawItem.localPriceNum && !isNaN(rawItem.localPriceNum)) {
        unitPrice = Number(rawItem.localPriceNum);
      } else if (typeof rawItem.price === 'string') {
        const match = rawItem.price.replace(/[^\d.]/g, '');
        const num = parseFloat(match);
        if (!isNaN(num) && num > 0) unitPrice = num;
      }

      const freshItems: CartItem[] = [
        {
          id: cleanId,
          name,
          price: unitPrice,
          originalPrice: rawItem.oldPrice ? parseFloat(rawItem.oldPrice.replace(/[^\d.]/g, '')) : undefined,
          quantity: 1,
          store: storeName,
          storeName,
          storeAddress,
          storePhone: rawItem.storePhone || rawItem.merchantPhone || rawItem.phone || rawItem.whatsapp,
          merchantPhone: rawItem.merchantPhone || rawItem.storePhone || rawItem.phone || rawItem.whatsapp,
          whatsapp: rawItem.whatsapp || rawItem.phone || rawItem.storePhone,
          image: rawItem.img || rawItem.image,
          unit: rawItem.unit || '1 unit',
          cat: rawItem.cat,
          dist: rawItem.dist,
        },
      ];

      persistCart(freshItems);
      set({ items: freshItems, conflictInfo: null });
    } else {
      set({ conflictInfo: null });
    }
  },

  updateQuantity: (id: string, delta: number) => {
    const items = get().items;
    const nextItems = items
      .map((it) => {
        if (it.id === id) {
          const newQty = it.quantity + delta;
          return newQty > 0 ? { ...it, quantity: newQty } : null;
        }
        return it;
      })
      .filter(Boolean) as CartItem[];

    persistCart(nextItems);
    set({ items: nextItems });
  },

  removeItem: (id: string) => {
    const nextItems = get().items.filter((it) => it.id !== id);
    persistCart(nextItems);
    set({ items: nextItems });
  },

  clearCart: () => {
    persistCart([]);
    set({ items: [], conflictInfo: null });
  },

  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),
}));
