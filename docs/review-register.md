# Review register

This file lists everything in the app that still needs a decision, approval or independent check. It also records who signs off on each item and when. Every open item in the repo is listed here, so nothing has to be pieced together from the spec, the README and the study notes.

## How to read it

**Gates.** Each item is tied to the earliest point where it has to be settled.

| Gate | When | Who owns it |
|---|---|---|
| **G0: Interview demo** | Done (interview, October 2026). | Devin |
| **G1: Lab adoption** | Lab adoption: Dr. Gupta says in writing that the lab will use the app. | Professor Gupta and the lab |
| **G2: Real-world use** | Before any real caregiver logs a real resident. | The lab, the ODU IRB, and the CMAI copyright holder |

Nothing at G1 or G2 blocks the interview demo. Until an item is signed off, the app uses the default in the "In this build" column. That default is labeled in the app or the docs, so no one mistakes it for an approved rule.

**Status.** `Open` (no one has acted on it yet), `Default in build` (works now, waiting on sign-off), `Done` (finished, with evidence linked), `Deferred` (deliberately parked until a gate), `Proposed` (written down with a suggested answer, not settled), `In review` (a pull request is open for it).

**Changing a scoring rule.** A change gets a new rule version (`RULE_VERSION` in `src/scoring/engine.ts`, now `cmai-count-rule-2`). The new version is logged under "Decision log" below, and the hand-scored cases in `docs/test-cases.json` are updated. Old exports keep the label of the rule that scored them.

## D. Scoring decisions

| ID | Decision | In this build | Evidence | Sign-off from | Gate | Status |
|---|---|---|---|---|---|---|
| D-01 | Count-to-rating boundaries (bands 1 to 6) | N=0→1, 1→2, 2-4→3, 5-13→4, 14-28→5, 29+→6 | `scoring-spec.md` §2; robustness proposal 1 | Lab; two-rater study (V-01) settles boundary cases V03, V05, V06 | G1 | Default in build |
| D-02 | Rule for rating 7 | 3+ logs within 60 min on 7+ of 14 days; a cluster that crosses midnight counts for the day it starts | `scoring-spec.md` §3; `cmai-count-rule-2` | Lab | G1 | Default in build |
| D-03 | Likely 7s: ask the caregiver at the day-14 review when 3 to 6 days have clusters | Not built. The rating falls back to the count bands. | Robustness rerun: rating 7 is lost in 38% of runs at 10% missed logs | Lab | G1 | Open |
| D-04 | Form version | 29-item long form, 1 to 7 | Manual p.22 | Lab | G1 | Default in build |
| D-05 | 14-day periods fixed from the first log, or rolling | Fixed | `scoring-spec.md` §1 | Lab | G1 | Default in build |
| D-06 | Code 8 (prevented): a separate code, or an estimate of the unprevented frequency (p.5 allows either) | Separate code. Not recordable since D-14 (the day-14 review is gone); belongs in a caregiver's own rating | Manual p.3, p.5 | Lab | G1 | Open |
| D-07 | Partial prevention: tell reviewers to estimate "how frequently it would happen if not prevented" (p.24)? | No instruction shown | Robustness proposal 6 | Lab | G1 | Open |
| D-08 | Lead with per-behavior ratings, with the total secondary | Per-behavior first; total labeled secondary. Change proposed (Devin, 2026-11-06): the design mockup (PR #37) puts the total on top, still labeled secondary; the app is unchanged until the lab agrees | Manual p.5 ("not useful"); trials use the total (`research-notes.md`) | Lab | G1 | Default in build; change proposed |
| D-09 | Factor set: nursing home (p.7) or community (p.7 to 8) | Nursing home | Manual p.7 | Lab, once the care setting is known | G1 | Default in build |
| D-10 | When a behavior's change counts as meaningful | Marked at a 2+ point move, or a 1-point move in the same direction over two finished periods | Manual p.7 (raters agree within 1 point); Smith 2025 | Lab | G1 | Default in build |
| D-11 | Unlogged days: flag only, or also leave the period out of trend lines | Flag only | Robustness proposal 4 | Lab | G1 | Default in build |
| D-12 | Never scale counts up to make up for missed logs | Not scaled | Robustness proposal 5 | Lab | G1 | Default in build |
| D-13 | Back-dated logs (approximate times) in rating-7 clusters: count them, or count only exact times | Counted like any other log | F-03; spec section 3 | Lab | G1 | Default in build |
| D-14 | Can a person change the app's rating? | No. Ratings come from live logs only; the day-14 review screen is removed; old review records are kept but never read for scores. A blind caregiver CMAI at day 14 is designed (spec §5), not built | Devin, meeting with Dr. Gupta 2026-10-27; design note 007 | Lab (Dr. Gupta) | G1 | Pending |
| D-15 | Open question from the thread "Compare app to proposed five-screen flow" (2026-11-04): what "Total score" means and whether it goes first (conflicts with D-08). Full wording to be restored | See the comparison page | none | Dr. Gupta | G1 | Open |
| D-16 | Open question from the same thread: what a daily report scores. Full wording to be restored | See the comparison page | none | Dr. Gupta | G1 | Open |
| D-17 | Group average (1 to 7) shown on Two weeks. Research usually reports group sums | Not built. Proposed in note 008 and marked open when it is | `docs/design/notes/008-mockup-to-app.md` | Dr. Gupta | G1 | Open |
| D-18 | Pattern card thresholds (20 or more logs, 1.5 times the share, 30-minute pairs) are a guess until the lab sets them | Not built. Proposed as named constants, worded "often", never "because" | `docs/design/notes/008-mockup-to-app.md`; build plan 4.3 | Dr. Gupta | G1 | Open |
| D-19 | A log dated before the patient's first day, and which start date wins when a backup is merged onto a phone that already has that patient | Since step 1.3 a log before the first day is refused, and a restored one is skipped and counted | Audit A-04; build plan 1.3 (PR #50) | Dr. Gupta | G1 | Open |
| D-20 | Can a patient be deleted once real logging starts, or only archived with a reason | Deleted for good after a confirm, history erased. Proposed: archive with a reason (build plan 5.1) | Audit A-09 | Dr. Gupta | G1 | Open |
| D-21 | When is a finished period's rating final? Proposed: 24 hours after the period ends, and the export says so | Recomputed on every export | Audit A-10 | Dr. Gupta | G1 | Open |
| D-22 | Time zone and clock: record the phone's UTC offset on each log; what to do when a phone changes zone | Local time of the phone, offset not stored | Audit A-14, N-03 | Dr. Gupta | G1 | Open |
| D-23 | Export format 2 and the label file for sensor work: every time given in UTC and local with offset, format and app version in every file | Format 1 only. Proposed in build plan 5.10 (lane B, switched off) | Build plan 5.10; scan section 3 (inference) | Dr. Gupta | G1 | Proposed |
| D-24 | Do caregivers see the app's ratings during the study? Assumed no, so the comparison with the caregiver's own CMAI stays blind | Caregivers see ratings today. Lab build hides them behind one setting | Build plan 5.0, 5.4, 4.3; Cohen-Mansfield and Libin 2004, DOI 10.1002/gps.1171 (abstract level) | Dr. Gupta | G1 | Proposed |
| D-25 | How a watch (a span when someone was with the resident) starts and ends | Not built. Assumed: starts on "I'm here" or first log; ends on tap, switch, sign-out or 4 hours (build plan 5.6, lane B) | Build plan 5.6; Iaboni 2022, DOI 10.1002/dad2.12305 | Dr. Gupta | G1 | Proposed |

## P. Permissions and compliance

| ID | Item | Current state | Evidence | Sign-off from | Gate | Status |
|---|---|---|---|---|---|---|
| P-01 | Permission to show reworded CMAI definitions in the app and keep them in a public repo | Definitions are reworded in our own language with a manual page reference. NOTICE keeps CMAI content out of the MIT license. | DOMS: free for non-commercial use, "for other uses... seek permission"; forms say "All rights reserved" | CMAI copyright holder (Cohen-Mansfield) | G1 before the lab reuses the app; G2 at the latest | Deferred (email drafted, not sent) |
| P-02 | No commercial use without the author's permission | Non-commercial interview prototype | DOMS terms | CMAI copyright holder | G2 | Default in build |
| P-03 | IRB determination before any real resident or caregiver data | No real data. Demo data and stories are fictional. | ODU IRB pages (main campus irb@odu.edu; medical campus VHS-IRB@odu.edu) | ODU IRB | G2 | Deferred |
| P-04 | HIPAA and data handling if data come from a clinic or nursing home | Data stays on the device; patients are codes; export is manual | `README.md` Privacy | Lab, partner site (e.g. EVMS) | G2 | Deferred |
| P-05 | Code license and ownership: MIT now, but work done as an RA may fall under ODU's intellectual property policy | MIT, © Devin Ferrell | `LICENSE` | Professor Gupta / ODU policy | G1 | Open |
| P-06 | Usability sessions (SUS, think-aloud) if results are used beyond the lab | Materials written, no sessions run | `docs/usability/` | ODU IRB, for a determination | G1 | Deferred |
| P-08 | Regulatory status: research tool, not a medical device | App small print says so; no sign-off | Audit N-07 | Lab | G1 | Open |
| P-09 | Languages and reading level the app must support | English only | Audit N-05 | Lab | G1 | Open |
| P-10 | Whose phones the study runs on: the lab's or the caregivers' own. If their own, a written rule for what happens to the data when a caregiver leaves | Not decided. No real data on any phone (P-03) | Build plan Stage 6 | Lab, with P-03 and P-04 | G2 | Open |
| P-11 | Free-text notes: keep, limit or remove | Kept, 120 characters, with "no names" beside the field. The data dictionary marks them "check before sharing" | Build plan 5.0 | Lab, with P-03 | G2 | Open |
| P-12 | The wording "This app tells no one": a log is a record for the study, not an alert; for an injury or an emergency, do what your workplace says | Added to the welcome list and the About page in step 1.10 (PR #56). Reading level about grade 3 | Build plan 1.10 | Dr. Gupta | G1 | Proposed |

## V. Validation and verification

Each check is done by someone or something other than the author.

| ID | Check | Pass mark | Evidence | Who | Gate | Status |
|---|---|---|---|---|---|---|
| V-01 | Two independent raters score the 12 fictional stories on paper | App within 1 point of each rater on 88%+ of items (manual p.7) | `docs/agreement/` | Two raters who have not seen the code | G1 (optional earlier) | Open: materials ready |
| V-02 | Missed-log simulation under the current rule | Results reported, not a pass/fail | `docs/agreement/robustness.md` | Script | G0 | Done (rerun under rule 2 on 2026-10-23) |
| V-03 | Offline test on a real iPhone after Add to Home Screen | Logs, scores and export all work with airplane mode on | Devin, 2026-10-23, his words: "I did the Home Screen test, behaved as I assume it should" and "data saved while in airplane mode and stayed after regaining connection". Logging offline and keeping the data are confirmed; scores and export offline were not itemized | Devin | G0 | Passed (2026-10-23) |
| V-04 | Lighthouse and axe (WCAG 2.2 AA) | Accessibility 100, 0 axe violations | `docs/audits/` | Tools | G0 | Done |
| V-05 | Every citation resolves and none is retracted | All sources verified or marked unverified | `research-notes.md`; 31 of 40 Crossref-verified | Crossref | G0 | Done, with 3 marked unverified (Cohen-Mansfield 1992, 1996; Yao 2023 DOI) |
| V-06 | DOMS permission quote checked in a browser | Quote matches the live page word for word | `README.md` Permissions | Devin | G0 | Open |
| V-07 | Other platform builds pass the same `docs/test-cases.json` | Same ratings on every case | `docs/test-cases.json` | Other candidates' apps | G1 | Open |
| V-08 | Literature recall against a published review | Misses reported | Möhler 2023 Cochrane: 0 of 11 caught (map was scoped to the app's questions) | Published review | G1 | Done (a gap, reported) |
| V-09 | Five-person usability test with SUS | SUS 68+ (industry average) | `docs/usability/` | Caregivers or nurses | G1 | Deferred (P-06) |
| V-10 | End-to-end check of the production build in headless Chromium at phone size: load demo data, log, undo, Scores, Day-14 review, export, reload, then reload offline | Every step works and the console has no errors | Run on 2026-10-23 | Script | G0 | Done |
| V-11 | Back-swipe on a real iPhone Home Screen app: from a Data page (such as Display), swipe back | Returns to the Data hub, and a second swipe does not reopen the page | `e2e/navigation.cjs` passes in Chromium. Devin, 2026-10-23, on his iPhone: "When swiping page navigates to the previous page". Returning to the previous page is confirmed; that a second swipe does not reopen the Data page was not itemized (covered in Chromium only) | Devin | G0 | Passed (2026-10-23) |
| V-12 | Scores by period: 5-second test and first-click test with a nurse or caregiver. Show a finished period for 5 seconds, then ask "What is the total, and which behavior got worse?" First-click tasks: find Kicking's rating and count; open another period; open History | Correct answer after 5 seconds; first click right on each task | Script in `docs/design/scores-period-verification.md`; no session run yet | A nurse or caregiver | G0 | Open |
| V-13 | Manual accessibility pass on an iPhone with VoiceOver and the largest text size. Log, undo, switch patient, open Score, read a rating, open Settings, download a backup | Each failure becomes its own fix | Build plan 2.10. Not yet done. Add the date and what failed here when it is | Devin | G1 | Open |
| V-14 | Property tests for the scoring rule: order, adding or removing a log, count bands, the 60-minute edge, the 7-day threshold, behaviors independent, across a clock change | All pass at 1,000 random cases each | `tests/engine.properties.test.ts`; build plan 2.11 (PR #59) | Tools | G0 | In review |
| V-15 | First-click test for Log on one page: name a behavior, record where the first tap lands and how long it takes, 8 behaviors, both layouts | Tabs are not faster and no less accurate, or round 3 stays | Build plan 4.6 | Devin, Shanmei | G1 | Open |
| V-16 | Internal pilot with made-up data: 7 days of logging from a script of made-up events | Kill rules in build plan 3.6 not triggered | Build plan 3.6 | Devin | G1 | Open |

## F. Proposed features

Each one waits on a lab decision or on V-01. Severity comes from the heuristic review in `docs/usability/`, where it applies.

| ID | Feature | Why | Depends on | Gate |
|---|---|---|---|---|
| F-01 | Show the resident's code on the Log screen and in the toast | Stops logs going to the wrong resident (severity 3) | none | Done (2026-10-23) |
| F-02 | Recent logs list with edit and delete after the undo window | Fixes mistakes found later | none | Built (2026-10-23): last 24 hours, edit time or delete, delete has Undo |
| F-03 | Back-date a log ("Happened earlier?") | Caregivers often log after the fact | D-02 (clusters need accurate times) | Built (2026-10-23): 5/15/30/60 min ago or a clock time, plus "approximate". How back-dated logs should count toward rating-7 clusters is still D-13 |
| F-04 | Day-14 prompt for likely 7s | Rating 7 is fragile | D-03 | G1 |
| F-05 | Medication-change marker on the charts, with a baseline period first | The lab's goal is reducing medication | Lab | G1 |
| F-06 | Rater print view of 14-day counts per behavior | Supports a rater's CMAI interview (as with the AVP-786 caregiver diary) | Lab | G1 |
| F-07 | Target behaviors: pick 1 to 3 to sort to the top | Long scroll (walkthrough W4); clinicians judge change behavior by behavior | Lab | G1 |
| F-08 | Show total change next to published meaningful-change values | Two values disagree: about -4 (Liu 2025) vs -20 (Meunier 2024) | Lab picks a value | G1 |
| F-09 | In-app page explaining how ratings are worked out | Transparency for caregivers and raters | D-01, D-02 | Built (2026-10-23): Data screen. The count table is generated from the engine, so it cannot drift from the rule; wording still needs lab review at G1 |
| F-10 | Encrypt the backup file, or a passcode on the app | A backup holds behavior logs; codes, not names, but still sensitive | P-04 | G2 |
| F-11 | Sync or shared device use for several caregivers on one resident | One phone per resident today; shift handover needs shared data | P-04, lab infrastructure | G1 |
| F-12 | Quick navigation on long screens: pinned section bar with scroll tracking on Log, Scores and Review; Data split into a hub and sub-pages; back gesture and reload keep your place | Screens were 3.3 to 5.5 phone heights with no pinned shortcuts (design note 001) | none | Built (2026-10-23) |
| F-13 | Patient switcher as a bottom sheet with badge, period and day, and last log; confirmation after switching | The native menu showed codes only and gave no confirmation, a wrong-patient risk (design note 002, iPhone screenshot 2026-10-23) | none | Built (2026-10-23) |
| F-14 | Opening the switcher by tap leaves no focus ring; the demo tag keeps its pill on the highlighted row | Devin's iPhone screenshot, 2026-10-23: a yellow ring sat on the current row and its demo tag blended into the row | none | Verified on iPhone (2026-10-23) |
| F-15 | Compact two-line "Logged" confirmation with Edit and Undo; one Log details sheet for editing, shared with Recent logs; chips replace the native menu for "what happened before" | Devin's iPhone screenshot, 2026-10-23: the confirmation wrapped to 3 lines, had mismatched buttons and opened a form inside itself (design note 003) | none | Built (2026-10-23) |
| F-16 | Sheets hold the page still and close with a swipe down; "Other" takes a short note (saved, exported); time field shown as a tappable pill | Devin's iPhone test, 2026-10-24: page scrolled behind the sheet, no swipe to close, no way to describe Other, time looked like plain text | none | Built (2026-10-24) |
| F-17 | Patients card: labeled code field with an "e.g." example and a clear empty-field message; delete confirm moves to the shared bottom sheet (Cancel, then Delete); teal focus style on text fields; old messages clear | Devin's iPhone screenshots, 2026-10-24: placeholder looked typed in, yellow ring stuck on Cancel and the field, cramped inline confirm, "Deleted" message stayed (design note 004) | none | Verified on iPhone (2026-10-26) |
| F-18 | App-wide sweep: Review rows with rating colors and a rating sheet instead of 29 native menus; period chips on Review; chart axes show every tick on round numbers; patient rows on a fixed grid; backup page in two labeled groups; Data page messages clear on leaving | Devin, 2026-10-25: find and fix other cases like F-17; screenshot tour of every screen (design note 005) | none | Verified on iPhone (2026-10-26) |
| F-19 | Sheets sit above the on-screen keyboard and keep the focused field in view | Devin's iPhone test, 2026-10-26: choosing Other opened the keyboard but the note field was hidden behind it (note 003 follow-up) | none | Verified on iPhone (2026-10-26) |
| F-21 | Delete a log with a reason and a confirm; the log is kept, marked deleted, and skipped in scoring; every edit, delete and undo goes in a change history | Devin, 2026-10-27: deletions must be accountable for the study | D-14 | Merged in PR #17 (2026-10-27), design note 007 |
| F-22 | Screen-reader names match the visible words: the patient banner says its own text plus "Choose patient" on every tab; the "At log" time button is named "At log, when I logged it" | Checks run on Devin's PC, 2026-10-27: axe 4.14 flagged `label-content-name-mismatch` on 48 screens (the banner) and on the log details sheet | none | Merged in PR #22 (2026-10-27); axe 4.14: 0 violations in 72 scans |
| F-23 | Open question from the same thread: a shorter Log screen (the Log screen was 5.3 phone screens tall). Full wording to be restored | Reserved | none | G1 |
| F-24 | Open question from the same thread: a Settings tab (Data is the tab today). Full wording to be restored | Reserved | none | G1 |
| F-25 | Shell: compact resident bar with color badge; floating bar with Log, Score and Settings (Data renamed Settings) | Mockup round 3, phase 1 | none | G0 |
| F-26 | Log: behavior icons, 3-across left-aligned tiles, count top right, most-logged row, group tabs | Mockup round 3, phase 2 | F-25 | G0 |
| F-27 | Report, Today: logs by hour, behaviors you can open, Remove asks for a reason | Mockup round 3, phase 3 | F-25 | G0 |
| F-28 | Report, Two weeks: charts, behavior groups, the table, patterns, CSV export | Mockup round 3, phase 4 | F-27, D-17, D-18 | G0 |
| F-29 | Score: the mockup's row style and "vs last" arrows, behaviors first per D-08 | Mockup round 3, phase 5 | F-28 | G0 |
| F-30 | Patient switcher builds its list from the current patients, not the last database answer | Stops a stale list after adding patients (audit A-01, A-02). In review: PR #43 | none | G0 |
| F-31 | Restoring a backup checks every entry and skips bad ones, counting them | A damaged or hand-edited file must not put impossible dates or codes in the data (audit A-03). In review: PR #47 | none | G0 |
| F-32 | A log cannot be dated before the patient's first day | Keeps every log inside a period (audit A-04). In review: PR #50 | F-31, D-19 | G0 |
| F-33 | A failed save shows a clear message, and a crash shows one plain screen | Silent failure looks like success (audit A-05, A-06). In review: PR #52 | none | G0 |
| F-34 | CSV exports cannot run as spreadsheet formulas | A text cell starting with =, +, - or @ can run in Excel (OWASP CSV injection). In review: PR #48 | none | G0 |
| F-35 | The app moves to the new day at midnight and when it is reopened | A phone left open overnight logged to yesterday (audit A-11). In review: PR #53 | none | G0 |
| F-36 | A reminder to download a backup when the last one is old | Logs are only on the phone until backed up (audit A-12). In review: PR #54 | none | G0 |
| F-37 | One "What counts as each behavior?" sheet in place of an info button on each tile | 29 small targets next to 29 large ones (Part 8, U4). Build plan 4.1 | F-26 | G1 |
| F-38 | Watching hours: record when someone was with the resident, so "nothing logged" can be told from "nobody was watching" | Sensor studies' "not agitated" class includes anything staff did not see (Iaboni 2022, DOI 10.1002/dad2.12305; Khan 2021, arXiv 2104.09305, preprint). That the app can fix this is an inference. Build plan 5.6, lane B, switched off | D-25, D-11 | G1 |
| F-39 | Optional "it stopped" tap, giving a log an end time | Sensor models need a start and an end (Iaboni 2022). Build plan 5.7, lane B, switched off | F-44 | G1 |
| F-40 | Clock check screen in lab view: how far the phone's clock is from a reference the caregiver reads out | Event times must line up with sensor time. Build plan 5.8, lane A, shown only when lab view is on | F-48 | G1 |
| F-41 | Three more "just before" chips on the confirmation | Triggers differ by person (Bankole 2020, DOI 10.1177/1533317520906686). Build plan 5.9, lane B, switched off | F-48 | G1 |
| F-42 | Pattern card names its evidence in lab view: episodes cluster by time of day, triggers differ by person | Abedi 2025 (preprint, arXiv 2506.06306); Bankole 2020. Supports an existing screen and adds nothing to build. Build plan 4.3 | D-18 | G1 |
| F-43 | Alert check: could the app's logs feed an alert. Design note only | Needs data to leave the phone, which is on the Stop list. Build plan 7.1 | P-03, P-04 | G2 |
| F-44 | Database version 4: fields and tables for caregivers, watches, end times, archive | Needed by the lane B features. Build plan 5.1, switched off | F-48, D-20, D-22 | G1 |
| F-45 | Caregiver profiles: who made each log | Build plan 5.2 (R2), lane B, switched off | F-44 | G1 |
| F-46 | On-phone PIN, 4 digits, once per shift | Build plan 5.3 (R1), lane B, switched off. Uses the threat model from step 3.3 | F-45, P-10 | G1 |
| F-47 | Blind day-14 CMAI: the caregiver fills a full CMAI for the period without seeing the app's ratings | Compares the app with the caregiver's own rating (D-14). Build plan 5.4, lane B, switched off | D-24, D-06 | G1 |
| F-48 | Study settings: one place where every lane B feature has a switch, fixed when the app is built | A caregiver cannot turn anything on. Build plan 5.0 | none | G1 |
| F-49 | Tabs: Log, Today, Two weeks, Settings | Mockup round 4. Build plan 4.0, 4.2 to 4.4 | F-25 | G1 |
| F-50 | Log on one page with jump links | With group tabs 20 of 29 behaviors are behind a tab at any moment (Part 8, U2). Build plan 4.6 | F-49, V-15 | G1 |
| F-51 | "When did it happen" chips on the confirmation | Caregivers log after the event, so the worst behaviors get the latest times (Part 8, U5). Build plan 4.7 | F-49 | G1 |
| F-53 | Ask the phone to keep the app's data | Browsers may clear a site's data under storage pressure (audit A-13). In review: PR #55 | none | G0 |
| F-54 | Copyable diagnostics: the last 30 errors, no patient codes, nothing sent anywhere | When a caregiver says "it did not save", nobody can see why. In review: PR #60 | F-33 | G0 |

## Decision log

### Scores period revision · F-20 · 2026-10-26

Implemented on a review branch: one selected period scopes totals, behaviors, status, group values, coverage and hourly counts; totals and behavior scores appear near the top. History is explicitly opened and compares finished periods only. No scoring rule or storage schema changed. [Design note](design/notes/006-scores-by-period.md), [verification](design/scores-period-verification.md). Operator review and merge pending; representative-caregiver usability remains unverified (V-09). A fresh full-app axe run found existing label/name mismatches outside Scores; the same findings were reproduced on baseline. Scores has zero violations in all four modes.

| Date | Change | By | Approved by |
|---|---|---|---|
| 2026-10-27 | README "How this was built" corrected: the AI agent wrote the scoring spec and test cases; Devin set the requirements and study rules and reviewed every change | Claude (cloud), on Devin's ask | n/a (docs only, no scoring change) |
| 2026-10-27 | Accessible names match visible text (F-22): patient banner drops its custom label on every tab; "At log" button label starts with its visible words. No scoring change | Claude (cloud), from the PC check run | Pending (Devin) |
| 2026-10-26 | F-20 additions after comparing two builds (note 006): change since last period on each behavior row (D-10 rule), period in the URL `#/scores/p<n>`, arrow buttons so period chips fit, in-progress hint on earlier periods, History follows "show all". Claude build PR #15 closed in favour of this layout | Devin (chose the layout) | n/a (no scoring change) |
| 2026-10-26 | Period-specific Scores overview (F-20): total and behavior scores first, counts and review sources visible, supporting data scoped to the same range, finished history disclosed separately | Codex, at operator request | Pending operator review; no scoring change |

Newest first. Every rule change and every sign-off goes here, with who and when.

| Date | Change | By | Approved by |
|---|---|---|---|
| 2026-11-06 | `patient-switcher` check waits up to 3 s for the search to filter (and for the empty result), waits for the search box to appear, and on failure prints the rows and search box it saw from one read. It failed "search filters to P-03" on CI runners (PR #37 twice; main 2026-11-06, which skipped that deploy). Cause not yet confirmed: an earlier 3 s wait on PR #37 still failed once, so a slow re-render may not be the whole story; the printed search box value will show whether the query is being reset. Test only. No app, scoring or data change | Claude (cloud), on Devin's ask | n/a (test only, no scoring change) |
| 2026-11-04 | Removed unused `itemById` helper from `src/scoring/items.ts` (no callers, no tests). No scoring rule or output change | Claude (cloud) | Devin (decision card, 2026-11-04) |
| 2026-11-04 | `patient-switcher` check waits for a row's period, day and last log before reading them. The switcher shows codes first and adds those details when the database answers (about 10 ms later locally); the check read the row in that gap on a CI runner and failed on PR #34. No app, scoring or data change | Claude (cloud), on Devin's ask | n/a (test only, no scoring change) |
| 2026-11-04 | Sheet fix: ignore a dialog "close" event that arrives after the sheet was reopened (it closed the reopened sheet; root cause of the intermittent `flows` CI timeout on main 2026-11-03 and PR #34). Regression check added to `e2e/flows.cjs`. No scoring or data change | Claude (cloud), on Devin's ask | n/a (bug fix, no scoring change) |
| 2026-11-03 | CI and security (PR 2): browser checks and axe run in CI on every PR; lint, type check, coverage floors and `npm audit` in CI; deploy-only Pages permissions; Dependabot; Content-Security-Policy in the built app; Playwright and axe-core pinned. No scoring or data change | Claude (cloud), on Devin's ask | n/a (tooling only, no scoring change) |
| 2026-11-03 | Project setup (PR 1): editor and Git config, Node 22 pinned, ESLint and type check as their own commands, pre-commit hook, CHANGELOG, SECURITY, CITATION; NOTICE placeholder replaced (P-01 unchanged); F-21 and F-22 rows marked merged. No app or scoring change | Claude (cloud), on Devin's ask | n/a (tooling only, no scoring change) |
| 2026-10-27 | Daylight saving fix: days and periods are counted on the calendar (`addDays`, `dayIndex` in the engine) instead of 24-hour blocks, so day and period lines stay at local midnight after a clock change. Before, every line after a change sat an hour off, and a log between 11 pm and midnight counted for the next day or period. Also fixes the typed clock time from the day before and demo data loaded after a change. Tests in `tests/dst.test.ts` run in New York time. The written rule (spec section 7) is unchanged, so `RULE_VERSION` stays `cmai-count-rule-2`; ratings change only for logs near a clock change | Devin | n/a (implementation now matches the spec) |
| 2026-10-27 | Accessibility audit joins the one-command check run: `npm run checks` also runs `docs/audits/axe-run.cjs`, which now exits with a `FAIL:` line naming each screen and mode with a violation, and uses Playwright's own Chromium unless `CHROME` is set. No app change | Devin | n/a (no scoring change) |
| 2026-10-27 | One-command browser checks: `npm run checks` builds, runs flows, navigation and scores-period against a local preview and writes one report; `checks:report` pushes only that report to the `checks-report` branch. CLAUDE.md tells Claude Code on the home desktop what "run the CMAI checks" means. No app change; nothing new deploys | Devin (no copy-paste prompts for machine work) | n/a (no scoring change) |
| 2026-10-27 | Locked scores and soft delete (D-14, F-21, design note 007): the app's rating can't be changed by anyone; day-14 review screen removed; delete takes a reason and a confirm and keeps the log marked deleted; change history for edits, deletes and undos; `scores.csv` drops `final_rating` and `reviewed`, `observations.csv` adds `deleted_at`, `delete_reason`, `delete_note`. Count rule unchanged, so `RULE_VERSION` stays `cmai-count-rule-2` | Devin (rules set in meeting with Dr. Gupta) | Pending (D-14) |
| 2026-10-26 | Sheets follow the keyboard (F-19): `visualViewport` sets the sheet's bottom offset and height while it is open | Devin | n/a (no scoring change) |
| 2026-10-25 | App sweep (F-18, design note 005): Review ratings picked in a sheet instead of native selects (same review records, no scoring change); chart axis ticks fixed; patient rows, backup page and Data messages tidied | Devin | n/a (no scoring change) |
| 2026-10-25 | Patients card (F-17, design note 004): delete confirmation uses the shared Sheet; text-field focus becomes a teal outline and halo outside high contrast; empty Add gets its own message | Devin | n/a (no scoring change) |
| 2026-10-24 | Sheet behavior (F-16): page scroll lock and swipe-to-close in the shared Sheet; new optional `beforeNote` field on logs (free text, no names, 120 chars) carried in backup and CSV `before_note` | Devin | n/a (no scoring change) |
| 2026-10-23 | Patient switcher (round 9, F-13, design note 002): the native pop-up menu is replaced by a bottom sheet with badge, period and day, and last log; search at 8+ patients; "Now on P-02" confirmation; banner is a real button (fixes the yellow focus ring left after a tap on iPhone) | Devin | n/a (no scoring change) |
| 2026-10-23 | Switcher focus (F-14): initial focus depends on how the sheet was opened. Keyboard lands on the current patient; tap or mouse lands on the sheet itself, because Safari draws the focus ring on any button focused by script | Devin | n/a (no scoring change) |
| 2026-10-23 | Log confirmation (F-15, design note 003): snackbar holds feedback and actions only; all log editing moves to one sheet built on a shared Sheet component; snackbar colors become inverse-surface tokens covering high contrast | Devin | n/a (no scoring change) |
| 2026-10-23 | V-03 (iPhone Home Screen offline test) recorded as passed on Devin's report. V-11 (back-swipe on iPhone) added and passed on Devin's report | Devin | n/a |
| 2026-10-23 | Change process written down (`docs/process/change-process.md`, PR template). Navigation (round 8, F-12, design note 001): pinned section bar with scroll tracking on Log, Scores and Review; Review grouped like Log with progress per group; Data split into a hub and five pages; screens in the URL so the back gesture and reload keep your place; tapping the current tab scrolls to top; browser checks moved into `e2e/` | Devin | n/a (no scoring change) |
| 2026-10-23 | Light and dark mode as a setting (round 7): header sun/moon toggle, Data > Display "Appearance" (Match phone, Light, Dark), theme set before first paint, status bar follows. Replaces the media-query-only dark mode | Devin | n/a (no scoring change) |
| 2026-10-23 | High-contrast display option (round 6): Data screen "Display" setting (Match phone, Standard, High). High uses AAA text contrast (7:1 or better), 2px outlines and a stronger rating ramp, in light and dark. "Match phone" follows the phone's Increase Contrast setting. Windows forced-colors mode keeps the selected-tab and rating-cell cues | Devin | n/a (no scoring change) |
| 2026-10-23 | Visual redesign (round 5): care-teal palette, Atkinson Hyperlegible Next, patient banner, grouped Log list, amber status instead of red and green, Okabe-Ito chart colors, new icon. Sources in `docs/design/design-brief.md` | Devin | n/a (no scoring change) |
| 2026-10-23 | UX round 4: recent logs (edit, delete), back-dating, restore from backup, delete patient, remove demo data, welcome screen, loading and storage-error states, icon tab bar with review-due dot, install button, in-app rating explainer | Devin (F-02, F-03, F-09; heuristic review round 4) | n/a (no scoring change) |
| 2026-10-23 | Lab approvals deferred until after hiring; this register created | Devin | n/a (process) |
| 2026-10-23 | Log screen and toast name the resident; toast shows the time of the log, not the time of the last redraw | Devin (F-01) | n/a (no scoring change) |
| 2026-10-22 | `cmai-count-rule-2`: rating-7 clusters found with a 60-minute window across midnight | Devin (from robustness proposal 2) | Pending (D-02) |
| 2026-10-22 | "Nothing to log today" check-in and unlogged-day counts | Devin (robustness proposal 4) | Pending (D-11) |
| 2026-10-22 | Meaningful-change marker (2+ points, or 1 point held) | Devin (research map) | Pending (D-10) |
| 2026-10-22 | Item definitions reworded; MIT + NOTICE | Devin (permissions audit) | Pending (P-01, P-05) |
| 2026-10-21 | `cmai-count-rule-1`: count bands and rating-7 rule | Devin | Pending (D-01, D-02) |
