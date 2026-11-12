import {
  parseDurationHours,
  computeAttendanceMetrics,
  simulateAttendanceOutcome,
} from '../src/services/AttendanceEngine';

describe('AttendanceEngine', () => {
  describe('parseDurationHours', () => {
    it('calculates 1.0 hour for standard period', () => {
      expect(parseDurationHours('09:00', '10:00')).toBe(1.0);
    });

    it('calculates 2.0 hours for double lab period', () => {
      expect(parseDurationHours('14:00', '16:00')).toBe(2.0);
    });

    it('calculates 1.5 hours for 90-minute lecture', () => {
      expect(parseDurationHours('10:30', '12:00')).toBe(1.5);
    });

    it('defaults to 1.0 hour for missing or invalid times', () => {
      expect(parseDurationHours('', '')).toBe(1.0);
      expect(parseDurationHours('invalid', 'time')).toBe(1.0);
      expect(parseDurationHours('10:00', '09:00')).toBe(1.0); // negative duration
    });
  });

  describe('computeAttendanceMetrics', () => {
    it('handles zero conducted classes gracefully', () => {
      const metrics = computeAttendanceMetrics({
        attendedHours: 0,
        conductedHours: 0,
        targetPercent: 75,
      });

      expect(metrics.percent).toBe(0);
      expect(metrics.isEligible).toBe(true);
      expect(metrics.maxBunkableHours).toBe(0);
      expect(metrics.neededConsecutiveHours).toBe(0);
      expect(metrics.statusMessage).toBe('No classes conducted yet');
    });

    it('computes exact safe bunks when attendance is 100% with 75% target', () => {
      // 10 attended out of 10 conducted:
      // floor(10 / 0.75) - 10 = floor(13.33) - 10 = 3
      const metrics = computeAttendanceMetrics({
        attendedHours: 10,
        conductedHours: 10,
        targetPercent: 75,
      });

      expect(metrics.percent).toBe(100);
      expect(metrics.isEligible).toBe(true);
      expect(metrics.maxBunkableHours).toBe(3);
      expect(metrics.neededConsecutiveHours).toBe(0);

      // Verify that after 3 bunks, attendance is >= 75%:
      // 10 / (10 + 3) = 10 / 13 = 76.92% >= 75%
      const after3Bunks = Math.round((10 / 13) * 100);
      expect(after3Bunks).toBeGreaterThanOrEqual(75);

      // Verify that after 4 bunks, attendance would fall below 75%:
      // 10 / 14 = 71.4% < 75%
      const after4Bunks = Math.round((10 / 14) * 100);
      expect(after4Bunks).toBeLessThan(75);
    });

    it('computes exact recovery hours when attendance is below target', () => {
      // 5 attended out of 10 conducted (50%), target is 75%:
      // ceil((0.75 * 10 - 5) / (1 - 0.75)) = ceil((7.5 - 5) / 0.25) = ceil(2.5 / 0.25) = 10
      const metrics = computeAttendanceMetrics({
        attendedHours: 5,
        conductedHours: 10,
        targetPercent: 75,
      });

      expect(metrics.percent).toBe(50);
      expect(metrics.isEligible).toBe(false);
      expect(metrics.maxBunkableHours).toBe(0);
      expect(metrics.neededConsecutiveHours).toBe(10);

      // Verify: (5 + 10) / (10 + 10) = 15 / 20 = 75%
      expect((5 + 10) / (10 + 10)).toBe(0.75);
    });

    it('handles decimal hours from lab sessions correctly', () => {
      // 15.5 hours attended out of 20.0 hours conducted (77.5% -> 78%), target 80%
      // rawNeeded = (0.80 * 20 - 15.5) / (1 - 0.80) = (16.0 - 15.5) / 0.20 = 0.5 / 0.20 = 2.5
      // ceil(2.5) = 3 consecutive hours
      const metrics = computeAttendanceMetrics({
        attendedHours: 15.5,
        conductedHours: 20.0,
        targetPercent: 80,
      });

      expect(metrics.percent).toBe(78);
      expect(metrics.isEligible).toBe(false);
      expect(metrics.neededConsecutiveHours).toBe(3);
    });
  });

  describe('simulateAttendanceOutcome', () => {
    it('simulates future absences correctly', () => {
      // Currently 15 attended, 15 conducted (100%). Simulate 5 planned absences.
      const sim = simulateAttendanceOutcome({
        currentAttendedHours: 15,
        currentConductedHours: 15,
        additionalAttendedHours: 0,
        additionalMissedHours: 5,
        targetPercent: 75,
      });

      // 15 / (15 + 5) = 15 / 20 = 75%
      expect(sim.projectedPercent).toBe(75);
      expect(sim.diffPercent).toBe(-25);
      expect(sim.isEligible).toBe(true);
    });

    it('simulates future extra classes correctly', () => {
      // Currently 5 attended, 10 conducted (50%). Simulate attending 10 extra classes.
      const sim = simulateAttendanceOutcome({
        currentAttendedHours: 5,
        currentConductedHours: 10,
        additionalAttendedHours: 10,
        additionalMissedHours: 0,
        targetPercent: 75,
      });

      // (5 + 10) / (10 + 10) = 15 / 20 = 75%
      expect(sim.projectedPercent).toBe(75);
      expect(sim.diffPercent).toBe(25);
      expect(sim.isEligible).toBe(true);
    });
  });
});
