import {Override} from '../../types';
import {executeSql, rowsToArray} from '../database';

export async function createOverride(
  timetableId: number,
  date: string,
  newStartTime?: string,
  newDay?: string,
  reason: string = '',
): Promise<number> {
  const result = await executeSql(
    `INSERT INTO overrides (timetable_id, date, new_start_time, new_day, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [timetableId, date, newStartTime ?? null, newDay ?? null, reason],
  );
  return result.insertId;
}

export async function getOverridesForDate(date: string): Promise<Override[]> {
  const result = await executeSql(
    'SELECT * FROM overrides WHERE date = ?',
    [date],
  );
  return rowsToArray<Override>(result);
}

export async function deleteOverride(id: number): Promise<void> {
  await executeSql('DELETE FROM overrides WHERE id = ?', [id]);
}
