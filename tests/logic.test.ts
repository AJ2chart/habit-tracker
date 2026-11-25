import assert from "node:assert/strict";
import * as L from "../src/logic";
import type { Data } from "../src/logic";

let passed = 0;
const t = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("ok -", name);
};

const empty = (): Data => ({ habits: [], checks: {}, rules: [], slots: {}, journal: {}, goals: [], reviews: {}, sleep: {}, morning: {}, plans: {}, notes: {} });

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

t("rappel du matin", () => {
  const m = { ...L.DEFAULT_MORNING, enabled: true };
  const plan = { ...m, steps: ["sleep", "plan"] as L.MorningStep[] };
  const d = empty();
  const now = new Date(2026, 10, 23, 7, 0);
  assert.equal(L.plannedMorning(d, m, now, 2).length, 2);
  assert.match(L.morningMessage(d, "2026-11-23", m).body, /nuit notée/);
  d.rules = [{ id: "r", title: "Travail profond", start: "09:00", end: "11:00", habitId: null, type: "weekdays", days: [], from: "2026-11-01" }];
  assert.match(L.morningMessage(d, "2026-11-24", m).body, /1er créneau à 09:00 Travail profond/);
  d.sleep["2026-11-23"] = { date: "2026-11-23", bed: "23:00", wake: "07:00", quality: 3, awakenings: null };
  assert.ok(L.isMorningDone(d, "2026-11-23", m));
  assert.ok(!L.isMorningDone(d, "2026-11-23", plan)); // planning pas validé
  d.plans["2026-11-23"] = "2026-11-23 07:30:00";
  assert.ok(L.isMorningDone(d, "2026-11-23", plan));
  assert.equal(L.plannedMorning(d, m, now, 2)[0].day, "2026-11-24");
  assert.deepEqual(L.parseMorningSettings({ morning_enabled: "1", morning_sticky: "0" }), { ...L.DEFAULT_MORNING, enabled: true, sticky: false });
});
console.log(`${passed} groupes au total (avec matin)`);

t("pistes de l'analyse", () => {
  const d = empty();
  d.habits = [{ id: "m", name: "Méditation", perWeek: 7 }];
  const today = "2026-11-23";
  for (let i = 1; i <= 20; i++) {
    const k = L.addDays(today, -i);
    const bad = i % 4 === 0;
    d.journal[k] = { date: k, mood: bad ? 0 : 4, energy: bad ? 0 : 3, text: bad ? "#sommeil" : "#famille" };
    d.sleep[k] = { date: k, bed: bad ? "01:30" : "23:00", wake: "07:00", quality: null, awakenings: null };
    if (!bad) d.checks[k] = ["m"];
  }
  const tips = L.insightTips(L.computeInsights(d, today)!, d);
  assert.ok(tips.length >= 3 && tips.length <= 5);
  assert.match(tips[0], /Méditation|nuit|dors/);
  assert.ok(tips.some((t) => /5 h 30.*8 h/.test(t)));
  assert.deepEqual(L.insightReadiness(d, today), { noted: 20, bad: 5, good: 15 });
});
console.log(`${passed} groupes au total (avec pistes)`);

t("bilan de challenge", () => {
  const d = empty();
  d.habits = [{ id: "m", name: "Méditation", perWeek: 5 }];
  // Challenge de 4 semaines (lun 2026-10-26 → dim 2026-11-22), cible 5/semaine.
  const g = { id: "c", level: "hebdo" as const, parentId: null, title: "Méditer 5 fois", kind: "habit" as const, habitId: "m", target: 5, periodStart: "2026-10-26", endDate: "2026-11-22" };
  for (const k of L.range("2026-10-26", "2026-11-22")) {
    const wd = L.weekday(k);
    const week = Math.floor(L.range("2026-10-26", k).length / 7.0001);
    const skip = wd === 1 || (week >= 2 && wd >= 4); // lundis manqués, essoufflement en fin
    if (!skip) d.checks[k] = ["m"];
    d.journal[k] = { date: k, mood: skip ? 1 : 3, energy: skip ? 0 : 3, text: skip ? "#réunions" : "" };
  }
  const r = L.challengeReview(d, g, "2026-11-23")!;
  assert.equal(r.total, 4);
  assert.equal(r.succeeded, 2);
  assert.equal(r.rate, 50);
  assert.equal(r.trend, "essoufflement");
  assert.equal(r.worstWeekday?.weekday, 1);
  assert.deepEqual(r.missedVsDone!.badShare, [100, 0]);
  assert.equal(r.missedTags[0].tag, "réunions");
  assert.ok(r.suggestions.some((s) => s.action?.type === "slot"));
  assert.ok(r.suggestions.some((s) => s.action?.type === "restart"));
  assert.ok(L.isChallengeEnded(g, "2026-11-23"));
  const ng = L.goalFromAction(g, { type: "unlimited", target: 5 }, "2026-11-23");
  assert.equal(ng.endDate, null);
  assert.equal(ng.periodStart, "2026-11-23");
});
console.log(`${passed} groupes au total (avec bilan)`);

t("routine du matin configurable", () => {
  // Ancien réglage repris, puis nouveau format.
  assert.deepEqual(L.parseMorningSettings({ morning_criteria: "sleep_plan" }).steps, ["sleep", "plan"]);
  assert.deepEqual(L.parseMorningSettings({}).steps, ["sleep"]);
  const m = { ...L.DEFAULT_MORNING, enabled: true, steps: ["sleep", "plan", "journal"] as L.MorningStep[], habits: ["h", "gone"] };
  const back = L.parseMorningSettings(L.serializeMorningSettings(m));
  assert.deepEqual(back, m);
  assert.deepEqual(L.parseMorningSettings({ morning_steps: "pas du json" }).steps, ["sleep"]);

  const d = empty();
  const day = "2026-11-24";
  d.habits = [{ id: "h", name: "Étirements", perWeek: 7 }];
  // "gone" n'existe pas : ignorée.
  assert.equal(L.morningChecklist(d, day, m).length, 4);
  assert.equal(L.isMorningDone(d, day, m), false);
  d.sleep[day] = { date: day, bed: "23:00", wake: "07:00", quality: 3, awakenings: 0 };
  d.plans[day] = "2026-11-24 07:30:00";
  d.morning[day] = { date: day, mood: 3, energy: null, note: "" };
  assert.equal(L.isMorningDone(d, day, m), false);
  assert.match(L.morningMessage(d, day, m).body, /étirements/);
  d.checks[day] = ["h"];
  assert.equal(L.isMorningDone(d, day, m), true);
  // Aucune étape : rien à rappeler.
  assert.equal(L.isMorningDone(empty(), day, { ...m, steps: [], habits: [] }), true);
  // Pas de rappel programmé pour un matin déjà fait.
  assert.equal(L.plannedMorning(d, { ...m, time: "08:00" }, new Date(2026, 10, 24, 6, 0), 1).length, 0);
});

t("humeur matin → soir", () => {
  const d = empty();
  d.habits = [{ id: "s", name: "Sport", perWeek: 3 }];
  const days = L.range("2026-11-10", "2026-11-23");
  days.forEach((k, i) => {
    const dropDay = i % 2 === 0;
    d.morning[k] = { date: k, mood: 3, energy: dropDay ? 1 : 3, note: "" };
    d.journal[k] = { date: k, mood: dropDay ? 1 : 3, energy: null, text: dropDay ? "#réunions" : "" };
    if (!dropDay) d.checks[k] = ["s"];
  });
  assert.equal(L.moodShift(d, days[0]), -2);
  const s = L.computeDayShift(d, "2026-11-23")!;
  assert.equal(s.days, 14);
  assert.equal(s.drops, 7);
  assert.equal(s.stable, 7);
  assert.ok(s.average < 0);
  assert.ok(s.causes.some((c) => c.text.includes("#réunions")));
  assert.ok(s.causes.some((c) => c.text.includes("Sport")));
  assert.ok(s.causes.some((c) => c.text.includes("énergie du matin")));
  assert.equal(L.computeDayShift(empty(), "2026-11-23"), null);
});
console.log(`${passed} groupes au total (avec matin)`);

t("étiquettes suggérées", () => {
  const d = empty();
  d.journal["2026-11-20"] = { date: "2026-11-20", mood: 2, energy: null, text: "Long #Travail puis #lecture" };
  d.journal["2026-11-21"] = { date: "2026-11-21", mood: 2, energy: null, text: "#travail encore" };
  d.morning["2026-11-21"] = { date: "2026-11-21", mood: 2, energy: null, note: "#lecture au réveil #yoga" };
  const s = L.suggestTags(d);
  assert.deepEqual(s.slice(0, 3), ["lecture", "travail", "yoga"]);
  assert.equal(s.filter((x) => L.fold(x) === "travail").length, 1); // pas de doublon avec la base
  d.journal["2026-11-22"] = { date: "2026-11-22", mood: 2, energy: null, text: "#reunions sans accent" };
  assert.equal(L.suggestTags(d).filter((x) => L.fold(x) === "reunions").length, 1); // accents ignorés
  assert.ok(s.includes("stress"));
  assert.equal(L.toggleTag("", "stress"), "#stress");
  assert.equal(L.toggleTag("Journée longue ", "stress"), "Journée longue #stress");
  assert.equal(L.toggleTag("Journée #stress longue", "stress"), "Journée longue");
  assert.equal(L.toggleTag("#stressé mais ok", "stress"), "#stressé mais ok #stress"); // autre mot : ajoutée
  assert.equal(L.toggleTag("Beaucoup de #Réunions", "réunions"), "Beaucoup de");
});
console.log(`${passed} groupes au total (avec étiquettes)`);

t("notes rapides", () => {
  const d = empty();
  d.notes["2026-11-24"] = [{ id: "n", date: "2026-11-24", time: "14:30", text: "Réunion tendue #stress" }];
  assert.equal(L.suggestTags(d)[0], "stress");
  const r = L.search(d, "tendue");
  assert.equal(r.length, 1);
  assert.equal(r[0].hits[0].label, "14:30");
});

t("champ d'heure : pas de 15 min", () => {
  assert.equal(L.stepTime("23:20", 1), "23:30");
  assert.equal(L.stepTime("23:20", -1), "23:15");
  assert.equal(L.stepTime("23:30", 1), "23:45");
  assert.equal(L.stepTime("23:45", 1), "00:00"); // passe minuit
  assert.equal(L.stepTime("00:00", -1), "23:45");
  assert.equal(L.stepTime("07:07", 1), "07:15");
  assert.equal(L.shiftTime("23:30", 60), "00:30");
  assert.deepEqual(L.splitTime("09:58"), [10, 0]);
  assert.deepEqual(L.splitTime(""), [0, 0]); // valeur manquante
  // Saisie au clavier
  assert.equal(L.normalizeTime("2330"), "23:30");
  assert.equal(L.isValidTime(L.normalizeTime("2575")), false);
});

t("créneau en cours / ensuite", () => {
  const s = (id: string, start: string, end: string, done = false) => ({ id, date: "2026-11-25", start, end, title: id, habitId: null, ruleId: null, done, note: "" });
  const slots = [s("b", "14:00", "15:00"), s("a", "09:00", "11:00"), s("c", "16:00", "17:00", true)];
  assert.deepEqual(L.currentOrNext(slots, "10:00"), { slot: slots[1], current: true });
  assert.deepEqual(L.currentOrNext(slots, "11:00"), { slot: slots[0], current: false }); // fin exclue
  assert.equal(L.currentOrNext(slots, "16:30"), null); // le seul restant est déjà fait
  assert.equal(L.currentOrNext([], "10:00"), null);
});

t("ordre de l'onglet Aujourd'hui", () => {
  const o = { eveningFilled: false, writeEarly: false };
  const am = L.todayLayout("2026-11-25", "2026-11-25", 8, o);
  assert.equal(am.evening, false);
  assert.equal(am.showEvening, false);
  assert.equal(am.order[0], "routine");
  assert.ok(am.order.indexOf("habits") < am.order.indexOf("schedule")); // habitudes avant l'emploi du temps
  assert.equal(L.todayLayout("2026-11-25", "2026-11-25", 8, { ...o, writeEarly: true }).showEvening, true);
  assert.equal(L.todayLayout("2026-11-25", "2026-11-25", 8, { ...o, eveningFilled: true }).showEvening, true);
  const pm = L.todayLayout("2026-11-25", "2026-11-25", 17, o);
  assert.equal(pm.showEvening, true);
  assert.equal(pm.order[1], "evening");
  assert.equal(L.todayLayout("2026-11-24", "2026-11-25", 8, o).showEvening, true); // jour passé
  assert.equal(L.todayLayout("2026-11-26", "2026-11-25", 20, o).showEvening, false); // jour à venir
  for (const l of [am, pm]) assert.equal(new Set(l.order).size, 8); // chaque carte une seule fois
});

t("jour noté dans le journal", () => {
  const d = empty();
  assert.equal(L.isDayNoted(d, "2026-11-25"), false);
  d.notes["2026-11-25"] = [{ id: "n", date: "2026-11-25", time: "10:00", text: "x" }];
  assert.equal(L.isDayNoted(d, "2026-11-25"), true);
  d.morning["2026-11-24"] = { date: "2026-11-24", mood: null, energy: null, note: "" };
  assert.equal(L.isDayNoted(d, "2026-11-24"), false); // entrée vide
  d.morning["2026-11-24"].mood = 2;
  assert.equal(L.isDayNoted(d, "2026-11-24"), true);
});

t("données extrêmes", () => {
  const d = empty();
  const long = "x".repeat(5000) + " #" + "é".repeat(200);
  d.habits = Array.from({ length: 60 }, (_, i) => ({ id: `h${i}`, name: `Habitude ${i} ${"très longue ".repeat(5)}`, perWeek: 7 }));
  for (const k of L.range("2025-11-26", "2026-11-25")) {
    d.journal[k] = { date: k, mood: (k.charCodeAt(9) % 5) as L.Mood, energy: 2, text: long };
    d.morning[k] = { date: k, mood: 3, energy: 1, note: "#fatigue" };
    d.notes[k] = Array.from({ length: 30 }, (_, i) => ({ id: `${k}-${i}`, date: k, time: "12:00", text: `#tag${i % 40}` }));
  }
  const tags = L.suggestTags(d);
  assert.ok(tags.length >= 40);
  assert.equal(new Set(tags.map(L.fold)).size, tags.length);
  const s = L.computeDayShift(d, "2026-11-25");
  assert.ok(s && s.causes.length <= 4);
  assert.ok(L.morningChecklist(d, "2026-11-25", { ...L.DEFAULT_MORNING, habits: d.habits.map((h) => h.id) }).length === 61);
  assert.ok(L.search(d, "tag1").length > 0);
  assert.equal(L.toggleTag(long, "fatigue").endsWith("#fatigue"), true);
});
console.log(`${passed} groupes au total`);
