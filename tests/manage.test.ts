// Restore from an export, delete a patient, and clear demo data.
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { checkInKey, db, reviewKey } from "../src/data/db";
import { buildExport } from "../src/data/exporter";
import { deletePatient, parseBackup, removeDemoData, restoreBackup } from "../src/data/manage";

// A backup only restores dates from 2020 on, so the fixtures sit at a realistic date.
const T0 = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;

async function seed() {
  await db.patients.bulkAdd([
    { id: "P-01", anchor: T0 },
    { id: "P-DEMO-A", anchor: T0, demo: true },
  ]);
  await db.observations.bulkAdd([
    { patientId: "P-01", itemId: 7, at: T0 + 1000, loggedAt: T0 + 1000 },
    { patientId: "P-01", itemId: 13, at: T0 + 2000, loggedAt: T0 + 2100, approx: true, before: "Mealtime" },
    { patientId: "P-DEMO-A", itemId: 1, at: T0 + 3000, loggedAt: T0 + 3000 },
    {
      patientId: "P-01",
      itemId: 16,
      at: T0 + 4000,
      loggedAt: T0 + 4000,
      before: "Other",
      beforeNote: "fire alarm test",
    },
  ]);
  await db.reviews.put({
    key: reviewKey("P-01", T0, 7),
    patientId: "P-01",
    windowStart: T0,
    itemId: 7,
    choice: 8,
    derived: 2,
    reviewedAt: T0 + 5000,
  });
  await db.checkins.put({
    key: checkInKey("P-01", T0 + DAY),
    patientId: "P-01",
    day: T0 + DAY,
    at: T0 + DAY + 4_000_000,
  });
}

beforeEach(async () => {
  db.close();
  await Dexie.delete("cmai-tracker");
  await db.open();
});

describe("restore from backup", () => {
  it("brings back everything an export holds", async () => {
    await seed();
    const { json } = await buildExport(T0 + 100_000_000);
    await Dexie.delete("cmai-tracker");
    await db.open();
    const r = await restoreBackup(json);
    expect(r).toMatchObject({ patients: 2, observations: 4, reviews: 1, checkins: 1 });
    expect(await db.patients.get("P-DEMO-A")).toEqual({ id: "P-DEMO-A", anchor: T0, demo: true });
    const obs = await db.observations.where("patientId").equals("P-01").sortBy("at");
    expect(obs[1]).toMatchObject({ itemId: 13, approx: true, before: "Mealtime" });
    expect(obs[2]).toMatchObject({ itemId: 16, before: "Other", beforeNote: "fire alarm test" });
    expect((await db.reviews.get(reviewKey("P-01", T0, 7)))?.choice).toBe(8);
    expect(await db.checkins.count()).toBe(1);
  });

  it("names the app version, build commit and scoring rule that made it", async () => {
    const data = JSON.parse((await buildExport(100_000)).json);
    expect(data.appVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(data.build).toMatch(/^([0-9a-f]{7}|unknown)$/);
    expect(data.ruleVersion).toBe("cmai-count-rule-2");
  });

  it("restoring the same file twice adds nothing the second time", async () => {
    await seed();
    const { json } = await buildExport(T0 + 100_000_000);
    const r = await restoreBackup(json);
    expect(r.patients).toBe(0);
    expect(r.observations).toBe(0);
    expect(await db.observations.count()).toBe(4);
  });

  it("the observations CSV carries the note written for Other", async () => {
    await seed();
    const { observationsCsv } = await buildExport(T0 + 100_000_000);
    const lines = observationsCsv.split("\n");
    expect(lines[0]).toContain("what_happened_before,before_note,logged_at");
    expect(lines.find((l) => l.includes("Other"))).toContain("Other,fire alarm test,");
  });

  it("refuses a file that is not a backup, with a readable message", () => {
    expect(() => parseBackup("not json")).toThrow(/not a CMAI Tracker backup/);
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a CMAI Tracker backup/);
  });

  it("skips malformed rows instead of failing the whole file", () => {
    const b = parseBackup(
      JSON.stringify({
        patients: [{ id: "P-01", anchor: T0 }, { id: "" }],
        observations: [
          { patientId: "P-01", itemId: 99, at: T0, loggedAt: T0 },
          { patientId: "P-01", itemId: 3, at: T0, loggedAt: T0 },
        ],
      }),
    );
    expect(b.patients).toHaveLength(1);
    expect(b.observations).toHaveLength(1);
    expect(b.skipped).toBe(2);
  });
});

describe("restore checks every entry (F-31)", () => {
  // The audit's bad file: a name used as a code, a half item number, and a log for a patient not in the file.
  const bad = JSON.stringify({
    patients: [{ id: "Jane Doe", anchor: T0 }],
    observations: [
      { patientId: "P-01", itemId: 7.5, at: T0, loggedAt: T0 },
      { patientId: "P-77", itemId: 7, at: T0, loggedAt: T0 },
    ],
  });

  it("leaves the bad file out and counts it", async () => {
    const r = await restoreBackup(bad);
    expect(r).toMatchObject({ patients: 0, observations: 0, skipped: 3 });
    expect(await db.patients.count()).toBe(0);
    expect(await db.observations.count()).toBe(0);
  });

  it("export still works after restoring it", async () => {
    await restoreBackup(bad);
    await expect(buildExport(T0 + DAY)).resolves.toBeTruthy();
  });

  it("stores only the named fields", async () => {
    const file = JSON.stringify({
      patients: [{ id: "P-01", anchor: T0, evil: "x" }],
      observations: [{ patientId: "P-01", itemId: 3, at: T0 + 5, loggedAt: T0 + 5, evil: "x" }],
    });
    const r = await restoreBackup(file);
    expect(r).toMatchObject({ patients: 1, observations: 1, skipped: 0 });
    expect(await db.patients.get("P-01")).not.toHaveProperty("evil");
    expect(await db.observations.toCollection().first()).not.toHaveProperty("evil");
  });

  it("rejects dates outside the range and over-long text", () => {
    const b = parseBackup(
      JSON.stringify({
        patients: [
          { id: "P-01", anchor: Date.UTC(2019, 11, 31) },
          { id: "P-02", anchor: T0 + 10 * 365 * DAY },
          { id: "P-03", anchor: T0 },
        ],
        observations: [{ patientId: "P-03", itemId: 1, at: T0, loggedAt: T0, before: "x".repeat(41) }],
      }),
      T0 + DAY,
    );
    expect(b.patients.map((p) => p.id)).toEqual(["P-03"]);
    expect(b.observations).toHaveLength(0);
    expect(b.skipped).toBe(3);
  });

  it("checks reviews, check-ins and change history the same way", () => {
    const good = {
      key: "P-01|1|7",
      patientId: "P-01",
      windowStart: T0,
      itemId: 7,
      choice: 8,
      derived: 2,
      reviewedAt: T0,
    };
    const b = parseBackup(
      JSON.stringify({
        patients: [],
        observations: [],
        reviews: [
          good,
          { ...good, key: "" },
          { ...good, choice: 10 },
          { ...good, derived: "2" },
          { ...good, itemId: 30 },
          { ...good, patientId: "a name" },
        ],
        checkins: [
          { key: "k", patientId: "P-01", day: T0, at: T0 },
          { key: "k", patientId: "P-01", day: "x", at: T0 },
          { key: "", patientId: "P-01", day: T0, at: T0 },
        ],
        changes: [
          {
            observationId: 1,
            patientId: "P-01",
            action: "edit",
            at: T0,
            from: { approx: false },
            to: { approx: true, evil: "x" },
          },
          { observationId: 1.5, patientId: "P-01", action: "edit", at: T0 },
          { observationId: 1, patientId: "P-01", action: "erase", at: T0 },
          { observationId: 1, patientId: "P-01", action: "delete", at: T0, to: { itemId: 99 } },
        ],
      }),
      T0 + DAY,
    );
    expect(b.reviews).toHaveLength(1);
    expect(b.checkins).toHaveLength(1);
    expect(b.changes).toHaveLength(2);
    expect(b.changes[0].to).toEqual({ approx: true });
    expect(b.changes[1]).not.toHaveProperty("to");
    expect(b.skipped).toBe(5 + 2 + 2);
  });

  it("rejects logs with a bad id, flag or demo mark", () => {
    const log = { patientId: "P-01", itemId: 3, at: T0, loggedAt: T0 };
    const b = parseBackup(
      JSON.stringify({
        patients: [
          { id: "P-01", anchor: T0, demo: "yes" },
          { id: "P-02", anchor: T0, demo: true },
        ],
        observations: [
          { ...log, id: 1.5 },
          { ...log, approx: "yes" },
          { ...log, id: 4 },
          { ...log, itemId: 3, at: "x" },
        ],
      }),
      T0 + DAY,
    );
    expect(b.patients).toEqual([{ id: "P-02", anchor: T0, demo: true }]);
    expect(b.observations).toEqual([{ ...log, id: 4 }]);
    expect(b.skipped).toBe(4);
  });

  it("drops history and reviews for a patient that is not on the phone or in the file", async () => {
    const r = await restoreBackup(
      JSON.stringify({
        patients: [],
        observations: [],
        reviews: [{ key: "k", patientId: "P-55", windowStart: T0, itemId: 7, choice: 8, derived: 2, reviewedAt: T0 }],
        checkins: [{ key: "k", patientId: "P-55", day: T0, at: T0 }],
        changes: [{ observationId: 1, patientId: "P-55", action: "edit", at: T0 }],
      }),
    );
    expect(r).toMatchObject({ reviews: 0, checkins: 0, skipped: 3 });
  });

  it("a log may belong to a patient already on this phone", async () => {
    await db.patients.add({ id: "P-01", anchor: T0 });
    const r = await restoreBackup(
      JSON.stringify({ patients: [], observations: [{ patientId: "P-01", itemId: 3, at: T0 + 5, loggedAt: T0 + 5 }] }),
    );
    expect(r).toMatchObject({ observations: 1, skipped: 0 });
  });

  it("a real export restores with nothing skipped", async () => {
    await seed();
    const { json } = await buildExport(T0 + 100_000_000);
    await Dexie.delete("cmai-tracker");
    await db.open();
    expect((await restoreBackup(json)).skipped).toBe(0);
  });
});

describe("deleting", () => {
  it("delete patient removes its logs, reviews and check-ins only", async () => {
    await seed();
    await deletePatient("P-01");
    expect(await db.patients.get("P-01")).toBeUndefined();
    expect(await db.observations.where("patientId").equals("P-01").count()).toBe(0);
    expect(await db.reviews.count()).toBe(0);
    expect(await db.checkins.count()).toBe(0);
    expect(await db.observations.where("patientId").equals("P-DEMO-A").count()).toBe(1);
  });

  it("remove demo data keeps real patients", async () => {
    await seed();
    expect(await removeDemoData()).toBe(1);
    expect((await db.patients.toArray()).map((p) => p.id)).toEqual(["P-01"]);
    expect(await db.observations.count()).toBe(3);
  });
});
