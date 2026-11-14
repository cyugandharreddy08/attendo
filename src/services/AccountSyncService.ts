import { executeSql, rowsToArray, setDatabaseChangeListener } from '../db/database';
import { getSetting, setSetting } from '../db/queries/settings';
import { CloudBackupService } from './CloudBackupService';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';

const SETTING_ACCOUNT_SYNC_KEY = 'account_sync_key';
const SETTING_LAST_SYNC_TIME = 'account_last_sync_timestamp';

let autoSyncTimer: any = null;
let isAutoSyncing = false;
let pendingAutoSync = false;

/**
 * Triggers background auto-sync debounced by delayMs.
 * Runs silently whenever any subject, timetable, attendance, or to-do update occurs.
 */
export function triggerAutoCloudSync(delayMs: number = 1800): void {
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
  }
  autoSyncTimer = setTimeout(async () => {
    if (isAutoSyncing) {
      pendingAutoSync = true;
      return;
    }
    isAutoSyncing = true;
    try {
      await AccountSyncService.backupToCloud();
    } catch (e) {
      console.warn('[AutoSync] Silent auto-sync notice:', e);
    } finally {
      isAutoSyncing = false;
      if (pendingAutoSync) {
        pendingAutoSync = false;
        triggerAutoCloudSync(1000);
      }
    }
  }, delayMs);
}

/**
 * Connects SQLite database change listener to continuous cloud vault sync.
 */
export function initAccountSyncEngine(): void {
  setDatabaseChangeListener(() => {
    triggerAutoCloudSync(1800);
  });
}

/**
 * Generates an intuitive, high-entropy 12-character code: ATND-XXXX-XXXX
 */
export function generateSecurityCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // excludes ambiguous chars 0, 1, I, O
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ATND-${part1}-${part2}`;
}

export function normalizeSecurityCode(input: string): string {
  if (!input) return '';
  let cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.startsWith('ATND')) {
    cleaned = cleaned.substring(4);
  }
  if (cleaned.length >= 8) {
    return `ATND-${cleaned.substring(0, 4)}-${cleaned.substring(4, 8)}`;
  }
  return input.trim().toUpperCase();
}

export class AccountSyncService {
  /**
   * Retrieves or auto-provisions a persistent account security sync key
   */
  static async getOrGenerateSyncKey(): Promise<string> {
    try {
      const existing = await getSetting(SETTING_ACCOUNT_SYNC_KEY);
      if (existing && existing.trim().length > 0) {
        return existing.trim().toUpperCase();
      }

      const newKey = generateSecurityCode();
      await setSetting(SETTING_ACCOUNT_SYNC_KEY, newKey);
      return newKey;
    } catch {
      return generateSecurityCode();
    }
  }

  /**
   * Sets or switches the active account sync key
   */
  static async setSyncKey(key: string): Promise<void> {
    const normalized = normalizeSecurityCode(key);
    await setSetting(SETTING_ACCOUNT_SYNC_KEY, normalized);
  }

  /**
   * Gets the last successful cloud sync timestamp
   */
  static async getLastSyncTime(): Promise<string | null> {
    try {
      return await getSetting(SETTING_LAST_SYNC_TIME);
    } catch {
      return null;
    }
  }

  /**
   * Uploads the full database payload to the cloud vault bound to the security sync code
   */
  static async backupToCloud(explicitKey?: string): Promise<{
    success: boolean;
    syncKey: string;
    message: string;
    subjectsCount?: number;
    classesCount?: number;
  }> {
    const syncKey = explicitKey || (await this.getOrGenerateSyncKey());

    try {
      const data = await CloudBackupService.exportUserData();
      const payloadString = JSON.stringify(data);

      const record = {
        sync_code: syncKey,
        payload: data,
        schema_version: data.schema_version,
        subjects_count: data.subjects.length,
        classes_count: data.instances.length,
        checksum: data.checksum,
        updated_at: new Date().toISOString(),
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/account_sync_vaults`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(record),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          syncKey,
          message: `Cloud sync failed (HTTP ${res.status}): ${errorText}`,
        };
      }

      const now = new Date().toISOString();
      await setSetting(SETTING_LAST_SYNC_TIME, now);

      return {
        success: true,
        syncKey,
        message: `Synced ${data.subjects.length} subjects and ${data.instances.length} classes to Security Code ${syncKey}!`,
        subjectsCount: data.subjects.length,
        classesCount: data.instances.length,
      };
    } catch (e: any) {
      return {
        success: false,
        syncKey,
        message: e?.message || 'Network error while uploading cloud backup.',
      };
    }
  }

  /**
   * Restores all account data from another device or previous installation using the Security Code
   */
  static async restoreFromCloud(
    rawCode: string,
    mode: 'merge' | 'replace' = 'replace'
  ): Promise<{
    success: boolean;
    subjectsCount: number;
    classesCount: number;
    message: string;
  }> {
    const syncCode = normalizeSecurityCode(rawCode);
    if (!syncCode || syncCode.length < 8) {
      return {
        success: false,
        subjectsCount: 0,
        classesCount: 0,
        message: 'Please enter a valid Account Security Code (e.g. ATND-XXXX-XXXX).',
      };
    }

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/account_sync_vaults?sync_code=eq.${encodeURIComponent(syncCode)}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!res.ok) {
        return {
          success: false,
          subjectsCount: 0,
          classesCount: 0,
          message: `Could not retrieve vault (HTTP ${res.status}).`,
        };
      }

      const rows: any[] = await res.json();
      if (!rows || rows.length === 0 || !rows[0].payload) {
        return {
          success: false,
          subjectsCount: 0,
          classesCount: 0,
          message: `No backup data found for code "${syncCode}". Please check your code and try again.`,
        };
      }

      const payload = typeof rows[0].payload === 'string'
        ? JSON.parse(rows[0].payload)
        : rows[0].payload;

      // Apply the backup payload safely via CloudBackupService
      const restoreRes = await CloudBackupService.applyRestoredPayload(payload, mode);

      if (restoreRes.success) {
        // Link this device to this sync key
        await this.setSyncKey(syncCode);
        await setSetting(SETTING_LAST_SYNC_TIME, new Date().toISOString());
      }

      return restoreRes;
    } catch (e: any) {
      return {
        success: false,
        subjectsCount: 0,
        classesCount: 0,
        message: e?.message || 'Network error while restoring cloud backup.',
      };
    }
  }
}
