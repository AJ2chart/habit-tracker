import { addDays } from './dates';
import type { Data, DayKey } from './types';

/** Ce qui compte comme une journée « remplie ». */
export type FillCriteria = 'mood' | 'mood_note' | 'mood_note_sleep';

export interface ReminderSettings {
  enabled: boolean;
  /** Heure du premier rappel, "HH:MM" */
  time: string;
  /** Relance toutes les N minutes (0 = pas de relance) */
  repeat: number;
  /** Dernière relance possible, "HH:MM" */
  until: string;
  criteria: FillCriteria;
}

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, time: '21:00', repeat: 0, until: '23:00', criteria: 'mood' };

export const CRITERIA_LABELS: Record<FillCriteria, string> = {
  mood: 'Humeur',
  mood_note: 'Humeur + note',
  mood_note_sleep: 'Humeur + note + nuit',
};

/** Lit les réglages enregistrés (table settings, clés reminder_*). */
export function parseReminderSettings(s: Record<string, string>): ReminderSettings {
  const time = /^\d{2}:\d{2}$/.test(s.reminder_time ?? '') ? s.reminder_time : DEFAULT_REMINDER.time;
  const until = /^\d{2}:\d{2}$/.test(s.reminder_until ?? '') ? s.reminder_until : DEFAULT_REMINDER.until;
  const repeat = [0, 30, 60].includes(Number(s.reminder_repeat)) ? Number(s.reminder_repeat) : 0;
  const criteria = (['mood', 'mood_note', 'mood_note_sleep'] as const).includes(s.reminder_criteria as FillCriteria)
    ? (s.reminder_criteria as FillCriteria)
    : DEFAULT_REMINDER.criteria;
  return { enabled: s.reminder_enabled === '1', time, repeat, until, criteria };
}

export function isDayFilled(data: Data, day: DayKey, criteria: FillCriteria): boolean {
  const j = data.journal[day];
  const mood = !!j && j.mood !== null;
  if (criteria === 'mood') return mood;
  const note = mood && !!j.text.trim();
  if (criteria === 'mood_note') return note;
  return note && !!data.sleep[day];
}

const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const toHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Heures des rappels d'une journée : le premier, puis les relances jusqu'à l'heure limite incluse. */
export function reminderTimes(r: ReminderSettings): string[] {
  const start = toMin(r.time);
  if (!r.repeat) return [r.time];
  const end = Math.max(start, toMin(r.until));
  const out: string[] = [];
  for (let m = start; m <= end && m < 24 * 60; m += r.repeat) out.push(toHM(m));
  return out;
}

/**
 * Rappels à programmer sur les `days` prochains jours, à partir de `now` :
 * aucun pour un jour déjà rempli, aucun dans le passé.
 */
export function plannedReminders(data: Data, r: ReminderSettings, now: Date, days = 7): { day: DayKey; at: Date }[] {
  if (!r.enabled) return [];
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const out: { day: DayKey; at: Date }[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    if (isDayFilled(data, day, r.criteria)) continue;
    const [y, mo, d] = day.split('-').map(Number);
    for (const t of reminderTimes(r)) {
      const at = new Date(y, mo - 1, d, Number(t.slice(0, 2)), Number(t.slice(3, 5)));
      if (at > now) out.push({ day, at });
    }
  }
  return out;
}
