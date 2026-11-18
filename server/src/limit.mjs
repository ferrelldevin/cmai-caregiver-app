// A small fixed-window counter, kept in memory, for requests that carry no valid key. Without it any
// page open on the machine can make the service write an audit row per request, forever.

/** `allow(who, now)`: true while `who` has made fewer than `limit` requests in the current window. */
export function makeLimiter(limit = 30, windowMs = 60_000) {
  const seen = new Map(); // who -> { start, n }
  return (who, now = Date.now()) => {
    for (const [k, v] of seen) if (now - v.start >= windowMs) seen.delete(k); // forget old windows
    const entry = seen.get(who);
    if (!entry) {
      seen.set(who, { start: now, n: 1 });
      return { ok: true, first: false };
    }
    entry.n++;
    return { ok: entry.n <= limit, first: entry.n === limit + 1 }; // `first`: the request that crossed the line, to be audited once
  };
}
