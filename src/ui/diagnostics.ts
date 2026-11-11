// A short list of what went wrong, kept on the phone so a caregiver can copy it and hand it to
// the lab. Nothing here is sent anywhere. What is kept: when, the error's name and message, the
// screen name and the app version. What is never kept: patient codes, log contents, notes.
// Anything that looks like a patient code ends the message at that point. Recording never throws.

export const DIAGNOSTICS_KEY = "cmai-diagnostics";
export const MAX_ENTRIES = 30;
const MAX_MESSAGE = 200;

export interface DiagnosticEntry {
  at: number; // epoch ms
  name: string;
  message: string;
  screen: string; // "#/log", never anything after the first part of the hash
  version: string;
}

// A patient code looks like P-03 or AB12 or 7-A. Dates (2026-11-10) match too, and are cut: too much is safe.
const CODE_LIKE = /\b[A-Z0-9]{1,6}-[A-Z0-9]{1,6}\b|\b[A-Z]{1,4}\d{1,6}\b/;

/** The message, cut at the first thing that looks like a patient code, then cut to 200 characters. */
export function scrub(text: string): string {
  const hit = CODE_LIKE.exec(text);
  const kept = hit ? `${text.slice(0, hit.index)}[cut]` : text;
  return kept.length > MAX_MESSAGE ? `${kept.slice(0, MAX_MESSAGE)}…` : kept;
}

/** "#/log" from "#/log/P-03?x=1". A first part that looks like a code is not kept. */
export function screenName(hash: string): string {
  const first = hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  if (!first || CODE_LIKE.test(first.toUpperCase()) || !/^[a-z]+$/i.test(first)) return "#/";
  return `#/${first}`;
}

export function entries(): DiagnosticEntry[] {
  try {
    const raw = localStorage.getItem(DIAGNOSTICS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Keep one more error. The 31st drops the oldest. Never throws, whatever storage does. */
export function record(error: unknown, now: number = Date.now()): void {
  try {
    const name = error instanceof Error ? error.name : typeof error;
    const message = error instanceof Error ? error.message : String(error ?? "");
    const entry: DiagnosticEntry = {
      at: now,
      name: scrub(name),
      message: scrub(message),
      screen: screenName(typeof location === "undefined" ? "" : location.hash),
      version: typeof __APP_VERSION__ === "undefined" ? "unknown" : __APP_VERSION__,
    };
    localStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify([...entries(), entry].slice(-MAX_ENTRIES)));
  } catch {
    // Storage is full or blocked. The app carries on.
  }
}

export function asText(list: DiagnosticEntry[] = entries()): string {
  const version = typeof __APP_VERSION__ === "undefined" ? "unknown" : __APP_VERSION__;
  const head = `CMAI Tracker diagnostics, version ${version}. No patient codes or log contents are kept.`;
  if (list.length === 0) return `${head}\nNothing has gone wrong on this phone.`;
  return [head, ...list.map((e) => `${new Date(e.at).toISOString()} · ${e.screen} · ${e.name}: ${e.message}`)].join(
    "\n",
  );
}

/** Install the two listeners that catch what no button caught. */
export function listenForErrors(): void {
  window.addEventListener("error", (e) => record(e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => record(e.reason));
}
