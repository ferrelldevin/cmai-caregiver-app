# Data contract draft: CMAI Tracker research export, v1.0.0

**Status:** draft for Devin to file in the CMAI Tracker (Gupta Lab) project's review register. Not filed, not sent. Register ID is assigned there. Idea row: I-043. Replaces the 2026-11-17 first draft (CSV-only).

## One-minute version

- **What:** a versioned data contract. The app writes one JSON file per participant; the pipeline checks it against the same schema file and refuses anything that breaks it.
- **Your one action:** copy the block under "Paste into the app register" into the app project's review register and give it an ID there. Attach the three files next to it.
- Three facts:
  - Tested 2026-11-17 on made-up data: two exports (an edit and a deletion) plus a repeat of the first merged to the right single record, flowed into the pipeline's `events` table with the correct UTC time, and 8 broken files were each rejected with a plain message.
  - Item **numbers** 1 to 29 only. No item wording, names or free text, by contract.
  - Made-up data only until Dr. Gupta says in writing where real exports may live.

## Files in this folder

| File                                                             | What it is                                                                          | Who uses it                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------- |
| [cmai-export.schema.json](./cmai-export.schema.json)             | JSON Schema (draft 2020-12): the shape of a valid file                              | App tests (writer) and pipeline (reader) |
| [cmai_export_check.py](./cmai_export_check.py)                   | Reader check plus merge, stdlib Python 3.11+. Adds the rules a schema can't express | Pipeline. The app can run it in CI too   |
| [example-export-synthetic.json](./example-export-synthetic.json) | A valid made-up file (SYN-P01)                                                      | Both: the shared test fixture            |

---

## Paste into the app register

> **Title:** Research export of logged behaviors, data contract v1.0.0
>
> **Problem:** the lab sensor pipeline needs timed, human-made agitation labels to line up with bed, watch and room sensors. The app is that log. The two must stay separate codebases, so they need a contract that survives changes on either side.
>
> **Proposal:** add a read-only "Export for research" action: one participant, one date range, one JSON file. It does not change ratings, scoring rules or app storage.
>
> **File shape (v1.0.0):**
>
> - Top level: `schema_version` ("1.0.0"), `header`, `records`. No other keys.
> - `header`: `export_id` (new UUID per file), `exported_at_utc`, `app_version` (semver), `device_id` (app install UUID), `participant_id` (study ID, never a name), `data_class` ("synthetic" or "real"; synthetic IDs start `SYN-`, real never do), `range_start_utc`, `range_end_utc`, `record_count`.
> - Each record = one CMAI item at one occurrence: `record_id` (UUID, never reused), `revision` (1, then +1 on every change), `status` ("active" or "deleted"), `participant_id`, `device_id`, `logger_role` (caregiver, staff, researcher), `occurred_start_utc`, `occurred_end_utc` (or null), `utc_offset_min`, `tz_name` (IANA, e.g. America/New_York), `logged_at_utc`, `revised_at_utc`, `cmai_item` (1 to 29), `frequency` (1 to 7 or null), `rating_scale` ("cmai_freq_1_7" or "none"), `reviewed` (true only if a second person checked it).
> - Every timestamp is UTC, written `YYYY-MM-DDTHH:MM:SSZ`. Local time is never stored as text; the reader rebuilds it from UTC + `tz_name`, and `utc_offset_min` must match.
> - Never in the file: item wording, names, free-text notes, scores or totals.
>
> **Corrections and deletions:** the app never edits an exported record in place. A change re-exports the same `record_id` with `revision` + 1 and the full new content. A delete re-exports it with `status: "deleted"` (a tombstone). Each export is a full snapshot of the latest revision of every record in the range, tombstones included.
>
> **Re-import is safe (idempotent):** the reader keeps the highest revision per `record_id`; the same (`record_id`, `revision`) seen twice with identical content is ignored; seen twice with different content is a hard error.
>
> **Versioning:**
>
> - `MAJOR.MINOR.PATCH`. PATCH = doc fix, file unchanged. MINOR = new optional field or new enum value. MAJOR = anything removed, renamed, retyped or re-meant.
> - The reader accepts only versions on its explicit list and rejects any other one loudly; it never guesses. Adding a version to the list is a deliberate reader change.
> - A field is marked deprecated in a MINOR release and removed only in the next MAJOR. After a MAJOR bump the app can still write the previous major until the lab confirms the reader is updated.
> - Each version change gets a dated changelog line in both projects, and the schema file's `$id` carries the version.
>
> **Test both sides against one schema:** `cmai-export.schema.json` is the source of truth. App tests validate every generated export against it; the pipeline validates every file before import. `example-export-synthetic.json` is the shared fixture.
>
> **Done when:** (1) an app export of made-up data passes the schema and `cmai_export_check.py`; (2) an edit and a delete, exported again, merge to the right result; (3) the pipeline build shows the rows in `events` with correct UTC times.
>
> **Out of scope:** real participant data (waits on Dr. Gupta), free-text notes, any change to CMAI scoring.

---

## Reference

### Why JSON is canonical, not CSV

- CSV can't carry a header, nulls or types without conventions that drift. One JSON file carries the version, the counts and the types together.
- The pipeline's current `import-log` reads CSV. `cmai_export_check.py --events-csv` writes that CSV from a checked JSON file, so nothing in the pipeline has to change on day one.

### Checks: what the schema catches vs. what the reader adds

| Breach                                                   | JSON Schema | Reader check                        | Tested 2026-11-17 |
| -------------------------------------------------------- | ----------- | ----------------------------------- | ----------------- |
| Unknown `schema_version`                                 | yes         | yes, with "update the reader first" | rejected          |
| Unknown field (e.g. a free-text note)                    | yes         | yes                                 | rejected          |
| Item outside 1 to 29                                     | yes         | yes                                 | rejected          |
| Time not in UTC `Z` form                                 | yes         | yes                                 | rejected          |
| `record_count` ≠ records (file cut short)                | no          | yes                                 | rejected          |
| `data_class` vs. `SYN-` prefix disagree                  | no          | yes                                 | rejected          |
| `utc_offset_min` wrong for `tz_name` at that moment      | no          | yes                                 | rejected          |
| Same record and revision, different content across files | no          | yes                                 | rejected          |
| Edit (rev 2) + delete (tombstone) + repeat of first file | n/a         | merges to 1 active record           | passed            |

Schema checked as valid draft 2020-12 with the `jsonschema` Python package. The reader itself is stdlib only.

### How it lands in the pipeline

Run in **Claude Code or PowerShell**, from the pipeline folder, after copying `cmai_export_check.py` into it:

```
python cmai_export_check.py export.json --participant SYN-P01 --data-class synthetic --events-csv cmai.csv
python -m sensorlab --config config\synthetic.toml import-log --participant SYN-P01 cmai.csv
python -m sensorlab --config config\synthetic.toml build
```

Tested on a copy of the pipeline: the corrected record landed in `events` at `2026-11-20T23:40:00Z`, offset −05:00, `confirmed` 1, `logged_by` caregiver.

**Later, pipeline side (this project, not built):**

- a `sensorlab import-cmai` command that runs the check, stores the JSON raw (write-once, like every stream), and fills a new aligned `cmai_behavior` table keyed like the others;
- a label-delay feature on `episode` (`logged_at_utc` − `occurred_start_utc`).
- Until then, re-importing merged CSVs into the current `import-log` would duplicate rows, because event logs are always kept. Workaround: merge all exports for a participant in one check run and import that one CSV into a fresh data root. (Inference from the pipeline code; noted as a reason to build `import-cmai`.)

### Why connect, not merge

Agreed by Devin 2026-11-17: keeps two codebases apart and keeps CMAI licensing and scoring inside the app.

### Open points

- I have not read the Tracker's data model. If it has no end time, per-record frequency or review flag, those fields are null/false and the contract still holds. If it logs several items in one entry, each item becomes its own record with its own `record_id`.
- Item numbers in a research file are assumed fine under CMAI's non-commercial terms (numbers, not wording). Sign-off pending.
- `device_id` is an install ID, not a hardware ID, so it can't identify a phone. Inference that this is enough to trace which install wrote a record.
- Where real exports may be stored: Dr. Gupta's call (IRB, HIPAA).
