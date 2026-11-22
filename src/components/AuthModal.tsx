import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  LogOut,
  User as UserIcon,
  Phone,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Bookmark,
  ShoppingBag,
} from 'lucide-react';
import {
  AuthUserProfile,
  getStoredAuthUser,
  requestOtp,
  verifyOtp,
  logoutUser,
} from '../services/authService';
import { getLocalOrders } from '../services/orderCommerceService';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: AuthUserProfile) => void;
}

export const AVATAR_OPTIONS = [
  { id: 'pro_male', emoji: '👨‍💼', label: 'Executive' },
  { id: 'pro_female', emoji: '👩‍💼', label: 'Professional' },
  { id: 'tech_pro', emoji: '🧑‍💻', label: 'Specialist' },
  { id: 'medic', emoji: '👨‍⚕️', label: 'Health' },
  { id: 'scholar', emoji: '🧑‍🎓', label: 'Scholar' },
  { id: 'artisan', emoji: '🧑‍🍳', label: 'Artisan' },
  { id: 'resident_m', emoji: '🧔', label: 'Resident' },
  { id: 'resident_f', emoji: '🧕', label: 'Citizen' },
  { id: 'creative', emoji: '👩‍🎨', label: 'Creative' },
  { id: 'senior', emoji: '👵', label: 'Senior' },
  { id: 'champ', emoji: '🦸', label: 'Civic Champ' },
  { id: 'explorer', emoji: '✨', label: 'Explorer' },
];

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [user, setUser] = useState<AuthUserProfile | null>(() => getStoredAuthUser());
  const [selectedAvatar, setSelectedAvatar] = useState<string>(() => {
    try {
      return localStorage.getItem('myarea24_user_avatar') || 'pro_male';
    } catch {
      return 'pro_male';
    }
  });

  // Login flow state
  const [step, setStep] = useState<'email' | 'otp' | 'profile'>('email');
  const [authMode, setAuthMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [targetMasked, setTargetMasked] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync user state on open
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredAuthUser();
      setUser(stored);
      if (stored) {
        setStep('profile');
      } else {
        setStep('email');
      }
      setStatusMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let identifier = '';
    if (authMode === 'phone') {
      const cleanDigits = phone.replace(/[^\d]/g, '').slice(-10);
      if (!/^[6-9]\d{9}$/.test(cleanDigits)) {
        setErrorMessage('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
        return;
      }
      identifier = cleanDigits;
    } else {
      if (!email.trim() || !email.includes('@')) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }
      identifier = email.trim();
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await requestOtp(identifier, 'login', authMode === 'phone' ? 'sms' : 'email');
      setIsLoading(false);
      if (res.success) {
        setStep('otp');
        setStatusMessage(res.message);
        setChannel(res.channel || (authMode === 'phone' ? 'sms' : 'email'));
        setTargetMasked(res.targetMasked || (authMode === 'phone' ? `+91 ${identifier.slice(0, 2)}*** **${identifier.slice(-3)}` : identifier));
        if (res.devOtp) {
          setDevOtpHint(res.devOtp);
          setOtpCode(res.devOtp);
        }
      } else {
        setErrorMessage(res.message || 'Failed to send OTP.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('Network error while requesting verification code.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const identifier = authMode === 'phone' ? phone.replace(/[^\d]/g, '').slice(-10) : email.trim();
      const res = await verifyOtp({
        identifier,
        email: authMode === 'email' ? email.trim() : undefined,
        phone: authMode === 'phone' ? phone.trim() : undefined,
        otpCode: otpCode.trim(),
        fullName: fullName.trim() || undefined,
      });

      setIsLoading(false);
      if (res.success && res.user) {
        setUser(res.user);
        setStep('profile');
        setStatusMessage(`Welcome ${res.user.fullName}!`);
        onSuccess?.(res.user);
      } else {
        setErrorMessage(res.error || 'Invalid or expired OTP code.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('Network error while verifying code.');
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    await logoutUser();
    setUser(null);
    setStep('email');
    setEmail('');
    setOtpCode('');
    setDevOtpHint(null);
    setIsLoading(false);
    setStatusMessage('Signed out successfully.');
  };

  const localOrdersCount = getLocalOrders().length;

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {step === 'profile' ? 'Citizen Account Profile' : 'Sign in to MyArea24'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {step === 'profile' ? 'Active Session & Bookmarks' : 'Passwordless One-Time Code Verification'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Status / Error Notifications */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
              {authMode === 'phone' && (
                <div className="pl-6 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('email');
                      setErrorMessage(null);
                    }}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2 cursor-pointer"
                  >
                    Switch to Email OTP for instant delivery →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* -------------------------------------------------------------
              STEP 1: PHONE OR EMAIL INPUT
              ------------------------------------------------------------- */}
          {step === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-3.5">
              {/* Method Switcher Tabs */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('phone');
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'phone'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Mobile SMS</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('email');
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'email'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </button>
              </div>

              <div className="text-center space-y-1 pb-0.5">
                <h4 className="text-sm font-bold text-slate-900">
                  {authMode === 'phone' ? 'Enter your 10-digit mobile number' : 'Enter your email address'}
                </h4>
                <p className="text-xs text-slate-500">
                  {authMode === 'phone'
                    ? 'We will send a 6-digit SMS verification code via TRAI DLT registered gateway.'
                    : 'We will send a 6-digit verification code to sign you in securely.'}
                </p>
              </div>

              {authMode === 'phone' ? (
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Mobile Phone Number</label>
                  <div className="relative mt-1 flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      autoFocus
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9812345678"
                      className="w-full pl-16 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Standard Indian mobile numbers (starts with 6, 7, 8, or 9)</p>
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Email Address</label>
                  <div className="relative mt-1">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-700">Full Name (Optional)</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none mt-1"
                />
              </div>

              {/* Choose Profile Avatar */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Choose Your Citizen Avatar</span>
                  <span className="text-[10px] text-blue-600 font-normal">
                    {AVATAR_OPTIONS.find((a) => a.id === selectedAvatar)?.label}
                  </span>
                </label>
                <div className="grid grid-cols-6 gap-1.5 p-2 rounded-2xl bg-slate-50 border border-slate-200">
                  {AVATAR_OPTIONS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => {
                        setSelectedAvatar(av.id);
                        try {
                          localStorage.setItem('myarea24_user_avatar', av.id);
                          localStorage.setItem('myarea24_user_avatar_emoji', av.emoji);
                        } catch {}
                      }}
                      title={av.label}
                      className={`h-9 rounded-xl flex items-center justify-center text-xl transition cursor-pointer ${
                        selectedAvatar === av.id
                          ? 'bg-blue-600 text-white scale-105 shadow-xs ring-2 ring-blue-400'
                          : 'bg-white hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      {av.emoji}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <KeyRound className="w-3.5 h-3.5" />
                )}
                <span>Send 6-Digit OTP</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Skip / Do It Later</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-100 flex items-center gap-2 text-[11px] text-blue-900">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  {authMode === 'phone'
                    ? 'TRAI DLT compliant OTP delivery via official Indian SMS gateways.'
                    : 'JWT session tokens with automatic 30-day refresh rotation and 401 protection.'}
                </span>
              </div>
            </form>
          )}

          {/* -------------------------------------------------------------
              STEP 2: OTP VERIFICATION
              ------------------------------------------------------------- */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-3.5">
              <div className="text-center space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900">
                  {channel === 'sms' ? 'Check your phone SMS' : 'Check your inbox'}
                </h4>
                <p className="text-xs text-slate-500">
                  Enter the 6-digit verification code sent to{' '}
                  <strong className="text-slate-800">
                    {targetMasked || (authMode === 'phone' ? `+91 ${phone}` : email)}
                  </strong>
                </p>
                {channel === 'sms' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    TRAI DLT Verified SMS
                  </span>
                )}
              </div>

              {devOtpHint && (
                <div
                  onClick={() => setOtpCode(devOtpHint)}
                  className="p-3 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between cursor-pointer hover:shadow-xs transition"
                  title="Click to auto-fill code"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    <div>
                      <p className="font-bold text-[11px] text-emerald-900">Instant Verification Code:</p>
                      <p className="text-[10px] text-emerald-700">Auto-filled for instant access (Click to re-fill)</p>
                    </div>
                  </div>
                  <span className="font-mono font-black tracking-widest text-sm bg-white text-emerald-800 px-3 py-1 rounded-xl border border-emerald-300 shadow-2xs">
                    {devOtpHint}
                  </span>
                </div>
              )}

              {devOtpHint ? (
                <div className="p-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-[11px] text-emerald-950 flex items-center gap-2">
                  <span className="shrink-0 text-sm">⚡</span>
                  <span>
                    Development code auto-filled above. You can verify and sign in immediately!
                  </span>
                </div>
              ) : channel === 'sms' ? (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                  <span>Didn't receive SMS on your phone?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('email');
                      setStep('email');
                      setErrorMessage(null);
                    }}
                    className="text-blue-600 font-bold hover:underline ml-2 cursor-pointer"
                  >
                    Try Email OTP →
                  </button>
                </div>
              ) : null}

              <div>
                <label className="text-[11px] font-bold text-slate-700">6-Digit Verification Code</label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-center font-mono text-base font-extrabold tracking-widest focus:ring-2 focus:ring-blue-500 outline-none mt-1"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Verify & Sign In</span>
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  {authMode === 'phone' ? 'Change Mobile Number' : 'Change Email'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRequestOtp()}
                  disabled={isLoading}
                  className="text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}

          {/* -------------------------------------------------------------
              STEP 3: LOGGED IN USER PROFILE VIEW
              ------------------------------------------------------------- */}
          {step === 'profile' && user && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-100 flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white border border-indigo-200 text-2xl flex items-center justify-center shadow-md">
                  {AVATAR_OPTIONS.find((a) => a.id === selectedAvatar)?.emoji || user.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-slate-900 truncate">{user.fullName}</h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                      {user.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate">{user.email}</p>
                  {user.phone && <p className="text-[11px] text-slate-500 mt-0.5">📞 {user.phone}</p>}
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Bookmark className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">Cloud Synced</p>
                    <p className="text-[10px] text-slate-500">Saved to your account</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">{localOrdersCount} Orders</p>
                    <p className="text-[10px] text-slate-500">Local Basket History</p>
                  </div>
                </div>
              </div>

              {/* Security Status */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs text-slate-700">
                <p className="font-bold flex items-center gap-1.5 text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Active JWT Authentication
                </p>
                <p className="text-[11px] text-slate-500">
                  Protected with access token and auto-refresh rotation.
                </p>
              </div>

              {/* Sign Out Button */}
              <button
                type="button"
                disabled={isLoading}
                onClick={handleSignOut}
                className="w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out from MyArea24</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
