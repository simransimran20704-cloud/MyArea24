import React from 'react';
import { ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { CartItem, Order } from '../../types';
import { buildWhatsAppOrderUrl } from '../../services/orderCommerceService';
import { DeliveryQuoteResult } from '../../services/orderCommerceService';
import { useTranslation } from 'react-i18next';

export interface CartPriceSummaryProps {
  step: 'review' | 'address' | 'payment' | 'tracking';
  items: CartItem[];
  activeOrder?: Order | null;
  fulfillmentType?: 'DELIVERY' | 'PICKUP';
  subtotal: number;
  distanceKm: number;
  deliveryFee: number;
  platformFee: number;
  discountAmount: number;
  grandTotal: number;
  serverDeliveryQuote: DeliveryQuoteResult | null;
  isPlacing: boolean;
  onSetStep: (step: 'review' | 'address' | 'payment' | 'tracking') => void;
  onProceedToPayment: () => void;
  onConfirmOrder: () => void;
  onClose: () => void;
}

export const CartPriceSummary: React.FC<CartPriceSummaryProps> = ({
  step,
  items,
  activeOrder,
  fulfillmentType = 'DELIVERY',
  subtotal,
  distanceKm,
  deliveryFee,
  platformFee,
  discountAmount,
  grandTotal,
  serverDeliveryQuote,
  isPlacing,
  onSetStep,
  onProceedToPayment,
  onConfirmOrder,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-4 border-t border-slate-100 bg-slate-50/90 space-y-3">
      {step !== 'tracking' && items.length > 0 && (
        <div className="space-y-1.5 text-xs text-slate-600 border-b border-slate-200 pb-2.5">
          <div className="flex justify-between">
            <span>{t('cart.itemSubtotal')} ({items.length} {t('common.items')})</span>
            <span className="font-bold text-slate-900">₹{subtotal}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <span>{t('cart.deliveryFee')}</span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                GPS {distanceKm} km
              </span>
            </span>
            {deliveryFee === 0 ? (
              <span className="font-bold text-emerald-600 uppercase text-[11px]">{t('cart.free')}</span>
            ) : (
              <span className="font-bold text-slate-900">₹{deliveryFee}</span>
            )}
          </div>
          {serverDeliveryQuote?.tierExplanation && (
            <p className="text-[10px] text-slate-400 text-right -mt-0.5 font-medium">
              {serverDeliveryQuote.tierExplanation}
            </p>
          )}
          <div className="flex justify-between">
            <span>{t('cart.platformFee')}</span>
            <span>₹{platformFee}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>{t('cart.discount')}</span>
              <span>-₹{discountAmount}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
            <span>{t('cart.grandTotal')}</span>
            <span className="text-blue-600">₹{grandTotal}</span>
          </div>
        </div>
      )}

      {/* Step Progression Buttons */}
      {step === 'review' && items.length > 0 && (
        <button
          type="button"
          onClick={() => onSetStep('address')}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
        >
          <span>Select Delivery Address</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}

      {step === 'address' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSetStep('review')}
            className="w-1/3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onProceedToPayment}
            className="w-2/3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
          >
            <span>Proceed to Payment</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {step === 'payment' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSetStep('address')}
            className="w-1/3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            disabled={isPlacing}
            onClick={onConfirmOrder}
            className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
          >
            {isPlacing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>{isPlacing ? t('cart.placingOrder') : `${t('cart.placeOrder')} (₹${grandTotal})`}</span>
          </button>
        </div>
      )}

      {step === 'tracking' && (
        <div className="space-y-2">
          {activeOrder && activeOrder.status !== 'cancelled' && (
            <a
              href={buildWhatsAppOrderUrl(activeOrder, fulfillmentType)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2 transition shadow-md hover:shadow-lg cursor-pointer text-center"
            >
              <span>Send Order to Merchant on WhatsApp 📲</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              onSetStep('review');
              onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
          >
            Close & Continue Exploring
          </button>
        </div>
      )}
    </div>
  );
};
