import SQLite, {SQLiteDatabase, Transaction, ResultSet} from 'react-native-sqlite-storage';
import {ALL_TABLES} from './schema';

SQLite.enablePromise(true);

let db: SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (db) {
    return db;
  }
  db = await SQLite.openDatabase({
    name: 'tracker75.db',
    location: 'default',
  });
  return db;
}

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.transaction((tx: Transaction) => {
    tx.executeSql('PRAGMA foreign_keys = ON;');
    ALL_TABLES.forEach(sql => {
      tx.executeSql(sql);
    });
  });

  // Migrations for existing installs
  try {
    await database.executeSql('ALTER TABLE subjects ADD COLUMN is_frozen INTEGER NOT NULL DEFAULT 0;');
  } catch (e) {
    // Column already exists
  }
  try {
    await database.executeSql('ALTER TABLE subjects ADD COLUMN past_attended INTEGER NOT NULL DEFAULT 0;');
  } catch (e) {
    // Column already exists
  }
  try {
    await database.executeSql('ALTER TABLE subjects ADD COLUMN past_total INTEGER NOT NULL DEFAULT 0;');
  } catch (e) {
    // Column already exists
  }
  try {
    await database.executeSql('ALTER TABLE subjects ADD COLUMN credits INTEGER NOT NULL DEFAULT 1;');
  } catch (e) {
    // Column already exists
  }
  try {
    await database.executeSql("ALTER TABLE subjects ADD COLUMN subject_type TEXT NOT NULL DEFAULT 'theory';");
  } catch (e) {
    // Column already exists
  }

  // Automatic intelligent lab classification for existing subjects
  try {
    await database.executeSql(`
      UPDATE subjects
      SET subject_type = 'lab'
      WHERE (
        LOWER(name) LIKE '%lab%' OR
        LOWER(name) LIKE '%practical%' OR
        LOWER(name) LIKE '%workshop%'
      );
    `);
  } catch (e) {
    // Already categorized
  }

  // Automatic cleanup of duplicate entries
  try {
    await database.executeSql(`
      DELETE FROM timetable
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM timetable
        GROUP BY subject_id, day_of_week, start_time, end_time
      );
    `);
    await database.executeSql(`
      DELETE FROM lecture_instances
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM lecture_instances
        GROUP BY date, subject_id, start_time
      );
    `);
  } catch (e) {
    // Deduplication complete
  }
}

export async function executeSql(
  sql: string,
  params: any[] = [],
): Promise<ResultSet> {
  const database = await getDatabase();
  const [result] = await database.executeSql(sql, params);
  return result;
}

export async function executeInTransaction(
  queries: Array<{sql: string; params?: any[]}>,
): Promise<void> {
  const database = await getDatabase();
  await database.transaction((tx: Transaction) => {
    queries.forEach(({sql, params = []}) => {
      tx.executeSql(sql, params);
    });
  });
}

export function rowsToArray<T>(result: ResultSet): T[] {
  const rows: T[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i) as T);
  }
  return rows;
}
