import React from 'react';

import {

  CheckCircle2,

  XCircle,

  RefreshCw,

  AlertCircle,

  FileText,

} from 'lucide-react';

import { Order, CartItem, UserLocation } from '../../types';

import { OrderTracker } from '../OrderTracker';

import { useTranslation } from 'react-i18next';
import { buildWhatsAppOrderUrl } from '../../services/orderCommerceService';

export interface OrderTrackingViewProps {

  activeOrder: Order;

  liveSyncNotice: string | null;

  currentLocation: UserLocation;

  items: CartItem[];

  fulfillmentType: 'DELIVERY' | 'PICKUP';

  isUpdatingStatus: boolean;

  onRefreshStatus: () => void;

  isCancelling: boolean;

  cancelError: string | null;

  onCancelOrder: () => void;

}

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({

  activeOrder,

  liveSyncNotice,

  currentLocation,

  items,

  fulfillmentType,

  isUpdatingStatus,

  onRefreshStatus,

  isCancelling,

  cancelError,

  onCancelOrder,

}) => {

  const { t } = useTranslation();

  return (

    <div className="space-y-4">

      {liveSyncNotice && (

        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold shadow-xs animate-in slide-in-from-top-1">

          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />

          <span>{liveSyncNotice}</span>

        </div>

      )}

      {/* Success / Status Card */}

      <div

        className={`p-4 rounded-2xl text-white shadow-lg space-y-2 ${

          activeOrder.status === 'cancelled'

            ? 'bg-gradient-to-br from-rose-600 to-red-700'

            : 'bg-gradient-to-br from-emerald-500 to-teal-600'

        }`}

      >

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-2">

            {activeOrder.status === 'cancelled' ? (

              <XCircle className="w-5 h-5 text-white" />

            ) : (

              <CheckCircle2 className="w-5 h-5 text-white" />

            )}

            <span className="text-xs font-bold tracking-wide uppercase opacity-90">

              {activeOrder.status === 'cancelled' ? 'Order Cancelled' : 'Order Transmitted'}

            </span>

          </div>

          <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-mono text-xs font-bold">

            {activeOrder.orderNumber}

          </span>

        </div>

        <h4 className="text-lg font-black leading-tight">

          ₹{activeOrder.finalPayable} Payable ({activeOrder.paymentMethod.toUpperCase()})

        </h4>

        <div className="flex items-center gap-2 pt-1 flex-wrap">

          {activeOrder.paymentStatus === 'paid' ? (

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-400/25 text-emerald-100 text-[11px] font-bold border border-emerald-300/30">

              <CheckCircle2 className="w-3 h-3 text-emerald-300" /> Payment Verified

            </span>

          ) : activeOrder.paymentStatus === 'cod' ? (

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/25 text-amber-100 text-[11px] font-bold border border-amber-300/30">

              💵 Pay on Delivery

            </span>

          ) : activeOrder.paymentStatus === 'failed' ? (

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-400/25 text-rose-100 text-[11px] font-bold border border-rose-300/30">

              <XCircle className="w-3 h-3 text-rose-300" /> Payment Failed

            </span>

          ) : (

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-400/25 text-blue-100 text-[11px] font-bold border border-blue-300/30">

              <RefreshCw className="w-3 h-3 animate-spin text-blue-200" /> Syncing with Gateway...

            </span>

          )}

          {activeOrder.transactionId && (

            <span className="text-[10px] text-white/80 font-mono truncate max-w-[150px]">

              Txn: {activeOrder.transactionId}

            </span>

          )}

        </div>

        <p className="text-xs text-white/90">

          {activeOrder.status === 'cancelled'

            ? 'This order has been cancelled and will not be prepared or delivered.'

            : `Estimated arrival in ${activeOrder.estimatedDeliveryMins} mins at ${currentLocation.areaName.split(',')[0]}`}

        </p>

      </div>

      {/* Direct WhatsApp Order Forwarding (Zero Server Cost) */}
      {activeOrder.status !== 'cancelled' && (
        <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 rounded-2xl border-2 border-emerald-500/50 shadow-md space-y-2.5 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Direct Shopkeeper Alert (Zero Delay)</span>
            </span>
            <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
              Instant 📲
            </span>
          </div>

          <a
            href={buildWhatsAppOrderUrl(activeOrder, fulfillmentType)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2.5 transition shadow-md hover:shadow-lg cursor-pointer"
          >
            <span>Send Order to Merchant on WhatsApp 📲</span>
          </a>

          <p className="text-[11px] text-emerald-700/90 text-center font-medium leading-tight">
            Tier 1 &amp; 2 Kirana merchants check WhatsApp instantly. Tap to forward your complete item list &amp; address directly to the store!
          </p>
        </div>
      )}

      {/* 4-Stage Status Lifecycle Stepper */}

      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">

        <h4 className="text-xs font-extrabold text-slate-800">Live Order Lifecycle Status</h4>

        <OrderTracker status={activeOrder.status} variant="vertical" />

        {/* Real-time Status Refresh & Order History link */}

        <div className="pt-2 space-y-2">

          {cancelError && (

            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">

              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />

              <span>{cancelError}</span>

            </div>

          )}

          <button

            type="button"

            disabled={isUpdatingStatus}

            onClick={onRefreshStatus}

            className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"

          >

            <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingStatus ? 'animate-spin' : ''}`} />

            {t('cart.refreshStatus')}

          </button>

          {activeOrder.status === 'placed' && (

            <button

              type="button"

              disabled={isCancelling}

              onClick={onCancelOrder}

              className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"

            >

              {isCancelling ? (

                <RefreshCw className="w-3.5 h-3.5 animate-spin" />

              ) : (

                <XCircle className="w-3.5 h-3.5 text-rose-600" />

              )}

              {t('cart.cancelOrder')}

            </button>

          )}

          {activeOrder.status !== 'placed' && activeOrder.status !== 'cancelled' && (

            <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-[11px] text-slate-500 font-medium text-center border border-slate-200/60">

              🔒 Order confirmed by merchant. Fulfillment status updates are controlled by the store.

            </div>

          )}

          {activeOrder.status === 'cancelled' && (

            <div className="px-3 py-1.5 rounded-xl bg-rose-50 text-[11px] text-rose-700 font-bold text-center border border-rose-200">

              Order has been cancelled.

            </div>

          )}

          <a

            href="/my-orders"

            className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"

          >

            <FileText className="w-3.5 h-3.5" />

            View Invoice & Details in My Orders →

          </a>

        </div>

      </div>

      {/* Items Summary in Order */}

      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">

        <p className="text-[11px] font-bold text-slate-600">Items Ordered:</p>

        {activeOrder.items.map((it, idx) => (

          <div key={idx} className="flex justify-between text-xs text-slate-800">

            <span>{it.quantity}x {it.name}</span>

            <span className="font-bold">₹{it.price * it.quantity}</span>

          </div>

        ))}

      </div>

    </div>

  );

};
