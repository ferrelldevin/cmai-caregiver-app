// The Log screen's top row, "Most logged for this resident" (F-26, build plan 4.1).
// The rule: the 3 behaviors with the most live logs in the 14 days before today's local
// midnight; ties go to the lower item number; nothing when fewer than 3 behaviors have a log.
// It looks only at days before today, so the row stays still all day under a thumb.
// Display only: it changes no count and no rating.

import { addDays, localMidnight, WINDOW_DAYS } from "../scoring/engine";
import { isLive, type StoredObservation } from "../data/db";

export function mostLogged(observations: StoredObservation[], now: number, size = 3): number[] {
  const end = localMidnight(now);
  const start = addDays(end, -WINDOW_DAYS);
  const counts = new Map<number, number>();
  for (const o of observations) {
    if (!isLive(o) || o.at < start || o.at >= end) continue;
    counts.set(o.itemId, (counts.get(o.itemId) ?? 0) + 1);
  }
  if (counts.size < size) return [];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, size)
    .map(([id]) => id);
}
