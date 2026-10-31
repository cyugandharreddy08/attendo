import {Subject} from '../../types';
import {executeSql, rowsToArray} from '../database';
import {Colors} from '../../theme/colors';

export async function getAllSubjects(): Promise<Subject[]> {
  const result = await executeSql(
    'SELECT * FROM subjects ORDER BY is_frozen ASC, name ASC',
  );
  return rowsToArray<Subject>(result);
}

export async function getActiveSubjects(): Promise<Subject[]> {
  const result = await executeSql(
    'SELECT * FROM subjects WHERE is_frozen = 0 ORDER BY name ASC',
  );
  return rowsToArray<Subject>(result);
}

export async function getSubjectById(id: number): Promise<Subject | null> {
  const result = await executeSql(
    'SELECT * FROM subjects WHERE id = ?',
    [id],
  );
  const rows = rowsToArray<Subject>(result);
  return rows[0] ?? null;
}

export async function createSubject(
  name: string,
  color?: string,
  targetPercent: number = 75,
  subjectType: 'theory' | 'lab' = 'theory',
  pastAttended: number = 0,
  pastTotal: number = 0,
  credits: number = 1,
): Promise<number> {
  const subjectColor = color ?? Colors.subjectColors[Math.floor(Math.random() * Colors.subjectColors.length)];
  const result = await executeSql(
    'INSERT INTO subjects (name, color, target_percent, subject_type, is_frozen, past_attended, past_total, credits) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
    [name.trim(), subjectColor, targetPercent, subjectType, pastAttended, pastTotal, credits],
  );
  return result.insertId;
}

export async function updateSubject(
  id: number,
  name: string,
  color: string,
  targetPercent: number,
  subjectType: 'theory' | 'lab' = 'theory',
  pastAttended: number = 0,
  pastTotal: number = 0,
  isFrozen: number = 0,
  credits: number = 1,
): Promise<void> {
  await executeSql(
    'UPDATE subjects SET name = ?, color = ?, target_percent = ?, subject_type = ?, past_attended = ?, past_total = ?, is_frozen = ?, credits = ? WHERE id = ?',
    [name.trim(), color, targetPercent, subjectType, pastAttended, pastTotal, isFrozen, credits, id],
  );
}

export async function toggleSubjectFreeze(id: number, currentFrozen: number): Promise<void> {
  const newFrozen = currentFrozen === 1 ? 0 : 1;
  await executeSql('UPDATE subjects SET is_frozen = ? WHERE id = ?', [newFrozen, id]);
}

export async function deleteSubject(id: number): Promise<void> {
  await executeSql('DELETE FROM subjects WHERE id = ?', [id]);
}

export async function getSubjectColorIndex(subjectId: number): Promise<string> {
  const subject = await getSubjectById(subjectId);
  return subject?.color ?? Colors.subjectColors[0];
}
