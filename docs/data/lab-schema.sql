-- CMAI Tracker: lab database schema, version 1 (draft, 2026-11-10).
--
-- The tables the lab's own database will hold once data leaves the phones. Written in plain SQL
-- that runs unchanged on PostgreSQL (tested on 16) and SQLite 3.24+ (tested on 3.53), so it can start as one file on a lab
-- computer and move to an ODU-managed PostgreSQL server (or be mapped to REDCap) without
-- reshaping the data. Which database the lab uses is open: register P-13 (proposed).
--
-- Rules the whole schema follows (docs/data/lab-database.md explains each):
--   * Every time is a whole number of milliseconds since 1970-01-01 UTC (`*_ms`), exactly as the
--     app stores it, so nothing is rounded or shifted on the way in. The phone's offset from UTC
--     sits beside it (`utc_offset_min`) when the app recorded one (format 2, D-22).
--   * Every row from a phone has a key that is unique across phones (`*_uid`), so files from
--     several phones, or the same file twice, merge without duplicates.
--   * Nothing is deleted. A deleted log keeps its row, with when and why (D-14, design note 007).
--   * Ratings are not entered here. `period_score` holds what the app computed, with its rule
--     version, so it can be checked against the logs at any time.
--   * No names, rooms or dates of birth anywhere. The key that links a code to a person is kept
--     apart, by the person Dr. Gupta names (data management plan, section 3).
--
-- Made-up data only until Dr. Gupta approves a real-data location (P-04).

-- ---------------------------------------------------------------------------------------------
-- Reference lists. Filled once by scripts/backup-to-sql.mjs from src/scoring/items.ts and the
-- app's pick lists; a change to a list is a new row, never an edit of an old one.

CREATE TABLE IF NOT EXISTS schema_info (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cmai_item (
  item_id INTEGER PRIMARY KEY CHECK (item_id BETWEEN 1 AND 29), -- number on the CMAI long form, manual p.22-23
  name TEXT NOT NULL,                                          -- the app's short name; CMAI content (c) Cohen-Mansfield, see NOTICE
  factor_group TEXT NOT NULL CHECK (factor_group IN ('aggressive', 'physical', 'verbal', 'other')), -- nursing-home factors, manual p.7
  manual_page INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS before_option (
  label TEXT PRIMARY KEY -- "what happened just before", as the app shows it
);

CREATE TABLE IF NOT EXISTS delete_reason (
  label TEXT PRIMARY KEY
);

-- ---------------------------------------------------------------------------------------------
-- Where each row came from. One row per backup file imported.

CREATE TABLE IF NOT EXISTS import_batch (
  batch_id TEXT PRIMARY KEY,          -- SHA-256 of the file's bytes, so the same file is one batch however often it is imported
  file_name TEXT,
  schema_version INTEGER NOT NULL,    -- 1 for files without schemaVersion (data dictionary, part 1)
  app_version TEXT,                   -- empty for format 1
  build TEXT,
  rule_version TEXT NOT NULL,         -- scoring rule in the app that made the file
  exported_at_ms BIGINT NOT NULL,
  exported_utc_offset_min INTEGER,    -- format 2 only
  device_id TEXT,                     -- format 2 only
  imported_at_ms BIGINT NOT NULL,
  imported_by TEXT                    -- lab member's code, never a name
);

CREATE TABLE IF NOT EXISTS device (
  device_id TEXT PRIMARY KEY,         -- format 2 deviceId; format 1 files get 'v1-' plus the batch id
  first_batch_id TEXT REFERENCES import_batch (batch_id),
  note TEXT                           -- for example which site the phone is at (a site code, not an address)
);

-- ---------------------------------------------------------------------------------------------
-- People, by code only.

CREATE TABLE IF NOT EXISTS patient (
  patient_code TEXT PRIMARY KEY CHECK (length(patient_code) BETWEEN 2 AND 12), -- such as 'P-01'
  anchor_ms BIGINT NOT NULL,          -- local midnight of day 1 on the phone that added the patient
  demo BOOLEAN NOT NULL DEFAULT FALSE,
  color INTEGER,
  archived_at_ms BIGINT,              -- archived, never erased (D-20)
  archive_reason TEXT,
  archive_note TEXT,
  first_batch_id TEXT REFERENCES import_batch (batch_id)
);

-- When two phones hold the same code with different start days (D-19), the first imported start
-- stays in `patient` and each other one is recorded here for the lab to decide.
CREATE TABLE IF NOT EXISTS patient_anchor_conflict (
  patient_code TEXT NOT NULL REFERENCES patient (patient_code),
  anchor_ms BIGINT NOT NULL,
  batch_id TEXT NOT NULL REFERENCES import_batch (batch_id),
  PRIMARY KEY (patient_code, anchor_ms)
);

CREATE TABLE IF NOT EXISTS caregiver (
  caregiver_code TEXT PRIMARY KEY,    -- such as 'C-02' (R2, F-45). PIN data never leaves the phone
  initials TEXT CHECK (initials IS NULL OR length(initials) BETWEEN 2 AND 3),
  created_at_ms BIGINT,
  archived_at_ms BIGINT
);

CREATE TABLE IF NOT EXISTS assignment (
  caregiver_code TEXT NOT NULL REFERENCES caregiver (caregiver_code),
  patient_code TEXT NOT NULL REFERENCES patient (patient_code),
  sort_order INTEGER,
  assigned_at_ms BIGINT,
  PRIMARY KEY (caregiver_code, patient_code)
);

-- ---------------------------------------------------------------------------------------------
-- What the caregivers recorded.

CREATE TABLE IF NOT EXISTS observation (
  observation_uid TEXT PRIMARY KEY,   -- format 2 uid; format 1 logs get 'v1-' plus a hash of patient, item, at and loggedAt (the app's own duplicate rule)
  patient_code TEXT NOT NULL REFERENCES patient (patient_code),
  item_id INTEGER NOT NULL REFERENCES cmai_item (item_id),
  occurred_at_ms BIGINT NOT NULL,
  utc_offset_min INTEGER,             -- empty for format 1: the local day is then unknown from the data alone
  time_approximate BOOLEAN NOT NULL DEFAULT FALSE,
  before_option TEXT REFERENCES before_option (label),
  before_note TEXT CHECK (before_note IS NULL OR length(before_note) <= 120), -- free text: check before sharing (P-11)
  logged_at_ms BIGINT NOT NULL,
  logged_by TEXT REFERENCES caregiver (caregiver_code),
  ended_at_ms BIGINT,                 -- "it stopped" (F-39)
  deleted_at_ms BIGINT,
  delete_reason TEXT REFERENCES delete_reason (label),
  delete_note TEXT CHECK (delete_note IS NULL OR length(delete_note) <= 120),
  device_id TEXT REFERENCES device (device_id),
  source_local_id INTEGER,            -- the phone's own number; only meaningful inside its batch
  batch_id TEXT NOT NULL REFERENCES import_batch (batch_id),
  CHECK ((deleted_at_ms IS NULL AND delete_reason IS NULL) OR (deleted_at_ms IS NOT NULL AND delete_reason IS NOT NULL)),
  CHECK (ended_at_ms IS NULL OR ended_at_ms >= occurred_at_ms)
);
CREATE INDEX IF NOT EXISTS observation_patient_time ON observation (patient_code, occurred_at_ms);

CREATE TABLE IF NOT EXISTS observation_change (
  change_uid TEXT PRIMARY KEY,
  observation_uid TEXT NOT NULL REFERENCES observation (observation_uid),
  patient_code TEXT NOT NULL REFERENCES patient (patient_code),
  action TEXT NOT NULL CHECK (action IN ('edit', 'delete', 'restore')),
  changed_at_ms BIGINT NOT NULL,
  from_json TEXT,                     -- the fields as they were, as JSON text
  to_json TEXT,
  changed_by TEXT REFERENCES caregiver (caregiver_code),
  device_id TEXT REFERENCES device (device_id),
  batch_id TEXT NOT NULL REFERENCES import_batch (batch_id)
);

CREATE TABLE IF NOT EXISTS checkin (
  patient_code TEXT NOT NULL REFERENCES patient (patient_code),
  day_ms BIGINT NOT NULL,             -- local midnight of the day it covers
  tapped_at_ms BIGINT NOT NULL,
  utc_offset_min INTEGER,
  by_caregiver TEXT REFERENCES caregiver (caregiver_code),
  device_id TEXT REFERENCES device (device_id),
  batch_id TEXT NOT NULL REFERENCES import_batch (batch_id),
  PRIMARY KEY (patient_code, day_ms)
);

CREATE TABLE IF NOT EXISTS watch (     -- watching hours (F-38, D-25)
  watch_uid TEXT PRIMARY KEY,
  patient_code TEXT NOT NULL REFERENCES patient (patient_code),
  by_caregiver TEXT REFERENCES caregiver (caregiver_code),
  start_ms BIGINT NOT NULL,
  end_ms BIGINT,
  start_source TEXT CHECK (start_source IN ('tap', 'log')),
  end_source TEXT CHECK (end_source IS NULL OR end_source IN ('tap', 'switch', 'signout', 'timeout')),
  utc_offset_min INTEGER,
  device_id TEXT REFERENCES device (device_id),
  batch_id TEXT NOT NULL REFERENCES import_batch (batch_id),
  CHECK (end_ms IS NULL OR end_ms >= start_ms)
);

-- A caregiver's own day-14 CMAI, made blind to the app's ratings (F-47, D-24, spec section 5).
CREATE TABLE IF NOT EXISTS caregiver_rating (
  rating_uid TEXT PRIMARY KEY,
  patient_code TEXT NOT NULL REFERENCES patient (patient_code),
  window_start_ms BIGINT NOT NULL,
  by_caregiver TEXT REFERENCES caregiver (caregiver_code),
  started_at_ms BIGINT,
  submitted_at_ms BIGINT,
  rule_version TEXT,
  device_id TEXT REFERENCES device (device_id),
  batch_id TEXT NOT NULL REFERENCES import_batch (batch_id)
);

CREATE TABLE IF NOT EXISTS caregiver_rating_answer (
  rating_uid TEXT NOT NULL REFERENCES caregiver_rating (rating_uid),
  item_id INTEGER NOT NULL REFERENCES cmai_item (item_id),
  choice INTEGER NOT NULL CHECK (choice BETWEEN 1 AND 9), -- 8 would occur if not prevented, 9 not applicable (manual p.3, p.5, p.24)
  PRIMARY KEY (rating_uid, item_id)
);

-- Day-14 review choices from before ratings were locked (D-14). Kept so nothing recorded is lost;
-- never used for scores.
CREATE TABLE IF NOT EXISTS legacy_review (
  review_key TEXT PRIMARY KEY,
  patient_code TEXT NOT NULL REFERENCES patient (patient_code),
  window_start_ms BIGINT NOT NULL,
  item_id INTEGER NOT NULL REFERENCES cmai_item (item_id),
  choice INTEGER NOT NULL CHECK (choice BETWEEN 1 AND 9),
  derived INTEGER,
  reviewed_at_ms BIGINT,
  batch_id TEXT NOT NULL REFERENCES import_batch (batch_id)
);

-- ---------------------------------------------------------------------------------------------
-- What the app computed. Loaded from scores.csv, never typed. Every row names its rule, so a
-- rule change adds rows and never rewrites old ones.

CREATE TABLE IF NOT EXISTS period_score (
  patient_code TEXT NOT NULL REFERENCES patient (patient_code),
  window_start_ms BIGINT NOT NULL,
  window_end_ms BIGINT NOT NULL,
  item_id INTEGER NOT NULL REFERENCES cmai_item (item_id),
  rule_version TEXT NOT NULL,
  computed_at_ms BIGINT NOT NULL,     -- the export time
  provisional BOOLEAN NOT NULL,
  period_final BOOLEAN,               -- format 2 (D-21)
  log_count INTEGER NOT NULL CHECK (log_count >= 0),
  derived_rating INTEGER NOT NULL CHECK (derived_rating BETWEEN 1 AND 7),
  unlogged_days INTEGER CHECK (unlogged_days BETWEEN 0 AND 14),
  watched_minutes INTEGER,
  PRIMARY KEY (patient_code, window_start_ms, item_id, rule_version, computed_at_ms)
);

-- The logs that count: what the app's ratings are computed from.
DROP VIEW IF EXISTS live_observation;
CREATE VIEW live_observation AS
  SELECT * FROM observation WHERE deleted_at_ms IS NULL;
