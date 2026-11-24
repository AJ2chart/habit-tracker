import type { SQLiteDatabase } from 'expo-sqlite';

import { addDays, isChecked, missingOccurrences, type Data, type DayKey, type Energy, type Goal, type Mood, type RecurringRule } from '@/logic';

import { newId } from './repo';

/** Coche ou décoche une habitude ce jour-là ; les créneaux liés suivent. */
export async function setHabitChecked(db: SQLiteDatabase, date: DayKey, habitId: string, on: boolean) {
  await db.withTransactionAsync(async () => {
    if (on) await db.runAsync('INSERT OR IGNORE INTO habit_checks (habit_id, date) VALUES (?, ?)', habitId, date);
    else await db.runAsync('DELETE FROM habit_checks WHERE habit_id = ? AND date = ?', habitId, date);
    await db.runAsync(
      "UPDATE slots SET done = ?, updated_at = datetime('now') WHERE date = ? AND habit_id = ?",
      on ? 1 : 0,
      date,
      habitId,
    );
  });
}

/** Coche ou décoche un créneau ; s'il est lié à une habitude, l'habitude suit. */
export async function setSlotDone(
  db: SQLiteDatabase,
  slot: { id: string; date: DayKey; habitId: string | null },
  done: boolean,
) {
  if (slot.habitId) return setHabitChecked(db, slot.date, slot.habitId, done);
  await db.runAsync("UPDATE slots SET done = ?, updated_at = datetime('now') WHERE id = ?", done ? 1 : 0, slot.id);
}

export async function addSlot(
  db: SQLiteDatabase,
  s: { date: DayKey; start: string; end: string; title: string; habitId: string | null },
  data: Data,
) {
  const done = s.habitId ? isChecked(data, s.date, s.habitId) : false;
  await db.runAsync(
    'INSERT INTO slots (id, date, start_time, end_time, title, habit_id, rule_id, done) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)',
    newId(),
    s.date,
    s.start,
    s.end,
    s.title,
    s.habitId,
    done ? 1 : 0,
  );
}

export async function addRule(db: SQLiteDatabase, r: Omit<RecurringRule, 'id'>) {
  await db.runAsync(
    'INSERT INTO recurring_rules (id, title, start_time, end_time, habit_id, type, days, from_date, until_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    newId(),
    r.title,
    r.start,
    r.end,
    r.habitId,
    r.type,
    JSON.stringify(r.days),
    r.from,
    r.until ?? null,
  );
}

/** Crée les occurrences des tâches répétées qui manquent pour ce jour. Renvoie le nombre créé. */
export async function ensureOccurrences(db: SQLiteDatabase, data: Data, day: DayKey): Promise<number> {
  const missing = missingOccurrences(day, data.rules, data.slots[day] ?? [], (h) => isChecked(data, day, h), newId);
  if (!missing.length) return 0;
  await db.withTransactionAsync(async () => {
    for (const s of missing)
      await db.runAsync(
        'INSERT INTO slots (id, date, start_time, end_time, title, habit_id, rule_id, done) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        s.id,
        s.date,
        s.start,
        s.end,
        s.title,
        s.habitId,
        s.ruleId,
        s.done ? 1 : 0,
      );
  });
  return missing.length;
}

export async function saveSlotNote(db: SQLiteDatabase, slotId: string, note: string) {
  await db.runAsync("UPDATE slots SET note = ?, updated_at = datetime('now') WHERE id = ?", note, slotId);
}

export async function deleteSlot(db: SQLiteDatabase, slotId: string) {
  await db.runAsync('DELETE FROM slots WHERE id = ?', slotId);
}

export async function saveJournal(
  db: SQLiteDatabase,
  date: DayKey,
  entry: { mood: Mood | null; energy: Energy | null; text: string },
) {
  await db.runAsync(
    `INSERT INTO journal_entries (date, mood, energy, text) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET mood = excluded.mood, energy = excluded.energy, text = excluded.text, updated_at = datetime('now')`,
    date,
    entry.mood,
    entry.energy,
    entry.text,
  );
}

export async function addHabit(db: SQLiteDatabase, name: string, perWeek: number) {
  await db.runAsync('INSERT INTO habits (id, name, per_week) VALUES (?, ?, ?)', newId(), name, perWeek);
}

// ——— Habitudes ———

export async function updateHabit(db: SQLiteDatabase, id: string, name: string, perWeek: number) {
  await db.runAsync("UPDATE habits SET name = ?, per_week = ?, updated_at = datetime('now') WHERE id = ?", name, perWeek, id);
}

/** Archive une habitude : elle disparaît des écrans, son historique reste. */
export async function archiveHabit(db: SQLiteDatabase, id: string) {
  await db.runAsync("UPDATE habits SET archived = 1, updated_at = datetime('now') WHERE id = ?", id);
}

// ——— Tâches répétées ———

/** Supprime les occurrences futures non faites et sans description, pour qu'elles soient recréées ou abandonnées. */
async function clearFutureOccurrences(db: SQLiteDatabase, ruleId: string, fromDay: DayKey) {
  await db.runAsync("DELETE FROM slots WHERE rule_id = ? AND date >= ? AND done = 0 AND note = ''", ruleId, fromDay);
}

/** Modifie une tâche répétée à partir d'aujourd'hui ; le passé reste tel quel. */
export async function updateRule(db: SQLiteDatabase, id: string, r: Omit<RecurringRule, 'id' | 'from' | 'until'>, today: DayKey) {
  await db.withTransactionAsync(async () => {
    await clearFutureOccurrences(db, id, today);
    await db.runAsync(
      "UPDATE recurring_rules SET title = ?, start_time = ?, end_time = ?, habit_id = ?, type = ?, days = ?, updated_at = datetime('now') WHERE id = ?",
      r.title,
      r.start,
      r.end,
      r.habitId,
      r.type,
      JSON.stringify(r.days),
      id,
    );
  });
}

/** Arrête une tâche répétée à partir d'aujourd'hui ; l'historique reste. */
export async function stopRule(db: SQLiteDatabase, id: string, today: DayKey) {
  await db.withTransactionAsync(async () => {
    await clearFutureOccurrences(db, id, today);
    await db.runAsync("UPDATE recurring_rules SET until_date = ?, updated_at = datetime('now') WHERE id = ?", addDays(today, -1), id);
  });
}

// ——— Objectifs ———

export async function addGoal(db: SQLiteDatabase, g: Omit<Goal, 'id'>) {
  await db.runAsync(
    'INSERT INTO goals (id, level, parent_id, title, kind, habit_id, current, target, unit, step, period_start, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    newId(),
    g.level,
    g.parentId,
    g.title,
    g.kind,
    g.kind === 'habit' ? g.habitId ?? null : null,
    g.current ?? 0,
    g.target,
    g.unit ?? '',
    g.step ?? 1,
    g.periodStart,
    g.kind === 'habit' ? g.endDate ?? null : null,
  );
}

export async function updateGoal(
  db: SQLiteDatabase,
  id: string,
  g: { title: string; target: number; current?: number; unit?: string; step?: number; parentId: string | null },
) {
  await db.runAsync(
    "UPDATE goals SET title = ?, target = ?, current = COALESCE(?, current), unit = COALESCE(?, unit), step = COALESCE(?, step), parent_id = ?, updated_at = datetime('now') WHERE id = ?",
    g.title,
    g.target,
    g.current ?? null,
    g.unit ?? null,
    g.step ?? null,
    g.parentId,
    id,
  );
}

/** Ajoute le pas de l'objectif manuel, sans dépasser la cible. */
export async function incrementGoal(db: SQLiteDatabase, id: string) {
  await db.runAsync("UPDATE goals SET current = MIN(target, current + step), updated_at = datetime('now') WHERE id = ?", id);
}

/** Archive un objectif et détache ses sous-objectifs. */
export async function archiveGoal(db: SQLiteDatabase, id: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE goals SET archived = 1, updated_at = datetime('now') WHERE id = ?", id);
    await db.runAsync("UPDATE goals SET parent_id = NULL, updated_at = datetime('now') WHERE parent_id = ?", id);
  });
}

// ——— Revue de la semaine ———

export async function saveReview(db: SQLiteDatabase, weekStart: DayKey, r: { good: string; hard: string; change: string }) {
  await db.runAsync(
    `INSERT INTO weekly_reviews (week_start, good, hard, change) VALUES (?, ?, ?, ?)
     ON CONFLICT(week_start) DO UPDATE SET good = excluded.good, hard = excluded.hard, change = excluded.change, updated_at = datetime('now')`,
    weekStart,
    r.good,
    r.hard,
    r.change,
  );
}

// ——— Sommeil ———

export async function saveSleep(
  db: SQLiteDatabase,
  n: { date: DayKey; bed: string; wake: string; quality: number | null; awakenings: number | null },
) {
  await db.runAsync(
    `INSERT INTO sleep_entries (date, bed_time, wake_time, quality, awakenings) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET bed_time = excluded.bed_time, wake_time = excluded.wake_time, quality = excluded.quality,
       awakenings = excluded.awakenings, updated_at = datetime('now')`,
    n.date,
    n.bed,
    n.wake,
    n.quality,
    n.awakenings,
  );
}

export async function deleteSleep(db: SQLiteDatabase, date: DayKey) {
  await db.runAsync('DELETE FROM sleep_entries WHERE date = ?', date);
}

// ——— Matin ———

export async function saveMorning(db: SQLiteDatabase, date: DayKey, e: { mood: Mood | null; energy: Energy | null; note: string }) {
  await db.runAsync(
    `INSERT INTO morning_entries (date, mood, energy, note) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET mood = excluded.mood, energy = excluded.energy, note = excluded.note, updated_at = datetime('now')`,
    date,
    e.mood,
    e.energy,
    e.note,
  );
}

/** Valide (ou dé-valide) le planning du jour. */
export async function setPlanValidated(db: SQLiteDatabase, date: DayKey, on: boolean) {
  if (on) await db.runAsync("INSERT OR REPLACE INTO day_plans (date, validated_at) VALUES (?, datetime('now', 'localtime'))", date);
  else await db.runAsync('DELETE FROM day_plans WHERE date = ?', date);
}
