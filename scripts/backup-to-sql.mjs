// Turns a CMAI Tracker backup (and, optionally, its scores CSV) into SQL for the lab database in
// docs/data/lab-schema.sql. The output runs unchanged on PostgreSQL and SQLite, and importing
// the same file twice adds nothing (every insert is ON CONFLICT DO NOTHING on a stable key).
// Rows that break the schema's rules are left out and counted, never guessed at.
//
//   node scripts/backup-to-sql.mjs cmai-backup-2026-10-08.json [cmai-scores-2026-10-08.csv] > import.sql
//   sqlite3 lab.db < docs/data/lab-schema.sql && sqlite3 lab.db < import.sql
//
// Made-up data only until Dr. Gupta approves a real-data location (P-04).

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

// The app's pick lists and behaviors (src/ui/LogSheet.tsx, src/data/logs.ts, src/scoring/items.ts).
// tests/backupToSql.test.ts checks these against the app's own lists, so they cannot drift.
export const BEFORE_OPTIONS = [
  "Personal care or bathing",
  "Mealtime",
  "Noise or crowding",
  "Seemed in pain",
  "Change in routine",
  "Visitor or phone call",
  "Nothing noticed",
  "Other",
];
export const DELETE_REASONS = [
  "Tapped by mistake",
  "Wrong behavior",
  "Wrong patient",
  "Logged twice",
  "Other",
  "Undone right after logging",
];

const sha = (text) => createHash("sha256").update(text).digest("hex");
const isInt = (v) => Number.isSafeInteger(v);
const isText = (v, max = 200) => typeof v === "string" && v.length > 0 && v.length <= max;
const CODE = /^[A-Z0-9-]{2,12}$/;

/** A SQL literal. Text has its quotes doubled; anything that is not a whole number, boolean or text becomes NULL. */
function lit(v) {
  if (v === undefined || v === null) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return isInt(v) ? String(v) : "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function insert(table, row, conflict = "") {
  const cols = Object.keys(row);
  return `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((c) => lit(row[c])).join(", ")}) ON CONFLICT ${conflict}DO NOTHING;`;
}

/** The format 1 key for a log: the same four fields the app's restore uses to spot duplicates. */
export const v1ObservationUid = (o) => `v1-${sha(`${o.patientId}|${o.itemId}|${o.at}|${o.loggedAt}`).slice(0, 32)}`;

/**
 * @param {string} text the backup file's contents
 * @param {{ fileName?: string, importedAt?: number, importedBy?: string, items?: {id:number,name:string,group:string,manualPage:number}[] }} [opts]
 * @returns {{ sql: string, counts: Record<string, number>, skipped: Record<string, number>, batchId: string }}
 */
export function backupToSql(text, opts = {}) {
  const data = JSON.parse(text);
  if (typeof data !== "object" || data === null || !Array.isArray(data.patients) || !Array.isArray(data.observations)) {
    throw new Error("Not a CMAI Tracker backup: it needs patients and observations.");
  }
  const batchId = sha(text);
  const schemaVersion = isInt(data.schemaVersion) ? data.schemaVersion : 1;
  const exportedAt = Date.parse(data.exportedAt);
  if (!Number.isFinite(exportedAt)) throw new Error("The backup has no valid exportedAt time.");
  const fileDevice = isText(data.deviceId, 64) ? data.deviceId : `v1-${batchId.slice(0, 16)}`;
  const deviceOf = (r) => (isText(r.deviceId, 64) ? r.deviceId : fileDevice);
  const byOf = (r) => (isText(r.by, 12) ? r.by : null);

  const out = ["BEGIN;"];
  const counts = {};
  const skipped = {};
  const add = (table, row, conflict) => {
    out.push(insert(table, row, conflict));
    counts[table] = (counts[table] ?? 0) + 1;
  };
  const skip = (what) => (skipped[what] = (skipped[what] ?? 0) + 1);

  add("schema_info", { key: "lab_schema_version", value: "1" }, "(key) ");
  for (const i of opts.items ?? [])
    add("cmai_item", { item_id: i.id, name: i.name, factor_group: i.group, manual_page: i.manualPage }, "(item_id) ");
  for (const label of BEFORE_OPTIONS) add("before_option", { label }, "(label) ");
  for (const label of DELETE_REASONS) add("delete_reason", { label }, "(label) ");

  add(
    "import_batch",
    {
      batch_id: batchId,
      file_name: opts.fileName ?? null,
      schema_version: schemaVersion,
      app_version: isText(data.appVersion, 40) ? data.appVersion : null,
      build: isText(data.build, 80) ? data.build : null,
      rule_version: isText(data.ruleVersion, 40) ? data.ruleVersion : "unknown",
      exported_at_ms: exportedAt,
      exported_utc_offset_min: isInt(data.exportedAtOffsetMinutes) ? data.exportedAtOffsetMinutes : null,
      device_id: isText(data.deviceId, 64) ? data.deviceId : null,
      imported_at_ms: opts.importedAt ?? Date.now(),
      imported_by: opts.importedBy ?? null,
    },
    "(batch_id) ",
  );

  const devices = new Set([
    fileDevice,
    ...[...data.observations, ...(data.checkins ?? []), ...(data.changes ?? [])]
      .filter((r) => r && isText(r.deviceId, 64))
      .map((r) => r.deviceId),
  ]);
  for (const d of devices) add("device", { device_id: d, first_batch_id: batchId }, "(device_id) ");

  for (const c of Array.isArray(data.caregivers) ? data.caregivers : []) {
    if (!c || !isText(c.id, 12)) {
      skip("caregiver");
      continue;
    }
    add(
      "caregiver",
      {
        caregiver_code: c.id,
        initials: isText(c.initials, 3) ? c.initials : null,
        created_at_ms: c.createdAt,
        archived_at_ms: c.archivedAt,
      },
      "(caregiver_code) ",
    );
  }
  const caregivers = new Set((data.caregivers ?? []).filter((c) => c && isText(c.id, 12)).map((c) => c.id));
  const byKnown = (r) => {
    const b = byOf(r);
    return b && caregivers.has(b) ? b : null;
  };

  const patients = new Set();
  for (const p of data.patients) {
    if (!p || typeof p.id !== "string" || !CODE.test(p.id) || !isInt(p.anchor)) {
      skip("patient");
      continue;
    }
    patients.add(p.id);
    add(
      "patient",
      {
        patient_code: p.id,
        anchor_ms: p.anchor,
        demo: p.demo === true,
        color: isInt(p.color) ? p.color : null,
        archived_at_ms: p.archivedAt,
        archive_reason: isText(p.archiveReason, 40) ? p.archiveReason : null,
        archive_note: isText(p.archiveNote, 120) ? p.archiveNote : null,
        first_batch_id: batchId,
      },
      "(patient_code) ",
    );
    // A second phone with the same code and another start day is kept for the lab to decide (D-19).
    out.push(
      `INSERT INTO patient_anchor_conflict (patient_code, anchor_ms, batch_id) SELECT ${lit(p.id)}, ${lit(p.anchor)}, ${lit(batchId)} WHERE EXISTS (SELECT 1 FROM patient WHERE patient_code = ${lit(p.id)} AND anchor_ms <> ${lit(p.anchor)}) ON CONFLICT (patient_code, anchor_ms) DO NOTHING;`,
    );
  }

  for (const a of Array.isArray(data.assignments) ? data.assignments : []) {
    if (!a || !caregivers.has(a.caregiverId) || !patients.has(a.patientId)) {
      skip("assignment");
      continue;
    }
    add(
      "assignment",
      { caregiver_code: a.caregiverId, patient_code: a.patientId, sort_order: a.order, assigned_at_ms: a.at },
      "(caregiver_code, patient_code) ",
    );
  }

  const uidByLocalId = new Map();
  for (const o of data.observations) {
    const ok =
      o &&
      patients.has(o.patientId) &&
      isInt(o.itemId) &&
      o.itemId >= 1 &&
      o.itemId <= 29 &&
      isInt(o.at) &&
      isInt(o.loggedAt) &&
      (o.before === undefined || BEFORE_OPTIONS.includes(o.before)) &&
      (o.beforeNote === undefined || isText(o.beforeNote, 120)) &&
      (o.deletedAt === undefined || (isInt(o.deletedAt) && DELETE_REASONS.includes(o.deleteReason))) &&
      (o.deleteNote === undefined || isText(o.deleteNote, 120)) &&
      (o.endedAt === undefined || (isInt(o.endedAt) && o.endedAt >= o.at));
    if (!ok) {
      skip("observation");
      continue;
    }
    const uid = isText(o.uid, 64) ? o.uid : v1ObservationUid(o);
    if (isInt(o.id)) uidByLocalId.set(o.id, uid);
    add(
      "observation",
      {
        observation_uid: uid,
        patient_code: o.patientId,
        item_id: o.itemId,
        occurred_at_ms: o.at,
        utc_offset_min: isInt(o.tzOffsetMin) ? o.tzOffsetMin : null,
        time_approximate: o.approx === true,
        before_option: o.before ?? null,
        before_note: o.beforeNote ?? null,
        logged_at_ms: o.loggedAt,
        logged_by: byKnown(o),
        ended_at_ms: o.endedAt,
        deleted_at_ms: o.deletedAt,
        delete_reason: o.deletedAt === undefined ? null : o.deleteReason,
        delete_note: o.deleteNote ?? null,
        device_id: deviceOf(o),
        source_local_id: isInt(o.id) ? o.id : null,
        batch_id: batchId,
      },
      "(observation_uid) ",
    );
  }

  for (const c of Array.isArray(data.changes) ? data.changes : []) {
    const obsUid = c && uidByLocalId.get(c.observationId);
    if (!obsUid || !patients.has(c.patientId) || !["edit", "delete", "restore"].includes(c.action) || !isInt(c.at)) {
      skip("observation_change");
      continue;
    }
    const fromJson = c.from ? JSON.stringify(c.from) : null;
    const toJson = c.to ? JSON.stringify(c.to) : null;
    const uid = isText(c.uid, 64)
      ? c.uid
      : `v1-${sha(`${obsUid}|${c.action}|${c.at}|${fromJson}|${toJson}`).slice(0, 32)}`;
    add(
      "observation_change",
      {
        change_uid: uid,
        observation_uid: obsUid,
        patient_code: c.patientId,
        action: c.action,
        changed_at_ms: c.at,
        from_json: fromJson,
        to_json: toJson,
        changed_by: byKnown(c),
        device_id: deviceOf(c),
        batch_id: batchId,
      },
      "(change_uid) ",
    );
  }

  for (const c of Array.isArray(data.checkins) ? data.checkins : []) {
    if (!c || !patients.has(c.patientId) || !isInt(c.day) || !isInt(c.at)) {
      skip("checkin");
      continue;
    }
    add(
      "checkin",
      {
        patient_code: c.patientId,
        day_ms: c.day,
        tapped_at_ms: c.at,
        utc_offset_min: isInt(c.tzOffsetMin) ? c.tzOffsetMin : null,
        by_caregiver: byKnown(c),
        device_id: deviceOf(c),
        batch_id: batchId,
      },
      "(patient_code, day_ms) ",
    );
  }

  for (const w of Array.isArray(data.watches) ? data.watches : []) {
    if (
      !w ||
      !isText(w.uid, 64) ||
      !patients.has(w.patientId) ||
      !isInt(w.start) ||
      (w.end !== undefined && !(isInt(w.end) && w.end >= w.start))
    ) {
      skip("watch");
      continue;
    }
    add(
      "watch",
      {
        watch_uid: w.uid,
        patient_code: w.patientId,
        by_caregiver: byKnown(w),
        start_ms: w.start,
        end_ms: w.end,
        start_source: ["tap", "log"].includes(w.startSource) ? w.startSource : null,
        end_source: ["tap", "switch", "signout", "timeout"].includes(w.endSource) ? w.endSource : null,
        utc_offset_min: isInt(w.tzOffsetMin) ? w.tzOffsetMin : null,
        device_id: deviceOf(w),
        batch_id: batchId,
      },
      "(watch_uid) ",
    );
  }

  for (const r of Array.isArray(data.caregiverRatings) ? data.caregiverRatings : []) {
    if (
      !r ||
      !isText(r.uid, 64) ||
      !patients.has(r.patientId) ||
      !isInt(r.windowStart) ||
      typeof r.answers !== "object" ||
      r.answers === null
    ) {
      skip("caregiver_rating");
      continue;
    }
    add(
      "caregiver_rating",
      {
        rating_uid: r.uid,
        patient_code: r.patientId,
        window_start_ms: r.windowStart,
        by_caregiver: byKnown(r),
        started_at_ms: r.startedAt,
        submitted_at_ms: r.submittedAt,
        rule_version: isText(r.ruleVersion, 40) ? r.ruleVersion : null,
        device_id: deviceOf(r),
        batch_id: batchId,
      },
      "(rating_uid) ",
    );
    for (const [item, choice] of Object.entries(r.answers)) {
      const itemId = Number(item);
      if (!isInt(itemId) || itemId < 1 || itemId > 29 || !isInt(choice) || choice < 1 || choice > 9) {
        skip("caregiver_rating_answer");
        continue;
      }
      add("caregiver_rating_answer", { rating_uid: r.uid, item_id: itemId, choice }, "(rating_uid, item_id) ");
    }
  }

  for (const r of Array.isArray(data.reviews) ? data.reviews : []) {
    if (
      !r ||
      !isText(r.key, 80) ||
      !patients.has(r.patientId) ||
      !isInt(r.windowStart) ||
      !isInt(r.itemId) ||
      r.itemId < 1 ||
      r.itemId > 29 ||
      !isInt(r.choice) ||
      r.choice < 1 ||
      r.choice > 9
    ) {
      skip("legacy_review");
      continue;
    }
    add(
      "legacy_review",
      {
        review_key: r.key,
        patient_code: r.patientId,
        window_start_ms: r.windowStart,
        item_id: r.itemId,
        choice: r.choice,
        derived: r.derived,
        reviewed_at_ms: r.reviewedAt,
        batch_id: batchId,
      },
      "(review_key) ",
    );
  }

  out.push("COMMIT;");
  return { sql: out.join("\n") + "\n", counts, skipped, batchId };
}

/** Splits one CSV line written by the app's exporter (quotes only around cells with " , or a line break). */
function splitCsv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * The scores CSV as `period_score` rows. Needs the time the CSV was made, because format 1 does
 * not write it: pass the backup's exportedAt when the two files come from the same export.
 */
export function scoresCsvToSql(text, computedAtMs) {
  const [header, ...rows] = splitCsv(text.trim());
  const col = (name) => header.indexOf(name);
  for (const need of [
    "patient_id",
    "window_start",
    "window_end",
    "provisional",
    "item_id",
    "count",
    "derived_rating",
    "rule_version",
  ]) {
    if (col(need) < 0) throw new Error(`The scores file has no ${need} column.`);
  }
  const get = (r, name) => (col(name) < 0 ? undefined : r[col(name)]);
  const bool = (v) => (v === "true" ? true : v === "false" ? false : null);
  const int = (v) => (v === undefined || v === "" ? null : Number(v));
  const out = ["BEGIN;"];
  let n = 0;
  for (const r of rows) {
    const exported = Date.parse(get(r, "exported_at") ?? "");
    out.push(
      insert(
        "period_score",
        {
          patient_code: get(r, "patient_id"),
          window_start_ms: Date.parse(get(r, "window_start")),
          window_end_ms: Date.parse(get(r, "window_end")),
          item_id: int(get(r, "item_id")),
          rule_version: get(r, "rule_version"),
          computed_at_ms: Number.isFinite(exported) ? exported : computedAtMs,
          provisional: bool(get(r, "provisional")),
          period_final: bool(get(r, "period_final")),
          log_count: int(get(r, "count")),
          derived_rating: int(get(r, "derived_rating")),
          unlogged_days: int(get(r, "unlogged_days")),
          watched_minutes: int(get(r, "watched_minutes")),
        },
        "(patient_code, window_start_ms, item_id, rule_version, computed_at_ms) ",
      ),
    );
    n++;
  }
  out.push("COMMIT;");
  return { sql: out.join("\n") + "\n", rows: n };
}

/** The 29 behaviors read from src/scoring/items.ts, so the script runs with plain Node and no build step. */
export function itemsFromSource(source) {
  const items = [...source.matchAll(/id: (\d+),\s*name: "([^"]+)"[\s\S]*?manualPage: (\d+),\s*group: "(\w+)"/g)].map(
    ([, id, name, page, group]) => ({ id: Number(id), name, manualPage: Number(page), group }),
  );
  if (items.length !== 29) throw new Error(`Expected 29 behaviors in src/scoring/items.ts, found ${items.length}.`);
  return items;
}

// Command line: the behavior list comes from the app's own source, so the reference table matches it.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [backupPath, scoresPath] = process.argv.slice(2);
  if (!backupPath) {
    console.error("Usage: node scripts/backup-to-sql.mjs <backup.json> [scores.csv] > import.sql");
    process.exit(2);
  }
  const items = itemsFromSource(readFileSync(new URL("../src/scoring/items.ts", import.meta.url), "utf8"));
  const text = readFileSync(backupPath, "utf8");
  const { sql, counts, skipped } = backupToSql(text, { fileName: basename(backupPath), items });
  process.stdout.write(sql);
  if (scoresPath)
    process.stdout.write(scoresCsvToSql(readFileSync(scoresPath, "utf8"), Date.parse(JSON.parse(text).exportedAt)).sql);
  console.error(`Rows: ${JSON.stringify(counts)}`);
  if (Object.keys(skipped).length)
    console.error(`Left out (did not meet the schema's rules): ${JSON.stringify(skipped)}`);
}
