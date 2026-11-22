import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Phone,
  Navigation,
  HeartPulse,
  Activity,
  Building2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Droplet,
  Truck,
  ShieldAlert,
  Info,
} from 'lucide-react';

export interface HospitalItem {
  id: number;
  sr_no?: number;
  hospital_name: string;
  care_type: string;
  discipline_system: string;
  hospital_category?: string;
  state: string;
  district: string;
  subdistrict?: string;
  pincode?: string;
  address: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  distance_text: string;
  telephone?: string;
  mobile_number?: string;
  emergency_num?: string;
  ambulance_phone?: string;
  bloodbank_phone?: string;
  primary_phone: string;
  tollfree?: string;
  helpline?: string;
  email?: string;
  website?: string;
  specialties?: string;
  facilities?: string;
  accreditation?: string;
  total_beds: number;
  has_emergency: boolean;
  has_bloodbank: boolean;
  has_ambulance: boolean;
  direction_link: string;
  source_name: string;
  ogd_resource_id: string;
}

export interface NationalHospitalDirectoryModuleProps {
  selectedArea?: string;
  userLat?: number;
  userLon?: number;
  onOpenModal?: (modalData: any) => void;
}

export const NationalHospitalDirectoryModule: React.FC<NationalHospitalDirectoryModuleProps> = ({
  selectedArea = 'All India',
  userLat = 28.6139,
  userLon = 77.2090,
  onOpenModal,
}) => {
  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('All India');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('All Districts');
  const [selectedCareType, setSelectedCareType] = useState<string>('All');
  const [selectedSystem, setSelectedSystem] = useState<string>('All');
  const [pincodeQuery, setPincodeQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('nearest');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Capability Filters
  const [emergencyOnly, setEmergencyOnly] = useState<boolean>(false);
  const [bloodbankOnly, setBloodbankOnly] = useState<boolean>(false);
  const [ambulanceOnly, setAmbulanceOnly] = useState<boolean>(false);

  // Pagination & Data States
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [filterOptions, setFilterOptions] = useState<{
    states: string[];
    districts: string[];
    care_types: string[];
    systems: string[];
    total_records: number;
  }>({
    states: ['All India'],
    districts: ['All Districts'],
    care_types: ['All'],
    systems: ['All'],
    total_records: 30273,
  });

  // 1. Fetch Filter Options on Mount or when State changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedState !== 'All India') {
      params.append('state', selectedState);
    }

    fetch(`/api/v1/hospitals/filter-options?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setFilterOptions({
            states: ['All India', ...(data.states || [])],
            districts: ['All Districts', ...(data.districts || [])],
            care_types: ['All', ...(data.care_types || [])],
            systems: ['All', ...(data.systems || [])],
            total_records: data.total_records || 30273,
          });
        }
      })
      .catch((err) => console.error('Failed to load hospital filter options:', err));
  }, [selectedState]);

  // Reset page when any filter changes
  useEffect(() => {
    setPage(1);
  }, [
    searchQuery,
    selectedState,
    selectedDistrict,
    selectedCareType,
    selectedSystem,
    pincodeQuery,
    sortBy,
    emergencyOnly,
    bloodbankOnly,
    ambulanceOnly,
  ]);

  // 2. Fetch Hospitals
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('search', searchQuery.trim());
    if (selectedState !== 'All India') params.append('state', selectedState);
    if (selectedDistrict !== 'All Districts' && selectedDistrict.trim()) {
      params.append('district', selectedDistrict.trim());
    }
    if (selectedCareType !== 'All') params.append('care_type', selectedCareType);
    if (selectedSystem !== 'All') params.append('discipline_system', selectedSystem);
    if (pincodeQuery.trim()) params.append('pincode', pincodeQuery.trim());
    if (emergencyOnly) params.append('has_emergency_only', 'true');
    if (bloodbankOnly) params.append('has_bloodbank_only', 'true');
    if (ambulanceOnly) params.append('has_ambulance_only', 'true');

    if (userLat && userLon) {
      params.append('lat', userLat.toString());
      params.append('lon', userLon.toString());
    }
    params.append('sort_by', sortBy);
    params.append('page', page.toString());
    params.append('limit', '30');

    fetch(`/api/v1/hospitals/directory?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.hospitals)) {
          setHospitals(data.hospitals);
          setTotalCount(data.total || data.hospitals.length);
        } else {
          setHospitals([]);
          setTotalCount(0);
        }
      })
      .catch((err) => {
        console.error('Error fetching national hospital directory:', err);
        setHospitals([]);
      })
      .finally(() => setLoading(false));
  }, [
    searchQuery,
    selectedState,
    selectedDistrict,
    selectedCareType,
    selectedSystem,
    pincodeQuery,
    sortBy,
    emergencyOnly,
    bloodbankOnly,
    ambulanceOnly,
    page,
    userLat,
    userLon,
  ]);

  const handleFacilityClick = (hospital: HospitalItem) => {
    if (onOpenModal) {
      onOpenModal({
        title: hospital.hospital_name,
        subtitle: `${hospital.care_type} • ${hospital.discipline_system} • ${hospital.district}, ${hospital.state}`,
        category: 'National Hospital Directory (Verified)',
        phone: hospital.primary_phone,
        location: `${hospital.address} (${hospital.distance_text})`,
        address: hospital.address,
        description: `${hospital.hospital_name} is an authorized healthcare institution under the Verified National Healthcare Network. Total Bed Capacity: ${
          hospital.total_beds > 0 ? hospital.total_beds : 'Not specified'
        }. Emergency Services: ${hospital.has_emergency ? '24/7 Active' : 'Standard Hours'}. Blood Bank: ${
          hospital.has_bloodbank ? 'Available' : 'None reported'
        }. Ambulance Fleet: ${hospital.has_ambulance ? 'Available' : 'None reported'}.`,
        primaryActionLabel: `Dial ${hospital.primary_phone}`,
        actionUrl: hospital.direction_link,
      });
    } else {
      window.open(hospital.direction_link, '_blank', 'noopener,noreferrer');
    }
  };

  const getCareBadgeStyle = (care: string) => {
    const c = (care || '').toLowerCase();
    if (c.includes('hospital')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (c.includes('community') || c.includes('chc')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (c.includes('primary') || c.includes('phc')) return 'bg-teal-50 text-teal-700 border-teal-200';
    if (c.includes('dispensary')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-4">
      {/* Header Banner & Data Provenance */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-200/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-extrabold text-base">
                🏥
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  National Hospital Directory (Verified)
                </h3>
                <p className="text-xs text-slate-500">
                  Comprehensive all-India directory: verified government & private hospitals, bed capacity, emergency, blood bank & ambulance
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-extrabold flex items-center gap-1 border border-emerald-200/60">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {filterOptions.total_records.toLocaleString()}+ Facilities in Central Registry
            </span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                  viewMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Table
              </button>
            </div>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
          {/* 1. Name or Address Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search hospital name, locality, address, specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
            />
          </div>

          {/* 2. State Filter */}
          <div>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict('All Districts');
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white font-semibold text-slate-800"
            >
              {filterOptions.states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* 3. District Filter (Dependent) */}
          <div>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={filterOptions.districts.length <= 1}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white font-semibold text-slate-800 disabled:opacity-50"
            >
              {filterOptions.districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Care Type */}
          <div>
            <select
              value={selectedCareType}
              onChange={(e) => setSelectedCareType(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white font-semibold text-slate-800"
            >
              {filterOptions.care_types.map((c) => (
                <option key={c} value={c}>
                  {c === 'All' ? 'All Facility Types' : c}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white font-semibold text-slate-800"
            >
              <option value="nearest">Distance (Nearest First)</option>
              <option value="beds_desc">Total Beds (High to Low)</option>
              <option value="name_asc">Facility Name (A to Z)</option>
            </select>
          </div>
        </div>

        {/* Secondary Toggles & Quick Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mt-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEmergencyOnly(!emergencyOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                emergencyOnly
                  ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              24/7 Emergency Care
            </button>

            <button
              type="button"
              onClick={() => setBloodbankOnly(!bloodbankOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                bloodbankOnly
                  ? 'bg-red-50 border-red-300 text-red-700 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Droplet className="w-3.5 h-3.5 text-red-600" />
              Blood Bank Facility
            </button>

            <button
              type="button"
              onClick={() => setAmbulanceOnly(!ambulanceOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                ambulanceOnly
                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              Ambulance Services
            </button>

            {/* Medicine System Selector */}
            <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium">System:</span>
              <select
                value={selectedSystem}
                onChange={(e) => setSelectedSystem(e.target.value)}
                className="px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
              >
                {filterOptions.systems.map((sys) => (
                  <option key={sys} value={sys}>
                    {sys === 'All' ? 'All Systems' : sys}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick PIN Code Input */}
          <div className="w-full sm:w-44">
            <input
              type="text"
              placeholder="Filter by PIN code..."
              value={pincodeQuery}
              onChange={(e) => setPincodeQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Results Header Count & Loading State */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <p>
          Showing <span className="font-bold text-slate-900">{hospitals.length}</span> of{' '}
          <span className="font-bold text-slate-900">{totalCount}</span> facilities matching criteria
        </p>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          Verified source: National Healthcare Directory
        </span>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-card border border-slate-200/70">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600 mb-2"></div>
          <p className="text-xs font-semibold text-slate-600">Querying National Hospital Directory...</p>
        </div>
      ) : hospitals.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-card border border-slate-200/70">
          <span className="text-3xl mb-2 block">🏥</span>
          <p className="font-extrabold text-slate-800 text-sm">No Facilities Found</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            No hospitals match the selected state, district, or criteria. Try resetting filters or switching to All India.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedState('All India');
              setSelectedDistrict('All Districts');
              setSelectedCareType('All');
              setSelectedSystem('All');
              setSearchQuery('');
              setPincodeQuery('');
              setEmergencyOnly(false);
              setBloodbankOnly(false);
              setAmbulanceOnly(false);
            }}
            className="mt-3 px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {hospitals.map((h) => (
            <div
              key={h.id}
              className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70 hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                {/* Badges Row */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${getCareBadgeStyle(
                      h.care_type
                    )}`}
                  >
                    {h.care_type}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {h.total_beds > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold">
                        🛏️ {h.total_beds} Beds
                      </span>
                    )}
                    {h.distance_text !== 'Distance unavailable' && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {h.distance_text}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hospital Name & Location */}
                <h4 className="font-extrabold text-slate-900 text-sm leading-snug line-clamp-2">
                  {h.hospital_name}
                </h4>

                <p className="text-[11px] text-slate-500 mt-1 flex items-start gap-1 line-clamp-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{h.address}</span>
                </p>

                {/* Specialties or System */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200 text-[10px]">
                    System: <span className="font-bold text-slate-800">{h.discipline_system}</span>
                  </span>
                  {h.accreditation && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                      ★ {h.accreditation}
                    </span>
                  )}
                </div>

                {/* Feature Pills */}
                <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-slate-100 text-center">
                  <div
                    className={`p-1.5 rounded-lg border text-[10px] font-bold flex flex-col items-center gap-0.5 ${
                      h.has_emergency
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-slate-50 border-slate-100 text-slate-400'
                    }`}
                  >
                    <span>⚡ Emergency</span>
                    <span className="text-[9px] font-normal">
                      {h.has_emergency ? '24/7 Available' : 'Standard'}
                    </span>
                  </div>

                  <div
                    className={`p-1.5 rounded-lg border text-[10px] font-bold flex flex-col items-center gap-0.5 ${
                      h.has_bloodbank
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-slate-50 border-slate-100 text-slate-400'
                    }`}
                  >
                    <span>🩸 Blood Bank</span>
                    <span className="text-[9px] font-normal">
                      {h.has_bloodbank ? 'Operational' : 'Unavailable'}
                    </span>
                  </div>

                  <div
                    className={`p-1.5 rounded-lg border text-[10px] font-bold flex flex-col items-center gap-0.5 ${
                      h.has_ambulance
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-slate-50 border-slate-100 text-slate-400'
                    }`}
                  >
                    <span>🚑 Ambulance</span>
                    <span className="text-[9px] font-normal">
                      {h.has_ambulance ? 'Fleet Active' : 'Unavailable'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
                <a
                  href={`tel:${h.primary_phone}`}
                  className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call {h.primary_phone}</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleFacilityClick(h)}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5 text-slate-600" />
                  <span>Directions & Info</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl shadow-card border border-slate-200/70 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4 font-bold">Facility Name</th>
                  <th className="py-3 px-3 font-bold">Care Type</th>
                  <th className="py-3 px-3 font-bold">State / District</th>
                  <th className="py-3 px-3 font-bold text-center">Beds</th>
                  <th className="py-3 px-3 font-bold text-center">Emergency</th>
                  <th className="py-3 px-3 font-bold text-center">Blood Bank</th>
                  <th className="py-3 px-3 font-bold">Primary Phone</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hospitals.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4">
                      <p className="font-extrabold text-slate-900">{h.hospital_name}</p>
                      <p className="text-[10px] text-slate-500 truncate max-w-xs">{h.address}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getCareBadgeStyle(
                          h.care_type
                        )}`}
                      >
                        {h.care_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      <p className="font-semibold">{h.district}</p>
                      <p className="text-[10px] text-slate-400">{h.state}</p>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {h.total_beds > 0 ? (
                        <span className="font-extrabold text-slate-900">{h.total_beds}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {h.has_emergency ? (
                        <span className="text-emerald-600 font-bold">● 24/7</span>
                      ) : (
                        <span className="text-slate-400">Regular</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {h.has_bloodbank ? (
                        <span className="text-rose-600 font-bold">● Available</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      <a href={`tel:${h.primary_phone}`} className="hover:underline flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {h.primary_phone}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleFacilityClick(h)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition cursor-pointer"
                      >
                        Details →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {totalCount > 30 && (
        <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">
          <p className="text-xs text-slate-500">
            Page <span className="font-bold text-slate-900">{page}</span> of{' '}
            <span className="font-bold text-slate-900">{Math.ceil(totalCount / 30)}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= Math.ceil(totalCount / 30)}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
