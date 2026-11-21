# 032. "When did it happen" on the confirmation

2026-11-21 · Register: F-51 · Build plan step 4.7 · Lane A · Both builds · No storage change · No scoring change · No export change

## Problem

A caregiver cannot log while dealing with hitting or a fall. They log after. A log is stamped with the time of the tap, and putting it back five minutes takes three taps (Edit, the time, Save change), in a sheet that covers the tiles. So the behaviors that matter most carry the latest times. Other teams had to correct event times against video for the same reason (Iaboni 2022, [DOI 10.1002/dad2.12305](https://doi.org/10.1002/dad2.12305), as cited in build plan 4.7). The two fields that fix it are already stored on every log: `at` and `approx`.

## The simplicity rule first

Design note 030 (F-65): nothing is asked before the tap; everything else comes after it and is optional. This step is after the tap and optional. One tap still logs, with the time of the tap, and a caregiver who never looks at the chips loses nothing.

## Options

1. Leave it: Edit, the time, Save change. Three taps and a sheet. The plan's reason for this step stands.
2. The plan's four chips: `Just now`, `5 min ago`, `15 min ago`, `Earlier…`.
3. **Chosen:** three chips: `Just now`, `5 min ago`, `15 min ago`. `Earlier…` is left out because it would open the log details sheet, and the Edit button that already does that sits in the same bar, one line away. Two controls for one action is clutter on the busiest screen.

What this departed from: build plan 4.7 listed four chips. Everything else in the step is built as written. **Decided:** Devin chose "Keep three chips" on a decision card on 2026-11-21, and the build plan now says three.

## Decision

- After a log, the confirmation shows a second line: "When?" with three chips. `Just now` is selected.
- `5 min ago` and `15 min ago` call the existing `editLog` with `at = loggedAt - minutes` and `approx: true`. The time shown on the confirmation changes at once and reads "(about)".
- `Just now` puts `at` back to `loggedAt` and `approx` back to false.
- The chips count from `loggedAt`, never from the last chip, so `15 min ago` after `5 min ago` is 15 minutes, not 20.
- The chips show only on a log just made. A "Deleted" confirmation has none.
- A chip shows at once and its save follows; saves run in the order tapped, so the last chip tapped is the one that stays. A refused or failed save puts the chip back to what it was before that tap.
- A chip keeps the confirmation open for another 8 seconds, as any change to it does.
- Lab build (`changeReasons` on): the chip fills in the reason the log details sheet would for the same change, "Wrong time" (`reasonFor`, design note 030 step 4). Nothing is asked.
- A chip that would put the log before the resident's first day is refused with step 1.3's message (F-32), shown on the confirmation; the stored log and the selected chip stay as they were.
- With "It stopped" in the bar (lab build, three actions), the chips sit on their own line above the actions.
- For a screen reader the chips are one group named "When did it happen?", each a button that says whether it is pressed.

## What it does not do

- It stores nothing new. `at`, `approx` and one change-history entry are what the log details sheet writes for the same edit.
- It does not change a rating: `docs/test-cases.json` is untouched. A chip can move a log across midnight or a period line exactly as the sheet can.
- It does not ask anything. No chip has to be chosen.

## Risk

The confirmation is one line taller, so it covers a little more of the tiles for 8 seconds, and a chip can be tapped by mistake by someone going for a tile.

**Kill when:** in the internal pilot (build plan 3.6) the chips are tapped by mistake more often than on purpose. The change history shows both: a chip followed within seconds by `Just now` or Undo is a mistake.

## Acceptance criteria

From build plan 4.7, with criterion 6 added for the lab build.

1. One tap still logs with the time of the tap; the stored `at` equals `loggedAt` and `approx` is not set when no chip is touched (`e2e/flows.cjs`).
2. `5 min ago` stores `at` five minutes before `loggedAt` and `approx: true`, and writes one change-history entry (`e2e/flows.cjs`).
3. `Just now` after another chip puts `at` back to `loggedAt` and clears `approx` (`e2e/flows.cjs`).
4. At large text the chips wrap, and nothing runs off the side at 360 px (`e2e/flows.cjs`, both text sizes).
5. A chip that would put the log before the resident's first day shows step 1.3's message and stores nothing (`e2e/flows.cjs`).
6. Lab build: a chip saves with the reason "Wrong time" and asks nothing (`e2e/change-reasons.cjs`).
7. axe WCAG 2.2 AA, 0 violations with the chips showing, 4 display modes (`docs/audits/axe-run.cjs`).
