// "Export for research" (F-56, design note 018): one participant, one date range, one JSON file in
// the shape of contract v1.0.0 (docs/contracts/cmai-export/). Read-only: nothing here writes to
// storage, so no database version and no change to ratings. Item numbers only, never wording.
//
// Four known mismatches between the contract and the app's data are handled by assumed picks
// (design note 017): the zone name is the phone's current zone and the export stops if a log's
// stored offset disagrees with it; old logs get a placeholder install ID; frequency, review flag
// and role are not stored so they are null, false and "caregiver"; "approximate time" and watched
// stretches have no field in v1.0.0. The summary counts how many records used each pick.

import { study } from "../study/settings";
import { db, thisDevice, type StoredObservation } from "./db";
import { newId } from "./ids";

export const EXPORT_SCHEMA_VERSION = "1.0.0";
/** Install ID written for logs made before database version 4. Never the current phone's ID. */
export const PLACEHOLDER_DEVICE_ID = "00000000-0000-0000-0000-000000000000";
/** An edit this soon after the last one is merged into it in the change history (logs.ts). */
const EDIT_MERGE_MS = 5 * 60_000;
const PARTICIPANT_ID = /^[A-Z]{1,5}(-[A-Z0-9]{1,12})+$/;

export type LoggerRole = "caregiver" | "staff" | "researcher";

/** Facts about a record that the app does not store today. Only a test or seeder passes this. */
export interface RecordExtras {
  role?: LoggerRole;
  frequency?: number | null;
  reviewed?: boolean;
}

export interface ResearchExportInput {
  patientId: string;
  /** First and last local day, inclusive, as YYYY-MM-DD. */
  startDay: string;
  endDay: string;
  /** IANA zone. Defaults to the phone's current zone (assumed pick 1). */
  tz?: string;
  now?: number;
  exportId?: string;
  /** A test passes true to prove the switch works. Otherwise the `realExports` setting decides. */
  allowReal?: boolean;
  /** The install ID for the header. Defaults to this phone's; a test passes a fixed one. */
  deviceId?: string;
  appVersion?: string;
  /** Per-record facts the app cannot store yet; absent means the assumed defaults. */
  extras?: (o: StoredObservation) => RecordExtras;
}

export interface ResearchSummary {
  total: number;
  active: number;
  deleted: number;
  tz: string;
  /** Pick 2: records written with the placeholder install ID. */
  placeholderDevice: number;
  /** Pick 3: records whose role was defaulted to "caregiver". */
  defaultedRole: number;
  /** Pick 3: records with no frequency (rating_scale "none"). */
  noFrequency: number;
  /** Pick 1: records with no stored offset, whose offset was taken from the zone. */
  offsetFromZone: number;
  /** Pick 4: records the caregiver marked approximate; exported as normal, flag not in v1.0.0. */
  approxTime: number;
  /** Edited in the last 5 minutes: another edit may merge into the same revision. */
  recentlyEdited: number;
}

export interface ResearchExport {
  fileName: string;
  text: string;
  summary: ResearchSummary;
}

/** A refusal with a message fit to show as it is. Nothing is exported. */
export class ExportBlocked extends Error {}

const utcText = (ms: number) => new Date(ms).toISOString().slice(0, 19) + "Z";

/** Minutes from UTC in `tz` at the instant `ms`. Works for any zone, whatever the phone's own zone is. */
export function zoneOffsetMin(tz: string, ms: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, Number(p.value)]),
  );
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60_000);
}

/** The instant a local clock reading happens in `tz` (the first one when clocks fall back). */
export function zonedToUtc(tz: string, y: number, mo: number, d: number, h = 0, mi = 0): number {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const before = zoneOffsetMin(tz, wall - 86_400_000);
  const after = zoneOffsetMin(tz, wall + 86_400_000);
  // An offset is right for this reading when the zone still has it at the instant it places.
  const places = [before, after]
    .filter((o) => zoneOffsetMin(tz, wall - o * 60_000) === o)
    .map((o) => wall - o * 60_000);
  return places.length ? Math.min(...places) : wall - before * 60_000; // a skipped reading: use the earlier offset
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
function dayStart(tz: string, day: string, plus = 0) {
  const m = DAY.exec(day);
  if (!m) throw new ExportBlocked("Pick the first and last day of the range.");
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + plus));
  return zonedToUtc(tz, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export const currentZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Builds the file text and its summary, or throws ExportBlocked with a plain message. */
export async function buildResearchExport(input: ResearchExportInput): Promise<ResearchExport> {
  const { patientId, startDay, endDay } = input;
  const tz = input.tz ?? currentZone();
  const now = input.now ?? Date.now();
  if (startDay > endDay) throw new ExportBlocked("The last day is before the first day.");
  if (!PARTICIPANT_ID.test(patientId))
    throw new ExportBlocked("This resident's code is not a study ID like P-01, so it cannot be exported.");
  const patient = await db.patients.get(patientId);
  if (!patient) throw new ExportBlocked("Pick a resident to export.");
  // G1: made-up data only until Dr. Gupta says in writing where real exports may live.
  if (!patient.demo && !(input.allowReal ?? study.realExports))
    throw new ExportBlocked(
      "Only made-up (demo) residents can be exported for now. Exports of real residents stay off until Dr. Gupta says in writing where they may be kept.",
    );
  const deviceId = input.deviceId ?? thisDevice();
  if (!deviceId) throw new ExportBlocked("The app is still starting. Try again in a moment.");
  const start = dayStart(tz, startDay);
  const end = dayStart(tz, endDay, 1);

  const logs = await db.observations
    .where("[patientId+at]")
    .between([patientId, start], [patientId, end], true, false)
    .toArray();
  const changes = await db.changes.where("patientId").equals(patientId).toArray();
  const changesOf = new Map<number, typeof changes>();
  for (const c of changes) changesOf.set(c.observationId, [...(changesOf.get(c.observationId) ?? []), c]);

  const summary: ResearchSummary = {
    total: logs.length,
    active: 0,
    deleted: 0,
    tz,
    placeholderDevice: 0,
    defaultedRole: 0,
    noFrequency: 0,
    offsetFromZone: 0,
    approxTime: 0,
    recentlyEdited: 0,
  };
  let mismatched = 0;
  const records = logs
    .sort((a, b) => a.at - b.at || a.uid!.localeCompare(b.uid!))
    .map((o) => {
      const real = zoneOffsetMin(tz, o.at);
      if (o.tzOffsetMin === undefined) summary.offsetFromZone++;
      else if (o.tzOffsetMin !== real) mismatched++;
      const mine = (changesOf.get(o.id!) ?? []).sort((a, b) => a.at - b.at || a.id! - b.id!);
      const last = mine[mine.length - 1];
      if (last?.action === "edit" && now - last.at < EDIT_MERGE_MS) summary.recentlyEdited++;
      const extra = input.extras?.(o) ?? {};
      const frequency = extra.frequency ?? null;
      if (!extra.role) summary.defaultedRole++;
      if (frequency === null) summary.noFrequency++;
      if (!o.deviceId) summary.placeholderDevice++;
      if (o.approx) summary.approxTime++;
      if (o.deletedAt === undefined) summary.active++;
      else summary.deleted++;
      return {
        record_id: o.uid!,
        revision: 1 + mine.length,
        status: o.deletedAt === undefined ? "active" : "deleted",
        participant_id: patientId,
        device_id: o.deviceId ?? PLACEHOLDER_DEVICE_ID,
        logger_role: extra.role ?? "caregiver",
        occurred_start_utc: utcText(o.at),
        occurred_end_utc: o.endedAt === undefined ? null : utcText(o.endedAt),
        utc_offset_min: real,
        tz_name: tz,
        logged_at_utc: utcText(o.loggedAt),
        revised_at_utc: utcText(Math.max(o.loggedAt, last?.at ?? 0)),
        cmai_item: o.itemId,
        frequency,
        rating_scale: frequency === null ? "none" : "cmai_freq_1_7",
        reviewed: extra.reviewed ?? false,
      };
    });
  if (mismatched)
    throw new ExportBlocked(
      `${mismatched} of ${logs.length} logs have a time offset that does not match ${tz} when they happened ` +
        `(the phone was probably in another time zone). Nothing was exported and nothing was changed.`,
    );

  const doc = {
    schema_version: EXPORT_SCHEMA_VERSION,
    header: {
      export_id: input.exportId ?? newId(),
      exported_at_utc: utcText(now),
      app_version: input.appVersion ?? __APP_VERSION__,
      device_id: deviceId,
      participant_id: patientId,
      data_class: patient.demo ? "synthetic" : "real",
      range_start_utc: utcText(start),
      range_end_utc: utcText(end),
      record_count: records.length,
    },
    records,
  };
  return {
    fileName: `cmai-export_${patientId}_${startDay}_${endDay}.json`,
    text: JSON.stringify(doc, null, 2) + "\n",
    summary,
  };
}
