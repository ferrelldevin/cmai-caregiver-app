// Watching hours (F-38, D-25, plan 5.6), on assumed approval behind `watchingHours`. A watch is
// a stretch when a caregiver was with a resident. It starts with "I'm here", or with a log when
// none is open, and ends with "I've left", a switch of resident or caregiver, sign-out, or after
// 4 hours with no tap in the app (it then ends at the last tap). One open watch per caregiver
// per phone. A watch with no logs in it means "watched and calm". This is data about caregivers
// as well as residents; the IRB question is in the review packet.

import { db, madeHere, thisDevice, type Watch } from "./db";
import { newId, utcOffsetMin } from "./ids";

export const TIMEOUT_MS = 4 * 60 * 60 * 1000;
const LAST_TAP = "cmai-last-tap";

type EndSource = NonNullable<Watch["endSource"]>;

/** The open watch of whoever is logging on this phone now, if any. */
export async function openWatch(): Promise<(Watch & { uid: string }) | undefined> {
  // The phone's ID is read when the database opens; on app start that may not have happened yet.
  if (!db.isOpen()) await db.open();
  const { by } = madeHere();
  const device = thisDevice();
  return db.watches.filter((w) => w.end === undefined && w.by === by && w.deviceId === device).first();
}

/** Starts a watch with this resident; any other open watch of this caregiver ends as a switch. */
export async function startWatch(patientId: string, source: Watch["startSource"], now = Date.now()) {
  const open = await openWatch();
  if (open?.patientId === patientId) return open;
  if (open) await endWatch("switch", now);
  const w: Watch = {
    uid: newId(),
    patientId,
    start: now,
    startSource: source,
    tzOffsetMin: utcOffsetMin(now),
    ...madeHere(),
  };
  await db.watches.add(w);
  touch(now);
  return w;
}

/** Ends the open watch, if any. */
export async function endWatch(source: EndSource, now = Date.now(), at = now) {
  const open = await openWatch();
  if (!open) return;
  await db.watches.update(open.uid, { end: Math.max(open.start, at), endSource: source });
}

/** Records a tap in the app: the clock for the 4-hour timeout. */
export function touch(now = Date.now()) {
  try {
    localStorage.setItem(LAST_TAP, String(now));
  } catch {
    /* private mode: the timeout counts from the start of the watch */
  }
}

function lastTap(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_TAP));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * On opening the app: a watch with no tap for 4 hours ends at the last tap, as a timeout. Returns
 * it, so the app can ask "Still with P-03?"; `resumeWatch` undoes the end if the answer is yes.
 */
export async function closeIfTimedOut(now = Date.now()): Promise<Watch | null> {
  const open = await openWatch();
  if (!open) return null;
  const last = Math.max(lastTap() ?? open.start, open.start);
  if (now - last < TIMEOUT_MS) return null;
  await db.watches.update(open.uid, { end: last, endSource: "timeout" });
  return { ...open, end: last, endSource: "timeout" };
}

/** "Yes, still here": the watch carries on as if it never timed out. */
export async function resumeWatch(uid: string, now = Date.now()) {
  await db.watches.update(uid, { end: undefined, endSource: undefined });
  touch(now);
}

/** Today's watches for one resident (any caregiver, any phone), for the band on Today. */
export const watchesFor = (patientId: string, from: number) =>
  db.watches
    .where("patientId")
    .equals(patientId)
    .filter((w) => (w.end ?? Infinity) > from)
    .toArray();
