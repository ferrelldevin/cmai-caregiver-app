import { describe, expect, it } from "vitest";
import { addDays, localMidnight } from "../src/scoring/engine";
import type { StoredObservation } from "../src/data/db";
import { mostLogged } from "../src/ui/mostLogged";

// Made-up logs only. "now" is mid-afternoon; today starts at local midnight.
const now = new Date(2026, 2, 20, 15, 0).getTime();
const today = localMidnight(now);
const daysAgo = (d: number) => addDays(today, -d) + 10 * 60 * 60 * 1000; // 10:00 that day
const log = (itemId: number, at: number, extra: Partial<StoredObservation> = {}): StoredObservation => ({
  patientId: "P-DEMO-A",
  itemId,
  at,
  loggedAt: at,
  ...extra,
});
const many = (itemId: number, ...days: number[]) => days.map((d) => log(itemId, daysAgo(d)));
const three = [...many(6, 1, 2, 3), ...many(1, 1, 2), ...many(13, 1)];

describe("mostLogged (Log screen, 'Most logged for this resident', F-26)", () => {
  it("returns the 3 behaviors with the most logs, most first", () => {
    expect(mostLogged(three, now)).toEqual([6, 1, 13]);
  });

  it("is not changed by a log today, so tiles do not move during the day", () => {
    const today5 = [1, 2, 3, 4, 5].map(() => log(29, now - 60_000));
    expect(mostLogged([...three, ...today5], now)).toEqual([6, 1, 13]);
  });

  it("does not count a deleted log", () => {
    const deleted = [1, 2, 3, 4].map((d) => log(29, daysAgo(d), { deletedAt: now, deleteReason: "Tapped by mistake" }));
    expect(mostLogged([...three, ...deleted], now)).toEqual([6, 1, 13]);
  });

  it("is hidden (empty) when fewer than 3 behaviors have a log", () => {
    expect(mostLogged([...many(6, 1, 2), ...many(1, 1)], now)).toEqual([]);
    expect(mostLogged([], now)).toEqual([]);
  });

  it("breaks a tie by the lower item number", () => {
    expect(mostLogged([...many(29, 1, 2), ...many(4, 1, 2), ...many(17, 1, 2)], now)).toEqual([4, 17, 29]);
  });

  it("does not count a log 15 days ago, and does count one 14 days ago", () => {
    expect(mostLogged([...three, ...many(29, 15, 15, 15, 15)], now)).toEqual([6, 1, 13]);
    expect(mostLogged([...three, ...many(29, 14, 14, 14, 14)], now)).toEqual([29, 6, 1]);
  });
});
