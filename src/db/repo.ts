import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  Data,
  Energy,
  Goal,
  Habit,
  JournalEntry,
  Mood,
  MorningEntry,
  DayNote,
  RecurringRule,
  SleepEntry,
  Slot,
  WeeklyReview,
} from '@/logic';

/** Identifiant unique, sans dépendance native. */
export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

type HabitRow = { id: string; name: string; per_week: number; archived: number };
type CheckRow = { habit_id: string; date: string };
type RuleRow = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  habit_id: string | null;
  type: RecurringRule['type'];
  days: string;
  from_date: string;
  until_date: string | null;
};
type SlotRow = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  habit_id: string | null;
  rule_id: string | null;
  done: number;
  note: string;
};
type JournalRow = { date: string; mood: number | null; energy: number | null; text: string };
type GoalRow = {
  id: string;
  level: Goal['level'];
  parent_id: string | null;
  title: string;
  kind: Goal['kind'];
  habit_id: string | null;
  current: number;
  target: number;
  unit: string;
  step: number;
  period_start: string;
  end_date: string | null;
};
type SleepRow = { date: string; bed_time: string; wake_time: string; quality: number | null; awakenings: number | null };
type MorningRow = { date: string; mood: number | null; energy: number | null; note: string };
type NoteRow = { id: string; date: string; time: string; text: string };
type PlanRow = { date: string; validated_at: string };
type ReviewRow = { week_start: string; good: string; hard: string; change: string };

/** Charge toutes les données nécessaires aux calculs. */
export async function loadData(db: SQLiteDatabase): Promise<Data> {
  const [habits, checks, rules, slots, journal, goals, reviews, sleep, morning, plans, notes] = await Promise.all([
    db.getAllAsync<HabitRow>('SELECT id, name, per_week, archived FROM habits ORDER BY created_at'),
    db.getAllAsync<CheckRow>('SELECT habit_id, date FROM habit_checks'),
    db.getAllAsync<RuleRow>('SELECT * FROM recurring_rules'),
    db.getAllAsync<SlotRow>('SELECT * FROM slots ORDER BY date, start_time'),
    db.getAllAsync<JournalRow>('SELECT date, mood, energy, text FROM journal_entries'),
    db.getAllAsync<GoalRow>('SELECT * FROM goals WHERE archived = 0 ORDER BY created_at'),
    db.getAllAsync<ReviewRow>('SELECT week_start, good, hard, change FROM weekly_reviews'),
    db.getAllAsync<SleepRow>('SELECT date, bed_time, wake_time, quality, awakenings FROM sleep_entries'),
    db.getAllAsync<MorningRow>('SELECT date, mood, energy, note FROM morning_entries'),
    db.getAllAsync<PlanRow>('SELECT date, validated_at FROM day_plans'),
    db.getAllAsync<NoteRow>('SELECT id, date, time, text FROM day_notes ORDER BY date, time, created_at'),
  ]);

  const data: Data = { habits: [], checks: {}, rules: [], slots: {}, journal: {}, goals: [], reviews: {}, sleep: {}, morning: {}, plans: {}, notes: {} };

  data.habits = habits.map(
    (h): Habit => ({ id: h.id, name: h.name, perWeek: h.per_week, archived: h.archived === 1 }),
  );
  for (const c of checks) (data.checks[c.date] ??= []).push(c.habit_id);
  data.rules = rules.map(
    (r): RecurringRule => ({
      id: r.id,
      title: r.title,
      start: r.start_time,
      end: r.end_time,
      habitId: r.habit_id,
      type: r.type,
      days: JSON.parse(r.days) as number[],
      from: r.from_date,
      until: r.until_date,
    }),
  );
  for (const s of slots)
    (data.slots[s.date] ??= []).push({
      id: s.id,
      date: s.date,
      start: s.start_time,
      end: s.end_time,
      title: s.title,
      habitId: s.habit_id,
      ruleId: s.rule_id,
      done: s.done === 1,
      note: s.note,
    } satisfies Slot);
  for (const j of journal)
    data.journal[j.date] = {
      date: j.date,
      mood: j.mood as Mood | null,
      energy: j.energy as Energy | null,
      text: j.text,
    } satisfies JournalEntry;
  data.goals = goals.map(
    (g): Goal => ({
      id: g.id,
      level: g.level,
      parentId: g.parent_id,
      title: g.title,
      kind: g.kind,
      habitId: g.habit_id,
      current: g.current,
      target: g.target,
      unit: g.unit,
      step: g.step,
      periodStart: g.period_start,
      endDate: g.end_date,
    }),
  );
  for (const r of reviews)
    data.reviews[r.week_start] = {
      weekStart: r.week_start,
      good: r.good,
      hard: r.hard,
      change: r.change,
    } satisfies WeeklyReview;

  for (const n of sleep)
    data.sleep[n.date] = {
      date: n.date,
      bed: n.bed_time,
      wake: n.wake_time,
      quality: n.quality as SleepEntry['quality'],
      awakenings: n.awakenings,
    };

  for (const m of morning)
    data.morning[m.date] = { date: m.date, mood: m.mood as Mood | null, energy: m.energy as Energy | null, note: m.note } satisfies MorningEntry;
  for (const p of plans) data.plans[p.date] = p.validated_at;
  for (const n of notes) (data.notes[n.date] ??= []).push(n satisfies DayNote);

  return data;
}
