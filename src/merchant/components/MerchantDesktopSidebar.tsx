import React from 'react';
import {
  Home,
  ShoppingBag,
  Store,
  Package,
  Tag,
  FileText,
  Calendar,
  Star,
  MessageSquare,
  Users,
  TrendingUp,
  Megaphone,
  CreditCard,
  Settings,
  Globe,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { MerchantDashboardId, MerchantOrderItem } from '../types';

export interface MerchantDesktopSidebarProps {
  activeDashboard: MerchantDashboardId;
  onNavigate: (dash: MerchantDashboardId) => void;
  onSwitchToCitizen: () => void;
  orders: MerchantOrderItem[];
  unreadMsgCount: number;
  newLeadsCount: number;
}

export const MerchantDesktopSidebar: React.FC<MerchantDesktopSidebarProps> = ({
  activeDashboard,
  onNavigate,
  onSwitchToCitizen,
  orders,
  unreadMsgCount,
  newLeadsCount,
}) => {
  const placedCount = orders.filter((o) => o.status === 'placed').length;

  return (
    <aside className="hidden lg:flex w-[235px] shrink-0 bg-white border-r border-slate-200/80 flex-col justify-between select-none sticky top-0 h-screen">
      <div className="p-3.5 overflow-y-auto no-scrollbar">
        {/* Brand Logo & Merchant Portal Pill */}
        <div className="px-2 pt-1 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-[19px] font-extrabold tracking-tight text-[#1E1B4B]">
              MyArea<span className="text-[#8B5CF6]">24</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[9px] font-extrabold uppercase">
              Merchant
            </span>
          </div>
        </div>

        {/* SECTION 1: OVERVIEW / MAIN */}
        <nav className="space-y-0.5">
          {[
            { id: 'overview', label: 'Dashboard', icon: Home },
            {
              id: 'orders',
              label: 'Live Orders',
              icon: ShoppingBag,
              badge: placedCount > 0 ? String(placedCount) : undefined,
            },
            { id: 'profile', label: 'Business Profile', icon: Store },
            { id: 'products', label: 'Products & Services', icon: Package },
            { id: 'offers', label: 'Offers & Deals', icon: Tag },
            { id: 'posts', label: 'Posts & Updates', icon: FileText },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeDashboard === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id as MerchantDashboardId)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-[#F3E8FF] text-[#7C3AED] font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-[#7C3AED]' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </span>
                {item.badge && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-extrabold animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* SECTION 2: CUSTOMERS */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="px-3 mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            CUSTOMERS
          </p>
          <nav className="space-y-0.5">
            {[
              { id: 'reviews', label: 'Customer Reviews', icon: Star },
              {
                id: 'messages',
                label: 'Messages',
                icon: MessageSquare,
                badge: unreadMsgCount > 0 ? String(unreadMsgCount) : undefined,
              },
              {
                id: 'leads',
                label: 'Leads & Enquiries',
                icon: Users,
                badge: newLeadsCount > 0 ? String(newLeadsCount) : undefined,
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeDashboard === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id as MerchantDashboardId)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    active
                      ? 'bg-[#F3E8FF] text-[#7C3AED] font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${active ? 'text-[#7C3AED]' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </span>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-600 text-[10px] font-extrabold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* SECTION 3: GROWTH */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="px-3 mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            GROWTH
          </p>
          <nav className="space-y-0.5">
            {[
              { id: 'analytics', label: 'Analytics & Insights', icon: TrendingUp },
              { id: 'promotions', label: 'Promotions', icon: Megaphone },
              { id: 'payments', label: 'Payments & Plans', icon: CreditCard },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeDashboard === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id as MerchantDashboardId)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    active
                      ? 'bg-[#F3E8FF] text-[#7C3AED] font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-[#7C3AED]' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* SECTION 4: ACCOUNT */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="px-3 mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            ACCOUNT
          </p>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeDashboard === 'settings'
                ? 'bg-[#F3E8FF] text-[#7C3AED] font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Settings
              className={`w-4 h-4 ${activeDashboard === 'settings' ? 'text-[#7C3AED]' : 'text-slate-500'}`}
            />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Switch to Citizen Button in Sidebar */}
      <div className="px-3.5 pb-2">
        <button
          type="button"
          onClick={onSwitchToCitizen}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/60 transition cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <span>Citizen Portal</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
        </button>
      </div>

      {/* Need Help? Box at bottom */}
      <div className="p-3.5 border-t border-slate-100">
        <div className="rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 p-3 border border-purple-200/60">
          <p className="text-xs font-extrabold text-slate-900">Need Help?</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Talk to our merchant support team
          </p>
          <button
            type="button"
            onClick={() => alert('Merchant Priority Support: merchant-support@myarea24.in / WhatsApp: +91 98111 22233')}
            className="w-full mt-2 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
          >
            <span>Contact Support</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
