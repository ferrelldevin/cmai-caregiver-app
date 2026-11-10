// Caregivers on this phone (R2, plan 5.2; on assumed approval, switch `caregiverProfiles`).
// A caregiver is a code and initials, never a name. Any caregiver can log for any resident on the
// phone: "My residents" is an order for the switcher, not a lock (design note 010).

import { db, setLoggingCaregiver, type Caregiver, type Patient } from "./db";

export const CAREGIVER_CODE = /^C-[0-9]{2,3}$/;
export const INITIALS = /^[A-Z]{2,3}$/;
const STORE_KEY = "cmai-caregiver";

/** Caregivers who can log, oldest first. Archived ones keep their records but leave the list. */
export async function activeCaregivers(): Promise<Caregiver[]> {
  return (await db.caregivers.toArray())
    .filter((c) => c.archivedAt === undefined)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** The highest caregiver number ever given on this phone, kept in meta so a deleted code is not reused either. */
async function lastNumber(): Promise<number> {
  const used = (await db.caregivers.toCollection().primaryKeys()).map((id) => Number(id.slice(2)));
  const kept = Number((await db.meta.get("lastCaregiver"))?.value ?? 0);
  return Math.max(0, kept, ...used);
}

/** Adds a caregiver. Throws with a message the form can show when the initials are not 2 or 3 letters. */
export async function addCaregiver(initials: string, now = Date.now()): Promise<Caregiver> {
  const clean = initials.trim().toUpperCase();
  if (!INITIALS.test(clean)) throw new Error("Use 2 or 3 letters, like JM. Initials only, not a name.");
  return db.transaction("rw", [db.caregivers, db.meta], async () => {
    const n = (await lastNumber()) + 1;
    const c: Caregiver = { id: `C-${String(n).padStart(2, "0")}`, initials: clean, createdAt: now };
    await db.caregivers.add(c);
    await db.meta.put({ key: "lastCaregiver", value: n });
    return c;
  });
}

/** True once anything on this phone says this caregiver made it. */
export async function hasRecords(id: string): Promise<boolean> {
  const by = (r: { by?: string }) => r.by === id;
  return (
    (await db.observations.filter(by).count()) > 0 ||
    (await db.checkins.filter(by).count()) > 0 ||
    (await db.changes.filter(by).count()) > 0 ||
    (await db.watches.filter(by).count()) > 0 ||
    (await db.caregiverRatings.filter(by).count()) > 0
  );
}

/** Removes a caregiver from the list: archived once they have a record, otherwise deleted. Returns which. */
export async function removeCaregiver(id: string, now = Date.now()): Promise<"archived" | "deleted"> {
  if (await hasRecords(id)) {
    await db.caregivers.update(id, { archivedAt: now });
    return "archived";
  }
  await db.transaction("rw", [db.caregivers, db.assignments], async () => {
    await db.assignments.where("caregiverId").equals(id).delete();
    await db.caregivers.delete(id);
  });
  return "deleted";
}

/** The residents this caregiver put first, in their order. */
export async function myResidents(caregiverId: string): Promise<string[]> {
  return (await db.assignments.where("caregiverId").equals(caregiverId).toArray())
    .sort((a, b) => a.order - b.order)
    .map((a) => a.patientId);
}

/** Replaces a caregiver's "My residents" with this list, in this order. */
export async function setMyResidents(caregiverId: string, patientIds: string[], now = Date.now()) {
  await db.transaction("rw", db.assignments, async () => {
    await db.assignments.where("caregiverId").equals(caregiverId).delete();
    await db.assignments.bulkAdd(patientIds.map((patientId, order) => ({ caregiverId, patientId, order, at: now })));
  });
}

/** Mine first, in my order, then everyone else in the list's order. Archived patients are already out of `patients`. */
export function orderForCaregiver<T extends Pick<Patient, "id">>(
  patients: T[],
  mine: string[],
): { mine: T[]; others: T[] } {
  const byId = new Map(patients.map((p) => [p.id, p]));
  const first = mine.map((id) => byId.get(id)).filter((p): p is T => !!p);
  const firstIds = new Set(first.map((p) => p.id));
  return { mine: first, others: patients.filter((p) => !firstIds.has(p.id)) };
}

/** The caregiver logging now, as remembered on this phone (code only). */
export function readLoggingCaregiver(): string | null {
  try {
    const id = localStorage.getItem(STORE_KEY);
    return id && CAREGIVER_CODE.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Sets who is logging: every new record carries this code from now on. */
export function chooseLoggingCaregiver(id: string | null) {
  setLoggingCaregiver(id ?? undefined);
  try {
    if (id) localStorage.setItem(STORE_KEY, id);
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode: the choice lasts until the app closes */
  }
}
