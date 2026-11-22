import React from 'react';
import { Store, ShieldCheck, Plus, Globe, Bell } from 'lucide-react';
import { MerchantBusinessInfo } from '../types';

export interface MerchantMobileHeaderProps {
  currentBusiness: MerchantBusinessInfo;
  onOpenAddProduct: () => void;
  onSwitchToCitizen: () => void;
  onToggleNotifications: () => void;
  hasPlacedOrders: boolean;
}

export const MerchantMobileHeader: React.FC<MerchantMobileHeaderProps> = ({
  currentBusiness,
  onOpenAddProduct,
  onSwitchToCitizen,
  onToggleNotifications,
  hasPlacedOrders,
}) => {
  return (
    <header className="lg:hidden bg-[#1E1B4B] text-white px-3.5 py-3 sticky top-0 z-30 shadow-md">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-extrabold text-sm shadow-xs shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-extrabold text-white truncate max-w-[150px]">
                {currentBusiness.name}
              </h3>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-extrabold flex items-center gap-0.5">
                <ShieldCheck className="w-2.5 h-2.5" />
                Verified
              </span>
            </div>
            <p className="text-[10px] text-purple-200 truncate">
              {currentBusiness.category} • {currentBusiness.locationArea}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAddProduct}
            className="p-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-xs cursor-pointer"
            title="Quick Add Product"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onSwitchToCitizen}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/15 text-purple-200 border border-white/10 cursor-pointer"
            title="Switch to Citizen View"
          >
            <Globe className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onToggleNotifications}
            className="relative p-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white border border-white/10 cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {hasPlacedOrders && (
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1 right-1" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
