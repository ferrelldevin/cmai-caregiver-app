# 018. Export for research action (contract v1.0.0)

2026-11-17 · Register: F-56 (built), F-57 and F-58 (proposals only) · Status: built on assumed approval (Devin), sign-off pending (Dr. Gupta) · Switch: `researchExport`, lab build only · No storage change, no database version, no scoring change

## Problem

Note 017 filed the research export contract and listed four mismatches with the app's data. The pipeline needs a file the app can actually write. This note builds the "Export for research" action with an assumed answer for each mismatch, so the contract can be tested end to end on made-up data.

## Options considered

1. **Wait for Dr. Gupta on all four mismatches.** Nothing to test until then.
2. **Change storage first** (zone name, role, frequency, review flag at log time). Correct, but a database change that cannot be undone.
3. **Build read-only on assumed picks, count every use of a pick, propose the storage changes separately.** Chosen: reversible, honest about what is a guess, and the counts show Dr. Gupta how much the guesses matter.

## What is built

- `src/data/researchExport.ts`: `buildResearchExport({ patientId, startDay, endDay })` reads logs and the change history and returns the file text, its name and a summary. It never writes.
- `src/ui/ResearchExportCard.tsx`: on Settings > Backup, lab build only. Pick a resident and two days, "Check range" shows the summary, "Save file" downloads it.
- File name `cmai-export_<participant>_<first day>_<last day>.json`. The range is whole local days in the phone's zone: first day 00:00 to the end of the last day, written as UTC.
- One record per log. `record_id` is the log's `uid`. `revision` is 1 + the number of entries in the change history for that log (edit, delete and restore each count). A delete is a tombstone (`status: "deleted"`); a restore is a normal later revision. Every file is a full snapshot of the latest revision of every log in the range.
- `data_class`: a demo resident is `synthetic`. Any other resident is refused until the `realExports` setting is turned on (G1, below), and would then be `real`. Item numbers only; the file holds no wording, notes or delete reasons.

## The four assumed picks

| #   | Gap                                                    | Pick for v1.0.0                                                                                                                                                                                                         | Counted in the summary                                   |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | No stored zone name                                    | `tz_name` is the phone's current zone. A log whose stored offset differs from that zone's offset at that moment stops the whole export with a message naming how many logs failed. Nothing is dropped and nothing saved | Every record uses it; logs with no stored offset (below) |
| 2   | Older logs have no `deviceId`                          | Placeholder `00000000-0000-0000-0000-000000000000`, on those records only                                                                                                                                               | Records with the placeholder                             |
| 3   | No per-record frequency, review flag or role           | `frequency: null`, `rating_scale: "none"`, `reviewed: false`, `logger_role: "caregiver"` (the app has no role)                                                                                                          | Records with a defaulted role; records with no frequency |
| 4   | "Approximate time" and watched stretches have no field | Left out. Approximate-time logs export as normal. v1.1.0 is proposed as F-57, not built                                                                                                                                 | Records marked approximate                               |

Choices not in the request, for Devin to confirm:

- **A log with no stored offset** (made before database version 4) cannot be checked against the zone. It is exported with the zone's offset and counted, not blocked, because blocking would make every old log unexportable.
- **Role, frequency and review flag come from an optional `extras` argument.** The real action passes none, so it writes the defaults. The seeder passes them, because the app stores none of the three and the sample set needs rated, reviewed and staff or researcher records. That is the only reason the argument exists.
- **A warning, not a block, when a log was edited in the last 5 minutes.** The change history merges edits made within 5 minutes into one entry, so a later edit would keep the same `revision` with different content, and the reader treats that as a hard error. Wait a few minutes before saving. A permanent fix needs a stored revision counter (F-58).
- **An edit that moves a log out of the range** drops it from a later export of that range, so the reader keeps its older revision. Export a wider range, or the range that holds both times.

## Acceptance criteria

Each is checked by a test that names it.

1. The seeder makes 8 files: 6 first exports and 2 re-exports (`tests/researchExport.test.ts`, "1.").
2. Every file validates against `cmai-export.schema.json` with Ajv's 2020 build (test "2.").
3. `python cmai_export_check.py <file> --data-class synthetic` prints `OK:` on every file (test "3."). The tests run it as a child process, so it is part of the existing unit-test step in CI and no workflow changed.
4. Editing 2 logs and deleting 1, then checking both files together: the edit wins, the deleted log is gone, the count is right (test "4.").
5. The range crosses the 1 Nov 2026 clock change and offsets go from −240 to −300 (test "5.").
6. Counts, placeholder IDs only on P-DEMO-C's first 4 days, roles and rating mix as asked (test "6.").
7. The committed sample files equal what the seeder makes, so they cannot drift (test "7.").
8. Defaults, the stop on a wrong offset, tombstones, restore, range edges, a read-only export and the refusals (`tests/researchExportBuilder.test.ts`).
9. The card shows the summary, saves one file named as above, passes axe in 4 display modes (`e2e/research-export.cjs`, lab build).

## Left out

- v1.1.0 (`time_approximate`, `observation_windows`): F-57, proposal only.
- Storing the zone name, role, frequency, review flag and a revision counter at log time: F-58, proposal only. It changes storage.
- Real participant data, any scoring change, the lab pipeline side.
- A caregiver build: the switch is off there, so nothing shows.

## G1. Real-resident exports are blocked (follow-up PR)

The first version would have exported a non-demo resident as `data_class: "real"`. That breaks the made-up-data-only rule, so the action now refuses any resident who is not demo data, with a plain message. The switch is `realExports` in `src/study/settings.ts`, off in both builds, and it is not a lab sign-off feature: one pull request turns it on, only after Dr. Gupta says in writing where real exports may be kept (P-03, P-04). Tests: `tests/researchExportBuilder.test.ts` ("G1"), `e2e/research-export.cjs` (a real resident P-07 is refused, a demo resident exports).
