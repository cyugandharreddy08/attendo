import {format, parseISO, isToday, startOfWeek, endOfWeek, eachDayOfInterval} from 'date-fns';
import {LectureInstance, AttendanceStatus, AttendanceStats, AttendanceActivityDay} from '../../types';
import {executeSql, rowsToArray, executeInTransaction} from '../database';
import {appendEditHistory} from './editHistory';
import {getSubjectById} from './subjects';
import {computeAttendanceMetrics, parseDurationHours} from '../../services/AttendanceEngine';

export function getDayOfWeekFromDateStr(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return format(new Date(y, m, d, 12, 0, 0), 'EEEE');
  }
  return format(parseISO(dateStr), 'EEEE');
}

export async function cleanupDuplicateInstances(): Promise<void> {
  try {
    // 1. Clean timetable duplicates safely
    await executeSql(`
      DELETE FROM timetable
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM timetable
        GROUP BY subject_id, day_of_week, start_time, end_time
      )
    `);

    // 2. Intelligent deduplication of lecture_instances
    // Find duplicate groups
    const dupGroups = await executeSql(`
      SELECT date, subject_id, start_time, COUNT(*) as cnt
      FROM lecture_instances
      GROUP BY date, subject_id, start_time
      HAVING cnt > 1
    `);
    const groups = rowsToArray<{date: string; subject_id: number; start_time: string}>(dupGroups);

    for (const group of groups) {
      const allDupesRes = await executeSql(`
        SELECT * FROM lecture_instances
        WHERE date = ? AND subject_id = ? AND start_time = ?
        ORDER BY
          CASE WHEN status IS NOT NULL AND status != '' THEN 0 ELSE 1 END,
          CASE WHEN marked_at IS NOT NULL THEN 0 ELSE 1 END,
          id ASC
      `, [group.date, group.subject_id, group.start_time]);
      const dupes = rowsToArray<any>(allDupesRes);
      if (dupes.length <= 1) continue;

      const survivor = dupes[0];
      const victims = dupes.slice(1);
      const victimIds = victims.map(v => v.id);

      // Merge notes if survivor notes are empty and any victim has notes
      let mergedNotes = survivor.notes || '';
      for (const v of victims) {
        if (!mergedNotes && v.notes) {
          mergedNotes = v.notes;
        }
      }
      if (mergedNotes !== (survivor.notes || '')) {
        await executeSql('UPDATE lecture_instances SET notes = ? WHERE id = ?', [mergedNotes, survivor.id]);
      }

      // Re-link edit_history to survivor
      for (const vicId of victimIds) {
        await executeSql('UPDATE edit_history SET lecture_instance_id = ? WHERE lecture_instance_id = ?', [survivor.id, vicId]);
      }

      // Delete victim duplicate records
      const placeholders = victimIds.map(() => '?').join(',');
      await executeSql(`DELETE FROM lecture_instances WHERE id IN (${placeholders})`, victimIds);
    }
  } catch (e) {
    console.error('Error cleaning duplicate instances:', e);
  }
}

export async function ensureInstancesForDate(dateStr: string): Promise<void> {
  await cleanupDuplicateInstances();

  const dayName = getDayOfWeekFromDateStr(dateStr);

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
    if (override && (override.reason === 'cancelled' || override.reason === 'deleted')) {
      // User explicitly cancelled or deleted this specific instance - do NOT recreate
      continue;
    }

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
  const instance = await getInstanceById(instanceId);
  if (instance && instance.original_timetable_id) {
    // Record tombstone in overrides table so ensureInstancesForDate will NEVER resurrect it
    try {
      await executeSql(
        'INSERT INTO overrides (timetable_id, date, reason) VALUES (?, ?, ?)',
        [instance.original_timetable_id, instance.date, 'cancelled'],
      );
    } catch (e) {
      console.warn('Could not record cancellation override:', e);
    }
  }
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
    const hours = parseDurationHours(row.start_time, row.end_time);
    switch (row.status) {
      case 'present': attended += hours; break;
      case 'absent': absent += hours; break;
      case 'holiday': holiday += hours; break;
      case 'cancelled': cancelled += hours; break;
    }
  });

  const metrics = computeAttendanceMetrics({
    attendedHours: attended,
    conductedHours: attended + absent,
    absentHours: absent,
    holidayHours: holiday,
    cancelledHours: cancelled,
    targetPercent,
  });

  const nextPercent = metrics.conductedHours > 0
    ? Math.round(((metrics.attendedHours) / (metrics.conductedHours + 1)) * 100)
    : 0;
  const isInDangerZone = nextPercent < targetPercent || !metrics.isEligible;

  return {
    total: metrics.conductedHours,
    attended: metrics.attendedHours,
    absent: metrics.absentHours,
    holiday: metrics.holidayHours,
    cancelled: metrics.cancelledHours,
    percent: metrics.percent,
    maxBunkable: metrics.maxBunkableHours,
    neededToTarget: metrics.neededConsecutiveHours,
    isInDangerZone,
    statusMessage: metrics.statusMessage,
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

  const overallMetrics = computeAttendanceMetrics({
    attendedHours: grandAttendedCredits,
    conductedHours: grandTotalCredits,
    targetPercent,
  });

  return {
    totalPercent: overallMetrics.percent,
    totalClasses: overallMetrics.conductedHours,
    maxBunkable: overallMetrics.maxBunkableHours,
    isInDanger: !overallMetrics.isEligible,
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

export async function getUserAttendanceActivityReport(): Promise<{
  overallPercent: number;
  theoryPercent: number;
  labPercent: number;
  currentStreak: number;
  longestStreak: number;
  totalAttendedHours: number;
  totalHeldHours: number;
  activeDaysCount: number;
  activityMatrix: AttendanceActivityDay[];
  badges: string[];
}> {
  // 1. Get subjects to split theory vs lab
  const subRes = await executeSql('SELECT id, subject_type FROM subjects WHERE is_frozen = 0');
  const subs = rowsToArray<{id: number; subject_type: string}>(subRes);
  const subjectTypeMap = new Map<number, string>();
  subs.forEach(s => subjectTypeMap.set(s.id, s.subject_type || 'theory'));

  // 2. Fetch all marked instances
  const instRes = await executeSql(`
    SELECT subject_id, date, start_time, end_time, status
    FROM lecture_instances
    WHERE status IS NOT NULL
    ORDER BY date ASC, start_time ASC
  `);
  const instRows = rowsToArray<{
    subject_id: number;
    date: string;
    start_time: string;
    end_time: string;
    status: string;
  }>(instRes);

  let totalAttendedHours = 0;
  let totalHeldHours = 0;
  let theoryAttendedHours = 0;
  let theoryHeldHours = 0;
  let labAttendedHours = 0;
  let labHeldHours = 0;

  // Day grouping for LeetCode activity matrix
  const dayMap = new Map<string, {presentCount: number; totalCount: number; presentHours: number}>();

  for (const inst of instRows) {
    const hours = calculateDurationHours(inst.start_time, inst.end_time);
    const isLab = subjectTypeMap.get(inst.subject_id) === 'lab';

    if (!dayMap.has(inst.date)) {
      dayMap.set(inst.date, {presentCount: 0, totalCount: 0, presentHours: 0});
    }
    const dayData = dayMap.get(inst.date)!;

    if (inst.status === 'present') {
      totalAttendedHours += hours;
      totalHeldHours += hours;
      dayData.presentCount += 1;
      dayData.presentHours += hours;
      dayData.totalCount += 1;

      if (isLab) {
        labAttendedHours += hours;
        labHeldHours += hours;
      } else {
        theoryAttendedHours += hours;
        theoryHeldHours += hours;
      }
    } else if (inst.status === 'absent') {
      totalHeldHours += hours;
      dayData.totalCount += 1;

      if (isLab) {
        labHeldHours += hours;
      } else {
        theoryHeldHours += hours;
      }
    }
  }

  // Build sorted activity matrix
  const sortedDates = Array.from(dayMap.keys()).sort();
  const activityMatrix: AttendanceActivityDay[] = sortedDates.map(date => {
    const d = dayMap.get(date)!;
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (d.presentCount >= 4) level = 4;
    else if (d.presentCount === 3) level = 3;
    else if (d.presentCount === 2) level = 2;
    else if (d.presentCount === 1) level = 1;
    else level = 0;

    return {
      date,
      count: d.presentCount,
      hours: Math.round(d.presentHours * 10) / 10,
      level,
    };
  });

  // Calculate day-based streaks
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  for (const date of sortedDates) {
    const day = dayMap.get(date)!;
    if (day.presentCount > 0) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  // Current streak (counting backwards from most recent active date)
  for (let i = sortedDates.length - 1; i >= 0; i--) {
    const day = dayMap.get(sortedDates[i])!;
    if (day.presentCount > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Active days count (days with >= 1 present class)
  const activeDaysCount = activityMatrix.filter(a => a.count > 0).length;

  const overallPercent = totalHeldHours > 0 ? Math.round((totalAttendedHours / totalHeldHours) * 100) : 0;
  const theoryPercent = theoryHeldHours > 0 ? Math.round((theoryAttendedHours / theoryHeldHours) * 100) : 0;
  const labPercent = labHeldHours > 0 ? Math.round((labAttendedHours / labHeldHours) * 100) : 0;

  // Unlocked badges
  const badges: string[] = [];
  if (currentStreak >= 3 || longestStreak >= 3) badges.push('🔥 3-Day Flame');
  if (currentStreak >= 7 || longestStreak >= 7) badges.push('⚡ 7-Day Unstoppable');
  if (currentStreak >= 15 || longestStreak >= 15) badges.push('🛡️ 15-Day Regular');
  if (currentStreak >= 30 || longestStreak >= 30) badges.push('👑 30-Day Master');
  if (overallPercent >= 75 && totalHeldHours > 0) badges.push('🎯 75% Safe Haven');
  if (overallPercent >= 90 && totalHeldHours > 0) badges.push('🏆 90% Distinction');
  if (labPercent >= 85 && labHeldHours > 0) badges.push('🧪 Lab Prodigy');
  if (totalAttendedHours >= 50) badges.push('⏳ 50+ Hours Attended');

  return {
    overallPercent,
    theoryPercent,
    labPercent,
    currentStreak,
    longestStreak,
    totalAttendedHours: Math.round(totalAttendedHours * 10) / 10,
    totalHeldHours: Math.round(totalHeldHours * 10) / 10,
    activeDaysCount,
    activityMatrix,
    badges,
  };
}

export interface CategoryAttendanceStats {
  percent: number;
  attendedHours: number;
  heldHours: number;
  maxBunkableHours: number;
  neededHours: number;
  isInDanger: boolean;
}

export interface SplitAttendanceStats {
  theory: CategoryAttendanceStats;
  lab: CategoryAttendanceStats;
  overallPercent: number;
  totalAttendedHours: number;
  totalHeldHours: number;
  maxBunkableHours: number;
  isInDanger: boolean;
}

export async function getTheoryAndLabAttendanceStats(targetPercent: number = 75): Promise<SplitAttendanceStats> {
  const subRes = await executeSql('SELECT id, subject_type, past_attended, past_total FROM subjects WHERE is_frozen = 0');
  const subs = rowsToArray<{id: number; subject_type: string; past_attended: number; past_total: number}>(subRes);
  const subjectTypeMap = new Map<number, string>();

  let theoryAttended = 0;
  let theoryHeld = 0;
  let labAttended = 0;
  let labHeld = 0;

  subs.forEach(s => {
    const isLab = (s.subject_type || 'theory').toLowerCase() === 'lab';
    subjectTypeMap.set(s.id, isLab ? 'lab' : 'theory');
    const pastAtt = s.past_attended ?? 0;
    const pastTot = s.past_total ?? 0;
    if (isLab) {
      labAttended += pastAtt;
      labHeld += pastTot;
    } else {
      theoryAttended += pastAtt;
      theoryHeld += pastTot;
    }
  });

  const instRes = await executeSql(`
    SELECT subject_id, start_time, end_time, status
    FROM lecture_instances
    WHERE status IS NOT NULL AND status IN ('present', 'absent')
  `);
  const instances = rowsToArray<{subject_id: number; start_time: string; end_time: string; status: string}>(instRes);

  instances.forEach(inst => {
    const hours = calculateDurationHours(inst.start_time, inst.end_time);
    const isLab = subjectTypeMap.get(inst.subject_id) === 'lab';

    if (inst.status === 'present') {
      if (isLab) {
        labAttended += hours;
        labHeld += hours;
      } else {
        theoryAttended += hours;
        theoryHeld += hours;
      }
    } else if (inst.status === 'absent') {
      if (isLab) {
        labHeld += hours;
      } else {
        theoryHeld += hours;
      }
    }
  });

  theoryAttended = Math.round(theoryAttended * 10) / 10;
  theoryHeld = Math.round(theoryHeld * 10) / 10;
  labAttended = Math.round(labAttended * 10) / 10;
  labHeld = Math.round(labHeld * 10) / 10;

  const totalAttended = Math.round((theoryAttended + labAttended) * 10) / 10;
  const totalHeld = Math.round((theoryHeld + labHeld) * 10) / 10;

  const targetRatio = targetPercent / 100;

  // Theory metrics
  const theoryPercent = theoryHeld > 0 ? Math.round((theoryAttended / theoryHeld) * 100) : 0;
  const theoryBunkable = (theoryHeld > 0 && theoryPercent >= targetPercent)
    ? Math.max(0, Math.floor((theoryAttended / targetRatio) - theoryHeld))
    : 0;
  const theoryNeeded = (theoryHeld > 0 && theoryPercent < targetPercent)
    ? Math.ceil((targetRatio * theoryHeld - theoryAttended) / (1 - targetRatio))
    : 0;
  const theoryDanger = theoryHeld > 0 && theoryPercent < targetPercent;

  // Lab metrics
  const labPercent = labHeld > 0 ? Math.round((labAttended / labHeld) * 100) : 0;
  const labBunkable = (labHeld > 0 && labPercent >= targetPercent)
    ? Math.max(0, Math.floor((labAttended / targetRatio) - labHeld))
    : 0;
  const labNeeded = (labHeld > 0 && labPercent < targetPercent)
    ? Math.ceil((targetRatio * labHeld - labAttended) / (1 - targetRatio))
    : 0;
  const labDanger = labHeld > 0 && labPercent < targetPercent;

  // Overall metrics
  const overallPercent = totalHeld > 0 ? Math.round((totalAttended / totalHeld) * 100) : 0;
  const overallBunkable = (totalHeld > 0 && overallPercent >= targetPercent)
    ? Math.max(0, Math.floor((totalAttended / targetRatio) - totalHeld))
    : 0;
  const overallDanger = totalHeld > 0 && overallPercent < targetPercent;

  return {
    theory: {
      percent: theoryPercent,
      attendedHours: theoryAttended,
      heldHours: theoryHeld,
      maxBunkableHours: theoryBunkable,
      neededHours: theoryNeeded,
      isInDanger: theoryDanger,
    },
    lab: {
      percent: labPercent,
      attendedHours: labAttended,
      heldHours: labHeld,
      maxBunkableHours: labBunkable,
      neededHours: labNeeded,
      isInDanger: labDanger,
    },
    overallPercent,
    totalAttendedHours: totalAttended,
    totalHeldHours: totalHeld,
    maxBunkableHours: overallBunkable,
    isInDanger: overallDanger,
  };
}
