import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Compass, X } from 'lucide-react';
import { reverseGeocodeLive } from '../services/liveIntelligence';
import { UserLocation } from '../types';

interface LocationPermissionPromptProps {
  onLocationResolved: (loc: UserLocation) => void;
  onOpenManualSelector: () => void;
}

const PROMPT_DISMISSED_KEY = 'myarea24_location_prompt_seen';

export const LocationPermissionPrompt: React.FC<LocationPermissionPromptProps> = ({
  onLocationResolved,
  onOpenManualSelector,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(PROMPT_DISMISSED_KEY);
      if (!seen) {
        // Show non-intrusive popup after 1.5 seconds on initial load
        const timer = setTimeout(() => setIsVisible(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, []);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
    } catch {}
  };

  const handleAllowLocation = () => {
    setIsLocating(true);
    handleDismiss();

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setIsLocating(false);
          try {
            const loc = await reverseGeocodeLive(pos.coords.latitude, pos.coords.longitude);
            onLocationResolved(loc);
          } catch {
            onLocationResolved({
              id: 'loc-default',
              label: 'Connaught Place',
              areaName: 'Connaught Place, New Delhi',
              fullAddress: 'Connaught Place, New Delhi, Delhi - 110001',
              pincode: '110001',
              coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            });
          }
        },
        () => {
          setIsLocating(false);
          // If denied, gracefully trigger manual selector
          onOpenManualSelector();
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setIsLocating(false);
      onOpenManualSelector();
    }
  };

  const handleSelectManually = () => {
    handleDismiss();
    onOpenManualSelector();
  };

  return (
    <aside
      role="dialog"
      aria-label="Location Permission"
      className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-50 max-w-sm w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 text-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-slate-900 leading-tight">
              Discover Your Neighborhood
            </h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Allow location to view live mandis, verified kirana stores, 24x7 hospitals, and real-time civic alerts near you.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss location prompt"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3.5">
          <button
            type="button"
            onClick={handleAllowLocation}
            disabled={isLocating}
            className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>{isLocating ? 'Locating...' : 'Allow Location'}</span>
          </button>
          <button
            type="button"
            onClick={handleSelectManually}
            className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-slate-500" />
            <span>Select Manually</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
