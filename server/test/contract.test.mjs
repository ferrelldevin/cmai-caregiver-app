import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { problemWith } from "../src/contract.mjs";

const DEVICE = randomUUID();
const record = (over = {}) => ({
  record_id: randomUUID(),
  revision: 1,
  status: "active",
  participant_id: "P-DEMO-A",
  device_id: DEVICE,
  logger_role: "researcher",
  occurred_start_utc: "2026-11-02T14:05:00Z",
  occurred_end_utc: null,
  utc_offset_min: -300,
  tz_name: "America/New_York",
  logged_at_utc: "2026-11-02T14:05:00Z",
  revised_at_utc: "2026-11-02T14:05:00Z",
  cmai_item: 3,
  frequency: null,
  rating_scale: "none",
  reviewed: false,
  ...over,
});
const file = (records, header = {}) => ({
  schema_version: "1.0.0",
  header: {
    export_id: randomUUID(),
    exported_at_utc: "2026-11-03T12:00:00Z",
    app_version: "0.3.0",
    device_id: DEVICE,
    participant_id: "P-DEMO-A",
    data_class: "self-test",
    range_start_utc: "2026-11-02T05:00:00Z",
    range_end_utc: "2026-11-03T05:00:00Z",
    record_count: records.length,
    ...header,
  },
  records,
});

test("a good file passes", () => assert.equal(problemWith(file([record()]), "self-test"), null));

test("each thing the lab reader stops on is refused here too", () => {
  const bad = {
    "wrong class for the key": [file([record()], { data_class: "synthetic" })],
    "real data": [file([record()], { data_class: "real" })],
    "offset that does not match the zone": [file([record({ utc_offset_min: -240 })])],
    "unknown zone": [file([record({ tz_name: "Foo/Bar" })])],
    "ends before it starts": [file([record({ occurred_end_utc: "2026-11-02T14:00:00Z" })])],
    "revised before logged": [file([record({ revised_at_utc: "2026-11-02T14:00:00Z" })])],
    "impossible timestamp": [file([record({ occurred_start_utc: "2026-02-31T25:61:61Z" })])],
    "year 0": [file([record({ logged_at_utc: "0000-00-00T00:00:00Z" })])],
    "revision too large": [file([record({ revision: 3_000_000_000 })])],
    "frequency and scale disagree": [file([record({ frequency: 3 })])],
    "another participant": [file([record({ participant_id: "P-02" })])],
    "wrong record_count": [file([record()], { record_count: 2 })],
    "range runs backwards": [file([record()], { range_start_utc: "2026-11-04T00:00:00Z" })],
    "extra field": [{ ...file([record()]), extra: 1 }],
  };
  for (const [name, [doc]] of Object.entries(bad)) assert.notEqual(problemWith(doc, "self-test"), null, name);
  const dup = record();
  assert.notEqual(problemWith(file([dup, { ...dup }]), "self-test"), null, "same record and revision twice");
});

test("a refusal never repeats text the sender wrote", () => {
  const evil = "X".repeat(5000);
  const msg = problemWith(file([record()], { data_class: evil }), "self-test");
  assert.ok(msg && !msg.includes("XXXX") && msg.length < 200);
});
