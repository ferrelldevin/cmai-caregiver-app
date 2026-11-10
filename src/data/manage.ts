// Patient and backup management: restore an export, delete a patient, clear demo data.
// Restoring merges into what is already on the phone. Nothing is overwritten except a
// day-14 review or check-in with the same key, where the backup's copy wins. Deleted logs
// come back deleted, with their reason, and the change history comes back with them.

import { db, type CheckIn, type LogChange, type Patient, type Review, type StoredObservation } from "./db";

export interface RestoreResult {
  patients: number; // new patients added
  observations: number; // new logs added (exact duplicates are skipped)
  reviews: number;
  checkins: number;
  skipped: number; // entries in the file that failed the checks and were left out
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const int = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const CODE = /^[A-Z0-9-]{2,12}$/; // the same rule as the Add patient field
const EARLIEST = Date.UTC(2020, 0, 1);

const NOT_A_BACKUP = "This file is not a CMAI Tracker backup. Choose the .json file from Export.";

/** The log fields a backup may carry. Anything else in the file is dropped, never stored. */
function cleanLog(o: Record<string, unknown>, inRange: (v: unknown) => v is number): Partial<StoredObservation> | null {
  const out: Partial<StoredObservation> = {};
  if (o.patientId !== undefined) {
    if (typeof o.patientId !== "string" || !CODE.test(o.patientId)) return null;
    out.patientId = o.patientId;
  }
  if (o.itemId !== undefined) {
    if (!int(o.itemId) || o.itemId < 1 || o.itemId > 29) return null;
    out.itemId = o.itemId;
  }
  for (const k of ["at", "loggedAt", "deletedAt"] as const) {
    if (o[k] !== undefined) {
      if (!inRange(o[k])) return null;
      out[k] = o[k];
    }
  }
  if (o.approx !== undefined) {
    if (typeof o.approx !== "boolean") return null;
    out.approx = o.approx;
  }
  for (const [k, max] of [
    ["before", 40],
    ["deleteReason", 40],
    ["beforeNote", 120],
    ["deleteNote", 120],
  ] as const) {
    if (o[k] !== undefined) {
      if (!text(o[k], max)) return null;
      out[k] = o[k] as string;
    }
  }
  return out;
}

/**
 * Throws an Error with a message a caregiver can read when the file is not a CMAI Tracker backup.
 * Keeps an entry only if every field passes its check, and copies only the named fields.
 * `skipped` counts the entries that were left out. `now` is injectable for tests.
 */
export function parseBackup(raw: string, now = Date.now()) {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(NOT_A_BACKUP);
  }
  if (!isObj(data) || !Array.isArray(data.patients) || !Array.isArray(data.observations)) throw new Error(NOT_A_BACKUP);

  const latest = now + 24 * 60 * 60 * 1000;
  const inRange = (v: unknown): v is number => int(v) && v >= EARLIEST && v <= latest;
  let skipped = 0;
  const keep = <T>(list: unknown, check: (e: Record<string, unknown>) => T | null): T[] => {
    const out: T[] = [];
    for (const e of Array.isArray(list) ? list : []) {
      const c = isObj(e) ? check(e) : null;
      if (c) out.push(c);
      else skipped++;
    }
    return out;
  };

  const patients = keep<Patient>(data.patients, (p) => {
    if (typeof p.id !== "string" || !CODE.test(p.id) || !inRange(p.anchor)) return null;
    if (p.demo !== undefined && p.demo !== true) return null;
    return { id: p.id, anchor: p.anchor, ...(p.demo ? { demo: true } : {}) };
  });
  const observations = keep<StoredObservation>(data.observations, (o) => {
    const c = cleanLog(o, inRange);
    if (!c || c.patientId === undefined || c.itemId === undefined || c.at === undefined || c.loggedAt === undefined)
      return null;
    if (o.id !== undefined && !int(o.id)) return null;
    return { ...(c as StoredObservation), ...(o.id !== undefined ? { id: o.id as number } : {}) };
  });
  const reviews = keep<Review>(data.reviews, (r) => {
    if (!text(r.key, 80) || !r.key || typeof r.patientId !== "string" || !CODE.test(r.patientId)) return null;
    if (!inRange(r.windowStart) || !inRange(r.reviewedAt) || !int(r.itemId) || r.itemId < 1 || r.itemId > 29)
      return null;
    if (!int(r.choice) || r.choice < 1 || r.choice > 9 || typeof r.derived !== "number" || !Number.isFinite(r.derived))
      return null;
    return {
      key: r.key,
      patientId: r.patientId,
      windowStart: r.windowStart,
      itemId: r.itemId,
      choice: r.choice,
      derived: r.derived,
      reviewedAt: r.reviewedAt,
    };
  });
  const checkins = keep<CheckIn>(data.checkins, (c) => {
    if (
      !text(c.key, 80) ||
      !c.key ||
      typeof c.patientId !== "string" ||
      !CODE.test(c.patientId) ||
      !inRange(c.day) ||
      !inRange(c.at)
    )
      return null;
    return { key: c.key, patientId: c.patientId, day: c.day, at: c.at };
  });
  const changes = keep<LogChange>(data.changes, (c) => {
    if (!int(c.observationId) || typeof c.patientId !== "string" || !CODE.test(c.patientId) || !inRange(c.at))
      return null;
    if (c.action !== "edit" && c.action !== "delete" && c.action !== "restore") return null;
    const side = (v: unknown) => (isObj(v) ? cleanLog(v, inRange) : null);
    return {
      observationId: c.observationId,
      patientId: c.patientId,
      action: c.action,
      at: c.at,
      ...(side(c.from) ? { from: side(c.from)! } : {}),
      ...(side(c.to) ? { to: side(c.to)! } : {}),
    };
  });
  return { patients, observations, reviews, checkins, changes, skipped };
}

export async function restoreBackup(raw: string): Promise<RestoreResult> {
  const parsed = parseBackup(raw);
  // A log, review, check-in or change must belong to a patient in the file or already on this phone.
  const known = new Set([...parsed.patients.map((p) => p.id), ...(await db.patients.toCollection().primaryKeys())]);
  const mine = <T extends { patientId: string }>(list: T[]) => list.filter((e) => known.has(e.patientId));
  const b = {
    ...parsed,
    observations: mine(parsed.observations),
    reviews: mine(parsed.reviews),
    checkins: mine(parsed.checkins),
    changes: mine(parsed.changes),
  };
  const orphans =
    parsed.observations.length -
    b.observations.length +
    parsed.reviews.length -
    b.reviews.length +
    parsed.checkins.length -
    b.checkins.length +
    parsed.changes.length -
    b.changes.length;
  const result: RestoreResult = {
    patients: 0,
    observations: 0,
    reviews: b.reviews.length,
    checkins: b.checkins.length,
    skipped: parsed.skipped + orphans,
  };
  await db.transaction("rw", [db.patients, db.observations, db.reviews, db.checkins, db.changes], async () => {
    for (const p of b.patients) {
      if (!(await db.patients.get(p.id))) {
        await db.patients.add(p);
        result.patients++;
      }
    }
    // A restored log gets a new id on this phone, so its history is re-pointed to that id.
    const key = (o: StoredObservation) => `${o.patientId}|${o.itemId}|${o.at}|${o.loggedAt}`;
    const seen = new Set((await db.observations.toArray()).map(key));
    const newId = new Map<number, number>();
    for (const o of b.observations) {
      const k = key(o);
      if (seen.has(k)) continue;
      seen.add(k);
      const { id: oldId, ...rest } = o;
      const id = await db.observations.add(rest);
      if (oldId !== undefined) newId.set(oldId, id);
      result.observations++;
    }
    for (const c of b.changes) {
      const id = newId.get(c.observationId);
      if (id === undefined) continue; // its log was already on this phone, with its own history
      await db.changes.add({ ...c, observationId: id });
    }
    await db.reviews.bulkPut(b.reviews);
    await db.checkins.bulkPut(b.checkins);
  });
  return result;
}

export async function deletePatient(id: string) {
  await db.transaction("rw", [db.patients, db.observations, db.reviews, db.checkins, db.changes], async () => {
    await db.observations.where("patientId").equals(id).delete();
    await db.changes.where("patientId").equals(id).delete();
    await db.reviews.where("patientId").equals(id).delete();
    await db.checkins.where("patientId").equals(id).delete();
    await db.patients.delete(id);
  });
}

/** Removes every patient made by "Load demo data". Returns how many were removed. */
export async function removeDemoData() {
  const demo = (await db.patients.toArray()).filter((p) => p.demo);
  for (const p of demo) await deletePatient(p.id);
  return demo.length;
}
