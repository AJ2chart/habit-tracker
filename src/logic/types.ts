// Types partagés par l'appli mobile et, plus tard, la version web.
// Dates de jour au format "YYYY-MM-DD" (heure locale), heures au format "HH:MM".

export type DayKey = string;
export type Level = "annuel" | "mensuel" | "hebdo";
export type RuleType = "daily" | "weekdays" | "custom";

/** 0 = Difficile … 4 = Super */
export type Mood = 0 | 1 | 2 | 3 | 4;
/** 0 = Vide … 4 = Pleine */
export type Energy = 0 | 1 | 2 | 3 | 4;

export interface Habit {
  id: string;
  name: string;
  perWeek: number;
  archived?: boolean;
}

export interface RecurringRule {
  id: string;
  title: string;
  start: string;
  end: string;
  habitId: string | null;
  type: RuleType;
  /** Jours de la semaine pour "custom" : 0 = dimanche … 6 = samedi */
  days: number[];
  from: DayKey;
  /** Dernier jour inclus ; absent = sans fin */
  until?: DayKey | null;
}

export interface Slot {
  id: string;
  date: DayKey;
  start: string;
  end: string;
  title: string;
  habitId: string | null;
  ruleId: string | null;
  done: boolean;
  note?: string;
}

export interface JournalEntry {
  date: DayKey;
  mood: Mood | null;
  energy: Energy | null;
  text: string;
}

export interface Goal {
  id: string;
  level: Level;
  parentId: string | null;
  title: string;
  kind: "habit" | "manual";
  habitId?: string | null;
  current?: number;
  target: number;
  unit?: string;
  step?: number;
  /** Début de la période visée : 1er janvier, 1er du mois ou lundi */
  periodStart: DayKey;
  /** Objectif lié à une habitude : dernier jour du challenge ; absent = sans limite */
  endDate?: DayKey | null;
}

export interface WeeklyReview {
  weekStart: DayKey;
  good: string;
  hard: string;
  change: string;
}

/** 0 = Très mauvaise … 4 = Excellente */
export type SleepQuality = 0 | 1 | 2 | 3 | 4;

/** Nuit rattachée au jour du réveil : la nuit du dimanche au lundi compte pour le lundi. */
export interface SleepEntry {
  date: DayKey;
  bed: string;
  wake: string;
  quality: SleepQuality | null;
  awakenings: number | null;
}

/** Humeur du matin, notée au réveil ; l'entrée du journal (JournalEntry) est celle du soir. */
export interface MorningEntry {
  date: DayKey;
  mood: Mood | null;
  energy: Energy | null;
  note: string;
}

/** Note rapide prise dans la journée (ressenti à chaud), avec son heure. */
export interface DayNote {
  id: string;
  date: DayKey;
  /** "HH:MM" */
  time: string;
  text: string;
}

/** Instantané des données nécessaire aux calculs. */
export interface Data {
  habits: Habit[];
  /** date → ids des habitudes cochées ce jour-là */
  checks: Record<DayKey, string[]>;
  rules: RecurringRule[];
  /** date → créneaux enregistrés ce jour-là */
  slots: Record<DayKey, Slot[]>;
  journal: Record<DayKey, JournalEntry>;
  goals: Goal[];
  reviews: Record<DayKey, WeeklyReview>;
  /** date du réveil → nuit */
  sleep: Record<DayKey, SleepEntry>;
  /** date → humeur du matin */
  morning: Record<DayKey, MorningEntry>;
  /** date → heure de validation du planning du jour ("YYYY-MM-DD HH:MM:SS") */
  plans: Record<DayKey, string>;
  /** date → notes rapides, dans l'ordre de l'heure */
  notes: Record<DayKey, DayNote[]>;
}
