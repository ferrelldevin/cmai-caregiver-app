# 030. Open, tap, done: the caregiver path

2026-11-20 · Register: F-65 · Status: direction from Dr. Gupta, relayed by Devin 2026-11-18; plan picked by Devin by card 2026-11-20 · No storage change · No scoring change

## Problem

Dr. Gupta's direction (relayed by Devin, 2026-11-18): simplify the app as much as possible to reduce caregiver burden; opening the phone and logging a behavior must not take multiple steps; simple, user-friendly, modern, and still complete.

The app was used at phone size (390 x 844) on main 5a89a7c with made-up demo data, in both builds:

| From opening the app                           | Caregiver build | Lab build          |
| ---------------------------------------------- | --------------- | ------------------ |
| Taps to a logged behavior, during a shift      | 1               | 1                  |
| Taps to a logged behavior, start of a shift    | 1               | 6                  |
| Behaviors one tap away without scrolling       | 11 of 29        | 8 of 29            |
| Behaviors that need a second tap (a group tab) | 18              | 18                 |
| Screen used before the first tile              | 234 to 278 px   | 340 px             |
| Taps to move a log 5 minutes earlier           | 3               | 6                  |
| First-time setup before the first log          | 1 tap, 1 code   | 36 taps, 8 screens |

The caregiver build already logs in one tap. The risk is the features waiting behind lab switches: turned on as built, they put steps in front of the tap.

## Rule

Nothing is asked before the tap. Everything else comes after the tap and is optional, or lives in Settings. Every later feature is judged against this first.

## Options

1. Leave the lab features as built and decide at each sign-off. Each one adds a little; together they add the six taps above.
2. **Chosen:** fix the path now, in eight small pull requests, each reversible on its own.

## Steps

One pull request each, in this order. A step is done when its criteria pass in the app.

1. **Lab notes only in the lab build** (build plan 4.8). "Open: R4", "Open: D-17" and "Open: D-18" are notes from the lab to itself and showed on a caregiver's Today and Two weeks.
2. **Log starts with tiles.** The title, the three-line instruction and the backup reminder leave Log; today's count moves into the top bar.
3. **All 29 behaviors on one page**, the group tabs kept as jump links, so no behavior needs two taps.
4. **Edits fill in their own reason** (a time change is "wrong time", a behavior change is "wrong behavior"). Delete still asks for a reason and a confirm (D-14).
5. **Who is logging is remembered; the PIN is switched off** (Devin, by card 2026-11-20). The phone's own lock is the login. The PIN code stays in the repo, off. This changes the assumed answer for R1 (F-46) and goes to Dr. Gupta in the review packet.
6. **The "I'm here" strip leaves Log**; a watch still starts with the first log and ends after four quiet hours (D-25).
7. **One "Lab and research" row in Settings** holds exports, the clock check, demo data and roles.
8. **The app always opens on Log.**

CMAI item wording, locked ratings and the delete rule do not change in any step.

## Acceptance criteria, step 1

1. The words "Open:" are written in one place, `src/ui/OpenLabel.tsx`; screens only pass an ID and a sentence.
2. The component renders nothing with `labView` off, for every kind of ID (`tests/openLabel.test.ts`), and the caregiver build's Today and Two weeks contain no "Open:" text (`e2e/today.cjs`, `e2e/twoweeks.cjs`).
3. Lab build: the three notes show with their own words; D-, F-, P- and V- IDs link to the review register, and the link says where it goes and that it opens a new tab; R4 is a requirement, not a register row, so it is plain text (`tests/openLabel.test.ts`, `e2e/lab-labels.cjs`).
4. axe WCAG 2.2 AA, 0 violations with the notes showing, in four display modes, each confirmed as the mode drawn (`e2e/lab-labels.cjs`).

### Review, step 1

Codex (Devin-Desktop, 2026-11-20) read the code diff and found five things, all checked against the code and fixed: the register link did not say where it goes or that it opens a new tab; the check that the D-18 note names its evidence had been dropped; the four display modes were asked for but never confirmed as drawn; only D- links were tested; and nothing tested the component itself with the switch off. Sent to Codex: the code diff only, no CMAI item wording, made-up data only.

## Acceptance criteria, step 2

What sat above the tiles on Log, and where it went:

| It was                                   | It is now                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The title "Log a behavior"               | Gone from the screen. The page heading stays for screen readers, and the Log tab is lit                    |
| "N logged today", a link to Today        | A count on the Today tab, spoken as "Today N so far". The tab opens Today, as the link did                 |
| Three lines on how to log                | Shown on Log only until a resident has a first log. Always the first lines of the "what counts" sheet      |
| "Last backup: never" with a Back up link | A dot on the Settings tab, spoken as "Settings backup due". The Backup row in Settings reads "Backup due." |

The plan said the count would move into the top bar. It went on the Today tab instead: at 320 px the top bar's second line already wraps, and a count on the tab that opens Today needs no explaining.

1. With a resident who has logs, the first tile starts within 110 px of the top at 390 x 844 (it was 234 to 278 px), and Log shows no title, how-to line or backup line (`e2e/today.cjs`, `e2e/flows.cjs`).
2. A resident with no logs sees the how-to line, and it leaves with the first log (`e2e/rollover.cjs`). The "what counts" sheet opens with it (`e2e/navigation.cjs`).
3. The Today tab shows today's count and says it in words; it clears at midnight and when the app comes back on a new day (`e2e/today.cjs`, `e2e/rollover.cjs`).
4. A real resident with logs and no backup in a week puts a dot on Settings, said in words, and the Backup row in Settings reads "Backup due." ahead of when the last one was; nothing about backup is on Log (`e2e/flows.cjs`, `tests/backupReminder.test.ts` for the rule, unchanged).
5. Every tab's spoken name starts with the words shown on it (WCAG 2.5.3); axe WCAG 2.2 AA, 0 violations in four modes (`docs/audits/axe-run.cjs`).

### Review, step 2

Codex on Devin-Desktop, 2026-11-20, on the code diff. Two findings, both checked against the code and fixed:

1. The dot said "backup due" only to screen readers; a sighted caregiver saw a dot and, in Settings, only "Never exported". The Backup row now reads "Backup due." in words.
2. The check that a hold does not log counted whether the Today badge existed, so a hold that logged a second event would have passed. It now compares the number.

Criteria for steps 3 to 8 are added to this note by the pull request that builds each one.

## Sources

- Review page with before and after screens: project Library, `audits/simplicity-2026-11-18/`.
- WCAG 2.2 SC 2.5.8 (target size) and SC 2.2.1 (timing) apply to steps 2 and 3 and are checked there.
