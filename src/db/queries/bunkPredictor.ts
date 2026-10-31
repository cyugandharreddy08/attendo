import {format, parseISO, eachDayOfInterval} from 'date-fns';
import {executeSql, rowsToArray} from '../database';
import {getAllSubjects} from './subjects';
import {getAttendanceStats} from './lectureInstances';

export interface BunkSimulationSubjectResult {
  subjectId: number;
  subjectName: string;
  subjectColor: string;
  currentAttended: number;
  currentTotal: number;
  currentPercent: number;
  bunkedClassesCount: number;
  projectedAttended: number;
  projectedTotal: number;
  projectedPercent: number;
  targetPercent: number;
  isSafe: boolean;
}

export interface BunkSimulationResult {
  startDate: string;
  endDate: string;
  totalDays: number;
  totalBunkedClasses: number;
  subjects: BunkSimulationSubjectResult[];
  overallCurrentPercent: number;
  overallProjectedPercent: number;
  isOverallSafe: boolean;
  recommendation: 'SAFE' | 'WARNING' | 'CRITICAL';
  summaryMessage: string;
}

export async function simulateDateRangeBunk(
  startDateStr: string,
  endDateStr: string,
): Promise<BunkSimulationResult> {
  const start = parseISO(startDateStr);
  const end = parseISO(endDateStr);
  const days = eachDayOfInterval({start, end});
  const dayNames = days.map(d => format(d, 'EEEE'));

  const subjects = await getAllSubjects();
  const activeSubjects = subjects.filter(s => !s.is_frozen);

  const bunkCountMap = new Map<number, number>();
  for (const dayName of dayNames) {
    const timetableRes = await executeSql(
      'SELECT subject_id FROM timetable WHERE day_of_week = ?',
      [dayName],
    );
    const entries = rowsToArray<{subject_id: number}>(timetableRes);
    entries.forEach(e => {
      bunkCountMap.set(e.subject_id, (bunkCountMap.get(e.subject_id) || 0) + 1);
    });
  }

  let totalBunkedClasses = 0;
  let grandCurrentAttended = 0;
  let grandCurrentTotal = 0;
  let grandProjectedAttended = 0;
  let grandProjectedTotal = 0;

  const subjectResults: BunkSimulationSubjectResult[] = [];
  let unsafeCount = 0;

  for (const sub of activeSubjects) {
    const stats = await getAttendanceStats(sub.id, sub.target_percent);
    const bunkCount = bunkCountMap.get(sub.id) || 0;
    totalBunkedClasses += bunkCount;

    const currentAttended = stats.attended;
    const currentTotal = stats.total;
    const projectedAttended = currentAttended;
    const projectedTotal = currentTotal + bunkCount;
    const projectedPercent = projectedTotal > 0
      ? Math.floor((projectedAttended / projectedTotal) * 100)
      : 100;

    const isSafe = projectedPercent >= sub.target_percent;
    if (!isSafe) unsafeCount++;

    const weight = sub.credits || 1;
    grandCurrentAttended += currentAttended * weight;
    grandCurrentTotal += currentTotal * weight;
    grandProjectedAttended += projectedAttended * weight;
    grandProjectedTotal += projectedTotal * weight;

    subjectResults.push({
      subjectId: sub.id,
      subjectName: sub.name,
      subjectColor: sub.color,
      currentAttended,
      currentTotal,
      currentPercent: stats.percent,
      bunkedClassesCount: bunkCount,
      projectedAttended,
      projectedTotal,
      projectedPercent,
      targetPercent: sub.target_percent,
      isSafe,
    });
  }

  const overallCurrentPercent = grandCurrentTotal > 0
    ? Math.round((grandCurrentAttended / grandCurrentTotal) * 100)
    : 100;
  const overallProjectedPercent = grandProjectedTotal > 0
    ? Math.round((grandProjectedAttended / grandProjectedTotal) * 100)
    : 100;
  const isOverallSafe = overallProjectedPercent >= 75 && unsafeCount === 0;

  let recommendation: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
  let summaryMessage = 'All clear! You can safely take leave without dropping below target.';

  if (unsafeCount > 0 && overallProjectedPercent < 75) {
    recommendation = 'CRITICAL';
    summaryMessage = `⚠️ Leave will drop overall attendance to ${overallProjectedPercent}% and breach ${unsafeCount} subject(s)!`;
  } else if (unsafeCount > 0 || overallProjectedPercent < 77) {
    recommendation = 'WARNING';
    summaryMessage = `⚡ Caution: ${unsafeCount} subject(s) will fall below target. Proceed carefully.`;
  }

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    totalDays: days.length,
    totalBunkedClasses,
    subjects: subjectResults,
    overallCurrentPercent,
    overallProjectedPercent,
    isOverallSafe,
    recommendation,
    summaryMessage,
  };
}
