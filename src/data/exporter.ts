// Export for the research team: JSON (everything) and two CSVs.
// observations.csv: one row per logged behavior, deleted ones too, with when and why.
// scores.csv: one row per patient, window, and behavior: the app's rating from live logs only.
// JSON also holds the "nothing to log today" check-ins, the change history, and any day-14
// reviews from before scores were locked (D-14); scores.csv has unlogged_days per window.
// The JSON backup is format 2 from database version 4: it adds the phone's ID and the version 4
// tables. PIN fields never leave the phone (SECRET_CAREGIVER_FIELDS). The CSVs change in plan 5.10.
// Every JSON backup names the app version and build commit that made it, next to the rule version.

import { RULE_VERSION, scoreAllWindows, unloggedDays } from "../scoring/engine";
import { ITEMS } from "../scoring/items";
import { db, isLive, SECRET_CAREGIVER_FIELDS, thisDevice, type Caregiver } from "./db";

export const BACKUP_FORMAT = 2;

/** A caregiver as a backup carries them: code, initials and dates only. */
const shareable = (c: Caregiver) =>
  Object.fromEntries(Object.entries(c).filter(([k]) => !(SECRET_CAREGIVER_FIELDS as readonly string[]).includes(k)));

// A cell that starts with = + - @ (or a tab or return) is run as a formula by spreadsheet apps.
// A leading apostrophe makes it plain text (OWASP, CSV Injection).
const cell = (v: string | number | boolean) => {
  if (typeof v !== "string") return String(v);
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const csv = (rows: (string | number | boolean)[][]) => rows.map((r) => r.map(cell).join(",")).join("\n");

export async function buildExport(now = Date.now()) {
  const patients = await db.patients.toArray();
  const observations = await db.observations.toArray();
  const reviews = await db.reviews.toArray();
  const checkins = await db.checkins.toArray();
  const changes = await db.changes.toArray();
  const caregivers = (await db.caregivers.toArray()).map(shareable);
  const assignments = await db.assignments.toArray();
  const watches = await db.watches.toArray();
  const caregiverRatings = await db.caregiverRatings.toArray();

  const obsRows: (string | number | boolean)[][] = [
    [
      "patient_id",
      "item_id",
      "item_name",
      "occurred_at",
      "time_approximate",
      "what_happened_before",
      "before_note",
      "logged_at",
      "deleted_at",
      "delete_reason",
      "delete_note",
    ],
  ];
  for (const o of observations) {
    obsRows.push([
      o.patientId,
      o.itemId,
      ITEMS[o.itemId - 1].name,
      new Date(o.at).toISOString(),
      !!o.approx,
      o.before ?? "",
      o.beforeNote ?? "",
      new Date(o.loggedAt).toISOString(),
      o.deletedAt === undefined ? "" : new Date(o.deletedAt).toISOString(),
      o.deleteReason ?? "",
      o.deleteNote ?? "",
    ]);
  }

  const scoreRows: (string | number | boolean)[][] = [
    [
      "patient_id",
      "window_start",
      "window_end",
      "provisional",
      "item_id",
      "item_name",
      "count",
      "derived_rating",
      "unlogged_days",
      "rule_version",
    ],
  ];
  for (const p of patients) {
    const mine = observations.filter((o) => o.patientId === p.id && isLive(o));
    const activity = [...mine.map((o) => o.at), ...checkins.filter((c) => c.patientId === p.id).map((c) => c.at)];
    for (const w of scoreAllWindows(mine, p.anchor, now)) {
      const { unlogged } = unloggedDays(activity, w.windowStart, now);
      for (const s of w.items) {
        scoreRows.push([
          p.id,
          new Date(w.windowStart).toISOString(),
          new Date(w.windowEnd).toISOString(),
          w.provisional,
          s.itemId,
          ITEMS[s.itemId - 1].name,
          s.count,
          s.rating,
          unlogged,
          RULE_VERSION,
        ]);
      }
    }
  }
  return {
    json: JSON.stringify(
      {
        formatVersion: BACKUP_FORMAT,
        appVersion: __APP_VERSION__,
        build: __BUILD_COMMIT__,
        exportedAt: new Date(now).toISOString(),
        ruleVersion: RULE_VERSION,
        deviceId: thisDevice(),
        patients,
        observations,
        reviews,
        checkins,
        changes,
        caregivers,
        assignments,
        watches,
        caregiverRatings,
      },
      null,
      2,
    ),
    observationsCsv: csv(obsRows),
    scoresCsv: csv(scoreRows),
  };
}

export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
