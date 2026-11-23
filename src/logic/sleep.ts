import { addDays, mondayOf } from './dates';
import type { Data, DayKey, SleepEntry } from './types';

const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/** Durée de la nuit en minutes ; passe minuit si le lever est avant le coucher (23:30 → 07:00). */
export function sleepMinutes(bed: string, wake: string): number {
  let d = toMin(wake) - toMin(bed);
  if (d <= 0) d += 24 * 60;
  return d;
}

/** « 7 h 30 », « 6 h », « 45 min ». */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/**
 * Heure de coucher en minutes autour de minuit (21:00 → -180, 00:30 → 30),
 * pour comparer des couchers de part et d'autre de minuit.
 */
export const bedtimeOffset = (bed: string) => {
  const m = toMin(bed);
  return m >= 12 * 60 ? m - 24 * 60 : m;
};

/** Écart type des heures de coucher, en minutes : plus il est faible, plus le rythme est régulier. */
export function bedtimeSpread(entries: SleepEntry[]): number | null {
  if (entries.length < 3) return null;
  const v = entries.map((e) => bedtimeOffset(e.bed));
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.round(Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length));
}

/** Nuits de la semaine (lundi → dimanche) qui contient ce jour. */
export const weekSleep = (data: Data, day: DayKey) =>
  Array.from({ length: 7 }, (_, i) => data.sleep[addDays(mondayOf(day), i)] ?? null);

export function averageSleep(entries: (SleepEntry | null)[]) {
  const e = entries.filter((x): x is SleepEntry => !!x);
  if (!e.length) return null;
  const q = e.map((x) => x.quality).filter((x): x is NonNullable<typeof x> => x != null) as number[];
  return {
    nights: e.length,
    minutes: Math.round(e.reduce((a, x) => a + sleepMinutes(x.bed, x.wake), 0) / e.length),
    quality: q.length ? q.reduce((a, b) => a + b, 0) / q.length : null,
    spread: bedtimeSpread(e),
  };
}
