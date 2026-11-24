import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Version du schéma. Pour une évolution : incrémenter, puis ajouter un bloc
 * `if (version < N)` dans migrate(). Ne jamais modifier un bloc déjà publié.
 */
const DB_VERSION = 5;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version >= DB_VERSION) return;

  if (version < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        per_week INTEGER NOT NULL DEFAULT 7,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS habit_checks (
        habit_id TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (habit_id, date)
      );
      CREATE INDEX IF NOT EXISTS idx_checks_date ON habit_checks(date);

      CREATE TABLE IF NOT EXISTS recurring_rules (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        habit_id TEXT,
        type TEXT NOT NULL CHECK (type IN ('daily', 'weekdays', 'custom')),
        days TEXT NOT NULL DEFAULT '[]',
        from_date TEXT NOT NULL,
        until_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS slots (
        id TEXT PRIMARY KEY NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        title TEXT NOT NULL,
        habit_id TEXT,
        rule_id TEXT,
        done INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_slots_date ON slots(date);

      CREATE TABLE IF NOT EXISTS journal_entries (
        date TEXT PRIMARY KEY NOT NULL,
        mood INTEGER CHECK (mood BETWEEN 0 AND 4),
        energy INTEGER CHECK (energy BETWEEN 0 AND 4),
        text TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY NOT NULL,
        level TEXT NOT NULL CHECK (level IN ('annuel', 'mensuel', 'hebdo')),
        parent_id TEXT,
        title TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('habit', 'manual')),
        habit_id TEXT,
        current REAL NOT NULL DEFAULT 0,
        target REAL NOT NULL,
        unit TEXT NOT NULL DEFAULT '',
        step REAL NOT NULL DEFAULT 1,
        period_start TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS weekly_reviews (
        week_start TEXT PRIMARY KEY NOT NULL,
        good TEXT NOT NULL DEFAULT '',
        hard TEXT NOT NULL DEFAULT '',
        change TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  }

  if (version < 2) {
    // Durée des challenges : dernier jour inclus, NULL = sans limite.
    await db.execAsync('ALTER TABLE goals ADD COLUMN end_date TEXT');
  }

  if (version < 3) {
    // Sommeil : une nuit par jour de réveil.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sleep_entries (
        date TEXT PRIMARY KEY NOT NULL,
        bed_time TEXT NOT NULL,
        wake_time TEXT NOT NULL,
        quality INTEGER CHECK (quality BETWEEN 0 AND 4),
        awakenings INTEGER CHECK (awakenings >= 0),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  if (version < 4) {
    // Matin : humeur au réveil (l'entrée du journal devient celle du soir), et planning du jour validé.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS morning_entries (
        date TEXT PRIMARY KEY NOT NULL,
        mood INTEGER CHECK (mood BETWEEN 0 AND 4),
        energy INTEGER CHECK (energy BETWEEN 0 AND 4),
        note TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS day_plans (
        date TEXT PRIMARY KEY NOT NULL,
        validated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  if (version < 5) {
    // Notes rapides prises dans la journée.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS day_notes (
        id TEXT PRIMARY KEY NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS day_notes_date ON day_notes (date);
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
}
