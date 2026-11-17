# 017. Research export contract (filed, not built)

2026-11-17 · Register: F-56 · Status: proposed on assumed approval (Devin), sign-off pending (Dr. Gupta) · Switch: none yet, nothing is built · Docs only

## Problem

The lab's sensor pipeline needs timed, human-made agitation labels to line up with bed, watch and room sensors. The app is that log. The two stay separate codebases, so they need a contract that survives changes on either side. Today the app has export format 2 (D-23, note 013), which was shaped by the app, not agreed with a reader.

## What is filed

Four files in `docs/contracts/cmai-export/`, drafted in the lab's research project (idea I-043) and copied here with their links made relative and the JSON and Markdown reformatted by Prettier (no change to any rule or field):

- `cmai-export-proposal.md`: the contract, versioning rules and the text for the register.
- `cmai-export.schema.json`: JSON Schema, draft 2020-12. Source of truth for the shape.
- `cmai_export_check.py`: reader check and merge, Python standard library only. Adds rules a schema cannot express.
- `example-export-synthetic.json`: valid made-up file (`SYN-P01`), the shared test fixture.
- `example-export-app-codes.json`: valid made-up file with an app code (`P-01`), added in the 2026-11-17 change below.

Checked here on 2026-11-17: the fixture passes `cmai_export_check.py` and validates against the schema (the schema itself is valid draft 2020-12, checked with the `jsonschema` package).

## Decision (assumed, reversible)

File the contract as register row F-56. Build nothing. The contract is not changed in this PR; every mismatch below is for Dr. Gupta and Devin to settle before an "Export for research" action is built.

## Mismatches with the app's real data model

Checked against `src/data/db.ts` (database version 4), `src/data/exporter.ts` and `src/data/seed.ts` at v0.3.0. The four open points the proposal named come first.

| Proposal assumes                                  | What the app has                                                                                                              | Effect on the contract                                                                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| End time may be missing                           | `endedAt` exists, optional, set only by "It stopped" (F-39, lab build) for three behaviors                                    | Fits: `occurred_end_utc` is null for every other log                                                                                     |
| Per-record `frequency` and `rating_scale`         | None. A log is one occurrence. Ratings are worked out per 14-day period per behavior, never per log                           | Fits only as `frequency: null`, `rating_scale: "none"` on every record. The `cmai_freq_1_7` branch can never be written by the app today |
| `reviewed` (a second person checked it)           | No such flag on a log. The `reviews` table holds legacy day-14 choices (D-14), per period and behavior, and no score reads it | Fits only as always `false`. Do not map the legacy `reviews` table to it                                                                 |
| Several items in one entry become several records | One log is already one item (`itemId`)                                                                                        | Fits. Each log's `uid` is the `record_id`                                                                                                |

Found by reading the code, not named in the proposal:

| #   | Proposal assumes                                                                   | What the app has                                                                                                                               | Effect                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `participant_id` matches `^[A-Z]{2,5}-[A-Z0-9]{1,12}$`; synthetic IDs start `SYN-` | Codes are `P-01`, `P-02`… (data management plan) and demo patients are `P-DEMO-A`. Both fail the pattern (confirmed: the checker rejects both) | **Blocks.** Either the pattern allows one letter, or the app maps codes at export. Decide with the code-and-key standard (P-04)                                                                                                                            |
| 2   | `data_class` is known                                                              | Only `Patient.demo` exists. Nothing says "real"                                                                                                | Export needs a rule, for example `demo` means synthetic. And `SYN-` vs `P-DEMO-` must agree (item 1)                                                                                                                                                       |
| 3   | `tz_name` (IANA) on every record                                                   | Only `tzOffsetMin` per log (D-22). Logs from before database version 4 have none                                                               | The zone name is not stored. Writing the phone's current zone at export time is wrong for a phone that moved. The checker rejects an offset that does not match the zone at that moment. Needs a stored zone name (a database change) or a contract change |
| 4   | `logger_role` is caregiver, staff or researcher                                    | App stores `by` (a caregiver code), empty in the caregiver build. No role                                                                      | Role is always "caregiver" or must be added                                                                                                                                                                                                                |
| 5   | `device_id` on every record                                                        | `deviceId` is stamped from database version 4; older logs have none                                                                            | Older logs cannot be exported as they are                                                                                                                                                                                                                  |
| 6   | `revision` and `revised_at_utc`                                                    | `changes` table records each edit, delete and restore with a time                                                                              | Derivable: revision = 1 + number of changes. A restore after a delete becomes a normal revision with `status: "active"`                                                                                                                                    |
| 7   | Deleted record is a tombstone                                                      | App keeps `deletedAt`, a reason from a pick list and an optional note                                                                          | Fits. Reason and note stay out of the file (the contract allows no free text)                                                                                                                                                                              |
| 8   | Nothing about approximate times                                                    | `approx` (caregiver marked the time approximate)                                                                                               | **Lost.** A back-dated log would look exact to the sensor team. Adds a field, so a MINOR bump (1.1.0)                                                                                                                                                      |
| 9   | Only behaviors                                                                     | Format 2 `labels.csv` also carries "watched" and "unobserved" stretches (D-23, F-38)                                                           | **Gap.** Without them the pipeline cannot tell calm from nobody there. Adds a table, so a MINOR bump                                                                                                                                                       |
| 10  | "What happened just before" not mentioned                                          | `before` is a pick list (F-41) and Devin told the lab the app has antecedent tokens                                                            | Pick-list values carry no wording and no names; whether they go in is Dr. Gupta's call. Not a contract field today                                                                                                                                         |
| 11  | `app_version` semver                                                               | `__APP_VERSION__` is the `package.json` version (`0.3.0`)                                                                                      | Fits                                                                                                                                                                                                                                                       |
| 12  | `schema_version` is semver text                                                    | App's `BACKUP_FORMAT` and `CSV_FORMAT` are whole numbers (2)                                                                                   | Different things. The contract version must not reuse them                                                                                                                                                                                                 |

## Acceptance criteria (from the proposal's "Done when")

For the later build PR, not this one:

1. An app export of made-up data passes the schema and `cmai_export_check.py`.
2. An edit and a delete, exported again, merge to the right result.
3. The pipeline build shows the rows in `events` with correct UTC times.

For this PR:

- [x] Fixture passes `cmai_export_check.py` and validates against the schema.
- [x] Register row F-56 filed, marked assumed, sign-off pending.
- [x] Mismatches written down; contract unchanged.
- [x] Made-up data only. Item numbers only, no item wording.

## Left out

- The export action, any code, any switch in `src/study/settings.ts`.
- Changing the contract to fit the app. That is a decision for Dr. Gupta and Devin once the mismatches are read.
- Real participant data. Where real exports may live waits on Dr. Gupta in writing (P-03, P-04).
- Pipeline side (`sensorlab import-cmai`). Lives in the lab's pipeline project.
