import {SQLiteDatabase, Transaction} from 'react-native-sqlite-storage';

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => Promise<void>;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'add_subject_columns_and_defaults',
    up: async (db: SQLiteDatabase) => {
      const addColumnSafely = async (sql: string) => {
        try {
          await db.executeSql(sql);
        } catch {
          // Column already exists or already applied
        }
      };

      await addColumnSafely('ALTER TABLE subjects ADD COLUMN is_frozen INTEGER NOT NULL DEFAULT 0;');
      await addColumnSafely('ALTER TABLE subjects ADD COLUMN past_attended INTEGER NOT NULL DEFAULT 0;');
      await addColumnSafely('ALTER TABLE subjects ADD COLUMN past_total INTEGER NOT NULL DEFAULT 0;');
      await addColumnSafely('ALTER TABLE subjects ADD COLUMN credits INTEGER NOT NULL DEFAULT 1;');
      await addColumnSafely("ALTER TABLE subjects ADD COLUMN subject_type TEXT NOT NULL DEFAULT 'theory';");
    },
  },
  {
    version: 2,
    name: 'auto_classify_lab_subjects',
    up: async (db: SQLiteDatabase) => {
      try {
        await db.executeSql(`
          UPDATE subjects
          SET subject_type = 'lab'
          WHERE subject_type = 'theory' AND (
            LOWER(name) LIKE '%lab%' OR
            LOWER(name) LIKE '%practical%' OR
            LOWER(name) LIKE '%workshop%'
          );
        `);
      } catch {
        // Table or columns safe
      }
    },
  },
  {
    version: 3,
    name: 'add_performance_indexes',
    up: async (db: SQLiteDatabase) => {
      const createIndexSafely = async (sql: string) => {
        try {
          await db.executeSql(sql);
        } catch (e) {
          console.warn('[Migration 3] Index creation warning:', e);
        }
      };

      await createIndexSafely('CREATE INDEX IF NOT EXISTS idx_instances_date_subj ON lecture_instances(date, subject_id, status);');
      await createIndexSafely('CREATE INDEX IF NOT EXISTS idx_instances_subj ON lecture_instances(subject_id);');
      await createIndexSafely('CREATE INDEX IF NOT EXISTS idx_timetable_subj_day ON timetable(subject_id, day_of_week);');
      await createIndexSafely('CREATE INDEX IF NOT EXISTS idx_overrides_date ON overrides(date);');
      await createIndexSafely('CREATE INDEX IF NOT EXISTS idx_edit_history_inst ON edit_history(lecture_instance_id);');
      await createIndexSafely('CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_date, is_completed);');
    },
  },
  {
    version: 4,
    name: 'harden_local_bugs_table',
    up: async (db: SQLiteDatabase) => {
      try {
        await db.executeSql('ALTER TABLE local_bugs ADD COLUMN uuid TEXT;');
      } catch {
        // Column may already exist
      }
      try {
        await db.executeSql('CREATE INDEX IF NOT EXISTS idx_local_bugs_sync ON local_bugs(is_synced);');
      } catch {
        // Index safe
      }
    },
  },
];

/**
 * Executes pending numbered migrations in sequence.
 * Tracks applied migrations in the schema_migrations table.
 */
export async function runDatabaseMigrations(db: SQLiteDatabase): Promise<void> {
  // 1. Ensure schema_migrations table exists
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  // 2. Fetch already applied versions
  const [result] = await db.executeSql('SELECT version FROM schema_migrations ORDER BY version ASC;');
  const appliedVersions = new Set<number>();
  for (let i = 0; i < result.rows.length; i++) {
    appliedVersions.add(result.rows.item(i).version);
  }

  // 3. Apply missing migrations in strict ascending order
  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`[Database Migration] Running migration ${migration.version}: ${migration.name}`);
      await migration.up(db);
      const now = new Date().toISOString();
      await db.executeSql(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
        [migration.version, migration.name, now],
      );
      console.log(`[Database Migration] Applied migration ${migration.version}: ${migration.name}`);
    }
  }
}
