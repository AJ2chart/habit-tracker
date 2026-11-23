import { addDays } from './dates';
import { missingOccurrences } from './recurring';
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

// ——— Rappel du matin : la nuit, puis la journée à préparer ———

/** Ce qui compte comme « matin fait ». */
export type MorningCriteria = 'sleep' | 'sleep_plan';

export interface MorningSettings {
  enabled: boolean;
  time: string;
  /** Android : notification impossible à balayer tant que ce n'est pas fait */
  sticky: boolean;
  criteria: MorningCriteria;
}

export const DEFAULT_MORNING: MorningSettings = { enabled: false, time: '08:00', sticky: true, criteria: 'sleep' };

export const MORNING_CRITERIA_LABELS: Record<MorningCriteria, string> = {
  sleep: 'Nuit notée',
  sleep_plan: 'Nuit notée + un créneau prévu',
};

export function parseMorningSettings(s: Record<string, string>): MorningSettings {
  const time = /^\d{2}:\d{2}$/.test(s.morning_time ?? '') ? s.morning_time : DEFAULT_MORNING.time;
  const criteria: MorningCriteria = s.morning_criteria === 'sleep_plan' ? 'sleep_plan' : 'sleep';
  return { enabled: s.morning_enabled === '1', time, sticky: s.morning_sticky !== '0', criteria };
}

/** Créneaux du jour, y compris les tâches répétées pas encore créées (jours à venir). */
export function slotsForDay(data: Data, day: DayKey) {
  const existing = data.slots[day] ?? [];
  let n = 0;
  const virtual = missingOccurrences(day, data.rules, existing, (h) => (data.checks[day] ?? []).includes(h), () => `v${n++}`);
  return [...existing, ...virtual].sort((a, b) => a.start.localeCompare(b.start));
}

export function isMorningDone(data: Data, day: DayKey, criteria: MorningCriteria): boolean {
  if (!data.sleep[day]) return false;
  return criteria === 'sleep' || slotsForDay(data, day).length > 0;
}

/** Texte de la notification du matin : la nuit, puis l'emploi du temps du jour. */
export function morningMessage(data: Data, day: DayKey): { title: string; body: string } {
  const slots = slotsForDay(data, day);
  const plan = slots.length
    ? `${slots.length} créneau${slots.length > 1 ? 'x' : ''} aujourd'hui · 1er à ${slots[0].start} ${slots[0].title}`
    : "Rien de prévu : prends une minute pour planifier ta journée.";
  return { title: 'Bonjour ! Comment as-tu dormi ?', body: `Note ta nuit en quelques secondes. ${plan}` };
}

export function plannedMorning(data: Data, m: MorningSettings, now: Date, days = 7): { day: DayKey; at: Date }[] {
  if (!m.enabled) return [];
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const out: { day: DayKey; at: Date }[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    if (isMorningDone(data, day, m.criteria)) continue;
    const [y, mo, d] = day.split('-').map(Number);
    const at = new Date(y, mo - 1, d, Number(m.time.slice(0, 2)), Number(m.time.slice(3, 5)));
    if (at > now) out.push({ day, at });
  }
  return out;
}
