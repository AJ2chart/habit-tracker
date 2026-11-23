import type { SQLiteDatabase } from 'expo-sqlite';

/** Tables sauvegardées, dans l'ordre de restauration. */
export const BACKUP_TABLES = [
  'habits',
  'habit_checks',
  'recurring_rules',
  'slots',
  'journal_entries',
  'goals',
  'weekly_reviews',
  'settings',
] as const;

export interface Dump {
  app: 'habit-tracker';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

/** Copie complète des données, prête à être chiffrée. */
export async function dumpDatabase(db: SQLiteDatabase): Promise<Dump> {
  const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const tables: Dump['tables'] = {};
  for (const t of BACKUP_TABLES) tables[t] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}`);
  return { app: 'habit-tracker', schemaVersion: v?.user_version ?? 0, exportedAt: new Date().toISOString(), tables };
}

export function summarize(dump: Dump) {
  const n = (t: string) => dump.tables[t]?.length ?? 0;
  return { days: n('journal_entries'), habits: n('habits'), slots: n('slots'), goals: n('goals') };
}

/**
 * Remplace toutes les données par celles de la sauvegarde, en une seule transaction :
 * en cas d'erreur, rien n'est modifié. Seules les colonnes connues de la base actuelle
 * sont reprises, pour accepter les sauvegardes d'une version plus ancienne.
 */
export async function restoreDatabase(db: SQLiteDatabase, dump: Dump) {
  if (dump?.app !== 'habit-tracker' || typeof dump.tables !== 'object') throw new Error('Contenu de sauvegarde invalide.');
  const current = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (dump.schemaVersion > (current?.user_version ?? 0))
    throw new Error("Cette sauvegarde vient d'une version plus récente de l'appli. Mets l'appli à jour avant de la restaurer.");

  await db.withTransactionAsync(async () => {
    for (const t of BACKUP_TABLES) {
      const cols = (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
      await db.runAsync(`DELETE FROM ${t}`);
      for (const row of dump.tables[t] ?? []) {
        const keys = Object.keys(row).filter((k) => cols.includes(k));
        if (!keys.length) continue;
        await db.runAsync(
          `INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          ...keys.map((k) => row[k] as string | number | null),
        );
      }
    }
  });
}
