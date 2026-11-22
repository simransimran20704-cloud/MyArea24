import React from 'react';
import { MapPin, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';

export interface CheckoutAddressFormProps {
  fulfillmentType: 'DELIVERY' | 'PICKUP';
  onFulfillmentTypeChange: (type: 'DELIVERY' | 'PICKUP') => void;
  distanceKm: number;
  storeName: string;
  gpsVerified: boolean;
  deliveryCoords: { lat: number; lng: number };
  onVerifyGps: () => void;
  addressError: string | null;
  onClearAddressError: () => void;
  recipientName: string;
  onRecipientNameChange: (val: string) => void;
  recipientPhone: string;
  onRecipientPhoneChange: (val: string) => void;
  flatNo: string;
  onFlatNoChange: (val: string) => void;
  streetAddress: string;
  onStreetAddressChange: (val: string) => void;
  landmark: string;
  onLandmarkChange: (val: string) => void;
  pincode: string;
  onPincodeChange: (val: string) => void;
}

export const CheckoutAddressForm: React.FC<CheckoutAddressFormProps> = ({
  fulfillmentType,
  onFulfillmentTypeChange,
  distanceKm,
  storeName,
  gpsVerified,
  deliveryCoords,
  onVerifyGps,
  addressError,
  onClearAddressError,
  recipientName,
  onRecipientNameChange,
  recipientPhone,
  onRecipientPhoneChange,
  flatNo,
  onFlatNoChange,
  streetAddress,
  onStreetAddressChange,
  landmark,
  onLandmarkChange,
  pincode,
  onPincodeChange,
}) => {
  return (
    <div className="space-y-3.5">
      {/* Fulfillment Mode Toggle: Home Delivery vs Store Takeaway */}
      <div className="flex rounded-2xl bg-slate-100 p-1 border border-slate-200">
        <button
          type="button"
          onClick={() => onFulfillmentTypeChange('DELIVERY')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            fulfillmentType === 'DELIVERY'
              ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🛵 Home Delivery</span>
          <span className="text-[10px] text-slate-400">({distanceKm} km)</span>
        </button>
        <button
          type="button"
          onClick={() => onFulfillmentTypeChange('PICKUP')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            fulfillmentType === 'PICKUP'
              ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🛍️ Store Takeaway</span>
          <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
            FREE
          </span>
        </button>
      </div>

      {/* Mode Specific Guidance */}
      {fulfillmentType === 'PICKUP' ? (
        <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🛍️</span>
              <span className="text-xs font-extrabold text-emerald-950">Storefront Self-Pickup</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
              Ready in ~15 mins
            </span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            Pick up directly from <strong>{storeName}</strong>. Show your order confirmation at the counter. <strong>Zero delivery charges.</strong>
          </p>
        </div>
      ) : (
        /* GPS Verification Badge */
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-extrabold text-blue-900">GPS Geo-Fencing Verification</span>
            </div>
            {gpsVerified ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Pin Verified
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                Unconfirmed
              </span>
            )}
          </div>
          <p className="text-[11px] text-blue-800">
            Delivery Distance: ~{distanceKm} km from {storeName} • ₹20 for 2 km, +₹10/km
          </p>
          <button
            type="button"
            onClick={onVerifyGps}
            className="w-full py-1.5 rounded-lg bg-white border border-blue-300 text-blue-700 text-xs font-bold hover:bg-blue-600 hover:text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Re-Verify Live GPS Pin
          </button>
        </div>
      )}

      {/* Error Banner */}
      {addressError && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{addressError}</span>
        </div>
      )}

      <div className="space-y-2.5">
        <div>
          <label className="text-[11px] font-bold text-slate-700">
            {fulfillmentType === 'PICKUP' ? 'Customer Full Name *' : 'Recipient Full Name *'}
          </label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => {
              onRecipientNameChange(e.target.value);
              if (addressError) onClearAddressError();
            }}
            placeholder="e.g. Rahul Sharma"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none mt-1"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-700">
            {fulfillmentType === 'PICKUP' ? 'Mobile Number (For Pickup Verification) *' : 'Mobile Number (For Delivery Rider OTP) *'}
          </label>
          <input
            type="text"
            value={recipientPhone}
            onChange={(e) => {
              onRecipientPhoneChange(e.target.value);
              if (addressError) onClearAddressError();
            }}
            placeholder="e.g. +91 98123 45678"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none mt-1"
          />
        </div>

        {fulfillmentType === 'DELIVERY' && (
          <>
            <div>
              <label className="text-[11px] font-bold text-slate-700">Flat / House / Floor No. *</label>
              <input
                type="text"
                value={flatNo}
                onChange={(e) => {
                  onFlatNoChange(e.target.value);
                  if (addressError) onClearAddressError();
                }}
                placeholder="e.g. Flat 301, Block C / House No."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700">Complete Street / Area Address *</label>
              <textarea
                rows={2}
                value={streetAddress}
                onChange={(e) => {
                  onStreetAddressChange(e.target.value);
                  if (addressError) onClearAddressError();
                }}
                placeholder="e.g. Sector 9 Road, Main Market"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none mt-1 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700">Nearby Landmark</label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => onLandmarkChange(e.target.value)}
                  placeholder="e.g. Near Mother Dairy / Park"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700">Postal Pincode</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => onPincodeChange(e.target.value)}
                  placeholder="e.g. 110085"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none mt-1"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
