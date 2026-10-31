import {EditHistory, AttendanceStatus} from '../../types';
import {executeSql, rowsToArray} from '../database';

export async function appendEditHistory(
  lectureInstanceId: number,
  oldStatus: AttendanceStatus | null,
  newStatus: AttendanceStatus,
): Promise<void> {
  const now = new Date().toISOString();
  await executeSql(
    'INSERT INTO edit_history (lecture_instance_id, old_status, new_status, edited_at) VALUES (?, ?, ?, ?)',
    [lectureInstanceId, oldStatus ?? null, newStatus, now],
  );
}

export async function getEditHistoryForInstance(lectureInstanceId: number): Promise<EditHistory[]> {
  const result = await executeSql(
    'SELECT * FROM edit_history WHERE lecture_instance_id = ? ORDER BY edited_at DESC',
    [lectureInstanceId],
  );
  return rowsToArray<EditHistory>(result);
}

export async function getAllEditHistory(): Promise<EditHistory[]> {
  const result = await executeSql(
    'SELECT * FROM edit_history ORDER BY edited_at DESC',
  );
  return rowsToArray<EditHistory>(result);
}
