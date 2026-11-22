import React from 'react';
import { Lock, ShieldCheck, KeyRound, Store, Globe } from 'lucide-react';
import { MerchantRegistrationModal } from '../../components/MerchantRegistrationModal';
import { MerchantRegistrationProfile } from '../../services/communityMarketplaceService';

export interface MerchantAuthRequiredViewProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onSwitchToCitizen: () => void;
  authModalOpen: boolean;
  authModalMode: 'login' | 'register';
  onCloseAuthModal: () => void;
  onAuthSuccess: (profile: MerchantRegistrationProfile) => void;
  currentArea: string;
  coords?: { lat: number; lng: number };
}

export const MerchantAuthRequiredView: React.FC<MerchantAuthRequiredViewProps> = ({
  onLoginClick,
  onRegisterClick,
  onSwitchToCitizen,
  authModalOpen,
  authModalMode,
  onCloseAuthModal,
  onAuthSuccess,
  currentArea,
  coords,
}) => {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="w-14 h-14 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 shadow-sm">
        <Lock className="w-7 h-7 text-blue-400" />
      </div>
      <div className="max-w-md space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium mb-1">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>MyArea24 Merchant Security Shield</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Merchant Portal Authentication</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Your neighborhood storefront is password & PIN-protected to safeguard live orders, customer inquiries, and commercial operations.
        </p>
      </div>

      <div className="flex flex-col gap-2 mt-7 w-full max-w-sm">
        <button
          type="button"
          onClick={onLoginClick}
          className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition active:scale-98 text-white"
        >
          <KeyRound className="w-4 h-4" />
          <span>Access Merchant Dashboard</span>
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onLoginClick}
            className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition active:scale-98"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-300" />
            <span>Store PIN Log In</span>
          </button>
          <button
            type="button"
            onClick={onRegisterClick}
            className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-98"
          >
            <Store className="w-3.5 h-3.5 text-slate-300" />
            <span>Register Store</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onSwitchToCitizen}
        className="mt-6 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer transition"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>← Back to Resident / Citizen Portal</span>
      </button>

      <MerchantRegistrationModal
        isOpen={authModalOpen}
        defaultMode={authModalMode}
        onClose={onCloseAuthModal}
        onSuccess={onAuthSuccess}
        currentArea={currentArea}
        coords={coords}
      />
    </div>
  );
};
