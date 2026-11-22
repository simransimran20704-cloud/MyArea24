import React from 'react';
import { Store, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { useCartStore } from '../stores';

export const CartConflictModal: React.FC = () => {
  const conflictInfo = useCartStore((s) => s.conflictInfo);
  const resolveConflict = useCartStore((s) => s.resolveConflict);

  if (!conflictInfo) return null;

  const { existingStoreName, newStoreName, newItem } = conflictInfo;
  const itemPrice = newItem.price || newItem.localPriceNum || 99;

  return (
    <div
      onClick={() => resolveConflict('cancel')}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header Ribbon */}
        <div className="bg-amber-500/10 border-b border-amber-200/80 p-5 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-slate-900 leading-tight">
              Replace items in cart?
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Each delivery order is fulfilled by a single local merchant.
            </p>
          </div>
          <button
            type="button"
            onClick={() => resolveConflict('cancel')}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Store className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Current Cart: <strong className="text-slate-900">{existingStoreName}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-amber-700">
              <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
              <span>New Store: <strong className="text-slate-900">{newStoreName}</strong></span>
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Adding this item will discard the items currently in your cart from <strong>{existingStoreName}</strong>.
            </p>
          </div>

          {/* New Item Preview */}
          <div className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-white shadow-2xs">
            {newItem.img || newItem.image ? (
              <img
                src={newItem.img || newItem.image}
                alt={newItem.name}
                className="w-12 h-12 rounded-xl object-contain bg-slate-50 border border-slate-100 p-1 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm shrink-0">
                ₹
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-slate-900 truncate">
                {newItem.name || 'Selected Item'}
              </h4>
              <p className="text-[11px] text-slate-500">
                ₹{typeof itemPrice === 'number' ? itemPrice : itemPrice} • {newStoreName}
              </p>
            </div>
          </div>

          {/* Dual Action CTAs */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => resolveConflict('cancel')}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs transition cursor-pointer text-center"
            >
              Keep Existing Cart
            </button>
            <button
              type="button"
              onClick={() => resolveConflict('replace')}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition shadow-sm cursor-pointer text-center"
            >
              Discard & Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
