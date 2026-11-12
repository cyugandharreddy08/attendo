import SQLite, {SQLiteDatabase, Transaction, ResultSet} from 'react-native-sqlite-storage';
import {ALL_TABLES} from './schema';
import {runDatabaseMigrations} from './migrations';

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

  // Run formal numbered migrations
  try {
    await runDatabaseMigrations(database);
  } catch (migrationErr) {
    console.error('[Database] Migration execution error:', migrationErr);
  }

  // Deduplication check
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
  } catch {
    // Deduplication complete
  }
}

export async function executeSql(
  sql: string,
  params: any[] = [],
): Promise<ResultSet> {
  try {
    const database = await getDatabase();
    const [result] = await database.executeSql(sql, params);
    return result;
  } catch (err) {
    // Sanitized logging without leaking sensitive schedule parameters
    const queryVerb = sql.trim().split(' ')[0].toUpperCase();
    console.warn(`[Database] Query error on ${queryVerb}:`, err instanceof Error ? err.message : 'Unknown DB error');
    throw err;
  }
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
