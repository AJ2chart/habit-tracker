import type { DayKey } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

export const toKey = (d: Date): DayKey =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (k: DayKey): Date => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (k: DayKey, n: number): DayKey => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

/** 0 = dimanche … 6 = samedi */
export const weekday = (k: DayKey): number => fromKey(k).getDay();

/** Lundi de la semaine qui contient ce jour. */
export const mondayOf = (k: DayKey): DayKey => addDays(k, -((weekday(k) + 6) % 7));

export const monthStart = (k: DayKey): DayKey => k.slice(0, 7) + "-01";
export const monthEnd = (k: DayKey): DayKey => {
  const d = fromKey(monthStart(k));
  return toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};
export const yearStart = (k: DayKey): DayKey => k.slice(0, 4) + "-01-01";
export const yearEnd = (k: DayKey): DayKey => k.slice(0, 4) + "-12-31";

/** Même jour l'année précédente (le 29 février devient le 28). */
export const sameDayLastYear = (k: DayKey): DayKey => {
  const [y, m, d] = k.split("-").map(Number);
  const last = new Date(y - 1, m, 0).getDate();
  return `${y - 1}-${pad(m)}-${pad(Math.min(d, last))}`;
};

/** Tous les jours de a à b inclus. */
export const range = (a: DayKey, b: DayKey): DayKey[] => {
  const out: DayKey[] = [];
  for (let k = a; k <= b; k = addDays(k, 1)) out.push(k);
  return out;
};

/** « 1 jour », « 3 jours », « 0 jour » (en français, 0 et 1 s'accordent au singulier). */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${Math.abs(n) >= 2 ? many : one}`;
