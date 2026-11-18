# 025. Correcting a wrong behavior on a log

2026-11-18 · Register: F-64 (new) · Status: built on assumed approval (Devin picked the approach by card, 2026-11-18), sign-off pending (Dr. Gupta) · Switch: `correctBehavior`, lab build only · No database version (no new field) · No export format change · No scoring change

## Problem

A caregiver who taps the wrong tile and misses the 8-second Undo can only delete the log (reason "Wrong behavior") and log the right one again. That leaves two records for one event, loses the link between them, and stamps the new one with a later entry time. Devin's rule (2026-11-18): the wrong log is never deleted, nothing is counted twice, and the data does not grow.

## Options

1. **Correct the same log.** The behavior field changes on the one record; the history keeps the old value, who, when and why; the revision goes up by one.
2. **A new log that points at the old one** (supersede). The old log is marked replaced, a new one carries the right behavior and a link.

## Decision: option 1

- **It is what the rest of the system already does.** The change history (`changes`, note 007) records `from` and `to` for every edit, append-only with a reason (note 019). The export contract says a change "re-exports the same `record_id` with `revision` + 1 and the full new content" (`docs/contracts/cmai-export/cmai-export-proposal.md`, F-56), and `cmai_item` is part of that content. The lab reader keeps the highest revision per record (`cmai_export_check.py`), so the event is counted once. The sync server (PR 109, not merged) stores each revision as its own row, so the first pick stays on the server too.
- **Option 2 costs more for nothing gained.** Two records per fix, a new link field the v1.0.0 contract does not have (a contract change), and a reader that must learn to skip replaced records.
- **It matches the research record-keeping rule** that a correction is dated, attributed, explained and does not hide the original entry: ICH E6(R2) section 4.9.3; 21 CFR 11.10(e) ("Record changes shall not obscure previously recorded information"). We are inferring that these are the right yardstick; nothing says the study is bound by either.

What was missing was only a way to do it: the behavior was not an editable field and the sheet had no control for it.

## What is built

- `correctItem(log, item)` in `src/data/logs.ts`. One transaction: the log's item number changes, `rev` + 1, and one history entry is added with action `edit`, reason `wrong_item`, `from: { itemId: old }`, `to: { itemId: new }`. The log's unique ID, times, maker and phone do not change. No row is added to `observations`.
- The reason is always `wrong_item` and is not asked for: changing the behavior has only one reason.
- A deleted log can't be corrected. Picking the same behavior does nothing. A number outside 1 to 29 is refused.
- It returns the log as stored afterwards, so the sheet shows what is really saved, or nothing when the log was deleted meanwhile (another tab); the sheet then says the log was deleted and changes nothing.
- **End time (F-39).** If the log has an end time and the new behavior does not come in stretches, the end time is removed in the same change and kept in the entry's `from`.
- The entry is never merged with a later quick edit (the caregiver build merges edits under 5 minutes apart).
- **Sheet.** A "Behavior" row at the top of the log details with a Change button. It opens a list of the other 28 behaviors in the Log screen's four groups. Pick one, press Change behavior. Back saves nothing. It saves at once, apart from any held edits (note 019).
- **History view** shows "behavior A to B · Wrong behavior" and each version's behavior.
- Fixed while here: the history view did not show an end time coming back when stepping over an edit that cleared it.

## Independent review

Codex (CLI 0.159.2) read the code diff on 2026-11-18 and found three things, all confirmed against the code and fixed: a correction refused for a deleted log looked saved in the sheet; the sheet kept stale fields after a correction; Back from the pick list by keyboard lost the Change button's focus. It found no fault in the history step-back or the merge guard. Each fix has a check (`tests/correctItem.test.ts`, `e2e/correct-behavior.cjs`).

## Not changed

- Scoring reads live logs by item, so the corrected log counts under the new behavior and no longer under the old. The count rule and `RULE_VERSION` are untouched.
- The research export, the backup format and the database version. A backup already accepted `itemId` inside `from` and `to`.
- The caregiver build: the switch is off, so it behaves as today.

## Acceptance criteria

1. One log before and after; same unique ID, times and maker; revision 2 (`tests/correctItem.test.ts`).
2. One history entry with reason `wrong_item` and both item numbers; versions read back as item old, then new (same file).
3. Counted once: the scoring engine's count moves from the old item to the new (same file).
4. Bad number refused; same item and deleted log do nothing (same file).
5. End time dropped or kept by the rule above, and the history shows it (same file).
6. The research export gives the same `record_id` at revision 2, active, with the new item (same file).
7. In the app, lab build: the row, the list of 28, Back saves nothing, the change, the history line, the tile counts, axe 0 violations in 4 display modes (`e2e/correct-behavior.cjs`).

## Open for Dr. Gupta and Devin

- A correction to a log in a **finished** period changes that period's app rating, as a delete or a time edit already can. Should corrections close when a period ends, or when the caregiver's blind rating (F-47) is submitted? Assumed: stay open, because the history shows every change.
- Should a correction be limited to whoever made the log? Assumed no: any signed-in caregiver, recorded by code.
