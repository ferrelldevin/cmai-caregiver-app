# 019. Change reasons, append-only history and a history view (G11)

2026-11-17 · Register: F-59 (new), F-58 (revision counter part built) · Status: built on assumed approval (Devin), sign-off pending (Dr. Gupta) · Switch: `changeReasons`, lab build only · No database version (new fields are optional and unindexed) · No scoring change

## Problem

Devin's rule for the lab: no edit or delete without a reason, and nothing lost. Today a delete already needs a reason and a confirm (note 007), but an edit needs none, edits made within 5 minutes are merged into one history entry (an entry is rewritten), and the revision the research export needs (F-56) can only be guessed from the number of history entries.

## What already existed, and the checks against it

- **Delete reasons:** a pick list (`DELETE_REASONS`) plus, for "Other", a typed note of a few words (`deleteNote`). Kept as is in the caregiver build.
- **Free text:** the check found two typed fields: `deleteNote` (with "Other") and `beforeNote` (the "just before" context, F-41 and P-11). `beforeNote` is context, not a reason, so it stays. `deleteNote` breaks the "no free text" rule for reasons, so with `changeReasons` on, "Other" asks for no note and none is stored. The export never carried either.
- **History table:** `changes` already records every edit, delete and restore with who (`by`), phone and time. Extended, not duplicated.
- **Soft delete:** already no hard delete from the UI. A delete marks the row.

## Decision

Extend the existing pieces behind one switch, `changeReasons` (off in the caregiver build, on in lab), so the caregiver build behaves as today until Dr. Gupta signs.

With the switch on:

1. **Reasons.** Codes `wrong_time`, `wrong_item`, `duplicate`, `wrong_participant`, `entered_by_mistake`, `other`. Displayed as Wrong time, Wrong behavior, Logged twice, Wrong patient, Tapped by mistake, Other. The delete list already used these words, so old deletes map to a code. The Undo toast maps to `entered_by_mistake`. The code is stored on the history entry (`reason`).
2. **Edits are held until Save change,** which asks why. (Changed 2026-11-20, design note 030 step 4: Save change now fills in the reason from what was changed and asks nothing; a delete still asks.) Closing the sheet any other way discards the draft. This is the one behavior change for caregivers and is why the switch exists.
3. **Append-only.** No entry is ever merged or rewritten. One Save change is one entry.
4. **"It stopped" and restore carry no reason.** They are not corrections: the first records an end time that was never set, the second takes back a delete (itself reasoned). Both still make a history entry.
5. **History view:** a "Change history" list on the log details sheet: each version, when, by whom (caregiver code), the reason and what changed. Rebuilt from the history by `logVersions`.
6. **Revision counter (F-58, built here):** `rev` on each log, 1 when made, +1 on every edit, delete or restore, in the same transaction as the history entry. The research export uses it as `revision`, which removes the merged-edit problem and the 5-minute warning on the export card. Logs made before `rev` existed use 1 + their history entries.

Left alone on purpose: scoring (ratings are locked, deleted logs are skipped as before), and the caregiver build.

## Acceptance criteria

1. A change with no reason, or a reason not in the list, is refused and nothing is written (`tests/changeReasons.test.ts`).
2. Edits and deletes read back as versions with revision, when, who, reason and values (same file, "reads back every version").
3. History is append-only: two edits a minute apart are two entries and the first is not rewritten (same file).
4. "Other" takes no note; the old label words still work and map to a code; no hard delete (same file).
5. A backup keeps reasons and revisions, and drops a made-up reason (same file).
6. The export's `revision` follows the counter (`tests/researchExportBuilder.test.ts`).
7. In the app: the sheet holds changes until Save change, asks why from the six, shows the history view, deletes without a note, 4 display modes clean (`e2e/change-reasons.cjs`). The lab checks that edit in the sheet now press Save change first (`before-chips`, `it-stopped`, `caregivers`).

## Open for Dr. Gupta and Devin

- Is a held edit plus a reason step too much for a caregiver in the lab study? Kill criterion: if more than 1 in 5 edits in the pilot are abandoned at the reason step, make the reason optional for `wrong_time` fixes.
- Should "It stopped" count as a change needing a reason? Assumed no.
