import { addDays, mondayOf, weekday } from "./dates";
import type { Data, DayKey } from "./types";

/** Minuscules, sans accents. */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface Segment {
  text: string;
  match: boolean;
}

/** Découpe un texte autour des correspondances (insensible aux accents) ; null si rien ne correspond. */
export function highlight(text: string, query: string): Segment[] | null {
  const q = fold(query.trim());
  if (!q) return null;
  const chars = [...text];
  let norm = "";
  const map: number[] = [];
  chars.forEach((c, i) => {
    for (const x of fold(c)) {
      norm += x;
      map.push(i);
    }
  });
  const out: Segment[] = [];
  let last = 0;
  let pos = norm.indexOf(q);
  while (pos >= 0) {
    const a = map[pos];
    const b = map[pos + q.length - 1] + 1;
    if (a > last) out.push({ text: chars.slice(last, a).join(""), match: false });
    out.push({ text: chars.slice(a, b).join(""), match: true });
    last = b;
    pos = norm.indexOf(q, pos + q.length);
  }
  if (!out.length) return null;
  if (last < chars.length) out.push({ text: chars.slice(last).join(""), match: false });
  return out;
}

export type HitKind = "journal" | "slot" | "note" | "habit" | "review";
export interface Hit {
  kind: HitKind;
  label?: string;
  segments: Segment[];
}
export interface DayResult {
  date: DayKey;
  hits: Hit[];
}

const REVIEW_LABELS = { good: "A marché", hard: "A coincé", change: "À changer" } as const;

/** Recherche dans le journal, les créneaux, leurs descriptions, les habitudes cochées et les revues. */
export function search(data: Data, query: string): DayResult[] {
  if (!query.trim()) return [];
  const reviewSundays = Object.keys(data.reviews).map((wk) => addDays(wk, 6));
  const days = [...new Set([...Object.keys(data.journal), ...Object.keys(data.slots), ...Object.keys(data.checks), ...Object.keys(data.notes ?? {}), ...Object.keys(data.morning ?? {}), ...reviewSundays])]
    .sort()
    .reverse();
  const results: DayResult[] = [];
  for (const day of days) {
    const hits: Hit[] = [];
    const j = data.journal[day];
    const hj = j?.text ? highlight(j.text, query) : null;
    if (hj) hits.push({ kind: "journal", segments: hj });
    const m = data.morning?.[day];
    const hm = m?.note ? highlight(m.note, query) : null;
    if (hm) hits.push({ kind: "journal", label: "Ce matin", segments: hm });
    for (const n of data.notes?.[day] ?? []) {
      const h = highlight(n.text, query);
      if (h) hits.push({ kind: "journal", label: n.time, segments: h });
    }
    if (weekday(day) === 0) {
      const rv = data.reviews[mondayOf(day)];
      if (rv)
        (Object.keys(REVIEW_LABELS) as (keyof typeof REVIEW_LABELS)[]).forEach((f) => {
          const h = rv[f] ? highlight(rv[f], query) : null;
          if (h) hits.push({ kind: "review", label: REVIEW_LABELS[f], segments: h });
        });
    }
    for (const s of [...(data.slots[day] ?? [])].sort((a, b) => a.start.localeCompare(b.start))) {
      const ht = highlight(s.title, query);
      const hn = s.note ? highlight(s.note, query) : null;
      if (ht) hits.push({ kind: "slot", label: s.start, segments: ht });
      if (hn) hits.push({ kind: "note", label: `${s.start} · ${s.title}`, segments: hn });
    }
    for (const id of data.checks[day] ?? []) {
      const h = data.habits.find((x) => x.id === id);
      const hh = h ? highlight(h.name, query) : null;
      if (hh) hits.push({ kind: "habit", segments: hh });
    }
    if (hits.length) results.push({ date: day, hits });
  }
  return results;
}

/** Étiquettes #mot d'un texte, en minuscules, sans doublon. */
export const tagsOf = (text?: string | null): string[] =>
  text ? [...new Set([...text.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((m) => m[1].toLowerCase()))] : [];
