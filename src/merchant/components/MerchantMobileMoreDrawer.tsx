import React from 'react';
import {
  LayoutGrid,
  X,
  Globe,
  Store,
  Tag,
  FileText,
  Star,
  MessageSquare,
  Calendar,
  TrendingUp,
  Megaphone,
  CreditCard,
  Settings,
  Lock,
} from 'lucide-react';
import { MerchantDashboardId } from '../types';

export interface MerchantMobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeDashboard: MerchantDashboardId;
  onNavigate: (dash: MerchantDashboardId) => void;
  onSwitchToCitizen: () => void;
  onLockStorefront: () => void;
  reviewsCount: number;
  unreadMsgCount: number;
}

export const MerchantMobileMoreDrawer: React.FC<MerchantMobileMoreDrawerProps> = ({
  isOpen,
  onClose,
  activeDashboard,
  onNavigate,
  onSwitchToCitizen,
  onLockStorefront,
  reviewsCount,
  unreadMsgCount,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="lg:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex flex-col justify-end"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl p-4 max-h-[82vh] overflow-y-auto pb-10 animate-in slide-in-from-bottom-5 duration-200"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Merchant Hub Navigation</h3>
              <p className="text-[11px] text-slate-500">All business modules & settings</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close merchant drawer"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Switch to Citizen Mode Banner */}
        <div
          onClick={() => {
            onClose();
            onSwitchToCitizen();
          }}
          className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-[#0B1739] via-[#1E1B4B] to-[#312E81] text-white flex items-center justify-between shadow-sm border border-indigo-900/60 cursor-pointer active:scale-98 transition"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-white">Switch to Citizen Portal</h4>
              <p className="text-[10px] text-indigo-200">View live weather, AQI & local neighborhood feed</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold shrink-0 shadow-xs">
            Switch ›
          </span>
        </div>

        {/* Categorized Sections */}
        <div className="space-y-4">
          {/* Storefront Operations */}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 px-1">
              Storefront Operations
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'profile', label: 'Profile', icon: Store },
                { id: 'offers', label: 'Offers', icon: Tag },
                { id: 'posts', label: 'Posts', icon: FileText },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeDashboard === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id as MerchantDashboardId);
                      onClose();
                    }}
                    className={`p-2.5 rounded-2xl border flex flex-col items-center text-center gap-1.5 transition cursor-pointer ${
                      active
                        ? 'bg-purple-600 text-white border-purple-600 font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-200/70 hover:bg-purple-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] font-bold leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer Relations */}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 px-1">
              Customer Relations
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'reviews', label: 'Reviews', icon: Star, badge: `${reviewsCount} reviews` },
                { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMsgCount > 0 ? `${unreadMsgCount} new` : undefined },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeDashboard === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id as MerchantDashboardId);
                      onClose();
                    }}
                    className={`p-2.5 rounded-2xl border flex flex-col items-center text-center gap-1.5 transition cursor-pointer relative ${
                      active
                        ? 'bg-purple-600 text-white border-purple-600 font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-200/70 hover:bg-purple-50'
                    }`}
                  >
                    {item.badge && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 font-extrabold">
                        {item.badge}
                      </span>
                    )}
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] font-bold leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Growth & Business Tools */}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 px-1">
              Growth & Analytics
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'analytics', label: 'Analytics', icon: TrendingUp },
                { id: 'promotions', label: 'Promotions', icon: Megaphone },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeDashboard === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id as MerchantDashboardId);
                      onClose();
                    }}
                    className={`p-2.5 rounded-2xl border flex flex-col items-center text-center gap-1.5 transition cursor-pointer ${
                      active
                        ? 'bg-purple-600 text-white border-purple-600 font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-200/70 hover:bg-purple-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] font-bold leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account & Settings */}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 px-1">
              Account & Settings
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'payments', label: 'Payments', icon: CreditCard },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeDashboard === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id as MerchantDashboardId);
                      onClose();
                    }}
                    className={`p-2.5 rounded-2xl border flex flex-col items-center text-center gap-1.5 transition cursor-pointer ${
                      active
                        ? 'bg-purple-600 text-white border-purple-600 font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-200/70 hover:bg-purple-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] font-bold leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lock Storefront Button */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onLockStorefront();
            }}
            className="w-full py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock & Sign Out Storefront</span>
          </button>
        </div>
      </div>
    </div>
  );
};
