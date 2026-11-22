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

export const EventsDashboard: React.FC<DashboardCommonProps> = ({
  onNavigate,
  onOpenMerchantRegistration,
  onOpenModal,
  onAskAi,
  selectedArea,
  liveIntel,
  marketplace: propMarketplace,
}) => {
  const marketplace = propMarketplace || EMPTY_MARKETPLACE;

  const [selectedCat, setSelectedCat] = useState('All Events');
  const [selectedDateFilter, setSelectedDateFilter] = useState<'All' | 'Today' | 'Tomorrow' | 'This Weekend' | 'Upcoming'>('All');
  const [selectedDay, setSelectedDay] = useState(16);

  const shortArea = selectedArea.split(',')[0]?.trim() || selectedArea;

  const dateFilters: Array<'All' | 'Today' | 'Tomorrow' | 'This Weekend' | 'Upcoming'> = [
    'All',
    'Today',
    'Tomorrow',
    'This Weekend',
    'Upcoming',
  ];

  const eventCats = [
    'All Events',
    'Hackathons & Contests',
    'Festivals & Fairs',
    'Concerts & Music',
    'Movies & Cinema Announcements',
    'Comedy Shows',
    'Theatre & Drama',
    'Exhibitions',
    'College Fests & Workshops',
    'Sports & Public Activities',
    'Community Events',
    'Family Entertainment',
  ];

  const filteredEvents = marketplace.events.filter((e) => {
    let matchesCat = false;
    if (selectedCat === 'All Events') {
      matchesCat = true;
    } else if (selectedCat === 'Hackathons & Contests') {
      const text = `${e.title} ${e.cat} ${e.source} ${e.time} ${e.loc}`.toLowerCase();
      matchesCat =
        text.includes('hackathon') ||
        text.includes('contest') ||
        text.includes('competition') ||
        text.includes('quiz') ||
        text.includes('challenge') ||
        text.includes('case study') ||
        text.includes('coding') ||
        text.includes('brabble') ||
        text.includes('unstop') ||
        text.includes('devpost') ||
        text.includes('codechef');
    } else {
      matchesCat =
        e.cat.toLowerCase().includes(selectedCat.toLowerCase()) ||
        selectedCat.toLowerCase().includes(e.cat.toLowerCase());
    }

    if (!matchesCat) return false;

    if (selectedDateFilter === 'All') return true;

    if (!e.startTimeIso) return true;
    const evDate = new Date(e.startTimeIso);
    if (isNaN(evDate.getTime())) return true;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const eventDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());

    if (selectedDateFilter === 'Today') {
      return eventDay.getTime() === today.getTime();
    }
    if (selectedDateFilter === 'Tomorrow') {
      return eventDay.getTime() === tomorrow.getTime();
    }
    if (selectedDateFilter === 'This Weekend') {
      const dayOfWeek = today.getDay();
      const sat = new Date(today);
      const sun = new Date(today);
      if (dayOfWeek === 0) {
        sat.setDate(today.getDate() - 1);
        sun.setDate(today.getDate());
      } else {
        const daysToSat = 6 - dayOfWeek;
        sat.setDate(today.getDate() + daysToSat);
        sun.setDate(today.getDate() + daysToSat + 1);
      }
      return eventDay.getTime() === sat.getTime() || eventDay.getTime() === sun.getTime();
    }
    if (selectedDateFilter === 'Upcoming') {
      return eventDay.getTime() >= today.getTime();
    }

    return true;
  });

  return (
    <div className="space-y-4">
      <HeroBanner
        dashboardId="events"
        tag={
          <>
            <MapPin className="w-3.5 h-3.5 text-blue-300" />
            <span>{selectedArea}</span>
          </>
        }
        title={
          <>
            Local Events,
            <br />
            <span className="text-[#93C5FD]">Closer to You</span>
          </>
        }
        description={`Discover concerts, farmers markets, RWA meetups & health camps in ${shortArea} — enriched with live Contextual Event Intelligence (parking, traffic & dispersal weather).`}
        rightWidget={
          <div className="bg-slate-900/55 backdrop-blur-md border border-white/20 rounded-2xl p-4 w-full lg:w-[330px] space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/15">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/30 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-200" />
                </div>
                <div>
                  <p className="text-xl font-extrabold text-white leading-none">{marketplace.events.length}</p>
                  <p className="text-xs text-blue-100 mt-0.5">Live events in {shortArea}</p>
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/20 text-white text-xs font-extrabold flex items-center gap-1">
                <span>Neighborhood Calendar</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-blue-100">
              <span>🎉 Festivals</span>
              <span>🎨 Workshops</span>
              <span>🎵 Live Music</span>
              <span>🤝 RWA Civic</span>
            </div>
          </div>
        }
      />

      {/* Date Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0 mr-1">Filter Date:</span>
        {dateFilters.map((df) => (
          <button
            key={df}
            type="button"
            onClick={() => setSelectedDateFilter(df)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition cursor-pointer ${
              selectedDateFilter === df
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            {df}
          </button>
        ))}
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {eventCats.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCat(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition cursor-pointer ${
              selectedCat === cat
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8 space-y-4">
          {/* Featured Events Near You with Contextual Event Intelligence */}
          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> Events Near {shortArea} ({filteredEvents.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Discover upcoming activities, workshops, and community gatherings
                </p>
              </div>
              <span className="text-xs font-semibold text-blue-600">● Live Feed</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3.5">
              {filteredEvents.length === 0 ? (
                <div className="col-span-1 sm:col-span-2 p-8 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">
                    No verified events found in {selectedCat !== 'All Events' ? selectedCat : selectedDateFilter !== 'All' ? selectedDateFilter : 'active filter'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Showing only authentic live events verified from connected discovery sources around {shortArea}. No simulated or unverified listings are displayed.
                  </p>
                  {(selectedCat !== 'All Events' || selectedDateFilter !== 'All') && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCat('All Events');
                          setSelectedDateFilter('All');
                        }}
                        className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer shadow-sm"
                      >
                        Show All Events ({marketplace.events.length})
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-xl border border-slate-200/80 overflow-hidden bg-white flex flex-col justify-between hover:shadow-md transition"
                >
                  <div>
                    <div className="relative h-32">
                      <img src={ev.img} alt={ev.title} className="w-full h-full object-cover" />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/85 text-white text-[10px] font-extrabold">
                        {ev.date} • {ev.price}
                      </span>
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-emerald-500 text-white text-[9px] font-bold">
                        👥 {ev.rsvp}
                      </span>
                    </div>
                    <div className="p-3">
                      <span className="text-[10px] font-extrabold text-indigo-600 uppercase">{ev.cat}</span>
                      <h4 className="text-xs font-extrabold text-slate-900 mt-0.5">{ev.title}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">🕒 {ev.time}</p>
                      <p className="text-[10px] text-slate-500 truncate">📍 {ev.loc} ({ev.dist})</p>

                      {/* Contextual Event Intelligence Box */}
                      <div className="mt-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200/60 space-y-1 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-semibold">🅿️ Parking Pressure:</span>
                          <span
                            className={`font-extrabold ${
                              ev.parkingPressure === 'LOW' ? 'text-emerald-600' : 'text-amber-600'
                            }`}
                          >
                            {ev.parkingPressure} (~{ev.expectedAttendance} expected)
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-semibold">🛣️ Corridor:</span>
                          <span className="font-bold text-slate-800 truncate max-w-[160px]">{ev.commuteCorridor}</span>
                        </div>
                        <p className="text-slate-600 truncate">🌦️ {ev.exitWeatherAdvisory}</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 pb-3">
                    {ev.registrationUrl && (
                      <a
                        href={ev.registrationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full mb-1.5 py-1 text-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 transition block"
                      >
                        Official Details / RSVP ↗
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onOpenModal({
                          title: ev.title,
                          subtitle: `${ev.cat} • Organized by ${ev.organizer}`,
                          category: `Community Event Intelligence`,
                          badge: ev.price,
                          location: `${ev.loc} • ${ev.time}`,
                          description: `👥 Expected Attendance: ~${ev.expectedAttendance} people\n🅿️ Parking Pressure: ${ev.parkingPressure}\n🚗 Arterial Traffic Impact: ${ev.trafficImpact} on ${ev.commuteCorridor}\n🌦️ Exit Weather Advisory: ${ev.exitWeatherAdvisory}`,
                          primaryActionLabel: ev.registrationUrl ? 'Open Official Booking Link' : 'Confirm Free RSVP / Pass',
                          image: ev.img,
                          address: ev.loc,
                          source: ev.source || 'Local Community Notice',
                          verified: true,
                          freshnessLabel: ev.time,
                        })
                      }
                      className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      RSVP & View Event Intelligence
                    </button>
                  </div>
                </div>
              )))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Interactive Map + Calendar + Highlights */}
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">
            <h3 className="text-sm font-extrabold text-slate-900 mb-2.5">Event Venues Around {shortArea}</h3>
            <InteractiveMap
              heightClass="h-52"
              centerLabel={selectedArea}
              centerCoords={{ lat: liveIntel.location.lat, lng: liveIntel.location.lng }}
              pois={liveIntel.nearbyPois}
              showSearchBottomButton={false}
            />
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold text-slate-900">Events Calendar</h3>
              <span className="text-xs font-semibold text-blue-600">{shortArea}</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400 mb-1.5">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {(() => {
                const eventDays = new Set(
                  marketplace.events
                    .map((e) => {
                      const match = e.date?.match(/\b(\d{1,2})\b/);
                      return match ? parseInt(match[1], 10) : null;
                    })
                    .filter((d): d is number => d !== null)
                );
                return Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
                  const hasEvent = eventDays.has(day);
                  const isSelected = selectedDay === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`h-7 rounded-full flex flex-col items-center justify-center font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white font-bold shadow'
                          : hasEvent
                          ? 'bg-indigo-50 text-indigo-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{day}</span>
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <span>✨</span> Ask AI About Local Events
              </h3>
            </div>
            <div className="space-y-2">
              {[
                { title: `Weekend family events in ${shortArea}`, sub: 'Check weather & parking before stepping out', icon: '👨‍👩‍👧' },
                { title: `Free health & RWA camps in ${shortArea}`, sub: 'Community wellness schedules', icon: '🏥' },
                { title: `Live music & food fests near ${shortArea}`, sub: 'Evening dispersal traffic check', icon: '🎵' },
              ].map((hl) => (
                <div
                  key={hl.title}
                  onClick={() => onAskAi(hl.title)}
                  className="cursor-pointer p-2 rounded-xl hover:bg-slate-50 flex items-center justify-between gap-2 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-base shrink-0">
                      {hl.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{hl.title}</p>
                      <p className="text-[10px] text-slate-500 truncate">{hl.sub}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

