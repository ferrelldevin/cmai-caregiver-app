// The export builder on its own (F-56, design note 018): the four assumed picks, the stop on a wrong
// offset, tombstones, the range, and that it never writes to storage.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, type StoredObservation } from "../src/data/db";
import { deleteLog, editLog, restoreLog } from "../src/data/logs";
import {
  buildResearchExport,
  ExportBlocked,
  PLACEHOLDER_DEVICE_ID,
  zonedToUtc,
  zoneOffsetMin,
} from "../src/data/researchExport";

const TZ = "America/New_York";
const NOW = Date.UTC(2026, 10, 9, 15, 0, 0);
const ny = (m: number, d: number, h = 12, mi = 0) => zonedToUtc(TZ, 2026, m, d, h, mi);
const base = {
  patientId: "P-01",
  startDay: "2026-11-01",
  endDay: "2026-11-02",
  tz: TZ,
  now: NOW,
  deviceId: "d".repeat(8) + "-0000-4000-8000-" + "0".repeat(12),
};

async function add(o: Partial<StoredObservation>) {
  const at = o.at ?? ny(11, 2);
  const id = await db.observations.add({
    patientId: "P-01",
    itemId: 5,
    at,
    loggedAt: at + 60_000,
    tzOffsetMin: zoneOffsetMin(TZ, at),
    ...o,
  });
  return (await db.observations.get(id)) as StoredObservation & { id: number };
}
const records = (text: string) => JSON.parse(text).records as Record<string, unknown>[];

beforeEach(async () => {
  for (const t of db.tables) await t.clear();
  await db.patients.put({ id: "P-01", anchor: ny(10, 20, 0) });
});

describe("research export builder", () => {
  it("knows New York's offset on both sides of the 1 Nov 2026 clock change", () => {
    expect(zoneOffsetMin(TZ, ny(10, 31))).toBe(-240);
    expect(zoneOffsetMin(TZ, ny(11, 2))).toBe(-300);
    expect(zonedToUtc(TZ, 2026, 11, 2)).toBe(Date.UTC(2026, 10, 2, 5)); // local midnight after the change
    expect(zonedToUtc(TZ, 2026, 11, 1, 1, 30)).toBe(Date.UTC(2026, 10, 1, 5, 30)); // 1:30 happens twice: the first
  });

  it("uses the assumed defaults and counts each one (picks 1 to 4)", async () => {
    await add({ at: ny(11, 2, 17), by: "C-01" }); // made on this install, no offset gap
    await add({ at: ny(11, 2, 18), approx: true, tzOffsetMin: undefined }); // an older log: no install ID, no offset
    const out = await buildResearchExport(base);
    const [a, b] = records(out.text);
    expect(a).toMatchObject({
      frequency: null,
      rating_scale: "none",
      reviewed: false,
      logger_role: "caregiver",
      tz_name: TZ,
      utc_offset_min: -300,
    });
    expect(b.device_id).toBe(PLACEHOLDER_DEVICE_ID);
    expect(out.summary).toMatchObject({
      total: 2,
      active: 2,
      placeholderDevice: 2,
      defaultedRole: 2,
      noFrequency: 2,
      offsetFromZone: 1,
      approxTime: 1,
    });
    expect(JSON.parse(out.text).header).toMatchObject({ data_class: "real", record_count: 2, participant_id: "P-01" });
    expect(out.text).not.toContain("approx"); // v1.0.0 has no field for it
  });

  it("never copies this install's ID onto an old log", async () => {
    await add({ deviceId: "11111111-1111-4111-8111-111111111111" });
    await add({ at: ny(11, 2, 13) });
    const ids = records((await buildResearchExport(base)).text).map((r) => r.device_id);
    expect(ids).toEqual(["11111111-1111-4111-8111-111111111111", PLACEHOLDER_DEVICE_ID]);
  });

  it("stops and names how many logs have an offset that does not match the zone", async () => {
    await add({ at: ny(11, 2, 9), tzOffsetMin: -240 }); // the phone was somewhere else
    await add({ at: ny(11, 2, 10) });
    await add({ at: ny(11, 2, 11), tzOffsetMin: 0 });
    const before = await db.observations.count();
    await expect(buildResearchExport(base)).rejects.toThrow(
      /2 of 3 logs have a time offset that does not match America\/New_York/,
    );
    expect(await db.observations.count()).toBe(before);
  });

  it("is read-only: no table changes", async () => {
    const o = await add({});
    await editLog(o, { approx: true }, NOW - 3_600_000);
    const snap = async () => JSON.stringify(await Promise.all(db.tables.map((t) => t.toArray())));
    const before = await snap();
    await buildResearchExport(base);
    expect(await snap()).toBe(before);
  });

  it("keeps whole local days: the last day is in, the next day is out", async () => {
    await add({ at: ny(10, 31, 23, 59) });
    await add({ at: ny(11, 1, 0, 0) });
    await add({ at: ny(11, 2, 23, 59) });
    await add({ at: ny(11, 3, 0, 0) });
    const out = await buildResearchExport(base);
    expect(out.summary.total).toBe(2);
    const h = JSON.parse(out.text).header;
    expect([h.range_start_utc, h.range_end_utc]).toEqual(["2026-11-01T04:00:00Z", "2026-11-03T05:00:00Z"]);
    expect(out.fileName).toBe("cmai-export_P-01_2026-11-01_2026-11-02.json");
  });

  it("an edit raises the revision, a delete is a tombstone, a restore is a new revision (never a reused ID)", async () => {
    const o = await add({});
    const rev = async () => records((await buildResearchExport(base)).text)[0];
    expect(await rev()).toMatchObject({ revision: 1, status: "active" });
    await editLog(o, { at: o.at - 600_000 }, NOW - 3_000_000);
    const edited = await rev();
    expect(edited).toMatchObject({
      revision: 2,
      status: "active",
      revised_at_utc: new Date(NOW - 3_000_000).toISOString().slice(0, 19) + "Z",
    });
    await deleteLog(o, "Logged twice", undefined, NOW - 2_000_000);
    expect(await rev()).toMatchObject({ revision: 3, status: "deleted", record_id: edited.record_id });
    await restoreLog(o, NOW - 1_000_000);
    expect(await rev()).toMatchObject({ revision: 4, status: "active", record_id: edited.record_id });
  });

  it("counts a log edited in the last 5 minutes, which a further edit would merge into", async () => {
    const o = await add({});
    await editLog(o, { approx: true }, NOW - 60_000);
    expect((await buildResearchExport(base)).summary.recentlyEdited).toBe(1);
  });

  it("refuses with a plain message for a bad range, a non-study code, or no resident", async () => {
    await expect(buildResearchExport({ ...base, startDay: "2026-11-03" })).rejects.toBeInstanceOf(ExportBlocked);
    await expect(buildResearchExport({ ...base, startDay: "" })).rejects.toThrow(/first and last day/);
    await expect(buildResearchExport({ ...base, patientId: "p1" })).rejects.toThrow(/not a study ID/);
    await expect(buildResearchExport({ ...base, patientId: "P-77" })).rejects.toThrow(/Pick a resident/);
  });

  it("works with only a resident and two days: this phone's zone, ID and clock, and a new export ID each time", async () => {
    await db.open(); // the phone's own install ID is read when the database opens
    const at = Date.now() - 3_600_000;
    await add({ at, tzOffsetMin: undefined });
    await add({ at, itemId: 7, tzOffsetMin: undefined }); // same minute: ordered by ID, not by chance
    const day = (t: number) => new Date(t).toISOString().slice(0, 10);
    const input = { patientId: "P-01", startDay: day(at - 86_400_000 * 2), endDay: day(Date.now() + 86_400_000 * 2) };
    const a = await buildResearchExport(input);
    const b = await buildResearchExport(input);
    const header = JSON.parse(a.text).header;
    expect(header.device_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(header.app_version).toMatch(/^\d+\.\d+\.\d+/);
    expect(header.export_id).not.toBe(JSON.parse(b.text).header.export_id);
    expect(a.summary.tz).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(a.summary.total).toBe(2);
  });

  it("a demo resident is marked synthetic", async () => {
    await db.patients.put({ id: "P-01", anchor: ny(10, 20, 0), demo: true });
    await add({});
    expect(JSON.parse((await buildResearchExport(base)).text).header.data_class).toBe("synthetic");
  });

  it("takes role, frequency and review flag from the hook when one is given, and checks nothing else", async () => {
    await add({});
    const out = await buildResearchExport({ ...base, extras: () => ({ role: "staff", frequency: 4, reviewed: true }) });
    expect(records(out.text)[0]).toMatchObject({
      logger_role: "staff",
      frequency: 4,
      rating_scale: "cmai_freq_1_7",
      reviewed: true,
    });
    expect(out.summary).toMatchObject({ defaultedRole: 0, noFrequency: 0 });
  });
});
