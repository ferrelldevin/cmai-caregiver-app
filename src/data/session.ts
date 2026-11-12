// Who is signed in, and since when (R1, plan 5.3). Asked once per shift: a sign-in lasts 12
// hours, survives closing the app, and is never asked again between opening the app and a tile.
// Only the caregiver code and the sign-in time are kept, in the app's database (meta); never the
// PIN, and nothing in localStorage.

import { CAREGIVER_CODE } from "./caregivers";
import { db } from "./db";

export const SHIFT_MS = 12 * 60 * 60 * 1000;
const META_KEY = "session";

export interface Session {
  id: string;
  at: number;
}

let current: Session | null = null;

function parse(raw: unknown): Session | null {
  try {
    const s = JSON.parse(typeof raw === "string" ? raw : "null") as Partial<Session> | null;
    if (!s || typeof s.id !== "string" || !CAREGIVER_CODE.test(s.id) || typeof s.at !== "number") return null;
    return { id: s.id, at: s.at };
  } catch {
    return null;
  }
}

/** Reads the saved sign-in from the database, once, before the app first draws. */
export async function loadSession(): Promise<void> {
  try {
    current = parse((await db.meta.get(META_KEY))?.value);
  } catch {
    current = null;
  }
}

/** The session still running, or null: unknown, from the future, or older than 12 hours. */
export function readSession(now = Date.now()): Session | null {
  const s = current;
  return s && s.at <= now && now - s.at < SHIFT_MS ? { ...s } : null;
}

export function startSession(id: string, now = Date.now()): Session {
  const s = { id, at: now };
  current = s;
  void save(() => db.meta.put({ key: META_KEY, value: JSON.stringify(s) }));
  return s;
}

export function endSession() {
  current = null;
  void save(() => db.meta.delete(META_KEY));
}

async function save(write: () => PromiseLike<unknown>) {
  try {
    await write();
  } catch {
    /* the sign-in lasts until the app closes */
  }
}
