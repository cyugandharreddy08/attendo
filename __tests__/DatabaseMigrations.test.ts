import { MIGRATIONS } from '../src/db/migrations';

describe('DatabaseMigrations', () => {
  it('has migrations defined in strictly ascending sequential order', () => {
    expect(MIGRATIONS.length).toBeGreaterThan(0);
    for (let i = 0; i < MIGRATIONS.length; i++) {
      expect(MIGRATIONS[i].version).toBe(i + 1);
      expect(typeof MIGRATIONS[i].name).toBe('string');
      expect(MIGRATIONS[i].name.length).toBeGreaterThan(0);
      expect(typeof MIGRATIONS[i].up).toBe('function');
    }
  });

  it('has no duplicate migration versions or names', () => {
    const versions = new Set<number>();
    const names = new Set<string>();

    for (const m of MIGRATIONS) {
      expect(versions.has(m.version)).toBe(false);
      expect(names.has(m.name)).toBe(false);
      versions.add(m.version);
      names.add(m.name);
    }
  });
});
