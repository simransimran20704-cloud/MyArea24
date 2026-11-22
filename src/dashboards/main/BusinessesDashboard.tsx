import React, { useState, useEffect, useMemo } from 'react';

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



export const BusinessesDashboard: React.FC<DashboardCommonProps> = ({

  onNavigate,

  onOpenMerchantRegistration,

  onOpenModal,

  onAskAi,

  savedIds,

  onToggleSave,

  searchQuery,

  currentLocation,

  selectedArea,

  liveIntel,

  marketplace: propMarketplace,

}) => {

  const marketplace = propMarketplace || EMPTY_MARKETPLACE;



  const [searchParams, setSearchParams] = useSearchParams();

  const urlCat = searchParams.get('cat') || 'All';

  const [selectedCat, setSelectedCat] = useState(urlCat);



  useEffect(() => {

    if (urlCat !== selectedCat) {

      setSelectedCat(urlCat);

    }

  }, [urlCat]);



  const handleSelectCategory = (cat: string) => {

    setSelectedCat(cat);

    const next = new URLSearchParams(searchParams);

    if (cat === 'All') {

      next.delete('cat');

    } else {

      next.set('cat', cat);

    }

    setSearchParams(next, { replace: true });

  };



  const [localSearch, setLocalSearch] = useState(searchQuery || '');

  const [openNowOnly, setOpenNowOnly] = useState(false);

  const [sortBy, setSortBy] = useState<'Nearest' | 'Top Rated' | 'Relevance'>('Nearest');

  const [minRating, setMinRating] = useState<'Any' | '4.5+' | '4.0+'>('Any');



  const [serverBusinesses, setServerBusinesses] = useState<LiveBusinessItem[] | null>(null);

  const [isSearchingServer, setIsSearchingServer] = useState(false);



  useEffect(() => {

    const q = (searchQuery || searchParams.get('q') || '').trim();

    if (q !== localSearch) {

      setLocalSearch(q);

    }

  }, [searchQuery, searchParams]);



  useEffect(() => {

    const q = localSearch.trim();

    if (!q || q.length < 2) {

      setServerBusinesses(null);

      return;

    }

    let cancelled = false;

    const timer = setTimeout(async () => {

      setIsSearchingServer(true);

      try {

        const results = await searchBusinessesOnBackend({

          q,

          category: selectedCat !== 'All' ? selectedCat : undefined,

          pincode: currentLocation?.pincode,

          locality: selectedArea.split(',')[0]?.trim(),

          city: selectedArea.split(',')[1]?.trim(),

          userLat: currentLocation?.coords?.lat,

          userLon: currentLocation?.coords?.lng,

          pageSize: 30,

        });

        if (!cancelled) {

          setServerBusinesses(results);

        }

      } catch (err) {

        // Fallback to local

      } finally {

        if (!cancelled) setIsSearchingServer(false);

      }

    }, 300);



    return () => {

      cancelled = true;

      clearTimeout(timer);

    };

  }, [localSearch, selectedCat, currentLocation, selectedArea]);



  const shortArea = selectedArea.split(',')[0]?.trim() || selectedArea;



  const categories = [

    'All',

    'Restaurants',

    'Cafés',

    'Groceries',

    'Pharmacies',

    'Electronics',

    'Fitness',

    'Salons',

    'Services',

  ];



  const baseBizList = useMemo(() => {
    const primary = serverBusinesses !== null ? serverBusinesses : marketplace.businesses;
    return primary;
  }, [serverBusinesses, marketplace.businesses]);

  const filteredBiz = baseBizList

    .filter((b) => {

      const matchesCat =

        selectedCat === 'All' ||

        b.cat.toLowerCase().includes(selectedCat.toLowerCase()) ||

        selectedCat.toLowerCase().includes(b.cat.toLowerCase());

      const matchesQuery =

        !localSearch ||

        b.name.toLowerCase().includes(localSearch.toLowerCase()) ||

        b.sub.toLowerCase().includes(localSearch.toLowerCase()) ||

        b.cat.toLowerCase().includes(localSearch.toLowerCase());

      const numRating = parseFloat(b.rating);

      const matchesRating =

        minRating === 'Any' || (minRating === '4.5+' ? numRating >= 4.5 : numRating >= 4.0);

      const matchesOpen = !openNowOnly || b.status === 'Open';

      return matchesCat && matchesQuery && matchesRating && matchesOpen;

    })

    .sort((a, b) => {

      if (sortBy === 'Top Rated') return parseFloat(b.rating) - parseFloat(a.rating);

      if (sortBy === 'Nearest') return a.distanceKm - b.distanceKm;

      return 0;

    });



  const browseGrid = [

    { name: 'Restaurants', count: 'Verified & Open', icon: Utensils, color: 'bg-orange-50 text-orange-600' },

    { name: 'Cafés', count: 'Work & Hangout', icon: Coffee, color: 'bg-amber-50 text-amber-600' },

    { name: 'Groceries', count: 'Supermarkets & Mandi', icon: ShoppingBag, color: 'bg-violet-50 text-violet-600' },

    { name: 'Pharmacies', count: '24×7 Chemists', icon: Hospital, color: 'bg-rose-50 text-rose-600' },

    { name: 'Electronics', count: 'Mobiles & Repair', icon: GraduationCap, color: 'bg-blue-50 text-blue-600' },

    { name: 'Fitness', count: 'Gyms & Arenas', icon: Dumbbell, color: 'bg-indigo-50 text-indigo-600' },

    { name: 'Salons', count: 'Grooming & Spa', icon: Scissors, color: 'bg-pink-50 text-pink-600' },

    { name: 'Services', count: 'Home & Utility', icon: Wrench, color: 'bg-teal-50 text-teal-600' },

    { name: 'All', count: `${marketplace.businesses.length} discovered`, icon: MoreHorizontal, color: 'bg-slate-100 text-slate-600' },

  ];



  return (

    <div className="space-y-4">

      <HeroBanner

        dashboardId="businesses"

        tag={

          <>

            <MapPin className="w-3.5 h-3.5 text-blue-300" />

            <span>Businesses in {selectedArea}</span>

          </>

        }

        title="Discover Local Businesses"

        subtitle="Real places. Real people. Right around you."

        description={`Verified neighborhood merchant storefronts & local commercial directory around ${shortArea} (${marketplace.businesses.length} active listings).`}

        rightWidget={

          <div className="flex flex-col gap-2.5 w-full lg:w-[360px]">

            <div className="grid grid-cols-2 gap-2">

              {[

                { icon: ShieldCheck, title: 'Verified Directory', sub: `${marketplace.businesses.length} nearby places`, cls: 'text-blue-300' },

                { icon: Radio, title: 'Live Status', sub: 'Open/Closed & distance', cls: 'text-emerald-300' },

                { icon: MessageSquare, title: 'Direct Call', sub: 'Zero middleman commission', cls: 'text-amber-300' },

                { icon: Sparkles, title: 'AI Discovery', sub: `Grounded in ${shortArea}`, cls: 'text-purple-300' },

              ].map((feat) => (

                <div

                  key={feat.title}

                  className="bg-slate-900/50 backdrop-blur-md border border-white/15 rounded-xl p-2.5 flex items-center gap-2.5"

                >

                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">

                    <feat.icon className={`w-4 h-4 ${feat.cls}`} />

                  </div>

                  <div className="min-w-0">

                    <p className="text-xs font-bold text-white truncate">{feat.title}</p>

                    <p className="text-[10px] text-blue-100/80 truncate">{feat.sub}</p>

                  </div>

                </div>

              ))}

            </div>

          </div>

        }

      />



      {/* Category Pills Strip */}

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">

        {categories.map((cat) => (

          <button

            key={cat}

            type="button"

            onClick={() => handleSelectCategory(cat)}

            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition border cursor-pointer ${

              selectedCat === cat

                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'

                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'

            }`}

          >

            {cat}

          </button>

        ))}

      </div>



      {/* Search & Filters Bar */}

      <div className="bg-white rounded-xl p-2.5 shadow-card border border-slate-200/70 flex flex-wrap items-center gap-2.5">

        <div className="flex-1 min-w-[200px] flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70">

          <Search className="w-4 h-4 text-slate-400" />

          <input

            type="text"

            value={localSearch}

            onChange={(e) => setLocalSearch(e.target.value)}

            placeholder={`Search ${marketplace.businesses.length} businesses in ${shortArea} (e.g. cafe, chemist, mart)...`}

            className="bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none w-full"

          />

        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">

          <button

            type="button"

            onClick={() =>

              setSortBy((prev) =>

                prev === 'Nearest' ? 'Top Rated' : prev === 'Top Rated' ? 'Relevance' : 'Nearest'

              )

            }

            className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 font-medium text-slate-700 transition cursor-pointer"

          >

            <span className="text-slate-400 mr-1">Sort by:</span>{' '}

            <strong className="text-slate-800">{sortBy}</strong> ⌄

          </button>

          <button

            type="button"

            onClick={() =>

              setMinRating((prev) => (prev === 'Any' ? '4.5+' : prev === '4.5+' ? '4.0+' : 'Any'))

            }

            className={`px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer ${

              minRating !== 'Any'

                ? 'bg-amber-50 border-amber-200 text-amber-800 font-bold'

                : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700'

            }`}

          >

            <span className="text-slate-400 mr-1">Rating:</span> {minRating} ⌄

          </button>

          <button

            type="button"

            onClick={() => setOpenNowOnly((v) => !v)}

            className={`px-3 py-1.5 rounded-lg border font-semibold transition cursor-pointer ${

              openNowOnly

                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'

                : 'bg-slate-50 border-slate-200/80 text-slate-700'

            }`}

          >

            {openNowOnly ? '● Open Now' : 'Open Now'}

          </button>

          {(selectedCat !== 'All' || localSearch || minRating !== 'Any') && (

            <button

              type="button"

              onClick={() => {

                setSelectedCat('All');

                setLocalSearch('');

                setMinRating('Any');

              }}

              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 font-semibold text-rose-600 text-[11px]"

            >

              Reset

            </button>

          )}

        </div>

      </div>



      {/* Main Content Split: Left (8 cols) + Right Map (4 cols) */}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

        <div className="xl:col-span-8 space-y-4">

          {/* Discovered Businesses Near You */}

          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">

            <div className="flex items-center justify-between mb-3">

              <div>

                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">

                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> Businesses Near {shortArea} ({filteredBiz.length})

                </h3>

                <p className="text-[11px] text-slate-500">

                  Verified neighborhood commercial storefronts & live community business directory

                </p>

              </div>

              <button

                type="button"

                onClick={() => marketplace.refreshMarketplace()}

                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"

              >

                {marketplace.loading ? 'Syncing...' : '↻ Refresh Live POIs'}

              </button>

            </div>



            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

              {filteredBiz.length === 0 ? (

                <div className="col-span-full py-10 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">

                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xl">

                    🏪

                  </div>

                  <h4 className="text-sm font-bold text-slate-800">

                    {localSearch

                      ? `No businesses found matching "${localSearch}" in ${shortArea}`

                      : `No verified online stores registered in this pocket yet.`}

                  </h4>

                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-3">

                    Are you a local shop owner in <strong className="text-slate-800">{shortArea}</strong>?

                  </p>



                </div>

              ) : (

                filteredBiz.slice(0, 8).map((b) => (

                  <BusinessCard

                    key={b.id}

                    business={b}

                    isSaved={savedIds.includes(b.id)}

                    onToggleSave={onToggleSave}

                    onOpenModal={onOpenModal}

                  />

                ))

              )}

            </div>

          </div>



          {/* Browse by Category */}

          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">

            <h3 className="text-sm font-extrabold text-slate-900 mb-3">Browse by Category in {shortArea}</h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2.5">

              {browseGrid.map((cat) => (

                <button

                  key={cat.name}

                  type="button"

                  onClick={() => setSelectedCat(cat.name)}

                  className="p-2.5 rounded-xl border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/30 flex items-center justify-between gap-2 text-left transition cursor-pointer"

                >

                  <div className="flex items-center gap-2 min-w-0">

                    <div className={`w-8 h-8 rounded-lg ${cat.color} flex items-center justify-center shrink-0`}>

                      <cat.icon className="w-4 h-4" />

                    </div>

                    <div className="min-w-0">

                      <p className="text-xs font-bold text-slate-800 truncate">{cat.name}</p>

                      <p className="text-[10px] text-slate-400 truncate">{cat.count}</p>

                    </div>

                  </div>

                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                </button>

              ))}

            </div>

          </div>

        </div>



        {/* Right Interactive Map (4 cols) */}

        <div className="xl:col-span-4">

          <div className="bg-white rounded-2xl p-3 shadow-card border border-slate-200/70 h-full">

            <InteractiveMap

              heightClass="h-[395px]"

              showTopFilterPills={['All', 'Restaurants', 'Healthcare', 'Shopping', 'More ⌄']}

              centerLabel={selectedArea}

              centerCoords={{ lat: liveIntel.location.lat, lng: liveIntel.location.lng }}

              pois={liveIntel.nearbyPois}

            />

          </div>

        </div>

      </div>



      {/* Bottom Row: AI Recommendations for You */}

      <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">

        <div className="flex items-center justify-between mb-3">

          <div>

            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">

              <Sparkles className="w-4 h-4 text-indigo-600" /> AI Recommendations for {shortArea}

            </h3>

            <p className="text-[11px] text-slate-500">

              Personalized suggestions based on your location ({selectedArea}), weather ({liveIntel.weather.temperatureC}°C) and local activity

            </p>

          </div>

          <button

            type="button"

            onClick={() => onAskAi(`Recommend the best local businesses in ${selectedArea} for tonight`)}

            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"

          >

            <span>Ask AI</span>

            <ChevronRight className="w-3.5 h-3.5" />

          </button>

        </div>



        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">

          {[

            {

              title: 'Best Places for Dinner Tonight',

              sub: `Popular and open now near ${shortArea}`,

              img: './assets/crops/biz-ai-dinner.webp',

            },

            {

              title: 'Good Cafes to Work From',

              sub: `Quiet cafes with Wi-Fi in ${shortArea}`,

              img: './assets/crops/biz-ai-cafe.webp',

            },

            {

              title: 'Fitness Options Nearby',

              sub: `Top rated gyms within 2 km of ${shortArea}`,

              img: './assets/crops/biz-ai-fitness.webp',

            },

            {

              title: 'Essential Services Nearby',

              sub: `24×7 pharmacies & clinics in ${shortArea}`,

              img: './assets/crops/biz-ai-essential.webp',

            },

          ].map((rec) => (

            <div

              key={rec.title}

              onClick={() => onAskAi(`Show me ${rec.title} in ${selectedArea}`)}

              className="cursor-pointer p-2.5 rounded-xl border border-slate-200/80 hover:border-indigo-300 hover:shadow-sm flex items-center justify-between gap-2.5 transition"

            >

              <div className="flex items-center gap-2.5 min-w-0">

                <img src={rec.img} alt={rec.title} className="w-14 h-12 rounded-lg object-cover shrink-0" />

                <div className="min-w-0">

                  <h4 className="text-xs font-extrabold text-slate-900 line-clamp-1">{rec.title}</h4>

                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{rec.sub}</p>

                </div>

              </div>

              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />

            </div>

          ))}

        </div>

      </div>

    </div>

  );

};



