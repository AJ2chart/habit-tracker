import type { SQLiteDatabase } from 'expo-sqlite';

/** Tous les réglages (table clé → valeur). */
export async function loadSettings(db: SQLiteDatabase): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function saveSettings(db: SQLiteDatabase, values: Record<string, string>) {
  await db.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(values))
      await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
  });
}
