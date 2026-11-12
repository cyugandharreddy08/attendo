import {
  computePayloadChecksum,
  validateBackupPayload,
} from '../src/services/CloudBackupService';

describe('CloudBackupService', () => {
  describe('computePayloadChecksum', () => {
    it('produces a deterministic hexadecimal checksum', () => {
      const data = {
        subjects: [{ id: 1, name: 'Math' }],
        timetable: [{ id: 1, subject_id: 1 }],
        instances: [{ id: 1, subject_id: 1, date: '2026-11-13' }],
        overrides: [],
        todos: [],
      };

      const checksum1 = computePayloadChecksum(data);
      const checksum2 = computePayloadChecksum(data);

      expect(checksum1).toBe(checksum2);
      expect(checksum1).toMatch(/^[0-9a-f]{8}$/);
    });

    it('produces different checksums when payload lengths change', () => {
      const data1 = {
        subjects: [{ id: 1, name: 'Math' }],
        timetable: [],
        instances: [],
        overrides: [],
        todos: [],
      };
      const data2 = {
        subjects: [{ id: 1, name: 'Math' }, { id: 2, name: 'Physics' }],
        timetable: [],
        instances: [],
        overrides: [],
        todos: [],
      };

      expect(computePayloadChecksum(data1)).not.toBe(computePayloadChecksum(data2));
    });
  });

  describe('validateBackupPayload', () => {
    it('validates a correct payload structure', () => {
      const validPayload = {
        schema_version: 2,
        app_version: '8.0.0',
        exported_at: new Date().toISOString(),
        checksum: '1234abcd',
        subjects: [
          {
            id: 1,
            name: 'Mathematics',
            color: '#7C3AED',
            target_percent: 75,
            subject_type: 'theory',
            is_frozen: 0,
            past_attended: 0,
            past_total: 0,
            credits: 3,
          },
        ],
        timetable: [],
        instances: [],
        overrides: [],
        todos: [],
      };

      const res = validateBackupPayload(validPayload);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects null or non-object payloads', () => {
      expect(validateBackupPayload(null).isValid).toBe(false);
      expect(validateBackupPayload('string').isValid).toBe(false);
    });

    it('rejects payloads missing schema_version', () => {
      const res = validateBackupPayload({
        subjects: [],
        timetable: [],
        instances: [],
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('schema version');
    });

    it('rejects payloads missing required tables', () => {
      const res = validateBackupPayload({
        schema_version: 2,
        subjects: 'not-an-array',
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('subjects');
    });

    it('rejects subjects with missing or empty name', () => {
      const res = validateBackupPayload({
        schema_version: 2,
        subjects: [{ id: 1, name: '' }],
        timetable: [],
        instances: [],
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('name');
    });
  });
});
