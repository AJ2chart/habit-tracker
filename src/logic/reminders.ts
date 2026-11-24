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

// ——— Rappel du matin : une routine à cocher, configurable ———

/** Étapes possibles de la routine du matin (en plus des habitudes choisies). */
export type MorningStep = 'sleep' | 'plan' | 'journal';

export interface MorningSettings {
  enabled: boolean;
  time: string;
  /** Android : notification impossible à balayer tant que ce n'est pas fait */
  sticky: boolean;
  /** Étapes qui comptent pour « matin fait » */
  steps: MorningStep[];
  /** Habitudes de la routine du matin, à cocher ce jour-là */
  habits: string[];
}

export const DEFAULT_MORNING: MorningSettings = { enabled: false, time: '08:00', sticky: true, steps: ['sleep'], habits: [] };

export const MORNING_STEP_LABELS: Record<MorningStep, string> = {
  sleep: 'Nuit notée',
  plan: 'Planning validé',
  journal: 'Humeur du matin',
};

const ALL_STEPS: MorningStep[] = ['sleep', 'plan', 'journal'];

export function parseMorningSettings(s: Record<string, string>): MorningSettings {
  const time = /^\d{2}:\d{2}$/.test(s.morning_time ?? '') ? s.morning_time : DEFAULT_MORNING.time;
  let steps: MorningStep[] = DEFAULT_MORNING.steps;
  let habits: string[] = [];
  try {
    if (s.morning_steps) {
      const parsed = JSON.parse(s.morning_steps) as { steps?: unknown; habits?: unknown };
      if (Array.isArray(parsed.steps)) steps = ALL_STEPS.filter((x) => (parsed.steps as unknown[]).includes(x));
      if (Array.isArray(parsed.habits)) habits = parsed.habits.filter((x): x is string => typeof x === 'string');
    } else if (s.morning_criteria === 'sleep_plan') {
      // Ancien réglage « nuit notée + un créneau prévu ».
      steps = ['sleep', 'plan'];
    }
  } catch {
    // réglage illisible : valeurs par défaut
  }
  return { enabled: s.morning_enabled === '1', time, sticky: s.morning_sticky !== '0', steps, habits };
}

/** Réglages à enregistrer (table settings). */
export const serializeMorningSettings = (m: MorningSettings): Record<string, string> => ({
  morning_enabled: m.enabled ? '1' : '0',
  morning_time: m.time,
  morning_sticky: m.sticky ? '1' : '0',
  morning_steps: JSON.stringify({ steps: m.steps, habits: m.habits }),
});

/** Créneaux du jour, y compris les tâches répétées pas encore créées (jours à venir). */
export function slotsForDay(data: Data, day: DayKey) {
  const existing = data.slots[day] ?? [];
  let n = 0;
  const virtual = missingOccurrences(day, data.rules, existing, (h) => (data.checks[day] ?? []).includes(h), () => `v${n++}`);
  return [...existing, ...virtual].sort((a, b) => a.start.localeCompare(b.start));
}

/** Une étape de la routine du matin, faite ou non ce jour-là. */
export interface MorningItem {
  key: string;
  label: string;
  done: boolean;
  /** Habitude à cocher, pour les étapes « habitude » */
  habitId?: string;
}

/** Liste des étapes de la routine, dans l'ordre : nuit, planning, humeur, puis habitudes. */
export function morningChecklist(data: Data, day: DayKey, m: MorningSettings): MorningItem[] {
  const items: MorningItem[] = [];
  if (m.steps.includes('sleep')) items.push({ key: 'sleep', label: MORNING_STEP_LABELS.sleep, done: !!data.sleep[day] });
  if (m.steps.includes('plan')) items.push({ key: 'plan', label: MORNING_STEP_LABELS.plan, done: !!data.plans[day] });
  if (m.steps.includes('journal')) items.push({ key: 'journal', label: MORNING_STEP_LABELS.journal, done: data.morning[day]?.mood != null });
  for (const id of m.habits) {
    const h = data.habits.find((x) => x.id === id && !x.archived);
    if (h) items.push({ key: `habit-${h.id}`, label: h.name, done: (data.checks[day] ?? []).includes(h.id), habitId: h.id });
  }
  return items;
}

/** Matin fait : toutes les étapes choisies sont faites (aucune étape = rien à rappeler). */
export function isMorningDone(data: Data, day: DayKey, m: MorningSettings): boolean {
  return morningChecklist(data, day, m).every((i) => i.done);
}

/** Texte de la notification du matin : ce qui reste à faire, puis le premier créneau du jour. */
export function morningMessage(data: Data, day: DayKey, m: MorningSettings): { title: string; body: string } {
  const left = morningChecklist(data, day, m).filter((i) => !i.done);
  const slots = slotsForDay(data, day);
  const plan = slots.length ? ` · 1er créneau à ${slots[0].start} ${slots[0].title}` : '';
  const todo = left.length ? `À faire : ${left.map((i) => i.label.charAt(0).toLowerCase() + i.label.slice(1)).join(', ')}.` : '';
  return { title: 'Bonjour ! Ta routine du matin', body: `${todo}${plan}`.trim() || 'Prends une minute pour préparer ta journée.' };
}

export function plannedMorning(data: Data, m: MorningSettings, now: Date, days = 7): { day: DayKey; at: Date }[] {
  if (!m.enabled) return [];
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const out: { day: DayKey; at: Date }[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    if (isMorningDone(data, day, m)) continue;
    const [y, mo, d] = day.split('-').map(Number);
    const at = new Date(y, mo - 1, d, Number(m.time.slice(0, 2)), Number(m.time.slice(3, 5)));
    if (at > now) out.push({ day, at });
  }
  return out;
}
