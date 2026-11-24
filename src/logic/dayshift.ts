import { addDays } from "./dates";
import { isChecked } from "./habits";
import { tagsOf } from "./search";
import { sleepMinutes } from "./sleep";
import type { Data, DayKey } from "./types";

/** Écart d'humeur entre le matin et le soir : négatif = la journée a fait baisser l'humeur. */
export const moodShift = (data: Data, k: DayKey): number | null => {
  const m = data.morning[k]?.mood;
  const e = data.journal[k]?.mood;
  return m != null && e != null ? e - m : null;
};

export interface DayShiftCause {
  text: string;
  /** Force de l'écart, pour trier */
  weight: number;
}

export interface DayShift {
  /** Jours où le matin et le soir sont notés */
  days: number;
  drops: number;
  rises: number;
  stable: number;
  /** Écart moyen soir − matin, en crans d'humeur */
  average: number;
  /** Ce qui revient davantage les jours où l'humeur baisse (2 à 4 pistes au plus) */
  causes: DayShiftCause[];
}

const pct = (list: DayKey[], f: (k: DayKey) => boolean) => (list.length ? Math.round((list.filter(f).length / list.length) * 100) : 0);

/**
 * Compare l'humeur du matin et celle du soir sur les `windowDays` derniers jours (aujourd'hui compris),
 * et cherche ce qui accompagne les journées où elle baisse. null avec moins de 5 jours notés matin et soir.
 */
export function computeDayShift(data: Data, today: DayKey, windowDays = 30): DayShift | null {
  const days = Array.from({ length: windowDays }, (_, i) => addDays(today, -i)).filter((k) => moodShift(data, k) != null);
  if (days.length < 5) return null;
  const drop = days.filter((k) => moodShift(data, k)! <= -1);
  const rest = days.filter((k) => moodShift(data, k)! > -1);
  const average = days.reduce((a, k) => a + moodShift(data, k)!, 0) / days.length;

  const causes: DayShiftCause[] = [];
  if (drop.length >= 2 && rest.length >= 2) {
    // Étiquettes de la journée (note du soir, notes des créneaux).
    const tagsFor = (k: DayKey) => {
      let t = tagsOf(data.journal[k]?.text);
      for (const s of data.slots[k] ?? []) t = t.concat(tagsOf(s.note));
      for (const n of data.notes?.[k] ?? []) t = t.concat(tagsOf(n.text));
      return new Set(t);
    };
    const all = new Set<string>();
    for (const k of drop) for (const t of tagsFor(k)) all.add(t);
    for (const tag of all) {
      const d = pct(drop, (k) => tagsFor(k).has(tag));
      const r = pct(rest, (k) => tagsFor(k).has(tag));
      if (drop.filter((k) => tagsFor(k).has(tag)).length >= 2 && d - r >= 25)
        causes.push({ weight: d - r, text: `#${tag} revient ${d} % des journées où l'humeur baisse, contre ${r} % sinon.` });
    }

    // Emploi du temps respecté.
    const slotRate = (list: DayKey[]) => {
      let total = 0;
      let done = 0;
      for (const k of list) {
        const s = data.slots[k] ?? [];
        total += s.length;
        done += s.filter((x) => x.done).length;
      }
      return total ? Math.round((done / total) * 100) : null;
    };
    const sd = slotRate(drop);
    const sr = slotRate(rest);
    if (sd != null && sr != null && sr - sd >= 15)
      causes.push({ weight: sr - sd, text: `Ces jours-là, tu fais ${sd} % de ton emploi du temps, contre ${sr} % les autres jours.` });
    const load = (list: DayKey[]) => list.reduce((a, k) => a + (data.slots[k]?.length ?? 0), 0) / list.length;
    const ld = load(drop);
    const lr = load(rest);
    if (ld - lr >= 1.5)
      causes.push({ weight: (ld - lr) * 15, text: `Journées plus chargées : ${ld.toFixed(1).replace('.', ',')} créneaux en moyenne, contre ${lr.toFixed(1).replace('.', ',')}.` });

    // Habitudes moins faites.
    for (const h of data.habits.filter((x) => !x.archived)) {
      const d = pct(drop, (k) => isChecked(data, k, h.id));
      const r = pct(rest, (k) => isChecked(data, k, h.id));
      if (r - d >= 25) causes.push({ weight: r - d, text: `« ${h.name} » : faite ${d} % de ces journées, contre ${r} % sinon.` });
    }

    // Nuit courte : la fatigue se fait souvent sentir en fin de journée.
    const nights = (list: DayKey[]) => list.map((k) => data.sleep[k]).filter((n) => !!n).map((n) => sleepMinutes(n!.bed, n!.wake));
    const nd = nights(drop);
    const nr = nights(rest);
    if (nd.length >= 2 && nr.length >= 2) {
      const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
      const gap = Math.round(avg(nr) - avg(nd));
      if (gap >= 30) causes.push({ weight: gap, text: `La nuit d'avant est plus courte de ${gap >= 60 ? `${Math.floor(gap / 60)} h ${String(gap % 60).padStart(2, '0')}` : `${gap} min`} en moyenne.` });
    }

    // Énergie du matin déjà basse.
    const energy = (list: DayKey[]) => {
      const v = list.map((k) => data.morning[k]?.energy).filter((x): x is NonNullable<typeof x> => x != null) as number[];
      return v.length >= 2 ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const ed = energy(drop);
    const er = energy(rest);
    if (ed != null && er != null && er - ed >= 1)
      causes.push({ weight: (er - ed) * 30, text: "Ces jours-là, l'énergie du matin est déjà plus basse : la journée part avec moins de réserve." });
  }

  return {
    days: days.length,
    drops: drop.length,
    rises: days.filter((k) => moodShift(data, k)! >= 1).length,
    stable: days.filter((k) => moodShift(data, k) === 0).length,
    average,
    causes: causes.sort((a, b) => b.weight - a.weight).slice(0, 4),
  };
}

/** Pour l'écran « pas encore assez de données ». */
export function dayShiftReadiness(data: Data, today: DayKey, windowDays = 30): number {
  return Array.from({ length: windowDays }, (_, i) => addDays(today, -i)).filter((k) => moodShift(data, k) != null).length;
}
