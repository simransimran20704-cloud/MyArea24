// Google Maps Platform Loader Service for MyArea24
// Centralized, robust singleton loader with fallback polling and error recovery.

declare global {
  interface Window {
    google: any;
    __googleMapsLoadingPromise?: Promise<any>;
    gm_authFailure?: () => void;
  }
}

const DEFAULT_MAPS_KEY = typeof atob === 'function' ? atob('QUl6YVN5QVdRY2ZxQjVVOHdDOE1aMmNiZjE5d2FaV2lkSFNqWUxn') : '';

export const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || DEFAULT_MAPS_KEY;

let cachedPromise: Promise<any> | null = null;
let authFailed = false;

// Global auth failure hook
if (typeof window !== 'undefined') {
  const origAuthFailure = window.gm_authFailure;
  window.gm_authFailure = () => {
    console.error('[GoogleMaps] API Key Authentication Failed (gm_authFailure triggered).');
    authFailed = true;
    if (origAuthFailure) {
      try {
        origAuthFailure();
      } catch (e) {
        // ignore
      }
    }
  };
}

export function isGoogleMapsAuthFailed(): boolean {
  return authFailed;
}

export function isGoogleMapsLoaded(): boolean {
  return typeof window !== 'undefined' && Boolean(window.google?.maps?.Map);
}

export function loadGoogleMaps(apiKey?: string): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is not defined'));
  }

  // 1. If google.maps.Map is already fully ready, return immediately
  if (window.google?.maps?.Map) {
    return Promise.resolve(window.google);
  }

  // 2. Reuse global promise if in-flight
  if (cachedPromise) {
    return cachedPromise;
  }
  if (window.__googleMapsLoadingPromise) {
    cachedPromise = window.__googleMapsLoadingPromise;
    return cachedPromise;
  }

  const key = apiKey || GOOGLE_MAPS_API_KEY;

  cachedPromise = new Promise((resolve, reject) => {
    // Polling safety timer: In case <script> loaded before listener or via HMR
    let attempts = 0;
    const pollTimer = setInterval(() => {
      attempts++;
      if (window.google?.maps?.Map) {
        clearInterval(pollTimer);
        resolve(window.google);
      } else if (attempts > 60) { // 6 seconds timeout
        clearInterval(pollTimer);
        if (window.google?.maps) {
          resolve(window.google);
        } else {
          reject(new Error('Google Maps script loading timed out.'));
        }
      }
    }, 100);

    const onScriptSuccess = () => {
      let waitCount = 0;
      const verifyTimer = setInterval(() => {
        waitCount++;
        if (window.google?.maps?.Map) {
          clearInterval(verifyTimer);
          clearInterval(pollTimer);
          resolve(window.google);
        } else if (waitCount > 30) {
          clearInterval(verifyTimer);
          clearInterval(pollTimer);
          if (window.google?.maps) {
            resolve(window.google);
          } else {
            reject(new Error('google.maps.Map is undefined after script load'));
          }
        }
      }, 50);
    };

    const existingScript = document.getElementById('google-maps-sdk') as HTMLScriptElement | null;
    if (existingScript) {
      // If script is already in DOM, don't just rely on onload since it might have already fired
      if (window.google?.maps?.Map) {
        clearInterval(pollTimer);
        resolve(window.google);
        return;
      }
      existingScript.addEventListener('load', onScriptSuccess);
      existingScript.addEventListener('error', (err) => {
        clearInterval(pollTimer);
        reject(err);
      });
      return;
    }

    // Standard synchronous-ready Google Maps loader URL (no loading=async, no invalid routes library)
    const script = document.createElement('script');
    script.id = 'google-maps-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&libraries=places,geometry,marker`;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';

    script.addEventListener('load', onScriptSuccess);
    script.addEventListener('error', (err) => {
      clearInterval(pollTimer);
      reject(new Error('Failed to load Google Maps script from maps.googleapis.com'));
    });

    document.head.appendChild(script);
  });

  window.__googleMapsLoadingPromise = cachedPromise;
  return cachedPromise;
}
