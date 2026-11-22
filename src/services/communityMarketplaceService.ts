import { useState, useEffect, useCallback } from 'react';
import { LiveAreaIntelligence } from './liveIntelligence';
import { SavedEntry } from '../types';
import {
  AuthUserProfile,
  getStoredAuthUser,
  requestOtp,
  verifyOtp,
  refreshAccessToken,
  logoutUser,
  AUTH_CHANGE_EVENT,
  AUTH_UNAUTHORIZED_EVENT,
} from './authService';
export type { AuthUserProfile };
export { getStoredAuthUser, logoutUser, AUTH_CHANGE_EVENT, AUTH_UNAUTHORIZED_EVENT };

/* ============================================================================
   TYPES FOR LIVE MARKETPLACE, EVENTS, AUTH & VOICE (SARVAM AI)
   ============================================================================ */

export interface LiveBusinessItem {
  id: string;
  numericId?: number;
  slug: string;
  name: string;
  cat: string;
  sub: string;
  description: string;
  address: string;
  locality: string;
  city: string;
  rating: string;
  reviews: string;
  dist: string;
  distanceKm: number;
  status: 'Open' | 'Closed';
  closes: string;
  openingTime: string;
  closingTime: string;
  phone: string;
  whatsapp: string;
  img: string;
  verified: boolean;
  trending: boolean;
  popular: boolean;
  lat: number;
  lng: number;
  activeProductsCount: number;
  activeOffersCount: number;
  source: string;
}

export interface LiveProductItem {
  id: string;
  numericId?: number;
  businessId?: number | string;
  name: string;
  brand: string;
  cat: string;
  price: string;
  localPriceNum: number;
  oldPrice?: string;
  onlinePriceNum: number;
  onlineProvider: string;
  savingsAmount: number;
  savingsPercent: number;
  betterOffline: boolean;
  unit: string;
  store: string;
  storeAddress: string;
  phone: string;
  dist: string;
  distanceKm: number;
  rating: string;
  reviews: string;
  inStock: boolean;
  freshnessLabel: string;
  discount?: string;
  img: string;
  locality?: string;
  city?: string;
  lat: number;
  lng: number;
}

export interface LiveServiceItem {
  id: string;
  numericId?: number;
  name: string;
  cat: string;
  role: string;
  description: string;
  exp: string;
  rating: string;
  reviews: string;
  dist: string;
  distanceKm: number;
  price: string;
  priceNum: number;
  priceUnit: string;
  avail: string;
  timing: string;
  phone: string;
  whatsapp: string;
  verified: boolean;
  img: string;
  locality: string;
  city: string;
  lat: number;
  lng: number;
}

export interface LiveOfferItem {
  id: string;
  numericId?: number;
  businessId?: number | string;
  title: string;
  sub: string;
  description: string;
  store: string;
  storeAddress: string;
  phone: string;
  cat: string;
  badge: string;
  badgeColor: string;
  code: string;
  valid: string;
  daysLeft: number;
  dist: string;
  distanceKm: number;
  img: string;
  locality?: string;
  city?: string;
  lat?: number;
  lng?: number;
}

export interface LiveEventItem {
  id: string;
  numericId?: number;
  title: string;
  cat: string;
  organizer: string;
  date: string;
  startTimeIso?: string;
  time: string;
  loc: string;
  address: string;
  locality: string;
  city: string;
  dist: string;
  distanceKm: number;
  price: string;
  free: boolean;
  rsvp: string;
  expectedAttendance: number;
  parkingPressure: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL';
  trafficImpact: 'LOW' | 'MODERATE' | 'HIGH_BOTTLENECK';
  exitWeatherAdvisory: string;
  commuteCorridor: string;
  source: string;
  registrationUrl?: string;
  img: string;
  locality?: string;
  city?: string;
  lat: number;
  lng: number;
}

export interface LiveEmergencyFacility {
  id: string;
  name: string;
  facilityType: 'Hospital' | 'Police Station' | 'Fire Station' | 'Pharmacy' | 'Trauma Center';
  phone: string;
  address: string;
  locality: string;
  city: string;
  distanceKm: number;
  is24x7: boolean;
  bloodBankAvailable: boolean;
  locality?: string;
  city?: string;
  lat: number;
  lng: number;
}

import { requestBackendJson, apiClient, resolveApiUrl, getClientAuthHeaders } from '../config/apiClient';

/* ============================================================================
   HELPER UTILITIES & BACKEND FETCHERS
   ============================================================================ */

async function requestBackend<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 4500
): Promise<T | null> {
  return requestBackendJson<T>(path, options, timeoutMs);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round(km * 1000))} m`;
  return `${km.toFixed(1)} km`;
}

const BIZ_IMAGES_BY_CAT: Record<string, string[]> = {
  Restaurants: ['./assets/crops/biz-card-bikanervala.webp', './assets/crops/biz-bikanervala.webp'],
  Cafés: ['./assets/crops/biz-card-chai.webp', './assets/crops/biz-urban-chai.webp'],
  Groceries: ['./assets/crops/store-apna-mart.webp', './assets/crops/store-sharma-fresh.webp'],
  Pharmacies: ['./assets/crops/store-medplus.webp', './assets/crops/biz-ai-essential.webp'],
  Electronics: ['./assets/crops/store-gupta-elec.webp', './assets/crops/offer-croma.webp'],
  Services: ['./assets/crops/srv-electrician.webp', './assets/crops/srv-ac-repair.webp'],
  Fitness: ['./assets/crops/biz-card-cultfit.webp', './assets/crops/biz-sports-complex.webp'],
  Salons: ['./assets/crops/biz-card-looks.webp', './assets/crops/offer-looks.webp'],
};

function pickBizImage(cat: string, idx: number): string {
  const list = BIZ_IMAGES_BY_CAT[cat] || ['./assets/crops/store-apna-mart.webp', './assets/crops/biz-card-chai.webp'];
  return list[idx % list.length];
}

/* ============================================================================
   1. USER AUTHENTICATION (EMAIL OTP: /api/v1/auth/send-otp & /verify-otp)
   ============================================================================ */

const AUTH_USER_KEY = 'myarea24_auth_user_v1';
const PENDING_OTP_KEY = 'myarea24_pending_otp_v1';

export async function sendEmailOtp(
  email: string,
  purpose: 'login' | 'signup' | 'merchant_onboarding' = 'login'
): Promise<{
  success: boolean;
  message: string;
  devOtp?: string;
  backendHandled: boolean;
}> {
  const res = await requestOtp(email, purpose);
  return {
    success: res.success,
    message: res.message,
    devOtp: res.devOtp,
    backendHandled: true,
  };
}

export async function verifyEmailOtp(params: {
  email: string;
  otpCode: string;
  fullName?: string;
  phone?: string;
  role?: 'resident' | 'merchant';
}): Promise<{
  success: boolean;
  user?: AuthUserProfile;
  error?: string;
}> {
  return verifyOtp(params);
}

export function logoutAuthUser(): void {
  logoutUser();
}

export async function syncSavedBookmarkToBackend(
  entryOrType: SavedEntry | 'business' | 'product' | 'service' | 'offer' | 'bulletin' | 'event',
  actionOrId?: 'add' | 'remove' | number
): Promise<void> {
  let itemType: 'business' | 'product' | 'service' | 'offer' | 'bulletin' | 'event' = 'business';
  let itemId = 1;

  if (typeof entryOrType === 'string') {
    itemType = entryOrType;
    itemId = typeof actionOrId === 'number' ? actionOrId : 1;
  } else if (entryOrType && typeof entryOrType === 'object') {
    const cat = (entryOrType.category || '').toLowerCase();
    if (cat.includes('product') || cat.includes('market')) itemType = 'product';
    else if (cat.includes('service')) itemType = 'service';
    else if (cat.includes('offer')) itemType = 'offer';
    else if (cat.includes('event')) itemType = 'event';
    else if (cat.includes('bulletin') || cat.includes('alert')) itemType = 'bulletin';
    else itemType = 'business';

    const numMatch = (entryOrType.id || '').match(/\d+/);
    itemId = numMatch ? parseInt(numMatch[0], 10) : 1;
  }

  await requestBackend('/api/v1/saved', {
    method: 'POST',
    body: JSON.stringify({ item_type: itemType, item_id: itemId }),
  });
}

/* ============================================================================
   2. HINDI / ENGLISH VOICE INPUT (STT) & TEXT-TO-SPEECH (TTS)
   Secured via FastAPI server-side proxy (/api/v1/intelligence/voice/tts)
   with zero-dependency Browser Web Speech API fallback.
   ============================================================================ */

export async function speakTextWithSarvamOrBrowser(
  text: string,
  lang: 'hi-IN' | 'en-IN' = 'hi-IN',
  onEnd?: () => void
): Promise<{ provider: 'Sarvam AI Bulbul v1' | 'Browser Neural Speech'; stop: () => void }> {
  const cleanText = text.replace(/[*#_`~]/g, '').slice(0, 480);

  // 1. Try secure backend Sarvam AI Bulbul TTS endpoint (server-side authenticated)
  try {
    const data = await requestBackend<{ audio_base64?: string }>(
      '/api/v1/intelligence/voice/tts',
      {
        method: 'POST',
        body: JSON.stringify({
          text: cleanText,
          lang,
        }),
      },
      8000
    );

    if (data?.audio_base64) {
      const audio = new Audio(`data:audio/wav;base64,${data.audio_base64}`);
      audio.onended = () => onEnd?.();
      await audio.play();
      return {
        provider: 'Sarvam AI Bulbul v1',
        stop: () => {
          audio.pause();
          audio.currentTime = 0;
          onEnd?.();
        },
      };
    }
  } catch {
    // Fall through to Web Speech API
  }

  // 2. Fallback to Browser Web Speech Synthesis (supports hi-IN & en-IN natively)
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;
    utterance.rate = 1.02;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((v) => v.lang.toLowerCase().includes(lang.toLowerCase())) ||
      voices.find((v) => v.lang.toLowerCase().includes('hi') || v.lang.toLowerCase().includes('in'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
    return {
      provider: 'Browser Neural Speech',
      stop: () => {
        window.speechSynthesis.cancel();
        onEnd?.();
      },
    };
  }

  onEnd?.();
  return { provider: 'Browser Neural Speech', stop: () => {} };
}

export function startVoiceRecognition(
  lang: 'hi-IN' | 'en-IN',
  onResult: (transcript: string, isFinal: boolean) => void,
  onError: (msg: string) => void,
  onEnd: () => void
): { stop: () => void } {
  const SpeechRec =
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

  if (!SpeechRec) {
    onError('Voice recognition is supported in Chrome, Edge, and mobile browsers.');
    onEnd();
    return { stop: () => {} };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognition: any = new (SpeechRec as any)();
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onresult = (event: any) => {
    let transcript = '';
    let isFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }
    onResult(transcript, isFinal);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onerror = (ev: any) => {
    if (ev?.error !== 'aborted') {
      onError(ev?.error === 'not-allowed' ? 'Microphone permission denied.' : `Voice error: ${ev?.error || 'unknown'}`);
    }
    onEnd();
  };

  recognition.onend = () => {
    onEnd();
  };

  recognition.start();
  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    },
  };
}

/* ============================================================================
   3. LIVE COMMUNITY MARKETPLACE HOOK
      Connects /api/v1/businesses, /api/v1/products, /api/v1/services,
      /api/v1/offers, /api/v1/events, /api/v1/emergency/facilities + Overpass
   ============================================================================ */

export const CUSTOM_BIZ_KEY = 'myarea24_custom_businesses_v1';
export const CUSTOM_PROD_KEY = 'myarea24_custom_products_v1';
export const CUSTOM_SVC_KEY = 'myarea24_custom_services_v1';
export const CUSTOM_OFFER_KEY = 'myarea24_custom_offers_v1';
export const CUSTOM_EVENT_KEY = 'myarea24_custom_events_v1';
export const CUSTOM_INVENTORY_SNAPSHOTS_KEY = 'myarea24_inventory_snapshots_v1';
export const MERCHANT_REGISTRATION_KEY = 'myarea24_merchant_registered_v1';
export const MERCHANT_ACCOUNTS_KEY = 'myarea24_merchant_accounts_v1';
export const MERCHANT_SESSION_KEY = 'myarea24_merchant_session_v1';

export interface InventorySnapshotItem {
  id: string;
  type: 'product' | 'bill' | 'shelf' | 'storefront';
  url: string;
  timestamp: string;
  notes?: string;
  itemName?: string;
  category?: string;
  price?: number;
}

export function getStoredInventorySnapshots(): InventorySnapshotItem[] {
  return loadLocalList<InventorySnapshotItem>(CUSTOM_INVENTORY_SNAPSHOTS_KEY);
}

export function saveInventorySnapshot(snapshot: InventorySnapshotItem): void {
  const existing = getStoredInventorySnapshots();
  saveLocalList(CUSTOM_INVENTORY_SNAPSHOTS_KEY, [snapshot, ...existing]);
}

export async function uploadMarketplaceMedia(file: File): Promise<{
  success: boolean;
  url?: string;
  cdnUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}> {
  try {
    const ep =
      resolveApiUrl('/api/v1/merchant/upload-image') ||
      resolveApiUrl('/api/v1/merchant/upload') ||
      resolveApiUrl('/api/v1/products/upload-image') ||
      resolveApiUrl('/api/v1/products/upload');
    if (!ep) {
      return { success: false, error: 'Upload endpoint unavailable' };
    }
    const headers = getClientAuthHeaders();
    const authHeaders: Record<string, string> = {};
    if (headers['Authorization']) authHeaders['Authorization'] = headers['Authorization'];
    if (headers['X-Merchant-Phone']) authHeaders['X-Merchant-Phone'] = headers['X-Merchant-Phone'];
    if (headers['X-Merchant-ID']) authHeaders['X-Merchant-ID'] = headers['X-Merchant-ID'];

    const formData = new FormData();
    formData.append('file', file, file.name);

    const res = await fetch(ep, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      return { success: false, error: err?.detail || err?.message || `Upload failed with status ${res.status}` };
    }
    const data = await res.json();
    return {
      success: true,
      url: data.url,
      cdnUrl: data.cdn_url || data.url,
      thumbnailUrl: data.thumbnail_url || data.url,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error during media upload' };
  }
}

export interface MerchantRegistrationProfile {
  id?: string;
  businessName: string;
  category: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  email: string;
  fullAddress: string;
  locality: string;
  city: string;
  pincode: string;
  docType: 'GSTIN' | 'MSME_UDYAM' | 'FSSAI' | 'TRADE_LICENSE' | 'SHOP_ACT';
  docNumber: string;
  openingTime: string;
  closingTime: string;
  storePin?: string; // 4-6 digit Security PIN or Password
  tagline?: string;
  logoUrl?: string;
  isVerified: boolean;
  registeredAt: string;
}

export function getStoredMerchantAccounts(): MerchantRegistrationProfile[] {
  try {
    const raw = localStorage.getItem(MERCHANT_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function getStoredMerchantSession(): MerchantRegistrationProfile | null {
  try {
    const token = localStorage.getItem('myarea24_merchant_token');
    if (!token) {
      return null;
    }
    const raw = localStorage.getItem(MERCHANT_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.businessName && parsed.isVerified) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

export function saveMerchantSession(profile: MerchantRegistrationProfile): void {
  try {
    const sanitized = { ...profile };
    delete sanitized.storePin;
    localStorage.setItem(MERCHANT_SESSION_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent('myarea24_merchant_session_changed', { detail: sanitized }));
  } catch {}
}

export function clearMerchantSession(): void {
  try {
    localStorage.removeItem(MERCHANT_SESSION_KEY);
    localStorage.removeItem('myarea24_merchant_token');
    localStorage.removeItem('myarea24_merchant_portal_state_v1');
    window.dispatchEvent(new CustomEvent('myarea24_merchant_session_changed', { detail: null }));
  } catch {}
}

export function getStoredMerchantProfile(): MerchantRegistrationProfile | null {
  // First check active authenticated session
  const session = getStoredMerchantSession();
  if (session) return session;

  // Do not expose unauthenticated profile without active token
  try {
    const token = localStorage.getItem('myarea24_merchant_token');
    if (!token) return null;
    const raw = localStorage.getItem(MERCHANT_REGISTRATION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.businessName && parsed.isVerified) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

export function saveMerchantRegistration(profile: MerchantRegistrationProfile): void {
  try {
    const sanitized = { ...profile };
    delete sanitized.storePin;
    const profileWithId: MerchantRegistrationProfile = {
      ...sanitized,
      id: sanitized.id || `biz_${sanitized.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${Date.now().toString(36)}`,
    };

    // 1. Update legacy single registration pointer
    localStorage.setItem(MERCHANT_REGISTRATION_KEY, JSON.stringify(profileWithId));

    // 2. Add or update in multi-store accounts list
    const accounts = getStoredMerchantAccounts();
    const existingIndex = accounts.findIndex(
      (a) =>
        (a.id && a.id === profileWithId.id) ||
        a.businessName.toLowerCase() === profileWithId.businessName.toLowerCase() ||
        (a.phone && a.phone === profileWithId.phone)
    );
    let updatedAccounts: MerchantRegistrationProfile[];
    if (existingIndex >= 0) {
      updatedAccounts = [...accounts];
      updatedAccounts[existingIndex] = profileWithId;
    } else {
      updatedAccounts = [profileWithId, ...accounts];
    }
    localStorage.setItem(MERCHANT_ACCOUNTS_KEY, JSON.stringify(updatedAccounts));

    // 3. Set active authenticated session
    saveMerchantSession(profileWithId);

    window.dispatchEvent(new CustomEvent('myarea24_merchant_registered', { detail: profileWithId }));
    window.dispatchEvent(new CustomEvent('myarea24_marketplace_sync'));
  } catch {}
}

export async function verifyMerchantCredentials(
  identifier: string,
  storePin: string
): Promise<{ success: boolean; profile?: MerchantRegistrationProfile; error?: string }> {
  const cleanId = identifier.trim();
  const cleanPin = storePin.trim();

  if (!cleanId) {
    return { success: false, error: 'Please enter your registered store phone or email.' };
  }
  if (!cleanPin) {
    return { success: false, error: 'Please enter your Store Security PIN or Password.' };
  }

  // 1. Authoritative backend authentication against database
  try {
    const res = await apiClient.post<{
      status?: string;
      token?: string;
      profile?: MerchantRegistrationProfile;
      detail?: string;
      message?: string;
      business?: any;
    }>('/api/v1/merchant/login', {
      identifier: cleanId,
      store_pin: cleanPin,
    });

    if (res.ok && res.data?.status === 'success') {
      if (res.data.token) {
        localStorage.setItem('myarea24_merchant_token', res.data.token);
        localStorage.setItem('myarea24_auth_token', res.data.token);
      }
      if (res.data.profile) {
        saveMerchantSession(res.data.profile);
        return { success: true, profile: res.data.profile };
      }
    }

    // Live backend returned structured error (400, 401, 403, 404)
    const serverError =
      (res.data as any)?.detail ||
      res.error ||
      (res.data as any)?.message ||
      'Invalid store credentials or access denied.';
    return { success: false, error: serverError };
  } catch (err: any) {
    console.error('[communityMarketplaceService] Merchant authentication failed', err);
    return {
      success: false,
      error: 'Unable to reach authentication server. Please check your network connection.',
    };
  }
}

export async function registerMerchantOnBackend(
  profile: MerchantRegistrationProfile,
  storePin: string
): Promise<{ success: boolean; profile?: MerchantRegistrationProfile; error?: string }> {
  try {
    const res = await apiClient.post<{
      status?: string;
      token?: string;
      profile?: MerchantRegistrationProfile;
      detail?: string;
    }>('/api/v1/merchant/register', {
      business_name: profile.businessName,
      category: profile.category,
      owner_name: profile.ownerName,
      phone: profile.phone,
      whatsapp: profile.whatsapp,
      email: profile.email,
      full_address: profile.fullAddress,
      locality: profile.locality,
      city: profile.city,
      pincode: profile.pincode,
      doc_type: profile.docType,
      doc_number: profile.docNumber,
      opening_time: profile.openingTime,
      closing_time: profile.closingTime,
      store_pin: storePin,
    });

    if (res.ok && res.data?.status === 'success') {
      if (res.data.token) {
        localStorage.setItem('myarea24_merchant_token', res.data.token);
        localStorage.setItem('myarea24_auth_token', res.data.token);
      }
      const registered = res.data.profile || profile;
      saveMerchantRegistration(registered);
      return { success: true, profile: registered };
    } else if (res.data?.detail || res.error) {
      return {
        success: false,
        error: res.data?.detail || res.error || 'Merchant registration failed on server.',
      };
    }
  } catch (err: any) {
    if (err?.message) {
      return { success: false, error: err.message };
    }
    console.warn('[communityMarketplaceService] Offline registration fallback', err);
    saveMerchantRegistration(profile);
    return { success: true, profile };
  }

  saveMerchantRegistration(profile);
  return { success: true, profile };
}

export function loadLocalList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalList<T>(key: string, list: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('myarea24_marketplace_sync'));
  } catch {
    // ignore
  }
}

export interface LiveCommunityMarketplaceState {
  loading: boolean;
  businesses: LiveBusinessItem[];
  products: LiveProductItem[];
  services: LiveServiceItem[];
  offers: LiveOfferItem[];
  events: LiveEventItem[];
  emergencyFacilities: LiveEmergencyFacility[];
  addBusiness: (biz: Partial<LiveBusinessItem>) => Promise<LiveBusinessItem>;
  addProduct: (prod: Partial<LiveProductItem>) => Promise<LiveProductItem>;
  addService: (svc: Partial<LiveServiceItem>) => Promise<LiveServiceItem>;
  addOffer: (offer: Partial<LiveOfferItem>) => Promise<LiveOfferItem>;
  addEvent: (ev: Partial<LiveEventItem>) => Promise<LiveEventItem>;
  refreshMarketplace: () => void;
}

export interface MarketplaceModulesData {
  businesses: LiveBusinessItem[];
  products: LiveProductItem[];
  services: LiveServiceItem[];
  offers: LiveOfferItem[];
  events: LiveEventItem[];
  emergencyFacilities: LiveEmergencyFacility[];
}

export function getLocalizedNeighborhoodBusinesses(
  _localityShort: string,
  _cityShort: string,
  _lat: number,
  _lng: number
): LiveBusinessItem[] {
  // Pure authentic data: Zero fabricated, demo, or template businesses.
  return [];
}

export async function fetchLiveMarketplaceModules(
  liveIntel: LiveAreaIntelligence
): Promise<MarketplaceModulesData> {
  const { lat, lng, areaName, city, pincode } = liveIntel.location;
  const localityShort = areaName ? areaName.split(',')[0].trim() : 'Local Area';
  const cityShort = city || (areaName && areaName.includes(',') ? areaName.split(',')[1]?.trim() : 'India') || 'India';
  let qParams = `locality=${encodeURIComponent(localityShort)}&city=${encodeURIComponent(
    cityShort
  )}&user_lat=${lat}&user_lon=${lng}`;
  if (pincode && pincode.trim().length === 6) {
    qParams += `&pincode=${encodeURIComponent(pincode.trim())}`;
  }

  const [
    backendBiz,
    backendProd,
    backendSvc,
    backendOffers,
    backendEvents,
    backendEmergency,
    overpassBiz,
  ] = await Promise.all([
    requestBackend<{ items: Record<string, unknown>[] }>(`/api/v1/businesses?${qParams}&page_size=24`),
    requestBackend<{ items: Record<string, unknown>[] }>(`/api/v1/products?${qParams}&page_size=24`),
    requestBackend<{ items: Record<string, unknown>[] }>(`/api/v1/services?${qParams}&page_size=20`),
    requestBackend<{ items: Record<string, unknown>[] }>(`/api/v1/offers?${qParams}&page_size=20`),
    requestBackend<{ items: Record<string, unknown>[] }>(
      `/api/v1/events?locality=${encodeURIComponent(localityShort)}&city=${encodeURIComponent(
        cityShort
      )}&lat=${lat}&lon=${lng}&page_size=150`
    ),
    requestBackend<{ facilities: Record<string, unknown>[] }>(
      `/api/v1/emergency/facilities?latitude=${lat}&longitude=${lng}&city=${encodeURIComponent(
        cityShort
      )}&locality=${encodeURIComponent(localityShort)}`
    ),
    fetchOverpassBusinesses(lat, lng, localityShort, cityShort),
  ]);

  const customBiz = loadLocalList<LiveBusinessItem>(CUSTOM_BIZ_KEY);
  const apiBizList: LiveBusinessItem[] = (backendBiz?.items || []).map((b, idx) => {
    const rawCat = String(b.category || 'Restaurants');
    const mappedCat = mapToFrontendBizCategory(rawCat);
    const dKm = Number(b.distance_km ?? haversineKm(lat, lng, Number(b.latitude || lat), Number(b.longitude || lng)));
    return {
      id: `api-biz-${b.id || idx}`,
      numericId: Number(b.id || idx + 1),
      slug: String(b.slug || `biz-${idx}`),
      name: String(b.name || `${localityShort} Store`),
      cat: mappedCat,
      sub: `${String(b.subcategory || rawCat)} • ${String(b.locality || localityShort)}`,
      description: String(b.description || `Verified merchant in ${localityShort}, ${cityShort}`),
      address: String(b.address || `${localityShort}, ${cityShort}`),
      locality: String(b.locality || localityShort),
      city: String(b.city || cityShort),
      rating: b.rating ? Number(b.rating).toFixed(1) : 'New',
      reviews: b.review_count ? `(${b.review_count})` : '(0)',
      dist: formatDist(dKm),
      distanceKm: dKm,
      status: b.is_open_now === false ? 'Closed' : 'Open',
      closes: `Closes ${b.closing_time || '10:00 PM'}`,
      openingTime: String(b.opening_time || '09:00'),
      closingTime: String(b.closing_time || '22:00'),
      phone: b.phone ? String(b.phone) : '',
      whatsapp: b.whatsapp ? String(b.whatsapp) : (b.phone ? String(b.phone) : ''),
      img: pickBizImage(mappedCat, idx),
      verified: Boolean(b.is_verified ?? true),
      trending: idx < 3,
      popular: Number(b.rating || 4.6) >= 4.5,
      lat: Number(b.latitude || lat + 0.002),
      lng: Number(b.longitude || lng + 0.002),
      activeProductsCount: Number(b.active_products_count || 0),
      activeOffersCount: Number(b.active_offers_count || 0),
      source: 'FastAPI /api/v1/businesses',
    };
  });

  const mergedBizMap = new Map<string, LiveBusinessItem>();
  for (const item of [...customBiz, ...apiBizList, ...overpassBiz]) {
    const key = item.name.toLowerCase().trim();
    if (!mergedBizMap.has(key)) {
      mergedBizMap.set(key, item);
    }
  }

  const finalBiz = Array.from(mergedBizMap.values()).sort((a, b) => a.distanceKm - b.distanceKm);

  const customProds = loadLocalList<LiveProductItem>(CUSTOM_PROD_KEY);
  const apiProdList: LiveProductItem[] = (backendProd?.items || []).map((p, idx) => {
    const bizObj = (p.business as Record<string, unknown>) || {};
    const localPrice = Number(p.local_price || 120);
    const onlinePrice = Number(p.online_price || p.mrp || Math.round(localPrice * 1.15));
    const bizLat = Number(bizObj.latitude || p.latitude || 0);
    const bizLng = Number(bizObj.longitude || p.longitude || 0);
    const dKm = Number(
      bizObj.distance_km ?? (bizLat && bizLng ? haversineKm(lat, lng, bizLat, bizLng) : 999)
    );
    const mappedCat = mapToFrontendProdCategory(String(p.category || 'Groceries'));
    const savings = Math.max(0, onlinePrice - localPrice);
    return {
      id: `api-prod-${p.id || idx}`,
      numericId: Number(p.id || idx + 1),
      name: String(p.name || 'Local Essential'),
      brand: String(p.brand || 'Verified Local'),
      cat: mappedCat,
      price: `₹${localPrice.toLocaleString('en-IN')}`,
      localPriceNum: localPrice,
      oldPrice: onlinePrice > localPrice ? `₹${onlinePrice.toLocaleString('en-IN')}` : undefined,
      onlinePriceNum: onlinePrice,
      onlineProvider: String(p.online_provider || 'Blinkit / Amazon'),
      savingsAmount: savings,
      savingsPercent: onlinePrice > 0 ? Math.round((savings / onlinePrice) * 100) : 0,
      betterOffline: localPrice <= onlinePrice,
      unit: '1 unit • In Stock',
      store: String(bizObj.name || `${localityShort} Store`),
      storeAddress: String(bizObj.address || `${localityShort}, ${cityShort}`),
      locality: String(bizObj.locality || p.locality || localityShort),
      city: String(bizObj.city || p.city || cityShort),
      phone: bizObj.phone ? String(bizObj.phone) : '',
      dist: formatDist(dKm),
      distanceKm: dKm,
      inStock: p.in_stock !== false && p.availability_status !== 'out_of_stock' && p.is_active !== false,
      img: pickProdImage(mappedCat, idx),
      rating: p.rating ? String(p.rating) : 'New',
      reviews: p.review_count ? `(${p.review_count})` : '(0)',
      freshnessLabel: 'Verified Today',
      businessId: p.business_id ? Number(p.business_id) : undefined,
      lat: bizLat,
      lng: bizLng,
    };
  });

  // Strict Hyperlocal & Validity Verification:
  // Shows Products, Services and Offers ONLY when active, valid user-submitted listings are available for the currently selected location.
  const isListingActiveAndNearby = (
    item: {
      lat?: number;
      lng?: number;
      distanceKm?: number;
      storeAddress?: string;
      locality?: string;
      city?: string;
      store?: string;
      inStock?: boolean;
      status?: string;
      is_active?: boolean;
      is_available?: boolean;
      is_deleted?: boolean;
      deleted_at?: string | null;
      daysLeft?: number;
      valid?: string;
      valid_until?: string;
      expires_at?: string;
    }
  ): boolean => {
    // 1. Exclude deleted listings
    if (item.is_deleted === true || Boolean(item.deleted_at)) {
      return false;
    }

    // 2. Exclude inactive or paused listings
    if (item.is_active === false || item.is_available === false || item.inStock === false) {
      return false;
    }
    const st = String(item.status || '').toLowerCase();
    if (st === 'inactive' || st === 'paused' || st === 'draft' || st === 'out_of_stock' || st === 'discontinued') {
      return false;
    }

    // 3. Exclude expired listings (especially for Offers)
    if (typeof item.daysLeft === 'number' && item.daysLeft <= 0) {
      return false;
    }
    if (item.valid && /expired|0\s*days?\s*left/i.test(item.valid)) {
      return false;
    }
    const expiryStr = item.valid_until || item.expires_at;
    if (expiryStr) {
      const expDate = new Date(expiryStr);
      if (!isNaN(expDate.getTime()) && expDate.getTime() < Date.now()) {
        return false;
      }
    }

    // 4. Strict Hyperlocal Location Association:
    // Distance check: strictly within 6.0 km
    let dist = item.distanceKm;
    if (
      (dist === undefined || isNaN(dist) || dist <= 0) &&
      typeof item.lat === 'number' &&
      typeof item.lng === 'number' &&
      !isNaN(item.lat) &&
      !isNaN(item.lng) &&
      (item.lat !== 0 || item.lng !== 0)
    ) {
      dist = haversineKm(lat, lng, item.lat, item.lng);
    }

    if (typeof dist === 'number' && !isNaN(dist) && dist >= 0) {
      if (dist <= 6.0) return true;
      if (dist > 8.0) return false;
    }

    // Locality text matching (e.g. 'Sultanpuri', 'Bandra', 'Connaught Place', 'Rohini')
    // MUST NOT match broad city (like 'Delhi' or 'Mumbai') or country ('India')
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTarget = norm(`${item.storeAddress || ''} ${item.locality || ''} ${item.store || ''}`);
    const cleanLoc = norm(localityShort);

    if (
      cleanLoc &&
      cleanLoc.length >= 3 &&
      cleanLoc !== 'localarea' &&
      cleanLoc !== 'india'
    ) {
      if (cleanTarget.includes(cleanLoc) || (item.locality && cleanLoc.includes(norm(item.locality)))) {
        return true;
      }
      const tokens = localityShort
        .toLowerCase()
        .split(/[\s,/-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 4 && !['area', 'city', 'road', 'main', 'delhi', 'mumbai', 'india'].includes(t));
      for (const tok of tokens) {
        if (cleanTarget.includes(tok)) return true;
      }
    }

    return false;
  };

  // Authentic catalog items: only active, valid user-submitted & verified merchant products for the selected location
  const filteredCustomProds = customProds.filter(isListingActiveAndNearby);
  const filteredApiProds = apiProdList.filter(isListingActiveAndNearby);

  const mergedProdMap = new Map<string, LiveProductItem>();
  for (const item of [...filteredCustomProds, ...filteredApiProds]) {
    const key = item.name.toLowerCase();
    if (!mergedProdMap.has(key)) {
      mergedProdMap.set(key, item);
    }
  }
  const finalProds = Array.from(mergedProdMap.values());

  const customSvcs = loadLocalList<LiveServiceItem>(CUSTOM_SVC_KEY);
  const apiSvcList: LiveServiceItem[] = (backendSvc?.items || []).map((s, idx) => {
    const sLat = Number(s.latitude || 0);
    const sLng = Number(s.longitude || 0);
    const dKm = Number(
      s.distance_km ?? (sLat && sLng ? haversineKm(lat, lng, sLat, sLng) : 999)
    );
    const mappedCat = mapToFrontendSvcCategory(String(s.category || 'Electrician'));
    const priceNum = Number(s.price_starting_at || s.price_starting || 499);
    return {
      id: `api-svc-${s.id || idx}`,
      numericId: Number(s.id || idx + 1),
      name: String(s.provider_name || s.title || 'Local Service Provider'),
      role: `${String(s.category || 'Technician')} Specialist`,
      cat: mappedCat,
      description: String(s.description || `Doorstep ${mappedCat} expert in ${localityShort}.`),
      exp: s.experience_years ? `${s.experience_years} yrs exp` : 'Verified Provider',
      rating: s.rating ? Number(s.rating).toFixed(1) : 'New',
      reviews: s.review_count ? `(${s.review_count})` : '(0)',
      dist: formatDist(dKm),
      distanceKm: dKm,
      price: `Starts ₹${priceNum}`,
      priceNum,
      priceUnit: String(s.price_unit || 'per visit'),
      avail: s.is_available === false ? 'Busy / Unavailable' : 'Available Today',
      timing: String(s.timing || '08:00 AM - 09:00 PM'),
      phone: s.phone ? String(s.phone) : '',
      whatsapp: s.whatsapp ? String(s.whatsapp) : (s.phone ? String(s.phone) : ''),
      verified: Boolean(s.is_verified ?? true),
      img: pickSvcImage(mappedCat, idx),
      locality: String(s.locality || localityShort),
      city: String(s.city || cityShort),
      lat: sLat,
      lng: sLng,
    };
  });

  const filteredCustomSvcs = customSvcs.filter(isListingActiveAndNearby);
  const filteredApiSvcs = apiSvcList.filter(isListingActiveAndNearby);

  const mergedSvcMap = new Map<string, LiveServiceItem>();
  for (const item of [...filteredCustomSvcs, ...filteredApiSvcs]) {
    const key = item.name.toLowerCase();
    if (!mergedSvcMap.has(key)) {
      mergedSvcMap.set(key, item);
    }
  }

  const customOffers = loadLocalList<LiveOfferItem>(CUSTOM_OFFER_KEY);
  const apiOfferList: LiveOfferItem[] = (backendOffers?.items || []).map((o, idx) => {
    const bizObj = (o.business as Record<string, unknown>) || {};
    const oLat = Number(bizObj.latitude || o.latitude || 0);
    const oLng = Number(bizObj.longitude || o.longitude || 0);
    const dKm = Number(
      o.distance_km ?? bizObj.distance_km ?? (oLat && oLng ? haversineKm(lat, lng, oLat, oLng) : 999)
    );
    const mappedCat = mapToFrontendOfferCategory(String(o.category || 'Food & Dining'));
    const daysLeftNum = Number(o.days_left ?? 12);
    return {
      id: `api-offer-${o.id || idx}`,
      numericId: Number(o.id || idx + 1),
      title: String(o.title || 'Flat 15% Off In-Store'),
      sub: String(o.description || `Valid at ${bizObj.name || localityShort}`),
      description: String(o.description || `Redeemable at counter or via WhatsApp order in ${localityShort}.`),
      store: String(bizObj.name || `${localityShort} Merchant`),
      storeAddress: String(bizObj.address || `${localityShort}, ${cityShort}`),
      locality: String(bizObj.locality || p.locality || localityShort),
      city: String(bizObj.city || p.city || cityShort),
      phone: bizObj.phone ? String(bizObj.phone) : '',
      cat: mappedCat,
      badge: String(o.discount_text || '15% OFF'),
      badgeColor: idx % 2 === 0 ? 'bg-orange-500 text-white' : 'bg-emerald-600 text-white',
      code: String(o.coupon_code || 'MYAREA15'),
      valid: `${daysLeftNum} days left`,
      daysLeft: daysLeftNum,
      claimed: o.claimed_count ? `${o.claimed_count} claimed` : 'Active offer',
      minBill: `Min bill ₹${o.min_bill || 299}`,
      dist: formatDist(dKm),
      distanceKm: dKm,
      img: pickOfferImage(mappedCat, idx),
      lat: oLat,
      lng: oLng,
    };
  });

  const filteredCustomOffers = customOffers.filter(isListingActiveAndNearby);
  const filteredApiOffers = apiOfferList.filter(isListingActiveAndNearby);

  const mergedOfferMap = new Map<string, LiveOfferItem>();
  for (const item of [...filteredCustomOffers, ...filteredApiOffers]) {
    const key = item.title.toLowerCase();
    if (!mergedOfferMap.has(key)) {
      mergedOfferMap.set(key, item);
    }
  }

  const customEvents = loadLocalList<LiveEventItem>(CUSTOM_EVENT_KEY);
  const apiEventList: LiveEventItem[] = (backendEvents?.items || []).map((e, idx) => {
    const dKm = Number(e.distance_km ?? 1.8);
    const mappedCat = mapToFrontendEventCategory(String(e.category || 'Festivals & Fairs'));
    const att = Number(e.expected_attendance || 0);
    const startIso = String(e.start_time || '');
    let dateStr = 'Upcoming';
    let timeStr = String(e.timing_text || '08:00 AM - 01:00 PM');
    if (startIso) {
      try {
        const dObj = new Date(startIso);
        if (!isNaN(dObj.getTime())) {
          dateStr = dObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
          if (!e.timing_text) {
            timeStr = dObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          }
        }
      } catch {}
    }
    return {
      id: `api-event-${e.id || idx}`,
      numericId: Number(e.id || idx + 1),
      title: String(e.title || 'Neighbourhood Event'),
      cat: mappedCat,
      organizer: String(e.organizer || `${localityShort} Community`),
      date: dateStr,
      startTimeIso: startIso,
      time: timeStr,
      loc: String(e.venue_name || `${localityShort} Community Center`),
      address: String(e.address || `${localityShort}, ${cityShort}`),
      locality: String(e.locality || localityShort),
      city: String(e.city || cityShort),
      dist: formatDist(dKm),
      distanceKm: dKm,
      price: mappedCat === 'Festivals & Fairs' || mappedCat === 'Community Events' ? 'Free / Open Observance' : 'Free Entry',
      free: true,
      rsvp: att > 0 ? `${att}+ expected` : 'Open Entry',
      expectedAttendance: att,
      parkingPressure: (e.parking_pressure as LiveEventItem['parkingPressure']) || 'MODERATE',
      trafficImpact: (e.arterial_traffic_impact as LiveEventItem['trafficImpact']) || 'MODERATE',
      exitWeatherAdvisory: String(
        e.exit_weather_advisory ||
          `${liveIntel.weather.conditionText} (${liveIntel.weather.temperatureC}°C) expected during dispersal.`
      ),
      commuteCorridor: String(
        e.correlated_commute_route ||
          liveIntel.traffic.corridors[0]?.roadName ||
          `${localityShort} Main Arterial`
      ),
      source: String(e.source || 'Verified Event Feed'),
      registrationUrl: e.registration_url ? String(e.registration_url) : undefined,
      img: pickEventImage(mappedCat, idx),
      lat: Number(e.latitude || lat + 0.004),
      lng: Number(e.longitude || lng - 0.003),
    };
  });

  const mergedEventMap = new Map<string, LiveEventItem>();
  for (const item of [...customEvents, ...apiEventList]) {
    const key = item.title.toLowerCase();
    if (!mergedEventMap.has(key)) {
      mergedEventMap.set(key, item);
    }
  }

  const apiEmergList: LiveEmergencyFacility[] = (backendEmergency?.facilities || []).map((f, idx) => {
    const dKm = Number(
      f.distance_km ?? haversineKm(lat, lng, Number(f.latitude || lat), Number(f.longitude || lng))
    );
    return {
      id: `api-emerg-${f.id || idx}`,
      name: String(f.name || `${localityShort} Emergency Hospital`),
      facilityType: mapFacilityType(String(f.facility_type || 'Hospital')),
      phone: String(f.phone || '108'),
      address: String(f.address || `${localityShort}, ${cityShort}`),
      locality: String(f.locality || localityShort),
      city: String(f.city || cityShort),
      distanceKm: dKm,
      is24x7: Boolean(f.is_24_7 ?? true),
      bloodBankAvailable: Boolean(f.blood_bank_available ?? true),
      lat: Number(f.latitude || lat + 0.003),
      lng: Number(f.longitude || lng + 0.003),
    };
  });

  const poiEmergList: LiveEmergencyFacility[] = (liveIntel.nearbyPois || [])
    .filter((p) => p.category === 'hospital' || p.category === 'police' || p.category === 'pharmacy')
    .map((p) => ({
      id: `poi-emerg-${p.id}`,
      name: p.name,
      facilityType:
        p.category === 'police'
          ? 'Police Station'
          : p.category === 'fire'
          ? 'Fire Station'
          : p.category === 'pharmacy'
          ? 'Pharmacy'
          : 'Hospital',
      phone: p.phone || (p.category === 'police' ? '112' : p.category === 'fire' ? '101' : '108'),
      address: `${p.sublabel} • ${localityShort}, ${cityShort}`,
      locality: localityShort,
      city: cityShort,
      distanceKm: p.distanceKm,
      is24x7: true,
      bloodBankAvailable: p.category === 'hospital',
      lat: p.latitude,
      lng: p.longitude,
    }));

  const mergedEmergMap = new Map<string, LiveEmergencyFacility>();
  for (const item of [...apiEmergList, ...poiEmergList]) {
    const key = item.name.toLowerCase();
    if (!mergedEmergMap.has(key)) {
      mergedEmergMap.set(key, item);
    }
  }

  return {
    businesses: finalBiz,
    products: finalProds,
    services: Array.from(mergedSvcMap.values()),
    offers: Array.from(mergedOfferMap.values()),
    events: Array.from(mergedEventMap.values()),
    emergencyFacilities: Array.from(mergedEmergMap.values()).sort((a, b) => a.distanceKm - b.distanceKm),
  };
}

export async function searchProductsOnBackend(params: {
  q?: string;
  category?: string;
  pincode?: string;
  locality?: string;
  city?: string;
  userLat?: number;
  userLon?: number;
  pageSize?: number;
}): Promise<LiveProductItem[]> {
  const qp = new URLSearchParams();
  if (params.q && params.q.trim()) qp.set('q', params.q.trim());
  if (params.category && params.category !== 'All') qp.set('category', params.category);
  if (params.pincode && params.pincode.trim()) qp.set('pincode', params.pincode.trim());
  if (params.locality) qp.set('locality', params.locality);
  if (params.city) qp.set('city', params.city);
  if (params.userLat) qp.set('user_lat', String(params.userLat));
  if (params.userLon) qp.set('user_lon', String(params.userLon));
  qp.set('page_size', String(params.pageSize || 30));

  const res = await requestBackend<{ items: Record<string, unknown>[] }>(`/api/v1/products?${qp.toString()}`);
  if (!res?.items) return [];

  return res.items.map((p, idx) => {
    const bizObj = (p.business as Record<string, unknown>) || {};
    const localPrice = Number(p.local_price || 120);
    const onlinePrice = Number(p.online_price || p.mrp || Math.round(localPrice * 1.15));
    const dKm = Number(bizObj.distance_km ?? 0.8);
    const mappedCat = mapToFrontendProdCategory(String(p.category || 'Groceries'));
    const savings = Math.max(0, onlinePrice - localPrice);
    return {
      id: `api-prod-${p.id || idx}`,
      numericId: Number(p.id || idx + 1),
      name: String(p.name || 'Local Essential'),
      brand: String(p.brand || 'Verified Local'),
      cat: mappedCat,
      price: `₹${localPrice.toLocaleString('en-IN')}`,
      localPriceNum: localPrice,
      oldPrice: onlinePrice > localPrice ? `₹${onlinePrice.toLocaleString('en-IN')}` : undefined,
      onlinePriceNum: onlinePrice,
      onlineProvider: String(p.online_provider || 'Blinkit / Amazon'),
      savingsAmount: savings,
      savingsPercent: onlinePrice > 0 ? Math.round((savings / onlinePrice) * 100) : 0,
      betterOffline: localPrice <= onlinePrice,
      unit: '1 unit • In Stock',
      store: String(bizObj.name || `${params.locality || 'Local'} Store`),
      storeAddress: String(bizObj.address || `${params.locality || ''}, ${params.city || ''}`),
      phone: bizObj.phone ? String(bizObj.phone) : '',
      dist: formatDist(dKm),
      distanceKm: dKm,
      img: pickProdImage(mappedCat, idx),
      rating: p.rating ? String(p.rating) : 'New',
      reviews: p.review_count ? `(${p.review_count})` : '(0)',
      freshnessLabel: 'Verified Today',
      businessId: p.business_id ? Number(p.business_id) : undefined,
    };
  });
}

export async function searchBusinessesOnBackend(params: {
  q?: string;
  category?: string;
  pincode?: string;
  locality?: string;
  city?: string;
  userLat?: number;
  userLon?: number;
  pageSize?: number;
}): Promise<LiveBusinessItem[]> {
  const qp = new URLSearchParams();
  if (params.q && params.q.trim()) qp.set('q', params.q.trim());
  if (params.category && params.category !== 'All') qp.set('category', params.category);
  if (params.pincode && params.pincode.trim()) qp.set('pincode', params.pincode.trim());
  if (params.locality) qp.set('locality', params.locality);
  if (params.city) qp.set('city', params.city);
  if (params.userLat) qp.set('user_lat', String(params.userLat));
  if (params.userLon) qp.set('user_lon', String(params.userLon));
  qp.set('page_size', String(params.pageSize || 30));

  const res = await requestBackend<{ items: Record<string, unknown>[] }>(`/api/v1/businesses?${qp.toString()}`);
  if (!res?.items) return [];

  return res.items.map((b, idx) => {
    const rawCat = String(b.category || 'Restaurants');
    const mappedCat = mapToFrontendBizCategory(rawCat);
    const dKm = Number(b.distance_km ?? (params.userLat ? haversineKm(params.userLat, params.userLon || 0, Number(b.latitude || 0), Number(b.longitude || 0)) : 1.0));
    return {
      id: `api-biz-${b.id || idx}`,
      numericId: Number(b.id || idx + 1),
      slug: String(b.slug || `biz-${idx}`),
      name: String(b.name || `Local Store`),
      cat: mappedCat,
      sub: `${String(b.subcategory || rawCat)} • ${String(b.locality || params.locality || 'Local')}`,
      description: String(b.description || `Verified merchant`),
      address: String(b.address || `${params.locality || ''}, ${params.city || ''}`),
      locality: String(b.locality || params.locality || 'Local'),
      city: String(b.city || params.city || 'India'),
      rating: b.rating ? Number(b.rating).toFixed(1) : 'New',
      reviews: b.review_count ? `(${b.review_count})` : '(0)',
      dist: formatDist(dKm),
      distanceKm: dKm,
      status: b.is_open_now === false ? 'Closed' : 'Open',
      closes: `Closes ${b.closing_time || '10:00 PM'}`,
      openingTime: String(b.opening_time || '09:00'),
      closingTime: String(b.closing_time || '22:00'),
      phone: b.phone ? String(b.phone) : '',
      whatsapp: b.whatsapp ? String(b.whatsapp) : (b.phone ? String(b.phone) : ''),
      img: pickBizImage(mappedCat, idx),
      verified: Boolean(b.is_verified ?? true),
      trending: idx < 3,
      popular: Number(b.rating || 4.6) >= 4.5,
      lat: Number(b.latitude || 0),
      lng: Number(b.longitude || 0),
      activeProductsCount: Number(b.active_products_count || 0),
      activeOffersCount: Number(b.active_offers_count || 0),
      source: 'FastAPI /api/v1/businesses',
    };
  });
}

export function useLiveCommunityMarketplace(
  liveIntel: LiveAreaIntelligence
): LiveCommunityMarketplaceState {
  const { lat, lng, areaName, city } = liveIntel.location;
  const localityShort = areaName ? areaName.split(',')[0].trim() : 'Local Area';
  const cityShort = city || (areaName && areaName.includes(',') ? areaName.split(',')[1]?.trim() : 'India') || 'India';

  const [loading, setLoading] = useState(false);
  const [businesses, setBusinesses] = useState<LiveBusinessItem[]>([]);
  const [products, setProducts] = useState<LiveProductItem[]>([]);
  const [services, setServices] = useState<LiveServiceItem[]>([]);
  const [offers, setOffers] = useState<LiveOfferItem[]>([]);
  const [events, setEvents] = useState<LiveEventItem[]>([]);
  const [emergencyFacilities, setEmergencyFacilities] = useState<LiveEmergencyFacility[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  const refreshMarketplace = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  // Live Cross-Portal Synchronizer (triggers instant updates across tabs/portals on merchant updates)
  useEffect(() => {
    const handleSync = () => {
      setRefreshTick((t) => t + 1);
    };
    window.addEventListener('myarea24_marketplace_sync', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('myarea24_marketplace_sync', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchAllModules() {
      try {
        const data = await fetchLiveMarketplaceModules(liveIntel);
        if (cancelled) return;
        setBusinesses(data.businesses);
        setProducts(data.products);
        setServices(data.services);
        setOffers(data.offers);
        setEvents(data.events);
        setEmergencyFacilities(data.emergencyFacilities);
      } catch (err) {
        console.error('Failed to load live community marketplace modules:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAllModules();

    return () => {
      cancelled = true;
    };
  }, [lat, lng, localityShort, cityShort, refreshTick]);

  // CRUD Actions
  const addBusiness = async (biz: Partial<LiveBusinessItem>): Promise<LiveBusinessItem> => {
    const cat = biz.cat || 'Restaurants';
    const created: LiveBusinessItem = {
      id: `custom-biz-${Date.now()}`,
      slug: `custom-biz-${Date.now()}`,
      name: biz.name || `${localityShort} Local Store`,
      cat,
      sub: `${cat} • ${localityShort}`,
      description: biz.description || `Verified storefront in ${localityShort}, ${cityShort}.`,
      address: biz.address || `Main Market, ${localityShort}, ${cityShort}`,
      locality: localityShort,
      city: cityShort,
      rating: '4.8',
      reviews: '(New)',
      dist: '0.3 km',
      distanceKm: 0.3,
      status: 'Open',
      closes: `Closes ${biz.closingTime || '10:00 PM'}`,
      openingTime: biz.openingTime || '09:00',
      closingTime: biz.closingTime || '22:00',
      phone: biz.phone || '+91 98110 24024',
      whatsapp: biz.phone || '+91 98110 24024',
      img: pickBizImage(cat, 0),
      verified: true,
      trending: true,
      popular: true,
      lat: lat + 0.0015,
      lng: lng + 0.0015,
      activeProductsCount: 1,
      activeOffersCount: 1,
      source: 'Merchant Self-Onboarded',
    };

    await requestBackend('/api/v1/businesses', {
      method: 'POST',
      body: JSON.stringify({
        name: created.name,
        category: created.cat,
        description: created.description,
        address: created.address,
        locality: localityShort,
        city: cityShort,
        latitude: created.lat,
        longitude: created.lng,
        phone: created.phone,
      }),
    });

    const existing = loadLocalList<LiveBusinessItem>(CUSTOM_BIZ_KEY);
    saveLocalList(CUSTOM_BIZ_KEY, [created, ...existing]);
    setBusinesses((prev) => [created, ...prev]);
    return created;
  };

  const addProduct = async (prod: Partial<LiveProductItem>): Promise<LiveProductItem> => {
    const localNum = Number(prod.localPriceNum || 199);
    const onlineNum = Number(prod.onlinePriceNum || Math.round(localNum * 1.15));
    const savings = Math.max(0, onlineNum - localNum);
    const cat = prod.cat || 'Groceries';
    const finalImg =
      prod.img ||
      (prod as any).image ||
      (prod as any).image_url ||
      pickProdImage(prod.name || '', cat, 0);

    const created: LiveProductItem = {
      id: `custom-prod-${Date.now()}`,
      name: prod.name || 'Fresh Local Item',
      brand: prod.brand || localityShort,
      cat,
      price: `₹${localNum.toLocaleString('en-IN')}`,
      localPriceNum: localNum,
      oldPrice: onlineNum > localNum ? `₹${onlineNum.toLocaleString('en-IN')}` : undefined,
      onlinePriceNum: onlineNum,
      onlineProvider: 'Online MRP',
      savingsAmount: savings,
      savingsPercent: onlineNum > 0 ? Math.round((savings / onlineNum) * 100) : 0,
      betterOffline: true,
      unit: prod.unit || '1 unit • In Stock',
      store: prod.store || businesses[0]?.name || `${localityShort} Supermart`,
      storeAddress: `${localityShort}, ${cityShort}`,
      phone: prod.phone || '+91 98110 24024',
      dist: '0.4 km',
      distanceKm: 0.4,
      rating: '4.7',
      reviews: '(Verified)',
      inStock: true,
      freshnessLabel: 'Added just now',
      discount: savings > 0 ? `Save ₹${savings}` : 'Live Price',
      img: finalImg,
      lat: lat + 0.001,
      lng: lng - 0.001,
    };

    const resolvedBizId = (() => {
      if (prod.businessId) {
        const num = typeof prod.businessId === 'number' ? prod.businessId : parseInt(String(prod.businessId).replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0) return num;
      }
      if (prod.store) {
        const matched = businesses.find((b) => b.name.trim().toLowerCase() === prod.store!.trim().toLowerCase());
        if (matched?.numericId) return matched.numericId;
      }
      const session = getStoredMerchantSession();
      if (session?.id) {
        const num = parseInt(session.id.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0) return num;
      }
      return businesses[0]?.numericId || 1;
    })();

    await requestBackend('/api/v1/products', {
      method: 'POST',
      body: JSON.stringify({
        business_id: resolvedBizId,
        name: created.name,
        brand: created.brand,
        category: created.cat,
        local_price: localNum,
        online_price: onlineNum,
        availability_status: 'in_stock',
        image_url: finalImg,
        image: finalImg,
      }),
    });

    const existing = loadLocalList<LiveProductItem>(CUSTOM_PROD_KEY);
    saveLocalList(CUSTOM_PROD_KEY, [created, ...existing]);
    setProducts((prev) => [created, ...prev]);
    return created;
  };

  const addService = async (svc: Partial<LiveServiceItem>): Promise<LiveServiceItem> => {
    const priceNum = Number(svc.priceNum || 299);
    const cat = svc.cat || 'Home Repair';
    const finalSvcImg =
      svc.img ||
      (svc as any).image ||
      (svc as any).image_url ||
      pickSvcImage(cat, 0);

    const created: LiveServiceItem = {
      id: `custom-svc-${Date.now()}`,
      name: svc.name || `${localityShort} Verified Specialist`,
      cat,
      role: `${svc.role || cat} • ${localityShort}`,
      description: svc.description || `Doorstep ${cat} specialist serving ${localityShort}, ${cityShort}.`,
      exp: svc.exp || '6 yrs exp',
      rating: '4.8',
      reviews: '(Verified)',
      dist: '0.5 km',
      distanceKm: 0.5,
      price: `Starts ₹${priceNum}`,
      priceNum,
      priceUnit: 'per visit',
      avail: 'Available Now',
      timing: '08:00 AM - 09:00 PM',
      phone: svc.phone || '+91 98112 44101',
      whatsapp: svc.phone || '+91 98112 44101',
      verified: true,
      img: finalSvcImg,
      locality: localityShort,
      city: cityShort,
      lat: lat + 0.002,
      lng: lng + 0.001,
    };

    await requestBackend('/api/v1/services', {
      method: 'POST',
      body: JSON.stringify({
        provider_name: created.name,
        category: created.cat,
        description: created.description,
        service_area: `${localityShort}, ${cityShort}`,
        locality: localityShort,
        city: cityShort,
        latitude: created.lat,
        longitude: created.lng,
        phone: created.phone,
        price_starting_at: priceNum,
        image_url: finalSvcImg,
        image: finalSvcImg,
      }),
    });

    const existing = loadLocalList<LiveServiceItem>(CUSTOM_SVC_KEY);
    saveLocalList(CUSTOM_SVC_KEY, [created, ...existing]);
    setServices((prev) => [created, ...prev]);
    return created;
  };

  const addOffer = async (offer: Partial<LiveOfferItem>): Promise<LiveOfferItem> => {
    const cat = offer.cat || 'Food & Dining';
    const finalOfferImg =
      offer.img ||
      (offer as any).image ||
      (offer as any).image_url ||
      (offer as any).banner_image_url ||
      pickOfferImage(cat, 0);

    const created: LiveOfferItem = {
      id: `custom-offer-${Date.now()}`,
      title: offer.title || 'Flat 20% Off Walk-In Deal',
      sub: offer.sub || `Valid at ${offer.store || localityShort}`,
      description: offer.description || `Show coupon code at billing counter in ${localityShort}.`,
      store: offer.store || businesses[0]?.name || `${localityShort} Partner Store`,
      storeAddress: `${localityShort}, ${cityShort}`,
      phone: offer.phone || '+91 98110 24024',
      cat,
      badge: offer.badge || '20% OFF',
      badgeColor: 'bg-orange-500 text-white',
      code: (offer.code || 'LOCAL20').toUpperCase(),
      valid: '14 days left',
      daysLeft: 14,
      dist: '0.4 km',
      distanceKm: 0.4,
      img: finalOfferImg,
      lat: lat + 0.001,
      lng: lng - 0.001,
    };

    const resolvedBizId = (() => {
      if (offer.businessId) {
        const num = typeof offer.businessId === 'number' ? offer.businessId : parseInt(String(offer.businessId).replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0) return num;
      }
      if (offer.store) {
        const matched = businesses.find((b) => b.name.trim().toLowerCase() === offer.store!.trim().toLowerCase());
        if (matched?.numericId) return matched.numericId;
      }
      const session = getStoredMerchantSession();
      if (session?.id) {
        const num = parseInt(session.id.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0) return num;
      }
      return businesses[0]?.numericId || 1;
    })();

    await requestBackend('/api/v1/offers', {
      method: 'POST',
      body: JSON.stringify({
        business_id: resolvedBizId,
        title: created.title,
        description: created.sub,
        discount_text: created.badge,
        coupon_code: created.code,
        category: created.cat,
        valid_days: 14,
        banner_image_url: finalOfferImg,
        image_url: finalOfferImg,
        image: finalOfferImg,
      }),
    });

    const existing = loadLocalList<LiveOfferItem>(CUSTOM_OFFER_KEY);
    saveLocalList(CUSTOM_OFFER_KEY, [created, ...existing]);
    setOffers((prev) => [created, ...prev]);
    return created;
  };

  const addEvent = async (ev: Partial<LiveEventItem>): Promise<LiveEventItem> => {
    const cat = ev.cat || 'Community';
    const created: LiveEventItem = {
      id: `custom-ev-${Date.now()}`,
      title: ev.title || `${localityShort} Citizen Meetup`,
      cat,
      organizer: ev.organizer || `${localityShort} RWA & Citizen Forum`,
      date: ev.date || 'This Sunday',
      time: ev.time || '05:00 PM – 07:30 PM',
      loc: `${ev.loc || `${localityShort} Community Center`}, ${cityShort}`,
      address: `${ev.loc || localityShort}, ${cityShort}`,
      locality: localityShort,
      city: cityShort,
      dist: '0.6 km',
      distanceKm: 0.6,
      price: ev.price || 'Free Entry',
      free: true,
      rsvp: '45+ going',
      expectedAttendance: 250,
      parkingPressure: 'MODERATE',
      trafficImpact: 'LOW',
      exitWeatherAdvisory: `${liveIntel.weather.conditionText} (${liveIntel.weather.temperatureC}°C) — smooth dispersal expected.`,
      commuteCorridor: liveIntel.traffic.corridors[0]?.roadName || `${localityShort} Main Road`,
      source: 'Verified Citizen / RWA Organizer',
      img: pickEventImage(cat, 0),
      lat: lat + 0.002,
      lng: lng - 0.002,
    };

    await requestBackend('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify({
        title: created.title,
        category: created.cat,
        organizer: created.organizer,
        venue_name: created.loc,
        address: created.address,
        locality: localityShort,
        city: cityShort,
        latitude: created.lat,
        longitude: created.lng,
        start_time: new Date(Date.now() + 86400000).toISOString(),
        timing_text: created.time,
        description: `Community event in ${localityShort}, ${cityShort}.`,
      }),
    });

    const existing = loadLocalList<LiveEventItem>(CUSTOM_EVENT_KEY);
    saveLocalList(CUSTOM_EVENT_KEY, [created, ...existing]);
    setEvents((prev) => [created, ...prev]);
    return created;
  };

  return {
    loading,
    businesses,
    products,
    services,
    offers,
    events,
    emergencyFacilities,
    addBusiness,
    addProduct,
    addService,
    addOffer,
    addEvent,
    refreshMarketplace,
  };
}

/* ============================================================================
   OVERPASS LIVE BUSINESS DISCOVERY & LOCALIZED GENERATORS
   ============================================================================ */

async function fetchOverpassBusinesses(
  lat: number,
  lng: number,
  locality: string,
  city: string
): Promise<LiveBusinessItem[]> {
  try {
    const backendData = await requestBackend<{
      businesses?: Array<{
        id: string;
        name: string;
        category?: string;
        subcategory?: string;
        address?: string;
        locality?: string;
        city?: string;
        rating?: string | number;
        reviews?: string | number;
        phone?: string;
        latitude?: number;
        longitude?: number;
        distance_km?: number;
      }>;
      pois?: Array<{
        id: string;
        name: string;
        category: string;
        distanceKm: number;
        latitude: number;
        longitude: number;
        phone?: string;
        sublabel?: string;
        address?: string;
      }>;
    }>(`/api/v1/locations/places-nearby?lat=${lat}&lon=${lng}&radius=3500`, {}, 3500);

    if (backendData?.businesses && backendData.businesses.length > 0) {
      return backendData.businesses.map((b, idx) => {
        const cat = mapToFrontendBizCategory(b.category || 'Services');
        const dKm = Number(
          (b.distance_km ?? haversineKm(lat, lng, b.latitude || lat, b.longitude || lng)).toFixed(2)
        );
        const street = b.locality || locality;
        const phone = b.phone || '';

        return {
          id: `osm-biz-${b.id || idx}`,
          slug: `osm-biz-${b.id || idx}`,
          name: b.name,
          cat,
          sub: `${cat} • ${street}`,
          description: `Verified ${cat.toLowerCase()} located in ${street}, ${city}.`,
          address: b.address || `${street}, ${locality}, ${city}`,
          locality: b.locality || locality,
          city: b.city || city,
          rating: b.rating ? String(b.rating) : 'New',
          reviews: b.reviews ? String(b.reviews) : '(0)',
          dist: formatDist(dKm),
          distanceKm: dKm,
          status: 'Open' as const,
          closes: 'Closes 10:00 PM',
          openingTime: '09:00',
          closingTime: '22:00',
          phone,
          whatsapp: phone,
          img: pickBizImage(cat, idx),
          verified: true,
          trending: idx < 2,
          popular: true,
          lat: b.latitude || lat,
          lng: b.longitude || lng,
          activeProductsCount: 0,
          activeOffersCount: 0,
          source: 'FastAPI /api/v1/locations/places-nearby',
        };
      });
    }

    if (backendData?.pois && backendData.pois.length > 0) {
      const bizPois = backendData.pois.filter((p) =>
        ['food', 'shop', 'pharmacy'].includes(p.category)
      );
      if (bizPois.length > 0) {
        return bizPois.map((p, idx) => {
          const cat =
            p.category === 'food'
              ? 'Restaurants'
              : p.category === 'pharmacy'
              ? 'Pharmacies'
              : 'Groceries';
          const dKm = Number(p.distanceKm.toFixed(2));
          const phone = p.phone || '';
          return {
            id: `osm-poi-${p.id || idx}`,
            slug: `osm-poi-${p.id || idx}`,
            name: p.name,
            cat,
            sub: `${cat} • ${locality}`,
            description: `Verified ${cat.toLowerCase()} in ${locality}, ${city}.`,
            address: p.address || `${locality}, ${city}`,
            locality,
            city,
            rating: 'New',
            reviews: '(0)',
            dist: formatDist(dKm),
            distanceKm: dKm,
            status: 'Open' as const,
            closes: 'Closes 10:00 PM',
            openingTime: '09:00',
            closingTime: '22:00',
            phone,
            whatsapp: phone,
            img: pickBizImage(cat, idx),
            verified: true,
            trending: idx < 2,
            popular: true,
            lat: p.latitude,
            lng: p.longitude,
            activeProductsCount: 5,
            activeOffersCount: 1,
            source: 'FastAPI /api/v1/locations/places-nearby',
          };
        });
      }
    }

    return [];
  } catch {
    return [];
  }
}

function mapOsmTagToCategory(tag: string): string {
  const t = tag.toLowerCase();
  if (['restaurant', 'fast_food'].includes(t)) return 'Restaurants';
  if (['cafe', 'bakery', 'coffee'].includes(t)) return 'Cafés';
  if (['supermarket', 'convenience', 'greengrocer', 'grocery', 'department_store'].includes(t))
    return 'Groceries';
  if (['pharmacy', 'chemist', 'medical'].includes(t)) return 'Pharmacies';
  if (['electronics', 'mobile_phone', 'computer'].includes(t)) return 'Electronics';
  if (['hairdresser', 'beauty', 'Clothes'].includes(t)) return 'Salons';
  if (['fitness_centre', 'sports'].includes(t)) return 'Fitness';
  return 'Services';
}

function mapToFrontendBizCategory(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('pharmacy') || r.includes('wellness') || r.includes('medical') || r.includes('chemist') || r.includes('drug') || r.includes('health') || r.includes('hospital')) return 'Pharmacies';
  if (r.includes('grocery') || r.includes('supermarket') || r.includes('kirana') || r.includes('provision') || r.includes('store') || r.includes('market') || r.includes('bazaar') || r.includes('dairy') || r.includes('general')) return 'Groceries';
  if (r.includes('electronic') || r.includes('mobile') || r.includes('computer') || r.includes('tech') || r.includes('appliance')) return 'Electronics';
  if (r.includes('cafe') || r.includes('bakery') || r.includes('coffee') || r.includes('tea') || r.includes('chai') || r.includes('snack')) return 'Cafés';
  if (r.includes('restaurant') || r.includes('food') || r.includes('dining') || r.includes('sweet') || r.includes('hotel') || r.includes('dhaba')) return 'Restaurants';
  if (r.includes('salon') || r.includes('fashion') || r.includes('beauty') || r.includes('spa') || r.includes('parlour') || r.includes('barber')) return 'Salons';
  if (r.includes('fit') || r.includes('sport') || r.includes('gym') || r.includes('yoga')) return 'Fitness';
  if (r.includes('repair') || r.includes('plumb') || r.includes('electric') || r.includes('clean') || r.includes('service')) return 'Services';
  return 'Groceries';
}

function mapToFrontendProdCategory(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('electronic') || r.includes('phone')) return 'Electronics';
  if (r.includes('pharmacy') || r.includes('health') || r.includes('med')) return 'Medicines';
  if (r.includes('bakery') || r.includes('dairy')) return 'Bakery & Dairy';
  if (r.includes('home') || r.includes('kitchen')) return 'Home & Kitchen';
  if (r.includes('fit') || r.includes('sport')) return 'Fitness';
  return 'Groceries';
}

function mapToFrontendSvcCategory(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('clean') || r.includes('pest')) return 'Cleaning';
  if (r.includes('tutor') || r.includes('class')) return 'Tutoring';
  if (r.includes('salon') || r.includes('beauty')) return 'Beauty & Salon';
  if (r.includes('health') || r.includes('physio') || r.includes('yoga')) return 'Health';
  if (r.includes('move') || r.includes('pack')) return 'Moving';
  return 'Home Repair';
}

function mapToFrontendOfferCategory(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('grocery')) return 'Groceries';
  if (r.includes('salon') || r.includes('spa')) return 'Salon & Spa';
  if (r.includes('fit') || r.includes('health') || r.includes('pharmacy')) return 'Fitness & Health';
  if (r.includes('electronic')) return 'Electronics';
  if (r.includes('service')) return 'Services';
  return 'Food & Dining';
}

function mapToFrontendEventCategory(raw: string): string {
  const r = (raw || '').toLowerCase();
  if (r.includes('hackathon') || r.includes('quiz') || r.includes('competition') || r.includes('contest') || r.includes('challenge') || r.includes('coding') || r.includes('case study')) {
    return 'Hackathons & Contests';
  }
  if (r.includes('festival') || r.includes('fair') || r.includes('panchang') || r.includes('puja') || r.includes('vrat') || r.includes('utsav') || r.includes('diwali') || r.includes('ekadashi')) {
    return 'Festivals & Fairs';
  }
  if (r.includes('movie') || r.includes('cinema') || r.includes('film') || r.includes('iffi') || r.includes('screening')) {
    return 'Movies & Cinema Announcements';
  }
  if (r.includes('theatre') || r.includes('theater') || r.includes('drama') || r.includes('play') || r.includes('natak')) {
    return 'Theatre & Drama';
  }
  if (r.includes('concert') || r.includes('music') || r.includes('acoustic') || r.includes('sufi') || r.includes('band') || r.includes('live gig') || r.includes('candlelight')) {
    return 'Concerts & Music';
  }
  if (r.includes('comedy') || r.includes('stand-up') || r.includes('standup') || r.includes('open mic') || r.includes('laugh')) {
    return 'Comedy Shows';
  }
  if (r.includes('exhibition') || r.includes('expo') || r.includes('gallery') || r.includes('craft') || r.includes('showcase')) {
    return 'Exhibitions';
  }
  if (r.includes('college') || r.includes('fest') || r.includes('workshop') || r.includes('campus') || r.includes('bootcamp') || r.includes('training') || r.includes('conference')) {
    return 'College Fests & Workshops';
  }
  if (r.includes('sport') || r.includes('marathon') || r.includes('cricket') || r.includes('football') || r.includes('fitness') || r.includes('yoga') || r.includes('cyclothon')) {
    return 'Sports & Public Activities';
  }
  if (r.includes('family') || r.includes('kids') || r.includes('magic') || r.includes('carnival') || r.includes('circus') || r.includes('amusement') || r.includes('children')) {
    return 'Family Entertainment';
  }
  return 'Community Events';
}

function mapFacilityType(raw: string): LiveEmergencyFacility['facilityType'] {
  const r = raw.toLowerCase();
  if (r.includes('police')) return 'Police Station';
  if (r.includes('fire')) return 'Fire Station';
  if (r.includes('pharm') || r.includes('chemist')) return 'Pharmacy';
  if (r.includes('trauma')) return 'Trauma Center';
  return 'Hospital';
}

function pickProdImage(name: string, cat: string, idx: number): string {
  const n = name.toLowerCase();
  if (n.includes('milk') || n.includes('amul')) return './assets/crops/prod-amul-milk.webp';
  if (n.includes('dal') || n.includes('arhar')) return './assets/crops/prod-arhar-dal.webp';
  if (n.includes('atta') || n.includes('flour') || n.includes('bread')) return './assets/crops/prod-atta.webp';
  if (n.includes('banana') || n.includes('tomato') || n.includes('veg')) return './assets/crops/prod-banana.webp';
  if (n.includes('dettol') || n.includes('mask') || cat === 'Medicines') return './assets/crops/prod-dettol.webp';
  if (cat === 'Electronics') return './assets/crops/store-gupta-elec.webp';
  const pool = [
    './assets/crops/prod-arhar-dal.webp',
    './assets/crops/prod-amul-milk.webp',
    './assets/crops/prod-atta.webp',
    './assets/crops/prod-banana.webp',
    './assets/crops/prod-dettol.webp',
  ];
  return pool[idx % pool.length];
}

function pickSvcImage(cat: string, idx: number): string {
  if (cat === 'Cleaning') return './assets/crops/srv-cleaning.webp';
  if (cat === 'Beauty & Salon') return './assets/crops/biz-card-looks.webp';
  if (cat === 'Tutoring') return './assets/crops/pro-sharma.webp';
  if (cat === 'Health') return './assets/crops/store-medplus.webp';
  const pool = [
    './assets/crops/srv-ac-repair.webp',
    './assets/crops/srv-cleaning.webp',
    './assets/crops/srv-electrician.webp',
    './assets/crops/srv-plumbing.webp',
  ];
  return pool[idx % pool.length];
}

function pickOfferImage(cat: string, idx: number): string {
  if (cat === 'Groceries') return './assets/crops/offer-dmart.webp';
  if (cat === 'Salon & Spa') return './assets/crops/offer-looks.webp';
  if (cat === 'Fitness & Health') return './assets/crops/offer-cultfit.webp';
  if (cat === 'Services') return './assets/crops/offer-urban-company.webp';
  const pool = [
    './assets/crops/offer-lapinoz.webp',
    './assets/crops/offer-burger-singh.webp',
    './assets/crops/offer-chaayos.webp',
    './assets/crops/offer-croma.webp',
  ];
  return pool[idx % pool.length];
}

function pickEventImage(cat: string, idx: number): string {
  if (cat === 'Hackathons & Contests') return './assets/crops/evt-techtalk.webp';
  if (cat === 'Sports & Public Activities') return './assets/crops/evt-yoga.webp';
  if (cat === 'Festivals & Fairs') return './assets/crops/evt-food-carnival.webp';
  if (cat === 'College Fests & Workshops') return './assets/crops/evt-techtalk.webp';
  if (cat === 'Concerts & Music') return './assets/crops/evt-music-fest.webp';
  if (cat === 'Comedy Shows') return './assets/crops/event-comedy.webp';
  if (cat === 'Exhibitions') return './assets/crops/evt-art-exhib.webp';
  if (cat === 'Movies & Cinema Announcements' || cat === 'Theatre & Drama') return './assets/crops/event-summer-fest.webp';
  if (cat === 'Family Entertainment') return './assets/crops/event-summer-fest.webp';
  const pool = [
    './assets/crops/event-summer-fest.webp',
    './assets/crops/event-cleanup.webp',
    './assets/crops/event-comedy.webp',
    './assets/crops/evt-art-exhib.webp',
  ];
  return pool[idx % pool.length];
}

/* ============================================================================
   MERCHANT PORTAL -> CITIZEN PORTAL LIVE GLOBAL SYNCHRONIZERS
   Ensures every merchant action (add product, pause/resume stock, add deal)
   is immediately and reliably visible to all citizens with all conditions set.
   ============================================================================ */

export function syncMerchantProductToGlobal(
  prod: {
    id?: string;
    name: string;
    price: number;
    category: string;
    description?: string;
    image?: string;
    status?: string;
  },
  business: {
    name: string;
    address: string;
    phone: string;
    locality?: string;
    city?: string;
    locationArea?: string;
  }
): LiveProductItem | null {
  // 1. Enforce Startup Business Conditions & Validation Rules
  const cleanName = (prod.name || '').trim();
  const cleanPrice = Number(prod.price || 0);
  if (!cleanName || cleanName.length < 2 || cleanPrice <= 0) {
    return null;
  }

  const locality = business.locality || (business.locationArea ? business.locationArea.split(',')[0].trim() : 'Local Area');
  const city = business.city || (business.locationArea && business.locationArea.includes(',') ? business.locationArea.split(',')[1]?.trim() : 'India') || 'India';
  const onlinePrice = Math.round(cleanPrice * 1.18); // 18% offline local savings benchmark
  const savings = Math.max(0, onlinePrice - cleanPrice);

  const mappedCat = mapToFrontendProdCategory(prod.category || 'Groceries');

  const liveItem: LiveProductItem = {
    id: prod.id || `merchant-prod-${Date.now()}`,
    name: cleanName,
    brand: business.name,
    cat: mappedCat,
    price: `₹${cleanPrice.toLocaleString('en-IN')}`,
    localPriceNum: cleanPrice,
    oldPrice: `₹${onlinePrice.toLocaleString('en-IN')}`,
    onlinePriceNum: onlinePrice,
    onlineProvider: 'Quick-Commerce MRP',
    savingsAmount: savings,
    savingsPercent: Math.round((savings / onlinePrice) * 100),
    betterOffline: true,
    unit: '1 unit • Live Store Stock',
    store: business.name,
    storeAddress: business.address,
    phone: business.phone || '+91 98110 24024',
    dist: '0.4 km',
    distanceKm: 0.4,
    rating: '4.8',
    reviews: '(Verified)',
    inStock: prod.status !== 'Paused',
    freshnessLabel: 'Live Store Inventory',
    discount: savings > 0 ? `Save ₹${savings}` : 'Store Price',
    img: prod.image || pickProdImage(cleanName, mappedCat, 0),
    lat: 28.7155,
    lng: 77.1185,
  };

  const existing = loadLocalList<LiveProductItem>(CUSTOM_PROD_KEY);
  // Remove duplicate with same id or matching name & store
  const filtered = existing.filter(
    (p) => p.id !== liveItem.id && !(p.name.toLowerCase() === liveItem.name.toLowerCase() && p.store === liveItem.store)
  );
  saveLocalList(CUSTOM_PROD_KEY, [liveItem, ...filtered]);
  return liveItem;
}

export function syncMerchantProductToggle(productId: string, isPaused: boolean): void {
  const existing = loadLocalList<LiveProductItem>(CUSTOM_PROD_KEY);
  const updated = existing.map((p) => {
    if (p.id === productId || p.id.includes(productId)) {
      return {
        ...p,
        inStock: !isPaused,
        freshnessLabel: isPaused ? 'Temporarily Paused' : 'In Stock Now',
      };
    }
    return p;
  });
  saveLocalList(CUSTOM_PROD_KEY, updated);
}
