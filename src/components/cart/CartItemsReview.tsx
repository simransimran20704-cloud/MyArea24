import React from 'react';
import { ShoppingBag, Truck, Minus, Plus, Trash2 } from 'lucide-react';
import { CartItem, UserLocation } from '../../types';
import { useTranslation } from 'react-i18next';

export interface CartItemsReviewProps {
  items: CartItem[];
  storeName: string;
  currentLocation: UserLocation;
  orderNotes: string;
  onUpdateNotes: (notes: string) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onClose: () => void;
  onNavigateToProducts?: () => void;
}

export const CartItemsReview: React.FC<CartItemsReviewProps> = ({
  items,
  storeName,
  currentLocation,
  orderNotes,
  onUpdateNotes,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onClose,
  onNavigateToProducts,
}) => {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <ShoppingBag className="w-8 h-8 stroke-1" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">{t('cart.emptyTitle')}</h4>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          {t('cart.emptySubtitle')}
        </p>
        <button
          type="button"
          onClick={() => {
            onClose();
            onNavigateToProducts?.();
          }}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
        >
          {t('cart.browseProducts')}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Single Verified Merchant Banner */}
      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">🏪</span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fulfilling Merchant</p>
            <p className="text-xs font-black text-slate-900 truncate">{storeName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClearCart}
          className="text-[11px] font-extrabold text-rose-600 hover:text-rose-800 hover:underline shrink-0 ml-2 cursor-pointer"
        >
          Clear Cart
        </button>
      </div>

      {/* Delivery Time Banner */}
      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
          <Truck className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-emerald-900">⚡ Hyperlocal 20-min Delivery</p>
          <p className="text-[11px] text-emerald-700 truncate">
            Delivering to {currentLocation.areaName.split(',')[0]} from verified store
          </p>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-2.5">
        {items.map((it) => (
          <div
            key={it.id}
            className="p-3 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between gap-3 hover:border-slate-300 transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              {it.image ? (
                <img
                  src={it.image}
                  alt={it.name}
                  className="w-12 h-12 rounded-lg object-contain bg-slate-50 shrink-0 border border-slate-100"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">
                  🛍️
                </div>
              )}
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-slate-900 truncate">{it.name}</h5>
                <p className="text-[11px] font-extrabold text-slate-800 mt-0.5">₹{it.price}</p>
                <p className="text-[10px] text-slate-400 truncate">🏪 {it.store || storeName}</p>
              </div>
            </div>

            {/* Quantity Stepper */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(it.id, -1)}
                  className="p-1 hover:text-blue-600 text-slate-500 transition cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-xs font-extrabold text-slate-800">
                  {it.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(it.id, 1)}
                  className="p-1 hover:text-blue-600 text-slate-500 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onRemoveItem(it.id)}
                className="p-1.5 text-slate-300 hover:text-rose-500 transition cursor-pointer"
                title="Remove item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Order Notes */}
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-700">Special Instructions for Merchant</label>
        <input
          type="text"
          value={orderNotes}
          onChange={(e) => onUpdateNotes(e.target.value)}
          placeholder="e.g. Ring the bell, deliver fresh expiry dates"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
    </>
  );
};
