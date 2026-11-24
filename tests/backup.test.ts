import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { BackupError, decryptBackup, encryptBackup, fromBase64, readEnvelope, toBase64 } from "../src/backup/crypto";
import { dumpDatabase, restoreDatabase } from "../src/db/backup";

let passed = 0;
const t = async (name: string, fn: () => Promise<void> | void) => {
  await fn();
  passed++;
  console.log("ok -", name);
};
const rnd = (n: number) => new Uint8Array(randomBytes(n));

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

async function main() {
  await t("base64", () => {
    for (const n of [0, 1, 2, 3, 4, 31, 32, 33, 1000]) {
      const b = rnd(n);
      assert.equal(toBase64(b), Buffer.from(b).toString("base64"));
      assert.deepEqual(fromBase64(toBase64(b)), b);
    }
  });

  await t("chiffrement : aller-retour, accents compris", async () => {
    const plain = JSON.stringify({ note: "Journée très réussie ✓ #sommeil", n: 42 });
    const file = await encryptBackup(plain, "mot de passe é", rnd, 1000);
    assert.ok(!file.includes("réussie"));
    assert.equal(readEnvelope(file).kdf.iterations, 1000);
    assert.equal(await decryptBackup(file, "mot de passe é"), plain);
  });

  await t("mauvais mot de passe et fichier modifié refusés", async () => {
    const file = await encryptBackup("secret", "bon-mot-de-passe", rnd, 1000);
    await assert.rejects(decryptBackup(file, "mauvais-mot-de-passe"), BackupError);
    const env = JSON.parse(file);
    const data = fromBase64(env.data);
    data[0] ^= 1;
    env.data = toBase64(data);
    await assert.rejects(decryptBackup(JSON.stringify(env), "bon-mot-de-passe"), BackupError);
    assert.throws(() => readEnvelope("pas du json"), BackupError);
  });

  await t("export puis restauration de la base", async () => {
    const src = fakeDb();
    const schema = `
      CREATE TABLE habits (id TEXT PRIMARY KEY, name TEXT, per_week INTEGER, archived INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
      CREATE TABLE habit_checks (habit_id TEXT, date TEXT, created_at TEXT, PRIMARY KEY (habit_id, date));
      CREATE TABLE recurring_rules (id TEXT PRIMARY KEY, title TEXT);
      CREATE TABLE slots (id TEXT PRIMARY KEY, date TEXT, note TEXT);
      CREATE TABLE journal_entries (date TEXT PRIMARY KEY, mood INTEGER, energy INTEGER, text TEXT);
      CREATE TABLE goals (id TEXT PRIMARY KEY, title TEXT, end_date TEXT);
      CREATE TABLE weekly_reviews (week_start TEXT PRIMARY KEY, good TEXT);
      CREATE TABLE sleep_entries (date TEXT PRIMARY KEY, bed_time TEXT, wake_time TEXT, quality INTEGER, awakenings INTEGER);
      CREATE TABLE morning_entries (date TEXT PRIMARY KEY, mood INTEGER, energy INTEGER, note TEXT);
      CREATE TABLE day_plans (date TEXT PRIMARY KEY, validated_at TEXT);
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
      PRAGMA user_version = 2;`;
    src.raw.exec(schema);
    src.raw.exec(`INSERT INTO habits (id, name, per_week) VALUES ('h1', 'Méditation', 5);
      INSERT INTO habit_checks (habit_id, date) VALUES ('h1', '2026-11-23');
      INSERT INTO journal_entries VALUES ('2026-11-23', 3, 2, 'Bonne journée #travail');
      INSERT INTO goals VALUES ('g1', 'Lire', NULL);
      INSERT INTO sleep_entries VALUES ('2026-11-23', '23:15', '07:05', 3, 1);
      INSERT INTO morning_entries VALUES ('2026-11-23', 2, 1, 'Fatigué');
      INSERT INTO day_plans VALUES ('2026-11-23', '2026-11-23 07:40:00');`);
    const dump = await dumpDatabase(src as never);
    const file = await encryptBackup(JSON.stringify(dump), "motdepasse", rnd, 1000);

    const dst = fakeDb();
    dst.raw.exec(schema);
    dst.raw.exec(`INSERT INTO habits (id, name, per_week) VALUES ('old', 'Ancienne', 7);`);
    await restoreDatabase(dst as never, JSON.parse(await decryptBackup(file, "motdepasse")));
    assert.deepEqual(dst.raw.prepare("SELECT id, name FROM habits").all().map((r) => ({ ...r })), [{ id: "h1", name: "Méditation" }]);
    assert.equal((dst.raw.prepare("SELECT text FROM journal_entries").get() as { text: string }).text, "Bonne journée #travail");
    assert.equal((dst.raw.prepare("SELECT wake_time FROM sleep_entries").get() as { wake_time: string }).wake_time, "07:05");

    assert.equal((dst.raw.prepare("SELECT note FROM morning_entries").get() as { note: string }).note, "Fatigué");
    assert.equal(dst.raw.prepare("SELECT COUNT(*) AS n FROM day_plans").get()!.n, 1);

    // Ancienne base sans les tables du matin : export possible, restauration qui les ignore.
    const old = fakeDb();
    old.raw.exec(schema.replace(/CREATE TABLE (morning_entries|day_plans)[^;]*;/g, ""));
    const oldDump = await dumpDatabase(old as never);
    assert.equal(oldDump.tables.morning_entries, undefined);
    await restoreDatabase(old as never, dump);

    // Sauvegarde plus récente que l'appli : refusée, données intactes.
    await assert.rejects(restoreDatabase(dst as never, { ...dump, schemaVersion: 99 }));
    assert.equal(dst.raw.prepare("SELECT COUNT(*) AS n FROM habits").get()!.n, 1);
  });

  console.log(`\n${passed} tests de sauvegarde réussis`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
