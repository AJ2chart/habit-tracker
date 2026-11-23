import { addDays, range, weekday } from './dates';
import { addPeriods, challengeEnd, PERIOD_UNIT, periodEndFor, periodStartFor } from './goals';
import { countChecked, isChecked } from './habits';
import { isBadDay } from './insights';
import { tagsOf } from './search';
import { sleepMinutes } from './sleep';
import type { Data, DayKey, Goal, Level } from './types';

const WD_FULL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export type ChallengeAction =
  | { type: 'restart'; target: number; periods: number }
  | { type: 'unlimited'; target: number }
  | { type: 'slot'; weekday: number };

export interface Suggestion {
  text: string;
  action?: ChallengeAction;
  actionLabel?: string;
}

export interface ChallengeReview {
  goal: Goal;
  unit: [string, string];
  periods: { start: DayKey; count: number; success: boolean }[];
  succeeded: number;
  total: number;
  rate: number;
  bestRun: number;
  trend: 'ancrage' | 'essoufflement' | 'stable';
  daysDone: number;
  daysMissed: number;
  worstWeekday: { weekday: number; missed: number; total: number } | null;
  /** Comparaison jours manqués / jours faits ; null si trop peu de données du journal */
  missedVsDone: {
    mood: [number, number] | null;
    energy: [number, number] | null;
    sleep: [number, number] | null;
    badShare: [number, number];
  } | null;
  /** Ordre des choses autour d'un jour manqué */
  direction: 'habit-first' | 'day-first' | null;
  missedTags: { tag: string; count: number }[];
  previousRate: number | null;
  suggestions: Suggestion[];
}

export const isChallenge = (g: Goal) => g.kind === 'habit' && !!g.habitId && !!g.endDate;
export const isChallengeEnded = (g: Goal, today: DayKey) => isChallenge(g) && g.endDate! < today;

const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

function dayTags(data: Data, k: DayKey) {
  let t = tagsOf(data.journal[k]?.text);
  for (const s of data.slots[k] ?? []) t = t.concat(tagsOf(s.note));
  return [...new Set(t)];
}

/** Bilan d'un challenge d'habitude, sur ses périodes écoulées. */
export function challengeReview(data: Data, goal: Goal, today: DayKey): ChallengeReview | null {
  if (!isChallenge(goal)) return null;
  const level: Level = goal.level;
  const habitId = goal.habitId!;
  const lastDay = goal.endDate! < today ? goal.endDate! : addDays(today, -1);
  if (lastDay < goal.periodStart) return null;

  const periods: ChallengeReview['periods'] = [];
  for (let p = goal.periodStart; p <= goal.endDate! && periodEndFor(level, p) <= lastDay; p = addPeriods(level, p, 1)) {
    const count = countChecked(data, habitId, p, periodEndFor(level, p));
    periods.push({ start: p, count, success: count >= goal.target });
  }
  const total = periods.length;
  const succeeded = periods.filter((p) => p.success).length;
  const rate = total ? Math.round((succeeded / total) * 100) : 0;
  let bestRun = 0;
  let run = 0;
  for (const p of periods) {
    run = p.success ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
  }
  const half = Math.floor(total / 2);
  const r1 = half ? periods.slice(0, half).filter((p) => p.success).length / half : 0;
  const r2 = total - half ? periods.slice(half).filter((p) => p.success).length / (total - half) : 0;
  const trend: ChallengeReview['trend'] = total < 2 ? 'stable' : r2 - r1 >= 0.15 ? 'ancrage' : r1 - r2 >= 0.15 ? 'essoufflement' : 'stable';

  const days = range(goal.periodStart, lastDay);
  const done = days.filter((k) => isChecked(data, k, habitId));
  const missed = days.filter((k) => !isChecked(data, k, habitId));

  const wd = [0, 1, 2, 3, 4, 5, 6].map((w) => ({
    weekday: w,
    total: days.filter((k) => weekday(k) === w).length,
    missed: missed.filter((k) => weekday(k) === w).length,
  }));
  const overallMiss = days.length ? missed.length / days.length : 0;
  const worstWeekday =
    wd
      .filter((w) => w.total >= 2 && w.missed >= 2 && w.missed / w.total >= Math.max(0.5, overallMiss + 0.2))
      .sort((a, b) => b.missed / b.total - a.missed / a.total)[0] ?? null;

  const moodOf = (list: DayKey[]) => avg(list.map((k) => data.journal[k]?.mood).filter((x): x is NonNullable<typeof x> => x != null) as number[]);
  const energyOf = (list: DayKey[]) => avg(list.map((k) => data.journal[k]?.energy).filter((x): x is NonNullable<typeof x> => x != null) as number[]);
  const sleepOf = (list: DayKey[]) => avg(list.filter((k) => data.sleep[k]).map((k) => sleepMinutes(data.sleep[k].bed, data.sleep[k].wake)));
  const noted = (list: DayKey[]) => list.filter((k) => data.journal[k]?.mood != null);
  const share = (list: DayKey[]) => (noted(list).length ? Math.round((noted(list).filter((k) => isBadDay(data.journal[k])).length / noted(list).length) * 100) : 0);
  const pair = (f: (l: DayKey[]) => number | null): [number, number] | null => {
    const a = f(missed);
    const b = f(done);
    return a != null && b != null ? [a, b] : null;
  };
  const missedVsDone = noted(missed).length >= 2 && noted(done).length >= 2 ? { mood: pair(moodOf), energy: pair(energyOf), sleep: pair(sleepOf), badShare: [share(missed), share(done)] as [number, number] } : null;

  // Une journée difficile la veille ou le lendemain d'un jour manqué ?
  let direction: ChallengeReview['direction'] = null;
  const withBoth = missed.filter((k) => data.journal[addDays(k, -1)]?.mood != null && data.journal[addDays(k, 1)]?.mood != null);
  if (withBoth.length >= 3) {
    const before = withBoth.filter((k) => isBadDay(data.journal[addDays(k, -1)])).length / withBoth.length;
    const after = withBoth.filter((k) => isBadDay(data.journal[addDays(k, 1)])).length / withBoth.length;
    if (after - before >= 0.2) direction = 'habit-first';
    else if (before - after >= 0.2) direction = 'day-first';
  }

  const tagCount = (list: DayKey[]) => {
    const c: Record<string, number> = {};
    for (const k of list) for (const t of dayTags(data, k)) c[t] = (c[t] ?? 0) + 1;
    return c;
  };
  const cm = tagCount(missed);
  const cd = tagCount(done);
  const missedTags = Object.keys(cm)
    .filter((t) => cm[t] >= 2 && cm[t] / Math.max(1, missed.length) > (cd[t] ?? 0) / Math.max(1, done.length))
    .sort((a, b) => cm[b] - cm[a])
    .slice(0, 3)
    .map((tag) => ({ tag, count: cm[tag] }));

  const previous = data.goals
    .filter((g) => g.id !== goal.id && g.habitId === habitId && isChallenge(g) && g.endDate! < goal.periodStart)
    .sort((a, b) => b.endDate!.localeCompare(a.endDate!))[0];
  const prevReview = previous ? challengeReview(data, previous, today) : null;

  const unit = PERIOD_UNIT[level];
  const suggestions: Suggestion[] = [];
  if (total && rate < 50) {
    const easier = Math.max(1, Math.min(goal.target - 1, Math.ceil(goal.target * 0.7)));
    suggestions.push({
      text: `Moins d'une ${unit[0]} sur deux réussie : la cible de ${goal.target} était peut-être trop haute. Repartir sur ${easier} fois par ${unit[0]}.`,
      action: { type: 'restart', target: easier, periods: total },
      actionLabel: `Relancer à ${easier} fois`,
    });
  }
  if (total && rate >= 90) {
    suggestions.push({
      text: "L'habitude semble ancrée. La garder sans limite de durée pour ne pas la perdre.",
      action: { type: 'unlimited', target: goal.target },
      actionLabel: 'Continuer sans limite',
    });
  }
  if (worstWeekday)
    suggestions.push({
      text: `Le ${WD_FULL[worstWeekday.weekday]} est souvent manqué (${worstWeekday.missed} sur ${worstWeekday.total}). Lui réserver un créneau ce jour-là.`,
      action: { type: 'slot', weekday: worstWeekday.weekday },
      actionLabel: `Créneau chaque ${WD_FULL[worstWeekday.weekday]}`,
    });
  if (missedVsDone?.energy && missedVsDone.energy[1] - missedVsDone.energy[0] >= 1)
    suggestions.push({ text: "Les jours manqués, ton énergie est nettement plus basse : la faire plus tôt dans la journée, avant la fatigue." });
  if (missedVsDone?.sleep && missedVsDone.sleep[1] - missedVsDone.sleep[0] >= 30)
    suggestions.push({ text: "Les jours manqués suivent des nuits plus courtes : le sommeil passe avant l'habitude." });
  if (direction === 'habit-first')
    suggestions.push({ text: "Les jours difficiles suivent souvent un jour manqué : l'habitude te protège. La garder coûte que coûte, même en version courte." });
  if (direction === 'day-first')
    suggestions.push({ text: "Les jours manqués suivent souvent une journée difficile : c'est la journée qui fait sauter l'habitude. S'attaquer d'abord à ce qui plombe ces journées." });
  if (missedTags[0]) suggestions.push({ text: `#${missedTags[0].tag} revient les jours manqués : c'est un frein à anticiper.` });
  if (trend === 'essoufflement' && total >= 4) {
    const shorter = Math.max(2, Math.round(total / 2));
    suggestions.push({
      text: "Ça s'est essoufflé en fin de challenge. Un challenge plus court relance la dynamique.",
      action: { type: 'restart', target: goal.target, periods: shorter },
      actionLabel: `Relancer sur ${shorter} ${unit[1]}`,
    });
  }

  return {
    goal,
    unit,
    periods,
    succeeded,
    total,
    rate,
    bestRun,
    trend,
    daysDone: done.length,
    daysMissed: missed.length,
    worstWeekday,
    missedVsDone,
    direction,
    missedTags,
    previousRate: prevReview ? prevReview.rate : null,
    suggestions,
  };
}

/** Nouvel objectif à créer pour une action « relancer » ou « sans limite ». */
export function goalFromAction(goal: Goal, action: Extract<ChallengeAction, { type: 'restart' | 'unlimited' }>, today: DayKey): Omit<Goal, 'id'> {
  const start = periodStartFor(goal.level, today);
  return {
    level: goal.level,
    parentId: goal.parentId,
    title: goal.title,
    kind: 'habit',
    habitId: goal.habitId,
    current: 0,
    target: action.target,
    unit: '',
    step: 1,
    periodStart: start,
    endDate: action.type === 'restart' ? challengeEnd(goal.level, start, action.periods) : null,
  };
}
