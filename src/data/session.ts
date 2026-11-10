// Who is signed in, and since when (R1, plan 5.3). Asked once per shift: a sign-in lasts 12
// hours, survives closing the app, and is never asked again between opening the app and a tile.
// Only the caregiver code and the sign-in time are kept, in localStorage; never the PIN.

import { CAREGIVER_CODE } from "./caregivers";

export const SHIFT_MS = 12 * 60 * 60 * 1000;
const KEY = "cmai-session";

export interface Session {
  id: string;
  at: number;
}

/** The session still running, or null: unknown, from the future, or older than 12 hours. */
export function readSession(now = Date.now()): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Session> | null;
    if (!s || typeof s.id !== "string" || !CAREGIVER_CODE.test(s.id) || typeof s.at !== "number") return null;
    return s.at <= now && now - s.at < SHIFT_MS ? { id: s.id, at: s.at } : null;
  } catch {
    return null;
  }
}

export function startSession(id: string, now = Date.now()): Session {
  const s = { id, at: now };
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: the sign-in lasts until the app closes */
  }
  return s;
}

export function endSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
}
