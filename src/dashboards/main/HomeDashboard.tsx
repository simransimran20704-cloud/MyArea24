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

  ShieldAlert,

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

  AlertCircle,

} from 'lucide-react';

import { BusinessCard } from '../../components/BusinessCard';

import { ProductCard } from '../../components/ProductCard';

import { AlertBanner } from '../../components/AlertBanner';

import { DashboardCommonProps, EMPTY_MARKETPLACE } from './types';



export const HomeDashboard: React.FC<DashboardCommonProps> = ({

  onNavigate,

  onOpenModal,

  onAskAi,

  savedIds,

  onToggleSave,

  selectedArea,

  currentLocation,

  liveIntel,

  marketplace: propMarketplace,

  onOpenLocationPicker,

  onAddToCart,

  onBookService,

  onOpenCart,

  onOpenMerchantRegistration,

}) => {

  const marketplace = propMarketplace || EMPTY_MARKETPLACE;

  const { weather, airQuality, traffic, mandiRates, fuelRates } = liveIntel;

  const shortArea = selectedArea.split(',')[0]?.trim() || selectedArea;



  const [activeStoreFilter, setActiveStoreFilter] = useState<'all' | 'open' | 'kirana' | 'pharmacy'>('all');

  const [heroSearch, setHeroSearch] = useState('');

  const [copiedCode, setCopiedCode] = useState<string | null>(null);



  // Filter stores based on active pill

  const filteredStores = marketplace.businesses.filter((b) => {

    if (activeStoreFilter === 'open') return b.status === 'Open';

    if (activeStoreFilter === 'kirana') {

      const c = b.cat.toLowerCase();

      return c.includes('grocer') || c.includes('kirana') || c.includes('market') || c.includes('supermarket');

    }

    if (activeStoreFilter === 'pharmacy') {

      const c = b.cat.toLowerCase();

      return c.includes('pharm') || c.includes('health') || c.includes('medic') || c.includes('chemist');

    }

    return true;

  });



  const handleHeroSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!heroSearch.trim()) return;
    if (marketplace.products.length > 0) {
      onNavigate('products', { q: heroSearch.trim() });
    } else {
      onNavigate('businesses', { q: heroSearch.trim() });
    }
  };



  return (

    <div className="space-y-4 pb-12">
      {/* 1. TOP HYPERLOCAL TRUST & SPEED RIBBON */}
      <div className="bg-white border border-slate-200 rounded-xl py-2 px-4 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2 shadow-card">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-semibold text-slate-900">15–25m Express Delivery</span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="hidden sm:inline text-slate-500">From neighborhood Kiranas in {shortArea}</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
          <span className="flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-slate-400" /> ₹0 In-Store Pickup Fee
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp 1-Click Orders
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Verified Merchants
          </span>
        </div>
      </div>

      {/* Hyperlocal Live Loading / Sync Status */}
      {marketplace.loading && (
        <div className="flex items-center justify-between p-3 bg-blue-50/80 border border-blue-200/70 rounded-xl text-blue-800 text-xs shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="font-medium">Discovering live neighborhood inventory & services in {shortArea}...</span>
          </div>
          <span className="text-[11px] text-blue-600 font-semibold hidden sm:inline">Hyperlocal Discovery</span>
        </div>
      )}

      {marketplace.error && (
        <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{marketplace.error}</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-[11px] transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. AUTHENTIC MARKETPLACE HERO BANNER */}
      <div className="relative rounded-xl overflow-hidden bg-slate-900 text-white p-5 sm:p-7 shadow-card border border-slate-800">
        <div className="relative z-10 max-w-3xl">
          {/* Location Selector Pill */}
          <button
            type="button"
            onClick={() => onOpenLocationPicker?.()}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition cursor-pointer mb-3"
          >
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-white">{selectedArea}</span>
            <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-semibold">Change ›</span>
          </button>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-white">
            Everything in your neighborhood, <br className="hidden sm:block" />
            <span className="text-blue-400">delivered to your door.</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-xl font-normal leading-relaxed">
            Order fresh daily groceries, milk, medicines, fresh fruits, and book trusted doorstep home repair from verified stores in {shortArea}.
          </p>

          {/* Quick Search Bar */}
          <form onSubmit={handleHeroSearchSubmit} className="mt-4 flex items-center bg-white rounded-lg p-1 shadow-sm border border-slate-200 max-w-xl">
            <Search className="w-4 h-4 text-slate-400 ml-2.5 shrink-0" />
            <input
              type="text"
              value={heroSearch}
              onChange={(e) => setHeroSearch(e.target.value)}
              placeholder="Search 'Amul milk', 'Aashirvaad Atta', 'Dolo 650', 'Plumber'..."
              className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 px-3 py-1 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer shrink-0 shadow-xs active:scale-95"
            >
              Search
            </button>
          </form>

          {/* Popular Search Chips */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className="text-xs font-medium text-slate-400 mr-1">Trending:</span>
            {(marketplace.products.length > 0
              ? ['Amul Milk', 'Atta & Rice', 'Dolo 650', 'Fortune Oil', 'Fresh Veggies']
              : ['Grocery Stores', 'Pharmacies', 'Cafes & Dining', 'Electronics', 'Local Mandi']
            ).map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  if (marketplace.products.length > 0) {
                    onNavigate('products', { q: chip });
                  } else {
                    onNavigate('businesses', { q: chip });
                  }
                }}
                className="px-2.5 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* 4 Trust Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5 pt-4 border-t border-slate-800 text-xs font-medium text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
              <span>{marketplace.businesses.length || '80+'}+ Stores Active</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </span>
              <span>15–25m Delivery</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-3.5 h-3.5" />
              </span>
              <span>₹0 Pickup Fee</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                <Star className="w-3.5 h-3.5" />
              </span>
              <span>4.8/5 Star Rating</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. COMPACT NEIGHBORHOOD PULSE RIBBON */}
      <div className="bg-white rounded-xl p-4 shadow-card border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sun className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                Neighborhood Pulse • {shortArea}
              </h3>
              <p className="text-[11px] text-slate-500">Live environmental & mobility indicators</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('intelligence')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
          >
            <span>Full Intelligence</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-0.5 text-xs">
          {/* Weather */}
          <div
            onClick={() => onNavigate('weather')}
            className="cursor-pointer p-3 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Weather</span>
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <p className="text-base font-bold text-slate-900 mt-1">{weather.temperatureC}°C</p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{weather.conditionText}</p>
          </div>

          {/* AQI */}
          <div
            onClick={() => onNavigate('air-quality')}
            className="cursor-pointer p-3 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Air Quality</span>
              <Wind className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-base font-bold text-slate-900 mt-1">AQI {airQuality.aqiValue}</p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{airQuality.aqiCategory}</p>
          </div>

          {/* Traffic */}
          <div
            onClick={() => onNavigate('traffic')}
            className="cursor-pointer p-3 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Traffic</span>
              <Car className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-base font-bold text-slate-900 mt-1">{traffic.congestionLevel}</p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{traffic.averageSpeedKmh} km/h avg</p>
          </div>

          {/* Fuel */}
          <div
            onClick={() => onNavigate('fuel-rates')}
            className="cursor-pointer p-3 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Petrol ({fuelRates.city})</span>
              <Fuel className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <p className="text-base font-bold text-slate-900 mt-1">₹{fuelRates.petrol > 0 ? fuelRates.petrol.toFixed(2) : '94.72'}/L</p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">Diesel: ₹{fuelRates.diesel > 0 ? fuelRates.diesel.toFixed(2) : '87.62'}</p>
          </div>

          {/* Mandi */}
          <div
            onClick={() => onNavigate('market-rates')}
            className="col-span-2 sm:col-span-1 cursor-pointer p-3 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Mandi Daily</span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <p className="text-base font-bold text-slate-900 mt-1">
              {mandiRates[0] ? `₹${mandiRates[0].pricePerKg}/${mandiRates[0].unit}` : '₹35/kg'}
            </p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {mandiRates[0] ? mandiRates[0].commodity : 'Onion / Potato'}
            </p>
          </div>
        </div>
      </div>



      {/* 4. VISUAL CATEGORY GRID */}
      <div className="bg-white rounded-xl p-4 shadow-card border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">Explore Categories</h3>
          <span className="text-xs text-slate-400 font-medium">8 Quick Sections</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {(() => {
            const hasProds = marketplace.products.length > 0;
            const hasSvcs = marketplace.services.length > 0;
            const hasOffers = marketplace.offers.length > 0;

            const allCategories: Array<{
              name: string;
              icon: string;
              desc: string;
              cat: string;
              route: DashboardId;
              show: boolean;
            }> = [
              { name: 'Dairy & Bread', icon: '🥛', desc: 'Milk, Eggs, Butter', cat: 'Dairy & Eggs', route: 'products', show: hasProds },
              { name: 'Daily Kirana', icon: '🛒', desc: 'Atta, Dal, Oil, Rice', cat: 'Groceries', route: hasProds ? 'products' : 'businesses', show: true },
              { name: 'Chemist & Meds', icon: '💊', desc: 'Medicines & Care', cat: 'Pharmacies', route: hasProds ? 'products' : 'businesses', show: true },
              { name: 'Fresh Mandi', icon: '🥦', desc: 'Veggies & Fruits', cat: 'Produce', route: hasProds ? 'products' : 'market-rates', show: true },
              { name: 'Mobile & Tech', icon: '📱', desc: 'Accessories & Repair', cat: 'Electronics', route: hasProds ? 'products' : 'businesses', show: true },
              { name: 'Doorstep Repair', icon: '🔧', desc: 'Home Technicians', cat: 'All', route: 'services', show: hasSvcs },
              { name: 'Cafes & Dining', icon: '☕', desc: 'Chai, Sweets & Meals', cat: 'Restaurants', route: 'businesses', show: true },
              { name: 'Offers & Deals', icon: '🏷️', desc: 'Local Discounts', cat: 'All', route: 'offers', show: hasOffers },
              { name: 'Explore Map', icon: '🗺️', desc: 'Interactive Map', cat: 'All', route: 'map', show: !hasProds && !hasSvcs },
              { name: 'Weather & AQI', icon: '⛅', desc: 'Live Forecast', cat: 'All', route: 'weather', show: !hasProds && !hasOffers },
            ];

            return allCategories
              .filter((item) => item.show)
              .slice(0, 8)
              .map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onNavigate(item.route as DashboardId, item.cat !== 'All' ? { cat: item.cat } : undefined)}
                  className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition text-center group cursor-pointer flex flex-col items-center justify-center"
                >
                  <span className="text-xl group-hover:scale-105 transition duration-200">{item.icon}</span>
                  <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition mt-1.5 leading-tight">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{item.desc}</span>
                </button>
              ));
          })()}
        </div>
      </div>

      {/* 5. DAILY ESSENTIALS FROM NEARBY KIRANAS (Only shown when user-submitted listings exist) */}
      {marketplace.products.length > 0 && (
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-card border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Daily Essentials Near You</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                  Direct Kirana Rates
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Save 15–30% vs quick-commerce apps by buying directly from local neighbourhood shops.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
            >
              <span>View All ({marketplace.products.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {marketplace.products.slice(0, 8).map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onAddToCart={onAddToCart}
                onOpenModal={onOpenModal}
                onNavigateProduct={(id) => onNavigate('products', { q: id })}
              />
            ))}
          </div>
        </div>
      )}

      {/* 6. TOP RATED STORES IN AREA */}
      <div className="bg-white rounded-xl p-4 sm:p-5 shadow-card border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Top Rated Stores in {shortArea}</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold">
                {marketplace.businesses.length} Verified
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Walk in or order delivery from your trusted neighborhood merchants.
            </p>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'All Stores' },
              { id: 'open', label: 'Open Now' },
              { id: 'kirana', label: 'Kirana & Grocery' },
              { id: 'pharmacy', label: 'Pharmacies' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveStoreFilter(chip.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                  activeStoreFilter === chip.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {filteredStores.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredStores.slice(0, 6).map((b) => (
              <BusinessCard
                key={b.id}
                business={b}
                isSaved={savedIds.includes(b.id)}
                onToggleSave={onToggleSave}
                onOpenModal={onOpenModal}
              />
            ))}
          </div>
        ) : (
          <div className="py-8 px-5 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 space-y-1">
            <h4 className="text-xs font-bold text-slate-700">No verified stores registered in this immediate area yet.</h4>
            <p className="text-[11px] text-slate-400">Stores appear automatically once verified.</p>
          </div>
        )}
      </div>

      {/* 7. EXCLUSIVE LOCAL OFFERS & DEALS (Only shown when valid user-submitted listings exist) */}
      {marketplace.offers.length > 0 && (
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-card border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Exclusive Offers & Deals</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-semibold">
                  {marketplace.offers.length} Active Deals
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified neighborhood discounts and instant coupon codes in {shortArea}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('offers')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
            >
              <span>View All Offers ({marketplace.offers.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {marketplace.offers.slice(0, 4).map((off) => {
              const isSaved = savedIds.includes(off.id);
              return (
                <div
                  key={off.id}
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between hover:border-slate-300 hover:shadow-sm transition"
                >
                  <div>
                    <div className="relative h-28 bg-slate-100">
                      <img src={off.img} alt={off.store} className="w-full h-full object-cover" />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold shadow-sm">
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
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white flex items-center justify-center transition"
                      >
                        <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                    </div>
                    <div className="p-3">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide truncate">{off.store}</p>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mt-0.5">{off.title}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{off.sub || off.description}</p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {off.cat}
                        </span>
                        <span className="text-[10px] font-semibold text-rose-600">⏳ {off.valid}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 pt-0 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(off.code);
                        setCopiedCode(off.code);
                        setTimeout(() => setCopiedCode(null), 2000);
                      }}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-between transition cursor-pointer"
                    >
                      <span className="font-mono text-[11px]">Code: {off.code}</span>
                      <span className="text-blue-600 flex items-center gap-1 text-[11px]">
                        <Copy className="w-3 h-3" />
                        {copiedCode === off.code ? 'Copied!' : 'Copy'}
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
                      className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      View & Redeem
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. VERIFIED DOORSTEP TECHNICIANS & SERVICES (Only shown when user-submitted listings exist) */}
      {marketplace.services.length > 0 && (
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-card border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Verified Services Near You</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold">
                  Verified Listings
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Local doorstep services in {shortArea}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('services')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
            >
              <span>View All Services ({marketplace.services.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {marketplace.services.slice(0, 4).map((srv) => (
              <div
                key={srv.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-blue-300 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900">{srv.name}</span>
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                      {srv.cat}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{srv.role || srv.description}</p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{srv.price}</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('services')}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Book Now →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. 24×7 CITIZEN HELPLINE & EMERGENCY RIBBON */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-card border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">24×7 Emergency Assistance</span>
                <span className="px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300 text-[10px] font-semibold">Instant Dial</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Official civic helplines and 24-hour medical resources in {shortArea}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href="tel:112"
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Police (112)</span>
            </a>
            <a
              href="tel:108"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-medium flex items-center gap-1.5 transition"
            >
              <span>Ambulance (108)</span>
            </a>
            <button
              type="button"
              onClick={() => onNavigate('emergency')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>24h Pharmacies ›</span>
            </button>
          </div>
        </div>
      </div>

      {/* 9. FLOATING SAATHI AI ASSISTANT PILL */}
      <button
        type="button"
        onClick={() => onAskAi(`Hi Saathi, what are the best local stores and services open in ${shortArea} right now?`)}
        className="fixed bottom-20 lg:bottom-6 right-6 z-40 px-3.5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 shadow-lg border border-slate-700 hover:scale-105 active:scale-95 transition cursor-pointer"
        title="Ask Saathi AI Assistant"
      >
        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
        <span>Ask Saathi AI</span>
      </button>

    </div>

  );

};



