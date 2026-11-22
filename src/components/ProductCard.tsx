import React from 'react';
import { Plus, Minus, ShoppingBag, Store, Zap, ShieldCheck } from 'lucide-react';
import { LiveProductItem } from '../services/communityMarketplaceService';
import { ActionModalData } from '../types';
import { useCartStore } from '../stores';

export interface ProductCardProps {
  product: LiveProductItem;
  isAdded?: boolean;
  onAddToCart?: (item: LiveProductItem) => void;
  onOpenModal?: (data: ActionModalData) => void;
  onNavigateProduct?: (id: string) => void;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product: p,
  isAdded = false,
  onAddToCart,
  onOpenModal,
  onNavigateProduct,
  className = '',
}) => {
  const cartItems = useCartStore((s) => s.items);
  const addToCartStore = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const cleanId = String(p.id);
  const cartItem = cartItems.find((it) => it.id === cleanId);
  const quantity = cartItem?.quantity || (isAdded ? 1 : 0);

  const handleCardClick = () => {
    if (onNavigateProduct) {
      onNavigateProduct(p.id);
    }
    if (onOpenModal) {
      onOpenModal({
        title: p.name,
        subtitle: `${p.store} • ${p.dist || ''}`,
        category: `${p.cat} • Offline vs Online Comparison`,
        badge: (p as any).discount || (p.betterOffline ? 'Cheaper Offline' : 'Verified Price'),
        price: `Local: ${p.price}${p.oldPrice ? ` (Online: ${p.oldPrice})` : ''}`,
        location: p.storeAddress,
        description: `Buy directly from ${p.store} at ${p.price}${
          p.oldPrice ? ` instead of ${p.oldPrice} on ${p.onlineProvider || 'online apps'} (Save ₹${p.savingsAmount})` : ''
        }.`,
        primaryActionLabel: 'Reserve for Pickup / Delivery',
        image: p.img,
        phone: (p as any).phone,
        whatsapp: (p as any).phone,
        address: p.storeAddress,
        source: 'Merchant Catalog',
        verified: true,
        freshnessLabel: (p as any).freshnessLabel || 'Verified Price Today',
      });
    }
  };

  const discount = (p as any).discount;

  return (
    <div
      onClick={handleCardClick}
      className={`cursor-pointer rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5 flex flex-col justify-between hover:border-slate-300 hover:shadow-card-hover transition duration-200 group relative ${className}`}
    >
      <div>
        {/* Product Visual Container with Delivery & Discount Badges */}
        <div className="relative h-28 sm:h-32 w-full rounded-lg overflow-hidden bg-slate-50 mb-2.5 flex items-center justify-center border border-slate-100">
          {p.img ? (
            <img
              src={p.img}
              alt={p.name}
              loading="lazy"
              className="w-full h-full object-contain p-2 group-hover:scale-105 transition duration-300"
            />
          ) : (
            <ShoppingBag className="w-8 h-8 text-slate-300" />
          )}

          {/* Delivery Speed Badge */}
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/95 text-slate-700 text-[10px] font-medium flex items-center gap-1 shadow-xs border border-slate-200/80">
            <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
            <span>15–20 min</span>
          </span>

          {/* Discount / Offline Advantage Badge */}
          {discount ? (
            <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold shadow-xs">
              {discount}
            </span>
          ) : p.betterOffline ? (
            <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-semibold shadow-xs">
              Cheaper Offline
            </span>
          ) : null}
        </div>

        {/* Product Details & Quantity Action */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-2 leading-tight group-hover:text-blue-600 transition">
              {p.name}
            </h4>
            <p className="text-[11px] font-normal text-slate-400 mt-0.5">
              {p.unit || p.brand || '1 pack'}
            </p>
          </div>

          {/* Interactive Stepper / Add Button */}
          {quantity > 0 ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center bg-emerald-600 text-white rounded-lg shadow-xs overflow-hidden h-7 shrink-0"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateQuantity(cleanId, -1);
                }}
                className="w-7 h-full flex items-center justify-center hover:bg-emerald-700 active:scale-90 transition cursor-pointer"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-xs font-bold min-w-[18px] text-center select-none">
                {quantity}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateQuantity(cleanId, 1);
                }}
                className="w-7 h-full flex items-center justify-center hover:bg-emerald-700 active:scale-90 transition cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onAddToCart) onAddToCart(p);
                else addToCartStore(p);
              }}
              className="px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 text-xs font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95 shrink-0"
              aria-label={`Add ${p.name} to cart`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ADD</span>
            </button>
          )}
        </div>
      </div>

      {/* Pricing & Store Footnote */}
      <div className="mt-3 pt-2.5 border-t border-slate-100">
        <div className="flex items-baseline gap-1.5">
          <p className="text-sm sm:text-base font-bold text-slate-900 leading-none">
            {p.price}
          </p>
          {p.oldPrice && (
            <span className="text-[11px] text-slate-400 line-through">
              {p.oldPrice}
            </span>
          )}
          {p.savingsPercent > 0 && (
            <span className="text-[10px] font-bold text-emerald-600">
              {p.savingsPercent}% OFF
            </span>
          )}
        </div>

        {/* Store Name & Distance */}
        <div className="flex items-center justify-between text-[11px] mt-1.5 text-slate-500 truncate">
          <span className="text-slate-600 font-medium truncate flex items-center gap-1">
            <Store className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{p.store}</span>
          </span>
          {p.dist && (
            <span className="text-slate-400 font-normal shrink-0 ml-1">
              {p.dist}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
