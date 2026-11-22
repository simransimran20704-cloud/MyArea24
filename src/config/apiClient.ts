/**
 * MyArea24 — Unified API Client & Environment Configuration
 * Provides centralized backend URL resolution, mixed-content prevention,
 * robust network failure handling (502/500 HTML guards), and JWT token management.
 */

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
  ok: boolean;
}

export function getApiBaseUrl(): string | null {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  const configured = metaEnv.VITE_API_BASE_URL || metaEnv.VITE_BACKEND_URL;
  if (configured && typeof configured === 'string' && configured.trim().length > 0) {
    return configured.trim().replace(/\/+$/, '');
  }

  // If running in a browser environment:
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // 1. Local development or preview mode on any localhost port (proxied to backend)
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      return '';
    }
    // 2. Staging or production domain served via Nginx reverse proxy (same-origin /api)
    if (host.includes('myarea24.in')) {
      return '';
    }
    // 3. GitHub Pages static showcase without backend attached
    if (host.endsWith('github.io')) {
      return null;
    }
    // 4. Default for custom web deployments with same-origin reverse proxy
    if (window.location.protocol.startsWith('http')) {
      return '';
    }
  }

  // When no backend URL is configured (static preview or GitHub Pages without backend):
  return null;
}

export function isBackendConfigured(): boolean {
  return getApiBaseUrl() !== null;
}

export function resolveApiUrl(path: string): string | null {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const baseUrl = getApiBaseUrl();
  if (baseUrl === null) {
    return null;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return baseUrl === '' ? cleanPath : `${baseUrl}${cleanPath}`;
}

export function getClientAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  try {
    if (typeof localStorage !== 'undefined') {
      const token =
        localStorage.getItem('myarea24_merchant_token') ||
        localStorage.getItem('myarea24_auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const sessionRaw = localStorage.getItem('myarea24_merchant_session_v1');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        if (session.phone) headers['X-Merchant-Phone'] = session.phone;
        if (session.id || session.businessId) headers['X-Merchant-Id'] = String(session.id || session.businessId);
      }
    }
  } catch {}

  return headers;
}

/**
 * Safely parses response body without throwing unhandled SyntaxErrors
 * if the backend returned non-JSON content (e.g. Nginx 502/504 Bad Gateway HTML).
 */
export async function safeParseResponse<T = any>(res: Response): Promise<{ data: T | null; error: string | null }> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const data = (await res.json()) as T;
      return { data, error: null };
    } catch {
      return { data: null, error: 'Malformed JSON payload received from server.' };
    }
  }

  // Handle plain text or HTML 502/500 responses gracefully
  try {
    const text = await res.text();
    if (!res.ok) {
      const cleanSnippet = text.replace(/<[^>]*>?/gm, '').trim().slice(0, 160);
      return {
        data: null,
        error: cleanSnippet ? `Server error: ${cleanSnippet}` : `Request failed with HTTP ${res.status} (${res.statusText || 'Error'})`,
      };
    }
    return { data: text as unknown as T, error: null };
  } catch {
    return { data: null, error: `Request failed with HTTP ${res.status}` };
  }
}

/**
 * Unified API Client request engine with crash-proof error isolation,
 * automatic authorization token injection, and timeout protection.
 */
export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 8000
): Promise<ApiResponse<T>> {
  const targetUrl = resolveApiUrl(path);

  if (targetUrl === null) {
    return {
      data: null,
      error: 'Backend is offline or unconfigured.',
      status: 503,
      ok: false,
    };
  }

  const defaultHeaders = getClientAuthHeaders();
  const mergedHeaders: Record<string, string> = {
    ...defaultHeaders,
    ...((options.headers as Record<string, string>) || {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      ...options,
      headers: mergedHeaders,
      signal: options.signal || controller.signal,
    });
    clearTimeout(timer);

    const { data, error: parseError } = await safeParseResponse<T>(res);

    if (!res.ok) {
      let errorMsg = parseError;
      if (data && typeof data === 'object') {
        const d = data as any;
        errorMsg = d.detail || d.message || d.error || errorMsg || `HTTP ${res.status}`;
      }
      return {
        data,
        error: errorMsg || `Request failed (${res.status} ${res.statusText || 'Error'})`,
        status: res.status,
        ok: false,
      };
    }

    return {
      data,
      error: null,
      status: res.status,
      ok: true,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const isAbort = err.name === 'AbortError';
    return {
      data: null,
      error: isAbort
        ? 'Request timed out. Please check your network connection.'
        : (err.message || 'Network connection failed.'),
      status: isAbort ? 408 : 0,
      ok: false,
    };
  }
}

/**
 * Unified API Client object for structured HTTP calls across frontend dashboards
 */
export const apiClient = {
  request: apiRequest,

  get: <T = any>(path: string, options?: RequestInit, timeoutMs?: number) =>
    apiRequest<T>(path, { ...options, method: 'GET' }, timeoutMs),

  post: <T = any>(path: string, body?: any, options?: RequestInit, timeoutMs?: number) =>
    apiRequest<T>(
      path,
      {
        ...options,
        method: 'POST',
        body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      },
      timeoutMs
    ),

  put: <T = any>(path: string, body?: any, options?: RequestInit, timeoutMs?: number) =>
    apiRequest<T>(
      path,
      {
        ...options,
        method: 'PUT',
        body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      },
      timeoutMs
    ),

  patch: <T = any>(path: string, body?: any, options?: RequestInit, timeoutMs?: number) =>
    apiRequest<T>(
      path,
      {
        ...options,
        method: 'PATCH',
        body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      },
      timeoutMs
    ),

  delete: <T = any>(path: string, options?: RequestInit, timeoutMs?: number) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }, timeoutMs),
};

/**
 * Backwards-compatible helper preserving existing call signatures
 */
export async function requestBackendJson<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 4500
): Promise<T | null> {
  const res = await apiRequest<T>(path, options, timeoutMs);
  return res.ok ? res.data : null;
}
