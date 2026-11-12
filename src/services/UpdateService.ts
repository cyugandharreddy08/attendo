import { supabaseRestRequest, getDeviceId } from './SupabaseClient';
import { APP_VERSION, APP_VERSION_CODE } from '../config/supabase';
import { Platform } from 'react-native';

export interface AppVersion {
  id?: string;
  version_name: string;
  version_code: number;
  release_notes: string;
  apk_url: string;
  apk_size_bytes: number;
  status?: string;
  released_at?: string;
  is_mandatory?: boolean;
}

export interface Changelog {
  id: string;
  version_name: string;
  entries: Array<{ type: 'fix' | 'feature' | 'improvement'; text: string }>;
  published_at: string;
}

export async function checkLatestAppVersion(): Promise<{
  hasUpdate: boolean;
  isMandatory: boolean;
  version: AppVersion | null;
}> {
  try {
    // 1. Try fetching from Supabase app_versions
    const { data: versions } = await supabaseRestRequest<AppVersion[]>(
      'app_versions?order=version_code.desc&limit=1'
    );

    if (versions && versions.length > 0) {
      const latest = versions[0];
      if (latest.version_code > APP_VERSION_CODE) {
        return {
          hasUpdate: true,
          isMandatory: true,
          version: latest,
        };
      }
    }

    // 2. Fallback to GitHub Releases API
    const ghRes = await fetch(
      'https://api.github.com/repos/cyugandharreddy08/attendo/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Attendo-App',
        },
      }
    );

    if (ghRes.ok) {
      const release = await ghRes.json();
      const tagName = release.tag_name || ''; // e.g. "v8.0.0"
      const cleanVer = tagName.replace('v', '');
      const parts = cleanVer.split('.').map((p: string) => parseInt(p, 10) || 0);
      const remoteVersionCode = (parts[0] || 0) * 100 + (parts[1] || 0) * 10 + (parts[2] || 0);

      const apkAsset = release.assets?.find((a: any) =>
        a.name.endsWith('.apk')
      );

      if (remoteVersionCode > APP_VERSION_CODE) {
        return {
          hasUpdate: true,
          isMandatory: true,
          version: {
            version_name: cleanVer,
            version_code: remoteVersionCode,
            release_notes: release.body || 'New Attendo update available with new features and stability fixes.',
            apk_url: apkAsset?.browser_download_url || `https://github.com/cyugandharreddy08/attendo/releases/download/${tagName}/Attendo_${tagName}.apk`,
            apk_size_bytes: apkAsset?.size || 32900000,
            is_mandatory: true,
          },
        };
      }
    }

    return { hasUpdate: false, isMandatory: false, version: null };
  } catch (e) {
    console.warn('Check update error:', e);
    return { hasUpdate: false, isMandatory: false, version: null };
  }
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
