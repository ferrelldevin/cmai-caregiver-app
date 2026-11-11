// Property tests for the scoring rule (build plan step 2.11, register V-14).
// The hand-worked cases in engine.test.ts check the answers someone thought of. These check
// rules that must hold for every input, with 1,000 random ones each. Runs in New York time,
// like dst.test.ts, and every property runs twice: once in an ordinary period and once in a
// period that contains the clocks falling back (Sun 2026-11-01).
// If one fails, fast-check prints the seed and the smallest failing input. That is a
// finding about the rule, not a test to fix: report it and give it a register row.
declare const process: { env: Record<string, string | undefined> }; // Node, without pulling in @types/node
process.env.TZ = "America/New_York";

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { addDays, DAY_MS, scoreWindow, WINDOW_DAYS, type Observation } from "../src/scoring/engine";

const RUNS = { numRuns: 1000 };
const HOUR = 3_600_000;
const at = (y: number, mo: number, d: number) => new Date(y, mo - 1, d).getTime();
const PERIODS = [
  { name: "an ordinary period", start: at(2026, 6, 1) },
  { name: "a period with a clock change", start: at(2026, 10, 20) },
];

/** Table in docs/scoring-spec.md section 2, written out again here so the test does not use the code it checks. */
function tableRating(n: number): number {
  if (n === 0) return 1;
  if (n === 1) return 2;
  if (n <= 4) return 3;
  if (n <= 13) return 4;
  if (n <= 28) return 5;
  return 6;
}

/** Local calendar date of a time, as text, so "which day" does not depend on 24-hour arithmetic. */
const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Days on which at least `need` logs of one item fall inside a span under 60 minutes, counted from the day of the first log. */
function daysWithBurst(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  const days = new Set<string>();
  for (let i = 0; i + 2 < sorted.length; i++) if (sorted[i + 2] - sorted[i] < HOUR) days.add(dayKey(sorted[i]));
  return days.size;
}

/** Random logs for one period: scattered single logs, and bursts of three on chosen days. */
function logsIn(start: number): fc.Arbitrary<Observation[]> {
  // Two shapes: logs spread over all 29 behaviors (low counts), and logs piled on two behaviors
  // (high counts and many burst days), so every rating from 1 to 7 is reached.
  return fc.oneof(
    logsOf(start, 29, 80, 20),
    logsOf(start, 2, 120, 40),
    logsOf(start, 2, 30, 14),
    logsOf(start, 1, 150, 4, 35),
  );
}

function logsOf(
  start: number,
  items: number,
  maxSingles: number,
  maxBursts: number,
  minSingles = 0,
): fc.Arbitrary<Observation[]> {
  const end = addDays(start, WINDOW_DAYS);
  const item = fc.integer({ min: 1, max: items });
  const single = fc.record({ itemId: item, at: fc.integer({ min: start, max: end - 1 }) });
  const burst = fc
    .record({
      itemId: item,
      day: fc.integer({ min: 0, max: WINDOW_DAYS - 1 }),
      minute: fc.integer({ min: 0, max: 22 * 60 }),
      // First to third log spans 0 to 70 minutes, so the 60-minute edge is hit often.
      span: fc.integer({ min: 0, max: 70 }),
      middle: fc.double({ min: 0, max: 1, noNaN: true }),
    })
    .map(({ itemId, day, minute, span, middle }) => {
      const t0 = addDays(start, day) + minute * 60_000;
      return [t0, t0 + Math.floor(span * middle) * 60_000, t0 + span * 60_000].map((t) => ({ itemId, at: t }));
    });
  return fc
    .tuple(
      fc.array(single, { minLength: minSingles, maxLength: maxSingles }),
      fc.array(burst, { maxLength: maxBursts }),
    )
    .map(([a, b]) => [...a, ...b.flat()]);
}

/** A log that is certainly inside the period. */
const oneLog = (start: number) =>
  fc.record({
    itemId: fc.integer({ min: 1, max: 29 }),
    at: fc.integer({ min: start, max: addDays(start, WINDOW_DAYS) - 1 }),
  });

/** Same list, different order, from a seed (so a failure can be replayed). */
function shuffled<T>(list: T[], seed: number): T[] {
  const out = [...list];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const ratings = (obs: Observation[], start: number) =>
  scoreWindow(obs, start, start + 30 * DAY_MS).items.map((i) => i.rating);

for (const { name, start } of PERIODS) {
  describe(`scoring rule properties in ${name}`, () => {
    it("order does not matter", () => {
      fc.assert(
        fc.property(logsIn(start), fc.integer(), (logs, seed) => {
          expect(ratings(shuffled(logs, seed), start)).toEqual(ratings(logs, start));
        }),
        RUNS,
      );
    });

    it("one more log never lowers a rating", () => {
      fc.assert(
        fc.property(logsIn(start), oneLog(start), (logs, extra) => {
          const before = ratings(logs, start);
          const after = ratings([...logs, extra], start);
          after.forEach((r, i) => expect(r).toBeGreaterThanOrEqual(before[i]));
        }),
        RUNS,
      );
    });

    it("one less log never raises a rating", () => {
      fc.assert(
        fc.property(logsIn(start), fc.nat(), (logs, pick) => {
          fc.pre(logs.length > 0);
          const index = pick % logs.length;
          const before = ratings(logs, start);
          const after = ratings(
            logs.filter((_, i) => i !== index),
            start,
          );
          after.forEach((r, i) => expect(r).toBeLessThanOrEqual(before[i]));
        }),
        RUNS,
      );
    });

    it("without enough clustered days, the rating is the table in the spec", () => {
      fc.assert(
        fc.property(logsIn(start), (logs) => {
          const score = scoreWindow(logs, start, start + 30 * DAY_MS);
          for (const item of score.items) {
            const times = logs.filter((l) => l.itemId === item.itemId).map((l) => l.at);
            expect(item.count).toBe(times.length);
            if (daysWithBurst(times) < WINDOW_DAYS / 2) expect(item.rating).toBe(tableRating(times.length));
          }
        }),
        RUNS,
      );
    });

    it("a rating of 7 needs bursts on at least 7 days, and 7 days of bursts give a 7", () => {
      fc.assert(
        fc.property(logsIn(start), (logs) => {
          const score = scoreWindow(logs, start, start + 30 * DAY_MS);
          for (const item of score.items) {
            const burstDays = daysWithBurst(logs.filter((l) => l.itemId === item.itemId).map((l) => l.at));
            expect(item.rating === 7).toBe(burstDays >= WINDOW_DAYS / 2);
          }
        }),
        RUNS,
      );
    });

    it("logs for one behavior never change another behavior's rating", () => {
      fc.assert(
        fc.property(logsIn(start), fc.integer({ min: 1, max: 29 }), (logs, itemId) => {
          const all = scoreWindow(logs, start, start + 30 * DAY_MS).items.find((i) => i.itemId === itemId);
          const only = scoreWindow(
            logs.filter((l) => l.itemId === itemId),
            start,
            start + 30 * DAY_MS,
          ).items.find((i) => i.itemId === itemId);
          expect(all).toEqual(only);
        }),
        RUNS,
      );
    });
  });
}

describe("the edge of a cluster", () => {
  it("three logs 59 minutes apart make a cluster and 60 minutes do not, whatever the period or day", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PERIODS),
        fc.integer({ min: 0, max: 120 }),
        fc.integer({ min: 7, max: WINDOW_DAYS }),
        fc.integer({ min: 0, max: 20 * 60 }),
        (period, span, days, minute) => {
          // One burst a day on `days` different days, the same shape each day.
          const logs: Observation[] = [];
          for (let d = 0; d < days; d++) {
            const t0 = addDays(period.start, d) + minute * 60_000;
            for (const offset of [0, Math.floor(span / 2), span]) logs.push({ itemId: 5, at: t0 + offset * 60_000 });
          }
          const rating = scoreWindow(logs, period.start, period.start + 30 * DAY_MS).items[4].rating;
          expect(rating === 7).toBe(span < 60);
        },
      ),
      RUNS,
    );
  });
});

describe("the generators reach the interesting cases", () => {
  it("produce ratings of 7 and of every table band", () => {
    const seen = new Set<number>();
    const heavy = fc.sample(logsIn(PERIODS[0].start), { numRuns: 1000, seed: 1 });
    for (const logs of heavy) for (const r of ratings(logs, PERIODS[0].start)) seen.add(r);
    for (const band of [1, 2, 3, 4, 5, 6, 7]) expect(seen.has(band), `rating ${band} never produced`).toBe(true);
  });
});
