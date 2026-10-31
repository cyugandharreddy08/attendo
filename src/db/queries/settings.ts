import {executeSql, rowsToArray} from '../database';

export async function getSetting(key: string): Promise<string | null> {
  try {
    const result = await executeSql('SELECT value FROM settings WHERE key = ?', [key]);
    const rows = rowsToArray<{value: string}>(result);
    return rows.length > 0 ? rows[0].value : null;
  } catch (e) {
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await executeSql(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value],
    );
  } catch (e) {
    console.warn(`Failed to set setting ${key}:`, e);
  }
}

export async function deleteSetting(key: string): Promise<void> {
  try {
    await executeSql('DELETE FROM settings WHERE key = ?', [key]);
  } catch (e) {
    console.warn(`Failed to delete setting ${key}:`, e);
  }
}
