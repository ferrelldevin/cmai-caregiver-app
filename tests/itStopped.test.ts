// "It stopped" (F-39, plan 5.7): an optional end time for the three behaviors that come in
// stretches. Stored with its change history, never before the start, never read by scoring.
// Made-up data only.
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import cases from "../docs/test-cases.json";
import { db, type StoredObservation } from "../src/data/db";
import { editLog, ENDS_BEFORE_START, stopLog } from "../src/data/logs";
import { DAY_MS, scoreWindow, WINDOW_MS, type Observation } from "../src/scoring/engine";
import { ITEMS } from "../src/scoring/items";

type Saved = StoredObservation & { id: number };
const T = Date.UTC(2026, 9, 5, 14);

async function add(o: StoredObservation): Promise<Saved> {
  const id = await db.observations.add(o);
  return { ...o, id };
}

beforeEach(async () => {
  db.close();
  await Dexie.delete("cmai-tracker");
  await db.open();
});

describe("It stopped (F-39)", () => {
  it("offers an end only for pacing, mannerisms and general restlessness", () => {
    expect(ITEMS.filter((i) => i.continuous).map((i) => i.id)).toEqual([1, 26, 29]);
  });

  it("stores the end and writes it to the change history", async () => {
    const o = await add({ patientId: "P-01", itemId: 1, at: T, loggedAt: T });
    await stopLog(o, T + 10 * 60_000);
    expect((await db.observations.get(o.id))?.endedAt).toBe(T + 10 * 60_000);
    const [entry] = await db.changes.toArray();
    expect(entry).toMatchObject({ action: "edit", to: { endedAt: T + 10 * 60_000 } });
    expect(entry.from).toEqual({});
  });

  it("refuses an end before the start, either way round, and changes nothing", async () => {
    const o = await add({ patientId: "P-01", itemId: 29, at: T, loggedAt: T });
    await expect(editLog(o, { endedAt: T - 1 }, T)).rejects.toThrow(ENDS_BEFORE_START);
    await stopLog(o, T + 60_000);
    await expect(editLog(o, { at: T + 2 * 60_000 }, T + 3 * 60_000)).rejects.toThrow(ENDS_BEFORE_START);
    expect(await db.observations.get(o.id)).toMatchObject({ at: T, endedAt: T + 60_000 });
    expect(await db.changes.count()).toBe(1);
  });

  it("an end equal to the start is allowed, and an end can be taken back", async () => {
    const o = await add({ patientId: "P-01", itemId: 26, at: T, loggedAt: T });
    await editLog(o, { endedAt: T }, T);
    await editLog(o, { endedAt: undefined }, T + 10 * 60_000);
    expect((await db.observations.get(o.id))?.endedAt).toBeUndefined();
  });

  it("refuses an end on a behavior that is one event, such as hitting", async () => {
    const o = await add({ patientId: "P-01", itemId: 7, at: T, loggedAt: T });
    await expect(stopLog(o, T + 60_000)).rejects.toThrow(/Only pacing/);
    expect((await db.observations.get(o.id))?.endedAt).toBeUndefined();
  });
});

describe("end times never change a rating (docs/test-cases.json)", () => {
  const windowStart = Date.parse(cases.windowStart);
  const afterWindow = windowStart + WINDOW_MS + 1;
  // A fixed pseudo-random sequence, so a failure can be run again.
  let seed = 7;
  const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (const c of cases.ratingCases) {
    it(`${c.id}: same count and rating with any end times`, () => {
      const obs: Observation[] = c.logs.flatMap(({ day, times }) =>
        times.map((hhmm) => {
          const [h, m] = hhmm.split(":").map(Number);
          return { itemId: c.itemId, at: windowStart + day * DAY_MS + (h * 60 + m) * 60_000 };
        }),
      );
      const plain = scoreWindow(obs, windowStart, afterWindow).items.find((s) => s.itemId === c.itemId)!;
      for (let round = 0; round < 5; round++) {
        const ended = obs.map((o) => (rand() < 0.5 ? { ...o, endedAt: o.at + Math.floor(rand() * 6 * 3_600_000) } : o));
        const withEnds = scoreWindow(ended, windowStart, afterWindow).items.find((s) => s.itemId === c.itemId)!;
        expect([withEnds.count, withEnds.rating]).toEqual([plain.count, plain.rating]);
      }
    });
  }
});
