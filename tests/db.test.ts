// Upgrades must keep every patient, log and review, and never move a score.
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { checkInKey, db, isLive, madeHere, thisDevice, type StoredObservation } from "../src/data/db";
import { buildExport } from "../src/data/exporter";
import { utcOffsetMin } from "../src/data/ids";
import { deletePatient, restoreBackup, wouldArchive } from "../src/data/manage";
import { scoreAllWindows } from "../src/scoring/engine";
import backupV3 from "./fixtures/backup-v3.json";

const V1 = { patients: "id", observations: "++id, patientId, [patientId+at]", reviews: "key, patientId" };
const NOW = Date.parse(backupV3.exportedAt);

/** Opens the database as release 0.2.0 (version 3) left it, filled from the made-up fixture. */
async function makeV3() {
  db.close();
  await Dexie.delete("cmai-tracker");
  const v3 = new Dexie("cmai-tracker");
  v3.version(1).stores(V1);
  v3.version(2).stores({ checkins: "key, patientId" });
  v3.version(3).stores({ changes: "++id, patientId, observationId" });
  await v3.table("patients").bulkAdd(backupV3.patients);
  await v3.table("observations").bulkAdd(backupV3.observations);
  await v3.table("reviews").bulkAdd(backupV3.reviews);
  await v3.table("checkins").bulkAdd(backupV3.checkins);
  await v3.table("changes").bulkAdd(backupV3.changes);
  v3.close();
}

/** Every score for every patient, as the Scores screen and the export work them out. */
async function allScores() {
  const out: Record<string, unknown> = {};
  for (const p of await db.patients.toArray()) {
    const logs = (await db.observations.where("patientId").equals(p.id).toArray()).filter(isLive);
    out[p.id] = scoreAllWindows(logs, p.anchor, NOW);
  }
  return out;
}

beforeEach(async () => {
  db.close();
  await Dexie.delete("cmai-tracker");
});

describe("database upgrade from version 1", () => {
  it("keeps version 1 data and adds the later tables empty", async () => {
    const v1 = new Dexie("cmai-tracker");
    v1.version(1).stores(V1);
    await v1.table("patients").add({ id: "P-01", anchor: 0 });
    await v1.table("observations").add({ patientId: "P-01", itemId: 7, at: 1000, loggedAt: 1000 });
    await v1
      .table("reviews")
      .put({ key: "P-01|0|7", patientId: "P-01", windowStart: 0, itemId: 7, choice: 3, derived: 2, reviewedAt: 2000 });
    v1.close();

    await db.open();
    expect(db.verno).toBe(4);
    expect(await db.patients.toArray()).toEqual([{ id: "P-01", anchor: 0 }]);
    expect(await db.observations.count()).toBe(1);
    expect((await db.reviews.get("P-01|0|7"))?.choice).toBe(3);
    expect(await db.checkins.count()).toBe(0);
    expect(await db.changes.count()).toBe(0);
    // Logs from before soft delete have no deletedAt, so they all still count.
    expect((await db.observations.toArray()).every(isLive)).toBe(true);

    await db.checkins.put({ key: checkInKey("P-01", 0), patientId: "P-01", day: 0, at: 5000 });
    await db.checkins.put({ key: checkInKey("P-01", 0), patientId: "P-01", day: 0, at: 6000 });
    expect(await db.checkins.where("patientId").equals("P-01").count()).toBe(1);
  });
});

describe("database version 4 (F-44, plan 5.1)", () => {
  it("upgrading from version 3 keeps every row, gives each log its own ID and moves no score", async () => {
    await makeV3();
    // Scores worked out from the version 3 rows, before the upgrade.
    const before: Record<string, unknown> = {};
    for (const p of backupV3.patients) {
      const logs = (backupV3.observations as StoredObservation[]).filter((o) => o.patientId === p.id && isLive(o));
      before[p.id] = scoreAllWindows(logs, p.anchor, NOW);
    }

    await db.open();
    expect(db.verno).toBe(4);
    const logs = await db.observations.toArray();
    expect(logs).toHaveLength(backupV3.observations.length);
    expect(new Set(logs.map((o) => o.uid)).size).toBe(logs.length);
    expect(logs.every((o) => typeof o.uid === "string" && o.uid.length >= 8)).toBe(true);
    // Nothing else is filled in: nobody knows who made an old log, or the phone's offset then.
    expect(logs.some((o) => "by" in o || "deviceId" in o || "tzOffsetMin" in o)).toBe(false);
    expect(await db.patients.count()).toBe(backupV3.patients.length);
    expect(await db.reviews.count()).toBe(backupV3.reviews.length);
    expect(await db.checkins.count()).toBe(backupV3.checkins.length);
    expect(await db.changes.count()).toBe(backupV3.changes.length);
    expect((await db.meta.get("deviceId"))?.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof (await db.meta.get("createdAt"))?.value).toBe("number");
    expect(thisDevice()).toBe((await db.meta.get("deviceId"))?.value);
    expect(await allScores()).toEqual(before);
  });

  it("a phone that starts at version 4 gets a device ID too", async () => {
    await db.open();
    expect((await db.meta.get("deviceId"))?.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(madeHere()).toEqual({ deviceId: thisDevice() });
  });

  it("every new log gets a unique ID however it is added", async () => {
    await db.open();
    await db.observations.bulkAdd([
      { patientId: "P-01", itemId: 1, at: 1, loggedAt: 1 },
      { patientId: "P-01", itemId: 1, at: 2, loggedAt: 2 },
    ]);
    const uids = (await db.observations.toArray()).map((o) => o.uid);
    expect(new Set(uids).size).toBe(2);
    await expect(
      db.observations.add({ uid: uids[0], patientId: "P-01", itemId: 2, at: 3, loggedAt: 3 }),
    ).rejects.toThrow();
  });

  it("the UTC offset reads as a clock does: west of UTC is negative", () => {
    const at = Date.UTC(2026, 0, 15);
    expect(utcOffsetMin(at)).toBe(-new Date(at).getTimezoneOffset() || 0);
    expect(Object.is(utcOffsetMin(at), -0)).toBe(false);
  });

  it("a version 3 backup restores into version 4 with nothing skipped, and twice adds nothing", async () => {
    await db.open();
    const raw = JSON.stringify(backupV3);
    const first = await restoreBackup(raw);
    expect(first).toMatchObject({ patients: 2, observations: backupV3.observations.length, skipped: 0 });
    const second = await restoreBackup(raw);
    expect(second).toMatchObject({ patients: 0, observations: 0, skipped: 0 });
    expect(await db.observations.count()).toBe(backupV3.observations.length);
    expect(await db.changes.count()).toBe(1);
  });

  it("a version 4 backup restores on another phone with the same IDs, and twice adds nothing", async () => {
    await makeV3();
    await db.open();
    const { json } = await buildExport(NOW);
    const uids = (await db.observations.toArray()).map((o) => o.uid).sort();
    const scores = await allScores();
    expect(JSON.parse(json)).toMatchObject({ formatVersion: 2, deviceId: thisDevice() });

    db.close();
    await Dexie.delete("cmai-tracker");
    await db.open();
    expect((await restoreBackup(json)).skipped).toBe(0);
    expect((await restoreBackup(json)).observations).toBe(0);
    expect((await db.observations.toArray()).map((o) => o.uid).sort()).toEqual(uids);
    expect(await allScores()).toEqual(scores);
  });

  it("a backup never carries PIN fields", async () => {
    await db.open();
    await db.caregivers.add({
      id: "C-01",
      initials: "JM",
      createdAt: NOW,
      pinSalt: new Uint8Array(16).fill(1),
      pinHash: new Uint8Array(32).fill(2),
      pinIterations: 600_000,
      failedAttempts: 3,
      lockedAt: NOW,
    });
    const { json } = await buildExport(NOW);
    for (const word of ["pinSalt", "pinHash", "pinIterations", "failedAttempts", "lockedAt"])
      expect(json).not.toContain(word);
    expect(JSON.parse(json).caregivers).toEqual([{ id: "C-01", initials: "JM", createdAt: NOW }]);
  });

  it("a restore never stores PIN fields from a file, and never replaces a caregiver on the phone", async () => {
    await db.open();
    await db.patients.add({ id: "P-01", anchor: NOW });
    await db.caregivers.add({ id: "C-01", initials: "JM", createdAt: NOW, pinIterations: 600_000 });
    const file = JSON.stringify({
      patients: [],
      observations: [],
      caregivers: [
        { id: "C-01", initials: "XX", createdAt: NOW },
        { id: "C-02", initials: "AB", createdAt: NOW, pinHash: "AAAA", failedAttempts: 0 },
      ],
    });
    expect((await restoreBackup(file)).skipped).toBe(0);
    expect(await db.caregivers.get("C-01")).toMatchObject({ initials: "JM", pinIterations: 600_000 });
    expect(await db.caregivers.get("C-02")).toEqual({ id: "C-02", initials: "AB", createdAt: NOW });
  });
});

describe("archive instead of erase (D-20)", () => {
  beforeEach(async () => {
    await makeV3();
    await db.open();
    await db.patients.add({ id: "P-DEMO-A", anchor: NOW, demo: true });
    await db.observations.add({ patientId: "P-DEMO-A", itemId: 1, at: NOW, loggedAt: NOW });
    await db.patients.add({ id: "P-09", anchor: NOW });
  });

  it("a patient with logs is archived with a reason, and every record stays", async () => {
    const logs = await db.observations.where("patientId").equals("P-01").count();
    expect(await wouldArchive("P-01", true)).toBe(true);
    expect(await deletePatient("P-01", { reason: "Left the study" }, { archive: true, now: NOW })).toBe("archived");
    expect(await db.patients.get("P-01")).toMatchObject({ archivedAt: NOW, archiveReason: "Left the study" });
    expect(await db.observations.where("patientId").equals("P-01").count()).toBe(logs);
    expect(await db.reviews.count()).toBe(1);
  });

  it("archiving needs a reason from the list, and a note for Other", async () => {
    await expect(deletePatient("P-01", undefined, { archive: true })).rejects.toThrow(/reason/);
    await expect(deletePatient("P-01", { reason: "Gone" }, { archive: true })).rejects.toThrow(/reason/);
    await expect(deletePatient("P-01", { reason: "Other", note: "  " }, { archive: true })).rejects.toThrow(
      /few words/,
    );
    await expect(deletePatient("P-01", { reason: "Other", note: "x".repeat(121) }, { archive: true })).rejects.toThrow(
      /120/,
    );
    expect(await deletePatient("P-01", { reason: "Other", note: " moved wards " }, { archive: true, now: NOW })).toBe(
      "archived",
    );
    expect((await db.patients.get("P-01"))?.archiveNote).toBe("moved wards");
  });

  it("demo patients and patients with no logs are still erased", async () => {
    expect(await wouldArchive("P-DEMO-A", true)).toBe(false);
    expect(await wouldArchive("P-09", true)).toBe(false);
    expect(await wouldArchive("P-77", true)).toBe(false);
    expect(await deletePatient("P-DEMO-A", undefined, { archive: true })).toBe("erased");
    expect(await deletePatient("P-09", undefined, { archive: true })).toBe("erased");
    expect(await db.patients.get("P-DEMO-A")).toBeUndefined();
    expect(await db.observations.where("patientId").equals("P-DEMO-A").count()).toBe(0);
  });

  it("with archiving switched off (the caregiver build) delete erases as before", async () => {
    expect(await wouldArchive("P-01")).toBe(false);
    expect(await deletePatient("P-01")).toBe("erased");
    expect(await db.observations.where("patientId").equals("P-01").count()).toBe(0);
  });

  it("an archived patient comes back archived from a backup", async () => {
    await deletePatient("P-02", { reason: "Duplicate" }, { archive: true, now: NOW });
    const { json } = await buildExport(NOW);
    db.close();
    await Dexie.delete("cmai-tracker");
    await db.open();
    expect((await restoreBackup(json)).skipped).toBe(0);
    expect(await db.patients.get("P-02")).toMatchObject({ archivedAt: NOW, archiveReason: "Duplicate" });
  });
});
