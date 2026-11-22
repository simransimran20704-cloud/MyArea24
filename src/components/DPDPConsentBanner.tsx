import React, { useState, useEffect } from 'react';
import { Shield, Lock, MapPin, Bell, BarChart2, Check, X, Sliders, Trash2 } from 'lucide-react';
import { getApiBaseUrl } from '../config/apiClient';

export interface ConsentPreferences {
  location: boolean;
  notifications: boolean;
  analytics: boolean;
  consentTimestamp: string;
}

const CONSENT_STORAGE_KEY = 'myarea24_dpdp_consent';
export const CONSENT_UPDATED_EVENT = 'myarea24_consent_updated';
export const OPEN_CONSENT_EVENT = 'myarea24_open_consent_preferences';

function getOrGenerateUserHash(): string {
  try {
    let hash = localStorage.getItem('myarea24_anon_user_hash');
    if (!hash) {
      hash = 'u_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem('myarea24_anon_user_hash', hash);
    }
    return hash;
  } catch {
    return 'u_anonymous_guest';
  }
}

export const DPDPConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prefs, setPrefs] = useState<ConsentPreferences>({
    location: true,
    notifications: true,
    analytics: true,
    consentTimestamp: new Date().toISOString(),
  });
  const [erasureStatus, setErasureStatus] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (!stored) {
        // Show banner after brief delay for smooth appearance
        const timer = setTimeout(() => setIsVisible(true), 1200);
        return () => clearTimeout(timer);
      } else {
        setPrefs(JSON.parse(stored));
      }
    } catch {
      setIsVisible(true);
    }
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      setIsModalOpen(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, handleOpen);
  }, []);

  const saveConsent = async (updated: ConsentPreferences) => {
    setPrefs(updated);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: updated }));
    setIsVisible(false);
    setIsModalOpen(false);

    // Sync to backend DPDP consent audit log
    const base = getApiBaseUrl();
    if (!base) return;

    const userHash = getOrGenerateUserHash();
    const consentPayloads = [
      { consent_type: 'LOCATION', status: updated.location ? 'GRANTED' : 'REVOKED' },
      { consent_type: 'NOTIFICATIONS', status: updated.notifications ? 'GRANTED' : 'REVOKED' },
      { consent_type: 'ANALYTICS', status: updated.analytics ? 'GRANTED' : 'REVOKED' },
    ];

    for (const p of consentPayloads) {
      try {
        await fetch(`${base}/api/v1/consent/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_hash: userHash,
            consent_type: p.consent_type,
            status: p.status,
            dpdp_notice_version: '1.0',
          }),
        });
      } catch {}
    }
  };

  const handleAcceptAll = () => {
    saveConsent({
      location: true,
      notifications: true,
      analytics: true,
      consentTimestamp: new Date().toISOString(),
    });
  };

  const handleEssentialOnly = () => {
    saveConsent({
      location: false,
      notifications: false,
      analytics: false,
      consentTimestamp: new Date().toISOString(),
    });
  };

  const handleRightToErasure = async () => {
    if (!window.confirm('Under DPDP Act Section 12, this will purge your saved locations, consent records, and cached identifiers. Continue?')) {
      return;
    }
    setErasureStatus('Processing data erasure...');
    const userHash = getOrGenerateUserHash();
    const base = getApiBaseUrl();
    try {
      if (base) {
        await fetch(`${base}/api/v1/consent/erasure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_hash: userHash,
            confirm_text: 'DELETE_ALL_MY_DATA',
          }),
        });
      }
      localStorage.clear();
      sessionStorage.clear();
      setErasureStatus('All personal and session records erased successfully.');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch {
      setErasureStatus('Local data purged. Connection to server was offline.');
    }
  };

  return (
    <>
      {/* Floating Bottom Consent Banner (Initial visit) */}
      {isVisible && !isModalOpen && (
        <aside
          role="dialog"
          aria-label="Data Privacy Consent"
          className="fixed bottom-3 inset-x-3 sm:bottom-5 sm:inset-x-auto sm:right-6 sm:max-w-xl z-50 animate-fade-in-up"
        >
          <div className="bg-slate-900/95 text-white p-4 sm:p-5 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-400 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white">Your Privacy Rights (DPDP Act 2023)</h4>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    India
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  MyArea24 uses approximate location to discover verified stores within 15 km, deliver civic alerts, and measure platform performance. We never sell your personal data.
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-3.5">
                  <button
                    type="button"
                    onClick={handleAcceptAll}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
                  >
                    Accept All
                  </button>
                  <button
                    type="button"
                    onClick={handleEssentialOnly}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                  >
                    Essential Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition cursor-pointer ml-auto"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Customize</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Comprehensive DPDP Preference & Section 12 Erasure Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden text-slate-800">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Privacy & Consent Preferences</h3>
                  <p className="text-[11px] text-slate-500">Digital Personal Data Protection Act 2023</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content & Granular Toggles */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-slate-600 leading-relaxed">
                You have the statutory right under India’s DPDP Act 2023 to grant, deny, or revoke consent for each processing purpose at any time.
              </p>

              {/* Strictly Essential Civic Services & Safety Protocol (Always Checked & Locked) */}
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Shield className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-bold text-xs text-slate-900">Essential Civic Services & Safety Protocol</h5>
                      <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Always Active / Required
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Strictly necessary for local routing, emergency hospital SOS discovery, encrypted session tokens, and core cyber security. Cannot be disabled.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  className="w-4 h-4 text-emerald-600 rounded border-emerald-300 cursor-not-allowed mt-1 opacity-90"
                />
              </div>

              {/* Location Consent */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Hyperlocal Proximity Location</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Used strictly on-device to rank nearest stores, verify distance delivery rates, and locate events within 15 km.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.location}
                  onChange={(e) => setPrefs({ ...prefs, location: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer mt-1"
                />
              </div>

              {/* Civic Notifications */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Bell className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Civic & Emergency Alerts</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Receive weather warnings, NDMA SACHET disaster notices, and order status updates with frequency throttling.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.notifications}
                  onChange={(e) => setPrefs({ ...prefs, notifications: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer mt-1"
                />
              </div>

              {/* Anonymous Analytics */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <BarChart2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Anonymous Usage Telemetry</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Aggregated search frequency and page visits to improve discovery. Zero PII, no cross-site profiling.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.analytics}
                  onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer mt-1"
                />
              </div>

              {/* DPDP Section 12 Right to Erasure */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-xs text-rose-700 flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      DPDP Section 12: Right to Erasure
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      Request immediate deletion of all session tokens, consent logs, and local caches.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRightToErasure}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                  >
                    Purge My Data
                  </button>
                </div>
                {erasureStatus && (
                  <p className="text-[11px] font-semibold text-emerald-600 mt-2 bg-emerald-50 p-2 rounded-lg">
                    {erasureStatus}
                  </p>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={handleEssentialOnly}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Deny Optional
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveConsent(prefs)}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
