import {TimetableEntry, AITimetableEntry} from '../../types';
import {executeSql, rowsToArray, executeInTransaction} from '../database';
import {createSubject, getAllSubjects} from './subjects';

export async function getAllTimetableEntries(): Promise<TimetableEntry[]> {
  const result = await executeSql(`
    SELECT t.*, s.name as subject_name, s.color as subject_color, s.target_percent
    FROM timetable t
    LEFT JOIN subjects s ON t.subject_id = s.id
    ORDER BY 
      CASE t.day_of_week
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4
        WHEN 'Friday' THEN 5
        WHEN 'Saturday' THEN 6
        WHEN 'Sunday' THEN 7
      END,
      t.start_time ASC
  `);
  return rowsToArray<TimetableEntry>(result).map(row => ({
    ...row,
    subject: {
      id: row.subject_id,
      name: (row as any).subject_name,
      color: (row as any).subject_color,
      target_percent: (row as any).target_percent,
      is_frozen: (row as any).is_frozen ?? 0,
      past_attended: (row as any).past_attended ?? 0,
      past_total: (row as any).past_total ?? 0,
      credits: (row as any).credits ?? 1,
    },
  }));
}

export async function getTimetableForDay(dayOfWeek: string): Promise<TimetableEntry[]> {
  const result = await executeSql(`
    SELECT t.*, s.name as subject_name, s.color as subject_color, s.target_percent
    FROM timetable t
    LEFT JOIN subjects s ON t.subject_id = s.id
    WHERE t.day_of_week = ?
    ORDER BY t.start_time ASC
  `, [dayOfWeek]);
  return rowsToArray<TimetableEntry>(result).map(row => ({
    ...row,
    subject: {
      id: row.subject_id,
      name: (row as any).subject_name,
      color: (row as any).subject_color,
      target_percent: (row as any).target_percent,
      is_frozen: (row as any).is_frozen ?? 0,
      past_attended: (row as any).past_attended ?? 0,
      past_total: (row as any).past_total ?? 0,
      credits: (row as any).credits ?? 1,
    },
  }));
}

export async function getTimetableBySubject(subjectId: number): Promise<TimetableEntry[]> {
  const result = await executeSql(`
    SELECT t.*, s.name as subject_name, s.color as subject_color, s.target_percent
    FROM timetable t
    LEFT JOIN subjects s ON t.subject_id = s.id
    WHERE t.subject_id = ?
    ORDER BY t.start_time ASC
  `, [subjectId]);
  return rowsToArray<TimetableEntry>(result).map(row => ({
    ...row,
    subject: {
      id: row.subject_id,
      name: (row as any).subject_name,
      color: (row as any).subject_color,
      target_percent: (row as any).target_percent,
      is_frozen: (row as any).is_frozen ?? 0,
      past_attended: (row as any).past_attended ?? 0,
      past_total: (row as any).past_total ?? 0,
      credits: (row as any).credits ?? 1,
    },
  }));
}

export async function createTimetableEntry(
  subjectId: number,
  dayOfWeek: string,
  startTime: string,
  endTime: string,
  room: string = '',
): Promise<number> {
  const result = await executeSql(
    'INSERT INTO timetable (subject_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?)',
    [subjectId, dayOfWeek, startTime, endTime, room],
  );
  return result.insertId;
}

export async function updateTimetableEntry(
  id: number,
  dayOfWeekOrSubjectId: string | number,
  startTimeOrDayOfWeek: string,
  endTimeOrStartTime: string,
  roomOrEndTime: string = '',
  roomArg: string = '',
): Promise<void> {
  if (typeof dayOfWeekOrSubjectId === 'number') {
    // Signature: (id, subjectId, dayOfWeek, startTime, endTime, room)
    await executeSql(
      'UPDATE timetable SET subject_id = ?, day_of_week = ?, start_time = ?, end_time = ?, room = ? WHERE id = ?',
      [dayOfWeekOrSubjectId, startTimeOrDayOfWeek, endTimeOrStartTime, roomOrEndTime, roomArg, id],
    );
  } else {
    // Signature: (id, dayOfWeek, startTime, endTime, room)
    await executeSql(
      'UPDATE timetable SET day_of_week = ?, start_time = ?, end_time = ?, room = ? WHERE id = ?',
      [dayOfWeekOrSubjectId, startTimeOrDayOfWeek, endTimeOrStartTime, roomOrEndTime, id],
    );
  }
}

export async function deleteTimetableEntry(id: number): Promise<void> {
  await executeSql('DELETE FROM lecture_instances WHERE original_timetable_id = ?', [id]);
  await executeSql('DELETE FROM timetable WHERE id = ?', [id]);
}

export async function clearEntireTimetable(keepAttendanceHistory: boolean = true): Promise<void> {
  if (keepAttendanceHistory) {
    const subjectsRes = await executeSql('SELECT id FROM subjects');
    const subjects = rowsToArray<{id: number}>(subjectsRes);

    for (const s of subjects) {
      const statsRes = await executeSql(
        `SELECT status, COUNT(*) as count FROM lecture_instances
         WHERE subject_id = ? AND status IS NOT NULL AND status IN ('present', 'absent')
         GROUP BY status`,
        [s.id],
      );
      const rows = rowsToArray<{status: string; count: number}>(statsRes);
      let attended = 0;
      let absent = 0;
      rows.forEach(r => {
        if (r.status === 'present') attended += r.count;
        if (r.status === 'absent') absent += r.count;
      });

      if (attended > 0 || absent > 0) {
        await executeSql(
          'UPDATE subjects SET past_attended = past_attended + ?, past_total = past_total + ? WHERE id = ?',
          [attended, attended + absent, s.id],
        );
      }
    }
  }

  await executeSql('DELETE FROM timetable');
  await executeSql('DELETE FROM lecture_instances');
  await executeSql('DELETE FROM overrides');
}

export async function clearClassesForDay(dayOfWeek: string): Promise<void> {
  const timetableRes = await executeSql('SELECT id FROM timetable WHERE day_of_week = ?', [dayOfWeek]);
  const timetableIds = rowsToArray<{id: number}>(timetableRes).map(r => r.id);

  if (timetableIds.length > 0) {
    const placeholders = timetableIds.map(() => '?').join(',');
    await executeSql(`DELETE FROM lecture_instances WHERE original_timetable_id IN (${placeholders})`, timetableIds);
  }
  await executeSql('DELETE FROM timetable WHERE day_of_week = ?', [dayOfWeek]);
}

export async function clearAllData(): Promise<void> {
  await executeSql('DELETE FROM timetable');
  await executeSql('DELETE FROM lecture_instances');
  await executeSql('DELETE FROM overrides');
  await executeSql('DELETE FROM edit_history');
  await executeSql('DELETE FROM subjects');
}

export async function bulkInsertFromAI(entries: AITimetableEntry[]): Promise<void> {
  const existingSubjects = await getAllSubjects();
  const subjectMap = new Map<string, number>();
  existingSubjects.forEach(s => subjectMap.set(s.name.toLowerCase().trim(), s.id));

  const queries: Array<{sql: string; params: any[]}> = [];

  for (const entry of entries) {
    const normalizedName = entry.subject.toLowerCase().trim();
    let subjectId = subjectMap.get(normalizedName);
    if (!subjectId) {
      const isLab = entry.type === 'lab' ||
                    normalizedName.includes('lab') ||
                    normalizedName.includes('practical') ||
                    normalizedName.includes('workshop');
      const subjectType: 'theory' | 'lab' = isLab ? 'lab' : 'theory';
      subjectId = await createSubject(entry.subject, undefined, 75, subjectType);
      subjectMap.set(normalizedName, subjectId);
    }
    queries.push({
      sql: 'INSERT INTO timetable (subject_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?)',
      params: [subjectId, entry.day, entry.start_time, entry.end_time, entry.room || ''],
    });
  }

  await executeInTransaction(queries);
}
