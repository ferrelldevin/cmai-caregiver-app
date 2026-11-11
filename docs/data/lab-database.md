# Lab database: a transfer-ready frame

Draft, 2026-11-10. Prepared by Claude (cloud thread) for Devin, acting build lead. Not approved. Register question **P-13 (proposed): which database does the lab keep study data in?** Lines marked **assumed** follow the recommended answer and need Dr. Gupta's sign-off.

## The answer in short

- The lab has not said which database it uses. So the frame is written in plain SQL that runs **unchanged** on both SQLite and PostgreSQL, the two most likely homes (a single file on a lab computer, or a university-run server).
- `docs/data/lab-schema.sql` is the schema: 18 tables and one view.
- `scripts/backup-to-sql.mjs` turns a backup file from the app (and its scores CSV) into SQL that loads into that schema.
- Checked on 2026-11-10, with made-up demo data only:
  - SQLite 3.53: 8 automated checks in `tests/backupToSql.test.ts`, run with the rest of the test suite.
  - PostgreSQL 16, by hand: the schema loaded twice without error, a full demo backup (2 patients, 626 logs) loaded twice and still gave 626 logs, and 232 score rows loaded.
- Moving later is a copy, not a rebuild. The tables, keys and values stay the same in either database. Section 5 covers REDCap, which is a different shape.

## 1. Rules the frame follows, and why

| Rule | Why it makes a transfer easy |
|---|---|
| Times are whole milliseconds since 1970 UTC (`*_ms`, BIGINT), exactly as the app stores them, with the phone's UTC offset beside them when known (`utc_offset_min`) | Nothing is rounded or shifted on the way in, and every database and stats tool can read a number. Format 1 has no offset; format 2 adds it (data dictionary, part 2) |
| Every row from a phone has a key unique across phones (`observation_uid`, `watch_uid`, and so on) | Files from several phones, or the same file twice, merge with no duplicates. Format 2 phones make the uid. For a format 1 log the importer makes `v1-` + SHA-256 of patient, item, time and logged time, the same four fields the app's own restore uses to spot a duplicate |
| Every insert is "add if not already there" (`ON CONFLICT … DO NOTHING`) | Re-importing a file is safe. Both databases support this form: PostgreSQL since 9.5, SQLite since 3.24 (tested on both, above) |
| Every file loaded gets a row in `import_batch` (file hash, app version, rule version, export time, who imported it) | Every row can be traced to the file it came from |
| Nothing is deleted. A deleted log keeps its row with when and why; `live_observation` is the view of what still counts | Matches the app (D-14) and keeps the audit trail |
| Ratings are stored as computed, with `rule_version`, never typed | Any score can be re-checked against the logs |
| A second start day for an existing code goes to `patient_anchor_conflict`, not over the first | Nobody's data is silently changed (D-19) |
| Rows that break a rule (a name in the code field, an unknown behavior, a note over 120 characters) are left out and counted, not guessed at | Bad data does not get in quietly; the importer prints what it left out |
| No names, rooms or birth dates, and no code key table | The key that links codes to people stays apart (data management plan, section 3) |

## 2. Tables

| Table | One row per | Key | Filled from |
|---|---|---|---|
| `schema_info` | setting (schema version) | `key` | importer |
| `cmai_item` | CMAI behavior (29) | `item_id` 1 to 29 | `src/scoring/items.ts` |
| `before_option`, `delete_reason` | pick-list choice | `label` | app pick lists (a test checks they match) |
| `import_batch` | file loaded | `batch_id` (SHA-256 of the file) | importer |
| `device` | phone | `device_id` | format 2 `deviceId`; format 1 gets `v1-<file hash>` |
| `patient` | resident code | `patient_code` | `patients` |
| `patient_anchor_conflict` | different start day seen for a code | code + day | importer (D-19) |
| `caregiver` | caregiver code (no PIN, ever) | `caregiver_code` | format 2 `caregivers` |
| `assignment` | caregiver on a resident | caregiver + patient | format 2 `assignments` |
| `observation` | logged behavior, deleted ones included | `observation_uid` | `observations` |
| `observation_change` | edit, delete or undo | `change_uid` | `changes` |
| `checkin` | "nothing to log today" tap | patient + day | `checkins` |
| `watch` | watching period | `watch_uid` | format 2 `watches` (F-38) |
| `caregiver_rating` + `caregiver_rating_answer` | caregiver's own rating, one answer per behavior | `rating_uid` (+ item) | format 2 `caregiverRatings` (F-47) |
| `legacy_review` | old reviewed rating | `review_key` | `reviews` |
| `period_score` | computed rating per patient, period, behavior and rule version | patient + window + item + rule + computed time | `scores.csv` |
| view `live_observation` | log that still counts | | `observation` where not deleted |

## 3. Mapping from the app

Phone storage today is IndexedDB through Dexie, database `cmai-tracker`, version 3 (`src/data/db.ts`). Field-by-field detail for each store is in `docs/data-dictionary.md`.

| App store (Dexie) | Backup key, format 1 | Format 2 adds | Lab table |
|---|---|---|---|
| `patients` | `patients` | color, archive fields | `patient` |
| `observations` | `observations` | `uid`, `deviceId`, `by`, `tzOffsetMin`, `endedAt` | `observation` |
| `changes` | `changes` | `by`, `deviceId` | `observation_change` |
| `checkins` | `checkins` | `by`, `deviceId` | `checkin` |
| `reviews` | `reviews` | | `legacy_review` |
| (planned) `caregivers` | | `caregivers` | `caregiver` |
| (planned) `assignments` | | `assignments` | `assignment` |
| (planned) `watches` | | `watches` | `watch` |
| (planned) `caregiverRatings` | | `caregiverRatings` | `caregiver_rating`, `caregiver_rating_answer` |
| computed | `scores.csv` | `watched_minutes`, `unlogged_days` | `period_score` |

Format 2 does not exist in the app yet (build plan v5, steps 5.1 and 5.10). The importer already reads it, and one test loads a made-up format 2 file, so the format and the lab tables can be built to the same spec.

## 4. How to load a backup

```sh
# 1. Make the database once (SQLite shown; for PostgreSQL use psql -f)
sqlite3 lab.db < docs/data/lab-schema.sql
# 2. Turn a backup (and, if wanted, its scores CSV) into SQL, then load it
node scripts/backup-to-sql.mjs cmai-backup-2026-11-10.json cmai-scores-2026-11-10.csv > import.sql
sqlite3 lab.db < import.sql
```

The importer prints how many rows it wrote and what it left out. Running it again on the same file adds nothing. It reads only the file you give it and sends nothing anywhere. **Assumed** (P-04): this runs on a lab or ODU-managed computer, on a backup that has already been stored in the approved place, never on a personal machine.

## 5. Moving to the lab's own system

| Where the data goes | What moving takes | **Assumed** pick |
|---|---|---|
| A. One SQLite file on a lab computer or ODU-managed storage | Nothing more; this is the start | **Start here** (P-13, assumed, sign-off pending) |
| B. An ODU-managed PostgreSQL server | Run the schema on the server, then load the same `import.sql` files, or copy each table over. Same tables and keys | Move when the lab gets a server; the frame is ready |
| C. REDCap | Different shape. REDCap holds one record per study ID, with repeating instruments for repeated entries ([REDCap](https://projectredcap.org/)). The likely mapping, an inference not yet built: `patient` → record, `observation` → a repeating instrument, `period_score` → one instrument per period. Times would need to become REDCap date-time fields | Only if Dr. Gupta prefers it. Whether ODU offers REDCap is not checked |
| D. Something else the lab already uses | Unknown until named | Ask (P-13) |

Why SQLite first: it is one file, needs no server or account, and the lab can open it with free tools. That fits "no accounts or servers the lab has not provided". The same SQL moves to a server unchanged.

## 6. Open, in the register

- **P-13 (proposed):** which database the lab keeps study data in (A to D above). **Assumed:** A now, B later.
- **P-04:** where the backup and the database file are kept, and who holds the code key.
- **D-19:** what to do when the same code arrives with two start days. The frame keeps both and flags it.

Sources: `src/data/db.ts`, `src/data/exporter.ts`, `docs/data-dictionary.md` and build plan v5, all read on 2026-11-10. SQLite and PostgreSQL support for `ON CONFLICT DO NOTHING` was checked by running the schema and the import on both. The REDCap description is from the project's public page and is not ODU-specific. AI was used to draft this page and the code.
