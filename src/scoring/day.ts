// Figures for one calendar day, for the Today tab (F-27, build plan v5 4.2). A day runs from
// local midnight to the next local midnight (spec section 7), so it is 23 or 25 hours long on
// the days the clocks change. Display only: no rating is given for a single day, because the
// CMAI rates two weeks (manual p.2, p.5).

import { isLive, type StoredObservation } from "../data/db";
import { addDays } from "./engine";

/** Live logs dated in the day that starts at local midnight `dayStart`. */
function inDay(observations: StoredObservation[], dayStart: number): StoredObservation[] {
  const end = addDays(dayStart, 1);
  return observations.filter((o) => isLive(o) && o.at >= dayStart && o.at < end);
}

/**
 * Logs per clock hour, 0 (midnight) to 23. On a 25-hour day both 1 AM hours count under 1;
 * on a 23-hour day the skipped hour stays 0. Every log in the day is counted exactly once.
 */
export function logsByHour(observations: StoredObservation[], dayStart: number): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const o of inDay(observations, dayStart)) hours[new Date(o.at).getHours()]++;
  return hours;
}

export interface BehaviorDay {
  itemId: number;
  /** Newest first. */
  logs: StoredObservation[];
}

/** The day's logs grouped by behavior; the behavior logged most recently comes first. */
export function dayLogs(observations: StoredObservation[], dayStart: number): BehaviorDay[] {
  const byItem = new Map<number, StoredObservation[]>();
  for (const o of inDay(observations, dayStart)) byItem.set(o.itemId, [...(byItem.get(o.itemId) ?? []), o]);
  return [...byItem.entries()]
    .map(([itemId, logs]) => ({ itemId, logs: logs.sort((a, b) => b.at - a.at) }))
    .sort((a, b) => b.logs[0].at - a.logs[0].at || a.itemId - b.itemId);
}
