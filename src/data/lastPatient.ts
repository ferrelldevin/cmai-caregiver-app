// Which patient the app reopens on.
//
// This used to sit in localStorage as the plain patient code. A phone's localStorage is not part of
// the research data: it is outside the backup, outside "delete this patient", and a code there was
// found by CodeQL as clear-text storage of sensitive data. The pointer now lives in the same
// IndexedDB database as the logs (table `meta`), so deleting the data deletes the pointer, and
// there is one place on the phone to protect.
//
// An older install still has the code in localStorage. It is moved across once and then removed.
import { db } from "./db";

const KEY = "lastPatient";
const LEGACY_KEY = "cmai-patient";

function takeLegacy(): string | null {
  try {
    const old = localStorage.getItem(LEGACY_KEY);
    if (old !== null) localStorage.removeItem(LEGACY_KEY);
    return old;
  } catch {
    return null; // private mode: nothing to move
  }
}

/** The patient to reopen on, or null. Never throws: a phone that cannot read storage opens on the first patient. */
export async function readLastPatient(): Promise<string | null> {
  const legacy = takeLegacy();
  try {
    if (legacy) await db.meta.put({ key: KEY, value: legacy });
    return legacy ?? (await db.meta.get(KEY))?.value ?? null;
  } catch {
    return legacy; // storage unreadable; still honor what we just took
  }
}

/** Remember the patient (or forget, with null). Never throws. */
export async function saveLastPatient(id: string | null): Promise<void> {
  try {
    if (id) await db.meta.put({ key: KEY, value: id });
    else await db.meta.delete(KEY);
  } catch {
    /* storage full or blocked: the app opens on the first patient next time */
  }
}
