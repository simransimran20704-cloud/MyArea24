import React from 'react';
import {
  QrCode,
  Smartphone,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  CreditCard,
  Truck,
} from 'lucide-react';
import { PaymentMethod } from '../../types';
import {
  isStandalonePwa,
  isIosDevice,
  buildUpiAppUri,
} from '../../services/orderCommerceService';

export interface PaymentMethodSelectorProps {
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  grandTotal: number;
  storeName: string;
  upiVerified: boolean;
  onUpiVerified: (v: boolean) => void;
  onRazorpayIntent: () => void;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  paymentMethod,
  onPaymentMethodChange,
  grandTotal,
  storeName,
  upiVerified,
  onUpiVerified,
  onRazorpayIntent,
}) => {
  return (
    <div className="space-y-3.5">
      <p className="text-xs text-slate-600 font-medium">
        Choose your preferred payment method. Instant settlement goes directly to the neighborhood merchant.
      </p>

      {/* UPI QR & Native App Intent Option */}
      <div
        onClick={() => onPaymentMethodChange('upi_qr')}
        className={`p-3.5 rounded-2xl border-2 transition cursor-pointer ${
          paymentMethod === 'upi_qr'
            ? 'border-blue-600 bg-blue-50/50'
            : 'border-slate-200 hover:border-slate-300 bg-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900">UPI Instant App & Dynamic QR</h4>
              <p className="text-[10px] text-slate-500">GPay, PhonePe, Paytm, BHIM</p>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-600">₹{grandTotal}</span>
        </div>

        {paymentMethod === 'upi_qr' && (
          <div className="mt-3 pt-3 border-t border-blue-200/60 flex flex-col items-center space-y-3 animate-in fade-in duration-200">
            {/* iOS Safari Standalone PWA Advisory Banner */}
            {(isStandalonePwa() || isIosDevice()) && (
              <div className="w-full p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-tight flex items-start gap-2">
                <Smartphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">iOS Standalone PWA Mode: </span>
                  Tap your installed app button below (GPay/PhonePe/Paytm), or launch the verified Razorpay UPI Sheet for 100% reliable checkout.
                </div>
              </div>
            )}

            {/* Interactive Dynamic QR Display */}
            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center w-full max-w-[220px]">
              <div className="w-36 h-36 bg-slate-900 rounded-lg p-2 flex flex-col items-center justify-center text-white relative">
                <div className="grid grid-cols-4 gap-1.5 w-full h-full p-1 opacity-90">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-sm ${i % 3 === 0 || i % 5 === 0 ? 'bg-white' : 'bg-transparent'}`}
                    />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[9px] font-black tracking-wider shadow">
                    UPI • ₹{grandTotal}
                  </span>
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-700 mt-2">VPA: myarea24@upi</p>
            </div>

            {/* 1-Tap UPI App Launch Buttons */}
            <div className="w-full space-y-1.5">
              <div className="text-[11px] font-bold text-slate-700 text-center">
                Pay directly with installed UPI app:
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Google Pay */}
                <a
                  href={buildUpiAppUri('gpay', {
                    vpa: 'myarea24@upi',
                    payeeName: storeName,
                    amount: grandTotal,
                    transactionNote: `Order ${storeName}`,
                  })}
                  onClick={(e) => e.stopPropagation()}
                  className="py-2 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-400 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Google Pay</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
                </a>

                {/* PhonePe */}
                <a
                  href={buildUpiAppUri('phonepe', {
                    vpa: 'myarea24@upi',
                    payeeName: storeName,
                    amount: grandTotal,
                    transactionNote: `Order ${storeName}`,
                  })}
                  onClick={(e) => e.stopPropagation()}
                  className="py-2 px-2.5 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100/60 hover:border-purple-400 text-purple-900 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-purple-600" />
                  <span>PhonePe</span>
                  <ExternalLink className="w-3 h-3 text-purple-400 ml-auto" />
                </a>

                {/* Paytm */}
                <a
                  href={buildUpiAppUri('paytm', {
                    vpa: 'myarea24@upi',
                    payeeName: storeName,
                    amount: grandTotal,
                    transactionNote: `Order ${storeName}`,
                  })}
                  onClick={(e) => e.stopPropagation()}
                  className="py-2 px-2.5 rounded-xl border border-sky-200 bg-sky-50/50 hover:bg-sky-100/60 hover:border-sky-400 text-sky-900 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <span>Paytm</span>
                  <ExternalLink className="w-3 h-3 text-sky-400 ml-auto" />
                </a>

                {/* Any UPI / BHIM */}
                <a
                  href={buildUpiAppUri('generic', {
                    vpa: 'myarea24@upi',
                    payeeName: storeName,
                    amount: grandTotal,
                    transactionNote: `Order ${storeName}`,
                  })}
                  onClick={(e) => e.stopPropagation()}
                  className="py-2 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-400 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Other UPI / BHIM</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
                </a>
              </div>
            </div>

            {/* Razorpay Guaranteed UPI Intent Sheet Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRazorpayIntent();
              }}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pay via Razorpay UPI Sheet (PWA & iOS Guaranteed)</span>
            </button>

            {/* VPA Copy Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard?.writeText('myarea24@upi');
                onUpiVerified(true);
              }}
              className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                upiVerified
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {upiVerified ? '✓ VPA (myarea24@upi) Copied' : 'Copy VPA ID (myarea24@upi)'}
            </button>
          </div>
        )}
      </div>

      {/* Razorpay / Cards / Netbanking */}
      <div
        onClick={() => onPaymentMethodChange('razorpay')}
        className={`p-3.5 rounded-2xl border-2 transition cursor-pointer ${
          paymentMethod === 'razorpay'
            ? 'border-blue-600 bg-blue-50/50'
            : 'border-slate-200 hover:border-slate-300 bg-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900">Razorpay / Netbanking / Debit & Credit</h4>
              <p className="text-[10px] text-slate-500">Instant secure card checkout</p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-600">Secure</span>
        </div>
      </div>

      {/* Cash on Delivery (COD) */}
      <div
        onClick={() => onPaymentMethodChange('cod')}
        className={`p-3.5 rounded-2xl border-2 transition cursor-pointer ${
          paymentMethod === 'cod'
            ? 'border-blue-600 bg-blue-50/50'
            : 'border-slate-200 hover:border-slate-300 bg-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900">Cash on Delivery (Pay at Doorstep)</h4>
              <p className="text-[10px] text-slate-500">Pay cash or UPI upon delivery inspection</p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-600">Available</span>
        </div>
      </div>
    </div>
  );
};
