// Figures for one two-week period, for the Two weeks tab (F-28, build plan v5 4.3).
// Counts only: ratings come from the engine (scoreWindow, appRatings, summarize) and are not
// recomputed here. Deleted logs are left out. Days run local midnight to local midnight.

import { isLive, type StoredObservation } from "../data/db";
import { addDays, WINDOW_DAYS } from "./engine";
import { ITEMS, type FactorGroup } from "./items";

/**
 * logged: has logs. quiet: no logs, but a "nothing to log today" check-in. unknown: an ended
 * day with neither, which is unknown, never zero (D-11). today: the day in progress.
 * future: not reached yet.
 */
export type DayState = "logged" | "quiet" | "unknown" | "today" | "future";
export interface PeriodDay {
  start: number;
  count: number;
  state: DayState;
}

export function periodDays(
  observations: StoredObservation[],
  checkins: { day: number }[],
  windowStart: number,
  now: number,
): PeriodDay[] {
  const quiet = new Set(checkins.map((c) => c.day));
  return Array.from({ length: WINDOW_DAYS }, (_, d) => {
    const start = addDays(windowStart, d);
    const end = addDays(windowStart, d + 1);
    const count = observations.filter((o) => isLive(o) && o.at >= start && o.at < end).length;
    const state: DayState =
      start > now ? "future" : end > now ? "today" : count ? "logged" : quiet.has(start) ? "quiet" : "unknown";
    return { start, count, state };
  });
}

/** Live logs per behavior (item id) between `from` and `to`. */
export function itemCounts(observations: StoredObservation[], from: number, to: number): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const o of observations)
    if (isLive(o) && o.at >= from && o.at < to) counts[o.itemId] = (counts[o.itemId] ?? 0) + 1;
  return counts;
}

/** Logs per nursing-home group (manual p.7), plus the items in no group. */
export function groupLogCounts(counts: Record<number, number>): Record<FactorGroup, number> {
  const out: Record<FactorGroup, number> = { aggressive: 0, physical: 0, verbal: 0, other: 0 };
  for (const item of ITEMS) out[item.group] += counts[item.id] ?? 0;
  return out;
}

export interface TimeGrid {
  /** One label per block of hours, such as "4p–8p". */
  labels: string[];
  /** cells[block][day]: logs in that block of hours on that day of the period. */
  cells: number[][];
  rowTotals: number[];
  total: number;
}

const clock = (h: number) => `${h % 12 || 12}${h % 24 < 12 ? "a" : "p"}`;

/** Logs by time of day (blocks of `blockHours`, by clock hour) and by day of the period. */
export function timeOfDayGrid(
  observations: StoredObservation[],
  windowStart: number,
  blockHours: 2 | 3 | 4 | 6,
): TimeGrid {
  const blocks = 24 / blockHours;
  const labels = Array.from({ length: blocks }, (_, b) => `${clock(b * blockHours)}–${clock((b + 1) * blockHours)}`);
  const cells = Array.from({ length: blocks }, () => new Array<number>(WINDOW_DAYS).fill(0));
  const end = addDays(windowStart, WINDOW_DAYS);
  let total = 0;
  for (const o of observations) {
    if (!isLive(o) || o.at < windowStart || o.at >= end) continue;
    let d = 0;
    while (addDays(windowStart, d + 1) <= o.at) d++;
    cells[Math.floor(new Date(o.at).getHours() / blockHours)][d]++;
    total++;
  }
  return { labels, cells, rowTotals: cells.map((r) => r.reduce((a, b) => a + b, 0)), total };
}
