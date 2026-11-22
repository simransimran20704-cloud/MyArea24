import React, { useState, useEffect } from 'react';
import { Bell, ShieldAlert, X } from 'lucide-react';

const NOTIF_PROMPT_KEY = 'myarea24_notif_prompt_seen';

export const NotificationPermissionPrompt: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(NOTIF_PROMPT_KEY);
      if (!seen && typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          // Trigger after 4 seconds for non-intrusive timing
          const timer = setTimeout(() => setIsVisible(true), 4000);
          return () => clearTimeout(timer);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(NOTIF_PROMPT_KEY, 'true');
    } catch {}
  };

  const handleEnableNotifications = async () => {
    handleDismiss();
    try {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          // Optional confirmation toast
        }
      }
    } catch {}
  };

  return (
    <aside
      role="dialog"
      aria-label="Notification Permission"
      className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 max-w-sm w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 text-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Bell className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-slate-900 leading-tight">
              Real-time Civic Alerts
            </h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Stay informed with instant alerts for air quality surges, weather advisories, emergency updates, and neighborhood bulletins.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss notification prompt"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3.5">
          <button
            type="button"
            onClick={handleEnableNotifications}
            className="py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Enable Alerts</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <span>Maybe Later</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
