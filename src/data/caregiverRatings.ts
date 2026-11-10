// The caregiver's own CMAI for a finished 14-day period (F-47, plan 5.4, design note 012), on
// assumed approval behind the `blindCmai` switch. It is the measurement the app's rating is
// tested against, so it is blind: the form shows nothing taken from the logs, and no scoring
// function reads it. A submitted rating is locked, like the app's.

import { addDays, RULE_VERSION, WINDOW_DAYS } from "../scoring/engine";
import { ITEMS } from "../scoring/items";
import { db, isLive, madeHere, type CaregiverRating, type Patient } from "./db";
import { newId } from "./ids";

export const LATE_DAYS = 7; // a rating can be finished up to 7 days after its period ends
export const ANSWERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const periodStart = (anchor: number, period: number) => addDays(anchor, (period - 1) * WINDOW_DAYS);
export const periodEnd = (anchor: number, period: number) => periodStart(anchor, period + 1);
export const deadline = (anchor: number, period: number) => addDays(periodEnd(anchor, period), LATE_DAYS);

export type RatingStatus = "due" | "started" | "submitted" | "missed" | "none";

const find = (patientId: string, windowStart: number, by: string) =>
  db.caregiverRatings.where("[patientId+windowStart+by]").equals([patientId, windowStart, by]).first();

/**
 * Where a caregiver stands on one period's rating. "none": the period has not ended, or they
 * logged nothing for this resident in it, so nobody asks them.
 */
export async function ratingStatus(patient: Patient, period: number, by: string, now: number): Promise<RatingStatus> {
  const start = periodStart(patient.anchor, period);
  const end = periodEnd(patient.anchor, period);
  if (period < 1 || now < end) return "none";
  const row = await find(patient.id, start, by);
  if (row?.submittedAt !== undefined) return "submitted";
  const logged = await db.observations
    .where("patientId")
    .equals(patient.id)
    .filter((o) => isLive(o) && o.by === by && o.at >= start && o.at < end)
    .count();
  if (!logged) return "none";
  if (now >= deadline(patient.anchor, period)) return "missed";
  return row ? "started" : "due";
}

/** Periods whose rating this caregiver still has to give for this resident, oldest first. */
export async function ratingsDue(patient: Patient, by: string, now: number): Promise<number[]> {
  const due: number[] = [];
  for (let n = 1; periodEnd(patient.anchor, n) <= now; n++) {
    if (deadline(patient.anchor, n) <= now) continue;
    const s = await ratingStatus(patient, n, by, now);
    if (s === "due" || s === "started") due.push(n);
  }
  return due;
}

export const ratingFor = (patient: Patient, period: number, by: string) =>
  find(patient.id, periodStart(patient.anchor, period), by);

function check(patient: Patient, period: number, by: string, now: number) {
  if (now < periodEnd(patient.anchor, period)) throw new Error("This period has not ended yet.");
  if (now >= deadline(patient.anchor, period))
    throw new Error("This rating was due within 7 days of the period's end.");
  if (!by) throw new Error("Choose who is logging first.");
}

/** Saves one answer to the caregiver's unfinished rating, creating it on the first answer. */
export async function saveAnswer(
  patient: Patient,
  period: number,
  by: string,
  itemId: number,
  answer: number,
  now = Date.now(),
) {
  check(patient, period, by, now);
  if (!ITEMS.some((i) => i.id === itemId)) throw new Error(`No behavior ${itemId}.`);
  if (!(ANSWERS as readonly number[]).includes(answer)) throw new Error("Answers are 1 to 7, 8 or 9.");
  const windowStart = periodStart(patient.anchor, period);
  return db.transaction("rw", db.caregiverRatings, async () => {
    const row = await find(patient.id, windowStart, by);
    if (row?.submittedAt !== undefined) throw new Error("This rating is submitted and locked.");
    if (row) {
      await db.caregiverRatings.update(row.uid, { [`answers.${itemId}`]: answer });
      return;
    }
    const made = madeHere();
    await db.caregiverRatings.add({
      uid: newId(),
      patientId: patient.id,
      windowStart,
      answers: { [itemId]: answer },
      startedAt: now,
      ruleVersion: RULE_VERSION,
      ...made,
      by, // the caregiver giving the rating, whatever the phone's default
    });
  });
}

/** Locks the rating. All 29 answers are needed; a second submit is refused. */
export async function submitRating(
  patient: Patient,
  period: number,
  by: string,
  now = Date.now(),
): Promise<CaregiverRating> {
  check(patient, period, by, now);
  const windowStart = periodStart(patient.anchor, period);
  return db.transaction("rw", db.caregiverRatings, async () => {
    const row = await find(patient.id, windowStart, by);
    if (!row) throw new Error("No answers yet.");
    if (row.submittedAt !== undefined) throw new Error("This rating is already submitted.");
    const left = ITEMS.filter((i) => row.answers[i.id] === undefined).length;
    if (left) throw new Error(`${left} ${left === 1 ? "behavior has" : "behaviors have"} no answer yet.`);
    await db.caregiverRatings.update(row.uid, { submittedAt: now, ruleVersion: RULE_VERSION });
    return { ...row, submittedAt: now, ruleVersion: RULE_VERSION };
  });
}

/** "Within 1 point" (manual p.7), for the lab view's comparison. Codes 8 and 9 are never within. */
export const withinOne = (caregiver: number, app: number) => caregiver <= 7 && Math.abs(caregiver - app) <= 1;
