// Watching hours (F-38, D-25, plan 5.6). Made-up data only.
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/study/settings", async (orig) => {
  const real = await orig<typeof import("../src/study/settings")>();
  return { ...real, study: real.settingsFor("lab") };
});
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { db, setLoggingCaregiver } = await import("../src/data/db");
const w = await import("../src/data/watches");
const cov = await import("../src/scoring/coverage");

const H = 3_600_000;
const DAY = new Date(2026, 9, 5).getTime(); // local midnight

beforeEach(async () => {
  db.close();
  await Dexie.delete("cmai-tracker");
  await db.open();
  store.clear();
  setLoggingCaregiver("C-01");
});

describe("coverage (pure)", () => {
  it("overlapping watches by two caregivers count once", () => {
    const spans = [
      { start: DAY + 8 * H, end: DAY + 10 * H },
      { start: DAY + 9 * H, end: DAY + 11 * H },
    ];
    expect(cov.coverage(spans, DAY, DAY + 24 * H, DAY + 30 * H)).toEqual({ watchedMinutes: 180, totalMinutes: 1440 });
  });

  it("by hour: 0 to 60 a hour; an open watch counts up to now; over midnight is cut into two days", () => {
    const byHour = cov.watchedMinutesByHour(
      [{ start: DAY + 8.5 * H, end: DAY + 10 * H }, { start: DAY + 23 * H }],
      DAY,
      DAY + 25 * H,
    );
    expect(byHour[8]).toBe(30);
    expect(byHour[9]).toBe(60);
    expect(byHour[10]).toBe(0);
    expect(byHour[23]).toBe(60);
    expect(cov.watchedMinutesByHour([{ start: DAY + 23 * H }], DAY + 24 * H, DAY + 25 * H)[0]).toBe(60);
    expect(cov.coverage([{ start: DAY + 23 * H }], DAY, DAY + 24 * H, DAY + 25 * H).watchedMinutes).toBe(60);
  });
});

describe("watches (D-25)", () => {
  it("one open watch per caregiver: a new resident ends the old watch as a switch", async () => {
    await w.startWatch("P-01", "tap", DAY + 8 * H);
    expect(await w.startWatch("P-01", "log", DAY + 8.5 * H)).toMatchObject({ startSource: "tap" }); // same resident: unchanged
    await w.startWatch("P-02", "log", DAY + 9 * H);
    const all = await db.watches.toArray();
    expect(all).toHaveLength(2);
    expect(all.find((x) => x.patientId === "P-01")).toMatchObject({
      end: DAY + 9 * H,
      endSource: "switch",
      by: "C-01",
    });
    expect((await w.openWatch())?.patientId).toBe("P-02");
    setLoggingCaregiver("C-02"); // another caregiver on the same phone has their own
    expect(await w.openWatch()).toBeUndefined();
  });

  it("finds the open watch on app start, before the database has opened (found by e2e/watching.cjs)", async () => {
    await w.startWatch("P-01", "tap", DAY);
    db.close();
    expect((await w.openWatch())?.patientId).toBe("P-01");
  });

  it("I've left ends it; ending with none open does nothing", async () => {
    await w.endWatch("tap", DAY);
    await w.startWatch("P-01", "tap", DAY + H);
    await w.endWatch("tap", DAY + 2 * H);
    expect(await db.watches.toArray()).toMatchObject([{ end: DAY + 2 * H, endSource: "tap", startSource: "tap" }]);
  });

  it("4 hours with no tap ends at the last tap; Yes, still here undoes it", async () => {
    const start = await w.startWatch("P-01", "tap", DAY + H);
    w.touch(DAY + 2 * H);
    expect(await w.closeIfTimedOut(DAY + 5 * H)).toBeNull();
    const closed = await w.closeIfTimedOut(DAY + 6 * H);
    expect(closed).toMatchObject({ end: DAY + 2 * H, endSource: "timeout" });
    await w.resumeWatch(start.uid, DAY + 6 * H);
    expect((await db.watches.get(start.uid))?.end).toBeUndefined();
    expect(await w.closeIfTimedOut(DAY + 7 * H)).toBeNull();
    expect(await w.watchesFor("P-01", DAY)).toHaveLength(1);
  });

  it("without storage (private mode) the timeout counts from the start of the watch", async () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    };
    vi.stubGlobal("localStorage", broken);
    try {
      await w.startWatch("P-01", "tap", DAY);
      expect(await w.closeIfTimedOut(DAY + 3 * H)).toBeNull();
      expect(await w.closeIfTimedOut(DAY + 4 * H)).toMatchObject({ end: DAY, endSource: "timeout" });
    } finally {
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      });
    }
    expect(await w.closeIfTimedOut(DAY)).toBeNull(); // nothing open
    const old = await db.watches.toArray();
    expect(await w.watchesFor("P-01", DAY + 1)).toHaveLength(0); // ended before `from`
    expect(old).toHaveLength(1);
  });
});
