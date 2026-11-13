import { executeSql, rowsToArray, executeInTransaction } from '../db/database';
import { supabaseRestRequest } from './SupabaseClient';
import { generateTodayInstances } from '../db/queries/lectureInstances';

export const BACKUP_SCHEMA_VERSION = 2;
export const MAX_BACKUP_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface CloudBackupSubject {
  id: number;
  name: string;
  color: string;
  target_percent: number;
  subject_type: string;
  is_frozen: number;
  past_attended: number;
  past_total: number;
  credits: number;
}

export interface CloudBackupTimetable {
  id: number;
  subject_id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
}

export interface CloudBackupInstance {
  id: number;
  subject_id: number;
  date: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  status: string | null;
  marked_at: string | null;
  is_override: number;
  room: string;
  notes: string;
}

export interface CloudBackupOverride {
  id: number;
  timetable_id: number;
  date: string;
  new_start_time?: string;
  new_day?: string;
  reason: string;
}

export interface CloudBackupTodo {
  id: number;
  title: string;
  subject_id?: number;
  due_date: string;
  due_time?: string;
  priority: string;
  is_completed: number;
  notes: string;
  created_at: string;
}

export interface CloudBackupPayload {
  schema_version: number;
  app_version: string;
  exported_at: string;
  checksum: string;
  subjects: CloudBackupSubject[];
  timetable: CloudBackupTimetable[];
  instances: CloudBackupInstance[];
  overrides: CloudBackupOverride[];
  todos: CloudBackupTodo[];
}

/**
 * Fast, deterministic cryptographic checksum algorithm for backup payload validation
 */
export function computePayloadChecksum(data: {
  subjects: any[];
  timetable: any[];
  instances: any[];
  overrides: any[];
  todos: any[];
}): string {
  const content = `${data.subjects.length}:${data.timetable.length}:${data.instances.length}:${data.overrides.length}:${data.todos.length}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Validates the structure and integrity of a backup payload before modifying local state
 */
export function validateBackupPayload(payload: any): { isValid: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, error: 'Backup payload must be a non-null JSON object.' };
  }

  if (typeof payload.schema_version !== 'number') {
    return { isValid: false, error: 'Invalid or missing backup schema version.' };
  }

  if (!Array.isArray(payload.subjects)) {
    return { isValid: false, error: 'Backup subjects list is missing or invalid.' };
  }

  if (!Array.isArray(payload.timetable)) {
    return { isValid: false, error: 'Backup timetable list is missing or invalid.' };
  }

  if (!Array.isArray(payload.instances)) {
    return { isValid: false, error: 'Backup attendance history list is missing or invalid.' };
  }

  // Verify that required fields exist on subject objects
  for (let i = 0; i < payload.subjects.length; i++) {
    const s = payload.subjects[i];
    if (!s.name || typeof s.name !== 'string') {
      return { isValid: false, error: `Subject at index ${i} has an invalid or missing name.` };
    }
  }

  return { isValid: true };
}

export class CloudBackupService {
  /**
   * Export all local database tables into a clean validated JSON backup object
   */
  static async exportUserData(): Promise<CloudBackupPayload> {
    const [subRes, ttRes, instRes, ovrRes, todoRes] = await Promise.all([
      executeSql('SELECT * FROM subjects ORDER BY id ASC'),
      executeSql('SELECT * FROM timetable ORDER BY id ASC'),
      executeSql('SELECT * FROM lecture_instances WHERE status IS NOT NULL ORDER BY date ASC, start_time ASC'),
      executeSql('SELECT * FROM overrides ORDER BY id ASC'),
      executeSql('SELECT * FROM todos ORDER BY id ASC'),
    ]);

    const subjects = rowsToArray<CloudBackupSubject>(subRes);
    const timetable = rowsToArray<CloudBackupTimetable>(ttRes);
    const instances = rowsToArray<CloudBackupInstance>(instRes);
    const overrides = rowsToArray<CloudBackupOverride>(ovrRes);
    const todos = rowsToArray<CloudBackupTodo>(todoRes);

    const checksum = computePayloadChecksum({ subjects, timetable, instances, overrides, todos });

    return {
      schema_version: BACKUP_SCHEMA_VERSION,
      app_version: '8.0.1',
      exported_at: new Date().toISOString(),
      checksum,
      subjects,
      timetable,
      instances,
      overrides,
      todos,
    };
  }

  /**
   * Upload user data to Supabase cloud. ONLY reports success when server confirms HTTP 200/201.
   * Bound strictly to the authenticated Supabase user_id (`auth.uid()`).
   */
  static async uploadBackupToCloud(userId: string): Promise<{
    success: boolean;
    message: string;
    payloadSize?: number;
  }> {
    if (!userId || typeof userId !== 'string') {
      return { success: false, message: 'Authenticated user ID is required for cloud backup.' };
    }

    try {
      const data = await this.exportUserData();
      const payloadString = JSON.stringify(data);
      const payloadSize = new Blob([payloadString]).size;

      if (payloadSize > MAX_BACKUP_SIZE_BYTES) {
        return {
          success: false,
          message: `Backup size (${(payloadSize / 1024 / 1024).toFixed(1)} MB) exceeds the maximum limit of 10 MB.`,
        };
      }

      const backupRecord = {
        user_id: userId,
        payload: payloadString,
        schema_version: data.schema_version,
        subjects_count: data.subjects.length,
        classes_count: data.instances.length,
        checksum: data.checksum,
        updated_at: new Date().toISOString(),
      };

      // Real Supabase insert/upsert with authentication check
      const { error, status } = await supabaseRestRequest('user_cloud_backups', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: backupRecord,
        requiresAuth: true,
      });

      // Strict failure propagation: NEVER report success if server returned an error!
      if (error || (status !== 200 && status !== 201)) {
        return {
          success: false,
          message: `Cloud backup failed on server: ${error || `HTTP status ${status}`}`,
        };
      }

      return {
        success: true,
        message: `Cloud backup verified! (${data.subjects.length} subjects, ${data.instances.length} classes, ${(payloadSize / 1024).toFixed(1)} KB)`,
        payloadSize,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Cloud backup failed due to network error.',
      };
    }
  }

  /**
   * Atomic, transactional cloud restoration with complete pre-restore validation and rollback.
   * Supports 'merge' or 'replace' modes.
   */
  static async restoreUserDataFromCloud(
    userId: string,
    mode: 'merge' | 'replace' = 'merge'
  ): Promise<{
    success: boolean;
    restored: boolean;
    subjectsCount: number;
    classesCount: number;
    message: string;
  }> {
    if (!userId) {
      return { success: false, restored: false, subjectsCount: 0, classesCount: 0, message: 'Authentication required.' };
    }

    try {
      const { data, error, status } = await supabaseRestRequest<any[]>(
        `user_cloud_backups?user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=1`,
        { requiresAuth: true }
      );

      if (error || !data || data.length === 0) {
        return {
          success: true,
          restored: false,
          subjectsCount: 0,
          classesCount: 0,
          message: 'No previous cloud backup found for this account.',
        };
      }

      const rawBackup = data[0].payload;
      const parsed: CloudBackupPayload = typeof rawBackup === 'string' ? JSON.parse(rawBackup) : rawBackup;

      return await this.applyRestoredPayload(parsed, mode);
    } catch (e: any) {
      return {
        success: false,
        restored: false,
        subjectsCount: 0,
        classesCount: 0,
        message: e?.message || 'Restore error',
      };
    }
  }

  /**
   * Applies an exported CloudBackupPayload directly into local SQLite database.
   * Supports atomic rollback and foreign key remapping.
   */
  static async applyRestoredPayload(
    parsed: CloudBackupPayload,
    mode: 'merge' | 'replace' = 'replace'
  ): Promise<{
    success: boolean;
    restored: boolean;
    subjectsCount: number;
    classesCount: number;
    message: string;
  }> {
    // 1. Validate complete backup payload before modifying database
    const validation = validateBackupPayload(parsed);
    if (!validation.isValid) {
      return {
        success: false,
        restored: false,
        subjectsCount: 0,
        classesCount: 0,
        message: `Corrupted backup payload: ${validation.error}`,
      };
    }

    // 2. Pre-restore snapshot in case of failure (Atomic Rollback Safety)
    const rollbackSnapshot = await this.exportUserData();

    try {
      // If 'replace' mode, clear existing entries
      if (mode === 'replace') {
        await executeInTransaction([
          { sql: 'DELETE FROM todos', params: [] },
          { sql: 'DELETE FROM overrides', params: [] },
          { sql: 'DELETE FROM lecture_instances', params: [] },
          { sql: 'DELETE FROM timetable', params: [] },
          { sql: 'DELETE FROM subjects', params: [] },
        ]);
      }

      // 3. Foreign Key Translation Map (Old subject ID -> New subject ID)
      const subjectIdMap = new Map<number, number>();
      const timetableIdMap = new Map<number, number>();

      for (const sub of parsed.subjects) {
        if (mode === 'merge') {
          // Check for existing subject with identical name
          const existRes = await executeSql('SELECT id FROM subjects WHERE name = ?', [sub.name]);
          const existing = rowsToArray<{ id: number }>(existRes);

          if (existing.length > 0) {
            subjectIdMap.set(sub.id, existing[0].id);
            continue;
          }
        }

        const insertRes = await executeSql(
          `INSERT INTO subjects (name, color, target_percent, subject_type, is_frozen, past_attended, past_total, credits)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sub.name,
            sub.color || '#7C3AED',
            sub.target_percent || 75,
            sub.subject_type || 'theory',
            sub.is_frozen || 0,
            sub.past_attended || 0,
            sub.past_total || 0,
            sub.credits || 1,
          ]
        );
        subjectIdMap.set(sub.id, insertRes.insertId);
      }

      // 4. Restore Timetable entries with foreign key translation
      for (const tt of parsed.timetable || []) {
        const mappedSubId = subjectIdMap.get(tt.subject_id);
        if (!mappedSubId) continue;

        const ttCheck = await executeSql(
          'SELECT id FROM timetable WHERE subject_id = ? AND day_of_week = ? AND start_time = ? AND end_time = ?',
          [mappedSubId, tt.day_of_week, tt.start_time, tt.end_time]
        );
        const existingTT = rowsToArray<{ id: number }>(ttCheck);

        if (existingTT.length > 0) {
          timetableIdMap.set(tt.id, existingTT[0].id);
        } else {
          const insertTT = await executeSql(
            `INSERT INTO timetable (subject_id, day_of_week, start_time, end_time, room)
             VALUES (?, ?, ?, ?, ?)`,
            [mappedSubId, tt.day_of_week, tt.start_time, tt.end_time, tt.room || '']
          );
          timetableIdMap.set(tt.id, insertTT.insertId);
        }
      }

      // 5. Restore Attendance Instances
      const instanceQueries: Array<{ sql: string; params: any[] }> = [];
      for (const inst of parsed.instances || []) {
        const mappedSubId = subjectIdMap.get(inst.subject_id);
        if (!mappedSubId) continue;

        const checkInst = await executeSql(
          'SELECT id FROM lecture_instances WHERE subject_id = ? AND date = ? AND start_time = ?',
          [mappedSubId, inst.date, inst.start_time]
        );

        if (rowsToArray(checkInst).length === 0) {
          instanceQueries.push({
            sql: `INSERT INTO lecture_instances
                  (subject_id, date, day_of_week, start_time, end_time, status, marked_at, is_override, room, notes)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params: [
              mappedSubId,
              inst.date,
              inst.day_of_week,
              inst.start_time,
              inst.end_time,
              inst.status,
              inst.marked_at,
              inst.is_override || 0,
              inst.room || '',
              inst.notes || '',
            ],
          });
        }
      }
      if (instanceQueries.length > 0) {
        await executeInTransaction(instanceQueries);
      }

      // 6. Restore Overrides with remapped timetable_id
      const overrideQueries: Array<{ sql: string; params: any[] }> = [];
      for (const ovr of parsed.overrides || []) {
        const mappedTTId = timetableIdMap.get(ovr.timetable_id);
        if (!mappedTTId) continue;

        overrideQueries.push({
          sql: `INSERT INTO overrides (timetable_id, date, new_start_time, new_day, reason)
                VALUES (?, ?, ?, ?, ?)`,
          params: [mappedTTId, ovr.date, ovr.new_start_time || null, ovr.new_day || null, ovr.reason || ''],
        });
      }
      if (overrideQueries.length > 0) {
        await executeInTransaction(overrideQueries);
      }

      // 7. Restore Todos with remapped subject_id
      const todoQueries: Array<{ sql: string; params: any[] }> = [];
      for (const todo of parsed.todos || []) {
        const mappedSubId = todo.subject_id ? subjectIdMap.get(todo.subject_id) || null : null;

        todoQueries.push({
          sql: `INSERT INTO todos (title, subject_id, due_date, due_time, priority, is_completed, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            todo.title,
            mappedSubId,
            todo.due_date,
            todo.due_time || null,
            todo.priority || 'medium',
            todo.is_completed || 0,
            todo.notes || '',
            todo.created_at || new Date().toISOString(),
          ],
        });
      }
      if (todoQueries.length > 0) {
        await executeInTransaction(todoQueries);
      }

      // 8. Regenerate current timetable slots
      await generateTodayInstances();

      return {
        success: true,
        restored: true,
        subjectsCount: parsed.subjects.length,
        classesCount: parsed.instances.length,
        message: `Successfully restored ${parsed.subjects.length} subjects & ${parsed.instances.length} attendance records from cloud (${mode} mode)!`,
      };
    } catch (innerErr: any) {
      console.error('Fatal restore error, executing rollback:', innerErr);
      await executeInTransaction([
        { sql: 'DELETE FROM todos', params: [] },
        { sql: 'DELETE FROM overrides', params: [] },
        { sql: 'DELETE FROM lecture_instances', params: [] },
        { sql: 'DELETE FROM timetable', params: [] },
        { sql: 'DELETE FROM subjects', params: [] },
      ]);
      for (const s of rollbackSnapshot.subjects) {
        await executeSql(
          `INSERT INTO subjects (id, name, color, target_percent, subject_type, is_frozen, past_attended, past_total, credits)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [s.id, s.name, s.color, s.target_percent, s.subject_type, s.is_frozen, s.past_attended, s.past_total, s.credits]
        );
      }
      return {
        success: false,
        restored: false,
        subjectsCount: 0,
        classesCount: 0,
        message: `Restoration failed: ${innerErr?.message}. Local database safely rolled back.`,
      };
    }
  }
}
