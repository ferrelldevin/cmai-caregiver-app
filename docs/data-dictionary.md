# Data dictionary: CMAI Tracker exports

Draft, 2026-11-10. Build plan step 3.4. Part 1 describes the three export files exactly as `main` at `b753f6f` writes them (`src/data/exporter.ts`, `src/data/db.ts`). Part 2 is the assumed design for format 2, which changes the exports and so is lane B: **assumed, sign-off pending** (D-22, D-23 *proposed*). Nothing here changes the app.

Every example below is made-up demo data, made by running the real export code on a demo patient in New York time (UTC−4 in October 2026).

## How to read times

- **JSON:** every time is a whole number of milliseconds since 1970-01-01 00:00 UTC (JavaScript epoch ms). Example: `1791234000000` is 2026-10-05 21:00:00 UTC, 5:00 pm in New York.
- **CSV:** every time is ISO 8601 in UTC, always ending in `Z`, with milliseconds. Example: `2026-10-05T21:00:00.000Z`.
- **The local time zone is not stored anywhere.** Days and 14-day periods are worked out on the phone in its own time zone (`localMidnight` and `addDays` in `src/scoring/engine.ts`). From the file alone you cannot tell which local day a log fell on unless you know the phone's zone (audit A-08, A-14; register D-22). Format 2 fixes this.
- **Day 1** of a patient is the local midnight of the day the patient was added, on the phone that added them (`anchor`).

## Part 1. Format 1 (today)

### Files

| File | Made by | What it is |
|---|---|---|
| `cmai-backup-<date>.json` | Data tab (Settings once PR #41 merges), Backup and export, **Download backup** | Everything on the phone. The only file that can be restored |
| `cmai-observations-<date>.csv` | Same page, **Logs CSV** | One row per log, deleted logs included |
| `cmai-scores-<date>.csv` | Same page, **Scores CSV** | One row per patient, period and behavior: the app's rating from live logs |

`<date>` is the **UTC** date of the export (`toISOString().slice(0, 10)` in `src/ui/DataScreen.tsx:129`), so an export made after 8 pm in New York in summer carries the next day's date.

All three files are UTF-8 with no byte-order mark. CSV rows end in `\n`. A CSV value is wrapped in double quotes only if it contains `"`, `,` or a line break, and a `"` inside is doubled. Inference, not tested: Excel on Windows may show accented letters in notes wrongly because there is no byte-order mark.

**Known problem, fix planned:** a note that begins with `=`, `+`, `-` or `@` is written as typed, and a spreadsheet may run it as a formula (audit A-07). After plan step 1.6 (F-34, *proposed*), such a cell starts with an apostrophe `'`. A leading `'` in a note column then means the note began with one of those characters; remove it to get the caregiver's text.

### `cmai-observations-<date>.csv`

Rows are in the order the logs were saved on the phone. Deleted logs are included and marked.

| Column | Type | Allowed values | Meaning | Example |
|---|---|---|---|---|
| `patient_id` | text | 2 to 12 characters, capitals, digits, `-`, when typed in the app (`src/ui/DataScreen.tsx:93`). A restored backup is not checked yet (A-03, plan 1.2). Demo patients start `P-DEMO-` | The resident's code. Never a name | `P-DEMO-A` |
| `item_id` | whole number | 1 to 29 | The behavior's number on the CMAI long form (manual p.22 to 23). Full list below | `13` |
| `item_name` | text | The 29 names below | The app's short name for the behavior | `Screaming` |
| `occurred_at` | time, UTC | | When the behavior happened, as the caregiver entered it | `2026-10-05T21:00:00.000Z` |
| `time_approximate` | `true` / `false` | | `true` when the caregiver marked the time as approximate (back-dated logs, F-03) | `false` |
| `what_happened_before` | text, may be empty | One of the 8 choices below, or empty | What the caregiver saw just before | `Personal care or bathing` |
| `before_note` | text, may be empty | Up to 120 characters. Only when `what_happened_before` is `Other` | A few words. Caregivers are told not to type names | `fire alarm test` |
| `logged_at` | time, UTC | | When the log was saved. Later than `occurred_at` for a back-dated log | `2026-10-05T21:00:20.000Z` |
| `deleted_at` | time, UTC, may be empty | | When the log was deleted. Empty for a live log | `2026-10-06T15:30:00.000Z` |
| `delete_reason` | text, may be empty | One of the 6 reasons below | Why it was deleted | `Wrong patient` |
| `delete_note` | text, may be empty | Up to 120 characters. Only when the reason is `Other` | A few words | |

Example (three rows, made-up):

```csv
patient_id,item_id,item_name,occurred_at,time_approximate,what_happened_before,before_note,logged_at,deleted_at,delete_reason,delete_note
P-DEMO-A,13,Screaming,2026-10-05T21:00:00.000Z,false,,,2026-10-05T21:00:20.000Z,,,
P-DEMO-A,1,"Pacing, aimless wandering",2026-10-05T19:45:00.000Z,true,Other,fire alarm test,2026-10-05T20:00:00.000Z,,,
P-DEMO-A,7,Hitting (including self),2026-10-06T13:00:00.000Z,false,Personal care or bathing,,2026-10-06T13:00:00.000Z,2026-10-06T15:30:00.000Z,Wrong patient,
```

**Analysis rule:** count only rows where `deleted_at` is empty. That is what the app's ratings count (`isLive` in `src/data/db.ts`).

### `cmai-scores-<date>.csv`

Worked out fresh at every export from the live logs (`scoreAllWindows` in `src/scoring/engine.ts`). For each patient: every 14-day period from day 1 up to the one that contains the export time, and 29 rows per period, one per behavior, including behaviors never logged.

| Column | Type | Allowed values | Meaning | Example |
|---|---|---|---|---|
| `patient_id` | text | as above | | `P-DEMO-A` |
| `window_start` | time, UTC | | Local midnight that starts the period | `2026-10-05T04:00:00.000Z` |
| `window_end` | time, UTC | | Local midnight 14 calendar days later. The period runs up to, not including, this moment | `2026-10-19T04:00:00.000Z` |
| `provisional` | `true` / `false` | | `true` when the period had not ended at the export time. Its rating can still change | `true` |
| `item_id` | whole number | 1 to 29 | | `1` |
| `item_name` | text | | | `Pacing, aimless wandering` |
| `count` | whole number | 0 or more | Live logs of this behavior in the period | `1` |
| `derived_rating` | whole number | 1 to 7 | The app's rating under `rule_version` (scoring spec sections 2 and 3). Never 8 or 9 | `2` |
| `unlogged_days` | whole number | 0 to 14 | Finished days in the period with no live log and no "Nothing to log today" check-in, for this patient. Same on all 29 rows of a period. Unknown days, not quiet days (D-11) | `1` |
| `rule_version` | text | `cmai-count-rule-2` today | The scoring rule that produced `derived_rating` | `cmai-count-rule-2` |

Two things to know before analysis:

- **A period starts and ends at local midnight**, so its length in hours is 14 × 24 except across a daylight-saving change (336 ± 1 hours). Spec section 7.
- **A finished period's rating can still change** if a log in it is edited or deleted within 24 hours of being made, and two exports of the same period can then differ (audit A-10, register D-21). Use the latest export, or the first export made more than 24 hours after `window_end`. **Assumed, sign-off pending** (D-21): a period is final 24 hours after it ends.

### `cmai-backup-<date>.json`

One object with these keys. Arrays are in the phone's storage order.

| Key | Type | Meaning |
|---|---|---|
| `exportedAt` | text, ISO time UTC | When the file was made |
| `ruleVersion` | text | The rule in the app that made the file. Ratings are not stored in the backup; they are recomputed |
| `patients` | array of Patient | |
| `observations` | array of Log | Deleted logs included |
| `reviews` | array of Review | Old day-14 review choices, kept but never used for ratings (D-14). Empty on any phone set up after 2026-10-27 |
| `checkins` | array of Check-in | "Nothing to log today" taps |
| `changes` | array of Change | Every edit, delete and undo of a delete |

Not in the file: which app version made it, a format version, the phone's time zone. PR #38 adds `appVersion` and `build`; format 2 adds the rest.

**Patient**

| Key | Type | Meaning | Example |
|---|---|---|---|
| `id` | text | The code, unique on the phone | `"P-DEMO-A"` |
| `anchor` | epoch ms | Local midnight of day 1 on the phone that added the patient. Periods count from here | `1791172800000` |
| `demo` | `true`, or missing | Present only on patients made by "Load demo data" | `true` |

**Log** (`observations`)

| Key | Type | Meaning |
|---|---|---|
| `id` | whole number | The phone's own number for the log. Not stable: a restore on another phone gives new numbers. Do not use it to match logs across files; use `patientId`, `itemId`, `at` and `loggedAt` together, as restore does (`src/data/manage.ts`) |
| `patientId` | text | |
| `itemId` | whole number, 1 to 29 | |
| `at` | epoch ms | When it happened |
| `loggedAt` | epoch ms | When it was saved |
| `approx` | `true`, or missing | Time marked approximate |
| `before` | text, or missing | One of the 8 choices below |
| `beforeNote` | text, or missing | Up to 120 characters, only with `before: "Other"` |
| `deletedAt` | epoch ms, or missing | Present only on a deleted log |
| `deleteReason` | text, or missing | One of the 6 reasons below |
| `deleteNote` | text, or missing | Up to 120 characters, only with reason `Other` |

A missing key and an empty CSV cell mean the same thing: not recorded.

**Check-in**

| Key | Type | Meaning | Example |
|---|---|---|---|
| `key` | text | `<patientId>|<day>`, so there is at most one per patient per day | `"P-DEMO-A|1791345600000"` |
| `patientId` | text | | `"P-DEMO-A"` |
| `day` | epoch ms | Local midnight of the day it covers | `1791345600000` |
| `at` | epoch ms | When it was tapped | `1791417600000` |

**Change** (`changes`)

| Key | Type | Meaning |
|---|---|---|
| `id` | whole number | The phone's own number. Not stable across phones |
| `observationId` | whole number | The `id` of the log it changed, in the same file |
| `patientId` | text | |
| `action` | `edit`, `delete` or `restore` | `restore` is the undo of a delete |
| `at` | epoch ms | When the change was made |
| `from` | object, or missing | The fields as they were, only those that changed |
| `to` | object, or missing | The fields as they became |

Edits to the same log less than 5 minutes apart are merged into one entry with the first `from` and the latest `to` (`EDIT_MERGE_MS` in `src/data/logs.ts`). Not recorded: who made the change (R2, plan step 5.1).

Example (made-up): a log's time moved 15 minutes later, and another log deleted.

```json
"changes": [
  { "observationId": 2, "patientId": "P-DEMO-A", "action": "edit", "at": 1791298800000,
    "from": { "at": 1791228600000 }, "to": { "at": 1791229500000 }, "id": 1 },
  { "observationId": 3, "patientId": "P-DEMO-A", "action": "delete", "at": 1791300600000,
    "to": { "deletedAt": 1791300600000, "deleteReason": "Wrong patient" }, "id": 2 }
]
```

**Review** (old, never read for ratings)

| Key | Type | Meaning |
|---|---|---|
| `key` | text | `<patientId>|<windowStart>|<itemId>` |
| `patientId`, `windowStart`, `itemId` | text, epoch ms, 1 to 29 | Which period and behavior |
| `choice` | whole number | 1 to 7, or 8 (would occur if not prevented) or 9 (not applicable), manual p.3, p.5, p.24 |
| `derived` | whole number | What the app's rating was at the time |
| `reviewedAt` | epoch ms | |

### Pick lists

**What happened before** (`before`, `what_happened_before`; `BEFORE_OPTIONS` in `src/ui/LogSheet.tsx:17`): `Personal care or bathing`, `Mealtime`, `Noise or crowding`, `Seemed in pain`, `Change in routine`, `Visitor or phone call`, `Nothing noticed`, `Other`.

**Delete reasons** (`deleteReason`, `delete_reason`; `src/data/logs.ts:8-10`): `Tapped by mistake`, `Wrong behavior`, `Wrong patient`, `Logged twice`, `Other`, and `Undone right after logging`, which the app records itself when Undo is tapped on the confirmation.

**Behaviors** (`item_id`, `item_name`; `src/scoring/items.ts`). Group is the nursing-home factor from manual p.7: aggressive (factor 1), physical = physically nonaggressive (factor 2), verbal = verbally agitated (factor 3), other = on the form but in no factor. Page is where the manual defines it.

| ID | Name | Group | Manual page |
|---|---|---|---|
| 1 | Pacing, aimless wandering | physical | 12 |
| 2 | Inappropriate dressing or disrobing | physical | 12 |
| 3 | Spitting | aggressive | 12 |
| 4 | Cursing or verbal aggression | aggressive | 12 |
| 5 | Constant unwarranted request for attention or help | verbal | 12 |
| 6 | Repetitive sentences or questions | verbal | 12 |
| 7 | Hitting (including self) | aggressive | 12 |
| 8 | Kicking | aggressive | 12 |
| 9 | Grabbing onto people or things | aggressive | 12 |
| 10 | Pushing | aggressive | 12 |
| 11 | Throwing things | other | 12 |
| 12 | Making strange noises | other | 12 |
| 13 | Screaming | verbal | 12 |
| 14 | Biting | aggressive | 12 |
| 15 | Scratching | aggressive | 12 |
| 16 | Trying to get to a different place | physical | 12 |
| 17 | Intentional falling | other | 13 |
| 18 | Complaining | verbal | 13 |
| 19 | Negativism | verbal | 13 |
| 20 | Eating or drinking inappropriate substances | other | 13 |
| 21 | Hurting self or other | other | 13 |
| 22 | Handling things inappropriately | physical | 13 |
| 23 | Hiding things | other | 13 |
| 24 | Hoarding things | other | 13 |
| 25 | Tearing things or destroying property | aggressive | 13 |
| 26 | Repetitious mannerisms | physical | 13 |
| 27 | Verbal sexual advances | other | 13 |
| 28 | Physical sexual advances or exposing genitals | other | 13 |
| 29 | General restlessness | physical | 13 |

Item names are adapted from the CMAI (© 1991 Cohen-Mansfield) and are not under the app's MIT license; see `NOTICE`.

## Part 2. Format 2 (assumed design, lane B)

**Assumed, sign-off pending** (D-23 export format 2, D-22 time zone, F-44 database version 4, F-38 watching hours, F-47 blind day-14 CMAI; all *proposed*). This follows build plan v5 steps 5.1 (database version 4) and 5.10 (export format 2). The code belongs to those build steps; this part is the reference they must match. Each item is behind a study setting and switched off until Dr. Gupta's mark.

Rules for format 2:

- Every file names its format version and the app version.
- Every time is given twice: UTC, and local with its offset.
- Format 1 columns keep their names and order. New columns are added at the end, so a script that reads format 1 by column name still works.
- Format 1 backups still restore.
- Every CSV cell goes through the safe-cell rule from plan step 1.6 (a leading `'` before `=`, `+`, `-`, `@`).

### New keys in the backup (database version 4)

All optional, so a version 3 record is still valid.

| Where | Key | Type | Meaning | Example |
|---|---|---|---|---|
| top level | `schemaVersion` | whole number | `2`. A file without it is format 1 | `2` |
| top level | `appVersion`, `build` | text | Which app made the file (PR #38 adds these) | `"0.3.0"` |
| Log | `uid` | text | ID unique across phones (`crypto.randomUUID()`). Version 3 logs get one at upgrade. Use this, not `id`, to match logs across files | `"3f0c…"` |
| Log | `deviceId` | text | Which phone made it | `"d-7a1e…"` |
| Log | `by` | text | Caregiver code, never a name. Empty before caregiver profiles exist | `"C-02"` |
| Log | `tzOffsetMin` | whole number | Minutes from UTC on the phone when logged. New York in October is `-240`, in January `-300` | `-240` |
| Log | `endedAt` | epoch ms | When the behavior stopped, if the caregiver said (F-39) | |
| Check-in, Change | `by`, `deviceId` | text | As above | |
| Patient | `archivedAt`, `archiveReason`, `archiveNote` | epoch ms, text, text | Archived instead of erased (D-20) | |
| Patient | `color` | whole number | Index into the resident color list | `2` |
| new `caregivers` | `id`, `initials`, `createdAt`, `archivedAt` | text, 2 or 3 letters, epoch ms, epoch ms | Caregiver profiles. **PIN fields are never written to a backup** | `{"id":"C-02","initials":"JD"}` |
| new `assignments` | `caregiverId`, `patientId`, `order`, `at` | | "My residents" order. An order, not a lock | |
| new `watches` | `uid`, `patientId`, `by`, `deviceId`, `start`, `end`, `startSource`, `endSource`, `tzOffsetMin` | | Watching hours (F-38). `startSource`: `tap` or `log`. `endSource`: `tap`, `switch`, `signout` or `timeout` (D-25) | |
| new `caregiverRatings` | `uid`, `patientId`, `windowStart`, `by`, `deviceId`, `answers`, `startedAt`, `submittedAt`, `ruleVersion` | | Blind day-14 CMAI (F-47). `answers` maps item 1 to 29 to a choice 1 to 9 | |

### CSV changes

**`observations.csv`** gains, at the end: `uid`, `device_id`, `caregiver`, `occurred_at_local`, `utc_offset_min`, `ended_at`, `schema_version`, `app_version`.

```csv
patient_id,item_id,item_name,occurred_at,time_approximate,what_happened_before,before_note,logged_at,deleted_at,delete_reason,delete_note,uid,device_id,caregiver,occurred_at_local,utc_offset_min,ended_at,schema_version,app_version
P-DEMO-A,13,Screaming,2026-10-05T21:00:00.000Z,false,,,2026-10-05T21:00:20.000Z,,,,3f0c2a9e-demo,d-demo-1,C-02,2026-10-05T17:00:00.000-04:00,-240,,2,0.3.0
```

**`scores.csv`** gains, at the end: `schema_version`, `app_version`, `exported_at`, `period_final` (`true` when the period ended more than 24 hours before the export, D-21; recorded, not enforced), `watched_minutes` (from watching hours; empty when the setting is off).

**New files:**

| File | One row per | Columns |
|---|---|---|
| `watches.csv` | watch | `uid`, `patient_id`, `caregiver`, `start`, `end`, `start_source`, `end_source`, `utc_offset_min` |
| `caregiver_ratings.csv` | item per day-14 submission | the caregiver's choice, the app's rating for the same item and period beside it, and `within_one_point` |
| `labels.csv` | interval for one resident, in time order | `kind` is `behavior` (with `item_id`, `start`, `end` or empty, `time_approximate`), `watched` (someone was there and logged nothing) or `unobserved`. The file for the sensor work: take "calm" from `watched` rows only |

Logs saved before the upgrade have no offset. The upgrade does not guess one: the cell stays empty and analysis treats the local day as unknown for those rows, unless the lab recorded each phone's zone at setup.

**Free-text columns** (`before_note`, `delete_note`): marked "check before sharing" (P-11). A caregiver may have typed a name despite the "no names" hint.

## Freezing the format

Before the first real participant (Stage 6), the lab freezes one `schemaVersion`. Any change after that gets a new version number, a row in the register's decision log, and an update to this file in the same pull request.
