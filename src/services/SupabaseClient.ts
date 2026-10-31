import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';
import { Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';

// Permanent, deterministic device ID across app restarts
let cachedDeviceId: string | null = null;

export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  
  try {
    // DocumentDir path is permanent per app install on Android (/data/user/0/com.tracker75/files)
    const permanentPath = RNBlobUtil.fs.dirs.DocumentDir || 'attendo_default_storage';
    let hash = 0;
    for (let i = 0; i < permanentPath.length; i++) {
      hash = ((hash << 5) - hash) + permanentPath.charCodeAt(i);
      hash |= 0;
    }
    cachedDeviceId = `attendo-dev-${Platform.OS}-${Math.abs(hash).toString(36)}`;
  } catch (e) {
    cachedDeviceId = `attendo-dev-${Platform.OS}-fallback-v7`;
  }
  return cachedDeviceId;
}

// Lightweight, zero-dependency Supabase REST API helper that CANNOT crash Hermes engine
export async function supabaseRestRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
    prefer?: string;
  } = {}
): Promise<{ data: T | null; error: string | null }> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers: Record<string, string> = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(options.prefer ? { 'Prefer': options.prefer } : {}),
      ...(options.headers || {}),
    };

    const config: RequestInit = {
      method: options.method || 'GET',
      headers,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    };

    const response = await fetch(url, config);
    if (!response.ok) {
      const errText = await response.text();
      return { data: null, error: `HTTP ${response.status}: ${errText}` };
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    return { data: data as T, error: null };
  } catch (e: any) {
    console.warn(`Supabase REST Request to ${endpoint} failed:`, e);
    return { data: null, error: e?.message || 'Network error' };
  }
}
