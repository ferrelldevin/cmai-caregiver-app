"""Reader-side check for the CMAI Tracker research export (contract v1.0.0).

Proposed for the sensor pipeline. Stdlib only (Python 3.11+). Not wired into sensorlab yet.

    python cmai_export_check.py EXPORT.json [EXPORT2.json ...] [--participant SYN-P01]
                                [--data-class synthetic|real|self-test] [--events-csv OUT.csv]

Exits 1 with a plain message on the first contract breach. Never guesses:
an unknown schema_version, field, item number or time format is a hard stop.
With several files it merges them: newest revision of each record wins,
a 'deleted' revision removes the record, and two files that disagree about
the same (record_id, revision) stop the run.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

SUPPORTED_VERSIONS = {"1.0.0"}  # add a version here only after reading its changelog entry

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
PID = re.compile(r"^[A-Z]{1,5}(-[A-Z0-9]{1,12})+$")
SEMVER = re.compile(r"^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$")

HEADER_KEYS = {"export_id", "exported_at_utc", "app_version", "device_id", "participant_id",
               "data_class", "range_start_utc", "range_end_utc", "record_count"}
RECORD_KEYS = {"record_id", "revision", "status", "participant_id", "device_id", "logger_role",
               "occurred_start_utc", "occurred_end_utc", "utc_offset_min", "tz_name",
               "logged_at_utc", "revised_at_utc", "cmai_item", "frequency", "rating_scale", "reviewed"}

EVENTS_COLUMNS = ["local_time", "end_local_time", "event_type", "value", "confirmed", "logged_by"]


class ContractError(ValueError):
    pass


def _fail(where: str, msg: str):
    raise ContractError(f"{where}: {msg}")


def _utc(where: str, v) -> datetime:
    if not isinstance(v, str) or not UTC.match(v):
        _fail(where, f"must be UTC like 2026-11-20T23:42:10Z, got {v!r}")
    return datetime.strptime(v, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def _keys(where: str, obj, expected: set):
    if not isinstance(obj, dict):
        _fail(where, "must be an object")
    extra, missing = set(obj) - expected, expected - set(obj)
    if extra:
        _fail(where, f"unknown field(s) {sorted(extra)} (not in contract; bump schema_version to add)")
    if missing:
        _fail(where, f"missing field(s) {sorted(missing)}")


def _int(where, v, lo, hi):
    if isinstance(v, bool) or not isinstance(v, int) or not lo <= v <= hi:
        _fail(where, f"must be a whole number {lo} to {hi}, got {v!r}")


def check_record(where: str, r: dict, header: dict):
    _keys(where, r, RECORD_KEYS)
    if not UUID.match(str(r["record_id"])):
        _fail(where, "record_id must be a lowercase UUID")
    _int(where + ".revision", r["revision"], 1, 10**9)
    if r["status"] not in ("active", "deleted"):
        _fail(where, "status must be active or deleted")
    if r["participant_id"] != header["participant_id"]:
        _fail(where, "participant_id differs from header")
    if not UUID.match(str(r["device_id"])):
        _fail(where, "device_id must be a lowercase UUID")
    if r["logger_role"] not in ("caregiver", "staff", "researcher"):
        _fail(where, "logger_role must be caregiver, staff or researcher")
    start = _utc(where + ".occurred_start_utc", r["occurred_start_utc"])
    if r["occurred_end_utc"] is not None and _utc(where + ".occurred_end_utc", r["occurred_end_utc"]) < start:
        _fail(where, "occurred_end_utc is before occurred_start_utc")
    _int(where + ".utc_offset_min", r["utc_offset_min"], -720, 840)
    try:
        tz = ZoneInfo(str(r["tz_name"]))
    except (ZoneInfoNotFoundError, ValueError):
        _fail(where, f"tz_name {r['tz_name']!r} is not an IANA time zone")
    real = int(start.astimezone(tz).utcoffset().total_seconds() // 60)
    if real != r["utc_offset_min"]:
        _fail(where, f"utc_offset_min {r['utc_offset_min']} does not match {r['tz_name']} at that time ({real})")
    logged = _utc(where + ".logged_at_utc", r["logged_at_utc"])
    revised = _utc(where + ".revised_at_utc", r["revised_at_utc"])
    if revised < logged:
        _fail(where, "revised_at_utc is before logged_at_utc")
    _int(where + ".cmai_item", r["cmai_item"], 1, 29)
    if r["rating_scale"] == "none":
        if r["frequency"] is not None:
            _fail(where, "frequency must be null when rating_scale is none")
    elif r["rating_scale"] == "cmai_freq_1_7":
        _int(where + ".frequency", r["frequency"], 1, 7)
    else:
        _fail(where, "rating_scale must be cmai_freq_1_7 or none")
    if not isinstance(r["reviewed"], bool):
        _fail(where, "reviewed must be true or false")


def check_export(doc: dict, name: str, participant: str | None = None, data_class: str | None = None) -> dict:
    if not isinstance(doc, dict):
        _fail(name, "top level must be an object")
    v = doc.get("schema_version")
    if v not in SUPPORTED_VERSIONS:
        _fail(name, f"schema_version {v!r} is not supported by this reader (supports {sorted(SUPPORTED_VERSIONS)}). "
                    "Do not import. Update the reader from the contract changelog first.")
    _keys(name, doc, {"schema_version", "header", "records"})
    h = doc["header"]
    _keys(name + ".header", h, HEADER_KEYS)
    for k in ("export_id", "device_id"):
        if not UUID.match(str(h[k])):
            _fail(name + ".header", f"{k} must be a lowercase UUID")
    if not SEMVER.match(str(h["app_version"])):
        _fail(name + ".header", "app_version must look like 1.4.0")
    if not PID.match(str(h["participant_id"])):
        _fail(name + ".header", "participant_id must be a study ID like P-01 or P-DEMO-A")
    if participant and h["participant_id"] != participant:
        _fail(name, f"file is for {h['participant_id']}, not {participant}")
    if h["data_class"] not in ("synthetic", "real", "self-test"):  # self-test: Devin's own logs, F-62 (assumed)
        _fail(name + ".header", "data_class must be synthetic, real or self-test")
    if data_class and h["data_class"] != data_class:
        _fail(name, f"file is {h['data_class']} data; this study is {data_class}. Never mix them")
    _utc(name + ".header.exported_at_utc", h["exported_at_utc"])
    a, b = _utc(name + ".header.range_start_utc", h["range_start_utc"]), _utc(name + ".header.range_end_utc", h["range_end_utc"])
    if b < a:
        _fail(name + ".header", "range_end_utc is before range_start_utc")
    recs = doc["records"]
    if not isinstance(recs, list):
        _fail(name, "records must be a list")
    if len(recs) != h["record_count"]:
        _fail(name, f"record_count says {h['record_count']} but file has {len(recs)} (file cut short?)")
    seen = set()
    for i, r in enumerate(recs):
        check_record(f"{name}.records[{i}]", r, h)
        key = (r["record_id"], r["revision"])
        if key in seen:
            _fail(f"{name}.records[{i}]", "same record_id and revision twice in one file")
        seen.add(key)
    return doc


def merge(docs: list[tuple[str, dict]]) -> list[dict]:
    """Newest revision per record_id wins; identical repeats are fine (idempotent); conflicts stop."""
    by_key: dict[tuple, tuple[str, dict]] = {}
    for name, doc in docs:
        for r in doc["records"]:
            key = (r["record_id"], r["revision"])
            if key in by_key and by_key[key][1] != r:
                _fail(name, f"record {r['record_id']} revision {r['revision']} differs from {by_key[key][0]}. "
                            "A changed record must get a higher revision")
            by_key[key] = (name, r)
    latest: dict[str, dict] = {}
    for (rid, rev), (_, r) in by_key.items():
        if rid not in latest or rev > latest[rid]["revision"]:
            latest[rid] = r
    live = [r for r in latest.values() if r["status"] == "active"]
    return sorted(live, key=lambda r: (r["occurred_start_utc"], r["cmai_item"], r["record_id"]))


def _local(utc_s: str, tz_name: str) -> str:
    return _utc("time", utc_s).astimezone(ZoneInfo(tz_name)).isoformat(timespec="seconds")


def to_events_rows(records: list[dict]) -> list[dict]:
    """Rows in the pipeline's existing import-log CSV format, plus the contract keys after them."""
    out = []
    for r in records:
        row = {
            "local_time": _local(r["occurred_start_utc"], r["tz_name"]),
            "end_local_time": _local(r["occurred_end_utc"], r["tz_name"]) if r["occurred_end_utc"] else "",
            "event_type": "agitation_episode",
            "value": "",
            "confirmed": "true" if r["reviewed"] else "false",
            "logged_by": r["logger_role"],
        }
        row.update({k: ("" if r[k] is None else r[k]) for k in sorted(RECORD_KEYS)})
        out.append(row)
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("files", nargs="+")
    ap.add_argument("--participant")
    ap.add_argument("--data-class", choices=["synthetic", "real", "self-test"])
    ap.add_argument("--events-csv", help="write merged rows in import-log format")
    a = ap.parse_args(argv)
    docs = []
    try:
        for f in a.files:
            with open(f, encoding="utf-8") as fh:
                docs.append((f, check_export(json.load(fh), f, a.participant, a.data_class)))
        pids = {d["header"]["participant_id"] for _, d in docs}
        if len(pids) > 1:
            _fail("files", f"more than one participant in one run: {sorted(pids)}")
        classes = {d["header"]["data_class"] for _, d in docs}
        if len(classes) > 1:
            _fail("files", f"more than one data class in one run: {sorted(classes)}. Never mix them")
        live = merge(docs)
    except (ContractError, json.JSONDecodeError) as e:
        print(f"REJECTED: {e}", file=sys.stderr)
        return 1
    print(f"OK: {len(docs)} file(s), {len(live)} active record(s) after merge")
    if a.events_csv:
        rows = to_events_rows(live)
        with open(a.events_csv, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=EVENTS_COLUMNS + sorted(RECORD_KEYS))
            w.writeheader()
            w.writerows(rows)
        print(f"Wrote {len(rows)} row(s) to {a.events_csv}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
