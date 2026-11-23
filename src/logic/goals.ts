import { addDays, mondayOf, monthEnd, monthStart, yearEnd, yearStart } from './dates';
import { countChecked } from './habits';
import type { Data, DayKey, Goal, Level } from './types';

/**
 * Règle de période :
 * - un objectif lié à une habitude se renouvelle à chaque période (semaine, mois, année)
 *   à partir de sa période de départ ;
 * - un objectif manuel ne vaut que pour sa période de départ.
 */

/** Début de la période (lundi, 1er du mois ou 1er janvier) qui contient ce jour. */
export function periodStartFor(level: Level, day: DayKey): DayKey {
  if (level === 'hebdo') return mondayOf(day);
  if (level === 'mensuel') return monthStart(day);
  return yearStart(day);
}

export function periodEndFor(level: Level, start: DayKey): DayKey {
  if (level === 'hebdo') return addDays(start, 6);
  if (level === 'mensuel') return monthEnd(start);
  return yearEnd(start);
}

/** @deprecated garder pour compatibilité : fin de la période de départ. */
export const periodEnd = (goal: Goal): DayKey => periodEndFor(goal.level, goal.periodStart);

/** L'objectif s'applique-t-il à la période qui contient ce jour ? */
export function isActiveAt(goal: Goal, day: DayKey): boolean {
  const p = periodStartFor(goal.level, day);
  if (goal.kind === 'habit') return p >= goal.periodStart && (!goal.endDate || p <= goal.endDate);
  return p === goal.periodStart;
}

/** Début de la n-ième période après `start` (n = 0 : la période elle-même). */
export function addPeriods(level: Level, start: DayKey, n: number): DayKey {
  if (level === 'hebdo') return addDays(start, 7 * n);
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7)) - 1;
  if (level === 'mensuel') {
    const t = y * 12 + m + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
  }
  return `${y + n}-01-01`;
}

/** Dernier jour d'un challenge de `count` périodes commençant à `start`. */
export const challengeEnd = (level: Level, start: DayKey, count: number): DayKey =>
  periodEndFor(level, addPeriods(level, start, count - 1));

/** Position dans le challenge (« semaine 3 sur 12 ») ; null si sans limite. */
export function challengeStep(goal: Goal, day: DayKey): { index: number; total: number } | null {
  if (!goal.endDate) return null;
  const p = periodStartFor(goal.level, day);
  let total = 0;
  let index = 0;
  for (let k = goal.periodStart; k <= goal.endDate; k = addPeriods(goal.level, k, 1)) {
    total++;
    if (k === p) index = total;
    if (total > 600) break;
  }
  return { index, total };
}

export const PERIOD_UNIT: Record<Level, [string, string]> = {
  hebdo: ['semaine', 'semaines'],
  mensuel: ['mois', 'mois'],
  annuel: ['année', 'années'],
};

export interface Progress {
  current: number;
  target: number;
  /** 0 à 100 */
  percent: number;
  unit: string;
}

/** Progression sur la période qui contient `day` (par défaut : la période de départ). */
export function goalProgress(data: Data, goal: Goal, day?: DayKey): Progress {
  const start = day ? periodStartFor(goal.level, day) : goal.periodStart;
  const current =
    goal.kind === 'habit' && goal.habitId
      ? countChecked(data, goal.habitId, start, periodEndFor(goal.level, start))
      : goal.current ?? 0;
  const percent = goal.target > 0 ? Math.min(100, Math.round((current / goal.target) * 100)) : 0;
  return { current, target: goal.target, percent, unit: goal.kind === 'habit' ? 'fois' : goal.unit ?? '' };
}

/** Ajoute le pas de l'objectif manuel, sans dépasser la cible. */
export const increment = (goal: Goal): Goal => ({
  ...goal,
  current: Math.min(goal.target, (goal.current ?? 0) + (goal.step ?? 1)),
});

export const childrenOf = (goals: Goal[], parentId: string | null) => goals.filter((g) => g.parentId === parentId);

export const LEVEL_LABELS: Record<Level, string> = { annuel: 'Annuel', mensuel: 'Mensuel', hebdo: 'Hebdomadaire' };
export const PARENT_LEVEL: Record<Level, Level | null> = { annuel: null, mensuel: 'annuel', hebdo: 'mensuel' };
