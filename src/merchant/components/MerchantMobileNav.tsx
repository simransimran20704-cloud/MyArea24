import React from 'react';
import { Home, ShoppingBag, Package, Users, LayoutGrid } from 'lucide-react';
import { MerchantDashboardId } from '../types';

export interface MerchantMobileNavProps {
  activeDashboard: MerchantDashboardId;
  mobileMoreOpen: boolean;
  onNavigate: (dash: MerchantDashboardId) => void;
  onToggleMore: () => void;
  hasPlacedOrders: boolean;
  newLeadsCount: number;
}

export const MerchantMobileNav: React.FC<MerchantMobileNavProps> = ({
  activeDashboard,
  mobileMoreOpen,
  onNavigate,
  onToggleMore,
  hasPlacedOrders,
  newLeadsCount,
}) => {
  return (
    <nav
      aria-label="Merchant mobile bottom navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] px-2 py-1.5 z-40"
    >
      <div className="grid grid-cols-5 items-center max-w-md mx-auto">
        {/* 1. Dashboard */}
        <button
          type="button"
          onClick={() => onNavigate('overview')}
          className={`flex flex-col items-center justify-center py-1 gap-0.5 transition cursor-pointer ${
            activeDashboard === 'overview' && !mobileMoreOpen
              ? 'text-purple-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <Home className={`w-5 h-5 ${activeDashboard === 'overview' && !mobileMoreOpen ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] leading-tight">Home</span>
        </button>

        {/* 2. Orders */}
        <button
          type="button"
          onClick={() => onNavigate('orders')}
          className={`flex flex-col items-center justify-center py-1 gap-0.5 transition cursor-pointer relative ${
            activeDashboard === 'orders' && !mobileMoreOpen
              ? 'text-purple-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div className="relative">
            <ShoppingBag className={`w-5 h-5 ${activeDashboard === 'orders' && !mobileMoreOpen ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            {hasPlacedOrders && (
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5 ring-2 ring-white animate-pulse" />
            )}
          </div>
          <span className="text-[10px] leading-tight">Orders</span>
        </button>

        {/* 3. Products */}
        <button
          type="button"
          onClick={() => onNavigate('products')}
          className={`flex flex-col items-center justify-center py-1 gap-0.5 transition cursor-pointer ${
            activeDashboard === 'products' && !mobileMoreOpen
              ? 'text-purple-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <Package className={`w-5 h-5 ${activeDashboard === 'products' && !mobileMoreOpen ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] leading-tight">Products</span>
        </button>

        {/* 4. Leads */}
        <button
          type="button"
          onClick={() => onNavigate('leads')}
          className={`flex flex-col items-center justify-center py-1 gap-0.5 transition cursor-pointer relative ${
            activeDashboard === 'leads' && !mobileMoreOpen
              ? 'text-purple-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div className="relative">
            <Users className={`w-5 h-5 ${activeDashboard === 'leads' && !mobileMoreOpen ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            {newLeadsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-indigo-500 absolute -top-0.5 -right-0.5 ring-2 ring-white" />
            )}
          </div>
          <span className="text-[10px] leading-tight">Leads</span>
        </button>

        {/* 5. More */}
        <button
          type="button"
          onClick={onToggleMore}
          className={`flex flex-col items-center justify-center py-1 gap-0.5 transition cursor-pointer ${
            mobileMoreOpen
              ? 'text-purple-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <LayoutGrid className={`w-5 h-5 ${mobileMoreOpen ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] leading-tight">More</span>
        </button>
      </div>
    </nav>
  );
};
