import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ShieldCheck } from 'lucide-react';
import { getStoredAuthUser } from '../services/authService';

interface AuthPermissionPromptProps {
  onOpenAuth: () => void;
  onDismiss?: () => void;
}

const AUTH_PROMPT_KEY = 'myarea24_auth_permission_prompt_seen';

export const AuthPermissionPrompt: React.FC<AuthPermissionPromptProps> = ({
  onOpenAuth,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    try {
      // 1. If user is already authenticated, never show prompt
      const currentUser = getStoredAuthUser();
      if (currentUser) {
        return;
      }

      // 2. Check if user already dismissed in this session
      const alreadySeen = sessionStorage.getItem(AUTH_PROMPT_KEY);
      if (alreadySeen) {
        return;
      }

      // 3. Trigger prompt shortly after initial website start
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 700);

      return () => clearTimeout(timer);
    } catch {
      // ignore
    }
  }, []);

  if (!isVisible) {
    return null;
  }

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      sessionStorage.setItem(AUTH_PROMPT_KEY, 'true');
    } catch {}
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleOpenAuth = () => {
    setIsVisible(false);
    try {
      sessionStorage.setItem(AUTH_PROMPT_KEY, 'true');
    } catch {}
    onOpenAuth();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account Login or Registration Prompt"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-7 overflow-hidden text-slate-800">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600" />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
          aria-label="Do it later and close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Dialog Header & Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/20 mb-4">
            🔐
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Fast & Secure Verification</span>
          </div>

          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            Log In or Sign Up?
          </h3>

          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-sm">
            Would you like to log in now to save your preferred routes, track orders, and view personalized market rates, or continue as a guest and do it later?
          </p>

          {/* Quick Perks */}
          <div className="w-full grid grid-cols-2 gap-2 my-5 text-left text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
              <span className="text-base shrink-0">⚡</span>
              <div>
                <p className="font-bold text-slate-900 text-[11px] leading-tight">Instant OTP</p>
                <p className="text-[10px] text-slate-400">Passwordless sign in</p>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
              <span className="text-base shrink-0">📍</span>
              <div>
                <p className="font-bold text-slate-900 text-[11px] leading-tight">Saved Routes</p>
                <p className="text-[10px] text-slate-400">Daily traffic monitor</p>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
              <span className="text-base shrink-0">🥦</span>
              <div>
                <p className="font-bold text-slate-900 text-[11px] leading-tight">Mandi Rates</p>
                <p className="text-[10px] text-slate-400">Direct price savings</p>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
              <span className="text-base shrink-0">🛍️</span>
              <div>
                <p className="font-bold text-slate-900 text-[11px] leading-tight">Order Tracking</p>
                <p className="text-[10px] text-slate-400">Live order status</p>
              </div>
            </div>
          </div>

          {/* Decision Buttons: Now vs Later */}
          <div className="w-full flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={handleOpenAuth}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Log In / Sign Up Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="sm:w-36 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center"
            >
              Do It Later
            </button>
          </div>

          <p className="text-[10px] text-slate-400 mt-3 font-medium">
            You can always log in anytime later from the top navigation bar.
          </p>
        </div>
      </div>
    </div>
  );
};
