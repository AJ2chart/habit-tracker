import { addDays, range } from "./dates";
import type { Data, DayKey, Habit } from "./types";

export const isChecked = (data: Data, day: DayKey, habitId: string) =>
  (data.checks[day] ?? []).includes(habitId);

export const countChecked = (data: Data, habitId: string, from: DayKey, to: DayKey) =>
  range(from, to).filter((k) => isChecked(data, k, habitId)).length;

/** Jours consécutifs cochés jusqu'à hier, plus aujourd'hui s'il est coché. */
export function streak(data: Data, habitId: string, today: DayKey): number {
  let k = isChecked(data, today, habitId) ? today : addDays(today, -1);
  let n = 0;
  while (isChecked(data, k, habitId)) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

/** Habitudes visées au moins 5 fois par semaine, ni cochées aujourd'hui, ni hier, ni avant-hier. */
export function brokenStreaks(data: Data, today: DayKey): Habit[] {
  const days = [today, addDays(today, -1), addDays(today, -2)];
  return data.habits.filter(
    (h) => !h.archived && h.perWeek >= 5 && days.every((k) => !isChecked(data, k, h.id)),
  );
}
