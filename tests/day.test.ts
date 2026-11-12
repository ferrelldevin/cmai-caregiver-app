// Today tab figures (F-27, build plan v5 4.2). Runs in New York time so the 23-hour and
// 25-hour days are real: clocks spring forward on Sun 2027-03-14 and fall back on Sun 2026-11-01.
declare const process: { env: Record<string, string | undefined> };
process.env.TZ = "America/New_York";

import { describe, expect, it } from "vitest";
import type { StoredObservation } from "../src/data/db";
import { localMidnight } from "../src/scoring/engine";
import { dayLogs, logsByHour } from "../src/scoring/day";

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const log = (itemId: number, t: number, extra: Partial<StoredObservation> = {}): StoredObservation => ({
  patientId: "P-DEMO-A",
  itemId,
  at: t,
  loggedAt: t,
  ...extra,
});

describe("logsByHour", () => {
  const day = at(2026, 3, 20);
  it("has 24 hours, counted by the clock hour of each log", () => {
    const h = logsByHour(
      [log(1, at(2026, 3, 20, 0, 5)), log(6, at(2026, 3, 20, 14, 10)), log(6, at(2026, 3, 20, 14, 59))],
      day,
    );
    expect(h).toHaveLength(24);
    expect(h[0]).toBe(1);
    expect(h[14]).toBe(2);
    expect(h.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("leaves out other days and deleted logs", () => {
    const h = logsByHour(
      [
        log(1, at(2026, 3, 19, 23, 59)),
        log(1, at(2026, 3, 21, 0, 0)),
        log(1, at(2026, 3, 20, 9), { deletedAt: at(2026, 3, 20, 10), deleteReason: "Tapped by mistake" }),
      ],
      day,
    );
    expect(h.every((n) => n === 0)).toBe(true);
  });

  it("a 23-hour day (spring forward): 2 AM does not exist, every log still counts once", () => {
    const d = at(2027, 3, 14);
    expect(localMidnight(d + 23 * 3600_000 + 60_000)).not.toBe(d); // the day really is 23 hours
    const h = logsByHour(
      [log(1, at(2027, 3, 14, 1, 30)), log(1, at(2027, 3, 14, 3, 30)), log(1, at(2027, 3, 14, 23, 30))],
      d,
    );
    expect(h[1]).toBe(1);
    expect(h[2]).toBe(0);
    expect(h[3]).toBe(1);
    expect(h[23]).toBe(1);
  });

  it("a 25-hour day (fall back): both 1 AM hours land in hour 1, and 11 PM still counts", () => {
    const d = at(2026, 11, 1);
    const firstOne = d + 1 * 3600_000 + 15 * 60_000; // 1:15 AM, before the change
    const secondOne = d + 2 * 3600_000 + 15 * 60_000; // 1:15 AM again, after it
    expect(new Date(secondOne).getHours()).toBe(1);
    const h = logsByHour([log(1, firstOne), log(1, secondOne), log(1, at(2026, 11, 1, 23, 30))], d);
    expect(h[1]).toBe(2);
    expect(h[23]).toBe(1);
    expect(h.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe("dayLogs", () => {
  const day = at(2026, 3, 20);
  it("groups today's live logs by behavior, newest activity first, each newest first", () => {
    const g = dayLogs(
      [
        log(6, at(2026, 3, 20, 8)),
        log(1, at(2026, 3, 20, 9)),
        log(6, at(2026, 3, 20, 15)),
        log(13, at(2026, 3, 19, 22)), // yesterday
        log(7, at(2026, 3, 20, 16), { deletedAt: at(2026, 3, 20, 16, 5), deleteReason: "Tapped by mistake" }),
      ],
      day,
    );
    expect(g.map((x) => x.itemId)).toEqual([6, 1]);
    expect(g[0].logs.map((o) => new Date(o.at).getHours())).toEqual([15, 8]);
  });

  it("a log made today but dated yesterday shows under yesterday, not today", () => {
    const late = log(3, at(2026, 3, 19, 23, 50), { loggedAt: at(2026, 3, 20, 0, 10) });
    expect(dayLogs([late], day)).toEqual([]);
    expect(dayLogs([late], at(2026, 3, 19)).map((x) => x.itemId)).toEqual([3]);
  });
});
