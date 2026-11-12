// Export format 2 and the label file (D-23, plan 5.10). Made-up data only.
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mode: "caregiver" | "lab" = "lab";
vi.mock("../src/study/settings", async (orig) => {
  const real = await orig<typeof import("../src/study/settings")>();
  return {
    ...real,
    get study() {
      return real.settingsFor(mode);
    },
  };
});
vi.stubGlobal("__APP_VERSION__", "0.0.0-test");

const { db } = await import("../src/data/db");
const ex = await import("../src/data/exporter");
const { addDays } = await import("../src/scoring/engine");

const FORMAT1_OBS = [
  "patient_id",
  "item_id",
  "item_name",
  "occurred_at",
  "time_approximate",
  "what_happened_before",
  "before_note",
  "logged_at",
  "deleted_at",
  "delete_reason",
  "delete_note",
];
const FORMAT1_SCORES = [
  "patient_id",
  "window_start",
  "window_end",
  "provisional",
  "item_id",
  "item_name",
  "count",
  "derived_rating",
  "unlogged_days",
  "rule_version",
];
const header = (text: string) => text.split("\n")[0].split(",");
const ANCHOR = new Date(2026, 9, 1).getTime();
const NOW = addDays(ANCHOR, 16) + 3600_000;

beforeEach(async () => {
  mode = "lab";
  db.close();
  await Dexie.delete("cmai-tracker");
  await db.open();
  await db.patients.add({ id: "P-01", anchor: ANCHOR });
});

describe("safe cells (plan 1.6)", () => {
  it("a formula becomes plain text; commas are still quoted; codes are unchanged", () => {
    expect(ex.cell("=1+1")).toBe("'=1+1");
    expect(ex.cell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(ex.cell("a, b")).toBe('"a, b"');
    expect(ex.cell("-x, y")).toBe(`"'-x, y"`);
    expect(ex.cell("P-01")).toBe("P-01");
    expect(ex.cell(-240)).toBe("-240");
  });
});

describe("format 2 CSV headers", () => {
  it("start with every format 1 column, in the same order", async () => {
    const out = await ex.buildExport(NOW);
    expect(header(out.observationsCsv).slice(0, FORMAT1_OBS.length)).toEqual(FORMAT1_OBS);
    expect(header(out.observationsCsv)).toContain("occurred_at_local");
    expect(header(out.scoresCsv).slice(0, FORMAT1_SCORES.length)).toEqual(FORMAT1_SCORES);
    expect(header(out.scoresCsv)).toContain("period_final");
  });

  it("switch off: exactly format 1, and no new files", async () => {
    mode = "caregiver";
    const out = await ex.buildExport(NOW);
    expect(header(out.observationsCsv)).toEqual(FORMAT1_OBS);
    expect(header(out.scoresCsv)).toEqual(FORMAT1_SCORES);
    expect(out.labelsCsv + out.watchesCsv + out.caregiverRatingsCsv).toBe("");
  });
});

describe("local time", () => {
  it("23:30 local on a UTC-5 phone is the next day in UTC", () => {
    const at = Date.UTC(2026, 0, 16, 4, 30); // 23:30 on 15 Jan in New York
    expect(ex.localIso(at, -300)).toBe("2026-01-15T23:30:00.000-05:00");
    expect(new Date(at).toISOString().slice(0, 10)).toBe("2026-01-16");
    expect(ex.localIso(at, 330)).toBe("2026-01-16T10:00:00.000+05:30");
    expect(ex.localIso(at, undefined)).toBe("");
  });

  it("a log's row carries uid, device, caregiver, local time and offset", async () => {
    const at = ANCHOR + 3600_000;
    await db.observations.add({
      patientId: "P-01",
      itemId: 7,
      at,
      loggedAt: at,
      by: "C-01",
      tzOffsetMin: -240,
      beforeNote: "=HYPERLINK(1)",
    });
    const out = await ex.buildExport(NOW);
    const [head, row] = out.observationsCsv.split("\n");
    const r = Object.fromEntries(head.split(",").map((h, i) => [h, row.split(",")[i]]));
    expect(r.caregiver).toBe("C-01");
    expect(r.utc_offset_min).toBe("-240");
    expect(r.occurred_at_local).toMatch(/-04:00$/);
    expect(r.uid).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.schema_version).toBe("2");
    expect(r.before_note).toBe("'=HYPERLINK(1)");
  });
});

describe("labels.csv", () => {
  const W = (start: number, end?: number) => ({
    uid: crypto.randomUUID(),
    patientId: "P-01",
    start,
    end,
    startSource: "tap" as const,
  });

  it("each day is covered exactly by watched and unobserved stretches that never overlap", () => {
    const day2 = addDays(ANCHOR, 1);
    const watches = [
      W(day2 + 8 * 3600_000, day2 + 10 * 3600_000),
      W(day2 + 9 * 3600_000, day2 + 11 * 3600_000),
      W(day2 + 23 * 3600_000, addDays(day2, 1) + 3600_000),
    ];
    const rows = ex.labelRows("P-01", ANCHOR, [{ at: day2 + 9.5 * 3600_000, itemId: 7 }], watches, addDays(ANCHOR, 3));
    for (let d = 0; d < 3; d++) {
      const from = addDays(ANCHOR, d),
        to = addDays(ANCHOR, d + 1);
      const spans = rows
        .filter((r) => r.kind !== "behavior" && r.start >= from && r.start < to)
        .sort((a, b) => a.start - b.start);
      expect(spans[0].start).toBe(from);
      expect(spans[spans.length - 1].end).toBe(to);
      for (let i = 1; i < spans.length; i++) expect(spans[i].start).toBe(spans[i - 1].end);
    }
    const watched = rows.filter((r) => r.kind === "watched");
    expect(watched.map((r) => (r.end! - r.start) / 3600_000)).toEqual([3, 1, 1]); // overlap merged; midnight split
    expect(rows.filter((r) => r.kind === "behavior")).toHaveLength(1);
    const sorted = [...rows].sort((a, b) => a.start - b.start);
    expect(rows.map((r) => r.start)).toEqual(sorted.map((r) => r.start));
  });

  it("a resident with no watches has no watched rows", () => {
    const rows = ex.labelRows("P-01", ANCHOR, [], [], addDays(ANCHOR, 2));
    expect(rows.every((r) => r.kind === "unobserved")).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it("is written in the export, with the caregiver's rating beside the app's", async () => {
    const end = addDays(ANCHOR, 14);
    await db.observations.add({ patientId: "P-01", itemId: 7, at: ANCHOR + 1, loggedAt: ANCHOR + 1, by: "C-01" });
    await db.watches.add(W(ANCHOR + 3600_000, ANCHOR + 7200_000));
    await db.caregiverRatings.add({
      uid: crypto.randomUUID(),
      patientId: "P-01",
      windowStart: ANCHOR,
      by: "C-01",
      answers: Object.fromEntries(Array.from({ length: 29 }, (_, i) => [i + 1, i === 6 ? 2 : 8])),
      startedAt: end,
      submittedAt: end + 1,
      ruleVersion: "cmai-count-rule-2",
    });
    const out = await ex.buildExport(NOW);
    expect(out.labelsCsv).toContain("P-01,watched,");
    expect(out.labelsCsv).toContain("P-01,behavior,7,Hitting");
    expect(out.watchesCsv.split("\n")).toHaveLength(2);
    const hitting = out.caregiverRatingsCsv.split("\n").find((l) => l.includes(",7,Hitting"))!;
    expect(hitting).toContain(",2,2,true,"); // one log: the app says 2; the caregiver said 2
    expect(out.caregiverRatingsCsv.split("\n")).toHaveLength(30);
    expect(out.scoresCsv.split("\n")[1]).toMatch(/,true,60$/); // period 1 final; 60 minutes watched
  });

  it("handles old logs, open watches, ended behaviors and unfinished ratings", async () => {
    await db.observations.add({ patientId: "P-01", itemId: 3, at: ANCHOR + 5, loggedAt: ANCHOR + 5 }); // a version 3 log: no offset, no caregiver
    await db.observations.add({
      patientId: "P-01",
      itemId: 1,
      at: ANCHOR + 10,
      loggedAt: ANCHOR + 10,
      endedAt: ANCHOR + 600_010,
      approx: true,
      tzOffsetMin: 60,
    });
    await db.watches.add(W(NOW - 1800_000)); // still open: counts up to the export
    await db.caregiverRatings.add({
      uid: crypto.randomUUID(),
      patientId: "P-01",
      windowStart: ANCHOR,
      answers: { 1: 3 },
      startedAt: NOW - 5,
      ruleVersion: "cmai-count-rule-2",
    });
    await db.caregiverRatings.add({
      uid: crypto.randomUUID(),
      patientId: "P-01",
      windowStart: addDays(ANCHOR, -14),
      answers: { 1: 3 },
      startedAt: ANCHOR,
      submittedAt: ANCHOR + 1,
      ruleVersion: "cmai-count-rule-2",
    });
    const out = await ex.buildExport(NOW);
    const obs = out.observationsCsv.split("\n");
    expect(obs[1]).toMatch(/,,,,,,2,0\.0\.0-test$/); // uid filled at upgrade only, so empty here
    expect(obs[2]).toContain("+01:00,60,");
    expect(out.watchesCsv.split("\n")[1]).toMatch(/,tap,,,$/);
    expect(out.caregiverRatingsCsv.split("\n")).toHaveLength(30); // only the submitted one
    expect(out.caregiverRatingsCsv).toContain(",2,Inappropriate dressing or disrobing,,1,,");
    expect(out.labelsCsv).toContain(
      "P-01,behavior,1,Pacing, aimless wandering".replace("Pacing, aimless wandering", '"Pacing, aimless wandering"'),
    );
    expect(out.scoresCsv.split("\n").at(-1)).toMatch(/,false,30$/);
  });
});
