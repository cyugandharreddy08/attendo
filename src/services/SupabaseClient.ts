import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';
import { getSetting, setSetting, deleteSetting } from '../db/queries/settings';

const SETTING_INSTALLATION_ID = 'device_installation_id';
const SETTING_AUTH_SESSION = 'supabase_auth_session';

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp ms
  user_id: string;
  phone?: string;
}

// In-memory session cache
let inMemorySession: AuthSession | null = null;
let sessionLoaded = false;
let cachedInstallationId: string | null = null;

/**
 * Generate a cryptographically structured RFC 4122 v4 UUID
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns a persistent, anonymous installation UUID for diagnostics only.
 * NEVER used as an authentication or authorization credential.
 */
export async function getInstallationId(): Promise<string> {
  if (cachedInstallationId) return cachedInstallationId;

  try {
    const existing = await getSetting(SETTING_INSTALLATION_ID);
    if (existing) {
      cachedInstallationId = existing;
      return existing;
    }

    const newId = generateUUID();
    await setSetting(SETTING_INSTALLATION_ID, newId);
    cachedInstallationId = newId;
    return newId;
  } catch {
    const fallback = generateUUID();
    cachedInstallationId = fallback;
    return fallback;
  }
}

/**
 * Synchronous accessor for cached installation ID with safe fallback
 */
export function getDeviceId(): string {
  return cachedInstallationId || 'attendo-anon-client';
}

/**
 * Load persisted authenticated session from SQLite
 */
export async function loadAuthSession(): Promise<AuthSession | null> {
  if (sessionLoaded && inMemorySession) return inMemorySession;

  try {
    const raw = await getSetting(SETTING_AUTH_SESSION);
    if (raw) {
      inMemorySession = JSON.parse(raw);
    }
  } catch (e) {
    inMemorySession = null;
  }
  sessionLoaded = true;
  return inMemorySession;
}

/**
 * Persist authenticated session
 */
export async function saveAuthSession(session: AuthSession): Promise<void> {
  inMemorySession = session;
  sessionLoaded = true;
  await setSetting(SETTING_AUTH_SESSION, JSON.stringify(session));
}

/**
 * Invalidate session on sign-out
 */
export async function clearAuthSession(): Promise<void> {
  inMemorySession = null;
  sessionLoaded = true;
  await deleteSetting(SETTING_AUTH_SESSION);
}

/**
 * Refresh expired access token using the stored refresh token
 */
export async function refreshSessionTokenIfNeeded(): Promise<string | null> {
  const session = await loadAuthSession();
  if (!session || !session.refresh_token) return null;

  // If token is still valid for > 60 seconds, return current token
  if (session.expires_at && session.expires_at > Date.now() + 60000) {
    return session.access_token;
  }

  // Attempt token refresh
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (res.ok) {
      const data = await res.json();
      const updated: AuthSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || session.refresh_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        user_id: data.user?.id || session.user_id,
        phone: data.user?.phone || session.phone,
      };
      await saveAuthSession(updated);
      return updated.access_token;
    } else {
      console.warn('Session token refresh failed with HTTP', res.status);
      return session.access_token; // Fallback to last known token
    }
  } catch (e) {
    console.warn('Session token refresh error:', e);
    return session.access_token;
  }
}

/**
 * Centralized, secure Supabase REST Request handler with authenticated Bearer tokens,
 * AbortController timeout, and safe retry logic for idempotent operations.
 */
export async function supabaseRestRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
    body?: any;
    headers?: Record<string, string>;
    prefer?: string;
    timeoutMs?: number;
    requiresAuth?: boolean;
    retryCount?: number;
  } = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const timeoutMs = options.timeoutMs || 15000;
  const isIdempotent = (options.method || 'GET') === 'GET';
  const maxRetries = options.retryCount !== undefined ? options.retryCount : (isIdempotent ? 2 : 0);

  // Determine authorization token: authenticated user JWT or public anon key
  let bearerToken = SUPABASE_ANON_KEY;
  const session = await loadAuthSession();

  if (session?.access_token) {
    const refreshed = await refreshSessionTokenIfNeeded();
    bearerToken = refreshed || session.access_token;
  } else if (options.requiresAuth) {
    return {
      data: null,
      error: 'Authentication required. Please log in with your verified phone number.',
      status: 401,
    };
  }

  // Support both rest/v1/ and auth/v1/ endpoints
  const pathPrefix = endpoint.startsWith('auth/') ? '' : 'rest/v1/';
  const url = `${SUPABASE_URL}/${pathPrefix}${endpoint}`;

  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        ...(options.prefer ? { 'Prefer': options.prefer } : {}),
        ...(options.headers || {}),
      };

      const config: RequestInit = {
        method: options.method || 'GET',
        headers,
        signal: controller.signal,
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      };

      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      const status = response.status;
      if (!response.ok) {
        const errText = await response.text();
        let message = `HTTP ${status}: ${errText}`;
        try {
          const parsed = JSON.parse(errText);
          message = parsed.message || parsed.msg || parsed.error_description || message;
        } catch {}
        return { data: null, error: message, status };
      }

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      return { data: data as T, error: null, status };
    } catch (e: any) {
      clearTimeout(timeoutId);

      const isAbort = e?.name === 'AbortError';
      const errMsg = isAbort ? `Request timeout after ${timeoutMs}ms` : (e?.message || 'Network request failed');

      if (attempt <= maxRetries && isIdempotent) {
        // Exponential backoff delay (500ms, 1000ms)
        await new Promise<void>(resolve => setTimeout(() => resolve(), attempt * 500));
        continue;
      }

      return { data: null, error: errMsg, status: 0 };
    }
  }

  return { data: null, error: 'Maximum retry limit exceeded', status: 0 };
}
