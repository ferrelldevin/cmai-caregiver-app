// F-64 (design note 025): a wrong behavior is corrected on the same log. Nothing is deleted, no
// second log is made, the old behavior stays in the history, and the log counts once.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, isLive, type StoredObservation } from "../src/data/db";
import { correctItem, deleteLog, editLog, LogItemError, logVersions, stopLog } from "../src/data/logs";
import { parseBackup } from "../src/data/manage";
import { buildResearchExport, zoneOffsetMin } from "../src/data/researchExport";
import { scoreAllWindows } from "../src/scoring/engine";

const TZ = "America/New_York";
const T = Date.UTC(2026, 10, 9, 15);
const MIN = 60_000;
type Saved = StoredObservation & { id: number };
async function make(itemId = 7, more: Partial<StoredObservation> = {}): Promise<Saved> {
  const id = await db.observations.add({
    patientId: "P-01",
    itemId,
    at: T,
    loggedAt: T + MIN,
    by: "C-01",
    tzOffsetMin: zoneOffsetMin(TZ, T),
    ...more,
  });
  return (await db.observations.get(id)) as Saved;
}

beforeEach(async () => {
  for (const t of db.tables) await t.clear();
  await db.patients.put({ id: "P-01", anchor: T - 86_400_000, demo: true });
});

describe("correcting a log's behavior (F-64)", () => {
  it("changes the same log: same IDs, time and maker, revision + 1, and no second log", async () => {
    const o = await make(7);
    await correctItem(o, 8, T + 10 * MIN);
    const all = await db.observations.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: o.id, uid: o.uid, itemId: 8, at: T, loggedAt: T + MIN, by: "C-01", rev: 2 });
    expect(isLive(all[0])).toBe(true);
  });

  it("keeps the old behavior in the history with the reason wrong_item", async () => {
    const o = await make(7);
    await correctItem(o, 8, T + 10 * MIN);
    expect(await db.changes.toArray()).toEqual([
      expect.objectContaining({
        observationId: o.id,
        action: "edit",
        reason: "wrong_item",
        at: T + 10 * MIN,
        from: { itemId: 7 },
        to: { itemId: 8 },
      }),
    ]);
    const v = await logVersions(o.id);
    expect(v.map((x) => [x.rev, x.action, x.reason, x.values.itemId])).toEqual([
      [1, "created", undefined, 7],
      [2, "edit", "wrong_item", 8],
    ]);
  });

  it("counts once: the old behavior loses the log and the new one gains it", async () => {
    const o = await make(7);
    const count = async (itemId: number) => {
      const live = (await db.observations.toArray()).filter(isLive);
      const windows = scoreAllWindows(live, T - 86_400_000, T + 86_400_000);
      return windows[0].items.find((i) => i.itemId === itemId)!.count;
    };
    expect([await count(7), await count(8)]).toEqual([1, 0]);
    await correctItem(o, 8);
    expect([await count(7), await count(8)]).toEqual([0, 1]);
  });

  it("refuses a number that is not a behavior, and writes nothing", async () => {
    const o = await make(7);
    for (const bad of [0, 30, 7.5, NaN]) await expect(correctItem(o, bad)).rejects.toBeInstanceOf(LogItemError);
    expect(await db.changes.count()).toBe(0);
    expect(await db.observations.get(o.id)).toMatchObject({ itemId: 7, rev: 1 });
  });

  it("returns the log as stored, so the sheet shows what another tab changed meanwhile", async () => {
    const o = await make(7);
    await editLog(o, { before: "Mealtime" }, T + 2 * MIN); // made elsewhere; `o` is now stale
    const stored = await correctItem(o, 8, T + 10 * MIN);
    expect(stored).toMatchObject({ id: o.id, itemId: 8, before: "Mealtime", rev: 3 });
  });

  it("does nothing for the same behavior or a deleted log, and says a deleted log was not saved", async () => {
    const o = await make(7);
    expect(await correctItem(o, 7)).toMatchObject({ itemId: 7, rev: 1 });
    expect(await db.changes.count()).toBe(0);
    await deleteLog(o, "Tapped by mistake", undefined, T + 2 * MIN);
    expect(await correctItem(o, 8, T + 3 * MIN)).toBeNull();
    expect(await db.observations.get(o.id)).toMatchObject({ itemId: 7, rev: 2 });
    expect(await db.changes.count()).toBe(1);
  });

  it("drops an end time when the new behavior does not come in stretches, and the history keeps it", async () => {
    const o = await make(1);
    await stopLog(o, T + 20 * MIN);
    await correctItem(o, 7, T + 30 * MIN);
    const now = await db.observations.get(o.id);
    expect(now?.itemId).toBe(7);
    expect(now?.endedAt).toBeUndefined();
    const v = await logVersions(o.id);
    expect(v.map((x) => [x.values.itemId, x.values.endedAt])).toEqual([
      [1, undefined],
      [1, T + 20 * MIN],
      [7, undefined],
    ]);
  });

  it("keeps an end time when the new behavior also comes in stretches", async () => {
    const o = await make(1);
    await stopLog(o, T + 20 * MIN);
    await correctItem(o, 26, T + 30 * MIN);
    expect(await db.observations.get(o.id)).toMatchObject({ itemId: 26, endedAt: T + 20 * MIN });
  });

  it("is never merged with a later quick edit (caregiver build merges edits 5 minutes apart)", async () => {
    const o = await make(7);
    await correctItem(o, 8, T + 10 * MIN);
    await editLog(o, { approx: true }, T + 11 * MIN);
    const changes = await db.changes.toArray();
    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({
      reason: "wrong_item",
      from: { itemId: 7 },
      to: { itemId: 8 },
      at: T + 10 * MIN,
    });
  });

  it("reaches the research export as the same record at revision 2, active, with the new item", async () => {
    const o = await make(7);
    const opts = {
      patientId: "P-01",
      startDay: "2026-11-09",
      endDay: "2026-11-09",
      tz: TZ,
      now: T + 60 * MIN,
      deviceId: "d".repeat(8) + "-0000-4000-8000-" + "0".repeat(12),
    };
    const first = JSON.parse((await buildResearchExport(opts)).text).records;
    await correctItem(o, 8, T + 10 * MIN);
    const second = JSON.parse((await buildResearchExport(opts)).text).records;
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0]).toMatchObject({ record_id: o.uid, revision: 1, status: "active", cmai_item: 7 });
    expect(second[0]).toMatchObject({ record_id: o.uid, revision: 2, status: "active", cmai_item: 8 });
    expect(second[0].occurred_start_utc).toBe(first[0].occurred_start_utc);
  });

  it("survives a backup and restore check: the entry and both item numbers are kept", async () => {
    const o = await make(7);
    await correctItem(o, 8, T + 10 * MIN);
    const file = {
      patients: await db.patients.toArray(),
      observations: await db.observations.toArray(),
      changes: await db.changes.toArray(),
    };
    const parsed = parseBackup(JSON.stringify(file), T + 86_400_000);
    expect(parsed.observations[0]).toMatchObject({ itemId: 8, rev: 2 });
    expect(parsed.changes[0]).toMatchObject({ reason: "wrong_item", from: { itemId: 7 }, to: { itemId: 8 } });
  });
});
