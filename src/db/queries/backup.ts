import {executeSql, rowsToArray, executeInTransaction} from '../database';

export interface AttendoBackupData {
  version: string;
  exportedAt: string;
  subjects: any[];
  timetable: any[];
  lectureInstances: any[];
  overrides: any[];
  todos: any[];
}

export async function exportDataToJSON(): Promise<string> {
  const [subjectsRes, timetableRes, instancesRes, overridesRes, todosRes] = await Promise.all([
    executeSql('SELECT * FROM subjects'),
    executeSql('SELECT * FROM timetable'),
    executeSql('SELECT * FROM lecture_instances'),
    executeSql('SELECT * FROM overrides'),
    executeSql('SELECT * FROM todos'),
  ]);

  const backupData: AttendoBackupData = {
    version: '6.0.0',
    exportedAt: new Date().toISOString(),
    subjects: rowsToArray(subjectsRes),
    timetable: rowsToArray(timetableRes),
    lectureInstances: rowsToArray(instancesRes),
    overrides: rowsToArray(overridesRes),
    todos: rowsToArray(todosRes),
  };

  return JSON.stringify(backupData, null, 2);
}

export async function importDataFromJSON(jsonString: string): Promise<boolean> {
  try {
    const data: AttendoBackupData = JSON.parse(jsonString);
    if (!data.subjects || !Array.isArray(data.subjects)) {
      throw new Error('Invalid backup structure');
    }

    const queries: Array<{sql: string; params: any[]}> = [];

    // Clear existing data cleanly
    queries.push({sql: 'DELETE FROM edit_history', params: []});
    queries.push({sql: 'DELETE FROM overrides', params: []});
    queries.push({sql: 'DELETE FROM lecture_instances', params: []});
    queries.push({sql: 'DELETE FROM timetable', params: []});
    queries.push({sql: 'DELETE FROM subjects', params: []});
    queries.push({sql: 'DELETE FROM todos', params: []});

    // Restore subjects
    for (const s of data.subjects) {
      queries.push({
        sql: 'INSERT INTO subjects (id, name, color, target_percent, credits, past_attended, past_total) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [s.id, s.name, s.color, s.target_percent, s.credits ?? 1, s.past_attended ?? 0, s.past_total ?? 0],
      });
    }

    // Restore timetable
    if (data.timetable) {
      for (const t of data.timetable) {
        queries.push({
          sql: 'INSERT INTO timetable (id, subject_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?)',
          params: [t.id, t.subject_id, t.day_of_week, t.start_time, t.end_time, t.room ?? ''],
        });
      }
    }

    // Restore lecture instances
    if (data.lectureInstances) {
      for (const l of data.lectureInstances) {
        queries.push({
          sql: 'INSERT INTO lecture_instances (id, subject_id, date, day_of_week, start_time, end_time, status, marked_at, is_override, original_timetable_id, room, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          params: [
            l.id,
            l.subject_id,
            l.date,
            l.day_of_week,
            l.start_time,
            l.end_time,
            l.status ?? null,
            l.marked_at ?? null,
            l.is_override ?? 0,
            l.original_timetable_id ?? null,
            l.room ?? '',
            l.notes ?? '',
          ],
        });
      }
    }

    // Restore overrides
    if (data.overrides) {
      for (const o of data.overrides) {
        queries.push({
          sql: 'INSERT INTO overrides (id, timetable_id, date, new_start_time, new_day, reason) VALUES (?, ?, ?, ?, ?, ?)',
          params: [o.id, o.timetable_id, o.date, o.new_start_time ?? null, o.new_day ?? null, o.reason ?? ''],
        });
      }
    }

    // Restore todos
    if (data.todos) {
      for (const td of data.todos) {
        queries.push({
          sql: 'INSERT INTO todos (id, title, category, due_date, due_time, is_completed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          params: [td.id, td.title, td.category ?? 'general', td.due_date ?? null, td.due_time ?? null, td.is_completed ?? 0, td.created_at ?? new Date().toISOString()],
        });
      }
    }

    await executeInTransaction(queries);
    return true;
  } catch (e) {
    console.error('Failed to import JSON backup:', e);
    throw e;
  }
}
