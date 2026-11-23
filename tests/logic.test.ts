import assert from "node:assert/strict";
import * as L from "../src/logic";
import type { Data } from "../src/logic";

let passed = 0;
const t = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("ok -", name);
};

const empty = (): Data => ({ habits: [], checks: {}, rules: [], slots: {}, journal: {}, goals: [], reviews: {}, sleep: {} });

t("dates", () => {
  assert.equal(L.mondayOf("2026-11-23"), "2026-11-23"); // lundi
  assert.equal(L.mondayOf("2026-11-29"), "2026-11-23"); // dimanche
  assert.equal(L.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(L.monthEnd("2028-02-10"), "2028-02-29");
  assert.equal(L.sameDayLastYear("2028-02-29"), "2027-02-28");
  assert.equal(L.range("2026-11-28", "2026-12-02").length, 5);
});

t("règles de répétition", () => {
  const base = { id: "r", title: "x", start: "07:00", end: "08:00", habitId: null, days: [] as number[], from: "2026-11-01" };
  assert.ok(L.ruleMatches({ ...base, type: "weekdays" }, "2026-11-23"));
  assert.ok(!L.ruleMatches({ ...base, type: "weekdays" }, "2026-11-22"));
  assert.ok(L.ruleMatches({ ...base, type: "custom", days: [1] }, "2026-11-23"));
  assert.ok(!L.ruleMatches({ ...base, type: "daily" }, "2026-10-31"));
  assert.ok(!L.ruleMatches({ ...base, type: "daily", until: "2026-11-20" }, "2026-11-23"));
  assert.equal(L.ruleLabel({ ...base, type: "custom", days: [1] }), "Tous les lundis");
  assert.equal(L.ruleLabel({ ...base, type: "custom", days: [5, 1, 3] }), "lun, mer, ven");
  let n = 0;
  const occ = L.missingOccurrences("2026-11-23", [{ ...base, type: "daily", habitId: "h" }], [], () => true, () => "s" + n++);
  assert.equal(occ.length, 1);
  assert.equal(occ[0].done, true);
  assert.equal(L.missingOccurrences("2026-11-23", [{ ...base, type: "daily" }], occ.map((s) => ({ ...s, ruleId: "r" })), () => false, () => "z").length, 0);
});

t("séries et alertes", () => {
  const d = empty();
  d.habits = [{ id: "h", name: "Lecture", perWeek: 7 }, { id: "s", name: "Sport", perWeek: 3 }];
  d.checks = { "2026-11-20": ["h"], "2026-11-19": ["h"], "2026-11-18": ["h"] };
  assert.equal(L.streak(d, "h", "2026-11-21"), 3);
  assert.equal(L.streak(d, "h", "2026-11-22"), 0);
  assert.deepEqual(L.brokenStreaks(d, "2026-11-23").map((h) => h.id), ["h"]);
  assert.deepEqual(L.brokenStreaks(d, "2026-11-22").map((h) => h.id), []);
});

t("objectifs", () => {
  const d = empty();
  d.checks = { "2026-11-23": ["h"], "2026-11-25": ["h"], "2026-11-30": ["h"] };
  const g = { id: "g", level: "hebdo" as const, parentId: null, title: "", kind: "habit" as const, habitId: "h", target: 4, periodStart: "2026-11-23" };
  assert.deepEqual(L.goalProgress(d, g), { current: 2, target: 4, percent: 50, unit: "fois" });
  const m = { ...g, level: "mensuel" as const, periodStart: "2026-11-01" };
  assert.equal(L.goalProgress(d, m).current, 3);
  const man = { ...g, kind: "manual" as const, current: 48, target: 50, step: 5, unit: "km" };
  assert.equal(L.increment(man).current, 50);
});

t("recherche", () => {
  assert.equal(L.highlight("Réunion d'équipe", "reunion")?.find((s) => s.match)?.text, "Réunion");
  assert.equal(L.highlight("abc", "x"), null);
  const d = empty();
  d.journal["2026-11-20"] = { date: "2026-11-20", mood: 1, energy: 1, text: "Dentiste à 17h #santé" };
  d.slots["2026-11-21"] = [{ id: "1", date: "2026-11-21", start: "11:00", end: "11:30", title: "RDV banque", habitId: null, ruleId: null, done: true, note: "Taux 3,4 %" }];
  d.reviews["2026-11-16"] = { weekStart: "2026-11-16", good: "", hard: "Trop de réunions", change: "" };
  assert.equal(L.search(d, "dentiste")[0].date, "2026-11-20");
  assert.equal(L.search(d, "taux")[0].hits[0].kind, "note");
  assert.equal(L.search(d, "reunions")[0].date, "2026-11-22");
  assert.deepEqual(L.tagsOf("Fatigué #Sommeil et #écrans #sommeil"), ["sommeil", "écrans"]);
});

t("analyse des jours difficiles", () => {
  const d = empty();
  d.habits = [{ id: "m", name: "Méditation", perWeek: 7 }];
  const today = "2026-11-23";
  for (let i = 1; i <= 20; i++) {
    const k = L.addDays(today, -i);
    const bad = i % 4 === 0;
    d.journal[k] = { date: k, mood: bad ? 0 : 4, energy: bad ? 0 : 3, text: bad ? "#sommeil" : "#famille" };
    if (!bad) d.checks[k] = ["m"];
  }
  const ins = L.computeInsights(d, today)!;
  assert.equal(ins.badDays, 5);
  assert.equal(ins.habits[0].bad, 0);
  assert.equal(ins.habits[0].good, 100);
  assert.deepEqual(ins.energy, { bad: 0, good: 3 });
  assert.equal(ins.badTags[0].tag, "sommeil");
  assert.equal(ins.goodTags[0].tag, "famille");
  assert.equal(L.computeInsights(empty(), today), null);
});

console.log(`\n${passed} groupes de tests réussis`);

t("objectifs : périodes et renouvellement", () => {
  const d = empty();
  d.checks = { "2026-11-30": ["h"], "2026-12-01": ["h"], "2026-12-03": ["h"] };
  const weekly = { id: "w", level: "hebdo" as const, parentId: null, title: "", kind: "habit" as const, habitId: "h", target: 4, periodStart: "2026-11-23" };
  assert.ok(L.isActiveAt(weekly, "2026-12-02"));
  assert.ok(!L.isActiveAt(weekly, "2026-11-20"));
  assert.equal(L.goalProgress(d, weekly, "2026-12-02").current, 3);
  assert.equal(L.goalProgress(d, weekly).current, 0);
  const manual = { ...weekly, level: "mensuel" as const, kind: "manual" as const, periodStart: "2026-11-01", current: 10 };
  assert.ok(L.isActiveAt(manual, "2026-11-15"));
  assert.ok(!L.isActiveAt(manual, "2026-12-01"));
  assert.equal(L.periodStartFor("annuel", "2026-11-23"), "2026-01-01");
});
console.log(`\n${passed} groupes de tests réussis (avec périodes)`);

t("challenges", () => {
  assert.equal(L.addPeriods("mensuel", "2026-11-01", 3), "2027-02-01");
  assert.equal(L.challengeEnd("hebdo", "2026-11-23", 4), "2026-12-20");
  assert.equal(L.challengeEnd("mensuel", "2026-11-01", 3), "2027-01-31");
  const g = { id: "c", level: "hebdo" as const, parentId: null, title: "", kind: "habit" as const, habitId: "h", target: 5, periodStart: "2026-11-23", endDate: "2026-12-20" };
  assert.deepEqual(L.challengeStep(g, "2026-12-09"), { index: 3, total: 4 });
  assert.ok(L.isActiveAt(g, "2026-12-20"));
  assert.ok(!L.isActiveAt(g, "2026-12-21"));
  assert.equal(L.challengeStep({ ...g, endDate: null }, "2026-12-09"), null);
});
console.log(`${passed} groupes au total`);

t("sommeil", () => {
  assert.equal(L.sleepMinutes("23:30", "07:00"), 450);
  assert.equal(L.sleepMinutes("00:30", "07:00"), 390);
  assert.equal(L.formatDuration(450), "7 h 30");
  assert.equal(L.formatDuration(420), "7 h");
  assert.equal(L.bedtimeOffset("23:00"), -60);
  assert.equal(L.bedtimeSpread([{ bed: "23:00" }, { bed: "23:00" }, { bed: "23:00" }] as never), 0);
  const d = empty();
  const today = "2026-11-23";
  for (let i = 1; i <= 20; i++) {
    const k = L.addDays(today, -i);
    const bad = i % 4 === 0;
    d.journal[k] = { date: k, mood: bad ? 0 : 4, energy: null, text: "" };
    d.sleep[k] = { date: k, bed: bad ? "01:30" : "23:00", wake: "07:00", quality: bad ? 1 : 3, awakenings: null };
  }
  const s = L.computeInsights(d, today)!.sleep!;
  assert.equal(s.badMinutes, 330);
  assert.equal(s.goodMinutes, 480);
  assert.equal(s.shortNightBadRate, 100);
  assert.equal(s.normalNightBadRate, 0);
});
console.log(`${passed} groupes au total (avec sommeil)`);

t("rappel du soir", () => {
  const r = { ...L.DEFAULT_REMINDER, enabled: true };
  assert.deepEqual(L.reminderTimes(r), ["21:00"]);
  assert.deepEqual(L.reminderTimes({ ...r, repeat: 60, until: "23:00" }), ["21:00", "22:00", "23:00"]);
  assert.deepEqual(L.reminderTimes({ ...r, repeat: 30, until: "22:00" }), ["21:00", "21:30", "22:00"]);
  const d = empty();
  const now = new Date(2026, 10, 23, 20, 0);
  assert.equal(L.plannedReminders(d, r, now, 3).length, 3);
  d.journal["2026-11-23"] = { date: "2026-11-23", mood: 3, energy: null, text: "" };
  const p = L.plannedReminders(d, r, now, 3);
  assert.equal(p.length, 2);
  assert.equal(p[0].day, "2026-11-24");
  assert.ok(!L.isDayFilled(d, "2026-11-23", "mood_note"));
  assert.equal(L.plannedReminders(d, r, new Date(2026, 10, 24, 22, 0), 1).length, 0);
  assert.equal(L.plannedReminders(d, { ...r, enabled: false }, now).length, 0);
  assert.deepEqual(L.parseReminderSettings({ reminder_enabled: "1", reminder_time: "20:30", reminder_repeat: "45" }), { ...L.DEFAULT_REMINDER, enabled: true, time: "20:30" });
});
console.log(`${passed} groupes au total (avec rappels)`);
