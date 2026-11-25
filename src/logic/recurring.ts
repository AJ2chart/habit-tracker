import { weekday } from "./dates";
import type { DayKey, RecurringRule, Slot } from "./types";

const WD_FULL = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function ruleMatches(rule: RecurringRule, day: DayKey): boolean {
  if (day < rule.from) return false;
  if (rule.until && day > rule.until) return false;
  const wd = weekday(day);
  switch (rule.type) {
    case "daily":
      return true;
    case "weekdays":
      return wd >= 1 && wd <= 5;
    case "custom":
      return rule.days.includes(wd);
  }
}

export function ruleLabel(rule: RecurringRule): string {
  if (rule.type === "daily") return "Tous les jours";
  if (rule.type === "weekdays") return "En semaine";
  const days = ORDER.filter((w) => rule.days.includes(w));
  if (days.length === 1) return `Tous les ${WD_FULL[days[0]]}s`;
  return days.map((w) => WD_FULL[w].slice(0, 3)).join(", ");
}

/**
 * Occurrences à créer pour ce jour : une par règle applicable qui n'a pas
 * encore de créneau enregistré. Les créneaux existants ne sont jamais modifiés.
 */
export function missingOccurrences(
  day: DayKey,
  rules: RecurringRule[],
  existing: Slot[],
  isHabitChecked: (habitId: string) => boolean,
  newId: () => string,
): Slot[] {
  return rules
    .filter((r) => ruleMatches(r, day) && !existing.some((s) => s.ruleId === r.id))
    .map((r) => ({
      id: newId(),
      date: day,
      start: r.start,
      end: r.end,
      title: r.title,
      habitId: r.habitId,
      ruleId: r.id,
      done: r.habitId ? isHabitChecked(r.habitId) : false,
    }));
}

export const sortSlots = (slots: Slot[]) => [...slots].sort((a, b) => a.start.localeCompare(b.start));

/** Créneau en cours (pas encore coché), sinon le prochain de la journée ; null s'il n'y en a plus. */
export function currentOrNext(slots: Slot[], now: string): { slot: Slot; current: boolean } | null {
  const list = sortSlots(slots).filter((s) => !s.done);
  const cur = list.find((s) => s.start <= now && now < s.end);
  if (cur) return { slot: cur, current: true };
  const next = list.find((s) => s.start > now);
  return next ? { slot: next, current: false } : null;
}
