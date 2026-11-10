// "Patterns to look into" on the Two weeks tab (F-28). The thresholds are open (D-18) and live
// as named constants. Made-up logs only.
import { describe, expect, it } from "vitest";
import type { StoredObservation } from "../src/data/db";
import { addDays } from "../src/scoring/engine";
import { timeOfDayGrid } from "../src/scoring/period";
import {
  BUSY_SHARE,
  busiestBlock,
  PAIR_MINUTES,
  PAIR_MIN_TIMES,
  PATTERN_MIN_LOGS,
  pairsTogether,
} from "../src/scoring/patterns";

const start = new Date(2026, 2, 2).getTime();
const at = (day: number, h: number, m = 0) => addDays(start, day) + (h * 60 + m) * 60_000;
const log = (itemId: number, t: number): StoredObservation => ({ patientId: "P-DEMO-A", itemId, at: t, loggedAt: t });

describe("the open thresholds (D-18)", () => {
  it("are the ones the mockup shows", () => {
    expect([PATTERN_MIN_LOGS, BUSY_SHARE, PAIR_MINUTES, PAIR_MIN_TIMES]).toEqual([20, 1.5, 30, 3]);
  });
});

describe("busiestBlock", () => {
  it("says nothing with fewer than 20 logs", () => {
    const obs = Array.from({ length: 19 }, (_, i) => log(1, at(i % 14, 14)));
    expect(busiestBlock(timeOfDayGrid(obs, start, 4))).toBeNull();
  });
  it("names a block with at least 1.5 times its even share", () => {
    // 20 logs: 12 between 4 and 8 PM, 8 spread over the other blocks. Even share is 1/6.
    const obs = [
      ...Array.from({ length: 12 }, (_, i) => log(1, at(i % 14, 17))),
      ...[1, 5, 9, 13, 1, 5, 9, 13].map((h, i) => log(6, at(i, h))),
    ];
    expect(busiestBlock(timeOfDayGrid(obs, start, 4))).toEqual({ label: "4p–8p", pct: 60 });
  });
  it("says nothing when logs are spread evenly", () => {
    const obs = Array.from({ length: 24 }, (_, i) => log(1, at(i % 14, (i % 6) * 4 + 1)));
    expect(busiestBlock(timeOfDayGrid(obs, start, 4))).toBeNull();
  });
});

describe("pairsTogether", () => {
  it("finds two behaviors logged within 30 minutes of each other 3 or more times", () => {
    const obs = [0, 1, 2].flatMap((d) => [log(13, at(d, 9)), log(7, at(d, 9, 20))]);
    expect(pairsTogether(obs)).toEqual([{ a: 7, b: 13, times: 3 }]);
  });
  it("leaves out pairs seen fewer than 3 times, or more than 30 minutes apart", () => {
    const twice = [0, 1].flatMap((d) => [log(13, at(d, 9)), log(7, at(d, 9, 20))]);
    const far = [0, 1, 2].flatMap((d) => [log(13, at(d, 9)), log(7, at(d, 9, 31))]);
    expect(pairsTogether([...twice, ...far.map((o) => ({ ...o, itemId: o.itemId === 13 ? 4 : 1 }))])).toEqual([]);
  });
  it("does not pair a behavior with itself", () => {
    expect(pairsTogether([0, 1, 2].flatMap((d) => [log(1, at(d, 9)), log(1, at(d, 9, 5))]))).toEqual([]);
  });
});
