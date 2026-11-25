import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { addNote, deleteNote, saveJournal, saveMorning, setPlanValidated, updateNote } from "../src/db/actions";
import { loadData } from "../src/db/repo";
import { migrate } from "../src/db/schema";

let passed = 0;
const t = async (name: string, fn: () => Promise<void> | void) => {
  await fn();
  passed++;
  console.log("ok -", name);
};

/** Base SQLite en mémoire, présentée comme celle d'expo-sqlite (sous-ensemble utilisé). */
function fakeDb() {
  const d = new DatabaseSync(":memory:");
  return {
    raw: d,
    async getFirstAsync<T>(sql: string, ...p: unknown[]) {
      return (d.prepare(sql).get(...(p as never[])) ?? null) as T | null;
    },
    async getAllAsync<T>(sql: string, ...p: unknown[]) {
      return d.prepare(sql).all(...(p as never[])) as T[];
    },
    async runAsync(sql: string, ...p: unknown[]) {
      d.prepare(sql).run(...(p as never[]));
      return { lastInsertRowId: 0, changes: 0 };
    },
    async execAsync(sql: string) {
      d.exec(sql);
    },
    async withTransactionAsync(fn: () => Promise<void>) {
      d.exec("BEGIN");
      try {
        await fn();
        d.exec("COMMIT");
      } catch (e) {
        d.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

const tables = (db: ReturnType<typeof fakeDb>) =>
  (db.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map((r) => r.name);
const version = (db: ReturnType<typeof fakeDb>) => (db.raw.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;

async function main() {
  await t("migration depuis une base vide, puis relancée sans effet", async () => {
    const db = fakeDb();
    await migrate(db as never);
    for (const n of ["morning_entries", "day_plans", "day_notes", "journal_entries", "sleep_entries"]) assert.ok(tables(db).includes(n), n);
    assert.equal(version(db), 5);
    await migrate(db as never); // déjà à jour
    assert.equal(version(db), 5);
  });

  await t("migration d'une base v3 existante (données gardées)", async () => {
    const db = fakeDb();
    await migrate(db as never);
    db.raw.exec("DROP TABLE morning_entries; DROP TABLE day_plans; DROP TABLE day_notes; PRAGMA user_version = 3;");
    db.raw.exec("INSERT INTO journal_entries (date, mood, energy, text) VALUES ('2026-11-20', 3, 2, 'avant')");
    await migrate(db as never);
    assert.equal(version(db), 5);
    const data = await loadData(db as never);
    assert.equal(data.journal["2026-11-20"].text, "avant");
    assert.deepEqual(data.morning, {});
    assert.deepEqual(data.notes, {});
  });

  await t("matin, soir, planning validé et notes : enregistrés et relus", async () => {
    const db = fakeDb();
    await migrate(db as never);
    const day = "2026-11-25";
    await saveMorning(db as never, day, { mood: 3, energy: 1, note: "Intention #calme" });
    await saveMorning(db as never, day, { mood: 4, energy: 1, note: "Intention #calme" }); // mise à jour
    await saveJournal(db as never, day, { mood: 1, energy: 0, text: "Soirée #fatigue" });
    await setPlanValidated(db as never, day, true);
    await addNote(db as never, day, "14:30", "Réunion tendue #stress");
    await addNote(db as never, day, "09:05", "Café");
    let data = await loadData(db as never);
    assert.equal(data.morning[day].mood, 4);
    assert.equal(data.journal[day].text, "Soirée #fatigue");
    assert.ok(data.plans[day]);
    assert.deepEqual(data.notes[day].map((n) => n.time), ["09:05", "14:30"]); // dans l'ordre de l'heure
    await updateNote(db as never, data.notes[day][1].id, "Réunion OK");
    await deleteNote(db as never, data.notes[day][0].id);
    await setPlanValidated(db as never, day, false);
    data = await loadData(db as never);
    assert.deepEqual(data.notes[day].map((n) => n.text), ["Réunion OK"]);
    assert.equal(data.plans[day], undefined);
  });

  await t("textes extrêmes et beaucoup de notes", async () => {
    const db = fakeDb();
    await migrate(db as never);
    const long = "é😀".repeat(20000);
    await saveMorning(db as never, "2026-11-25", { mood: null, energy: null, note: long });
    for (let i = 0; i < 500; i++) await addNote(db as never, "2026-11-25", "12:00", `n${i} ${long.slice(0, 50)}`);
    const data = await loadData(db as never);
    assert.equal(data.morning["2026-11-25"].note, long);
    assert.equal(data.notes["2026-11-25"].length, 500);
    assert.equal(new Set(data.notes["2026-11-25"].map((n) => n.id)).size, 500); // identifiants uniques
  });

  console.log(`${passed} groupes de tests base de données réussis`);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
