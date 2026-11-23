import { addDays, weekday } from "./dates";
import { isChecked } from "./habits";
import { tagsOf } from "./search";
import { sleepMinutes } from "./sleep";
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
  /** Nuit précédant les jours difficiles contre celle des bons jours ; null sans données de sommeil suffisantes. */
  sleep: {
    badMinutes: number;
    goodMinutes: number;
    badQuality: number | null;
    goodQuality: number | null;
    /** Part des jours difficiles après une nuit courte (< 6 h 30) et après une nuit normale */
    shortNightBadRate: number | null;
    normalNightBadRate: number | null;
  } | null;
}

export const SHORT_NIGHT = 6 * 60 + 30;

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

  const nightOf = (k: DayKey) => data.sleep?.[k];
  const avgMin = (list: DayKey[]) => {
    const v = list.map(nightOf).filter((x) => !!x).map((x) => sleepMinutes(x!.bed, x!.wake));
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const avgQ = (list: DayKey[]) => {
    const v = list.map((k) => nightOf(k)?.quality).filter((x): x is NonNullable<typeof x> => x != null) as number[];
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const withNight = days.filter((k) => nightOf(k));
  const short = withNight.filter((k) => sleepMinutes(nightOf(k)!.bed, nightOf(k)!.wake) < SHORT_NIGHT);
  const normal = withNight.filter((k) => !short.includes(k));
  const badRate = (list: DayKey[]) => (list.length >= 2 ? Math.round((list.filter((k) => isBadDay(data.journal[k])).length / list.length) * 100) : null);
  const sb2 = avgMin(bad);
  const sg2 = avgMin(good);
  const sleep =
    sb2 != null && sg2 != null
      ? { badMinutes: sb2, goodMinutes: sg2, badQuality: avgQ(bad), goodQuality: avgQ(good), shortNightBadRate: badRate(short), normalNightBadRate: badRate(normal) }
      : null;

  return {
    sleep,
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

const WD_FULL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const ENERGY_WORDS = ['vide', 'basse', 'moyenne', 'bonne', 'pleine'];
const hm = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
};

/** Pistes concrètes tirées de l'analyse, de la plus marquante à la moins marquante (3 à 5). */
export function insightTips(ins: Insights, data: Data): string[] {
  const tips: { weight: number; text: string }[] = [];
  const top = ins.habits[0];
  if (top)
    tips.push({
      weight: top.good - top.bad,
      text: `« ${top.name} » : faite ${top.bad} % des jours difficiles contre ${top.good} % des bons jours. La garder même les jours chargés, quitte à en faire une version courte.`,
    });
  if (ins.sleep) {
    const gap = ins.sleep.goodMinutes - ins.sleep.badMinutes;
    if (gap >= 30)
      tips.push({
        weight: gap,
        text: `Avant tes jours difficiles, tu dors ${hm(ins.sleep.badMinutes)} en moyenne, contre ${hm(ins.sleep.goodMinutes)} avant les bons. Le sommeil est une piste prioritaire.`,
      });
    const s = ins.sleep.shortNightBadRate;
    const n = ins.sleep.normalNightBadRate;
    if (s != null && n != null && s - n >= 25)
      tips.push({ weight: s - n, text: `Après une nuit de moins de 6 h 30, ${s} % de tes jours sont difficiles, contre ${n} % sinon.` });
  }
  if (ins.energy && ins.energy.good - ins.energy.bad >= 1)
    tips.push({
      weight: (ins.energy.good - ins.energy.bad) * 30,
      text: `Tes jours difficiles sont d'abord des jours de fatigue (énergie ${ENERGY_WORDS[Math.round(ins.energy.bad)]} contre ${ENERGY_WORDS[Math.round(ins.energy.good)]}).`,
    });
  if (ins.hardestWeekday) {
    const w = ins.hardestWeekday;
    const ev = data.rules.filter((r) => r.type === 'custom' && !r.habitId && r.days.includes(w.weekday) && !r.until).map((r) => `« ${r.title} »`);
    tips.push({
      weight: (w.bad / w.total) * 60,
      text: `Les ${WD_FULL[w.weekday]}s sont les plus durs (${w.bad} sur ${w.total}).${ev.length ? ` Ce jour-là il y a ${ev.join(', ')} : alléger ou décaler ce créneau ?` : ''}`,
    });
  }
  if (ins.badTags[0]) tips.push({ weight: 20 + ins.badTags[0].count, text: `#${ins.badTags[0].tag} revient souvent les jours difficiles.` });
  if (ins.goodTags[0]) tips.push({ weight: 15 + ins.goodTags[0].count, text: `#${ins.goodTags[0].tag} accompagne tes bons jours : à programmer plus souvent.` });
  if (ins.slots) tips.push({ weight: ins.slots.good - ins.slots.bad, text: `Tu respectes ${ins.slots.bad} % de ton emploi du temps les jours difficiles, contre ${ins.slots.good} % les bons jours.` });
  return tips.sort((a, b) => b.weight - a.weight).slice(0, 5).map((t) => t.text);
}

/** Pour l'écran « pas encore assez de données ». */
export function insightReadiness(data: Data, today: DayKey, windowDays = 30) {
  const days = Array.from({ length: windowDays }, (_, i) => addDays(today, -i - 1)).filter((k) => data.journal[k]?.mood != null);
  return { noted: days.length, bad: days.filter((k) => isBadDay(data.journal[k])).length, good: days.filter((k) => isGoodDay(data.journal[k])).length };
}
