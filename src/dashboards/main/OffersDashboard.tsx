import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DashboardId, ActionModalData, SavedEntry } from '../../types';
import { HeroBanner } from '../../components/HeroBanner';
import { InteractiveMap } from '../../components/InteractiveMap';
import { LiveAreaIntelligence } from '../../services/liveIntelligence';
import { UserLocation } from '../../components/LocationPickerModal';
import {
  LiveCommunityMarketplaceState,
  LiveProductItem,
  LiveBusinessItem,
  searchProductsOnBackend,
  searchBusinessesOnBackend,
} from '../../services/communityMarketplaceService';
import { getStoredAuthUser } from '../../services/authService';
import {
  MapPin,
  Sun,
  CloudRain,
  Wind,
  Droplets,
  Car,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Heart,
  Bookmark,
  Star,
  Clock,
  Calendar,
  Utensils,
  Coffee,
  ShoppingBag,
  Hospital,
  GraduationCap,
  Trees,
  CreditCard,
  Dumbbell,
  Scissors,
  Landmark,
  MoreHorizontal,
  ShieldCheck,
  Radio,
  MessageSquare,
  Plus,
  Minus,
  Check,
  Wrench,
  Gift,
  Bell,
  Search,
  Fuel,
  TrendingUp,
  Phone,
  Copy,
  Store,
  X,
  Zap,
  MessageCircle,
  CheckCircle2,
} from 'lucide-react';
import { BusinessCard } from '../../components/BusinessCard';
import { ProductCard } from '../../components/ProductCard';
import { AlertBanner } from '../../components/AlertBanner';
import { DashboardCommonProps, EMPTY_MARKETPLACE } from './types';

export const OffersDashboard: React.FC<DashboardCommonProps> = ({
  onNavigate,
  onOpenMerchantRegistration,
  onOpenModal,
  onAskAi,
  savedIds,
  onToggleSave,
  selectedArea,
  liveIntel,
  marketplace: propMarketplace,
}) => {
  const marketplace = propMarketplace || EMPTY_MARKETPLACE;

  const [selectedCat, setSelectedCat] = useState('All Offers');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const shortArea = selectedArea.split(',')[0]?.trim() || selectedArea;

  const offerCats = [
    { label: 'All Offers', icon: '⊞' },
    { label: 'Food & Dining', icon: '🍴' },
    { label: 'Groceries', icon: '🛍️' },
    { label: 'Salon & Spa', icon: '✂️' },
    { label: 'Fitness & Health', icon: '🏋️' },
    { label: 'Services', icon: '🔧' },
  ];

  const filteredOffers = marketplace.offers.filter(
    (o) => selectedCat === 'All Offers' || o.cat.toLowerCase().includes(selectedCat.toLowerCase())
  );

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2200);
  };

  return (
    <div className="space-y-4">
      <HeroBanner
        dashboardId="offers"
        tag={
          <>
            <MapPin className="w-3.5 h-3.5 text-blue-300" />
            <span>{selectedArea}</span>
          </>
        }
        title="Best Local Offers"
        subtitle="Save more. Explore more. Support local."
        description={`Exclusive verified deals and instant coupon codes from businesses in ${shortArea}.`}
        bottomPills={[
          { icon: <span>🛡️</span>, label: 'Verified offers' },
          { icon: <span>🏪</span>, label: `Local stores in ${shortArea}` },
          { icon: <span>⚡</span>, label: 'Instant Coupon Redemption', onClick: () => setSelectedCat('All Offers') },
        ]}
        rightWidget={
          <div className="w-full lg:w-[340px] bg-white/12 backdrop-blur-md border border-white/20 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-pink-500/30 border border-pink-300/40 flex items-center justify-center">
                <Gift className="w-5 h-5 text-pink-200" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-white">Local Neighborhood Savings</p>
                <p className="text-[11px] text-blue-100/85">
                  Exclusive in-store discounts, BOGO & coupons across {shortArea}.
                </p>
              </div>
            </div>
            <div className="pt-2.5 border-t border-white/15 flex items-center justify-between text-[11px] font-semibold text-blue-100">
              <span>🎟️ Verified Promos</span>
              <span>⚡ Direct Walk-in</span>
              <span>💰 Zero Convenience Fee</span>
            </div>
          </div>
        }
      />

      {/* Category Strip */}
      <div className="bg-white rounded-2xl p-2.5 shadow-card border border-slate-200/70 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        {offerCats.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setSelectedCat(c.label)}
            className={`flex flex-col items-center gap-1 min-w-[95px] py-1.5 px-2 rounded-xl transition cursor-pointer ${
              selectedCat === c.label
                ? 'bg-blue-600 text-white shadow-sm'
                : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <span className="text-base">{c.icon}</span>
            <span className="text-[10px] font-semibold whitespace-nowrap">{c.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8 space-y-4">
          {/* Trending Offers Near You */}
          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <span>🔥</span> Live Offers in {shortArea} ({filteredOffers.length})
              </h3>
              <span className="text-xs font-semibold text-emerald-600">● Instant Coupon Redemption</span>
            </div>

            {marketplace.loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-xl border border-slate-200/80 p-3 bg-white space-y-3 animate-pulse">
                    <div className="h-28 bg-slate-200 rounded-lg" />
                    <div className="h-3 bg-slate-200 rounded w-1/3" />
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                    <div className="h-8 bg-slate-100 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : filteredOffers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {filteredOffers.map((off) => {
                  const isSaved = savedIds.includes(off.id);
                  return (
                    <div
                      key={off.id}
                      className="rounded-xl border border-slate-200/80 overflow-hidden bg-white flex flex-col justify-between hover:shadow-md transition"
                    >
                      <div>
                        <div className="relative h-28">
                          <img src={off.img} alt={off.store} className="w-full h-full object-cover" />
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-rose-600 text-white text-[9px] font-extrabold shadow">
                            {off.badge}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onToggleSave({
                                id: off.id,
                                title: `${off.store} — ${off.badge}`,
                                subtitle: off.title,
                                category: 'Offers',
                                meta: off.dist,
                                image: off.img,
                                savedAt: 'Just now',
                              })
                            }
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 text-white flex items-center justify-center"
                          >
                            <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-rose-500 text-rose-500' : ''}`} />
                          </button>
                        </div>
                        <div className="p-2.5">
                          <p className="text-[10px] font-bold text-slate-500 truncate">{off.store}</p>
                          <h4 className="text-xs font-extrabold text-slate-900 line-clamp-2 mt-0.5">{off.title}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{off.sub}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-semibold">
                              {off.cat}
                            </span>
                            <span className="text-[10px] text-rose-600 font-bold">⏳ {off.valid}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">📍 {off.dist} away</p>
                        </div>
                      </div>
                      <div className="px-2.5 pb-2.5 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(off.code)}
                          className="w-full py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-extrabold flex items-center justify-between cursor-pointer"
                        >
                          <span>Code: {off.code}</span>
                          <span className="text-indigo-600 flex items-center gap-0.5">
                            <Copy className="w-3 h-3" /> {copiedCode === off.code ? 'Copied!' : 'Copy'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenModal({
                              title: `${off.store}: ${off.title}`,
                              subtitle: off.sub,
                              category: `${off.cat} • Code: ${off.code}`,
                              badge: off.badge,
                              location: `${off.dist} away • ${off.storeAddress}`,
                              description: `${off.description}\n\nCoupon Code: ${off.code} (${off.valid})\nStore Contact: ${off.phone}`,
                              primaryActionLabel: `Redeem Code ${off.code}`,
                              image: off.img,
                              phone: off.phone,
                              whatsapp: off.phone,
                              address: off.storeAddress,
                              source: 'Local Merchant Deal',
                              verified: true,
                              freshnessLabel: off.valid || 'Active Promotion',
                            })
                          }
                          className="w-full py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-xs font-bold transition cursor-pointer"
                        >
                          View & Redeem
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 px-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">No active deals in {shortArea}</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Authentic merchant offers appear here once submitted and verified for this location.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onOpenMerchantRegistration}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Post an Offer
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('home')}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">Offers Around {shortArea}</h3>
            </div>
            <InteractiveMap
              heightClass="h-52"
              centerLabel={selectedArea}
              centerCoords={{ lat: liveIntel.location.lat, lng: liveIntel.location.lng }}
              pois={liveIntel.nearbyPois}
            />
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-extrabold text-slate-900">AI Recommended Deals ({shortArea})</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Based on your location and active merchant promos</p>
            <div className="space-y-2">
              {[
                { icon: '🍴', title: `Best food deals in ${shortArea}`, sub: 'Up to 50% OFF at nearby restaurants' },
                { icon: '✂️', title: `Salon offers in ${shortArea}`, sub: 'Popular grooming packages nearby' },
                { icon: '🏋️', title: `Gym memberships with discounts`, sub: 'Free trial + annual savings' },
                { icon: '🛍️', title: `Deals on daily essentials`, sub: 'Compare local supermarket vs online' },
              ].map((rec) => (
                <button
                  key={rec.title}
                  type="button"
                  onClick={() => onAskAi(rec.title)}
                  className="w-full p-2.5 rounded-xl border border-slate-200/70 hover:border-indigo-300 flex items-center justify-between gap-2 text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{rec.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{rec.title}</p>
                      <p className="text-[10px] text-slate-500">{rec.sub}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

