// Changing a log after it is made: edit, correct the behavior, delete, restore. Every change is
// written to the change history in the same transaction, so the history and the log can't disagree.
// A delete only marks the log (soft delete); scoring skips marked logs (design note 007).

import { ITEMS } from "../scoring/items";
import { study } from "../study/settings";
import { db, madeHere, type LogChange, type StoredObservation } from "./db";

/** Why a log was removed. A pick list, so reasons can be counted and no names get typed. */
export const DELETE_REASONS = [
  "Tapped by mistake",
  "Wrong behavior",
  "Wrong patient",
  "Logged twice",
  "Other",
] as const;
/** The reason recorded when the snackbar's Undo takes back a log just made. */
export const UNDO_REASON = "Undone right after logging";

/**
 * Why a log was changed (G11, `changeReasons`, lab build). A pick list and nothing else: no free
 * text, so the research export can carry it. Edits and deletes both use it; a restore and
 * "It stopped" are not corrections and carry none.
 */
export const CHANGE_REASONS = [
  "wrong_time",
  "wrong_item",
  "duplicate",
  "wrong_participant",
  "entered_by_mistake",
  "other",
] as const;
export type ChangeReason = (typeof CHANGE_REASONS)[number];
/** What a caregiver reads. The delete list has always used these words, so old deletes map to a code. */
export const REASON_LABEL: Record<ChangeReason, string> = {
  wrong_time: "Wrong time",
  wrong_item: "Wrong behavior",
  duplicate: "Logged twice",
  wrong_participant: "Wrong patient",
  entered_by_mistake: "Tapped by mistake",
  other: "Other",
};
const isCode = (v: unknown): v is ChangeReason => (CHANGE_REASONS as readonly string[]).includes(v as string);
const codeFor = (v: string): ChangeReason | undefined =>
  isCode(v) ? v : v === UNDO_REASON ? "entered_by_mistake" : CHANGE_REASONS.find((c) => REASON_LABEL[c] === v);
/** Shown when `changeReasons` is on and a change arrives without a reason. */
export const NEEDS_REASON = "Pick a reason for this change.";
/** A change with no valid reason, refused. */
export class LogReasonError extends Error {}

type Saved = StoredObservation & { id: number };
const EDITABLE = ["at", "approx", "before", "beforeNote", "endedAt"] as const;
/** Shown when a change would put the end of a stretch before its start (F-39). */
export const ENDS_BEFORE_START = "It can't stop before it started. Check both times.";
const EDIT_MERGE_MS = 5 * 60_000;

/** A change the caregiver can fix, with a message to show as it is (not a storage failure). */
export class LogTimeError extends Error {}

/** Throws when the reason is missing, or is "Other" without a note (not asked for when `changeReasons` is on: no free text). */
export async function deleteLog(obs: Saved, reason: string, note?: string, now = Date.now()) {
  const code = codeFor(reason);
  if (study.changeReasons) {
    if (!code) throw new LogReasonError(NEEDS_REASON);
  } else {
    if (reason !== UNDO_REASON && !(DELETE_REASONS as readonly string[]).includes(reason))
      throw new Error("Pick a reason to delete this log.");
    if (reason === "Other" && !note?.trim()) throw new Error("Say in a few words why this log is being deleted.");
  }
  const trimmed = study.changeReasons ? undefined : note?.trim() || undefined;
  const label = study.changeReasons && code ? REASON_LABEL[code] : reason;
  const mark = { deletedAt: now, deleteReason: label, ...(trimmed ? { deleteNote: trimmed } : {}) };
  await db.transaction("rw", [db.observations, db.changes], async () => {
    const current = await db.observations.get(obs.id);
    if (!current || current.deletedAt !== undefined) return; // already gone: nothing to record
    await db.observations.update(obs.id, { ...mark, rev: await nextRev(obs.id, current) });
    await record({
      observationId: obs.id,
      patientId: obs.patientId,
      action: "delete",
      at: now,
      to: mark,
      ...(code ? { reason: code } : {}),
    });
  });
}

/** The revision a log gets with its next change. Logs made before `rev` existed count their history entries. */
async function nextRev(id: number, current: StoredObservation) {
  return (current.rev ?? 1 + (await db.changes.where("observationId").equals(id).count())) + 1;
}

/** Undo of a delete: the log counts again, and the history keeps both steps. */
export async function restoreLog(obs: Saved, now = Date.now()) {
  await db.transaction("rw", [db.observations, db.changes], async () => {
    const current = await db.observations.get(obs.id);
    if (!current || current.deletedAt === undefined) return;
    const from = { deletedAt: current.deletedAt, deleteReason: current.deleteReason, deleteNote: current.deleteNote };
    // Dexie's update removes a key set to undefined.
    await db.observations.update(obs.id, {
      deletedAt: undefined,
      deleteReason: undefined,
      deleteNote: undefined,
      rev: await nextRev(obs.id, current),
    });
    await record({ observationId: obs.id, patientId: obs.patientId, action: "restore", at: now, from });
  });
}

/** Saves a change to a log's time or context and records what it was before. A deleted log can't be edited. */
export async function editLog(obs: Saved, change: Partial<StoredObservation>, now = Date.now(), reason?: string) {
  return changeLog(obs, change, now, reason, false);
}

async function changeLog(
  obs: Saved,
  change: Partial<StoredObservation>,
  now: number,
  reason: string | undefined,
  correction: boolean,
) {
  // G11: a correction needs a reason from the list. "It stopped" is the first end time, not a correction.
  const code = reason === undefined ? undefined : codeFor(reason);
  if (study.changeReasons && !correction && !code) throw new LogReasonError(NEEDS_REASON);
  await db.transaction("rw", [db.observations, db.changes, db.patients], async () => {
    const current = await db.observations.get(obs.id);
    if (!current || current.deletedAt !== undefined) return;
    // Periods count from the patient's first day, so a log can't be moved before it (F-32).
    const patient =
      change.at !== undefined && change.at !== current.at ? await db.patients.get(current.patientId) : undefined;
    if (patient && change.at! < patient.anchor) {
      const day = new Date(patient.anchor).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      throw new LogTimeError(`This patient's first day in the app is ${day}. A log can't be earlier than that.`);
    }
    // F-39: only the behaviors that come in stretches have an end, and it is never before the start.
    const next = { ...current, ...change };
    if (next.endedAt !== undefined) {
      if (!ITEMS[current.itemId - 1].continuous)
        throw new LogTimeError("Only pacing, mannerisms and restlessness have an end time.");
      if (next.endedAt < next.at) throw new LogTimeError(ENDS_BEFORE_START);
    }
    const from: Partial<StoredObservation> = {};
    const to: Partial<StoredObservation> = {};
    for (const k of EDITABLE) {
      if (k in change && change[k] !== current[k]) {
        (from as Record<string, unknown>)[k] = current[k];
        (to as Record<string, unknown>)[k] = change[k];
      }
    }
    if (!Object.keys(to).length) return;
    await db.observations.update(obs.id, { ...to, rev: await nextRev(obs.id, current) });
    // Typing a note saves on every key, so edits a few minutes apart count as one change:
    // the first "from" and the latest "to" (EDIT_MERGE_MS). With `changeReasons` on, history is
    // append-only: edits are saved together by Save change, and no entry is ever rewritten.
    const last = (await db.changes.where("observationId").equals(obs.id).sortBy("id")).pop();
    // A behavior correction (it carries a reason) is always its own entry, so nothing merges into it.
    if (
      !study.changeReasons &&
      last?.id !== undefined &&
      last.action === "edit" &&
      !last.reason &&
      now - last.at < EDIT_MERGE_MS
    ) {
      // A field the earlier entry already touched keeps its first value, even if that was "unset".
      const touched = new Set([...Object.keys(last.from ?? {}), ...Object.keys(last.to ?? {})]);
      const firstFrom = { ...Object.fromEntries(Object.entries(from).filter(([k]) => !touched.has(k))), ...last.from };
      await db.changes.update(last.id, { at: now, from: clean(firstFrom), to: clean({ ...last.to, ...to }) });
      return;
    }
    await record({
      observationId: obs.id,
      patientId: obs.patientId,
      action: "edit",
      at: now,
      from,
      to,
      ...(code && !correction ? { reason: code } : {}),
    });
  });
}

/** A correction that names a number that is not one of the 29 behaviors, refused. */
export class LogItemError extends Error {}

/**
 * Corrects which behavior a log is for (F-64, design note 025). The same log, never a new one: its
 * unique ID, time and maker stay, the revision goes up by one, and the history keeps the old
 * behavior with the reason `wrong_item`, so it is counted once and nothing is lost. A deleted log
 * can't be corrected. An end time is dropped when the new behavior does not come in stretches (F-39).
 */
export async function correctItem(obs: Saved, itemId: number, now = Date.now()) {
  const item = Number.isInteger(itemId) ? ITEMS[itemId - 1] : undefined;
  if (!item) throw new LogItemError("Pick one of the 29 behaviors.");
  await db.transaction("rw", [db.observations, db.changes], async () => {
    const current = await db.observations.get(obs.id);
    if (!current || current.deletedAt !== undefined || current.itemId === itemId) return;
    const dropEnd = current.endedAt !== undefined && !item.continuous;
    await db.observations.update(obs.id, {
      itemId,
      ...(dropEnd ? { endedAt: undefined } : {}),
      rev: await nextRev(obs.id, current),
    });
    await record({
      observationId: obs.id,
      patientId: obs.patientId,
      action: "edit",
      at: now,
      reason: "wrong_item",
      from: { itemId: current.itemId, ...(dropEnd ? { endedAt: current.endedAt } : {}) },
      to: { itemId },
    });
  });
}

// Drops keys whose value is undefined, so the stored history only names what was there.
const clean = (o?: Partial<StoredObservation>) =>
  o && Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function record({ from, to, ...c }: LogChange) {
  return db.changes.add({
    ...c,
    ...madeHere(),
    ...(from ? { from: clean(from) } : {}),
    ...(to ? { to: clean(to) } : {}),
  });
}

/** "It stopped" (F-39, plan 5.7): the end of a stretch of pacing, mannerisms or restlessness, now. Never read by scoring. */
export const stopLog = (obs: Saved, now = Date.now()) => changeLog(obs, { endedAt: now }, now, undefined, true);

/** One version of a log, rebuilt from the history: who changed it, when, why, and what it said after. */
export interface LogVersion {
  rev: number;
  at: number;
  by?: string;
  action: "created" | "edit" | "delete" | "restore";
  reason?: string;
  values: { itemId: number; at: number; approx: boolean; before?: string; endedAt?: number; deleted: boolean };
}

/** Every version of a log, oldest first. Version 1 is the log as made. Reads only. */
export async function logVersions(observationId: number): Promise<LogVersion[]> {
  const cur = await db.observations.get(observationId);
  if (!cur) return [];
  const changes = await db.changes.where("observationId").equals(observationId).sortBy("id");
  const snap = (o: StoredObservation) => ({
    itemId: o.itemId,
    at: o.at,
    approx: !!o.approx,
    before: o.before,
    endedAt: o.endedAt,
    deleted: o.deletedAt !== undefined,
  });
  let state: LogVersion["values"] = snap(cur);
  const out: LogVersion[] = [];
  for (let i = changes.length - 1; i >= 0; i--) {
    const c = changes[i];
    out.push({ rev: i + 2, at: c.at, by: c.by, action: c.action, reason: c.reason, values: state });
    // Step back over this change. A field that was unset is missing from `from`, and one that was
    // cleared is missing from `to`, so go by both.
    const prev = { ...state };
    for (const k of new Set([...Object.keys(c.from ?? {}), ...Object.keys(c.to ?? {})])) {
      if (k === "itemId") prev.itemId = c.from?.itemId ?? prev.itemId;
      if (k === "at") prev.at = (c.from?.at ?? prev.at) as number;
      if (k === "approx") prev.approx = !!c.from?.approx;
      if (k === "before") prev.before = c.from?.before;
      if (k === "endedAt") prev.endedAt = c.from?.endedAt;
    }
    if (c.action === "delete") prev.deleted = false;
    if (c.action === "restore") prev.deleted = true;
    state = prev;
  }
  out.push({ rev: 1, at: cur.loggedAt, by: cur.by, action: "created", values: state });
  return out.reverse();
}
