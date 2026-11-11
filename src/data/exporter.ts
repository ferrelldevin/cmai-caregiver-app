// Export for the research team: JSON (everything) and two CSVs.
// observations.csv: one row per logged behavior, deleted ones too, with when and why.
// scores.csv: one row per patient, window, and behavior: the app's rating from live logs only.
// JSON also holds the "nothing to log today" check-ins, the change history, and any day-14
// reviews from before scores were locked (D-14); scores.csv has unlogged_days per window.
// The JSON backup is format 2 from database version 4: it adds the phone's ID and the version 4
// tables. PIN fields never leave the phone (SECRET_CAREGIVER_FIELDS).
// CSV format 2 (D-23, plan 5.10, behind `exportV2`): format 1's columns keep their names and
// order, new ones come after; every time is given in UTC and in local time with its offset; new
// files watches.csv, caregiver_ratings.csv and labels.csv. Reference: docs/data-dictionary.md
// part 2 (draft PR #46, plan 3.4).
// Every JSON backup names the app version and build commit that made it, next to the rule version.

import {
  addDays,
  appRatings,
  localMidnight,
  RULE_VERSION,
  scoreAllWindows,
  scoreWindow,
  unloggedDays,
} from "../scoring/engine";
import { ITEMS } from "../scoring/items";
import { study } from "../study/settings";
import { db, isLive, SECRET_CAREGIVER_FIELDS, thisDevice, type Caregiver, type Watch } from "./db";
import { withinOne } from "./caregiverRatings";

export const BACKUP_FORMAT = 2;

/** A caregiver as a backup carries them: code, initials and dates only. */
const shareable = (c: Caregiver) =>
  Object.fromEntries(Object.entries(c).filter(([k]) => !(SECRET_CAREGIVER_FIELDS as readonly string[]).includes(k)));

// A cell that starts with = + - @ (or a tab or return) is run as a formula by spreadsheet apps.
// A leading apostrophe makes it plain text (OWASP, CSV Injection). Plan step 1.6, F-34.
type Cell = string | number | boolean;
export const cell = (v: Cell) => {
  if (typeof v !== "string") return String(v);
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const csv = (rows: Cell[][]) => rows.map((r) => r.map(cell).join(",")).join("\n");

export const CSV_FORMAT = 2;
const iso = (t: number | undefined) => (t === undefined ? "" : new Date(t).toISOString());
const pad = (n: number) => String(n).padStart(2, "0");

/** Local time with its offset, as the phone's clock read it: 2026-10-05T17:00:00.000-04:00. Empty without an offset. */
export function localIso(t: number, offsetMin: number | undefined): string {
  if (offsetMin === undefined) return "";
  const shifted = new Date(t + offsetMin * 60_000).toISOString().slice(0, 23);
  const a = Math.abs(offsetMin);
  return `${shifted}${offsetMin < 0 ? "-" : "+"}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

const DAY_FINAL_MS = 24 * 60 * 60 * 1000; // D-21: a period's ratings are final 24 hours after it ends

/** Minutes of watching that fall inside [from, to). An open watch counts up to `now`. */
function watchedMinutes(watches: Watch[], from: number, to: number, now: number) {
  let ms = 0;
  for (const w of watches) ms += Math.max(0, Math.min(w.end ?? now, to) - Math.max(w.start, from));
  return Math.round(ms / 60_000);
}

export interface LabelRow {
  patientId: string;
  kind: "behavior" | "watched" | "unobserved";
  start: number;
  end?: number;
  itemId?: number;
  approx?: boolean;
  by?: string;
  tzOffsetMin?: number;
}

/**
 * The file for the sensor work: for one resident, from day 1 to `now`, each local day is covered
 * exactly by "watched" (someone was there) and "unobserved" stretches, which never overlap; each
 * live log is a "behavior" row inside them. "Calm" can be taken from watched rows only.
 */
export function labelRows(
  patientId: string,
  anchor: number,
  logs: { at: number; itemId: number; approx?: boolean; by?: string; tzOffsetMin?: number; endedAt?: number }[],
  watches: Watch[],
  now: number,
): LabelRow[] {
  // Merge overlapping watches so two caregivers watching at once count once.
  const spans = watches
    .map((w) => [w.start, Math.min(w.end ?? now, now)] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const sp of spans) {
    const last = merged[merged.length - 1];
    if (last && sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]);
    else merged.push([...sp]);
  }
  const rows: LabelRow[] = [];
  for (let day = localMidnight(anchor); day < now; day = addDays(day, 1)) {
    const end = Math.min(addDays(day, 1), now);
    let t = day;
    for (const [a, b] of merged) {
      const s = Math.max(a, day),
        e = Math.min(b, end);
      if (e <= s) continue;
      if (s > t) rows.push({ patientId, kind: "unobserved", start: t, end: s });
      rows.push({ patientId, kind: "watched", start: s, end: e });
      t = e;
    }
    if (t < end) rows.push({ patientId, kind: "unobserved", start: t, end });
  }
  for (const o of logs) {
    if (o.at < anchor || o.at >= now) continue;
    rows.push({
      patientId,
      kind: "behavior",
      start: o.at,
      end: o.endedAt,
      itemId: o.itemId,
      approx: !!o.approx,
      by: o.by,
      tzOffsetMin: o.tzOffsetMin,
    });
  }
  // Time order; at the same moment the stretch comes before the behavior inside it.
  return rows.sort((x, y) => x.start - y.start || (x.kind === "behavior" ? 1 : 0) - (y.kind === "behavior" ? 1 : 0));
}

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

  const v2 = study.exportV2;
  const app = __APP_VERSION__;
  const exportedAt = iso(now);

  const obsRows: Cell[][] = [
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
      ...(v2
        ? [
            "uid",
            "device_id",
            "caregiver",
            "occurred_at_local",
            "utc_offset_min",
            "ended_at",
            "schema_version",
            "app_version",
          ]
        : []),
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
      ...(v2
        ? [
            o.uid ?? "",
            o.deviceId ?? "",
            o.by ?? "",
            localIso(o.at, o.tzOffsetMin),
            o.tzOffsetMin ?? "",
            iso(o.endedAt),
            CSV_FORMAT,
            app,
          ]
        : []),
    ]);
  }

  const scoreRows: Cell[][] = [
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
      ...(v2 ? ["schema_version", "app_version", "exported_at", "period_final", "watched_minutes"] : []),
    ],
  ];
  for (const p of patients) {
    const mine = observations.filter((o) => o.patientId === p.id && isLive(o));
    const activity = [...mine.map((o) => o.at), ...checkins.filter((c) => c.patientId === p.id).map((c) => c.at)];
    for (const w of scoreAllWindows(mine, p.anchor, now)) {
      const { unlogged } = unloggedDays(activity, w.windowStart, now);
      const extra = v2
        ? [
            CSV_FORMAT,
            app,
            exportedAt,
            now - w.windowEnd > DAY_FINAL_MS,
            study.watchingHours
              ? watchedMinutes(
                  watches.filter((x) => x.patientId === p.id),
                  w.windowStart,
                  w.windowEnd,
                  now,
                )
              : "",
          ]
        : [];
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
          ...extra,
        ]);
      }
    }
  }

  // Format 2 only: watches, caregivers' own ratings beside the app's, and the label file.
  let watchesCsv = "",
    caregiverRatingsCsv = "",
    labelsCsv = "";
  if (v2) {
    const wRows: Cell[][] = [
      ["uid", "patient_id", "caregiver", "start", "end", "start_source", "end_source", "utc_offset_min", "start_local"],
    ];
    for (const w of watches)
      wRows.push([
        w.uid,
        w.patientId,
        w.by ?? "",
        iso(w.start),
        iso(w.end),
        w.startSource,
        w.endSource ?? "",
        w.tzOffsetMin ?? "",
        localIso(w.start, w.tzOffsetMin),
      ]);
    watchesCsv = csv(wRows);

    const rRows: Cell[][] = [
      [
        "uid",
        "patient_id",
        "caregiver",
        "window_start",
        "submitted_at",
        "item_id",
        "item_name",
        "caregiver_choice",
        "app_rating",
        "within_one_point",
        "rule_version",
        "schema_version",
        "app_version",
      ],
    ];
    for (const r of caregiverRatings) {
      if (r.submittedAt === undefined) continue; // unfinished ratings stay in the backup only
      const live = observations.filter((o) => o.patientId === r.patientId && isLive(o));
      const appR = appRatings(scoreWindow(live, r.windowStart, now));
      for (const item of ITEMS) {
        const choice = r.answers[item.id];
        rRows.push([
          r.uid,
          r.patientId,
          r.by ?? "",
          iso(r.windowStart),
          iso(r.submittedAt),
          item.id,
          item.name,
          choice ?? "",
          appR[item.id],
          choice === undefined ? "" : withinOne(choice, appR[item.id]),
          r.ruleVersion,
          CSV_FORMAT,
          app,
        ]);
      }
    }
    caregiverRatingsCsv = csv(rRows);

    const lRows: Cell[][] = [
      [
        "patient_id",
        "kind",
        "item_id",
        "item_name",
        "start",
        "end",
        "time_approximate",
        "caregiver",
        "start_local",
        "utc_offset_min",
        "schema_version",
        "app_version",
      ],
    ];
    for (const p of patients) {
      const live = observations.filter((o) => o.patientId === p.id && isLive(o));
      for (const l of labelRows(
        p.id,
        p.anchor,
        live,
        watches.filter((w) => w.patientId === p.id),
        now,
      )) {
        lRows.push([
          l.patientId,
          l.kind,
          l.itemId ?? "",
          l.itemId ? ITEMS[l.itemId - 1].name : "",
          iso(l.start),
          iso(l.end),
          l.kind === "behavior" ? !!l.approx : "",
          l.by ?? "",
          localIso(l.start, l.tzOffsetMin),
          l.tzOffsetMin ?? "",
          CSV_FORMAT,
          app,
        ]);
      }
    }
    labelsCsv = csv(lRows);
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
    watchesCsv,
    caregiverRatingsCsv,
    labelsCsv,
  };
}

export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
