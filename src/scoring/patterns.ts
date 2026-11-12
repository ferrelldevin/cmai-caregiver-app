// "Patterns to look into" on the Two weeks tab (F-28, build plan v5 4.3). Simple counting on
// the phone; patterns, not causes. The thresholds are a first guess until the lab sets them:
// they are open as D-18 and live here, named, so one change moves every screen.
// Why look at all: agitation episodes cluster by time of day (Abedi 2025, preprint,
// https://arxiv.org/abs/2506.06306) and triggers differ by person (Bankole 2020,
// DOI 10.1177/1533317520906686).

import { isLive, type StoredObservation } from "../data/db";
import type { TimeGrid } from "./period";

/** No pattern is named before the period has this many logs (D-18). */
export const PATTERN_MIN_LOGS = 20;
/** A time block is "busiest" when it holds at least this many times its even share (D-18). */
export const BUSY_SHARE = 1.5;
/** Two behaviors count as "together" when logged within this many minutes (D-18). */
export const PAIR_MINUTES = 30;
/** ...and only once that has happened at least this many times in the period (D-18). */
export const PAIR_MIN_TIMES = 3;

/** The block of hours with the most logs, when it clearly stands out; null otherwise. */
export function busiestBlock(grid: TimeGrid): { label: string; pct: number } | null {
  if (grid.total < PATTERN_MIN_LOGS) return null;
  const top = Math.max(...grid.rowTotals);
  const share = top / grid.total;
  if (share < BUSY_SHARE / grid.labels.length) return null;
  return { label: grid.labels[grid.rowTotals.indexOf(top)], pct: Math.round(share * 100) };
}

/** Pairs of different behaviors logged within PAIR_MINUTES of each other, PAIR_MIN_TIMES or more times. */
export function pairsTogether(observations: StoredObservation[]): { a: number; b: number; times: number }[] {
  const logs = observations.filter(isLive).sort((x, y) => x.at - y.at);
  const counts = new Map<string, number>();
  for (let i = 0; i < logs.length; i++) {
    for (let j = i + 1; j < logs.length && logs[j].at - logs[i].at <= PAIR_MINUTES * 60_000; j++) {
      if (logs[i].itemId === logs[j].itemId) continue;
      const [a, b] = [logs[i].itemId, logs[j].itemId].sort((x, y) => x - y);
      counts.set(`${a}-${b}`, (counts.get(`${a}-${b}`) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= PAIR_MIN_TIMES)
    .map(([k, times]) => {
      const [a, b] = k.split("-").map(Number);
      return { a, b, times };
    })
    .sort((x, y) => y.times - x.times || x.a - y.a || x.b - y.b);
}
