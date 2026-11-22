import React from 'react';
import {
  Store,
  ChevronDown,
  CheckCircle2,
  Plus,
  Search,
  Globe,
  Lock,
  Sparkles,
  Sun,
  Bell,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import {
  MerchantBusinessInfo,
  MerchantOrderItem,
  MerchantConversation,
  MerchantLeadItem,
  MerchantReviewItem,
  MerchantDashboardId,
} from '../types';
import { getStoredMerchantAccounts } from '../../services/communityMarketplaceService';
import { realtimeService, RealtimeConnectionStatus } from '../../services/realtimeService';

export interface MerchantDesktopHeaderProps {
  currentBusiness: MerchantBusinessInfo;
  businessDropdownOpen: boolean;
  setBusinessDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSwitchBusiness: (acc: any) => void;
  onOpenRegisterModal: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSwitchToCitizen: () => void;
  onLockStorefront: () => void;
  wsStatus: RealtimeConnectionStatus;
  isSimulating: boolean;
  setIsSimulating: React.Dispatch<React.SetStateAction<boolean>>;
  orders: MerchantOrderItem[];
  conversations: MerchantConversation[];
  leads: MerchantLeadItem[];
  reviews: MerchantReviewItem[];
  notificationsOpen: boolean;
  setNotificationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  profileMenuOpen: boolean;
  setProfileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onNavigate: (dash: MerchantDashboardId) => void;
  onShowToast: (msg: string) => void;
}

export const MerchantDesktopHeader: React.FC<MerchantDesktopHeaderProps> = ({
  currentBusiness,
  businessDropdownOpen,
  setBusinessDropdownOpen,
  onSwitchBusiness,
  onOpenRegisterModal,
  searchQuery,
  setSearchQuery,
  onSwitchToCitizen,
  onLockStorefront,
  wsStatus,
  isSimulating,
  setIsSimulating,
  orders,
  conversations,
  leads,
  reviews,
  notificationsOpen,
  setNotificationsOpen,
  profileMenuOpen,
  setProfileMenuOpen,
  onNavigate,
  onShowToast,
}) => {
  const placedOrdersList = orders.filter((o) => o.status === 'placed');
  const unreadConvs = conversations.filter((c) => (c.unreadCount || 0) > 0);
  const newLeadsList = leads.filter((l) => l.status === 'New');
  const totalUnread = placedOrdersList.length + unreadConvs.length + newLeadsList.length;

  const ownerInitials = (currentBusiness.ownerName || 'Merchant')
    .trim()
    .split(/\s+/)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="hidden lg:flex h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 items-center justify-between gap-4 sticky top-0 z-30">
      <div className="flex items-center gap-4 flex-1 max-w-2xl">
        {/* Location / Business Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setBusinessDropdownOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 text-xs font-bold text-slate-800 transition cursor-pointer"
          >
            <Store className="w-3.5 h-3.5 text-indigo-600" />
            <span className="truncate max-w-[170px]">{currentBusiness.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {businessDropdownOpen && (
            <div
              onClick={() => setBusinessDropdownOpen(false)}
              className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              <p className="px-2 py-1 text-[10px] font-extrabold text-slate-400 uppercase">
                Select Storefront
              </p>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {getStoredMerchantAccounts().length > 0 ? (
                  getStoredMerchantAccounts().map((acc) => {
                    const isSelected = acc.businessName === currentBusiness.name;
                    return (
                      <button
                        key={acc.id || acc.businessName}
                        type="button"
                        onClick={() => onSwitchBusiness(acc)}
                        className={`w-full p-2.5 rounded-xl text-left transition text-xs font-bold flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-purple-50 text-purple-900 border border-purple-200'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <p className="truncate font-extrabold">{acc.businessName}</p>
                          <p className="text-[10px] text-slate-400 font-medium truncate">
                            {acc.category} • {acc.locality}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-2.5 text-xs font-bold text-slate-800">
                    {currentBusiness.name} ({currentBusiness.category})
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setBusinessDropdownOpen(false);
                  onOpenRegisterModal();
                }}
                className="w-full mt-2 pt-2 border-t border-slate-100 p-1.5 rounded-lg text-left hover:bg-slate-50 transition text-xs font-extrabold text-indigo-600 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Register Another Store / Branch</span>
              </button>
            </div>
          )}
        </div>

        {/* Global Search */}
        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search features, insights, help..."
              className="bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none w-full"
            />
          </div>
          <span className="px-1.5 py-0.2 rounded bg-white border border-slate-200 text-[10px] text-slate-400">
            ⌘ K
          </span>
        </div>
      </div>

      {/* Right Pills */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Switch to Citizen Portal Pill */}
        <button
          type="button"
          onClick={onSwitchToCitizen}
          className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition cursor-pointer"
          title="Switch to Resident / Citizen View"
        >
          <Globe className="w-3.5 h-3.5 text-blue-200" />
          <span>Switch to Citizen View</span>
        </button>

        {/* Lock Storefront Button */}
        <button
          type="button"
          onClick={onLockStorefront}
          className="px-3 py-1.5 rounded-full bg-slate-50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
          title="Lock Merchant Portal & Sign Out"
        >
          <Lock className="w-3.5 h-3.5 text-slate-500 hover:text-rose-600" />
          <span>Lock Store</span>
        </button>

        {/* Live WebSocket Indicator */}
        <div
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 select-none"
          title={
            wsStatus === 'connected'
              ? 'Real-Time WebSockets Active: Leads, Reviews & Inquiries arrive instantly'
              : `WebSocket: ${wsStatus}`
          }
        >
          <span
            className={`w-2 h-2 rounded-full ${
              wsStatus === 'connected'
                ? 'bg-emerald-500 animate-pulse'
                : wsStatus === 'connecting' || wsStatus === 'reconnecting'
                ? 'bg-amber-400 animate-bounce'
                : 'bg-slate-400'
            }`}
          />
          <span className="text-[10px] tracking-wider uppercase font-black text-slate-600">
            {wsStatus === 'connected' ? 'Live Storefront' : wsStatus}
          </span>
        </div>

        {/* Instant Simulator Pill */}
        <button
          type="button"
          disabled={isSimulating}
          onClick={async () => {
            setIsSimulating(true);
            await realtimeService.triggerMerchantLead({
              customerName: 'Aarav Sharma',
              topic: 'Espresso Bar & Pastry Catering Quote',
              phone: '+91 98112 44321',
              message: 'Inquiring for 40-person corporate team kit delivery this Friday.',
            });
            setTimeout(() => setIsSimulating(false), 800);
          }}
          className="px-3 py-1.5 rounded-full bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
          title="Simulate instant customer lead over WebSocket"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>{isSimulating ? 'Simulating...' : 'Test Lead'}</span>
        </button>

        <span className="px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 flex items-center gap-1.5">
          <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
          <span>28°C</span>
        </span>

        {/* Notifications Button */}
        <button
          type="button"
          onClick={() => setNotificationsOpen((v) => !v)}
          className="w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 relative cursor-pointer"
          title="Storefront notifications"
        >
          <Bell className="w-4 h-4" />
          {totalUnread > 0 && (
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 absolute top-1.5 right-1.5 ring-2 ring-white animate-pulse" />
          )}
        </button>

        {/* User Pill */}
        <button
          type="button"
          onClick={() => setProfileMenuOpen((v) => !v)}
          className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
        >
          <span className="w-7 h-7 rounded-full bg-purple-600 text-white font-extrabold text-xs flex items-center justify-center">
            {ownerInitials || 'MP'}
          </span>
          <div className="text-left hidden xl:block">
            <p className="text-xs font-bold text-slate-800 leading-none">
              {currentBusiness.ownerName}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {currentBusiness.ownerRole} • {currentBusiness.name}
            </p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* Notifications Popover */}
        {notificationsOpen && (
          <div
            onClick={() => setNotificationsOpen(false)}
            className="fixed inset-0 z-50 flex items-start justify-end pt-28 px-6 bg-black/20"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-84 p-3 space-y-2 animate-in zoom-in-95 duration-100"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-extrabold text-slate-900">
                  Storefront Notifications
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    totalUnread > 0
                      ? 'text-rose-600 bg-rose-50'
                      : 'text-emerald-700 bg-emerald-50'
                  }`}
                >
                  {totalUnread > 0 ? `${totalUnread} New` : 'All Caught Up'}
                </span>
              </div>

              <div className="space-y-2 text-xs max-h-72 overflow-y-auto">
                {placedOrdersList.length > 0 && (
                  <div
                    onClick={() => {
                      setNotificationsOpen(false);
                      onNavigate('orders');
                    }}
                    className="p-2.5 rounded-xl bg-rose-50/80 hover:bg-rose-100/80 border border-rose-100 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-rose-950">
                        New Order #{placedOrdersList[0].orderNumber}
                      </p>
                      <span className="text-[10px] font-black text-rose-700">₹{placedOrdersList[0].finalPayable}</span>
                    </div>
                    <p className="text-[11px] text-rose-800 mt-0.5">
                      From {placedOrdersList[0].customerName} • Tap to view orders
                    </p>
                  </div>
                )}

                {unreadConvs.length > 0 && (
                  <div
                    onClick={() => {
                      setNotificationsOpen(false);
                      onNavigate('messages');
                    }}
                    className="p-2.5 rounded-xl bg-purple-50/80 hover:bg-purple-100/80 border border-purple-100 cursor-pointer transition"
                  >
                    <p className="font-bold text-purple-950">
                      Message from {unreadConvs[0].customerName}
                    </p>
                    <p className="text-[11px] text-purple-800 line-clamp-1 mt-0.5">
                      "{unreadConvs[0].lastMessage}"
                    </p>
                  </div>
                )}

                {newLeadsList.length > 0 && (
                  <div
                    onClick={() => {
                      setNotificationsOpen(false);
                      onNavigate('leads');
                    }}
                    className="p-2.5 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-100 cursor-pointer transition"
                  >
                    <p className="font-bold text-indigo-950">
                      Inquiry for {newLeadsList[0].interestedCategory}
                    </p>
                    <p className="text-[11px] text-indigo-800 mt-0.5">
                      From {newLeadsList[0].customerName} • Tap to manage leads
                    </p>
                  </div>
                )}

                {reviews.length > 0 && totalUnread === 0 && (
                  <div
                    onClick={() => {
                      setNotificationsOpen(false);
                      onNavigate('reviews');
                    }}
                    className="p-2.5 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-100 cursor-pointer transition"
                  >
                    <p className="font-bold text-amber-950">
                      {reviews[0].rating} ★ Review Received
                    </p>
                    <p className="text-[11px] text-amber-800 line-clamp-1 mt-0.5">
                      "{reviews[0].comment}"
                    </p>
                  </div>
                )}

                {totalUnread === 0 && reviews.length === 0 && (
                  <div className="py-6 text-center text-slate-400">
                    <Bell className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-600">No new alerts</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Incoming orders and neighborhood inquiries will pop up here in real time.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    realtimeService.triggerTestPush(currentBusiness.id);
                    onShowToast('🔔 Test audio chime & lock-screen alert triggered!');
                  }}
                  className="text-purple-600 hover:text-purple-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>🔔 Test Audio Chime</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    onNavigate('settings');
                  }}
                  className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                >
                  Notification Settings →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Profile Menu Popover */}
        {profileMenuOpen && (
          <div
            onClick={() => setProfileMenuOpen(false)}
            className="fixed inset-0 z-50 flex items-start justify-end pt-28 px-6 bg-black/20"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-72 p-2 space-y-1 animate-in zoom-in-95 duration-100 text-xs"
            >
              <div className="p-3 bg-purple-50 rounded-xl mb-1">
                <p className="font-extrabold text-purple-950">{currentBusiness.ownerName}</p>
                <p className="text-[11px] text-purple-700">{currentBusiness.name}</p>
                <p className="text-[10px] text-purple-600 font-mono mt-0.5">{currentBusiness.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onNavigate('profile');
                }}
                className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 text-left font-bold text-slate-700 flex items-center justify-between cursor-pointer"
              >
                <span>Storefront Profile</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onNavigate('settings');
                }}
                className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 text-left font-bold text-slate-700 flex items-center justify-between cursor-pointer"
              >
                <span>Account Settings</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onSwitchToCitizen();
                }}
                className="w-full px-3 py-2 rounded-xl hover:bg-indigo-50 text-left font-bold text-indigo-700 flex items-center justify-between cursor-pointer"
              >
                <span>Switch to Citizen App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onLockStorefront();
                }}
                className="w-full px-3 py-2 rounded-xl hover:bg-rose-50 text-left font-bold text-rose-600 flex items-center justify-between border-t border-slate-100 mt-1 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock & Sign Out</span>
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
