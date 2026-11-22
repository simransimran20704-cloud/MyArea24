import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Fuel,
  MapPin,
  Navigation,
  Clock,
  Sparkles,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Layers,
  Zap,
  Globe2,
  TrendingDown,
  Building2,
} from 'lucide-react';

import petrolSeedData from '../data/petrolSeedData.json';

export interface PetrolPumpItem {
  id: number;
  ssr_id: number;
  pump_name: string;
  name: string;
  company: string;
  address: string;
  city: string;
  district?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number | null;
  distance_text: string;
  petrol_price?: number;
  diesel_price?: number;
  petrol_price_display: string;
  diesel_price_display: string;
  price_type: string;
  has_petrol: boolean;
  has_diesel: boolean;
  has_cng: boolean;
  station_timing: string;
  direction_link?: string;
  source_name: string;
  last_updated: string;
}

export interface PetrolPumpsDirectoryModuleProps {
  selectedArea: string;
  city: string;
  userLat?: number;
  userLon?: number;
  onOpenModal?: (modalData: any) => void;
}

const ALL_INDIAN_STATES = [
  'All India',
  'Andhra Pradesh',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Gujarat',
  'Haryana',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
];

const MAJOR_STATE_PILLS = [
  'All India',
  'Delhi',
  'Maharashtra',
  'Uttar Pradesh',
  'Karnataka',
  'Rajasthan',
  'Gujarat',
  'Haryana',
  'Punjab',
  'Tamil Nadu',
  'West Bengal',
  'Telangana',
  'Madhya Pradesh',
  'Bihar',
  'Kerala',
  'Andhra Pradesh',
];

export const PetrolPumpsDirectoryModule: React.FC<PetrolPumpsDirectoryModuleProps> = ({
  selectedArea,
  city,
  userLat = 28.6139,
  userLon = 77.2090,
  onOpenModal,
}) => {
  // Navigation Section Sub-Tabs
  const [activeSection, setActiveSection] = useState<'pumps' | 'comparison'>('pumps');

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [selectedState, setSelectedState] = useState<string>('All India');
  const [selectedCity, setSelectedCity] = useState<string>('All Cities');
  const [pincodeQuery, setPincodeQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('nearest');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Data & Loading — Initialized with bundled 242 verified OMC pumps for instant 0ms display
  const [pumps, setPumps] = useState<PetrolPumpItem[]>(
    (petrolSeedData.items as PetrolPumpItem[]) || []
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(petrolSeedData.total || 242);
  const [filterOptions, setFilterOptions] = useState<{
    states: string[];
    cities: string[];
    companies: string[];
    state_cities?: Record<string, string[]>;
    state_rates?: Record<string, { petrol: number; diesel: number; cng: number; vat: string }>;
  }>({
    states: ALL_INDIAN_STATES,
    cities: ['All Cities'],
    companies: ['All', 'BPCL', 'IOCL', 'HPCL', 'Shell', 'Jio-bp', 'Nayara'],
    state_cities: petrolSeedData.state_cities as Record<string, string[]>,
    state_rates: petrolSeedData.state_rates as any,
  });

  // 1. Fetch Filter Options on Mount with live API
  useEffect(() => {
    fetch('/api/v1/fuel/petrol-pumps/filter-options')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.states) && data.states.length > 0) {
          setFilterOptions({
            states: ['All India', ...data.states],
            cities: ['All Cities', ...(data.cities || [])],
            companies: ['All', ...(data.companies || ['BPCL', 'IOCL', 'HPCL', 'Shell', 'Jio-bp', 'Nayara'])],
            state_cities: data.state_cities || (petrolSeedData.state_cities as any),
            state_rates: data.state_rates || (petrolSeedData.state_rates as any),
          });
        }
      })
      .catch((err) => {
        console.warn('[PetrolPumpsModule] API offline, using bundled OMC cache:', err);
      });
  }, []);

  // Compute available cities dependent on the selected state
  const availableCities = useMemo(() => {
    if (selectedState === 'All India') {
      return ['All Cities'];
    }
    const mapping = filterOptions.state_cities || (petrolSeedData.state_cities as Record<string, string[]>);
    const local = mapping?.[selectedState];
    if (local && local.length > 0) {
      return ['All Cities', ...local];
    }
    return ['All Cities'];
  }, [selectedState, filterOptions.state_cities]);

  // Compute State Summary & Fuel Benchmarks
  const stateSummary = useMemo(() => {
    const allPumps = (petrolSeedData.items as PetrolPumpItem[]) || [];
    const statePumps =
      selectedState === 'All India'
        ? allPumps
        : allPumps.filter((p) => (p.state || '').toLowerCase() === selectedState.toLowerCase());

    const ratesMapping = filterOptions.state_rates || (petrolSeedData.state_rates as any) || {};
    const benchmark = ratesMapping[selectedState] || { petrol: 102.12, diesel: 95.20, cng: 75.09, vat: '19.4%' };

    const withPetrol = statePumps.filter((p) => p.petrol_price && p.petrol_price > 0);
    const lowestPetrol = withPetrol.length > 0
      ? withPetrol.reduce((min, p) => (p.petrol_price! < min ? p.petrol_price! : min), withPetrol[0].petrol_price!)
      : benchmark.petrol;

    const withDiesel = statePumps.filter((p) => p.diesel_price && p.diesel_price > 0);
    const lowestDiesel = withDiesel.length > 0
      ? withDiesel.reduce((min, p) => (p.diesel_price! < min ? p.diesel_price! : min), withDiesel[0].diesel_price!)
      : benchmark.diesel;

    const cngCount = statePumps.filter((p) => p.has_cng).length;
    const citiesSet = new Set(statePumps.map((p) => p.city).filter(Boolean));

    return {
      totalStations: statePumps.length,
      benchmarkPetrol: benchmark.petrol,
      benchmarkDiesel: benchmark.diesel,
      benchmarkCng: benchmark.cng,
      stateVat: benchmark.vat,
      lowestPetrol,
      lowestDiesel,
      cngCount,
      activeCitiesCount: citiesSet.size,
    };
  }, [selectedState, filterOptions.state_rates]);

  // 2. Fetch Pumps when filters or coords change
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('search', searchQuery.trim());
    if (selectedBrand !== 'All') params.append('company', selectedBrand);
    if (selectedState !== 'All India') params.append('state', selectedState);
    if (selectedCity !== 'All Cities' && selectedCity.trim()) params.append('city', selectedCity.trim());
    if (pincodeQuery.trim()) params.append('pincode', pincodeQuery.trim());
    
    // Only pass radius restriction if browsing locally ("All India")
    if (selectedState === 'All India' && userLat && userLon) {
      params.append('lat', userLat.toString());
      params.append('lon', userLon.toString());
      params.append('radius_km', '35');
    } else if (userLat && userLon) {
      params.append('lat', userLat.toString());
      params.append('lon', userLon.toString());
    }

    params.append('sort_by', sortBy);
    params.append('limit', '60');

    fetch(`/api/v1/fuel/petrol-pumps?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.pumps) && data.pumps.length > 0) {
          setPumps(data.pumps);
          setTotalCount(data.total || data.pumps.length);
        } else {
          filterBundledPumps();
        }
      })
      .catch((err) => {
        console.warn('[PetrolPumpsModule] Live fetch error, applying bundled fallback:', err);
        filterBundledPumps();
      })
      .finally(() => setLoading(false));
  }, [searchQuery, selectedBrand, selectedState, selectedCity, pincodeQuery, sortBy, userLat, userLon]);

  // Client-side fallback filtering from bundled 242 verified OMC pumps
  const filterBundledPumps = () => {
    let records = [...((petrolSeedData.items as PetrolPumpItem[]) || [])];

    if (selectedState && selectedState !== 'All India') {
      records = records.filter(
        (p) => (p.state || '').toLowerCase() === selectedState.toLowerCase()
      );
    }
    if (selectedCity && selectedCity !== 'All Cities') {
      records = records.filter(
        (p) => (p.city || '').toLowerCase() === selectedCity.toLowerCase()
      );
    }
    if (selectedBrand && selectedBrand !== 'All') {
      records = records.filter(
        (p) => (p.company || '').toLowerCase().includes(selectedBrand.toLowerCase())
      );
    }
    if (pincodeQuery.trim()) {
      records = records.filter((p) => (p.pincode || '').includes(pincodeQuery.trim()));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      records = records.filter(
        (p) =>
          (p.pump_name || '').toLowerCase().includes(q) ||
          (p.address || '').toLowerCase().includes(q) ||
          (p.city || '').toLowerCase().includes(q) ||
          (p.company || '').toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'petrol_asc') {
      records.sort((a, b) => (a.petrol_price || 999) - (b.petrol_price || 999));
    } else if (sortBy === 'diesel_asc') {
      records.sort((a, b) => (a.diesel_price || 999) - (b.diesel_price || 999));
    } else if (sortBy === 'name_asc') {
      records.sort((a, b) => a.pump_name.localeCompare(b.pump_name));
    }

    setPumps(records);
    setTotalCount(records.length);
  };

  const handleRouteClick = (pump: PetrolPumpItem) => {
    const url =
      pump.direction_link ||
      (pump.latitude && pump.longitude
        ? `https://maps.google.com/maps?q=${pump.latitude},${pump.longitude}`
        : `https://maps.google.com/maps?q=${encodeURIComponent(pump.pump_name + ' ' + (pump.address || ''))}`);

    if (onOpenModal) {
      onOpenModal({
        title: pump.pump_name,
        subtitle: `${pump.company} • ${pump.address}`,
        category: 'Live Petrol Pump Telemetry',
        price: `Petrol: ${pump.petrol_price_display} • Diesel: ${pump.diesel_price_display}`,
        location: `${pump.address} (${pump.distance_text})`,
        address: pump.address,
        description: `${pump.pump_name} operated by ${pump.company}. Station timing: ${pump.station_timing}. Live fuel telemetry synchronized from Oil Marketing Company dealer feed.`,
        primaryActionLabel: 'Launch Google Maps',
        actionUrl: url,
      });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const getBrandBadge = (company: string) => {
    const c = (company || '').toUpperCase();
    if (c.includes('BPCL') || c.includes('BHARAT')) return 'bg-amber-50 text-amber-800 border-amber-300';
    if (c.includes('IOCL') || c.includes('INDIAN OIL')) return 'bg-orange-50 text-orange-800 border-orange-300';
    if (c.includes('HPCL') || c.includes('HINDUSTAN')) return 'bg-rose-50 text-rose-800 border-rose-300';
    if (c.includes('SHELL')) return 'bg-yellow-50 text-yellow-900 border-yellow-300 font-extrabold';
    if (c.includes('RELIANCE') || c.includes('JIO-BP')) return 'bg-blue-50 text-blue-800 border-blue-300';
    if (c.includes('NAYARA')) return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* Tab 1: Fuel Stations & Pumps */}
          <button
            type="button"
            onClick={() => setActiveSection('pumps')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer ${
              activeSection === 'pumps'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Fuel className="w-4 h-4" />
            <span>Petrol & Diesel Pumps</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeSection === 'pumps' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {totalCount}
            </span>
          </button>

          {/* Tab 2: Cross-State Price Comparison */}
          <button
            type="button"
            onClick={() => setActiveSection('comparison')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer ${
              activeSection === 'comparison'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span>Cross-State Fuel Rates Comparison</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeSection === 'comparison' ? 'bg-white/25 text-white' : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              16 States
            </span>
          </button>
        </div>

        {/* Live Data Attribution Pill */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate max-w-[280px]">SSR Innovation Lab & PPAC (Live OMC Feed)</span>
        </div>
      </div>

      {/* 2. Quick State Selector Pills Bar (1-Tap Selection for 16 Indian States) */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Select State / Fuel Region:</span>
          </span>
          <span className="text-[11px] font-bold text-blue-700">
            Selected: {selectedState} ({stateSummary.totalStations} stations)
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {MAJOR_STATE_PILLS.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setSelectedState(st);
                setSelectedCity('All Cities');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                selectedState === st
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-extrabold'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
              }`}
            >
              {st === 'All India' ? '🇮🇳 All India (242)' : st}
            </button>
          ))}
        </div>
      </div>

      {/* 3. State Overview Summary Banner (When a specific State is selected) */}
      {selectedState !== 'All India' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50/70 p-4 rounded-2xl border border-blue-200/80 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">⛽</span>
                <h3 className="text-sm font-extrabold text-blue-950">
                  {selectedState} Fuel Telemetry & Station Network
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {stateSummary.totalStations} Verified Stations
                </span>
              </div>
              <p className="text-xs text-blue-800/80 mt-1">
                Showing live OMC dealer prices across {stateSummary.activeCitiesCount} cities in {selectedState}.
                State VAT rate: <span className="font-extrabold">{stateSummary.stateVat}</span>.
              </p>
            </div>

            {/* Price Highlights */}
            <div className="flex items-center gap-2 sm:gap-3 text-xs bg-white/90 backdrop-blur-xs p-2.5 rounded-xl border border-blue-200">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Petrol</p>
                <p className="font-extrabold text-slate-900 text-sm">
                  ₹{stateSummary.lowestPetrol.toFixed(2)}
                  <span className="text-[10px] font-normal text-slate-500"> /L</span>
                </p>
              </div>
              <div className="h-6 w-px bg-slate-200"></div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Diesel</p>
                <p className="font-extrabold text-blue-700 text-sm">
                  ₹{stateSummary.lowestDiesel.toFixed(2)}
                  <span className="text-[10px] font-normal text-slate-500"> /L</span>
                </p>
              </div>
              <div className="h-6 w-px bg-slate-200"></div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">CNG Stations</p>
                <p className="font-extrabold text-emerald-700 text-sm">
                  {stateSummary.cngCount} Active
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 1: PETROL PUMPS LISTING & FILTERS
          ========================================================================= */}
      {activeSection === 'pumps' && (
        <div className="space-y-4">
          {/* Filters Bar with Explicit Labels */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              {/* 1. Name or Address Search */}
              <div className="lg:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <Search className="w-3 h-3 text-slate-400" />
                  <span>Search Station / Landmark</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search pump name, road, highway..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* 2. State Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <span>🏛️ State</span>
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setSelectedCity('All Cities');
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold text-slate-800"
                >
                  {ALL_INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st === 'All India' ? '🇮🇳 All India (242 stations)' : st}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. City Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <span>📍 City / Area</span>
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  disabled={selectedState === 'All India'}
                  className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold text-slate-800 ${
                    selectedState === 'All India' ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''
                  }`}
                >
                  <option value="All Cities">
                    {selectedState === 'All India' ? 'All Cities (Select State First)' : 'All Cities'}
                  </option>
                  {availableCities.filter((c) => c !== 'All Cities').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Brand / OMC Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <span>⛽ Brand / OMC</span>
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold text-slate-800"
                >
                  {filterOptions.companies.map((c) => (
                    <option key={c} value={c}>
                      {c === 'All' ? 'All Brands (BPCL, IOCL, HPCL)' : c}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Sort By & View Mode */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <span>⇅ Sort By</span>
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold text-slate-800"
                >
                  <option value="nearest">📍 Nearest First</option>
                  <option value="petrol_asc">⛽ Lowest Petrol Price</option>
                  <option value="diesel_asc">🚜 Lowest Diesel Price</option>
                  <option value="name_asc">🔤 Alphabetical (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Quick Brand Pills & View Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Brand:</span>
                {['All', 'BPCL', 'IOCL', 'HPCL', 'Shell', 'Jio-bp'].map((bName) => (
                  <button
                    key={bName}
                    type="button"
                    onClick={() => setSelectedBrand(bName)}
                    className={`px-2.5 py-1 text-[11px] rounded-lg font-bold border transition cursor-pointer ${
                      selectedBrand === bName
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {bName === 'All' ? 'All Brands' : bName}
                  </button>
                ))}
              </div>

              {/* View Switcher */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                    viewMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                    viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Table
                </button>
              </div>
            </div>
          </div>

          {/* Listing Content */}
          {loading ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-card border border-slate-200/70">
              <div className="inline-block animate-spin text-2xl mb-2">🔄</div>
              <p className="font-extrabold text-slate-800 text-sm">Searching Live Petrol Pumps...</p>
              <p className="text-xs text-slate-400 mt-1">Retrieving verified OMC dealer telemetry and fuel rates</p>
            </div>
          ) : pumps.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-card border border-slate-200/70 space-y-3">
              <div className="text-4xl">⛽</div>
              <h4 className="text-sm font-extrabold text-slate-800">No Petrol Pumps Found with Current Filter</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Try switching State to 'All India' or clearing your search term to view nearby verified stations.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedBrand('All');
                  setSelectedState('All India');
                  setSelectedCity('All Cities');
                  setPincodeQuery('');
                  setSortBy('nearest');
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : viewMode === 'cards' ? (
            /* ================= CARDS VIEW ================= */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {pumps.map((pump) => (
                <div
                  key={pump.id || pump.ssr_id}
                  className="bg-white rounded-2xl p-4 shadow-card hover:shadow-md transition border border-slate-200/70 flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Brand Badge & Distance */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${getBrandBadge(
                          pump.company
                        )}`}
                      >
                        {pump.company || 'OMC'}
                      </span>
                      {pump.distance_text && pump.distance_text !== 'OMC Station' ? (
                        <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                          <Navigation className="w-3 h-3" />
                          {pump.distance_text}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                          {pump.state || 'India'}
                        </span>
                      )}
                    </div>

                    {/* Pump Name */}
                    <h4 className="text-xs font-extrabold text-slate-900 line-clamp-2 leading-tight mb-1">
                      {pump.pump_name}
                    </h4>

                    {/* Address & City */}
                    <p className="text-[11px] text-slate-500 flex items-start gap-1 mb-3 line-clamp-2">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span>
                        {pump.address}
                        {pump.city ? `, ${pump.city}` : ''}
                        {pump.pincode ? ` - ${pump.pincode}` : ''}
                      </span>
                    </p>

                    {/* Price Highlights Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 mb-3">
                      {/* Petrol Price */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Petrol
                        </span>
                        <span
                          className={`text-sm font-black ${
                            pump.petrol_price ? 'text-slate-900' : 'text-slate-400 text-xs'
                          }`}
                        >
                          {pump.petrol_price_display}
                        </span>
                      </div>

                      {/* Diesel Price */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Diesel
                        </span>
                        <span
                          className={`text-sm font-black ${
                            pump.diesel_price ? 'text-blue-700' : 'text-slate-400 text-xs'
                          }`}
                        >
                          {pump.diesel_price_display}
                        </span>
                      </div>
                    </div>

                    {/* Amenities & Timings */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600 mb-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" /> {pump.station_timing || '24 Hours'}
                      </span>
                      {pump.has_cng ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/60">
                          🌿 CNG Available
                        </span>
                      ) : null}
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] text-slate-500">
                        {pump.price_type}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                      {pump.city || pump.state}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRouteClick(pump)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                    >
                      <Navigation className="w-3.5 h-3.5" /> Start Route ›
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ================= TABLE VIEW ================= */
            <div className="bg-white rounded-2xl shadow-card border border-slate-200/70 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200/80 font-bold">
                      <th className="py-3 px-4">Station & Brand</th>
                      <th className="py-3 px-3">State & Location</th>
                      <th className="py-3 px-3">Petrol Price</th>
                      <th className="py-3 px-3">Diesel Price</th>
                      <th className="py-3 px-3">Timings & CNG</th>
                      <th className="py-3 px-4 text-right">Route</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pumps.map((pump) => (
                      <tr key={pump.id || pump.ssr_id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${getBrandBadge(
                                pump.company
                              )}`}
                            >
                              {pump.company}
                            </span>
                            <span className="font-extrabold text-slate-900 truncate max-w-[220px]">
                              {pump.pump_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          <p className="font-semibold text-slate-800">{pump.city || pump.district}, {pump.state}</p>
                          <p className="text-[11px] text-slate-500 truncate max-w-[220px]">{pump.address}</p>
                        </td>
                        <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap">
                          {pump.petrol_price_display}
                        </td>
                        <td className="py-3 px-3 font-black text-blue-700 whitespace-nowrap">
                          {pump.diesel_price_display}
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {pump.station_timing || '24 Hours'}
                          {pump.has_cng ? (
                            <span className="ml-1.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                              CNG
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRouteClick(pump)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white font-extrabold text-xs transition cursor-pointer"
                          >
                            Navigate ›
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SECTION 2: CROSS-STATE FUEL RATES COMPARISON
          ========================================================================= */}
      {activeSection === 'comparison' && (
        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-200/70 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-indigo-600" />
                <span>All-India State Fuel Price Comparison (Petrol, Diesel & CNG)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Official daily benchmark retail rates across 16 states based on state VAT, dealer commissions, and central excise.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-[10px] font-extrabold">
              16 States Compared
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200/80 font-bold">
                  <th className="py-3 px-4">State / UT</th>
                  <th className="py-3 px-3">Petrol Price (₹/L)</th>
                  <th className="py-3 px-3">Diesel Price (₹/L)</th>
                  <th className="py-3 px-3">CNG Rate (₹/kg)</th>
                  <th className="py-3 px-3">State VAT</th>
                  <th className="py-3 px-3">Verified Stations</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ALL_INDIAN_STATES.filter((s) => s !== 'All India').map((st) => {
                  const rates =
                    (filterOptions.state_rates as any)?.[st] ||
                    (petrolSeedData.state_rates as any)?.[st] ||
                    { petrol: 102.12, diesel: 95.20, cng: 75.09, vat: '19.4%' };

                  const count = (petrolSeedData.items as PetrolPumpItem[]).filter(
                    (p) => (p.state || '').toLowerCase() === st.toLowerCase()
                  ).length;

                  return (
                    <tr key={st} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-extrabold text-slate-900">{st}</td>
                      <td className="py-3 px-3">
                        <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          ₹{rates.petrol.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          ₹{rates.diesel.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          ₹{rates.cng.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-semibold">{rates.vat}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                          {count} Stations
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedState(st);
                            setSelectedCity('All Cities');
                            setActiveSection('pumps');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] transition cursor-pointer"
                        >
                          Explore Stations ›
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
