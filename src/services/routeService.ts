/**
 * Route Service for MyArea24
 * Manages daily commute routes, A-to-B route creation, persistence with backend API & localStorage,
 * and live traffic condition checks via Google Maps Directions & spatial telemetry.
 */

import { resolveApiUrl } from '../config/apiClient';

export interface SavedCommuteRoute {
  id: string | number;
  user_id?: number | null;
  session_id?: string | null;
  title: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  distance_km: number;
  typical_duration_mins: number;
  current_duration_mins: number;
  congestion_level: 'Smooth' | 'Moderate' | 'Heavy' | 'Normal';
  delay_minutes: number;
  alternative_summary?: string | null;
  last_checked_at?: string | null;
  created_at?: string;
}

const STORAGE_KEY = 'myarea24_saved_routes';
const SESSION_KEY = 'myarea24_session_id';

function buildRouteUrl(subpath: string = ''): string {
  const target = `/api/v1/routes${subpath}`;
  const resolved = resolveApiUrl(target);
  return resolved || target;
}

export function getClientSessionId(): string {
  if (typeof window === 'undefined') return 'server_session';
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('myarea24_auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

export function getLocalCachedRoutes(): SavedCommuteRoute[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[routeService] Failed to read cached routes:', err);
  }
  return [];
}

export function saveLocalCachedRoutes(routes: SavedCommuteRoute[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  } catch (err) {
    console.warn('[routeService] Failed to save routes to cache:', err);
  }
}

/**
 * Fetch saved routes for the active user (or guest session).
 */
export async function fetchSavedRoutes(): Promise<SavedCommuteRoute[]> {
  const sid = getClientSessionId();
  try {
    const res = await fetch(buildRouteUrl(`?session_id=${encodeURIComponent(sid)}`), {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.routes)) {
        saveLocalCachedRoutes(data.routes);
        return data.routes;
      }
    }
  } catch (err) {
    console.warn('[routeService] API fetch failed, falling back to cached routes:', err);
  }
  return getLocalCachedRoutes();
}

/**
 * Create and persist a new route.
 */
export async function createSavedRoute(route: {
  title: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  distance_km?: number;
  typical_duration_mins?: number;
  current_duration_mins?: number;
  congestion_level?: string;
  delay_minutes?: number;
  alternative_summary?: string;
}): Promise<SavedCommuteRoute> {
  const sid = getClientSessionId();
  const payload = {
    ...route,
    session_id: sid,
  };

  try {
    const res = await fetch(buildRouteUrl(''), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.route) {
        const saved: SavedCommuteRoute = data.route;
        const current = getLocalCachedRoutes().filter((r) => r.id !== saved.id);
        saveLocalCachedRoutes([saved, ...current]);
        return saved;
      }
    }
  } catch (err) {
    console.warn('[routeService] API route creation failed, using local fallback:', err);
  }

  // Local fallback if offline
  const fallbackRoute: SavedCommuteRoute = {
    id: `local-${Date.now()}`,
    session_id: sid,
    title: route.title,
    origin_name: route.origin_name,
    origin_lat: route.origin_lat,
    origin_lng: route.origin_lng,
    destination_name: route.destination_name,
    destination_lat: route.destination_lat,
    destination_lng: route.destination_lng,
    distance_km: route.distance_km || 12.5,
    typical_duration_mins: route.typical_duration_mins || 25,
    current_duration_mins: route.current_duration_mins || 25,
    congestion_level: (route.congestion_level as any) || 'Normal',
    delay_minutes: route.delay_minutes || 0,
    alternative_summary: route.alternative_summary || null,
    last_checked_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const current = getLocalCachedRoutes();
  saveLocalCachedRoutes([fallbackRoute, ...current]);
  return fallbackRoute;
}

/**
 * Edit / Rename an existing route.
 */
export async function updateSavedRoute(
  routeId: string | number,
  updates: Partial<SavedCommuteRoute>
): Promise<SavedCommuteRoute | null> {
  const sid = getClientSessionId();
  try {
    const res = await fetch(buildRouteUrl(`/${routeId}?session_id=${encodeURIComponent(sid)}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.route) {
        const updated: SavedCommuteRoute = data.route;
        const current = getLocalCachedRoutes().map((r) => (String(r.id) === String(routeId) ? updated : r));
        saveLocalCachedRoutes(current);
        return updated;
      }
    }
  } catch (err) {
    console.warn('[routeService] Route update API failed:', err);
  }

  // Local fallback
  const current = getLocalCachedRoutes();
  const target = current.find((r) => String(r.id) === String(routeId));
  if (target) {
    const modified: SavedCommuteRoute = { ...target, ...updates };
    const nextList = current.map((r) => (String(r.id) === String(routeId) ? modified : r));
    saveLocalCachedRoutes(nextList);
    return modified;
  }
  return null;
}

/**
 * Delete a saved route.
 */
export async function deleteSavedRoute(routeId: string | number): Promise<boolean> {
  const sid = getClientSessionId();
  try {
    const res = await fetch(buildRouteUrl(`/${routeId}?session_id=${encodeURIComponent(sid)}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const current = getLocalCachedRoutes().filter((r) => String(r.id) !== String(routeId));
      saveLocalCachedRoutes(current);
      return true;
    }
  } catch (err) {
    console.warn('[routeService] Route delete API failed:', err);
  }

  // Local fallback
  const current = getLocalCachedRoutes().filter((r) => String(r.id) !== String(routeId));
  saveLocalCachedRoutes(current);
  return true;
}

/**
 * Daily Traffic Check: Request latest traffic conditions on demand for a route.
 */
export async function checkRouteTraffic(routeId: string | number): Promise<SavedCommuteRoute | null> {
  const sid = getClientSessionId();
  try {
    const res = await fetch(buildRouteUrl(`/${routeId}/traffic-check?session_id=${encodeURIComponent(sid)}`), {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.route) {
        const updated: SavedCommuteRoute = data.route;
        const current = getLocalCachedRoutes().map((r) => (String(r.id) === String(routeId) ? updated : r));
        saveLocalCachedRoutes(current);
        return updated;
      }
    }
  } catch (err) {
    console.warn('[routeService] Traffic check API failed:', err);
  }

  // Fallback update timestamp locally
  const current = getLocalCachedRoutes();
  const target = current.find((r) => String(r.id) === String(routeId));
  if (target) {
    const modified = { ...target, last_checked_at: new Date().toISOString() };
    saveLocalCachedRoutes(current.map((r) => (String(r.id) === String(routeId) ? modified : r)));
    return modified;
  }
  return null;
}

/**
 * Batch Traffic Check: Refresh live traffic conditions for all saved commute routes.
 */
export async function checkAllRoutesTraffic(routes: SavedCommuteRoute[]): Promise<SavedCommuteRoute[]> {
  if (!routes || routes.length === 0) return [];
  const results: SavedCommuteRoute[] = [];
  for (const rt of routes) {
    const updated = await checkRouteTraffic(rt.id);
    results.push(updated || rt);
  }
  return results;
}

// Seamless authentication sync: reload routes whenever user logs in or out
if (typeof window !== 'undefined') {
  window.addEventListener('myarea24_auth_change', () => {
    fetchSavedRoutes().catch(() => {});
  });
}

