// Two weeks tab figures (F-28, build plan v5 4.3). Made-up logs only.
import { describe, expect, it } from "vitest";
import type { StoredObservation } from "../src/data/db";
import { addDays } from "../src/scoring/engine";
import { groupLogCounts, itemCounts, periodDays, timeOfDayGrid } from "../src/scoring/period";

const start = new Date(2026, 2, 2).getTime(); // a period starts at local midnight
const at = (day: number, h: number, m = 0) => addDays(start, day) + (h * 60 + m) * 60_000;
const log = (itemId: number, t: number, extra: Partial<StoredObservation> = {}): StoredObservation => ({
  patientId: "P-DEMO-A",
  itemId,
  at: t,
  loggedAt: t,
  ...extra,
});

describe("periodDays", () => {
  const now = at(4, 15); // day 5 of 14, mid-afternoon
  const days = periodDays(
    [log(1, at(0, 9)), log(6, at(0, 10)), log(6, at(4, 8))],
    [{ day: addDays(start, 2) }],
    start,
    now,
  );
  it("has 14 days", () => expect(days).toHaveLength(14));
  it("counts logs per day", () => {
    expect(days[0]).toMatchObject({ count: 2, state: "logged" });
  });
  it("a day with no log and no check-in is unknown, never zero (D-11)", () => {
    expect(days[1]).toMatchObject({ count: 0, state: "unknown" });
  });
  it("a quiet-day check-in makes a day with no logs a known zero", () => {
    expect(days[2]).toMatchObject({ count: 0, state: "quiet" });
  });
  it("today is today, and later days are future", () => {
    expect(days[4]).toMatchObject({ count: 1, state: "today" });
    expect(days[5].state).toBe("future");
    expect(days[13].state).toBe("future");
  });
  it("leaves out deleted logs", () => {
    const d = periodDays(
      [log(1, at(0, 9), { deletedAt: at(0, 10), deleteReason: "Tapped by mistake" })],
      [],
      start,
      now,
    );
    expect(d[0]).toMatchObject({ count: 0, state: "unknown" });
  });
});

describe("itemCounts and groupLogCounts", () => {
  const obs = [log(7, at(0, 9)), log(7, at(1, 9)), log(1, at(1, 9)), log(4, at(13, 23, 59)), log(4, at(14, 0))];
  it("counts live logs per behavior inside the period only", () => {
    const c = itemCounts(obs, start, addDays(start, 14));
    expect(c[7]).toBe(2);
    expect(c[1]).toBe(1);
    expect(c[4]).toBe(1);
  });
  it("adds them up by the manual's nursing-home groups (p.7)", () => {
    const g = groupLogCounts(itemCounts(obs, start, addDays(start, 14)));
    expect(g).toEqual({ aggressive: 3, physical: 1, verbal: 0, other: 0 }); // hitting 2 + cursing 1 (cursing loads on aggressive, p.7)
  });
});

describe("timeOfDayGrid", () => {
  it("counts logs per 4-hour block and per day", () => {
    const g = timeOfDayGrid([log(1, at(0, 1)), log(1, at(0, 13)), log(1, at(0, 14)), log(6, at(3, 23, 30))], start, 4);
    expect(g.labels).toEqual(["12a–4a", "4a–8a", "8a–12p", "12p–4p", "4p–8p", "8p–12a"]);
    expect(g.cells).toHaveLength(6);
    expect(g.cells[0]).toHaveLength(14);
    expect(g.cells[0][0]).toBe(1);
    expect(g.cells[3][0]).toBe(2);
    expect(g.cells[5][3]).toBe(1);
    expect(g.total).toBe(4);
    expect(g.rowTotals).toEqual([1, 0, 0, 2, 0, 1]);
  });
});
