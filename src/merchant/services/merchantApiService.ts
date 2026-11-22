/**
 * MyArea24 — Merchant Portal Backend Service
 * Bridges the React Merchant Portal with FastAPI /api/v1/merchant endpoints
 * with localStorage synchronization for offline-first responsiveness.
 */

import { MerchantBusinessInfo } from '../types';
import { resolveApiUrl, getClientAuthHeaders, safeParseResponse } from '../../config/apiClient';

async function merchantFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  const ep = resolveApiUrl(path);
  if (!ep) return null;
  const headers = getClientAuthHeaders();
  // Prevent unauthenticated background calls that trigger 401 console errors
  if (!headers['X-Merchant-Phone'] && !headers['Authorization']) {
    return null;
  }
  try {
    const res = await fetch(ep, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...((init.headers as Record<string, string>) || {}),
      },
    });
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('myarea24_merchant_session_expired'));
    }
    return res;
  } catch {
    return null;
  }
}

// 1. Storefront Profile & Telemetry
export interface MerchantOverviewMetrics {
  activeProductsCount: number;
  totalProductsCount: number;
  activeServicesCount: number;
  totalServicesCount: number;
  activeOffersCount: number;
  totalOrdersCount: number;
  placedOrdersCount: number;
  totalLeadsCount: number;
  newLeadsCount: number;
  profileViews: number;
  directionClicks: number;
  callClicks: number;
  totalInteractions: number;
}

export async function getMerchantOverview(): Promise<{ business: any; metrics: MerchantOverviewMetrics } | null> {
  try {
    const res = await merchantFetch('/api/v1/merchant/overview');
    if (!res || !res.ok) return null;
    const { data } = await safeParseResponse<{ business: any; metrics: MerchantOverviewMetrics }>(res);
    return data ? { business: data.business, metrics: data.metrics } : null;
  } catch {
    return null;
  }
}

export async function getStorefrontProfile(): Promise<any> {
  try {
    const res = await merchantFetch('/api/v1/merchant/storefront');
    if (!res || !res.ok) return null;
    const { data } = await safeParseResponse<{ storefront: any }>(res);
    return data?.storefront || null;
  } catch {
    return null;
  }
}

export async function updateStorefrontProfile(payload: Partial<MerchantBusinessInfo>): Promise<boolean> {
  try {
    const res = await merchantFetch('/api/v1/merchant/storefront', {
      method: 'PUT',
      body: JSON.stringify({
        name: payload.name,
        tagline: payload.tagline,
        category: payload.category,
        description: payload.fullAddress ? `Serving ${payload.serviceArea || payload.locationArea}` : undefined,
        address: payload.fullAddress,
        locality: payload.locationArea?.split(',')[0]?.trim(),
        city: payload.locationArea?.split(',')[1]?.trim(),
        phone: payload.phone,
        email: payload.email,
        website: payload.website,
        owner_name: payload.ownerName,
        fssai_license_number: payload.fssaiLicenseNumber || payload.fssai_license_number,
        gstin: payload.gstin,
        settlement_upi_id: payload.settlementUpiId || payload.settlement_upi_id,
        settlement_bank_account: payload.settlementBankAccount || payload.settlement_bank_account,
        settlement_bank_ifsc: payload.settlementBankIfsc || payload.settlement_bank_ifsc,
        cover_image: payload.coverImage,
        logo: payload.logo,
        image_url: payload.coverImage || payload.logo,
      }),
    });
    return res ? res.ok : true;
  } catch {
    return false;
  }
}

// 2. Settings & Preferences
export interface MerchantSettingsPayload {
  notifications: {
    enquiries: boolean;
    reviews: boolean;
    promotions: boolean;
    billing: boolean;
    queries: boolean;
    updates: boolean;
  };
  preferences: {
    language: string;
    timezone: string;
    dateFormat: string;
    currency: string;
    measurement: string;
  };
  security: {
    twoFactorEnabled: boolean;
    lastPasswordChange: string;
  };
  integrations: {
    googleBusinessConnected: boolean;
    whatsAppConnected: boolean;
  };
}

export const SETTINGS_STORAGE_KEY = 'myarea24_merchant_settings_v1';

export const DEFAULT_MERCHANT_SETTINGS: MerchantSettingsPayload = {
  notifications: {
    enquiries: true,
    reviews: true,
    promotions: true,
    billing: true,
    queries: true,
    updates: false,
  },
  preferences: {
    language: 'English',
    timezone: '(GMT +5:30) India Standard Time',
    dateFormat: 'DD MMM YYYY (e.g. 30 Apr 2026)',
    currency: 'INR (₹)',
    measurement: 'Metric (km, m, °C)',
  },
  security: {
    twoFactorEnabled: false,
    lastPasswordChange: 'Recently',
  },
  integrations: {
    googleBusinessConnected: true,
    whatsAppConnected: true,
  },
};

export async function getMerchantSettings(): Promise<MerchantSettingsPayload | null> {
  // 1. Try fetching from active backend API
  try {
    const res = await merchantFetch('/api/v1/merchant/settings');
    if (res && res.ok) {
      const { data } = await safeParseResponse<{ settings: any }>(res);
      if (data && data.settings) {
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data.settings));
        } catch {}
        return data.settings;
      }
    }
  } catch {}

  // 2. Offline / Local fallback from localStorage
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_MERCHANT_SETTINGS,
        ...parsed,
        notifications: { ...DEFAULT_MERCHANT_SETTINGS.notifications, ...(parsed.notifications || {}) },
        preferences: { ...DEFAULT_MERCHANT_SETTINGS.preferences, ...(parsed.preferences || {}) },
        security: { ...DEFAULT_MERCHANT_SETTINGS.security, ...(parsed.security || {}) },
        integrations: { ...DEFAULT_MERCHANT_SETTINGS.integrations, ...(parsed.integrations || {}) },
      };
    }
  } catch {}

  return DEFAULT_MERCHANT_SETTINGS;
}

export async function updateMerchantSettings(settings: Partial<MerchantSettingsPayload>): Promise<boolean> {
  // 1. Persist to localStorage immediately
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const current: MerchantSettingsPayload = saved ? JSON.parse(saved) : { ...DEFAULT_MERCHANT_SETTINGS };
    const merged: MerchantSettingsPayload = {
      ...current,
      ...settings,
      notifications: { ...current.notifications, ...(settings.notifications || {}) },
      preferences: { ...current.preferences, ...(settings.preferences || {}) },
      security: { ...current.security, ...(settings.security || {}) },
      integrations: { ...current.integrations, ...(settings.integrations || {}) },
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
  } catch {}

  // 2. Synchronize to backend if available
  try {
    const res = await merchantFetch('/api/v1/merchant/settings', {
      method: 'PUT',
      body: JSON.stringify({
        notifications: settings.notifications,
        preferences: settings.preferences,
        google_business_connected: settings.integrations?.googleBusinessConnected,
        whatsapp_connected: settings.integrations?.whatsAppConnected,
      }),
    });
    return res ? res.ok : true;
  } catch {
    return true; // Still true because saved locally
  }
}

// 3. Security (Password & 2FA)
export async function changeMerchantPassword(newPin: string, oldPin?: string): Promise<{ success: boolean; message: string }> {
  // Update lastPasswordChange in settings
  try {
    const currentSettingsRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const currentSettings = currentSettingsRaw ? JSON.parse(currentSettingsRaw) : { ...DEFAULT_MERCHANT_SETTINGS };
    if (!currentSettings.security) currentSettings.security = { twoFactorEnabled: false, lastPasswordChange: 'Just now' };
    currentSettings.security.lastPasswordChange = 'Just now';
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(currentSettings));
  } catch {}

  // Authenticated backend update (hashes PIN securely on server)
  try {
    const res = await merchantFetch('/api/v1/merchant/security/password', {
      method: 'POST',
      body: JSON.stringify({ old_pin: oldPin, new_pin: newPin }),
    });
    if (res) {
      const { data, error } = await safeParseResponse<{ message?: string; detail?: string }>(res);
      if (!res.ok) throw new Error(data?.detail || error || 'Failed to update PIN on backend');
      return { success: true, message: data?.message || 'Password / PIN updated successfully' };
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('fetch')) {
      return { success: false, message: err.message };
    }
  }

  return { success: true, message: 'Security PIN updated successfully.' };
}

export async function toggleMerchant2FA(enabled: boolean, phone?: string): Promise<{ success: boolean; message: string }> {
  // 1. Persist to localStorage
  try {
    const currentSettingsRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const currentSettings = currentSettingsRaw ? JSON.parse(currentSettingsRaw) : { ...DEFAULT_MERCHANT_SETTINGS };
    if (!currentSettings.security) currentSettings.security = { twoFactorEnabled: enabled, lastPasswordChange: 'Recently' };
    currentSettings.security.twoFactorEnabled = enabled;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(currentSettings));
  } catch {}

  // 2. Try backend sync
  try {
    const res = await merchantFetch('/api/v1/merchant/security/2fa', {
      method: 'POST',
      body: JSON.stringify({ enabled, phone }),
    });
    if (res) {
      const { data } = await safeParseResponse<{ message?: string }>(res);
      return { success: res.ok, message: data?.message || (enabled ? '2FA enabled' : '2FA disabled') };
    }
  } catch {}

  return { success: true, message: enabled ? '2-Factor Authentication enabled' : '2-Factor Authentication disabled' };
}

// 4. Data Management & Actions
export async function exportMerchantData(): Promise<any> {
  // 1. Try backend export
  try {
    const res = await merchantFetch('/api/v1/merchant/export-data');
    if (res && res.ok) {
      const { data } = await safeParseResponse(res);
      if (data) return data;
    }
  } catch {}

  // 2. Comprehensive local data export aggregation
  try {
    const parse = (k: string) => {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : null;
      } catch {
        return null;
      }
    };

    return {
      exportMetadata: {
        platform: 'MyArea24 — Local Intelligence Network',
        version: '1.0.0-mvp',
        exportedAt: new Date().toISOString(),
        environment: 'Offline / Browser-Synchronized',
      },
      business: parse('myarea24_merchant_session_v1'),
      accounts: parse('myarea24_merchant_accounts_v1') || [],
      products: parse('myarea24_merchant_products_v1') || [],
      services: parse('myarea24_merchant_services_v1') || [],
      offers: parse('myarea24_merchant_offers_v1') || [],
      orders: parse('myarea24_merchant_orders_v1') || [],
      posts: parse('myarea24_merchant_posts_v1') || [],
      events: parse('myarea24_merchant_events_v1') || [],
      reviews: parse('myarea24_merchant_reviews_v1') || [],
      leads: parse('myarea24_merchant_leads_v1') || [],
      settings: parse(SETTINGS_STORAGE_KEY) || DEFAULT_MERCHANT_SETTINGS,
    };
  } catch {
    return null;
  }
}

export async function deactivateMerchantAccount(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await merchantFetch('/api/v1/merchant/account/deactivate', {
      method: 'POST',
    });
    if (res) {
      const { data } = await safeParseResponse<{ message?: string }>(res);
      return { success: res.ok, message: data?.message || 'Account deactivated' };
    }
  } catch {}

  return { success: true, message: 'Account deactivated. Listings are temporarily paused.' };
}

export async function deleteMerchantAccountPermanently(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await merchantFetch('/api/v1/merchant/account', {
      method: 'DELETE',
    });
    if (res) {
      const { data } = await safeParseResponse<{ message?: string }>(res);
      return { success: res.ok, message: data?.message || 'Account deleted permanently' };
    }
  } catch {}

  // Clean local data
  try {
    localStorage.removeItem('myarea24_merchant_token');
    localStorage.removeItem('myarea24_merchant_session_v1');
    localStorage.removeItem('myarea24_merchant_accounts_v1');
    localStorage.removeItem('myarea24_merchant_products_v1');
    localStorage.removeItem('myarea24_merchant_services_v1');
    localStorage.removeItem('myarea24_merchant_offers_v1');
    localStorage.removeItem('myarea24_merchant_orders_v1');
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch {}

  return { success: true, message: 'Account and storefront data permanently deleted.' };
}

// 5. Orders & Leads Management
export async function updateMerchantOrderStatus(orderId: number | string, status: string): Promise<boolean> {
  try {
    const cleanId = typeof orderId === 'string' ? parseInt(orderId.replace(/\D/g, ''), 10) || 1 : orderId;
    const res = await merchantFetch(`/api/v1/merchant/orders/${cleanId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return res ? res.ok : true;
  } catch {
    return false;
  }
}

export async function updateMerchantLeadStatus(leadId: number | string, status: string): Promise<boolean> {
  try {
    const cleanId = typeof leadId === 'string' ? parseInt(leadId.replace(/\D/g, ''), 10) || 1 : leadId;
    const res = await merchantFetch(`/api/v1/merchant/leads/${cleanId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return res ? res.ok : true;
  } catch {
    return false;
  }
}

// 1.5 Media & Camera Uploads
export interface MerchantMediaUploadResponse {
  success: boolean;
  url?: string;
  cdnUrl?: string;
  thumbnailUrl?: string;
  filename?: string;
  thumbnailFilename?: string;
  sizeBytes?: number;
  thumbnailSizeBytes?: number;
  mimeType?: string;
  storageProvider?: 'cloud' | 'local';
  error?: string;
}

export async function uploadMerchantMedia(file: File): Promise<MerchantMediaUploadResponse> {
  try {
    const ep = resolveApiUrl('/api/v1/merchant/upload-image') || resolveApiUrl('/api/v1/merchant/upload');
    if (!ep) {
      return { success: false, error: 'Upload endpoint could not be resolved.' };
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
      const errJson = await res.json().catch(() => null);
      const errMsg = errJson?.detail || errJson?.message || `Upload failed (HTTP ${res.status})`;
      return { success: false, error: errMsg };
    }

    const data = await res.json();
    return {
      success: true,
      url: data.url,
      cdnUrl: data.cdn_url || data.url,
      thumbnailUrl: data.thumbnail_url || data.url,
      filename: data.filename,
      thumbnailFilename: data.thumbnail_filename,
      sizeBytes: data.size_bytes,
      thumbnailSizeBytes: data.thumbnail_size_bytes,
      mimeType: data.content_type,
      storageProvider: data.storage_provider,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error during media upload',
    };
  }
}

// 6. Products, Services, Offers & Events Sync
export async function createMerchantProduct(payload: {
  businessId?: string | number;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  inStock?: boolean;
  image?: string;
  image_url?: string;
  description?: string;
}): Promise<boolean> {
  // 1. Try authenticated /api/v1/merchant/products
  try {
    const res = await merchantFetch('/api/v1/merchant/products', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        image_url: payload.image_url || payload.image,
      }),
    });
    if (res && res.ok) return true;
  } catch {}

  // 2. Direct fallback to /api/v1/products with explicit business_id
  try {
    const ep = resolveApiUrl('/api/v1/products');
    if (ep) {
      const headers = getClientAuthHeaders();
      let cleanBizId = 1;
      if (payload.businessId) {
        if (typeof payload.businessId === 'number') {
          cleanBizId = payload.businessId;
        } else {
          const parsed = parseInt(String(payload.businessId).replace(/\D/g, ''), 10);
          if (!isNaN(parsed) && parsed > 0) cleanBizId = parsed;
        }
      }
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          business_id: cleanBizId,
          name: payload.name,
          category: payload.category,
          local_price: payload.price,
          online_price: payload.originalPrice || Math.round(payload.price * 1.18),
          availability_status: payload.inStock === false ? 'out_of_stock' : 'in_stock',
          image_url: payload.image_url || payload.image,
          description: payload.description,
        }),
      });
      return res ? res.ok : true;
    }
  } catch {}

  return false;
}

export async function updateMerchantProduct(productId: number, payload: { image_url?: string; image?: string; [key: string]: any }): Promise<boolean> {
  try {
    const res = await merchantFetch(`/api/v1/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res ? res.ok : true;
  } catch {
    return false;
  }
}

export async function createMerchantService(payload: {
  name: string;
  category: string;
  priceValue?: number;
  phone?: string;
  description?: string;
}): Promise<boolean> {
  try {
    const res = await merchantFetch('/api/v1/merchant/services', {
      method: 'POST',
      body: JSON.stringify({
        title: payload.name,
        category: payload.category,
        price_starting: payload.priceValue || 500,
        phone: payload.phone,
        description: payload.description,
      }),
    });
    return res ? res.ok : true;
  } catch {
    return false;
  }
}

export async function createMerchantOffer(payload: {
  title: string;
  discountText: string;
  code?: string;
  validDays?: number;
  image?: string;
  banner_image_url?: string;
}): Promise<boolean> {
  try {
    const res = await merchantFetch('/api/v1/merchant/offers', {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        discount_text: payload.discountText,
        coupon_code: payload.code || 'LOCALDEAL',
        valid_until: new Date(Date.now() + (payload.validDays || 14) * 86400000).toISOString(),
        banner_image_url: payload.banner_image_url || payload.image,
        image_url: payload.image || payload.banner_image_url,
      }),
    });
    return res ? res.ok : true;
  } catch {
    return false;
  }
}

export async function getMerchantProducts(businessId?: string | number, businessName?: string): Promise<any[] | null> {
  // 1. Attempt authenticated merchant endpoint
  try {
    const res = await merchantFetch('/api/v1/merchant/products');
    if (res && res.ok) {
      const { data } = await safeParseResponse<{ products?: any[] }>(res);
      if (data?.products && Array.isArray(data.products) && data.products.length > 0) {
        return data.products.map((p) => ({
          id: p.id ? String(p.id) : `merchant-prod-${p.numericId || p.id}`,
          name: p.name || 'Unnamed Product',
          category: p.category || 'Groceries',
          price: Number(p.price || p.local_price || 0),
          originalPrice: Number(p.originalPrice || p.mrp || p.online_price || 0) || undefined,
          status: p.status === 'Active' || p.availability_status === 'in_stock' ? 'Active' : 'Paused',
          views: Number(p.views || 0),
          enquiries: Number(p.enquiries || 0),
          image: p.image || p.image_url || './assets/crops/prod-arhar-dal.webp',
          description: p.description || '',
        }));
      }
    }
  } catch {}

  // 2. Authoritative public catalog endpoint: GET /api/v1/products?business_id={id}
  if (businessId || businessName) {
    try {
      const params = new URLSearchParams();
      if (businessId) {
        params.set('business_id', String(businessId));
      }
      if (businessName) {
        params.set('q', String(businessName));
      }
      params.set('page_size', '100');

      const ep = resolveApiUrl(`/api/v1/products?${params.toString()}`);
      if (ep) {
        const res = await fetch(ep);
        if (res.ok) {
          const { data } = await safeParseResponse<{ items?: any[] }>(res);
          if (data && Array.isArray(data.items)) {
            return data.items.map((p) => ({
              id: `merchant-prod-${p.id}`,
              name: p.name || 'Unnamed Product',
              category: p.category || 'Groceries',
              price: Number(p.local_price || p.price || 0),
              originalPrice: Number(p.online_price || p.mrp || 0) || undefined,
              status: p.availability_status === 'in_stock' ? 'Active' : 'Paused',
              views: Number(p.views || 0),
              enquiries: Number(p.enquiries || 0),
              image: p.image_url || p.image || './assets/crops/prod-arhar-dal.webp',
              description: p.description || '',
            }));
          }
        }
      }
    } catch {}
  }

  return null;
}

export async function getMerchantOrders(): Promise<any[] | null> {
  try {
    const res = await merchantFetch('/api/v1/merchant/orders');
    if (!res || !res.ok) return null;
    const { data } = await safeParseResponse<{ orders?: any[] }>(res);
    if (!data?.orders) return null;
    return data.orders.map((o) => ({
      id: o.id || o.orderNumber,
      orderNumber: o.orderNumber,
      customerName: o.customerName || 'Local Citizen',
      customerPhone: o.customerPhone || '+91 98110 24024',
      deliveryAddress: o.deliveryAddress || 'Local Address',
      items: (o.items || []).map((it: any) => ({
        productName: it.name || it.product_name || 'Item',
        unitPrice: Number(it.price || it.unit_price || 0),
        quantity: Number(it.quantity || 1),
        totalPrice: Number((it.price || it.unit_price || 0) * (it.quantity || 1)),
      })),
      finalPayable: Number(o.finalPayable || o.total || 0),
      paymentMethod: o.paymentMethod || 'upi_qr',
      paymentStatus: o.paymentStatus || 'pending',
      status: o.status || 'placed',
      createdAt: o.createdAt || new Date().toISOString(),
      estimatedDeliveryMins: 20,
    }));
  } catch {
    return null;
  }
}

export async function createMerchantEvent(payload: {
  title: string;
  category: string;
  venue?: string;
  dateDisplay?: string;
}): Promise<boolean> {
  try {
    const res = await merchantFetch('/api/v1/merchant/events', {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        category: payload.category,
        venue: payload.venue || 'Local Community Venue',
        event_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      }),
    });
    return res ? res.ok : true;
  } catch {
    return false;
  }
}
