import { NativeModules, Alert, Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { supabaseRestRequest, getDeviceId, getInstallationId } from './SupabaseClient';
import { APP_VERSION, APP_VERSION_CODE } from '../config/supabase';
import { triggerForceUpdateModal } from '../components/ForceUpdateModal';

const { OTANativeModule } = NativeModules;

export interface OTAReleaseManifest {
  bundle_version: string;
  bundle_url: string;
  sha256: string;
  signature: string; // Base64-encoded RSA-2048 digital signature
  min_native_code: number;
  max_native_code: number;
  rollout_percentage?: number; // 0 to 100
  release_notes?: string;
  is_mandatory?: boolean;
}

export interface OTAStatus {
  status: 'EMBEDDED' | 'PENDING' | 'ACTIVE' | 'CONFIRMED' | 'ROLLED_BACK';
  activeVersion: string;
  pendingVersion?: string | null;
  bootFailureCount: number;
  confirmedVersion: string;
  lastRollbackReason?: string | null;
}

/**
 * Deterministic hash algorithm to bucket users into rollout percentages (0-99).
 */
export function computeRolloutBucket(identifier: string): number {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash * 31 + identifier.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash % 100);
}

export class ModernOTAService {
  private static bootConfirmed = false;

  /**
   * Confirms successful boot of the currently running JavaScript bundle.
   * Resets the native boot-failure watchdog counter and promotes status to CONFIRMED.
   */
  static async confirmBoot(): Promise<boolean> {
    if (this.bootConfirmed || Platform.OS !== 'android' || !OTANativeModule) {
      return true;
    }

    try {
      const confirmed = await OTANativeModule.confirmBoot();
      this.bootConfirmed = true;
      console.log('[ModernOTA] Native startup health check confirmed successfully.');
      return confirmed;
    } catch (e) {
      console.warn('[ModernOTA] confirmBoot notification error:', e);
      return false;
    }
  }

  /**
   * Reads the current state of the native bundle loader.
   */
  static async getOTAStatus(): Promise<OTAStatus | null> {
    if (Platform.OS !== 'android' || !OTANativeModule) return null;

    try {
      return await OTANativeModule.getOTAStatus();
    } catch (e) {
      console.warn('[ModernOTA] getOTAStatus error:', e);
      return null;
    }
  }

  /**
   * Checks for updates and coordinates cryptographic bundle download and staging.
   */
  static async checkForUpdates(options: { isManual?: boolean } = {}): Promise<void> {
    if (Platform.OS !== 'android' || !OTANativeModule) {
      return;
    }

    try {
      const currentStatus = await this.getOTAStatus();
      const currentActive = currentStatus?.activeVersion || APP_VERSION;

      // 1. Fetch latest OTA manifest from Supabase `app_bundles`
      let manifest: OTAReleaseManifest | null = null;

      const { data: bundles } = await supabaseRestRequest<OTAReleaseManifest[]>(
        'app_bundles?order=created_at.desc&limit=1'
      );

      if (bundles && bundles.length > 0) {
        manifest = bundles[0];
      }

      // 2. Fallback to GitHub releases metadata
      if (!manifest) {
        manifest = await this.fetchGitHubOTAManifest();
      }

      if (!manifest) {
        if (options.isManual) {
          Alert.alert('⚡ System Up to Date', `Attendo is running the latest verified release (v${currentActive}).`);
        }
        return;
      }

      // 3. Runtime Compatibility Check: Does this update require a full Native APK?
      if (APP_VERSION_CODE < manifest.min_native_code) {
        console.log('[ModernOTA] Native runtime out of date. Triggering native APK update.');
        triggerForceUpdateModal({
          version_name: manifest.bundle_version,
          version_code: manifest.min_native_code,
          release_notes: manifest.release_notes || 'Major native update required.',
          apk_url: `https://github.com/cyugandharreddy08/attendo/releases/download/v${manifest.bundle_version}/Attendo_v${manifest.bundle_version}.apk`,
          apk_size_bytes: 31450000,
          is_mandatory: manifest.is_mandatory ?? true,
        });
        return;
      }

      // 4. Version Check: Is the remote bundle newer than our active version?
      if (!this.isVersionNewer(manifest.bundle_version, currentActive)) {
        if (options.isManual) {
          Alert.alert('⚡ System Up to Date', `Attendo is running the latest verified release (v${currentActive}).`);
        }
        return;
      }

      // 5. Staged Rollout Gate
      const rolloutPercentage = manifest.rollout_percentage ?? 100;
      if (rolloutPercentage < 100) {
        const installId = await getInstallationId();
        const bucket = computeRolloutBucket(installId);
        if (bucket >= rolloutPercentage) {
          console.log(`[ModernOTA] Staged rollout active (${rolloutPercentage}%). Device bucket ${bucket} is deferred.`);
          return;
        }
      }

      // 6. Download Bundle Package Archive (~2-4 MB)
      console.log(`[ModernOTA] Downloading OTA package for v${manifest.bundle_version}...`);
      const tempPath = `${RNBlobUtil.fs.dirs.CacheDir}/ota_download_${Date.now()}.zip`;

      const res = await RNBlobUtil.config({
        path: tempPath,
      }).fetch('GET', manifest.bundle_url);

      const statusCode = res.info().status;
      if (statusCode !== 200) {
        throw new Error(`Failed to download OTA package (HTTP ${statusCode})`);
      }

      // 7. Hand over to Native Module for Cryptographic Verification & Atomic Staging
      const stageResult = await OTANativeModule.stageUpdate(
        tempPath,
        manifest.sha256,
        manifest.signature,
        manifest.bundle_version
      );

      if (stageResult?.success) {
        Alert.alert(
          '⚡ Update Ready',
          `Attendo v${manifest.bundle_version} has been verified and staged. It will automatically activate on your next launch, or you can restart now.`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Restart Now',
              onPress: () => {
                OTANativeModule.restartApp();
              },
            },
          ]
        );
      }
    } catch (err: any) {
      console.warn('[ModernOTA] Update check or download error:', err?.message || err);
      if (options.isManual) {
        Alert.alert('Update Check Notice', 'Could not complete the update check. Please verify your internet connection.');
      }
    }
  }

  private static isVersionNewer(remoteVer: string, currentVer: string): boolean {
    const parse = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const r = parse(remoteVer);
    const c = parse(currentVer);
    for (let i = 0; i < Math.max(r.length, c.length); i++) {
      const rNum = r[i] || 0;
      const cNum = c[i] || 0;
      if (rNum > cNum) return true;
      if (rNum < cNum) return false;
    }
    return false;
  }

  private static async fetchGitHubOTAManifest(): Promise<OTAReleaseManifest | null> {
    try {
      const res = await fetch('https://api.github.com/repos/cyugandharreddy08/attendo/releases/latest', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Attendo-App',
        },
      });
      if (!res.ok) return null;
      const release = await res.json();
      const manifestAsset = release.assets?.find((a: any) => a.name === 'ota-manifest.json');
      if (!manifestAsset) return null;

      const manifestRes = await fetch(manifestAsset.browser_download_url);
      if (!manifestRes.ok) return null;
      return await manifestRes.json();
    } catch {
      return null;
    }
  }
}

// Backward-compatible wrappers
export const checkForJSUpdate = (isManual: boolean = false) => ModernOTAService.checkForUpdates({ isManual });
export const checkForNativeUpdate = (isManual: boolean = false) => ModernOTAService.checkForUpdates({ isManual });
