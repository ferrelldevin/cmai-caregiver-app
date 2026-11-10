# 013. Export format 2 and the label file

2026-11-10 · Register: D-23, D-21, D-22, F-34 · Status: built on assumed approval (Devin, 2026-11-10), sign-off pending · Switch: `exportV2` (lab build only) · Build plan v5, step 5.10 · Reference: `docs/data-dictionary.md` part 2 (draft PR #46, plan 3.4)

## Problem
The logs are labels for the lab's sensor work, but format 1 cannot say which local day a log fell on (A-08, A-14, D-22), has no ID that survives merging phones, and has no way to tell "calm" from "nobody was there".

## Decision (assumed answers, each reversible)
- **A switch.** The plan lists no switch for 5.10. Because format 2 changes what leaves the phone, it is behind `exportV2`, off in the caregiver build, so the caregiver build's CSVs stay exactly format 1 (a unit test checks the headers). This is a deviation from the plan, recorded here and in the register.
- **Format 1 columns first, unchanged.** New columns are added at the end, so a script that reads format 1 by column name keeps working (unit test).
- **Every time twice.** UTC (`...Z`) and local with its offset (`2026-10-05T17:00:00.000-04:00`). Logs saved before database version 4 have no offset; their local cells stay empty. Nothing is guessed.
- **Ratings as they stand.** `period_final` is `true` when the period ended more than 24 hours before the export (D-21). It is recorded, not enforced: no data changes at 24 hours.
- **Safe cells.** Every CSV cell that starts with `=`, `+`, `-`, `@`, a tab or a return gets a leading `'`, so a spreadsheet shows it as text (OWASP, CSV injection). This is plan step 1.6 (F-34), built here because 5.10 needs it; whichever lands second takes the other's function. It applies to format 1 too.

## New columns and files
Types: text, whole number, true/false, UTC time (`ISO 8601 ...Z`), local time (`ISO 8601` with offset). Every example is made up.

| File | Column | Type, unit | Allowed values | Example |
|---|---|---|---|---|
| observations.csv | `uid` | text | UUID; empty for a log not yet given one | `3f0c2a9e-…` |
| | `device_id` | text | UUID of the phone | `8c6284ca-…` |
| | `caregiver` | text | `C-01` to `C-999`; empty before caregiver profiles | `C-02` |
| | `occurred_at_local` | local time | empty when the offset is unknown | `2026-10-05T17:00:00.000-04:00` |
| | `utc_offset_min` | whole number, minutes | −720 to 840; empty when unknown | `-240` |
| | `ended_at` | UTC time | empty unless the caregiver tapped "it stopped" (F-39) | |
| | `schema_version`, `app_version` | whole number, text | `2`; the app's version | `2`, `0.3.0` |
| scores.csv | `schema_version`, `app_version` | as above | | |
| | `exported_at` | UTC time | | `2026-10-20T12:00:00.000Z` |
| | `period_final` | true/false | true 24 hours after the period ends (D-21) | `true` |
| | `watched_minutes` | whole number, minutes | empty when watching hours are off | `310` |
| watches.csv | `uid`, `patient_id`, `caregiver` | text | | |
| | `start`, `end` | UTC time | `end` empty while still open | |
| | `start_source` | text | `tap`, `log` (D-25) | `tap` |
| | `end_source` | text | `tap`, `switch`, `signout`, `timeout`; empty while open | `switch` |
| | `utc_offset_min`, `start_local` | as above | | |
| caregiver_ratings.csv | `uid`, `patient_id`, `caregiver`, `window_start`, `submitted_at` | | one row per behavior per submitted rating; unfinished ratings stay in the backup only | |
| | `item_id`, `item_name` | whole number, text | 1 to 29 | `7`, `Hitting` |
| | `caregiver_choice` | whole number | 1 to 7, 8 (if not prevented), 9 (not applicable) | `4` |
| | `app_rating` | whole number | 1 to 7, the app's rating for the same item and period, from live logs at export | `5` |
| | `within_one_point` | true/false | false for 8 and 9 (manual p.7) | `true` |
| | `rule_version`, `schema_version`, `app_version` | text, whole number, text | | |
| labels.csv | `patient_id` | text | | `P-01` |
| | `kind` | text | `behavior`, `watched`, `unobserved` | `watched` |
| | `item_id`, `item_name` | | behavior rows only | |
| | `start`, `end` | UTC time | `end` empty for a behavior with no "it stopped" | |
| | `time_approximate` | true/false | behavior rows only | `false` |
| | `caregiver`, `start_local`, `utc_offset_min` | | behavior rows only | |
| | `schema_version`, `app_version` | | | |

**labels.csv rules.** For each resident, from day 1 to the export, every local day is covered exactly by `watched` and `unobserved` rows, which never overlap: two caregivers watching at once count once, and a watch over midnight is split at midnight. Each live log is a `behavior` row inside them. Rows are in time order. A resident with no watches has only `unobserved` rows. Take "calm" from `watched` rows only (unit tests).

## Not yet done
- `docs/data-dictionary.md` gets this table when #46 merges (the dictionary lives there).
- A backup and its CSVs from the demo data go in the pull request description, not the repo, when the PR opens.
