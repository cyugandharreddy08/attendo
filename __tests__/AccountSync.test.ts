import {
  generateSecurityCode,
  normalizeSecurityCode,
} from '../src/services/AccountSyncService';

describe('AccountSyncService Security Code Generator & Normalizer', () => {
  it('generates high-entropy 12-char code in format ATND-XXXX-XXXX', () => {
    const code = generateSecurityCode();
    expect(code).toMatch(/^ATND-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  });

  it('excludes ambiguous characters (0, 1, I, O) to prevent typing mistakes', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateSecurityCode();
      expect(code).not.toMatch(/[01IO]/);
    }
  });

  it('normalizes lowercase code with or without prefix and hyphens', () => {
    expect(normalizeSecurityCode('atnd-8k9l-m3qp')).toBe('ATND-8K9L-M3QP');
    expect(normalizeSecurityCode('8k9lm3qp')).toBe('ATND-8K9L-M3QP');
    expect(normalizeSecurityCode('  8K9L - M3QP  ')).toBe('ATND-8K9L-M3QP');
    expect(normalizeSecurityCode('atnd8k9lm3qp')).toBe('ATND-8K9L-M3QP');
  });

  it('handles empty or malformed strings gracefully', () => {
    expect(normalizeSecurityCode('')).toBe('');
    expect(normalizeSecurityCode('   ')).toBe('');
  });
});
