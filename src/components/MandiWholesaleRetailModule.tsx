import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  TrendingDown,
  TrendingUp,
  MapPin,
  RefreshCw,
  Building2,
  Store,
  Calendar,
  Layers,
  ChevronDown,
  Info,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  BarChart3,
  Globe2,
} from 'lucide-react';

import mandiSeedData from '../data/mandiSeedData.json';

export interface WholesaleItem {
  id: number;
  state: string;
  district: string;
  mandi_name: string;
  commodity: string;
  variety: string;
  grade: string;
  category: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  unit: string;
  raw_min_price: number;
  raw_max_price: number;
  raw_modal_price: number;
  raw_unit: string;
  wholesale_display: string;
  retail_normalized_display: string;
  reporting_date: string;
  source_name: string;
  price_trend: string;
}

export interface RetailShopPrice {
  id: number;
  commodity_name: string;
  category: string;
  store_name: string;
  store_address: string;
  locality: string;
  city: string;
  local_price: number;
  mrp: number;
  price_display: string;
  unit: string;
  price_type: string;
  verified_by_merchant: boolean;
  last_verified: string;
}

export interface ComparisonData {
  commodity: string;
  found: boolean;
  total_markets_compared: number;
  lowest_market: {
    mandi: string;
    district: string;
    state: string;
    modal_price_kg: number;
    modal_price_quintal: number;
    display: string;
    reporting_date: string;
  };
  highest_market: {
    mandi: string;
    district: string;
    state: string;
    modal_price_kg: number;
    modal_price_quintal: number;
    display: string;
    reporting_date: string;
  };
  average_modal_price_kg: number;
  price_spread_kg: number;
  all_markets: Array<{
    mandi: string;
    district: string;
    state: string;
    variety: string;
    modal_price_kg: number;
    raw_modal_price_quintal: number;
    reporting_date: string;
  }>;
}

export interface MandiWholesaleRetailModuleProps {
  selectedArea: string;
  city: string;
}

const ALL_INDIA_STATES = [
  'All India',
  'Andhra Pradesh',
  'Bihar',
  'Chandigarh',
  'Chattisgarh',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Karnataka',
  'Keralam',
  'Madhya Pradesh',
  'Maharashtra',
  'NCT of Delhi',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal'
];

export const MandiWholesaleRetailModule: React.FC<MandiWholesaleRetailModuleProps> = ({
  selectedArea,
  city,
}) => {
  // Navigation sub-tabs (Wholesale is default & primary)
  const [activeSection, setActiveSection] = useState<'wholesale' | 'statewise' | 'retail' | 'comparison'>('wholesale');

  // Filter States
  const [selectedState, setSelectedState] = useState<string>('All India');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('All Districts');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('price_asc');

  // Comparison State
  const [comparisonCommodity, setComparisonCommodity] = useState<string>('Tomato');
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [loadingComparison, setLoadingComparison] = useState<boolean>(false);

  // Data States initialized with bundled 633 government records for 0ms instant display
  const [wholesaleItems, setWholesaleItems] = useState<WholesaleItem[]>(
    (mandiSeedData.items as WholesaleItem[]) || []
  );
  const [retailItems, setRetailItems] = useState<RetailShopPrice[]>([]);
  const [filterOptions, setFilterOptions] = useState<{
    states: string[];
    districts: string[];
    commodities: string[];
    categories: string[];
    total_records: number;
  }>({
    states: ALL_INDIA_STATES,
    districts: ['All Districts'],
    commodities: ['Tomato', 'Potato', 'Onion', 'Apple', 'Wheat', 'Rice'],
    categories: ['Vegetables', 'Fruits', 'Grains & Pulses', 'Spices & Commercial'],
    total_records: mandiSeedData.total || 633,
  });

  const [loadingWholesale, setLoadingWholesale] = useState<boolean>(false);
  const [loadingRetail, setLoadingRetail] = useState<boolean>(false);
  const [reportingSource, setReportingSource] = useState<string>(
    'Government of India – Agmarknet (data.gov.in)'
  );

  // Dynamic available districts computed immediately from bundled registry
  const availableDistricts = useMemo(() => {
    if (selectedState === 'All India') {
      return ['All Districts'];
    }
    const local = (mandiSeedData.state_districts as Record<string, string[]>)?.[selectedState];
    if (local && local.length > 0) {
      return ['All Districts', ...local];
    }
    if (filterOptions.districts && filterOptions.districts.length > 1) {
      return filterOptions.districts;
    }
    return ['All Districts'];
  }, [selectedState, filterOptions.districts]);

  // 1. Fetch live filter options from API on Mount (with instant fallback)
  useEffect(() => {
    fetch('/api/v1/market/filter-options')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.states) && data.states.length > 0) {
          setFilterOptions({
            states: ['All India', ...data.states],
            districts: ['All Districts', ...(data.districts || [])],
            commodities: data.commodities || [],
            categories: data.categories || ['Vegetables', 'Fruits', 'Grains & Pulses', 'Spices & Commercial'],
            total_records: data.total_records || mandiSeedData.total,
          });
        }
      })
      .catch((err) => {
        console.warn('[MandiModule] Backend offline/unreachable, using bundled Agmarknet cache:', err);
      });
  }, []);

  // Update dependent districts when state changes
  useEffect(() => {
    if (selectedState && selectedState !== 'All India') {
      fetch(`/api/v1/market/filter-options?state=${encodeURIComponent(selectedState)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.districts) && data.districts.length > 0) {
            setFilterOptions((prev) => ({
              ...prev,
              districts: ['All Districts', ...data.districts],
            }));
            setSelectedDistrict('All Districts');
          } else {
            // Local fallback district mapping
            const localDistricts = (mandiSeedData.state_districts as any)?.[selectedState] || [];
            setFilterOptions((prev) => ({
              ...prev,
              districts: ['All Districts', ...localDistricts],
            }));
            setSelectedDistrict('All Districts');
          }
        })
        .catch(() => {
          const localDistricts = (mandiSeedData.state_districts as any)?.[selectedState] || [];
          setFilterOptions((prev) => ({
            ...prev,
            districts: ['All Districts', ...localDistricts],
          }));
          setSelectedDistrict('All Districts');
        });
    } else {
      setFilterOptions((prev) => ({
        ...prev,
        districts: ['All Districts'],
      }));
      setSelectedDistrict('All Districts');
    }
  }, [selectedState]);

  // 2. Fetch Wholesale Mandi Prices (with automatic local filter fallback)
  useEffect(() => {
    setLoadingWholesale(true);
    const qp = new URLSearchParams();
    if (selectedState && selectedState !== 'All India') qp.set('state', selectedState);
    if (selectedDistrict && selectedDistrict !== 'All Districts') qp.set('district', selectedDistrict);
    if (selectedCategory && selectedCategory !== 'All') qp.set('category', selectedCategory);
    if (searchQuery.trim()) qp.set('search', searchQuery.trim());
    qp.set('sort_by', sortBy);
    qp.set('limit', '100');

    fetch(`/api/v1/market/wholesale?${qp.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          setWholesaleItems(data.items);
          if (data.reporting_source) setReportingSource(data.reporting_source);
        } else {
          // Client-side fallback filtering from bundled 633 government records
          filterBundledRecords();
        }
      })
      .catch((err) => {
        console.warn('[MandiModule] Failed to fetch live wholesale prices, applying bundled filter:', err);
        filterBundledRecords();
      })
      .finally(() => setLoadingWholesale(false));
  }, [selectedState, selectedDistrict, selectedCategory, searchQuery, sortBy]);

  // Client-side filter fallback function
  const filterBundledRecords = () => {
    let records = (mandiSeedData.items as WholesaleItem[]) || [];

    if (selectedState && selectedState !== 'All India') {
      records = records.filter(
        (r) => r.state.toLowerCase() === selectedState.toLowerCase()
      );
    }
    if (selectedDistrict && selectedDistrict !== 'All Districts') {
      records = records.filter(
        (r) => r.district.toLowerCase() === selectedDistrict.toLowerCase()
      );
    }
    if (selectedCategory && selectedCategory !== 'All') {
      records = records.filter(
        (r) => r.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      records = records.filter(
        (r) =>
          r.commodity.toLowerCase().includes(q) ||
          r.mandi_name.toLowerCase().includes(q) ||
          r.variety.toLowerCase().includes(q) ||
          r.state.toLowerCase().includes(q) ||
          r.district.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'price_asc') {
      records.sort((a, b) => a.modal_price - b.modal_price);
    } else if (sortBy === 'price_desc') {
      records.sort((a, b) => b.modal_price - a.modal_price);
    } else if (sortBy === 'market_asc') {
      records.sort((a, b) => a.mandi_name.localeCompare(b.mandi_name));
    } else {
      records.sort((a, b) => a.commodity.localeCompare(b.commodity));
    }

    setWholesaleItems(records);
  };

  // 3. Fetch Retail Local Shop Prices
  useEffect(() => {
    setLoadingRetail(true);
    fetch(`/api/v1/market/retail?city=${encodeURIComponent(city || 'Delhi')}&locality=${encodeURIComponent(selectedArea)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.verified_local_shop_prices) && data.verified_local_shop_prices.length > 0) {
          setRetailItems(data.verified_local_shop_prices);
        } else {
          setRetailItems([]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingRetail(false));
  }, [city, selectedArea]);

  // 4. Fetch Commodity Comparison Data
  const loadComparison = (comm: string, switchTab: boolean = true) => {
    setLoadingComparison(true);
    setComparisonCommodity(comm);
    fetch(`/api/v1/market/comparison?commodity=${encodeURIComponent(comm)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.found) {
          setComparisonData(data);
          if (switchTab) setActiveSection('comparison');
        } else {
          // Build local comparison from seed data
          buildLocalComparison(comm, switchTab);
        }
      })
      .catch(() => {
        buildLocalComparison(comm, switchTab);
      })
      .finally(() => setLoadingComparison(false));
  };

  const buildLocalComparison = (comm: string, switchTab: boolean = true) => {
    const matches = (mandiSeedData.items as WholesaleItem[]).filter(
      (r) => r.commodity.toLowerCase() === comm.toLowerCase()
    );
    if (matches.length > 0) {
      matches.sort((a, b) => a.modal_price - b.modal_price);
      const lowest = matches[0];
      const highest = matches[matches.length - 1];
      const avg =
        matches.reduce((sum, item) => sum + item.modal_price, 0) / matches.length;

      setComparisonData({
        commodity: comm,
        found: true,
        total_markets_compared: matches.length,
        lowest_market: {
          mandi: lowest.mandi_name,
          district: lowest.district,
          state: lowest.state,
          modal_price_kg: lowest.modal_price,
          modal_price_quintal: lowest.raw_modal_price,
          display: `₹${lowest.modal_price}/kg (₹${lowest.raw_modal_price.toLocaleString('en-IN')}/Q)`,
          reporting_date: lowest.reporting_date,
        },
        highest_market: {
          mandi: highest.mandi_name,
          district: highest.district,
          state: highest.state,
          modal_price_kg: highest.modal_price,
          modal_price_quintal: highest.raw_modal_price,
          display: `₹${highest.modal_price}/kg (₹${highest.raw_modal_price.toLocaleString('en-IN')}/Q)`,
          reporting_date: highest.reporting_date,
        },
        average_modal_price_kg: round2(avg),
        price_spread_kg: round2(highest.modal_price - lowest.modal_price),
        all_markets: matches.map((m) => ({
          mandi: m.mandi_name,
          district: m.district,
          state: m.state,
          variety: m.variety,
          modal_price_kg: m.modal_price,
          raw_modal_price_quintal: m.raw_modal_price,
          reporting_date: m.reporting_date,
        })),
      });
      if (switchTab) setActiveSection('comparison');
    }
  };

  const round2 = (num: number) => Math.round(num * 100) / 100;

  // Pre-load default comparison silently without tab flip
  useEffect(() => {
    if (comparisonCommodity) {
      loadComparison(comparisonCommodity, false);
    }
  }, []);

  // Compute state-wise summary statistics for the selected state
  const stateSummary = useMemo(() => {
    const records = (mandiSeedData.items as WholesaleItem[]) || [];
    const stateRecords =
      selectedState === 'All India'
        ? records
        : records.filter((r) => r.state.toLowerCase() === selectedState.toLowerCase());

    const mandisSet = new Set(stateRecords.map((r) => r.mandi_name));
    const districtsSet = new Set(stateRecords.map((r) => r.district).filter(Boolean));
    const commoditiesSet = new Set(stateRecords.map((r) => r.commodity));

    const sortedByPrice = [...stateRecords].sort((a, b) => a.modal_price - b.modal_price);
    const lowest = sortedByPrice[0];
    const highest = sortedByPrice[sortedByPrice.length - 1];

    return {
      totalRecords: stateRecords.length,
      activeMandis: mandisSet.size,
      activeDistricts: districtsSet.size,
      commoditiesCount: commoditiesSet.size,
      lowestItem: lowest,
      highestItem: highest,
    };
  }, [selectedState]);

  // Major Indian States for 1-Tap Quick Pills
  const majorStatesList = [
    'All India',
    'Maharashtra',
    'NCT of Delhi',
    'Punjab',
    'Haryana',
    'Uttar Pradesh',
    'Rajasthan',
    'Gujarat',
    'Madhya Pradesh',
    'Karnataka',
    'Tamil Nadu',
    'West Bengal',
  ];

  return (
    <div className="space-y-4">
      {/* 1. Header Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar">
          {/* Tab 1: State-Wise Mandi Rates (Primary) */}
          <button
            type="button"
            onClick={() => setActiveSection('statewise')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer ${
              activeSection === 'statewise'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Globe2 className="w-4 h-4" />
            <span>State-Wise Mandi Rates</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeSection === 'statewise' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              20 States
            </span>
          </button>

          {/* Tab 2: All Wholesale Mandi Rates */}
          <button
            type="button"
            onClick={() => setActiveSection('wholesale')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer ${
              activeSection === 'wholesale'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>All Wholesale Rates</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeSection === 'wholesale' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {wholesaleItems.length}
            </span>
          </button>

          {/* Tab 3: Verified Local Retail Shops */}
          <button
            type="button"
            onClick={() => setActiveSection('retail')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer ${
              activeSection === 'retail'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Local Retail Shops</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeSection === 'retail' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {retailItems.length}
            </span>
          </button>

          {/* Tab 4: Cross-Market Comparison */}
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
            <span>Cross-Market Comparison</span>
          </button>
        </div>

        {/* Live Data Attribution Pill */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate max-w-[280px]">Official data.gov.in Agmarknet Feed</span>
        </div>
      </div>

      {/* 2. Quick State Selector Pills Bar (1-Tap Selection for Major Indian States) */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>Select State / Mandi Region:</span>
          </span>
          <span className="text-[11px] font-bold text-emerald-700">
            Current: {selectedState} ({stateSummary.totalRecords} records)
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {majorStatesList.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setSelectedState(st);
                setSelectedDistrict('All Districts');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                selectedState === st
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-extrabold'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
              }`}
            >
              {st === 'All India' ? '🇮🇳 All India (633)' : st}
            </button>
          ))}
        </div>
      </div>

      {/* 3. State Overview Summary Banner (When a specific State is selected) */}
      {selectedState !== 'All India' && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50/80 p-4 rounded-2xl border border-emerald-200/80 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🏛️</span>
                <h3 className="text-sm font-extrabold text-emerald-950">
                  {selectedState} Mandi Price Overview
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                  {stateSummary.totalRecords} Live APMC Quotes
                </span>
              </div>
              <p className="text-xs text-emerald-800/80 mt-1">
                Showing daily wholesale arrivals across {stateSummary.activeMandis} reporting APMC mandis in {stateSummary.activeDistricts} districts.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs bg-white/80 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-emerald-200">
              {stateSummary.lowestItem && (
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Lowest Today</p>
                  <p className="font-extrabold text-emerald-700">
                    {stateSummary.lowestItem.commodity}: ₹{stateSummary.lowestItem.modal_price}/kg
                  </p>
                </div>
              )}
              <div className="h-6 w-px bg-slate-200"></div>
              {stateSummary.highestItem && (
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Highest Today</p>
                  <p className="font-extrabold text-slate-800">
                    {stateSummary.highestItem.commodity}: ₹{stateSummary.highestItem.modal_price}/kg
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 1: STATE-WISE MANDI RATES EXPLORER
          ========================================================================= */}
      {activeSection === 'statewise' && (
        <div className="space-y-4">
          {/* State Directory Cards (All 20 States Grid) */}
          {selectedState === 'All India' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  🏛️ Explore Mandi Prices by State (20 States in Central Registry)
                </h4>
                <span className="text-[11px] text-slate-500">Tap any state to view its wholesale rates</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filterOptions.states
                  .filter((s) => s !== 'All India')
                  .map((st) => {
                    const count = (mandiSeedData.items as WholesaleItem[]).filter(
                      (r) => r.state.toLowerCase() === st.toLowerCase()
                    ).length;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setSelectedState(st);
                          setSelectedDistrict('All Districts');
                        }}
                        className="p-3.5 rounded-xl bg-white border border-slate-200/80 hover:border-emerald-400 hover:shadow-sm text-left transition flex items-center justify-between gap-2 group cursor-pointer"
                      >
                        <div>
                          <p className="font-extrabold text-slate-900 text-xs group-hover:text-emerald-700 transition">
                            {st}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {count} APMC Mandi Records
                          </p>
                        </div>
                        <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs group-hover:bg-emerald-600 group-hover:text-white transition">
                          →
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700">
                Viewing mandis in: <span className="font-extrabold text-emerald-700">{selectedState}</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedState('All India')}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                ← Back to All States
              </button>
            </div>
          )}

          {/* Table for State-Wise Mandi Rates */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span>🌾</span>
                <span>
                  {selectedState === 'All India' ? 'National Mandi Arrivals' : `${selectedState} Mandi Arrivals`}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                  {wholesaleItems.length} records
                </span>
              </h3>
              <div className="text-right">
                <span className="text-[10px] text-slate-400">
                  Standardized ₹/kg & Official ₹/Quintal
                </span>
              </div>
            </div>

            {/* Mandi Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 font-bold">
                    <th className="py-2.5">Commodity & Variety</th>
                    <th className="py-2.5">Mandi / Market</th>
                    <th className="py-2.5">State & District</th>
                    <th className="py-2.5">Wholesale Price (₹/Quintal)</th>
                    <th className="py-2.5">Consumer Price (₹/kg)</th>
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {wholesaleItems.map((item) => (
                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition">
                      <td className="py-3">
                        <p className="font-extrabold text-slate-900">{item.commodity}</p>
                        <p className="text-[10px] text-slate-500">
                          {item.variety} • <span className="font-semibold text-emerald-700">{item.grade}</span>
                        </p>
                      </td>
                      <td className="py-3">
                        <p className="font-bold text-slate-800">{item.mandi_name}</p>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">APMC</span>
                      </td>
                      <td className="py-3">
                        <p className="font-semibold text-slate-700">{item.district || item.state}</p>
                        <p className="text-[10px] text-slate-400">{item.state}</p>
                      </td>
                      <td className="py-3">
                        <p className="font-extrabold text-emerald-800 text-sm">
                          ₹{item.raw_modal_price.toLocaleString('en-IN')}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">/ Quintal</span>
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Min: ₹{item.raw_min_price.toLocaleString('en-IN')} • Max: ₹{item.raw_max_price.toLocaleString('en-IN')}
                        </p>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 font-extrabold text-xs">
                          {item.retail_normalized_display}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {item.reporting_date}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => loadComparison(item.commodity)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] transition cursor-pointer"
                        >
                          Compare →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 2: ALL WHOLESALE MANDI PRICES (Search & Comprehensive Filters)
          ========================================================================= */}
      {activeSection === 'wholesale' && (
        <div className="space-y-4">
          {/* Filter Bar with Explicit Labels */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {/* Search Commodity */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <Search className="w-3 h-3 text-slate-400" />
                  <span>Search Commodity</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search Tomato, Potato, Apple..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
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

              {/* State Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <span>🏛️ State</span>
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setSelectedDistrict('All Districts');
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-semibold text-slate-800"
                >
                  {(filterOptions.states && filterOptions.states.length > 0 ? filterOptions.states : ALL_INDIA_STATES).map((st) => (
                    <option key={st} value={st}>
                      {st === 'All India' ? '🇮🇳 All India (633 records)' : st}
                    </option>
                  ))}
                </select>
              </div>

              {/* District Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <span>📍 District</span>
                </label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  disabled={selectedState === 'All India'}
                  className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-semibold text-slate-800 ${
                    selectedState === 'All India' ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''
                  }`}
                >
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <span>🏷️ Category</span>
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-semibold text-slate-800"
                >
                  <option value="All">All Categories</option>
                  {filterOptions.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sorting */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <span>⇅ Sort By</span>
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-semibold text-slate-800"
                >
                  <option value="price_asc">Price: Low to High (₹/kg)</option>
                  <option value="price_desc">Price: High to Low (₹/kg)</option>
                  <option value="market_asc">Market Name (A-Z)</option>
                  <option value="commodity_asc">Commodity Name (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Quick Commodity Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">Popular:</span>
              {['Tomato', 'Potato', 'Onion', 'Apple', 'Banana', 'Mango', 'Wheat', 'Rice'].map((cName) => (
                <button
                  key={cName}
                  type="button"
                  onClick={() => setSearchQuery(cName)}
                  className={`px-2.5 py-1 text-[11px] rounded-lg font-bold border transition cursor-pointer ${
                    searchQuery.toLowerCase() === cName.toLowerCase()
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cName}
                </button>
              ))}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[11px] text-rose-600 font-bold ml-2 hover:underline cursor-pointer"
                >
                  Clear Search
                </button>
              )}
            </div>
          </div>

          {/* Wholesale Table Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span>🏛️</span>
                  <span>Official APMC Mandi Wholesale Rates</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                    {wholesaleItems.length} records
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Quoted in raw ₹ / Quintal (100 kg) with standardized ₹ / kg consumer equivalent. Source: data.gov.in (Agmarknet).
                </p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-extrabold">
                  ● Authentic Daily Arrival Data
                </span>
              </div>
            </div>

            {loadingWholesale ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                <span>Loading latest mandi arrival records...</span>
              </div>
            ) : wholesaleItems.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                <p className="font-extrabold text-slate-700">No Mandi Records Found in Current Filter</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Try switching State to 'All India' or clearing your commodity search query.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedState('All India');
                    setSelectedDistrict('All Districts');
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100 font-bold">
                      <th className="py-2.5">Commodity & Variety</th>
                      <th className="py-2.5">Mandi / Market</th>
                      <th className="py-2.5">State & District</th>
                      <th className="py-2.5">Wholesale Price (₹/Quintal)</th>
                      <th className="py-2.5">Normalized (₹/kg)</th>
                      <th className="py-2.5">Reported Date</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wholesaleItems.map((item) => (
                      <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition">
                        <td className="py-3">
                          <p className="font-extrabold text-slate-900">{item.commodity}</p>
                          <p className="text-[10px] text-slate-500">
                            {item.variety} • <span className="font-semibold text-emerald-700">{item.grade}</span>
                          </p>
                        </td>
                        <td className="py-3">
                          <p className="font-bold text-slate-800">{item.mandi_name}</p>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">APMC Market</span>
                        </td>
                        <td className="py-3">
                          <p className="font-semibold text-slate-700">{item.district || item.state}</p>
                          <p className="text-[10px] text-slate-400">{item.state}</p>
                        </td>
                        <td className="py-3">
                          <p className="font-extrabold text-emerald-800 text-sm">
                            ₹{item.raw_modal_price.toLocaleString('en-IN')}
                            <span className="text-[10px] text-slate-400 font-normal ml-1">/ Quintal</span>
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Range: ₹{item.raw_min_price.toLocaleString('en-IN')} – ₹{item.raw_max_price.toLocaleString('en-IN')}
                          </p>
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 font-extrabold text-xs">
                            {item.retail_normalized_display}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {item.reporting_date}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => loadComparison(item.commodity)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] transition cursor-pointer"
                          >
                            Compare →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 3: VERIFIED LOCAL RETAIL SHOPS
          ========================================================================= */}
      {activeSection === 'retail' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span>🏪</span>
                  <span>Verified Local Neighborhood Shop Prices</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold">
                    {retailItems.length} active stores
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Consumer shelf prices from local grocery merchants around {selectedArea}, {city}.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 text-[10px] font-extrabold">
                ● Merchant Verified
              </span>
            </div>

            {retailItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {retailItems.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                        {item.category}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Verified {item.last_verified}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">{item.commodity_name}</h4>
                      <p className="text-[11px] text-slate-500">{item.store_name} • {item.store_address}</p>
                    </div>

                    <div className="flex items-baseline justify-between pt-1 border-t border-slate-200/60">
                      <div>
                        <span className="text-base font-extrabold text-slate-900">{item.price_display}</span>
                        {item.mrp > item.local_price && (
                          <span className="text-[10px] text-slate-400 line-through ml-1.5">₹{item.mrp}</span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-blue-600">Walk-in Store</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <span className="text-3xl block">🏪</span>
                <p className="font-extrabold text-slate-700 text-xs">No Retail Shop Prices Reported in {selectedArea} Yet</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Merchant shelf prices appear here as local grocery stores report daily prices.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 4: CROSS-MARKET COMMODITY COMPARISON
          ========================================================================= */}
      {activeSection === 'comparison' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-indigo-600" />
                  <span>Cross-Market APMC Price Comparison: {comparisonCommodity}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Compare modal prices of the same agricultural commodity across different mandis and states.
                </p>
              </div>

              {/* Quick Commodity Selector for Comparison */}
              <div className="flex items-center gap-1">
                {['Tomato', 'Potato', 'Onion', 'Apple', 'Wheat'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => loadComparison(c)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      comparisonCommodity === c
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {loadingComparison ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                <span>Comparing prices across APMC mandis...</span>
              </div>
            ) : comparisonData ? (
              <div className="space-y-4">
                {/* Comparison Highlights Banner */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <p className="text-[10px] font-bold text-emerald-800 uppercase">Lowest Market Price</p>
                    <p className="text-base font-extrabold text-emerald-900 mt-0.5">
                      {comparisonData.lowest_market.display}
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-1">
                      {comparisonData.lowest_market.mandi} ({comparisonData.lowest_market.state})
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                    <p className="text-[10px] font-bold text-rose-800 uppercase">Highest Market Price</p>
                    <p className="text-base font-extrabold text-rose-900 mt-0.5">
                      {comparisonData.highest_market.display}
                    </p>
                    <p className="text-[11px] text-rose-700 mt-1">
                      {comparisonData.highest_market.mandi} ({comparisonData.highest_market.state})
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
                    <p className="text-[10px] font-bold text-indigo-800 uppercase">National Average & Spread</p>
                    <p className="text-base font-extrabold text-indigo-900 mt-0.5">
                      ₹{comparisonData.average_modal_price_kg} / kg
                    </p>
                    <p className="text-[11px] text-indigo-700 mt-1">
                      Spread: ₹{comparisonData.price_spread_kg}/kg across {comparisonData.total_markets_compared} mandis
                    </p>
                  </div>
                </div>

                {/* All Compared Markets Table */}
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 font-bold">
                        <th className="py-2">Mandi / Market</th>
                        <th className="py-2">State & District</th>
                        <th className="py-2">Variety</th>
                        <th className="py-2">Wholesale (₹/Quintal)</th>
                        <th className="py-2">Consumer Rate (₹/kg)</th>
                        <th className="py-2 text-right">Reporting Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonData.all_markets.map((m, idx) => (
                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/60 transition">
                          <td className="py-2.5 font-bold text-slate-800">{m.mandi}</td>
                          <td className="py-2.5 text-slate-600">{m.district ? `${m.district}, ` : ''}{m.state}</td>
                          <td className="py-2.5 text-slate-500">{m.variety || 'Standard'}</td>
                          <td className="py-2.5 font-bold text-slate-900">
                            ₹{m.raw_modal_price_quintal.toLocaleString('en-IN')} / Quintal
                          </td>
                          <td className="py-2.5">
                            <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              ₹{m.modal_price_kg.toFixed(2)} / kg
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-slate-400">{m.reporting_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
