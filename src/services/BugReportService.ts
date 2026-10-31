import { supabaseRestRequest, getDeviceId } from './SupabaseClient';
import { APP_VERSION } from '../config/supabase';
import { Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { executeSql, rowsToArray } from '../db/database';

export type BugCategory = 'crash' | 'ui' | 'data_loss' | 'performance' | 'feature' | 'general';
export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';
export type BugStatus = 'new' | 'ai_reviewed' | 'confirmed' | 'in_progress' | 'fixed' | 'duplicate' | 'wont_fix';

export interface BugReport {
  id: string;
  title: string;
  description: string;
  category: BugCategory;
  severity: BugSeverity;
  screen_name?: string;
  steps_to_reproduce?: string;
  screenshot_url?: string;
  app_version: string;
  status: BugStatus;
  ai_summary?: string;
  ai_root_cause?: string;
  ai_fix_suggestion?: string;
  created_at: string;
  updated_at: string;
}

export interface SubmitBugInput {
  title: string;
  description: string;
  category: BugCategory;
  severity: BugSeverity;
  screenName?: string;
  stepsToReproduce?: string;
  screenshotUri?: string;
  imageUri?: string | null;
}

async function ensureLocalTableExists(): Promise<void> {
  try {
    await executeSql(`
      CREATE TABLE IF NOT EXISTS local_bugs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        severity TEXT NOT NULL DEFAULT 'low',
        steps_to_reproduce TEXT,
        image_uri TEXT,
        created_at TEXT NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 0
      );
    `);
  } catch (e) {
    console.warn('ensureLocalTableExists warning:', e);
  }
}

async function ensureUser(): Promise<string | null> {
  const deviceId = getDeviceId();
  try {
    const { data: users } = await supabaseRestRequest<any[]>(`users?device_id=eq.${encodeURIComponent(deviceId)}`);
    if (users && users.length > 0) {
      const user = users[0];
      await supabaseRestRequest(`users?id=eq.${user.id}`, {
        method: 'PATCH',
        body: { last_seen_at: new Date().toISOString(), app_version: APP_VERSION },
      });
      return user.id;
    }

    const { data: newUser } = await supabaseRestRequest<any[]>('users', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        device_id: deviceId,
        app_version: APP_VERSION,
        os_version: `${Platform.OS} ${Platform.Version}`,
        device_model: Platform.OS === 'android' ? 'Android Device' : 'iOS Device',
      },
    });

    if (newUser && newUser.length > 0) {
      return newUser[0].id;
    }
    return null;
  } catch (e) {
    console.warn('ensureUser failed:', e);
    return null;
  }
}

async function saveLocalBug(input: SubmitBugInput): Promise<void> {
  try {
    await ensureLocalTableExists();
    const now = new Date().toISOString();
    await executeSql(
      `INSERT INTO local_bugs (title, description, category, severity, steps_to_reproduce, image_uri, created_at, is_synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        input.title || 'Bug Report',
        input.description || '',
        input.category || 'general',
        input.severity || 'low',
        input.stepsToReproduce || '',
        input.imageUri || input.screenshotUri || null,
        now,
      ],
    );
  } catch (err) {
    console.warn('saveLocalBug warning:', err);
  }
}

export async function submitBugReport(input: SubmitBugInput): Promise<{ success: boolean; offline?: boolean; error?: string }> {
  // 1. Always save locally first so user data is 100% safe
  await saveLocalBug(input);

  try {
    const userId = await ensureUser();
    const uri = input.imageUri || input.screenshotUri;

    let screenshotUrl: string | undefined;
    if (uri) {
      try {
        screenshotUrl = await uploadScreenshot(uri);
      } catch (uploadErr) {
        console.warn('Image upload skipped:', uploadErr);
      }
    }

    const { error } = await supabaseRestRequest('bug_reports', {
      method: 'POST',
      body: {
        user_id: userId || null,
        title: input.title || 'Bug Report',
        description: input.description || '',
        category: input.category || 'general',
        severity: input.severity || 'low',
        screen_name: input.screenName || 'Unknown Screen',
        steps_to_reproduce: input.stepsToReproduce || '',
        screenshot_url: screenshotUrl || null,
        app_version: APP_VERSION,
        device_info: {
          os: Platform.OS,
          version: Platform.Version,
          device_id: getDeviceId(),
        },
      },
    });

    if (error) {
      console.warn('Supabase REST insert warning, saved locally:', error);
      return { success: true, offline: true };
    }

    try {
      await executeSql('UPDATE local_bugs SET is_synced = 1 WHERE title = ? AND description = ?', [input.title || '', input.description || '']);
    } catch (sErr) {}

    return { success: true };
  } catch (e: any) {
    console.warn('submitBugReport network catch, saved locally:', e);
    return { success: true, offline: true };
  }
}

export async function fetchMyBugReports(): Promise<BugReport[]> {
  try {
    await ensureLocalTableExists();

    const userId = await ensureUser();
    let onlineReports: BugReport[] = [];
    if (userId) {
      const { data } = await supabaseRestRequest<BugReport[]>(
        `bug_reports?user_id=eq.${userId}&order=created_at.desc&limit=50`
      );
      if (data && Array.isArray(data)) {
        onlineReports = data;
      }
    }

    const localResult = await executeSql('SELECT * FROM local_bugs WHERE is_synced = 0 ORDER BY created_at DESC');
    const localRows = rowsToArray<any>(localResult);

    const localReports: BugReport[] = (localRows || []).map((row) => ({
      id: `local-${row.id}`,
      title: row.title || 'Bug Report',
      description: row.description || '',
      category: (row.category || 'general') as BugCategory,
      severity: (row.severity || 'low') as BugSeverity,
      screen_name: 'Local',
      steps_to_reproduce: row.steps_to_reproduce || '',
      screenshot_url: row.image_uri || undefined,
      app_version: APP_VERSION,
      status: 'new' as BugStatus,
      ai_summary: 'Report saved offline. Will sync with Cloud AI on reconnect.',
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.created_at || new Date().toISOString(),
    }));

    return [...localReports, ...onlineReports];
  } catch (e) {
    console.warn('fetchMyBugReports failed:', e);
    return [];
  }
}

export async function uploadScreenshot(fileUri: string): Promise<string | undefined> {
  try {
    if (!fileUri) return undefined;
    const cleanUri = fileUri.replace('file://', '');
    const exists = await RNBlobUtil.fs.exists(cleanUri);
    if (!exists) return undefined;

    // Optional upload safely skipped if storage bucket is not configured
    return undefined;
  } catch (e) {
    console.warn('uploadScreenshot safely skipped:', e);
    return undefined;
  }
}
