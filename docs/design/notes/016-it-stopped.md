# 016. "It stopped"

2026-11-10 · Register: F-39 · Status: built on assumed approval (Devin, 2026-11-10), sign-off pending · Switch: `stoppedTap` (lab build only) · Field: `endedAt` (database version 4, note 009) · Build plan v5, step 5.7

## Problem
Three behaviors come in stretches, not single events: pacing, repetitious mannerisms and general restlessness (scoring spec section 4). One tap is one stretch, so the app knows when a stretch started but not how long it lasted. Sensor models need a start and an end; other teams got them by reviewing video (Iaboni 2022, DOI 10.1002/dad2.12305).

## Decision (assumed answers, each reversible)
- **Only those three.** The button never shows for a behavior that is one event, such as hitting, and the app refuses an end time on one.
- **Where it shows.** After logging one of the three, the confirmation offers "It stopped" next to Edit and Undo; with three buttons it takes two lines so the behavior's name is never cut off. On Today, each of those logs with no end yet has an "It stopped" button on its row; a log with an end shows both times ("2:05 PM to 2:40 PM").
- **One tap** stores `endedAt` as now and writes a change-history entry, like any other edit. The log details sheet has an optional "It stopped" time, corrected like the start time, with Clear.
- **Never before the start.** An end before the start is refused, whichever time is changed, and the sheet says "It can't stop before it started. Check both times." The stored log is shown again unchanged. Restore refuses it too (note 009).
- **Never scored.** One tap is still one occurrence. Scoring never reads `endedAt`. Export format 2 carries it (`ended_at` in observations.csv and the behavior stretches in labels.csv, note 013).

## Known limits
- A typed end time is on the same calendar day as the start, so a stretch over midnight can be ended only with the "It stopped" tap, not typed.
- The confirmation is on screen for 8 seconds; most stretches last longer, so Today is where most ends will be tapped.

## Kill when
The pilot (3.6) shows it tapped on fewer than 1 in 10 eligible logs. An end time on a tenth of stretches is not usable as a label and costs screen space.

## Checked
- Unit tests (`tests/itStopped.test.ts`): only items 1, 26 and 29 are continuous; one tap stores the end with a change-history entry; an end before the start is refused either way round and nothing changes; an end equal to the start is allowed; an end can be cleared; hitting is refused. For every hand-scored case in `docs/test-cases.json`, five rounds of random end times give the same count and rating (the property 2.11 asks for: "end times never change a rating").
- Browser (`e2e/it-stopped.cjs`, lab build, 360 by 640): the confirmation offers it after pacing and fits with the name in full; every button at least 24 by 24 px; one tap stores it and the change history has it; hitting gets none; Today offers it only on the open pacing log and shows both times; the sheet refuses an end before the start and says why; Clear takes it back; axe 0 violations in four display modes.
- The caregiver build shows none of it: `stoppedTap` is off there (`tests/settings.test.ts`).
