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

export const ServicesDashboard: React.FC<DashboardCommonProps> = ({
  onOpenModal,
  onOpenMerchantRegistration,
  onAskAi,
  searchQuery,
  currentLocation,
  selectedArea,
  liveIntel,
  marketplace: propMarketplace,
  onBookService,
}) => {
  const marketplace = propMarketplace || EMPTY_MARKETPLACE;

  const [selectedCat, setSelectedCat] = useState('All');
  const shortArea = selectedArea.split(',')[0]?.trim() || selectedArea;

  const serviceCats = [
    { label: 'All', icon: '⊞' },
    { label: 'Home Repair', icon: '🔧' },
    { label: 'Cleaning', icon: '🧹' },
    { label: 'Beauty & Salon', icon: '✂️' },
    { label: 'Tutoring', icon: '📚' },
    { label: 'Health', icon: '🏥' },
    { label: 'Moving', icon: '🚚' },
  ];

  const effectiveQuery = (searchQuery || '').trim().toLowerCase();
  const filteredServices = marketplace.services.filter((s) => {
    const matchesCat = selectedCat === 'All' || s.cat.toLowerCase().includes(selectedCat.toLowerCase());
    const matchesQuery =
      !effectiveQuery ||
      s.name.toLowerCase().includes(effectiveQuery) ||
      s.role.toLowerCase().includes(effectiveQuery) ||
      s.cat.toLowerCase().includes(effectiveQuery) ||
      (s.description && s.description.toLowerCase().includes(effectiveQuery));
    return matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-4">
      <HeroBanner
        dashboardId="services"
        tag={
          <>
            <MapPin className="w-3.5 h-3.5 text-blue-300" />
            <span>{selectedArea}</span>
          </>
        }
        title="Local Services"
        subtitle="Trusted people. Reliable services. Right in your area."
        description={`Book verified home professionals in ${shortArea} with transparent pricing and direct phone/WhatsApp contact.`}
        bottomPills={[
          { icon: <span>🛡️</span>, label: 'Verified professionals' },
          { icon: <span>📍</span>, label: `Local in ${shortArea}` },
          { icon: <span>⭐</span>, label: 'Ratings & reviews' },
          { icon: <span>⚡</span>, label: 'Instant Emergency Repair', onClick: () => setSelectedCat('Home Repair') },
        ]}
        askAiWidget={{
          placeholder: `Search for a service in ${shortArea}...`,
          chips: ['AC Repair', 'Electrician', 'Plumber', 'Deep Cleaning'],
          onAsk: (q) => onAskAi(`Find trusted local professionals for ${q} in ${selectedArea}`),
        }}
      />

      {/* Service Category Strip */}
      <div className="bg-white rounded-2xl p-3 shadow-card border border-slate-200/70 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        {serviceCats.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setSelectedCat(c.label)}
            className={`flex flex-col items-center gap-1.5 min-w-[82px] py-1.5 px-2 rounded-xl transition cursor-pointer ${
              selectedCat === c.label ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <span className="text-xl">{c.icon}</span>
            <span className="text-[10px] font-semibold whitespace-nowrap">{c.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content Split: Left (8 cols) + Right (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8 space-y-4">
          {/* Popular Services Near You */}
          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> Available Services in {shortArea} ({filteredServices.length})
                </h3>
                <p className="text-[11px] text-slate-500">Live verified doorstep professionals in {shortArea}</p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                ✓ 100% Background Verified
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {marketplace.loading ? (
                [1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-xl border border-slate-200/80 p-3 bg-white space-y-3 animate-pulse">
                    <div className="h-28 bg-slate-200 rounded-lg" />
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                    <div className="h-8 bg-slate-100 rounded-lg" />
                  </div>
                ))
              ) : filteredServices.length === 0 ? (
                <div className="col-span-full py-10 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                    🔧
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {effectiveQuery
                      ? `No services found matching "${effectiveQuery}" in ${shortArea}`
                      : `No service professionals listed in ${shortArea} yet`}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-3">
                    Are you a service technician, electrician, plumber, or tutor in this area? Offer your services to local residents.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenMerchantRegistration) {
                        onOpenMerchantRegistration();
                      } else {
                        onOpenModal({
                          title: 'Service Partner Onboarding',
                          subtitle: 'List your service on MyArea24',
                          category: 'Partner Registration',
                          description: 'Offer doorstep repair, cleaning, or health services directly to neighborhood customers.',
                        });
                      }
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm cursor-pointer"
                  >
                    🔧 Offer Your Services
                  </button>
                </div>
              ) : (
                filteredServices.map((srv) => (
                  <div
                    key={srv.id}
                    className="rounded-xl border border-slate-200/80 overflow-hidden bg-white flex flex-col justify-between hover:shadow-md transition"
                  >
                    <div>
                      <div className="relative h-28">
                        <img src={srv.img} alt={srv.name} className="w-full h-full object-cover" />
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-emerald-500 text-white text-[9px] font-bold">
                          {srv.dist} • {srv.exp}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <h4 className="text-xs font-extrabold text-slate-900 truncate">{srv.name}</h4>
                        <p className="text-[11px] text-amber-600 font-bold mt-0.5">
                          ★ {srv.rating} {srv.reviews}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">{srv.role}</p>
                        <p className="text-xs font-extrabold text-slate-900 mt-1">{srv.price}</p>
                        <p className="text-[10px] font-semibold text-emerald-600">{srv.avail}</p>
                      </div>
                    </div>
                    <div className="px-2.5 pb-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (onBookService) {
                            onBookService(srv);
                          } else {
                            onOpenModal({
                              title: srv.name,
                              subtitle: srv.role,
                              category: `${srv.cat} • Verified Local Pro`,
                              price: `${srv.price} (${srv.priceUnit})`,
                              rating: `${srv.rating} ${srv.reviews}`,
                              location: `${srv.dist} away in ${srv.locality}, ${srv.city}`,
                              description: `${srv.description}\n\n📞 Phone / WhatsApp: ${srv.phone}\n🕒 Hours: ${srv.timing}`,
                              primaryActionLabel: `Call ${srv.phone}`,
                              image: srv.img,
                              phone: srv.phone,
                              whatsapp: srv.phone,
                              address: `${srv.locality}, ${srv.city}`,
                              source: 'Verified Neighborhood Pro',
                              verified: true,
                              freshnessLabel: srv.avail || 'Available for Work',
                            });
                          }
                        }}
                        className="w-full py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-xs font-bold transition cursor-pointer"
                      >
                        Book / Call Now
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Featured Local Professionals */}
          {marketplace.services.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" /> Direct-Call Local Professionals ({shortArea})
                  </h3>
                  <p className="text-[11px] text-slate-500">Background-verified specialists in {selectedArea}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {marketplace.services.slice(0, 3).map((pro) => (
                  <div key={pro.id} className="p-3 rounded-xl border border-slate-200/80 flex flex-col justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <img src={pro.img} alt={pro.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-extrabold text-slate-900 truncate">{pro.name}</h4>
                        <p className="text-[10px] text-amber-600 font-bold">
                          ★ {pro.rating} {pro.reviews}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">📍 {pro.locality} ({pro.dist})</p>
                        <p className="text-[10px] text-slate-500 truncate">🔧 {pro.cat}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenModal({
                          title: `Contact ${pro.name}`,
                          subtitle: pro.role,
                          category: 'Verified Professional',
                          rating: `${pro.rating} ${pro.reviews}`,
                          location: `${pro.locality}, ${pro.city}`,
                          description: `${pro.description}\nDirect Phone / WhatsApp: ${pro.phone}`,
                          primaryActionLabel: `Call ${pro.phone}`,
                          image: pro.img,
                          phone: pro.phone,
                          whatsapp: pro.phone,
                          address: `${pro.locality}, ${pro.city}`,
                          source: 'Verified Professional',
                          verified: true,
                          freshnessLabel: 'Active Service Provider',
                        })
                      }
                      className="w-full py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Phone className="w-3 h-3" /> Contact ({pro.phone})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Map + AI Recommendations */}
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">Service Providers Near {shortArea}</h3>
            </div>
            <InteractiveMap
              heightClass="h-56"
              centerLabel={selectedArea}
              centerCoords={{ lat: liveIntel.location.lat, lng: liveIntel.location.lng }}
              pois={liveIntel.nearbyPois}
            />
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-extrabold text-slate-900">AI Service Insights ({shortArea})</h3>
              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold">LIVE</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Based on {shortArea} weather ({liveIntel.weather.temperatureC}°C) and local demand
            </p>
            <div className="space-y-2.5">
              {[
                { icon: '❄️', title: `AC servicing in ${shortArea}`, sub: `Current temp is ${liveIntel.weather.temperatureC}°C — book same-day slot` },
                { icon: '🧹', title: `Deep cleaning services in ${shortArea}`, sub: 'Top rated providers with eco-friendly supplies' },
                { icon: '⚡', title: `Emergency electricians in ${shortArea}`, sub: 'Verified technicians within 1 km' },
                { icon: '🚰', title: `Plumbing & water motor repair`, sub: 'Same-day visit across your block' },
              ].map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => onAskAi(item.title)}
                  className="w-full p-2.5 rounded-xl border border-slate-200/70 hover:border-indigo-300 flex items-center justify-between gap-2 text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg">{item.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                      <p className="text-[10px] text-slate-500 truncate">{item.sub}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

