/**
 * Centralized Mathematical Attendance Engine for Attendo.
 * Single source of truth across all screens, analytics, and simulation widgets.
 * Standardizes hours, lecture instances, independent theory vs. lab calculations,
 * and exact eligibility thresholds.
 */

export type SubjectCategory = 'theory' | 'lab' | 'tutorial' | 'seminar' | 'other';
export type AttendanceStatusCode = 'present' | 'absent' | 'holiday' | 'cancelled' | 'shifted';

export interface BaseAttendanceMetrics {
  attendedHours: number;
  conductedHours: number;
  absentHours: number;
  holidayHours: number;
  cancelledHours: number;
  percent: number;
  targetPercent: number;
  isEligible: boolean; // >= targetPercent
  maxBunkableHours: number; // Hours user can safely miss while keeping >= targetPercent
  neededConsecutiveHours: number; // Consecutive hours required to reach targetPercent
  statusMessage: string;
}

export interface SplitAttendanceReport {
  theory: BaseAttendanceMetrics;
  lab: BaseAttendanceMetrics;
  overall: BaseAttendanceMetrics;
  totalLectureCount: number;
  totalPresentCount: number;
  totalAbsentCount: number;
}

/**
 * Calculates duration in decimal hours from "HH:mm" start and end times.
 * Minimum duration is 0.5 hours. Defaults to 1.0 hour if missing or invalid.
 */
export function parseDurationHours(startTime: string, endTime: string): number {
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

/**
 * Core mathematical engine for any attendance stream (Subject, Category, or Global).
 *
 * Formulas:
 * - percent = (attendedHours / conductedHours) * 100
 * - maxBunkable = floor(attendedHours / targetRatio - conductedHours)
 * - neededToTarget = ceil((targetRatio * conductedHours - attendedHours) / (1 - targetRatio))
 */
export function computeAttendanceMetrics(params: {
  attendedHours: number;
  conductedHours: number;
  absentHours?: number;
  holidayHours?: number;
  cancelledHours?: number;
  targetPercent?: number;
}): BaseAttendanceMetrics {
  const targetPercent = params.targetPercent !== undefined ? params.targetPercent : 75;
  const attendedHours = Math.round(Math.max(0, params.attendedHours) * 10) / 10;
  const conductedHours = Math.round(Math.max(0, params.conductedHours) * 10) / 10;
  const absentHours = params.absentHours !== undefined
    ? Math.round(params.absentHours * 10) / 10
    : Math.max(0, Math.round((conductedHours - attendedHours) * 10) / 10);
  const holidayHours = Math.round((params.holidayHours || 0) * 10) / 10;
  const cancelledHours = Math.round((params.cancelledHours || 0) * 10) / 10;

  if (conductedHours <= 0) {
    return {
      attendedHours: 0,
      conductedHours: 0,
      absentHours: 0,
      holidayHours,
      cancelledHours,
      percent: 0,
      targetPercent,
      isEligible: true,
      maxBunkableHours: 0,
      neededConsecutiveHours: 0,
      statusMessage: 'No classes conducted yet',
    };
  }

  const percent = Math.min(100, Math.round((attendedHours / conductedHours) * 100));
  const targetRatio = targetPercent / 100;
  const isEligible = percent >= targetPercent;

  let maxBunkableHours = 0;
  let neededConsecutiveHours = 0;
  let statusMessage = '';

  if (isEligible) {
    // How many hours can be missed (attended / (conducted + B) >= targetRatio)
    // attended >= targetRatio * conducted + targetRatio * B
    // B <= (attended - targetRatio * conducted) / targetRatio = (attended / targetRatio) - conducted
    maxBunkableHours = Math.max(0, Math.floor((attendedHours / targetRatio) - conductedHours));
    neededConsecutiveHours = 0;

    if (maxBunkableHours > 0) {
      statusMessage = `Safe! You can miss ${maxBunkableHours} hr${maxBunkableHours > 1 ? 's' : ''} safely`;
    } else {
      statusMessage = 'On target! Attend next class to stay safe';
    }
  } else {
    // (attended + N) / (conducted + N) >= targetRatio
    // attended + N >= targetRatio * conducted + targetRatio * N
    // N * (1 - targetRatio) >= targetRatio * conducted - attended
    // N >= (targetRatio * conducted - attended) / (1 - targetRatio)
    const rawNeeded = (targetRatio * conductedHours - attendedHours) / (1 - targetRatio);
    neededConsecutiveHours = Math.max(1, Math.ceil(rawNeeded));
    maxBunkableHours = 0;
    statusMessage = `Must attend ${neededConsecutiveHours} consecutive hr${neededConsecutiveHours > 1 ? 's' : ''} to reach ${targetPercent}%`;
  }

  return {
    attendedHours,
    conductedHours,
    absentHours,
    holidayHours,
    cancelledHours,
    percent,
    targetPercent,
    isEligible,
    maxBunkableHours,
    neededConsecutiveHours,
    statusMessage,
  };
}

/**
 * Calculates future hypothetical attendance simulation (Campus Day Twin / What-If).
 * Explicitly separates current reality from projected assumptions.
 */
export function simulateAttendanceOutcome(params: {
  currentAttendedHours: number;
  currentConductedHours: number;
  additionalAttendedHours: number;
  additionalMissedHours: number;
  targetPercent?: number;
}): {
  projectedPercent: number;
  projectedAttendedHours: number;
  projectedConductedHours: number;
  diffPercent: number;
  isEligible: boolean;
  statusMessage: string;
} {
  const target = params.targetPercent || 75;
  const newAttended = params.currentAttendedHours + Math.max(0, params.additionalAttendedHours);
  const newConducted = params.currentConductedHours + Math.max(0, params.additionalAttendedHours) + Math.max(0, params.additionalMissedHours);

  const currentPercent = params.currentConductedHours > 0
    ? Math.round((params.currentAttendedHours / params.currentConductedHours) * 100)
    : 0;

  const projectedPercent = newConducted > 0
    ? Math.round((newAttended / newConducted) * 100)
    : 0;

  const diffPercent = projectedPercent - currentPercent;
  const isEligible = projectedPercent >= target;

  return {
    projectedPercent,
    projectedAttendedHours: Math.round(newAttended * 10) / 10,
    projectedConductedHours: Math.round(newConducted * 10) / 10,
    diffPercent,
    isEligible,
    statusMessage: isEligible
      ? `Projected: ${projectedPercent}% (Eligible)`
      : `Warning: Projected ${projectedPercent}% falls below ${target}% target`,
  };
}
