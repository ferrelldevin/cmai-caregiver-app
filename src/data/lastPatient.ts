// Which patient the app opens on.
//
// The app used to save the last-picked patient code in localStorage. A phone's localStorage sits outside
// the backup and outside "delete this patient", and CodeQL flagged the plain code there (clear-text
// storage of sensitive information). Now nothing is saved for this at all. On open, the app picks the
// patient with the newest activity, read from the database that already holds every code, so a code
// lives in one place only. With no activity, the caller falls back to the first patient.
//
// An older install still has the code in localStorage. It is removed on the first open.
import { db, isLive } from "./db";

const LEGACY_KEY = "cmai-patient";

/** Remove the plain code an older version of the app left in localStorage. Never throws. */
export function clearLegacyPatientCode(): void {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* private mode or blocked: nothing to remove */
  }
}

/**
 * The patient with the newest activity: the latest log (by when it was entered, deleted logs ignored)
 * or "nothing to log" check-in. Null when no patient has any, or when storage cannot be read.
 * Ties go to the earlier code, so the answer never depends on the order the database returns rows.
 */
export async function patientWithNewestActivity(): Promise<string | null> {
  try {
    const patients = new Set((await db.patients.toArray()).map((p) => p.id));
    const newest = new Map<string, number>();
    const note = (id: string, t: number) => {
      if (patients.has(id) && t > (newest.get(id) ?? -Infinity)) newest.set(id, t);
    };
    for (const o of await db.observations.toArray()) if (isLive(o)) note(o.patientId, o.loggedAt);
    for (const c of await db.checkins.toArray()) note(c.patientId, c.at);
    let best: string | null = null;
    for (const [id, t] of [...newest].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (best === null || t > newest.get(best)!) best = id;
    }
    return best;
  } catch {
    return null;
  }
}

/** The patient to open on, or null to use the first. Never throws. */
export async function startingPatient(): Promise<string | null> {
  clearLegacyPatientCode();
  return patientWithNewestActivity();
}
