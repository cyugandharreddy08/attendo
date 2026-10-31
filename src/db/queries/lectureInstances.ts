import {format, parseISO, isToday, startOfWeek, endOfWeek, eachDayOfInterval} from 'date-fns';
import {LectureInstance, AttendanceStatus, AttendanceStats} from '../../types';
import {executeSql, rowsToArray, executeInTransaction} from '../database';
import {appendEditHistory} from './editHistory';
import {getSubjectById} from './subjects';

export async function cleanupDuplicateInstances(): Promise<void> {
  try {
    await executeSql(`
      DELETE FROM timetable
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM timetable
        GROUP BY subject_id, day_of_week, start_time, end_time
      )
    `);
    await executeSql(`
      DELETE FROM lecture_instances
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM lecture_instances
        GROUP BY date, subject_id, start_time
      )
    `);
  } catch (e) {
    console.error('Error cleaning duplicate instances:', e);
  }
}

export async function ensureInstancesForDate(dateStr: string): Promise<void> {
  await cleanupDuplicateInstances();

  const dateObj = parseISO(dateStr);
  const dayName = format(dateObj, 'EEEE');

  const timetableResult = await executeSql(
    `SELECT t.* FROM timetable t
     JOIN subjects s ON t.subject_id = s.id
     WHERE t.day_of_week = ? AND s.is_frozen = 0`,
    [dayName],
  );
  const timetableEntries = rowsToArray<any>(timetableResult);

  if (timetableEntries.length === 0) {
    return;
  }

  const overridesResult = await executeSql(
    'SELECT * FROM overrides WHERE date = ?',
    [dateStr],
  );
  const overrides = rowsToArray<any>(overridesResult);
  const overrideMap = new Map<number, any>();
  overrides.forEach((o: any) => overrideMap.set(o.timetable_id, o));

  const queries: Array<{sql: string; params: any[]}> = [];

  for (const entry of timetableEntries) {
    const override = overrideMap.get(entry.id);
    const startTime = override?.new_start_time ?? entry.start_time;
    const dayOfWeek = override?.new_day ?? entry.day_of_week;
    const isOverride = override ? 1 : 0;

    const existingCheck = await executeSql(
      'SELECT COUNT(*) as count FROM lecture_instances WHERE date = ? AND subject_id = ? AND start_time = ?',
      [dateStr, entry.subject_id, startTime],
    );
    const checkRows = rowsToArray<{count: number}>(existingCheck);
    if ((checkRows[0]?.count ?? 0) > 0) {
      continue;
    }

    queries.push({
      sql: `INSERT INTO lecture_instances
        (subject_id, date, day_of_week, start_time, end_time, status, marked_at, is_override, original_timetable_id, room, notes)
        VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, '')`,
      params: [
        entry.subject_id,
        dateStr,
        dayOfWeek,
        startTime,
        entry.end_time,
        isOverride,
        entry.id,
        entry.room,
      ],
    });
  }

  if (queries.length > 0) {
    await executeInTransaction(queries);
  }
}

export async function generateTodayInstances(): Promise<void> {
  const today = format(new Date(), 'yyyy-MM-dd');
  await ensureInstancesForDate(today);
}

export async function generateInstancesForWeek(weekStartDate: Date): Promise<void> {
  const start = startOfWeek(weekStartDate, {weekStartsOn: 1});
  const end = endOfWeek(weekStartDate, {weekStartsOn: 1});
  const days = eachDayOfInterval({start, end});

  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd');
    await ensureInstancesForDate(dateStr);
  }
}

export async function getInstancesForWeek(weekStartDate: Date): Promise<LectureInstance[]> {
  await generateInstancesForWeek(weekStartDate);
  const start = startOfWeek(weekStartDate, {weekStartsOn: 1});
  const end = endOfWeek(weekStartDate, {weekStartsOn: 1});
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');

  const result = await executeSql(`
    SELECT li.*, s.name as subject_name, s.color as subject_color, s.target_percent, s.is_frozen, s.past_attended, s.past_total
    FROM lecture_instances li
    LEFT JOIN subjects s ON li.subject_id = s.id
    WHERE li.date >= ? AND li.date <= ?
    ORDER BY li.date ASC, li.start_time ASC
  `, [startStr, endStr]);

  return rowsToArray<any>(result).map(row => ({
    ...row,
    subject: {
      id: row.subject_id,
      name: row.subject_name,
      color: row.subject_color,
      target_percent: row.target_percent,
      is_frozen: row.is_frozen ?? 0,
      past_attended: row.past_attended ?? 0,
      past_total: row.past_total ?? 0,
    },
  }));
}

export async function getInstancesForDate(date: string): Promise<LectureInstance[]> {
  await ensureInstancesForDate(date);

  const result = await executeSql(`
    SELECT li.*, s.name as subject_name, s.color as subject_color, s.target_percent, s.is_frozen, s.past_attended, s.past_total
    FROM lecture_instances li
    LEFT JOIN subjects s ON li.subject_id = s.id
    WHERE li.date = ?
    ORDER BY li.start_time ASC
  `, [date]);

  return rowsToArray<any>(result).map(row => ({
    ...row,
    subject: {
      id: row.subject_id,
      name: row.subject_name,
      color: row.subject_color,
      target_percent: row.target_percent,
      is_frozen: row.is_frozen ?? 0,
      past_attended: row.past_attended ?? 0,
      past_total: row.past_total ?? 0,
    },
  }));
}

export async function getInstancesByDate(date: string): Promise<LectureInstance[]> {
  return getInstancesForDate(date);
}

export async function getTodayInstances(): Promise<LectureInstance[]> {
  const today = format(new Date(), 'yyyy-MM-dd');
  return getInstancesForDate(today);
}

export async function getAllInstancesByMonth(monthStr: string): Promise<LectureInstance[]> {
  const result = await executeSql(`
    SELECT li.*, s.name as subject_name, s.color as subject_color, s.target_percent, s.is_frozen, s.past_attended, s.past_total
    FROM lecture_instances li
    LEFT JOIN subjects s ON li.subject_id = s.id
    WHERE li.date LIKE ?
    ORDER BY li.date ASC, li.start_time ASC
  `, [`${monthStr}%`]);

  return rowsToArray<any>(result).map(row => ({
    ...row,
    subject: {
      id: row.subject_id,
      name: row.subject_name,
      color: row.subject_color,
      target_percent: row.target_percent,
      is_frozen: row.is_frozen ?? 0,
      past_attended: row.past_attended ?? 0,
      past_total: row.past_total ?? 0,
    },
  }));
}

export async function getInstancesForSubject(subjectId: number): Promise<LectureInstance[]> {
  const result = await executeSql(`
    SELECT li.*, s.name as subject_name, s.color as subject_color, s.target_percent, s.is_frozen, s.past_attended, s.past_total
    FROM lecture_instances li
    LEFT JOIN subjects s ON li.subject_id = s.id
    WHERE li.subject_id = ?
    ORDER BY li.date DESC, li.start_time ASC
  `, [subjectId]);

  return rowsToArray<any>(result).map(row => ({
    ...row,
    subject: {
      id: row.subject_id,
      name: row.subject_name,
      color: row.subject_color,
      target_percent: row.target_percent,
      is_frozen: row.is_frozen ?? 0,
      past_attended: row.past_attended ?? 0,
      past_total: row.past_total ?? 0,
    },
  }));
}

export async function getAllInstances(): Promise<LectureInstance[]> {
  const result = await executeSql(`
    SELECT li.*, s.name as subject_name, s.color as subject_color, s.target_percent, s.is_frozen, s.past_attended, s.past_total
    FROM lecture_instances li
    LEFT JOIN subjects s ON li.subject_id = s.id
    ORDER BY li.date ASC, li.start_time ASC
  `);

  return rowsToArray<any>(result).map(row => ({
    ...row,
    subject: {
      id: row.subject_id,
      name: row.subject_name,
      color: row.subject_color,
      target_percent: row.target_percent,
      is_frozen: row.is_frozen ?? 0,
      past_attended: row.past_attended ?? 0,
      past_total: row.past_total ?? 0,
    },
  }));
}

export async function getInstanceById(id: number): Promise<LectureInstance | null> {
  const result = await executeSql(
    `SELECT li.*, s.name as subject_name, s.color as subject_color, s.target_percent, s.is_frozen, s.past_attended, s.past_total
     FROM lecture_instances li
     LEFT JOIN subjects s ON li.subject_id = s.id
     WHERE li.id = ?`,
    [id],
  );
  const rows = rowsToArray<any>(result);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    subject: {
      id: row.subject_id,
      name: row.subject_name,
      color: row.subject_color,
      target_percent: row.target_percent,
      is_frozen: row.is_frozen ?? 0,
      past_attended: row.past_attended ?? 0,
      past_total: row.past_total ?? 0,
    },
  };
}

export async function updateInstanceStatus(
  id: number,
  newStatus: AttendanceStatus,
  oldStatus: AttendanceStatus | null = null,
  reason: string = '',
): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    if (newStatus === 'holiday') {
      // Cascading Holiday: Mark all lectures on this date as holiday with optional reason
      const instanceRes = await executeSql('SELECT date FROM lecture_instances WHERE id = ?', [id]);
      const instRows = rowsToArray<{date: string}>(instanceRes);
      if (instRows.length > 0) {
        await markEntireDayHoliday(instRows[0].date, reason);
        return;
      }
    }

    const notesText = reason ? reason : '';
    await executeSql(
      'UPDATE lecture_instances SET status = ?, notes = ?, marked_at = ? WHERE id = ?',
      [newStatus, notesText, now, id],
    );
    await appendEditHistory(id, oldStatus, newStatus);
  } catch (e) {
    console.error('Failed to update instance status safely:', e);
  }
}

export async function markEntireDayHoliday(date: string, reason: string = ''): Promise<void> {
  const now = new Date().toISOString();
  const notesText = reason ? `Holiday: ${reason}` : 'Holiday';
  await executeSql(
    'UPDATE lecture_instances SET status = ?, notes = ?, marked_at = ? WHERE date = ?',
    ['holiday', notesText, now, date],
  );
}

export async function markEntireDayStatus(date: string, status: AttendanceStatus, reason: string = ''): Promise<void> {
  const now = new Date().toISOString();
  const notesText = reason ? reason : '';
  await executeSql(
    'UPDATE lecture_instances SET status = ?, notes = ?, marked_at = ? WHERE date = ?',
    [status, notesText, now, date],
  );
}

export async function getSubjectStreak(subjectId: number): Promise<number> {
  const result = await executeSql(`
    SELECT status FROM lecture_instances
    WHERE subject_id = ? AND status IS NOT NULL AND status != 'cancelled' AND status != 'holiday'
    ORDER BY date DESC, start_time DESC
  `, [subjectId]);

  const rows = rowsToArray<{status: string}>(result);
  let streak = 0;
  for (const row of rows) {
    if (row.status === 'present') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export async function getAllSubjectStreaks(): Promise<Record<number, number>> {
  const result = await executeSql(`
    SELECT subject_id, status FROM lecture_instances
    WHERE status IS NOT NULL AND status != 'cancelled' AND status != 'holiday'
    ORDER BY subject_id ASC, date DESC, start_time DESC
  `);

  const rows = rowsToArray<{subject_id: number; status: string}>(result);
  const streaks: Record<number, number> = {};
  
  const grouped = new Map<number, string[]>();
  rows.forEach(r => {
    if (!grouped.has(r.subject_id)) grouped.set(r.subject_id, []);
    grouped.get(r.subject_id)!.push(r.status);
  });

  grouped.forEach((statuses, subId) => {
    let count = 0;
    for (const st of statuses) {
      if (st === 'present') count++;
      else break;
    }
    streaks[subId] = count;
  });

  return streaks;
}

export async function shiftLectureInstance(
  instanceId: number,
  newDate: string,
  newStartTime: string,
  newEndTime: string,
  reason: string = 'Shifted',
  isPermanent: boolean = false,
): Promise<void> {
  const original = await executeSql('SELECT * FROM lecture_instances WHERE id = ?', [instanceId]);
  const rows = rowsToArray<LectureInstance>(original);
  if (rows.length === 0) return;

  const lecture = rows[0];
  const now = new Date().toISOString();

  await executeSql(
    'UPDATE lecture_instances SET status = ?, notes = ?, marked_at = ? WHERE id = ?',
    ['shifted', `👻 Shifted to ${newDate} ${newStartTime} (${reason})`, now, instanceId],
  );

  const dateObj = parseISO(newDate);
  const newDayOfWeek = format(dateObj, 'EEEE');

  await executeSql(
    `INSERT INTO lecture_instances
      (subject_id, date, day_of_week, start_time, end_time, status, marked_at, is_override, original_timetable_id, room, notes)
      VALUES (?, ?, ?, ?, ?, NULL, NULL, 1, ?, ?, ?)`,
    [
      lecture.subject_id,
      newDate,
      newDayOfWeek,
      newStartTime,
      newEndTime,
      lecture.original_timetable_id,
      lecture.room,
      `Shifted from ${lecture.date} ${lecture.start_time}`,
    ],
  );

  if (isPermanent && lecture.original_timetable_id) {
    await executeSql(
      'UPDATE timetable SET day_of_week = ?, start_time = ?, end_time = ? WHERE id = ?',
      [newDayOfWeek, newStartTime, newEndTime, lecture.original_timetable_id],
    );
  }
}

export async function unshiftLectureInstance(instanceId: number): Promise<void> {
  const instance = await getInstanceById(instanceId);
  if (!instance) return;

  const now = new Date().toISOString();
  await executeSql(
    "UPDATE lecture_instances SET status = NULL, notes = '', marked_at = ? WHERE id = ?",
    [now, instanceId],
  );

  if (instance.notes && instance.notes.includes('Shifted to ')) {
    const parts = instance.notes.split('Shifted to ')[1];
    if (parts) {
      const targetDate = parts.split(' ')[0];
      if (targetDate) {
        await executeSql(
          'DELETE FROM lecture_instances WHERE subject_id = ? AND date = ? AND is_override = 1 AND notes LIKE ?',
          [instance.subject_id, targetDate, `%Shifted from ${instance.date}%`],
        );
      }
    }
  }
}

export async function swapLectureInstances(idA: number, idB: number): Promise<void> {
  const instA = await getInstanceById(idA);
  const instB = await getInstanceById(idB);
  if (!instA || !instB) return;

  const queries = [
    {
      sql: `UPDATE lecture_instances SET date = ?, day_of_week = ?, start_time = ?, end_time = ?, room = ?, is_override = 1 WHERE id = ?`,
      params: [instB.date, instB.day_of_week, instB.start_time, instB.end_time, instB.room, idA],
    },
    {
      sql: `UPDATE lecture_instances SET date = ?, day_of_week = ?, start_time = ?, end_time = ?, room = ?, is_override = 1 WHERE id = ?`,
      params: [instA.date, instA.day_of_week, instA.start_time, instA.end_time, instA.room, idB],
    },
  ];

  await executeInTransaction(queries);
}

export async function deleteSingleInstance(instanceId: number): Promise<void> {
  await executeSql('DELETE FROM lecture_instances WHERE id = ?', [instanceId]);
}

export async function getUnmarkedTodayCount(): Promise<number> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const result = await executeSql(
    'SELECT COUNT(*) as count FROM lecture_instances WHERE date = ? AND status IS NULL',
    [today],
  );
  const rows = rowsToArray<{count: number}>(result);
  return rows[0]?.count ?? 0;
}

export function calculateDurationHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 1.0;
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  if (isNaN(sH) || isNaN(eH)) return 1.0;
  const startMins = sH * 60 + (sM || 0);
  const endMins = eH * 60 + (eM || 0);
  const diffMins = endMins - startMins;
  if (diffMins <= 0) return 1.0;
  return Math.round((diffMins / 60) * 10) / 10;
}

export async function getAttendanceStats(subjectId: number, targetPercent: number = 75): Promise<AttendanceStats> {
  const subject = await getSubjectById(subjectId);
  const pastAttended = subject?.past_attended ?? 0;
  const pastTotal = subject?.past_total ?? 0;

  const result = await executeSql(
    `SELECT start_time, end_time, status FROM lecture_instances
     WHERE subject_id = ? AND status IS NOT NULL`,
    [subjectId],
  );
  const rows = rowsToArray<{start_time: string; end_time: string; status: string}>(result);

  let attended = pastAttended;
  let absent = (pastTotal > pastAttended) ? (pastTotal - pastAttended) : 0;
  let holiday = 0;
  let cancelled = 0;

  rows.forEach(row => {
    const hours = calculateDurationHours(row.start_time, row.end_time);
    switch (row.status) {
      case 'present': attended += hours; break;
      case 'absent': absent += hours; break;
      case 'holiday': holiday += hours; break;
      case 'cancelled': cancelled += hours; break;
    }
  });

  attended = Math.round(attended * 10) / 10;
  absent = Math.round(absent * 10) / 10;
  holiday = Math.round(holiday * 10) / 10;
  cancelled = Math.round(cancelled * 10) / 10;

  const countableTotal = Math.round((attended + absent) * 10) / 10;

  if (countableTotal === 0) {
    return {
      total: 0,
      attended: 0,
      absent: 0,
      holiday,
      cancelled,
      percent: 0,
      maxBunkable: 0,
      neededToTarget: 0,
      isInDangerZone: false,
      statusMessage: 'No classes held yet',
    };
  }

  const percent = Math.round((attended / countableTotal) * 100);
  const targetRatio = targetPercent / 100;

  let maxBunkable = 0;
  let neededToTarget = 0;
  let statusMessage = '';

  if (percent >= targetPercent) {
    maxBunkable = Math.max(0, Math.floor((attended / targetRatio) - countableTotal));
    neededToTarget = 0;
    if (maxBunkable > 0) {
      statusMessage = `You can bunk ${maxBunkable} hr${maxBunkable > 1 ? 's' : ''} safely`;
    } else {
      statusMessage = `On target! Don't miss next class`;
    }
  } else {
    neededToTarget = Math.ceil((targetRatio * countableTotal - attended) / (1 - targetRatio));
    maxBunkable = 0;
    statusMessage = `Must attend ${neededToTarget} consecutive hr${neededToTarget > 1 ? 's' : ''} to reach ${targetPercent}%`;
  }

  const nextPercent = Math.round(((attended) / (countableTotal + 1)) * 100);
  const isInDangerZone = nextPercent < targetPercent || percent < targetPercent;

  return {
    total: countableTotal,
    attended,
    absent,
    holiday,
    cancelled,
    percent,
    maxBunkable,
    neededToTarget,
    isInDangerZone,
    statusMessage,
  };
}

export async function getOverallAttendanceStats(targetPercent: number = 75): Promise<{
  totalPercent: number;
  totalClasses: number;
  maxBunkable: number;
  isInDanger: boolean;
}> {
  const activeSubjectsResult = await executeSql('SELECT * FROM subjects WHERE is_frozen = 0');
  const subjects = rowsToArray<any>(activeSubjectsResult);

  if (subjects.length === 0) {
    return {
      totalPercent: 0,
      totalClasses: 0,
      maxBunkable: 0,
      isInDanger: false,
    };
  }

  let grandAttendedCredits = 0;
  let grandTotalCredits = 0;

  for (const s of subjects) {
    const stats = await getAttendanceStats(s.id, s.target_percent || targetPercent);
    const weight = s.credits || 1;
    grandAttendedCredits += stats.attended * weight;
    grandTotalCredits += stats.total * weight;
  }

  if (grandTotalCredits === 0) {
    return {
      totalPercent: 0,
      totalClasses: 0,
      maxBunkable: 0,
      isInDanger: false,
    };
  }

  const totalPercent = Math.round((grandAttendedCredits / grandTotalCredits) * 100);
  const targetRatio = targetPercent / 100;
  const maxBunkable = totalPercent >= targetPercent
    ? Math.max(0, Math.floor((grandAttendedCredits / targetRatio) - grandTotalCredits))
    : 0;
  const isInDanger = totalPercent < targetPercent;

  return {
    totalPercent,
    totalClasses: grandTotalCredits,
    maxBunkable,
    isInDanger,
  };
}

export async function getOverallStreak(): Promise<number> {
  const result = await executeSql(`
    SELECT date, status FROM lecture_instances
    WHERE status IS NOT NULL AND status IN ('present', 'absent')
    ORDER BY date DESC, start_time DESC
  `);
  const rows = rowsToArray<{date: string; status: string}>(result);

  if (rows.length === 0) return 0;

  let streak = 0;
  for (const row of rows) {
    if (row.status === 'present') {
      streak++;
    } else if (row.status === 'absent') {
      break;
    }
  }
  return streak;
}
