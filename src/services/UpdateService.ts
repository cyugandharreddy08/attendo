import { supabaseRestRequest, getDeviceId } from './SupabaseClient';
import { APP_VERSION } from '../config/supabase';
import { Platform } from 'react-native';

export interface AppVersion {
  id: string;
  version_name: string;
  version_code: number;
  release_notes: string;
  apk_url: string;
  apk_size_bytes: number;
  status: string;
  released_at: string;
}

export interface Changelog {
  id: string;
  version_name: string;
  entries: Array<{ type: 'fix' | 'feature' | 'improvement'; text: string }>;
  published_at: string;
}

export async function registerDevice(): Promise<void> {
  try {
    const deviceId = getDeviceId();
    const { data: users } = await supabaseRestRequest<any[]>(`users?device_id=eq.${encodeURIComponent(deviceId)}`);

    if (users && users.length > 0) {
      await supabaseRestRequest(`users?id=eq.${users[0].id}`, {
        method: 'PATCH',
        body: {
          last_seen_at: new Date().toISOString(),
          app_version: APP_VERSION,
        },
      });
    } else {
      await supabaseRestRequest('users', {
        method: 'POST',
        body: {
          device_id: deviceId,
          app_version: APP_VERSION,
          os_version: `${Platform.OS} ${Platform.Version}`,
          device_model: Platform.OS === 'android' ? 'Android Device' : 'iOS Device',
        },
      });
    }
  } catch (e) {
    console.warn('Device registration failed:', e);
  }
}

export async function checkForCloudUpdate(): Promise<void> {
  // Pure Over-The-Air (OTA) delivery mode.
  // Suppressed Android DownloadManager to eliminate system download failure notifications.
}

export async function fetchChangelogs(): Promise<Changelog[]> {
  try {
    const { data } = await supabaseRestRequest<Changelog[]>(
      'changelogs?order=published_at.desc&limit=20'
    );

    if (data && Array.isArray(data)) {
      return data;
    }
    return [];
  } catch (e) {
    console.warn('fetchChangelogs failed:', e);
    return [];
  }
}

export function subscribeToVersionUpdates(onNewVersion: (version: AppVersion) => void) {
  // Safe zero-op subscription replacing Realtime WebSocket channel to prevent Hermes process crash
  return () => {};
}
