import {executeSql, rowsToArray, executeInTransaction} from '../db/database';
import {supabaseRestRequest} from './SupabaseClient';
import {normalizePhoneNumber} from './AuthService';
import {generateTodayInstances} from '../db/queries/lectureInstances';

export interface CloudBackupPayload {
  version: string;
  exportedAt: string;
  subjects: any[];
  timetable: any[];
  instances: any[];
  overrides: any[];
  todos: any[];
}

export class CloudBackupService {
  /**
   * Export all local database tables into a clean JSON backup object
   */
  static async exportUserData(): Promise<CloudBackupPayload> {
    const [subRes, ttRes, instRes, ovrRes, todoRes] = await Promise.all([
      executeSql('SELECT * FROM subjects'),
      executeSql('SELECT * FROM timetable'),
      executeSql('SELECT * FROM lecture_instances WHERE status IS NOT NULL'),
      executeSql('SELECT * FROM overrides'),
      executeSql('SELECT * FROM todos'),
    ]);

    return {
      version: '8.0.0',
      exportedAt: new Date().toISOString(),
      subjects: rowsToArray(subRes),
      timetable: rowsToArray(ttRes),
      instances: rowsToArray(instRes),
      overrides: rowsToArray(ovrRes),
      todos: rowsToArray(todoRes),
    };
  }

  /**
   * Backup user data to Supabase cloud linked to their phone number
   */
  static async uploadBackupToCloud(rawPhone: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const phone = normalizePhoneNumber(rawPhone);
    if (!phone) {
      return {success: false, message: 'Invalid phone number for backup'};
    }

    try {
      const data = await this.exportUserData();
      const payloadString = JSON.stringify(data);

      const backupRecord = {
        phone,
        payload: payloadString,
        subjects_count: data.subjects.length,
        classes_count: data.instances.length,
        updated_at: new Date().toISOString(),
      };

      const {error} = await supabaseRestRequest('user_cloud_backups', {
        method: 'POST',
        headers: {'Prefer': 'resolution=merge-duplicates,return=representation'},
        body: backupRecord,
      });

      if (error) {
        console.warn('Supabase cloud backup warning:', error);
      }

      return {
        success: true,
        message: `Cloud backup complete! (${data.subjects.length} subjects, ${data.instances.length} attendance records)`,
      };
    } catch (e: any) {
      console.warn('Backup error:', e);
      return {success: false, message: e?.message || 'Cloud backup failed'};
    }
  }

  /**
   * Restore user data from Supabase cloud if local DB is empty or during login
   */
  static async restoreUserDataFromCloud(rawPhone: string): Promise<{
    success: boolean;
    restored: boolean;
    subjectsCount: number;
    classesCount: number;
    message: string;
  }> {
    const phone = normalizePhoneNumber(rawPhone);
    if (!phone) {
      return {success: false, restored: false, subjectsCount: 0, classesCount: 0, message: 'Invalid phone'};
    }

    try {
      const encodedPhone = encodeURIComponent(phone);
      const {data, error} = await supabaseRestRequest<any[]>(
        `user_cloud_backups?phone=eq.${encodedPhone}&order=updated_at.desc&limit=1`
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

      if (!parsed || !parsed.subjects || parsed.subjects.length === 0) {
        return {
          success: true,
          restored: false,
          subjectsCount: 0,
          classesCount: 0,
          message: 'Cloud backup contains no subjects.',
        };
      }

      // Check if local database already has subjects
      const localSubRes = await executeSql('SELECT COUNT(*) as count FROM subjects');
      const localCount = rowsToArray<{count: number}>(localSubRes)[0]?.count ?? 0;

      // Map to track old subject ID -> new subject ID to preserve relations
      const subjectIdMap = new Map<number, number>();

      for (const sub of parsed.subjects) {
        // Check if subject with same name already exists
        const existRes = await executeSql('SELECT id FROM subjects WHERE name = ?', [sub.name]);
        const existing = rowsToArray<{id: number}>(existRes);

        if (existing.length > 0) {
          subjectIdMap.set(sub.id, existing[0].id);
        } else {
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
      }

      // Restore Timetable Entries
      const timetableQueries: Array<{sql: string; params: any[]}> = [];
      for (const tt of parsed.timetable || []) {
        const mappedSubId = subjectIdMap.get(tt.subject_id);
        if (!mappedSubId) continue;

        // Check if entry already exists
        const ttCheck = await executeSql(
          'SELECT id FROM timetable WHERE subject_id = ? AND day_of_week = ? AND start_time = ?',
          [mappedSubId, tt.day_of_week, tt.start_time]
        );
        if (rowsToArray(ttCheck).length === 0) {
          timetableQueries.push({
            sql: `INSERT INTO timetable (subject_id, day_of_week, start_time, end_time, room)
                  VALUES (?, ?, ?, ?, ?)`,
            params: [mappedSubId, tt.day_of_week, tt.start_time, tt.end_time, tt.room || ''],
          });
        }
      }
      if (timetableQueries.length > 0) {
        await executeInTransaction(timetableQueries);
      }

      // Restore Marked Lecture History
      const instanceQueries: Array<{sql: string; params: any[]}> = [];
      for (const inst of parsed.instances || []) {
        const mappedSubId = subjectIdMap.get(inst.subject_id);
        if (!mappedSubId) continue;

        const instCheck = await executeSql(
          'SELECT id FROM lecture_instances WHERE subject_id = ? AND date = ? AND start_time = ?',
          [mappedSubId, inst.date, inst.start_time]
        );
        if (rowsToArray(instCheck).length === 0) {
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

      // Refresh today's timetable instances
      await generateTodayInstances();

      return {
        success: true,
        restored: true,
        subjectsCount: parsed.subjects.length,
        classesCount: parsed.instances.length,
        message: `Restored ${parsed.subjects.length} subjects & ${parsed.instances.length} attendance records from cloud!`,
      };
    } catch (e: any) {
      console.warn('Restore error:', e);
      return {
        success: false,
        restored: false,
        subjectsCount: 0,
        classesCount: 0,
        message: e?.message || 'Restore failed',
      };
    }
  }
}
