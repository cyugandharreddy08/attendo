import {
  validateAndNormalizePhone,
  validateAndNormalizeUsername,
  normalizePhoneNumber,
} from '../src/services/AuthService';

describe('AuthValidation', () => {
  describe('validateAndNormalizePhone', () => {
    it('normalizes 10-digit Indian phone numbers with +91 prefix', () => {
      const res = validateAndNormalizePhone('9876543210');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('+919876543210');
    });

    it('strips dashes, spaces, and brackets', () => {
      const res = validateAndNormalizePhone('+91 (987) 654-3210');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('+919876543210');
    });

    it('handles leading zero for 10-digit mobile', () => {
      const res = validateAndNormalizePhone('09876543210');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('+919876543210');
    });

    it('validates international phone numbers with proper country code', () => {
      const res = validateAndNormalizePhone('+14155552671');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('+14155552671');
    });

    it('rejects invalid or too short numbers', () => {
      const res = validateAndNormalizePhone('12345');
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('rejects alphanumeric strings', () => {
      const res = validateAndNormalizePhone('abcdefghij');
      expect(res.isValid).toBe(false);
    });
  });

  describe('validateAndNormalizeUsername', () => {
    it('normalizes uppercase and strips leading @', () => {
      const res = validateAndNormalizeUsername('@Alex_Dev');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('alex_dev');
    });

    it('accepts valid alphanumeric usernames with underscores', () => {
      const res = validateAndNormalizeUsername('coder_99');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('coder_99');
    });

    it('rejects usernames under 3 characters', () => {
      const res = validateAndNormalizeUsername('ab');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('at least 3 characters');
    });

    it('rejects usernames over 24 characters', () => {
      const res = validateAndNormalizeUsername('a'.repeat(25));
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('cannot exceed 24 characters');
    });

    it('rejects usernames with spaces or special characters', () => {
      const res = validateAndNormalizeUsername('cool kid!');
      expect(res.isValid).toBe(false);
    });

    it('rejects usernames starting or ending with underscore', () => {
      expect(validateAndNormalizeUsername('_user').isValid).toBe(false);
      expect(validateAndNormalizeUsername('user_').isValid).toBe(false);
    });
  });
});
