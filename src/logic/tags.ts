import { fold, tagsOf } from "./search";
import type { Data } from "./types";

/** Étiquettes de départ, proposées tant qu'on n'a pas les siennes. Groupées par thème, du plus courant au moins courant. */
export const STARTER_TAGS = [
  // contexte
  "travail", "famille", "amis", "seul",
  // corps
  "sport", "fatigue", "malade", "douleur",
  // charge
  "réunions", "rush", "écrans",
  // ressenti
  "stress", "anxiété", "calme", "fierté",
  // dehors
  "nature", "sortie",
] as const;

/** Nombre d'utilisations de chaque étiquette : notes du soir, du matin, et des créneaux. */
export function tagCounts(data: Data): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (text?: string | null) => {
    for (const t of tagsOf(text)) counts.set(t, (counts.get(t) ?? 0) + 1);
  };
  for (const j of Object.values(data.journal)) add(j.text);
  for (const m of Object.values(data.morning)) add(m.note);
  for (const list of Object.values(data.slots)) for (const s of list) add(s.note);
  return counts;
}

/**
 * Étiquettes à proposer : d'abord les siennes, des plus utilisées aux moins utilisées,
 * puis les étiquettes de départ pas encore utilisées. Une étiquette n'apparaît qu'une fois
 * (accents et majuscules ignorés).
 */
export function suggestTags(data: Data): string[] {
  const own = [...tagCounts(data).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  const seen = new Set(own.map(fold));
  return [...own, ...STARTER_TAGS.filter((t) => !seen.has(fold(t)))];
}

const tagRe = (tag: string) => new RegExp(`(^|\\s)#${tag.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}(?![\\p{L}\\p{N}_-])`, "iu");

/** Ajoute l'étiquette à la fin de la note, ou la retire si elle y est déjà. */
export function toggleTag(text: string, tag: string): string {
  const re = tagRe(tag);
  if (re.test(text)) return text.replace(re, "").replace(/[ \t]{2,}/g, " ").trim();
  const t = text.replace(/\s+$/, "");
  return t ? `${t} #${tag}` : `#${tag}`;
}
