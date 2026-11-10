// Patient and backup management: restore an export, delete or archive a patient, clear demo data.
// Restoring merges into what is already on the phone. Nothing is overwritten except a
// day-14 review or check-in with the same key, where the backup's copy wins. Deleted logs
// come back deleted, with their reason, and the change history comes back with them.
// Backups from database version 3 (format 1) and version 4 (format 2) both restore.

import { study } from "../study/settings";
import {
  ARCHIVE_REASONS,
  checkInKey,
  db,
  reviewKey,
  type Assignment,
  type Caregiver,
  type CaregiverRating,
  type CheckIn,
  type LogChange,
  type Made,
  type Patient,
  type Review,
  type StoredObservation,
  type Watch,
} from "./db";

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
const CAREGIVER = /^C-[0-9]{2,3}$/; // R2: a code, never a name
const INITIALS = /^[A-Z]{2,3}$/;
const ID = /^[A-Za-z0-9-]{8,64}$/; // uid and deviceId: crypto.randomUUID() on the phone that made them
const MAX_OFFSET = 14 * 60; // UTC+14 is the furthest any clock sits from UTC
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => list.includes(v as T);

/** The "who and which phone" fields of a version 4 record, or null if either is malformed. */
function cleanMade(e: Record<string, unknown>): Made | null {
  const out: Made = {};
  if (e.by !== undefined) {
    if (typeof e.by !== "string" || !CAREGIVER.test(e.by)) return null;
    out.by = e.by;
  }
  if (e.deviceId !== undefined) {
    if (typeof e.deviceId !== "string" || !ID.test(e.deviceId)) return null;
    out.deviceId = e.deviceId;
  }
  return out;
}

const offsetOk = (v: unknown): v is number => int(v) && Math.abs(v) <= MAX_OFFSET;
const EARLIEST = Date.UTC(2020, 0, 1);

const NOT_A_BACKUP = "This file is not a CMAI Tracker backup. Choose the .json file from Export.";

/** The log fields a backup may carry. Anything else in the file is dropped, never stored. */
function cleanLog(o: Record<string, unknown>, inRange: (v: unknown) => v is number): Partial<StoredObservation> | null {
  const made = cleanMade(o);
  if (!made) return null;
  const out: Partial<StoredObservation> = { ...made };
  if (o.uid !== undefined) {
    if (typeof o.uid !== "string" || !ID.test(o.uid)) return null;
    out.uid = o.uid;
  }
  if (o.tzOffsetMin !== undefined) {
    if (!offsetOk(o.tzOffsetMin)) return null;
    out.tzOffsetMin = o.tzOffsetMin;
  }
  if (o.patientId !== undefined) {
    if (typeof o.patientId !== "string" || !CODE.test(o.patientId)) return null;
    out.patientId = o.patientId;
  }
  if (o.itemId !== undefined) {
    if (!int(o.itemId) || o.itemId < 1 || o.itemId > 29) return null;
    out.itemId = o.itemId;
  }
  for (const k of ["at", "loggedAt", "deletedAt", "endedAt"] as const) {
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
    if (p.color !== undefined && (!int(p.color) || p.color < 0 || p.color > 63)) return null;
    // Archived (D-20): a date and a reason from the list, or neither.
    if ((p.archivedAt === undefined) !== (p.archiveReason === undefined)) return null;
    if (p.archivedAt !== undefined && (!inRange(p.archivedAt) || !oneOf(p.archiveReason, ARCHIVE_REASONS))) return null;
    if (p.archiveNote !== undefined && !text(p.archiveNote, 120)) return null;
    return {
      id: p.id,
      anchor: p.anchor,
      ...(p.demo ? { demo: true } : {}),
      ...(p.color !== undefined ? { color: p.color } : {}),
      ...(p.archivedAt !== undefined ? { archivedAt: p.archivedAt, archiveReason: p.archiveReason as string } : {}),
      ...(p.archiveNote !== undefined ? { archiveNote: p.archiveNote as string } : {}),
    };
  });
  const observations = keep<StoredObservation>(data.observations, (o) => {
    const c = cleanLog(o, inRange);
    if (!c || c.patientId === undefined || c.itemId === undefined || c.at === undefined || c.loggedAt === undefined)
      return null;
    if (o.id !== undefined && !int(o.id)) return null;
    if (c.endedAt !== undefined && c.endedAt < c.at) return null; // it cannot stop before it started
    return { ...(c as StoredObservation), ...(o.id !== undefined ? { id: o.id as number } : {}) };
  });
  const reviews = keep<Review>(data.reviews, (r) => {
    if (!text(r.key, 80) || !r.key || typeof r.patientId !== "string" || !CODE.test(r.patientId)) return null;
    if (!inRange(r.windowStart) || !inRange(r.reviewedAt) || !int(r.itemId) || r.itemId < 1 || r.itemId > 29)
      return null;
    if (!int(r.choice) || r.choice < 1 || r.choice > 9 || typeof r.derived !== "number" || !Number.isFinite(r.derived))
      return null;
    // The key is how a review is found again; one that names another patient or window would file it there.
    if (r.key !== reviewKey(r.patientId, r.windowStart, r.itemId)) return null;
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
    if (c.key !== checkInKey(c.patientId, c.day)) return null; // the same for a check-in
    const made = cleanMade(c);
    if (!made) return null;
    return { key: c.key, patientId: c.patientId, day: c.day, at: c.at, ...made };
  });
  const changes = keep<LogChange>(data.changes, (c) => {
    if (!int(c.observationId) || typeof c.patientId !== "string" || !CODE.test(c.patientId) || !inRange(c.at))
      return null;
    if (c.action !== "edit" && c.action !== "delete" && c.action !== "restore") return null;
    const made = cleanMade(c);
    if (!made) return null;
    const side = (v: unknown) => (isObj(v) ? cleanLog(v, inRange) : null);
    return {
      observationId: c.observationId,
      patientId: c.patientId,
      action: c.action,
      at: c.at,
      ...made,
      ...(side(c.from) ? { from: side(c.from)! } : {}),
      ...(side(c.to) ? { to: side(c.to)! } : {}),
    };
  });
  // Version 4 tables (format 2). A format 1 file has none of them, which is fine.
  // PIN fields are never in a backup; if a file has them they are dropped here, never stored.
  const caregivers = keep<Caregiver>(data.caregivers, (c) => {
    if (typeof c.id !== "string" || !CAREGIVER.test(c.id)) return null;
    if (typeof c.initials !== "string" || !INITIALS.test(c.initials) || !inRange(c.createdAt)) return null;
    if (c.archivedAt !== undefined && !inRange(c.archivedAt)) return null;
    return {
      id: c.id,
      initials: c.initials,
      createdAt: c.createdAt,
      ...(c.archivedAt !== undefined ? { archivedAt: c.archivedAt } : {}),
    };
  });
  const assignments = keep<Assignment>(data.assignments, (a) => {
    if (typeof a.caregiverId !== "string" || !CAREGIVER.test(a.caregiverId)) return null;
    if (typeof a.patientId !== "string" || !CODE.test(a.patientId)) return null;
    if (!int(a.order) || a.order < 0 || a.order > 999 || !inRange(a.at)) return null;
    return { caregiverId: a.caregiverId, patientId: a.patientId, order: a.order, at: a.at };
  });
  const watches = keep<Watch>(data.watches, (w) => {
    const made = cleanMade(w);
    if (!made || typeof w.uid !== "string" || !ID.test(w.uid)) return null;
    if (typeof w.patientId !== "string" || !CODE.test(w.patientId) || !inRange(w.start)) return null;
    if (!oneOf(w.startSource, ["tap", "log"] as const)) return null;
    if (w.end !== undefined && (!inRange(w.end) || w.end < w.start)) return null;
    if (w.endSource !== undefined && !oneOf(w.endSource, ["tap", "switch", "signout", "timeout"] as const)) return null;
    if (w.tzOffsetMin !== undefined && !offsetOk(w.tzOffsetMin)) return null;
    return {
      uid: w.uid,
      patientId: w.patientId,
      start: w.start,
      startSource: w.startSource,
      ...made,
      ...(w.end !== undefined ? { end: w.end } : {}),
      ...(w.endSource !== undefined ? { endSource: w.endSource } : {}),
      ...(w.tzOffsetMin !== undefined ? { tzOffsetMin: w.tzOffsetMin } : {}),
    };
  });
  const caregiverRatings = keep<CaregiverRating>(data.caregiverRatings, (r) => {
    const made = cleanMade(r);
    if (!made || typeof r.uid !== "string" || !ID.test(r.uid)) return null;
    if (typeof r.patientId !== "string" || !CODE.test(r.patientId) || !inRange(r.windowStart)) return null;
    if (!inRange(r.startedAt) || (r.submittedAt !== undefined && !inRange(r.submittedAt))) return null;
    if (!text(r.ruleVersion, 40) || !r.ruleVersion || !isObj(r.answers) || Array.isArray(r.answers)) return null;
    const answers: Record<number, number> = {};
    for (const [k, v] of Object.entries(r.answers)) {
      const item = Number(k);
      // Items 1 to 29; answers 1 to 7, or 8 (would happen if not prevented) or 9 (not applicable).
      if (!/^[0-9]{1,2}$/.test(k) || item < 1 || item > 29 || !int(v) || v < 1 || v > 9) return null;
      answers[item] = v;
    }
    return {
      uid: r.uid,
      patientId: r.patientId,
      windowStart: r.windowStart,
      answers,
      startedAt: r.startedAt,
      ruleVersion: r.ruleVersion,
      ...made,
      ...(r.submittedAt !== undefined ? { submittedAt: r.submittedAt } : {}),
    };
  });
  return {
    patients,
    observations,
    reviews,
    checkins,
    changes,
    caregivers,
    assignments,
    watches,
    caregiverRatings,
    skipped,
  };
}

const ALL_TABLES = () => [
  db.patients,
  db.observations,
  db.reviews,
  db.checkins,
  db.changes,
  db.caregivers,
  db.assignments,
  db.watches,
  db.caregiverRatings,
];

export async function restoreBackup(raw: string): Promise<RestoreResult> {
  const parsed = parseBackup(raw);
  // A record must belong to a patient in the file or already on this phone.
  const known = new Set([...parsed.patients.map((p) => p.id), ...(await db.patients.toCollection().primaryKeys())]);
  const mine = <T extends { patientId: string }>(list: T[]) => list.filter((e) => known.has(e.patientId));
  const b = {
    ...parsed,
    observations: mine(parsed.observations),
    reviews: mine(parsed.reviews),
    checkins: mine(parsed.checkins),
    changes: mine(parsed.changes),
    assignments: mine(parsed.assignments),
    watches: mine(parsed.watches),
    caregiverRatings: mine(parsed.caregiverRatings),
  };
  const lists = [
    "observations",
    "reviews",
    "checkins",
    "changes",
    "assignments",
    "watches",
    "caregiverRatings",
  ] as const;
  const orphans = lists.reduce((n, k) => n + parsed[k].length - b[k].length, 0);
  const result: RestoreResult = {
    patients: 0,
    observations: 0,
    reviews: b.reviews.length,
    checkins: b.checkins.length,
    skipped: parsed.skipped + orphans,
  };
  await db.transaction("rw", ALL_TABLES(), async () => {
    for (const p of b.patients) {
      if (!(await db.patients.get(p.id))) {
        await db.patients.add(p);
        result.patients++;
      }
    }
    // A log already on the phone is matched by its unique ID, or, for a log from before
    // version 4, by patient, behavior, time and entry time. Either match means "already here".
    // A restored log gets a new row id on this phone, so its history is re-pointed to that id.
    const key = (o: StoredObservation) => `${o.patientId}|${o.itemId}|${o.at}|${o.loggedAt}`;
    const onPhone = await db.observations.toArray();
    const seen = new Set(onPhone.map(key));
    const seenUid = new Set(onPhone.map((o) => o.uid));
    const newId = new Map<number, number>();
    for (const o of b.observations) {
      const k = key(o);
      if (seen.has(k) || (o.uid !== undefined && seenUid.has(o.uid))) continue;
      seen.add(k);
      const { id: oldId, ...rest } = o;
      const id = await db.observations.add(rest);
      seenUid.add(rest.uid); // filled by the database when the file had none
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
    // Caregivers, watches and caregiver ratings are never overwritten: a caregiver on this phone
    // keeps their PIN, and a submitted rating is locked (F-47).
    for (const c of b.caregivers) if (!(await db.caregivers.get(c.id))) await db.caregivers.add(c);
    for (const a of b.assignments)
      if (!(await db.assignments.get([a.caregiverId, a.patientId]))) await db.assignments.add(a);
    for (const w of b.watches) if (!(await db.watches.get(w.uid))) await db.watches.add(w);
    for (const r of b.caregiverRatings) {
      if (await db.caregiverRatings.get(r.uid)) continue;
      // One rating per caregiver, resident and period.
      const twin =
        r.by &&
        (await db.caregiverRatings
          .where("[patientId+windowStart+by]")
          .equals([r.patientId, r.windowStart, r.by])
          .count());
      if (!twin) await db.caregiverRatings.add(r);
    }
  });
  return result;
}

/** True when deleting this patient would archive it instead (D-20): real logs, and archiving is on. */
export async function wouldArchive(id: string, archive = study.archivePatients) {
  if (!archive) return false;
  const p = await db.patients.get(id);
  if (!p || p.demo) return false;
  return (await db.observations.where("patientId").equals(id).count()) > 0;
}

/**
 * Deletes a patient and everything recorded for them, or, when `wouldArchive` is true, archives
 * them instead: every record stays, the patient leaves the lists, and the reason is kept (D-20).
 * Throws when archiving without a reason, or "Other" without a note.
 */
export async function deletePatient(
  id: string,
  why?: { reason: string; note?: string },
  { archive = study.archivePatients, now = Date.now() } = {},
): Promise<"erased" | "archived"> {
  if (await wouldArchive(id, archive)) {
    const note = why?.note?.trim() || undefined;
    if (!why || !oneOf(why.reason, ARCHIVE_REASONS)) throw new Error("Pick a reason to remove this patient.");
    if (why.reason === "Other" && !note) throw new Error("Say in a few words why this patient is being removed.");
    // The same limit restore checks, so an archived patient always comes back from a backup.
    if (note && note.length > 120) throw new Error("Keep the note to 120 characters.");
    await db.patients.update(id, {
      archivedAt: now,
      archiveReason: why.reason,
      ...(note ? { archiveNote: note } : {}),
    });
    return "archived";
  }
  await db.transaction("rw", ALL_TABLES(), async () => {
    for (const t of [
      db.observations,
      db.changes,
      db.reviews,
      db.checkins,
      db.assignments,
      db.watches,
      db.caregiverRatings,
    ])
      await t.where("patientId").equals(id).delete();
    await db.patients.delete(id);
  });
  return "erased";
}

/** Removes every patient made by "Load demo data". Returns how many were removed. */
export async function removeDemoData() {
  const demo = (await db.patients.toArray()).filter((p) => p.demo);
  for (const p of demo) await deletePatient(p.id);
  return demo.length;
}
