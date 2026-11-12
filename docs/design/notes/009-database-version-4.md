# 009. Database version 4: IDs that travel, who and where, archive instead of erase

2026-11-10 · Register: F-44, D-20, D-22, R2 · Status: built on assumed approval (Devin, 2026-11-10), sign-off pending · Build plan v5, step 5.1

## Problem

Every lane B step needs stored fields: who made a record (R2), when a caregiver was watching (F-38), a caregiver's own rating (F-47), PIN fields (R1). Each database change is an upgrade a phone cannot take back, so the plan puts all of them in one version (plan 1.3, rule 2). Three gaps exist today regardless of lane B:

- A log has no ID that is unique across phones. Restore matches logs by patient, behavior and time, which works for one phone but not for merging two.
- A log does not say what the phone's clock offset was (D-22). After a trip or a clock change, its local time cannot be rebuilt.
- Deleting a patient erases every log for good. For a study that is the wrong default once real logs exist (D-20).

## Options

1. **One version per feature.** Each step adds what it needs. Phones upgrade five times, and a revert of any one is harder.
2. **One version 4 with every field and table the plan names, mostly empty until a step uses it.** One upgrade, one restore format, one place to review. Costs some empty tables for a while.

## Decision (assumed answers, each reversible by Devin or Dr. Gupta)

Option 2.

- **IDs.** Every log gets `uid` (`crypto.randomUUID()`), at upgrade for old logs and when any new log is added. The database refuses two logs with the same `uid`.
- **This phone.** `meta.deviceId` is set once, at upgrade or on a fresh install. New logs, check-ins and change-history entries carry `deviceId`.
- **Clock offset (D-22).** New logs carry `tzOffsetMin`, minutes from UTC as a clock reads (New York in winter is `-300`). Old logs are left empty: nobody knows the offset they were made under, and a guess would look like data.
- **Who (R2).** `by` exists on logs, check-ins, changes, watches and ratings. It stays empty until caregiver profiles (plan 5.2).
- **Archive, not erase (D-20).** With the `archivePatients` switch on (lab build), deleting a patient who has at least one log, and is not a demo patient, archives them instead: `archivedAt`, a reason from a list (Added by mistake, Left the study, Duplicate, Other with a note), and every record kept. Archived patients leave every list and their code is never offered again. Demo patients and patients with no logs are still erased. With the switch off (caregiver build) delete works exactly as before.
- **New tables, empty for now:** `meta`, `caregivers`, `assignments`, `watches`, `caregiverRatings`, with the fields in plan 5.1.
- **Backup format 2.** The JSON backup gains `formatVersion: 2`, `appVersion`, the phone's `deviceId` and the new tables. PIN fields (`pinSalt`, `pinHash`, `pinIterations`, `failedAttempts`, `lockedAt`) are never written to a backup, and a restore never stores them even if a file has them. CSVs are unchanged until plan 5.10.
- **Restore.** A format 1 or format 2 backup restores. A log already on the phone is matched by `uid` **or** by the old key (patient, behavior, time, entry time). The plan said "by `uid` when both sides have one, else by the old key"; matching on either is stricter, because a log restored once from a format 1 file got a new `uid` here and would otherwise come back twice from a format 2 file. Every new field is checked the way restore already checks the old ones (#47). A caregiver already on the phone is never replaced (it keeps its PIN), and a submitted caregiver rating is never replaced (it is locked, F-47).

## Why `deviceId`, `uid` and `tzOffsetMin` are written in the caregiver build too

Lane B rule 1 says a switch that is off leaves the app as it was. These three are written anyway, and that is an assumption Devin can reverse:

- They are not asked of the caregiver and change nothing on screen. They describe the phone, not the person.
- They cannot be filled in later. A log made today without an offset has none forever.
- They leave the phone only in a backup the caregiver chooses to make, as every log field already does.
  To reverse: remove the three spreads in `LogScreen.tsx` and `logs.ts`. The columns stay empty.

## Undo

A phone that has opened this build cannot open an older one: IndexedDB refuses to go down a version. To go back: Export a backup, clear the app's data, install the older build, Restore. The older build reads the format 2 file's logs, patients, reviews, check-ins and history and ignores the rest.

## Left out

- **CSV columns** for the new fields: plan 5.10, with the data dictionary.
- **The data dictionary** (`docs/data-dictionary.md`) is in draft PR #46, not on `main`. Its rows for these fields are added when both are merged.
- **Resident colors** (`color`) are stored and restored but nothing sets them yet; the shell (#41) and step 4.1 decide how.

## What would change if Dr. Gupta picks differently

- **D-20 "erase is fine":** switch `archivePatients` stays off; the archive code can be removed in one pull request.
- **D-22 "offset not needed":** stop writing `tzOffsetMin`; old values do no harm.
- **R2 "no caregiver identity":** `by` is never filled; the empty tables can stay or be dropped in a later version.
