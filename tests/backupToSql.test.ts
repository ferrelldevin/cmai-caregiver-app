// The lab database import (docs/data/lab-schema.sql, scripts/backup-to-sql.mjs): a real export
// from the app, loaded into SQLite, must come out with every row, nothing doubled on a second
// import, and bad rows left out rather than guessed at. Made-up data only.
import "fake-indexeddb/auto";
import Dexie from "dexie";
// @ts-expect-error node:sqlite ships with Node 22 but this repo has no @types/node
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error plain JavaScript module with JSDoc types
import {
  BEFORE_OPTIONS as SQL_BEFORE,
  DELETE_REASONS as SQL_REASONS,
  backupToSql,
  itemsFromSource,
  scoresCsvToSql,
  v1ObservationUid,
} from "../scripts/backup-to-sql.mjs";
import { db } from "../src/data/db";
import { buildExport } from "../src/data/exporter";
import { DELETE_REASONS, UNDO_REASON, deleteLog, editLog } from "../src/data/logs";
import { ITEMS } from "../src/scoring/items";
import { BEFORE_OPTIONS } from "../src/ui/LogSheet";
import schema from "../docs/data/lab-schema.sql?raw";
import itemsSource from "../src/scoring/items.ts?raw";

const DAY = 86_400_000;
const day1 = new Date(2026, 9, 5).getTime();

function labDb(): Db {
  const d = new DatabaseSync(":memory:");
  d.exec("PRAGMA foreign_keys = ON;");
  d.exec(schema);
  return d;
}
type Db = { prepare(sql: string): { get(): unknown }; exec(sql: string): void };
const count = (d: Db, table: string) => (d.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

async function demoExport() {
  await db.patients.bulkAdd([
    { id: "P-DEMO-A", anchor: day1, demo: true },
    { id: "P-DEMO-B", anchor: day1 + DAY },
  ]);
  await db.observations.add({
    patientId: "P-DEMO-A",
    itemId: 13,
    at: day1 + 17 * 3600e3,
    loggedAt: day1 + 17 * 3600e3 + 20e3,
  });
  const b = await db.observations.add({
    patientId: "P-DEMO-A",
    itemId: 1,
    at: day1 + 15.5 * 3600e3,
    loggedAt: day1 + 16 * 3600e3,
    approx: true,
    before: "Other",
    beforeNote: "fire alarm test, 'drill'",
  });
  const c = await db.observations.add({
    patientId: "P-DEMO-B",
    itemId: 7,
    at: day1 + DAY + 9 * 3600e3,
    loggedAt: day1 + DAY + 9 * 3600e3,
    before: "Personal care or bathing",
  });
  const now = day1 + DAY + 12 * 3600e3;
  await editLog({ id: b, ...(await db.observations.get(b))! }, { at: day1 + 15.75 * 3600e3 }, now - 3600e3);
  await deleteLog({ id: c, ...(await db.observations.get(c))! }, "Wrong patient", undefined, now - 1800e3);
  await db.checkins.put({
    key: `P-DEMO-A|${day1 + 2 * DAY}`,
    patientId: "P-DEMO-A",
    day: day1 + 2 * DAY,
    at: day1 + 2 * DAY + 20 * 3600e3,
  });
  return buildExport(day1 + 3 * DAY);
}

beforeEach(async () => {
  db.close();
  await Dexie.delete("cmai-tracker");
  await db.open();
});

describe("lab database import", () => {
  it("uses the app's own behaviors and pick lists", () => {
    expect(itemsFromSource(itemsSource)).toEqual(
      ITEMS.map((i) => ({ id: i.id, name: i.name, manualPage: i.manualPage, group: i.group })),
    );
    expect(SQL_BEFORE).toEqual(BEFORE_OPTIONS);
    expect(SQL_REASONS).toEqual([...DELETE_REASONS, UNDO_REASON]);
  });

  it("loads every row of a real export, deleted logs and history included", async () => {
    const out = await demoExport();
    const d = labDb();
    const { sql, skipped } = backupToSql(out.json, { items: ITEMS, importedAt: day1 + 4 * DAY });
    d.exec(sql);
    expect(skipped).toEqual({});
    expect(count(d, "cmai_item")).toBe(29);
    expect(count(d, "patient")).toBe(2);
    expect(count(d, "observation")).toBe(3);
    expect(count(d, "live_observation")).toBe(2);
    expect(count(d, "observation_change")).toBe(2);
    expect(count(d, "checkin")).toBe(1);
    const note = d.prepare("SELECT before_note, time_approximate FROM observation WHERE item_id = 1").get();
    expect(note).toEqual({ before_note: "fire alarm test, 'drill'", time_approximate: 1 });
    const del = d.prepare("SELECT delete_reason FROM observation WHERE deleted_at_ms IS NOT NULL").get();
    expect(del).toEqual({ delete_reason: "Wrong patient" });
    const edit = d
      .prepare(
        "SELECT o.item_id AS item FROM observation_change c JOIN observation o USING (observation_uid) WHERE c.action = 'edit'",
      )
      .get();
    expect(edit).toEqual({ item: 1 });
  });

  it("adds nothing when the same file, or a later backup of the same phone, is imported again", async () => {
    const first = await demoExport();
    const d = labDb();
    d.exec(backupToSql(first.json, { items: ITEMS }).sql);
    d.exec(backupToSql(first.json, { items: ITEMS }).sql);
    const later = await buildExport(day1 + 5 * DAY); // same logs, new export time, so a new batch
    d.exec(backupToSql(later.json, { items: ITEMS }).sql);
    expect(count(d, "observation")).toBe(3);
    expect(count(d, "observation_change")).toBe(2);
    expect(count(d, "import_batch")).toBe(2);
  });

  it("keys a format 1 log the way the app's restore spots duplicates", () => {
    const o = { patientId: "P-DEMO-A", itemId: 13, at: 1, loggedAt: 2 };
    expect(v1ObservationUid(o)).toBe(v1ObservationUid({ ...o, id: 99 }));
    expect(v1ObservationUid(o)).not.toBe(v1ObservationUid({ ...o, loggedAt: 3 }));
  });

  it("leaves out rows that break the rules and counts them", () => {
    const bad = JSON.stringify({
      exportedAt: new Date(day1).toISOString(),
      ruleVersion: "cmai-count-rule-2",
      patients: [
        { id: "Jane Doe", anchor: day1 },
        { id: "P-DEMO-A", anchor: day1 },
      ],
      observations: [
        { patientId: "P-DEMO-A", itemId: 7.5, at: day1, loggedAt: day1 },
        { patientId: "P-NONE", itemId: 7, at: day1, loggedAt: day1 },
        { patientId: "P-DEMO-A", itemId: 7, at: day1, loggedAt: day1, before: "Made up" },
        { patientId: "P-DEMO-A", itemId: 7, at: day1, loggedAt: day1 },
      ],
    });
    const d = labDb();
    const { sql, skipped } = backupToSql(bad, { items: ITEMS });
    d.exec(sql);
    expect(skipped).toEqual({ patient: 1, observation: 3 });
    expect(count(d, "patient")).toBe(1);
    expect(count(d, "observation")).toBe(1);
  });

  it("records a second start day for the same code instead of overwriting it (D-19)", () => {
    const file = (anchor: number) =>
      JSON.stringify({
        exportedAt: new Date(anchor).toISOString(),
        ruleVersion: "r",
        patients: [{ id: "P-DEMO-A", anchor }],
        observations: [],
      });
    const d = labDb();
    d.exec(backupToSql(file(day1), { items: ITEMS }).sql);
    d.exec(backupToSql(file(day1 + DAY), { items: ITEMS }).sql);
    expect(d.prepare("SELECT anchor_ms FROM patient").get()).toEqual({ anchor_ms: day1 });
    expect(d.prepare("SELECT anchor_ms FROM patient_anchor_conflict").get()).toEqual({ anchor_ms: day1 + DAY });
  });

  it("loads the format 2 tables planned in build plan v5 (caregivers, watches, ratings)", () => {
    // Format 2 does not exist in the app yet; this file follows docs/data-dictionary.md part 2.
    const t = day1 + 9 * 3600e3;
    const file = JSON.stringify({
      exportedAt: new Date(day1 + DAY).toISOString(),
      ruleVersion: "cmai-count-rule-2",
      deviceId: "dev-demo-1",
      patients: [{ id: "P-DEMO-A", anchor: day1 }],
      caregivers: [{ id: "C-01", initials: "AB", createdAt: day1 }],
      assignments: [{ caregiverId: "C-01", patientId: "P-DEMO-A", order: 0, at: day1 }],
      observations: [
        {
          uid: "obs-demo-1",
          patientId: "P-DEMO-A",
          itemId: 7,
          at: t,
          loggedAt: t,
          by: "C-01",
          tzOffsetMin: -240,
          endedAt: t + 60e3,
        },
      ],
      watches: [
        {
          uid: "w-demo-1",
          patientId: "P-DEMO-A",
          by: "C-01",
          start: t - 3600e3,
          end: t + 3600e3,
          startSource: "tap",
          endSource: "switch",
        },
      ],
      caregiverRatings: [
        {
          uid: "r-demo-1",
          patientId: "P-DEMO-A",
          windowStart: day1,
          by: "C-01",
          startedAt: t,
          submittedAt: t + 300e3,
          answers: { 7: 3, 13: 1 },
        },
      ],
    });
    const d = labDb();
    const { sql, skipped } = backupToSql(file, { items: ITEMS });
    d.exec(sql);
    expect(skipped).toEqual({});
    expect(d.prepare("SELECT logged_by, utc_offset_min, device_id FROM observation").get()).toEqual({
      logged_by: "C-01",
      utc_offset_min: -240,
      device_id: "dev-demo-1",
    });
    expect(count(d, "assignment")).toBe(1);
    expect(count(d, "watch")).toBe(1);
    expect(count(d, "caregiver_rating_answer")).toBe(2);
  });

  it("loads the scores CSV as computed ratings with their rule version", async () => {
    const out = await demoExport();
    const d = labDb();
    d.exec(backupToSql(out.json, { items: ITEMS }).sql);
    const { sql, rows } = scoresCsvToSql(out.scoresCsv, Date.parse(JSON.parse(out.json).exportedAt));
    d.exec(sql);
    expect(rows).toBe(out.scoresCsv.trim().split("\n").length - 1);
    expect(count(d, "period_score")).toBe(rows);
    const pacing = d
      .prepare(
        "SELECT log_count, derived_rating, rule_version FROM period_score WHERE patient_code = 'P-DEMO-A' AND item_id = 1",
      )
      .get();
    expect(pacing).toEqual({ log_count: 1, derived_rating: 2, rule_version: "cmai-count-rule-2" });
  });
});
