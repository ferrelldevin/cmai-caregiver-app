// Local, offline storage in the browser (IndexedDB, through Dexie).
// Nothing leaves the device unless the caregiver presses Export.

import Dexie, { type Table } from "dexie";
import { newId } from "./ids";

/** Why a patient was archived instead of erased (D-20). A pick list, so no names get typed. */
export const ARCHIVE_REASONS = ["Added by mistake", "Left the study", "Duplicate", "Other"] as const;

export interface Patient {
  id: string; // pseudonymous code such as "P-01". Never a name.
  anchor: number; // local midnight of day 1; 14-day windows count from here
  demo?: boolean; // created by the demo-data button
  // Version 4 (D-20, on assumed approval): a patient with real logs is archived, never erased.
  archivedAt?: number;
  archiveReason?: string; // one of ARCHIVE_REASONS
  archiveNote?: string; // a few words when the reason is "Other" (no names)
  color?: number; // index into the resident color list, so a badge keeps its color when the order changes
}

/** True for a patient who has not been archived. Archived patients keep every record but leave the lists. */
export const isActive = (p: Patient) => p.archivedAt === undefined;

/** Who made a record and on which phone (version 4). `by` stays empty until caregiver profiles (R2) exist. */
export interface Made {
  by?: string; // caregiver code such as "C-02"
  deviceId?: string; // the phone it was made on (meta "deviceId")
}

export interface StoredObservation extends Made {
  id?: number;
  uid?: string; // unique across phones; every log has one from version 4 on
  patientId: string;
  itemId: number;
  at: number; // when it happened (epoch ms)
  approx?: boolean; // caregiver marked the time as approximate
  before?: string; // optional: what happened just before
  beforeNote?: string; // optional: a few words when "before" is "Other" (no names)
  loggedAt: number; // when it was entered
  // Deleting a log only marks it. The record stays, so the lab can audit every removal,
  // and scoring skips it (design note 007).
  deletedAt?: number;
  deleteReason?: string; // one of DELETE_REASONS in logs.ts
  deleteNote?: string; // a few words when the reason is "Other" (no names)
  tzOffsetMin?: number; // minutes from UTC on the phone when it was logged (D-22)
  endedAt?: number; // when it stopped, if the caregiver said (F-39). Never read by scoring
}

/** True for a log that counts: one that has not been deleted. */
export const isLive = (o: StoredObservation) => o.deletedAt === undefined;

/**
 * A day-14 review choice from before scores were locked (D-14). Kept in storage and backups
 * so nothing recorded is lost, but no score reads it: the app's rating is never overridden.
 */
export interface Review {
  key: string; // `${patientId}|${windowStart}|${itemId}`
  patientId: string;
  windowStart: number;
  itemId: number;
  choice: number; // 1-7, or 8 / 9
  derived: number; // what the engine said, kept for comparison
  reviewedAt: number;
}

/**
 * One entry per edit, delete or restore of a log, never changed or removed except with the
 * whole patient. `from` and `to` hold the fields that changed (design note 007).
 */
export interface LogChange extends Made {
  id?: number;
  observationId: number;
  patientId: string;
  action: "edit" | "delete" | "restore";
  at: number; // when the change was made
  from?: Partial<StoredObservation>;
  to?: Partial<StoredObservation>;
}

/** "Nothing to log today": tells a quiet day apart from a day nobody logged. */
export interface CheckIn extends Made {
  key: string; // `${patientId}|${day}`, so one per patient per day
  patientId: string;
  day: number; // local midnight of the day it covers
  at: number; // when it was tapped
}

/** One row per setting of this copy of the app. Rows: "deviceId", "createdAt". */
export interface Meta {
  key: string;
  value: string | number;
}

/**
 * A caregiver on this phone (R2): a code and initials, never a name. PIN fields are filled by
 * step 5.3 and are never exported. A caregiver with a record is archived, never deleted.
 */
export interface Caregiver {
  id: string; // "C-01"; never reused
  initials: string; // 2 or 3 capital letters
  createdAt: number;
  archivedAt?: number;
  pinSalt?: Uint8Array;
  pinHash?: Uint8Array;
  pinIterations?: number;
  failedAttempts?: number;
  lockedAt?: number;
}

/** Fields that stay on the phone: no backup or export ever carries them. */
export const SECRET_CAREGIVER_FIELDS = ["pinSalt", "pinHash", "pinIterations", "failedAttempts", "lockedAt"] as const;

/** "My residents": the order a caregiver sees residents in. An order, not a lock (R2). */
export interface Assignment {
  caregiverId: string;
  patientId: string;
  order: number;
  at: number;
}

/** A stretch of time when a caregiver was with a resident (F-38, D-25). */
export interface Watch extends Made {
  uid: string;
  patientId: string;
  start: number;
  end?: number; // open while undefined
  startSource: "tap" | "log";
  endSource?: "tap" | "switch" | "signout" | "timeout";
  tzOffsetMin?: number;
}

/**
 * A caregiver's own CMAI for one finished period (F-47): item number to 1-9.
 * Locked once submitted. No scoring function reads it, and it never changes the app's rating.
 */
export interface CaregiverRating extends Made {
  uid: string;
  patientId: string;
  windowStart: number;
  answers: Record<number, number>;
  startedAt: number;
  submittedAt?: number;
  ruleVersion: string;
}

class CmaiDb extends Dexie {
  patients!: Table<Patient, string>;
  observations!: Table<StoredObservation, number>;
  reviews!: Table<Review, string>;
  checkins!: Table<CheckIn, string>;
  changes!: Table<LogChange, number>;
  meta!: Table<Meta, string>;
  caregivers!: Table<Caregiver, string>;
  assignments!: Table<Assignment, [string, string]>;
  watches!: Table<Watch, string>;
  caregiverRatings!: Table<CaregiverRating, string>;
  constructor() {
    super("cmai-tracker");
    this.version(1).stores({
      patients: "id",
      observations: "++id, patientId, [patientId+at]",
      reviews: "key, patientId",
    });
    // Version 2 only adds a table. Existing patients, logs and reviews are kept as they are.
    this.version(2).stores({
      checkins: "key, patientId",
    });
    // Version 3 adds the change history. Existing data is kept; old logs have no deletedAt, so all still count.
    this.version(3).stores({
      changes: "++id, patientId, observationId",
    });
    // Version 4: one upgrade for every step that needs new fields (build plan 5.1, F-44). Existing
    // rows are kept. Each old log gets an ID that is unique across phones; nothing else is filled in,
    // because nobody knows who made an old log or the phone's offset when it was made.
    this.version(4)
      .stores({
        observations: "++id, patientId, [patientId+at], &uid",
        meta: "key",
        caregivers: "id",
        assignments: "[caregiverId+patientId], caregiverId, patientId",
        watches: "uid, patientId, [patientId+start]",
        caregiverRatings: "uid, patientId, [patientId+windowStart+by]",
      })
      .upgrade(async (tx) => {
        await writeMeta(tx.table("meta"));
        await tx
          .table("observations")
          .toCollection()
          .modify((o: StoredObservation) => {
            if (!o.uid) o.uid = newId();
          });
      });
    // A phone that installs the app fresh starts at version 4 and never runs the upgrade.
    this.on("populate", (tx) => writeMeta(tx.table("meta")));
    // Every log gets its unique ID however it is added: a tap, demo data, or a restore.
    this.observations.hook("creating", (_key, o) => {
      if (!o.uid) o.uid = newId();
    });
    // Sticky (true), so it runs on every open, not only the first.
    this.on(
      "ready",
      async () => {
        deviceId = (await this.meta.get("deviceId"))?.value as string | undefined;
      },
      true,
    );
  }
}

async function writeMeta(meta: Table<Meta, string>) {
  await meta.put({ key: "deviceId", value: newId() });
  await meta.put({ key: "createdAt", value: Date.now() });
}

// Read once when the database opens, so a tap can stamp a log without waiting on storage.
let deviceId: string | undefined;

/** This phone's ID, once the database has opened. */
export const thisDevice = () => deviceId;

/** What a new record made on this phone carries about where it was made. `by` comes with R2 (5.2). */
export const madeHere = (): Made => (deviceId ? { deviceId } : {});

export const db = new CmaiDb();

// Kept here so existing imports still work; the engine owns calendar-day math.
export { localMidnight } from "../scoring/engine";

export const reviewKey = (patientId: string, windowStart: number, itemId: number) =>
  `${patientId}|${windowStart}|${itemId}`;

export const checkInKey = (patientId: string, day: number) => `${patientId}|${day}`;
