# 008. Building the round 3 mockup into the app

2026-11-07 · Register: F-25 to F-29, D-17, D-18 (proposed here; D-15, D-16, F-23 and F-24 are already taken by the 2026-11-04 flow comparison) · Status: phase 1 built (2026-11-07)

## Problem
On 2026-11-07 Devin approved the round 3 mockup as the direction for the app ("start the development of this in full, with the options we have right now"). The mockup (Storybook, PR #37) shows five steps: login, log, score, report, settings. The app today has three tabs (Log, Scores, Data) and no report screen. Requirements R3 to R5 in `cmai-mobile-plan.md` are only partly met, and R4 (daily report) is missing.

Round 3 review page, with the decision log and every screen: https://claude.ai/artifact/6nsVuXXRZQuPqdipHRnjtZ

## What "the options we have right now" covers
Built as decided in the mockup:
- Compact resident bar: code badge in the resident's color, the code, and a Switch button that reads as a button.
- A four-tab floating bar: Log, Score, Report, Settings.
- Log: an icon for each behavior, 3 tiles across, left-aligned, today's count top right, a "most logged" row, and group tabs.
- Report: a Two weeks view (dates, logs per day, time of day, behavior groups, the Now / Last table, patterns) and a Today view (logs by hour, one row per behavior that opens to its logs).
- Settings in place of Data, with the same pages.

Not built, because a decision is still open. The mockup shows these, but the app keeps what it has:

| Mockup shows | App does instead | Why | Register |
|---|---|---|---|
| CMAI total on top of Score | Behaviors first, total labeled secondary | Devin chose "mockup only" on 2026-11-06 | D-08 |
| Sign in with a PIN | No sign-in, as today | R1 needs its own design (PIN storage, reset, lockout) and Dr. Gupta's view on lab accounts | R1 |
| A caregiver name, and "by CD" on each log | No caregiver shown | The app has no caregiver record; who assigns residents is open | R2 |
| A room number under the code | Code only | A room number can identify a resident; patients are codes only | P-04 |
| Day ends at midnight (Today) | Built that way, marked "Open (R4)" on screen | The app already uses local midnight for days; Dr. Gupta has not confirmed | R4 |
| Group average, 1 to 7 | Built that way, marked open | Research usually reports group sums | new, D-17 |
| Pattern thresholds (20+ logs, 1.5× share, 30 min pairs) | Built that way, marked open | Thresholds are a guess until the lab sets them | new, D-18 |

## Options for how to build it
1. **One big change.** Every screen in one pull request. Fast to start, but too large to review or test, and one problem holds back everything. It also breaks the one-change-per-PR rule in `change-process.md`.
2. **Phases, one pull request each, in order (recommended).** Each phase ships on its own, passes every check, and is usable before the next starts. Each later phase builds on the shared pieces the first one adds.
3. **Phases in parallel threads.** Faster in calendar time, but the shell (phase 1) touches every screen, so later phases would conflict with it until it merges.

## Decision (proposed)
Option 2, then 3. Devin chose "Phase 1, then parallel" on 2026-11-07: the shell ships first, and once it is merged phases 2 to 5 each get their own thread. He also chose to hold the open questions for Dr. Gupta until phase 4 is built, so he can see the Report screens working.

| Phase | Pull request | Register | Size |
|---|---|---|---|
| 0 | Merge the mockup (PR #37), so the icons, colors and checks are on main | – | Devin's merge |
| 1 | **Shell:** compact resident bar with color badge, floating bar with Log, Score and Settings (Data renamed Settings). No empty Report tab: it joins the bar in phase 3 | F-25 | Medium |
| 2 | **Log:** behavior icons, 3-across left-aligned tiles, count top right, most logged row, group tabs. Logging, Undo, Edit, Recent logs and delete-with-reason unchanged | F-26 | Medium |
| 3 | **Report, Today:** the Report tab and route `#/report` join the bar; logs by hour, behaviors you can open, Remove asks for a reason (the existing delete flow) | F-27, R4 | Medium |
| 4 | **Report, Two weeks:** charts, behavior groups, the table, patterns, CSV export. The counting lives in tested functions in `src/scoring/` | F-28, D-17, D-18 | Large |
| 5 | **Score:** the mockup's row style and "vs last" arrows, behaviors first per D-08 | F-29 | Small |
| later | PIN sign-in (R1), caregiver profiles (R2), total-first Score (D-08) | R1, R2, D-08 | after the lab |

Each phase follows `change-process.md`:
- Unit tests come first for any counting.
- Every state is designed: empty, one log, many logs, first run.
- Each phase adds its own browser check in `e2e/`.
- axe shows 0 violations in all four modes.
- Before and after screenshots in light and dark.
- A register row for each phase.

## Appetite, done when, kill when
- **Appetite:** about one working session per phase, with phase 4 taking two.
- **Done when:** each phase is merged and live on Pages, with green CI.
- **Kill when:** a phase needs a scoring change or real data to work. Stop and take it to the lab instead.

## Left out on purpose
- No scoring changes. The rating rule (`cmai-count-rule-2`) stays as it is.
- No server or sync, and nothing leaves the phone.
- No new data fields, except what a phase lists. Phase 1 needs none.
