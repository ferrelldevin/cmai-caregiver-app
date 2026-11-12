// When someone was watching a resident (F-38, plan 5.6). Pure functions: they never change a
// rating, and counts are never divided by watched time anywhere in the app (D-12). A watch
// left open over midnight is cut into two days here, not in storage.

export interface Span {
  start: number;
  end?: number; // open while undefined: counts up to `now`
}

/** Watches as non-overlapping [start, end) pairs, so two caregivers watching at once count once. */
export function mergeSpans(spans: Span[], now: number): [number, number][] {
  const sorted = spans
    .map((s) => [s.start, Math.min(s.end ?? now, now)] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const sp of sorted) {
    const last = out[out.length - 1];
    if (last && sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]);
    else out.push([...sp]);
  }
  return out;
}

/** Watched and total minutes in [start, end). */
export function coverage(spans: Span[], start: number, end: number, now: number) {
  let ms = 0;
  for (const [a, b] of mergeSpans(spans, now)) ms += Math.max(0, Math.min(b, end) - Math.max(a, start));
  return { watchedMinutes: Math.round(ms / 60_000), totalMinutes: Math.round((end - start) / 60_000) };
}

/** Watched minutes in each of the 24 hours from `dayStart` (local midnight), 0 to 60 each. */
export function watchedMinutesByHour(spans: Span[], dayStart: number, now: number): number[] {
  const merged = mergeSpans(spans, now);
  return Array.from({ length: 24 }, (_, h) => {
    const a = dayStart + h * 3_600_000;
    let ms = 0;
    for (const [s, e] of merged) ms += Math.max(0, Math.min(e, a + 3_600_000) - Math.max(s, a));
    return Math.round(ms / 60_000);
  });
}
