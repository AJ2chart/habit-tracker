import { addDays, weekday } from "./dates";
import { isChecked } from "./habits";
import { tagsOf } from "./search";
import type { Data, DayKey, JournalEntry } from "./types";

export const isBadDay = (j?: JournalEntry) => !!j && j.mood !== null && j.mood <= 1;
export const isGoodDay = (j?: JournalEntry) => !!j && j.mood !== null && j.mood >= 3;

export interface HabitGap {
  habitId: string;
  name: string;
  /** % des jours difficiles où l'habitude est faite */
  bad: number;
  /** % des bons jours où l'habitude est faite */
  good: number;
}

export interface Insights {
  badDays: number;
  goodDays: number;
  habits: HabitGap[];
  slots: { bad: number; good: number } | null;
  energy: { bad: number; good: number } | null;
  /** Taux de jours difficiles par jour de la semaine, lundi en premier */
  weekdays: { weekday: number; total: number; bad: number }[];
  hardestWeekday: { weekday: number; total: number; bad: number } | null;
  badTags: { tag: string; count: number }[];
  goodTags: { tag: string; count: number }[];
}

function dayTags(data: Data, k: DayKey): string[] {
  let t = tagsOf(data.journal[k]?.text);
  for (const s of data.slots[k] ?? []) t = t.concat(tagsOf(s.note));
  return [...new Set(t)];
}

/**
 * Compare les jours difficiles et les bons jours sur les `windowDays` jours avant aujourd'hui.
 * Renvoie null s'il manque de données (moins de 2 jours dans chaque groupe).
 */
export function computeInsights(data: Data, today: DayKey, windowDays = 30): Insights | null {
  const days = Array.from({ length: windowDays }, (_, i) => addDays(today, -i - 1)).filter(
    (k) => data.journal[k]?.mood != null,
  );
  const bad = days.filter((k) => isBadDay(data.journal[k]));
  const good = days.filter((k) => isGoodDay(data.journal[k]));
  if (bad.length < 2 || good.length < 2) return null;

  const pct = (list: DayKey[], f: (k: DayKey) => boolean) =>
    Math.round((list.filter(f).length / list.length) * 100);

  const habits = data.habits
    .filter((h) => !h.archived)
    .map((h) => ({
      habitId: h.id,
      name: h.name,
      bad: pct(bad, (k) => isChecked(data, k, h.id)),
      good: pct(good, (k) => isChecked(data, k, h.id)),
    }))
    .filter((x) => x.good - x.bad >= 20)
    .sort((a, b) => b.good - b.bad - (a.good - a.bad))
    .slice(0, 3);

  const slotRate = (list: DayKey[]) => {
    let total = 0;
    let done = 0;
    for (const k of list) {
      const s = data.slots[k] ?? [];
      total += s.length;
      done += s.filter((x) => x.done).length;
    }
    return total ? Math.round((done / total) * 100) : 0;
  };
  const sb = slotRate(bad);
  const sg = slotRate(good);

  const avgEnergy = (list: DayKey[]) => {
    const v: number[] = list.map((k) => data.journal[k].energy).filter((x): x is NonNullable<typeof x> => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const eb = avgEnergy(bad);
  const eg = avgEnergy(good);

  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((wd) => ({
    weekday: wd,
    total: days.filter((k) => weekday(k) === wd).length,
    bad: bad.filter((k) => weekday(k) === wd).length,
  }));
  const hardestWeekday =
    weekdays
      .filter((w) => w.bad >= 2 && w.bad / w.total >= 0.4)
      .sort((a, b) => b.bad / b.total - a.bad / a.total)[0] ?? null;

  const count = (list: DayKey[]) => {
    const c: Record<string, number> = {};
    for (const k of list) for (const t of dayTags(data, k)) c[t] = (c[t] ?? 0) + 1;
    return c;
  };
  const cb = count(bad);
  const cg = count(good);
  const tags = [...new Set([...Object.keys(cb), ...Object.keys(cg)])];
  const badTags = tags
    .filter((t) => (cb[t] ?? 0) >= 2 && (cb[t] ?? 0) / bad.length > (cg[t] ?? 0) / good.length)
    .sort((a, b) => cb[b] - cb[a])
    .slice(0, 3)
    .map((tag) => ({ tag, count: cb[tag] }));
  const goodTags = tags
    .filter((t) => (cg[t] ?? 0) >= 2 && (cg[t] ?? 0) / good.length > (cb[t] ?? 0) / bad.length)
    .sort((a, b) => cg[b] - cg[a])
    .slice(0, 3)
    .map((tag) => ({ tag, count: cg[tag] }));

  return {
    badDays: bad.length,
    goodDays: good.length,
    habits,
    slots: sg - sb >= 15 ? { bad: sb, good: sg } : null,
    energy: eb != null && eg != null ? { bad: eb, good: eg } : null,
    weekdays,
    hardestWeekday,
    badTags,
    goodTags,
  };
}
