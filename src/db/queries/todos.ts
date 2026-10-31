import {TodoItem, PriorityLevel} from '../../types';
import {executeSql, rowsToArray} from '../database';

export async function getAllTodos(): Promise<TodoItem[]> {
  const result = await executeSql(`
    SELECT t.*, s.name as subject_name, s.color as subject_color, s.target_percent
    FROM todos t
    LEFT JOIN subjects s ON t.subject_id = s.id
    ORDER BY t.is_completed ASC, t.due_date ASC, t.due_time ASC
  `);

  return rowsToArray<any>(result).map(row => ({
    ...row,
    subject: row.subject_id
      ? {
          id: row.subject_id,
          name: row.subject_name,
          color: row.subject_color,
          target_percent: row.target_percent,
        }
      : undefined,
  }));
}

export async function getPendingTodos(): Promise<TodoItem[]> {
  const result = await executeSql(`
    SELECT t.*, s.name as subject_name, s.color as subject_color, s.target_percent
    FROM todos t
    LEFT JOIN subjects s ON t.subject_id = s.id
    WHERE t.is_completed = 0
    ORDER BY t.due_date ASC, t.due_time ASC
  `);

  return rowsToArray<any>(result).map(row => ({
    ...row,
    subject: row.subject_id
      ? {
          id: row.subject_id,
          name: row.subject_name,
          color: row.subject_color,
          target_percent: row.target_percent,
        }
      : undefined,
  }));
}

export async function createTodo(
  title: string,
  dueDate: string,
  dueTime: string | null = null,
  priority: PriorityLevel = 'medium',
  subjectId: number | null = null,
  alarmMinutesBefore: number = 15,
  notes: string = '',
): Promise<number> {
  const createdAt = new Date().toISOString();
  const result = await executeSql(
    `INSERT INTO todos (title, subject_id, due_date, due_time, priority, is_completed, alarm_minutes_before, notes, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [title.trim(), subjectId, dueDate, dueTime, priority, alarmMinutesBefore, notes.trim(), createdAt],
  );
  return result.insertId;
}

export async function toggleTodoCompleted(id: number, currentStatus: number): Promise<void> {
  const newStatus = currentStatus === 1 ? 0 : 1;
  await executeSql('UPDATE todos SET is_completed = ? WHERE id = ?', [newStatus, id]);
}

export async function deleteTodo(id: number): Promise<void> {
  await executeSql('DELETE FROM todos WHERE id = ?', [id]);
}
