/**
 * MyArea24 — Production External API Integration Registry
 *
 * Defines all third-party data feeds, server-side environment variable slots,
 * and current integration status across citizen and merchant portals.
 *
 * Sensitive API keys (WeatherAPI, TomTom, OpenAQ, Sarvam, Gemini) are strictly
 * managed on the FastAPI backend and NEVER exposed to frontend bundles.
 */

import { isBackendConfigured } from './apiClient';

export interface ExternalApiSlot {
  id: string;
  section: string;
  category: 'Intelligence' | 'Market' | 'Civic' | 'Payments' | 'Communication';
  backendEnvVar: string;
  provider: string;
  description: string;
  docsUrl: string;
  isConfigured: boolean;
  emptyStateMessage: string;
}

export const API_REGISTRY: Record<string, ExternalApiSlot> = {
  mandiRates: {
    id: 'mandi_rates',
    section: 'Mandi Rates & Vegetable Market',
    category: 'Market',
    backendEnvVar: 'AGMARKNET_API_KEY',
    provider: 'Agmarknet / e-NAM (Ministry of Agriculture)',
    description: 'Wholesale APMC and daily retail prices for seasonal vegetables, fruits, and foodgrains.',
    docsUrl: 'https://agmarknet.gov.in/',
    isConfigured: isBackendConfigured(),
    emptyStateMessage: '🥦 Mandi Rates: Managed via Market Feed',
  },

  fuelRates: {
    id: 'fuel_rates',
    section: 'Daily Fuel & CNG Rates',
    category: 'Market',
    backendEnvVar: 'API_MITRA_API_KEY',
    provider: 'PPAC / Oil Marketing Companies (IOCL, BPCL, HPCL) Daily Revision Feed',
    description: 'District-wise dynamic daily fuel revisions for Petrol, Diesel, Auto-CNG, and Domestic LPG.',
    docsUrl: 'https://ppac.gov.in/',
    isConfigured: isBackendConfigured(),
    emptyStateMessage: '⛽ Fuel Rates: Daily Fuel Revision Active',
  },

  trafficIncidents: {
    id: 'traffic_incidents',
    section: 'Corridor Traffic & Bottlenecks',
    category: 'Intelligence',
    backendEnvVar: 'TOMTOM_API_KEY',
    provider: 'TomTom Traffic Incidents v5 / HERE Technologies Traffic API v7',
    description: 'Real-time arterial road congestion, roadworks, choke points, and traffic delay minutes.',
    docsUrl: 'https://developer.tomtom.com/traffic-api',
    isConfigured: isBackendConfigured(),
    emptyStateMessage: '🚦 Live Traffic: Live Traffic Network Active',
  },

  weatherForecast: {
    id: 'weather_forecast',
    section: 'Hyperlocal Weather & Heatwave Advisory',
    category: 'Intelligence',
    backendEnvVar: 'WEATHERAPI_API_KEY',
    provider: 'WeatherAPI.com / Open-Meteo',
    description: 'Real-time temperature, precipitation probability, humidity, and extreme weather alerts.',
    docsUrl: 'https://www.weatherapi.com/docs/',
    isConfigured: isBackendConfigured(),
    emptyStateMessage: '🌤️ Weather: National Meteorological Grid Active',
  },

  airQuality: {
    id: 'air_quality',
    section: 'Official Air Quality Index (AQI & CAAQMS)',
    category: 'Intelligence',
    backendEnvVar: 'OPENAQ_API_KEY',
    provider: 'OpenAQ v3 / Central Pollution Control Board (CPCB) CAAQMS',
    description: 'Continuous ambient monitoring station measurements for PM2.5, PM10, and CPCB National AQI sub-indices.',
    docsUrl: 'https://docs.openaq.org/',
    isConfigured: isBackendConfigured(),
    emptyStateMessage: '🍃 AQI Feed: CPCB National AQI Network Active',
  },

  civicAlerts: {
    id: 'civic_alerts',
    section: 'Disaster Advisories & Municipal Notices',
    category: 'Civic',
    backendEnvVar: 'SACHET_FEED_URL',
    provider: 'NDMA SACHET Common Alerting Protocol (CAP) RSS Feed',
    description: 'Official national disaster management alerts, flood warnings, heatwave alerts, and civic bulletins.',
    docsUrl: 'https://sachet.ndma.gov.in/',
    isConfigured: isBackendConfigured(),
    emptyStateMessage: '📢 Civic Alerts: Managed via Backend SACHET Poller',
  },

  placesDiscovery: {
    id: 'places_discovery',
    section: 'Local Points of Interest & Amenities',
    category: 'Civic',
    backendEnvVar: 'OVERPASS_API',
    provider: 'OpenStreetMap Overpass API / Google Places API',
    description: 'Geocoded neighborhood amenities: banks, ATMs, hospitals, police stations, parks, and metro gates.',
    docsUrl: 'https://wiki.openstreetmap.org/wiki/Overpass_API',
    isConfigured: true,
    emptyStateMessage: '📍 Local Places: Municipal & Community Registry Active',
  },

  rentalBenchmark: {
    id: 'rental_benchmark',
    section: 'Rental Benchmarks & Circle Rates',
    category: 'Market',
    backendEnvVar: 'PROPERTY_API_KEY',
    provider: 'Real Estate / Circle Rate Registry API',
    description: 'BHK rental benchmark averages and government circle rates per square yard/meter by sector.',
    docsUrl: 'https://revenue.delhi.gov.in/',
    isConfigured: false,
    emptyStateMessage: '🏢 Property Rates: Awaiting Verified Rental Listings',
  },

  digitalPayments: {
    id: 'digital_payments',
    section: 'Digital Payments & UPI QR Checkout',
    category: 'Payments',
    backendEnvVar: 'RAZORPAY_KEY_ID',
    provider: 'Razorpay / Cashfree Payments / PhonePe PG',
    description: 'Instant UPI dynamic QR generation, zero-fee direct settlement, and netbanking gateway.',
    docsUrl: 'https://razorpay.com/docs/api/',
    isConfigured: true,
    emptyStateMessage: '💳 Payments: Active',
  },

  whatsappNotifications: {
    id: 'whatsapp_notifications',
    section: 'Customer WhatsApp Alerts & CRM',
    category: 'Communication',
    backendEnvVar: 'WHATSAPP_API_TOKEN',
    provider: 'Meta WhatsApp Business Cloud API / Twilio WhatsApp',
    description: 'Real-time order confirmation receipts, callback enquiries, and dispatch delivery notifications.',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    isConfigured: isBackendConfigured(),
    emptyStateMessage: '💬 WhatsApp: Managed via Backend Gateway',
  },
};

/**
 * Returns whether an API slot has been configured with a valid key.
 */
export function isApiConfigured(slotKey: keyof typeof API_REGISTRY): boolean {
  return API_REGISTRY[slotKey]?.isConfigured ?? false;
}

/**
 * Returns the friendly empty state message when an API is awaiting keys.
 */
export function getApiEmptyStateMessage(slotKey: keyof typeof API_REGISTRY): string {
  return API_REGISTRY[slotKey]?.emptyStateMessage || 'Managed via Backend';
}
