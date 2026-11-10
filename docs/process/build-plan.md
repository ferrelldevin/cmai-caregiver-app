# CMAI Tracker build plan (v5, 2026-11-10)

Replaces v4 of the same day, which is kept at `plans/archive/build-plan-v4-2026-11-10.md`. Step numbers from v4 are unchanged wherever the step survives. Findings named A-, B-, C- and N- are in `audits/whole-project-audit-2026-11-10.md`. Checked against `main` at `b753f6f`.

This plan covers the whole project: the open pull requests, the bugs the audit proved, the checks and deploy, the lab paperwork, the caregiver screens, the requirements that need Dr. Gupta, the research proposals, and a pass over each discipline a professional team would bring.

The brief it was written against is `plans/build-plan-v5-scope.md`.

## Part 0. What changed from v4

| Change | Where | Why |
|---|---|---|
| **Lane B no longer waits.** It is built now on assumed approval, as a draft pull request, switched off for caregivers until Dr. Gupta signs | 1.3 | Devin, 2026-11-10: "assume that Gupta approves and that there's nothing physically blocking us" |
| **A third lane, Stop,** for the few things that cannot be done without a person, an account or a send | 1.3 | Same message: "If we physically need his approval to build it, then we can stop" |
| **Steps may stack** on an unmerged branch. Waiting for a merge is not a block | 1.4 | Same |
| **Stage 5 is fully specified:** study settings, database version 4, caregiver profiles, PIN, blind day-14 CMAI, backup protection, export format 2 | Stage 5 | It was a list of titles in v4 |
| **The six research proposals are steps** with register IDs F-38 to F-43 and their sources | 5.6 to 5.10, 7.1, Part 9 | Research scan, 2026-11-10 |
| **A discipline-by-discipline pass,** each gap a step or a written "not now" | Part 7 | Devin's list |
| **A design and flow review** with four proposed screen changes drawn as mockups | Part 8, steps 4.0, 4.6, 4.7 | "Easy for these caregivers to use, and it needs to make sense" |
| **Tabs proposed as Log, Today, Two weeks, Settings.** Steps 4.2 to 4.4 are rewritten for it | 4.2 to 4.4 | Score and Report's two-week view show the same table twice (Part 8, U1). Decision card posted; reversible |
| **New steps:** 1.9, 1.10, 2.11 to 2.13, 3.9 to 3.14, 4.0, 4.6 to 4.8, 5.0, 5.6 to 5.11, 7.1 | Status table | Parts 7 to 9 |
| **Two v4 errors fixed:** 4.1 said "chosen exactly as the mockup chooses them", but the mockup's three tiles are typed in by hand, so there was no rule. 4.1 put an info button on every tile, which invites mis-taps at 3 across | 4.1 | Read of `src/mockup/Screens.tsx`; Part 8, U3 and U4 |

---

## Part 1. How to use this plan

Read this part every time. It is written so that any model, or a new teammate, can do the next step without asking.

### 1.1 Pick the step

1. Open the status table in Part 4.
2. Take the first step whose status is `Not started`, whose "Needs" are all `Done` or `In review`, and whose "Who" is Claude.
3. `In review` means a draft pull request exists. You may build on its branch (see 1.4, row 1). Say in your pull request which branch you stacked on.
4. Do that one step. Do not start a second step in the same pull request.
5. If the step says **Devin** in the "Who" column, do not do it yourself. Tell Devin it is his turn and what to click, then take the next step that does not need it.
6. If the lane is **Stop**, do only the part the step marks "can be done now" and report.

### 1.2 Rules that do not bend

These come from the project instructions. No step in this plan overrides them.

- App ratings are locked. Nobody edits a score. Deletes need a reason and a confirm.
- Made-up data only, in code, tests, screenshots, pull requests and chat.
- **No step in this plan changes a rating.** A scoring change needs a new `RULE_VERSION` in `src/scoring/engine.ts` and updated `docs/test-cases.json`. If a step seems to need one, stop.
- Open scoring and data questions get a register ID. Never settle one silently. "Built on assumed approval" is written in the register, with the assumed answer, every time (1.3).
- Lab work stays in this project and on lab or ODU accounts.
- Any claim about the CMAI or research cites a manual page, a DOI or a register ID. An inference says it is one.
- Only Devin merges, marks a draft ready, changes GitHub settings, or sends anything to Dr. Gupta or anyone outside.

### 1.3 Three lanes

Every step is in one lane. The lane is in the status table.

| Lane | What it covers | May start | How it ships |
|---|---|---|---|
| **A. Build now** | Bug fixes, tests, checks, CI, docs, and screens that only change how existing data is shown | Now | Draft pull request. Devin merges |
| **B. Build on assumed approval** | Anything that adds or changes a stored field, adds sign-in or caregiver identity, changes what is collected, or adds to what an export contains. Making an existing export safer, or cutting the same data a different way, is lane A | Now | Draft pull request, behind a study setting that is **off** in the caregiver build (step 5.0). Register row says `Built on assumed approval (Devin, 2026-11-10). Sign-off pending`, with the assumed answer. The question stays in Dr. Gupta's review packet (3.1) |
| **Stop** | A real person or real participant data. Sending anything to Dr. Gupta or outside the lab. A server, account or approval the lab has not provided. Merging and GitHub settings | Only the part marked "can be done now" | Write the design or the draft. Do not fake the missing piece |

Test for lane A. All four must be true:

1. Ratings for `docs/test-cases.json` are unchanged.
2. No new field or table in `src/data/db.ts`, and no new value collected from a caregiver.
3. Nothing leaves the phone that did not before.
4. `git revert` of the pull request puts the app back exactly.

If 2 or 3 is false, the work is lane B. If 1 is false, stop (1.2).

Rules for lane B work:

1. **Behind a setting.** The feature reads one switch in `src/study/settings.ts` (step 5.0). Off means the app behaves and looks exactly as before. The demo build has it on, so it can be used and judged.
2. **One database change.** Every new stored field goes into database version 4 (step 5.1). Do not add a version 5 without a new step in this plan.
3. **Say how to undo it.** A database upgrade cannot be taken back on a phone. The pull request says so, and says what a phone needs after a revert (export, clear the app, restore).
4. **Register row first.** Add the row in the same pull request, before the code, with the assumed answer in plain words and what would change if Dr. Gupta picks another option.
5. **Nothing settled.** If Dr. Gupta later says no, the feature is removed or changed in one pull request and the row records it. That is the plan working, not a failure.

What is always Stop, whatever a step says:

- Real names, real residents, real times from a real resident, or any real participant data.
- A usability session, the agreement study, or any test with people outside Devin and Shanmei using made-up data.
- An IRB submission, an email to the CMAI author, a preregistration, or any message to Dr. Gupta. Draft it. Devin sends it.
- A lab server, lab accounts, REDCap, or any place data would go off the phone.
- Merging, marking ready, GitHub settings.

### 1.4 The route for every code step

Follow these in order. "Where" says where each command runs.

| # | Do | Where |
|---|---|---|
| 1 | `git fetch origin` then `git checkout -B <branch> origin/main`. If a "Needs" step is `In review`, use its branch instead of `origin/main` and name it in the pull request under "Stacked on". | Cloud thread, in the repo |
| 2 | `npm ci` | Cloud thread |
| 3 | Write the failing test or check named in the step. Run it. Confirm it fails for the reason the step gives. | Cloud thread |
| 4 | Make the change. Touch only the files the step lists. If another file needs to change, say why in the pull request. | Cloud thread |
| 5 | `npm run lint` then `npm run typecheck` then `npm run test:coverage` then `CHROME=/opt/pw-browsers/chromium npm run checks` | Cloud thread |
| 6 | Use the app with the `run-cmai` skill for any change a caregiver can see. Take before and after screenshots at 390 px wide, light and dark. Put them in the pull request description, not in git. | Cloud thread |
| 7 | Add a decision-log row to `docs/review-register.md` and an entry under Unreleased in `CHANGELOG.md`. Update this plan's status table. | Cloud thread |
| 8 | Commit, `git push -u origin <branch>`, open a **draft** pull request with `.github/pull_request_template.md`. List each acceptance criterion and how it was checked. | Cloud thread |
| 9 | Set the step to `In review` in the status table, with the pull request number. | Cloud thread |
| 10 | Mark ready and merge | **Devin**, in the browser (GitHub) |
| 11 | After the merge: confirm the "Test and deploy" run on `main` is green. Then set the step to `Done`. | Cloud thread reads the run; Devin confirms on his phone when the step says so |

On Devin's desktop, the same commands run in **PowerShell** in `C:\lab\cmai-tracker`, without the `CHROME=` prefix. After any pull that changes `package.json` or `package-lock.json`, run `npm ci` there first.

When a stacked branch's base is merged: `git fetch origin main` then `git rebase origin/main` on your branch, rerun row 5, and `git push --force-with-lease`. Only on a branch you opened.

### 1.5 Stop conditions

Stop, change nothing more, and report, if any of these happens:

- A check that passed on `main` fails on your branch and the step did not predict it.
- The step's failing test does not fail, or fails for a different reason.
- The files do not match what the step describes (the "old" code is not there).
- The change would break a rule in 1.2, or would change a rating for any case in `docs/test-cases.json`.
- The work passes the step's "Kill when".
- You are about to use real names, real times from a real resident, or any real participant data.
- The step needs something on the Stop list in 1.3.

Never skip, weaken or delete a test to get green. Never push to `main`. Never use `npm audit fix --force`.

A stop is for that step only. Report it, then take the next step that does not depend on it.

### 1.6 Where things live

| Thing | Place |
|---|---|
| Repo | `github.com/ferrelldevin/cmai-caregiver-app`; on Devin's machines `C:\lab\cmai-tracker` |
| This plan | `plans/build-plan.md` in the project folder until step 0.7 moves it to `docs/process/build-plan.md` in the repo. After that the repo copy is the source. |
| Scoring rule | `docs/scoring-spec.md`, checked by `docs/test-cases.json` and `tests/engine.test.ts` |
| Open decisions | `docs/review-register.md` |
| Change route | `docs/process/change-process.md` |
| The mockup, round 3 (decided) | `src/mockup/Screens.tsx`, `src/mockup/mockup.css`, `npm run storybook`; pictures in `mockup/round-3/` |
| The mockup, round 4 (proposed in this plan) | `plans/round-4-mockup-proposals.patch`, pictures in `mockup/round-4/img/`, review page linked in Part 8 (https://claude.ai/artifact/99uHyDxe2WmGt1b52QhEuQ) |
| Study settings (lane B switches) | `src/study/settings.ts` after step 5.0 |
| Research scan | "Missed connections in agitation detection", https://claude.ai/artifact/NEUQFz3NNuBZ3jfxsXU75L |
| Desktop check run | "Run the CMAI checks" in Claude Code on DEVIN-DESKTOP, see `CLAUDE.md` |

---

## Part 2. Decisions and assumptions

Devin's direction on 2026-11-10: take the recommended pick, record it, keep going. So each of these is **taken**, and each can be reversed by telling any thread. Only number 8 is on a card, because it changes a choice Devin made earlier.

| # | Question | Taken | What reversing it costs |
|---|---|---|---|
| 1 | What may be built before Dr. Gupta's review? | Everything except the Stop list. Lane B ships switched off for caregivers | Nothing. Lane B features are removed by their switch |
| 2 | Start Stages 0 to 2 now? | Yes | n/a |
| 3 | Browser checks on Playwright's own runner, plus WebKit (2.6) | Yes | Fall back to the scripts with a browser switch |
| 4 | When does a merge reach phones (2.7) | Every merge deploys for now, with a version stamp and live check. Versions are tagged from 2.7 on; deploying only on a tag starts at lab adoption | One line in the workflow |
| 5 | Format every file once (2.5) | Yes, after #41 and #38 | n/a |
| 6 | Major upgrades | One per pull request, each with a kill rule (2.3) | Close the pull request |
| 7 | Where this plan lives | In the repo, `docs/process/build-plan.md` | Move the file |
| 8 | Tabs | **Log, Today, Two weeks, Settings.** Score's list moves into Two weeks (Part 8, U1) | Steps 4.2 to 4.4 go back to v4's wording. No code is lost before 4.4 |
| 9 | Log layout | Round 3 as decided for step 4.1. One page with jump links is a separate step (4.6) so it can be compared and dropped | Skip 4.6 |
| 10 | R2: who sets up caregivers and residents | Whoever sets up the phone, in Settings. Caregivers are codes plus initials, never names. Any caregiver on the phone can log for any resident on it. "My residents" is an order, not a lock | Change 5.2's settings; no stored data is wrong |
| 11 | R1: how sign-in works | A 4-digit PIN per caregiver on the phone, asked once per shift, never between taps. The phone's own lock is the real guard (5.3) | Switch off; or lengthen the PIN |
| 12 | Who sees ratings during a study | Caregivers do not. Two weeks shows counts and charts to caregivers and ratings only in lab view (D-24). Built that way in the lab build; the caregiver build keeps today's behavior until D-24 is signed | One setting |
| 13 | R4: when a day ends | Local midnight | One function |
| 14 | D-17, D-18 | Group average, and the mockup's pattern thresholds, both shown as open in lab view | Constants in one file |
| 15 | Blind day-14 CMAI, codes 8 and 9 | Built as spec section 5 describes. Code 8 stays a separate code (5.4) | Switch off |
| 16 | Free-text notes | Kept, 120 characters, with "no names" beside the field. The data dictionary marks them "check before sharing" (P-11) | One setting hides the fields |
| 17 | Backup file | Protected with a passphrase once 5.11 is built (F-10): on in the lab build, off in the caregiver build until signed | One setting |

---

## Part 3. Where things stand (2026-11-10)

| Item | State |
|---|---|
| `main` | `b753f6f`. All checks pass (see the audit, "What I ran") |
| Mobile requirements | R1 Login missing. R2 Caregiver partial. R3 One-click mostly met. R4 Daily report missing. R5 Two-week report mostly met |
| Mockup build (note 008) | Phase 0 merged (#37). Phase 1 shell is draft PR #41, green. Phases 2 to 5 not started |
| Open pull requests | #28 actions, #30 and #31 security patches (green), #32 #33 #42 Dependabot (failing), #38 drift checks (draft, stale), #41 shell (draft, green) |
| Threads at work | "Fix audit bugs and harden checks" (Stages 1 and 2). "Draft lab readiness documents" (Stage 3). "Build the mockup into the app" (PR #41, Stage 4). Each updates its own rows in Part 4 |
| Dr. Gupta's review | Workbook with him. Not in the project folder. 14 scoring decisions and 11 questions open. Assumed approved for the purpose of building, not approved (Part 2), still asked in the packet (3.1) |
| Real data | None. Demo data only |

---

## Part 4. Status table

Update the Status column in the same pull request that does the step. Status is one of `Not started`, `In review (#n)`, `Done`, `Stopped: <why>`.

| Step | What | Lane | Who | Needs | Status |
|---|---|---|---|---|---|
| 0.1 | Merge the two green security patches (#30, #31) | A | Devin | none | Not started |
| 0.2 | Rerun and merge the actions update (#28) | A | Devin | none | Not started |
| 0.3 | Merge the shell (#41) | A | Devin | none | Not started |
| 0.4 | Rebase, refresh and merge the drift checks (#38) | A | Claude, then Devin | 0.3 | Not started |
| 0.5 | Delete merged branches, turn on auto-delete | A | Devin | 0.3, 0.4 | Not started |
| 0.6 | Run the CMAI checks on the desktop | A | Devin | 0.4 | Not started |
| 0.7 | Put this plan in the repo; fix the skill and plan v3 | A | Claude | none | Not started |
| 0.8 | Bring the register up to date | A | Claude | 0.3, 0.4 | Not started |
| 0.9 | Replace the project-folder copies with pointers | A | Claude | 0.7 | Not started |
| 1.1 | Patient switcher always lists the current patients | A | Claude | none | Not started |
| 1.2 | Restore rejects bad files; Export cannot be broken by one | A | Claude | 0.4 | Not started |
| 1.3 | Warn about logs before a patient's first day | A | Claude | 1.2 | Not started |
| 1.4 | A failed save tells the caregiver | A | Claude | 0.3 | Not started |
| 1.5 | Welcome screen matches the app | A | Claude | 0.3 | Not started |
| 1.6 | CSV cells cannot run as formulas | A | Claude | 0.4 | Not started |
| 1.7 | "Today" stays right when the app is left open | A | Claude | 0.3 | Not started |
| 1.8 | Backup reminder | A | Claude | 0.3 | Not started |
| 1.9 | Ask the phone to keep the app's data | A | Claude | 1.4 | Not started |
| 1.10 | Say what the app does not do | A | Claude | 0.3 | Not started |
| 2.1 | Dependabot: minors together, majors alone | A | Claude | none | Not started |
| 2.2 | Close the three failing Dependabot pull requests | A | Devin | 2.1 | Not started |
| 2.3 | Major upgrades, one at a time | A | Claude | 2.1 | Not started |
| 2.4 | Workflow hardening | A | Claude | 0.2 | Not started |
| 2.5 | Format every file once | A | Claude | 0.3, 0.4 | Not started |
| 2.6 | Browser checks on Playwright Test, plus WebKit | A | Claude | 0.4, 2.5 | Not started |
| 2.7 | Releases, live check, undo steps | A | Claude | 0.4 | Not started |
| 2.8 | Size budget; load charts only where shown | A | Claude | 2.5 | Not started |
| 2.9 | Stop adding screenshots to git | A | Claude | none | Not started |
| 2.10 | Manual accessibility pass | A | Claude and Devin | 0.3 | Not started |
| 2.11 | Property tests for the scoring rule | A | Claude | none | Not started |
| 2.12 | Dependency review on every pull request | A | Claude | 2.4 | Not started |
| 2.13 | Diagnostics a caregiver can copy | A | Claude | 1.4 | Not started |
| 3.1 | Review packet for Dr. Gupta | A to write, Stop to send | Claude, then Devin | 0.8 | Not started |
| 3.2 | Data management plan, one page | A to write | Claude, then Devin | none | Not started |
| 3.3 | Threat model and login standard | A to write | Claude | none | Not started |
| 3.4 | Data dictionary and export format version | A to write; export changes are step 5.10 | Claude | 0.4 | Not started |
| 3.5 | Permission, ownership, citation, accounts | Stop (Devin sends) | Devin | 3.1 | Not started |
| 3.6 | Internal pilot, usability sessions, agreement study | A for the pilot; Stop for the rest | Devin and the lab | 5.4, 5.6, 5.7 for the pilot; P-06 for the rest | Not started |
| 3.7 | Wording once the lab adopts the app | A | Claude | Dr. Gupta says adopted | Not started |
| 3.8 | Continuity: CONTRIBUTING, access, runbook | A | Claude and Devin | 0.7 | Not started |
| 3.9 | Study protocol and analysis plan, draft | A to write, Stop to register or send | Claude, then Devin | 3.4 | Not started |
| 3.10 | Research notes: add the scan's sources after a full-text check | A | Claude | none | Not started |
| 3.11 | Who did what, and how AI was used | A to write | Claude, then Devin | none | Not started |
| 3.12 | Caregiver quick card and training script | A | Claude | 4.1 | Not started |
| 3.13 | Options note: lab server, accounts, sync | A to write, Stop to build | Claude | 3.3 | Not started |
| 3.14 | Sensor pairing guide | A to write | Claude | 5.8, 5.10 | Not started |
| 4.0 | Round 4 proposals into the mockup | A | Claude | none | Not started |
| 4.1 | Log (mockup phase 2) | A | Claude | 0.3 | Not started |
| 4.2 | Today tab (mockup phase 3, R4) | A | Claude | 4.1 | Not started |
| 4.3 | Two weeks tab (mockup phase 4, R5) | A | Claude | 4.2 | Not started |
| 4.4 | Fold Score into Two weeks (mockup phase 5) | A | Claude | 4.3 | Not started |
| 4.5 | Show Dr. Gupta the working screens | Stop (Devin shows) | Devin | 4.3, 3.1 | Not started |
| 4.6 | Log on one page with jump links | A | Claude | 4.1, 4.0 | Not started |
| 4.7 | "When did it happen" on the confirmation | A | Claude | 4.1 | Not started |
| 4.8 | Lab labels only in lab view | A | Claude | 5.0, 4.2 | Not started |
| 5.0 | Study settings: one place for every switch | A | Claude | none | In review (#51) |
| 5.1 | Database version 4 | B | Claude | 5.0, 1.2 | Built (stacked on #51 and #47); push waits on Devin allowing a branch per step. Patch: plans/stage5/db-v4.patch |
| 5.2 | R2: caregiver profiles and resident order | B | Claude | 5.1 | Built on branch claude/caregivers (stacked on 5.1 and #41); all checks pass incl. new lab-build check; push waits on Devin allowing a branch per step. Patch: plans/stage5/caregivers.patch |
| 5.3 | R1 option A: on-phone PIN | B | Claude | 5.2 | Built on branch claude/pin (stacked on 5.2); all checks pass incl. new lab sign-in check; push waits on Devin allowing a branch per step. Not yet timed on a phone. Patch: plans/stage5/pin.patch |
| 5.4 | Blind caregiver CMAI at day 14, codes 8 and 9 | B | Claude | 5.2 | Built on branch claude/blind-cmai (stacked on 5.3); all checks pass incl. new lab blind-rating check; push waits on Devin allowing a branch per step. Not yet timed by a person (criterion 7). Patch: plans/stage5/blind-rating.patch |
| 5.5 | R1 option B: lab accounts or REDCap | Stop (design in 3.13) | open | a server from the lab | Not started |
| 5.6 | Watching hours (F-38) | B | Claude | 5.2, 4.2 | Not started |
| 5.7 | Optional "it stopped" tap (F-39) | B | Claude | 5.1, 4.2 | Not started |
| 5.8 | Clock check screen (F-40) | A | Claude | 5.0 | Not started |
| 5.9 | Three more "just before" chips (F-41) | B | Claude | 5.0 | Not started |
| 5.10 | Export format 2 and the label file (D-23) | B | Claude | 5.1, 3.4 | Not started |
| 5.11 | Protect the backup file (F-10) | B | Claude | 5.10 | Not started |
| 6 | Real-data readiness checklist | Stop | Devin and the lab | all above | Not started |
| 7.1 | Alert check (F-43), design note only | Stop | Claude | a sensor model and a server | Not started |

---

## Part 5. The steps

### Stage 0. Clear the queue

No new code except in 0.4, 0.7 and 0.8. Goal: `main` holds everything that is finished, and the written rules agree with each other.

#### 0.1 Merge the two green security patches

- **Why:** B-01. Both pass every check. The vite fix closes advisories about its dev server on Windows.
- **Who and where:** Devin, browser (GitHub).
- **Do:** open pull request #30, press Merge. Open #31, press Merge. If GitHub says the branch is out of date, press "Update branch", wait for green, then merge.
- **Then, PowerShell in `C:\lab\cmai-tracker` on each machine:** `git checkout main`, `git pull origin main`, `npm ci`.
- **Done when:** both show Merged, and the "Test and deploy" run on `main` is green.

#### 0.2 Rerun and merge the actions update

- **Why:** B-04. The runner warns on every run that `checkout@v4` and `setup-node@v4` are deprecated. #28 last ran before the timing bug was fixed.
- **Who and where:** Devin, browser.
- **Do:** on #28, comment `@dependabot rebase`. Wait for the checks.
- **Done when:** both check jobs are green and it is merged.
- **Stop if:** a job fails. Paste the failing job's name into the thread. Do not merge.

#### 0.3 Merge the shell (#41)

- **Why:** it is finished, green, and every later screen step builds on it. B-05: it must go in before #38.
- **Needs:** none.
- **Who and where:** Devin, browser.
- **Do:** read the second commit only (`1bfd48c`, 16 files). The first commit is formatting. Press "Ready for review", then Merge.
- **Then, on your iPhone:** open the installed app. Confirm the resident bar and floating tab bar show, and the tabs read Log, Score, Settings.
- **Done when:** merged, deploy green, phone check passed.

#### 0.4 Rebase, refresh and merge the drift checks (#38)

- **Why:** B-05, B-11, A-08, C-03. It adds release tags, the app version and build in every backup, `npm run check:docs`, CODEOWNERS and the screenshot check.
- **Who:** Claude, then Devin merges.
- **Branch:** `claude/project-thread-tt1926` (the pull request's own branch).
- **Do, cloud thread:**
  1. `git fetch origin main claude/project-thread-tt1926`
  2. `git checkout claude/project-thread-tt1926` then `git merge origin/main`
  3. Conflicts will be in `src/ui/DataScreen.tsx` and possibly `docs/review-register.md`, `CHANGELOG.md`, `README.md`. For `DataScreen.tsx`: take `main`'s version of the whole file, then re-apply the one real change from #38, the build shown next to the version on the "How ratings are worked out" page. For the docs: keep both sides' rows.
  4. The screenshot baselines in `e2e/screenshots/` were drawn before the shell. Regenerate them the way `e2e/README.md` on that branch says. Look at each new picture before committing it.
  5. Run the route in 1.4 from row 5.
- **Acceptance criteria:**
  1. `npm run check:docs` passes.
  2. `npm run checks` passes including the screenshot check.
  3. A backup made in the app contains `appVersion` and `build`.
  4. `git diff origin/main -- src/ui/DataScreen.tsx` shows only the build-stamp change.
- **Done when:** merged and green on `main`.
- **Stop if:** the merge conflicts in `src/scoring/` or `src/data/`. Those were not expected.

#### 0.5 Delete merged branches, turn on auto-delete

- **Why:** B-12.
- **Who and where:** Devin, browser.
- **Do:**
  1. Settings, General, Pull Requests: tick "Automatically delete head branches".
  2. On the Branches page, delete every `claude/*` and `compare/*` branch marked Merged.
  3. Keep: `main`, `checks-report`, any branch with an open pull request.
  4. `claude/scores-by-period` is not merged (2 commits from 2026-10-26, the build that lost to the current Scores layout). Delete it only if you agree it is dead.
- **Done when:** the Branches page shows only `main`, `checks-report` and branches with open pull requests.

#### 0.6 Run the CMAI checks on the desktop

- **Why:** B-13. The last desktop report is from 2026-10-27 on Node 24.
- **Who and where:** Devin. Claude Code on DEVIN-DESKTOP, in `C:\lab\cmai-tracker`. Say: `Run the CMAI checks`.
- **Before:** in PowerShell, `node -v` must print `v22`. If not, `fnm use`.
- **Done when:** the `checks-report` branch has a report dated today with `RESULT: PASS` and a Node 22 line.
- **If it fails:** paste the `RESULT:` line and every `FAIL` line into the thread. That output decides whether step 1.1 is the whole fix (see 1.1).

#### 0.7 Put this plan in the repo; fix the skill and plan v3

- **Why:** C-01, C-02, C-11, decision 7.
- **Branch:** `claude/build-plan-v5` (this file is v5; the step is otherwise as written for v4)
- **Files:** `docs/process/build-plan.md` (new, a copy of this file), `.claude/skills/requirement-pr/SKILL.md`, `docs/design/notes/008-mockup-to-app.md`, `docs/process/change-process.md`, `README.md`.
- **Change in the skill, step 1, old:**
  ```
  1. Confirm Dr. Gupta has marked up the review workbook for this requirement. If not, stop and say so.
  2. Take the next requirement in the plan's build order. One requirement per PR.
  ```
  **new:**
  ```
  1. Open `docs/process/build-plan.md`. Take the first step that is Not started and whose Needs are Done.
  2. Check its lane. Lane A may start. Lane B is built behind a study setting that is off in the caregiver build, and its register row says "Built on assumed approval. Sign-off pending". A step marked Stop does not start.
  ```
- **Change in the skill, step 4, old:** `numbered after the last note (the two notes then in the list)` **new:** `numbered after the last note in docs/design/notes/`
- **Change in note 008:** under "Decision", add one line: `The order and acceptance criteria now live in docs/process/build-plan.md, Stage 4.`
- **Change in `change-process.md`:** add a section "Lanes" with the three-lane table, the four-part test and the lane B rules from 1.3 of this plan.
- **Project folder (not the repo):** add this as the first line of `cmai-mobile-plan.md`: `> Replaced on 2026-11-10 by docs/process/build-plan.md in the repo. Kept as the record of what went to the lab on 2026-10-28.`
- **Project instructions:** Devin changes the line "Nothing gets built until Dr. Gupta marks up the review workbook" to "Follow docs/process/build-plan.md. Lane B work is built switched off on assumed approval and is switched on only after Dr. Gupta's sign-off is in the register." Claude cannot edit project instructions.
- **Acceptance criteria:**
  1. Searching `.claude` and `docs` for the old list of note numbers in the skill finds nothing.
  2. The skill, note 008, the change process and the plan give the same build order.
- **Done when:** merged, and Devin has changed the project instructions.

#### 0.8 Bring the register up to date

- **Why:** C-03, C-04.
- **Branch:** `claude/register-catch-up`
- **File:** `docs/review-register.md` only.
- **Do:**
  0. Besides the rows below, add a row for every ID in the table in Part 9.1 of this plan, with status `Proposed`, or `Built on assumed approval. Sign-off pending` once its step is In review. Where this step's older wording and a Stage 5 "Assumed answer" differ (D-20 is one), the row's "today" column says what the app does today and the "proposed" column carries the Stage 5 answer.
  1. Add rows for every ID used elsewhere. D-15, D-16, F-23, F-24: copy the wording from the 2026-11-04 comparison page (link in project memory). If that page cannot be read, add each as "Reserved 2026-11-04, wording to be restored" and tell Devin. F-26 to F-29, D-17, D-18: from note 008's table. P-07: from PR #41 if not already merged with it.
  2. Add the new rows below. Status `Open`, sign-off from Dr. Gupta, gate G1 unless stated.

  | ID | Decision | In this build | Evidence |
  |---|---|---|---|
  | D-19 | A log dated before the patient's first day, and which start date wins when a backup is merged onto a phone that already has that patient | Kept, counted in no period, warned about (step 1.3) | Audit A-04 |
  | D-20 | Can a patient be deleted once real logging starts, or only archived with a reason | Deleted for good after a confirm, history erased | Audit A-09 |
  | D-21 | When is a finished period's rating final? Proposed: 24 hours after the period ends, and the export says so | Recomputed on every export | Audit A-10 |
  | D-22 | Time zone and clock: record the phone's UTC offset on each log; what to do when a phone changes zone | Local time of the phone, offset not stored | Audit A-14, N-03 |
  | P-08 | Regulatory status: research tool, not a medical device | App small print says so; no sign-off | Audit N-07 |
  | P-09 | Languages and reading level the app must support | English only | Audit N-05 |

  3. Rewrite the Gates table: G0 `Done (interview, October 2026)`. G1 `Lab adoption: Dr. Gupta says in writing that the lab will use the app`. G2 unchanged. Do not change any item's gate.
  4. Put section V's rows in number order.
- **Acceptance criteria:**
  1. `npm run check:docs` passes (it checks every ID used in the docs has a row).
  2. No existing row's "In this build" text changed.
- **Stop if:** you are unsure what a reserved ID meant. Do not invent the wording.

#### 0.9 Replace the project-folder copies with pointers

- **Why:** C-06.
- **Where:** project folder only. No pull request.
- **Do:** replace the contents of `README.md`, `scoring-spec.md`, `review-register.md` and `change-process.md` in the project folder with one line each: `The source is <path> in github.com/ferrelldevin/cmai-caregiver-app. This copy was removed on <date> because copies drift.` Read each file again just before changing it.
- **Done when:** the four files are one line each.

---

### Stage 1. Fix what the audit proved

Each is one pull request, lane A, no scoring change. Each adds the unit test that would have caught it (B-15).

#### 1.1 Patient switcher always lists the current patients

- **Why:** A-01, A-02. Verified in a browser on 2026-11-10; the fix below was tried and reverted.
- **Register:** F-30. **Branch:** `claude/switcher-current-list`
- **Files:** `src/ui/PatientSheet.tsx`, new `src/ui/patientRows.ts`, new `tests/patientRows.test.ts`, `e2e/patient-switcher.cjs`.
- **What the code does now:** the sheet keeps `rows`, the patient details from the last time it was open. On the next opening it draws those old rows until the database answers.
- **Change:** build the list from `patients` (always current) and use `rows` only to fill in details.
- **Old (`src/ui/PatientSheet.tsx`):**
  ```tsx
  const list = (rows ?? patients.map((p) => ({ ...p, period: 0, day: 0, lastLogged: undefined as number | null | undefined })))
    .filter((p) => p.id.toLowerCase().includes(query.trim().toLowerCase()));
  ```
- **New:** move the logic to a pure function in `src/ui/patientRows.ts` and call it.
  ```ts
  // src/ui/patientRows.ts
  // The switcher's rows: every current patient, with period and last log once the database has
  // answered. Built from the patient list, never from an earlier answer, so a patient added or
  // deleted since the sheet was last open is right from the first paint.
  import type { Patient } from "../data/db";
  import type { PatientSummary } from "../data/patients";

  export type SwitcherRow = Patient & { period: number; day: number; lastLogged: number | null | undefined };

  export function switcherRows(patients: Patient[], details: PatientSummary[] | null, query: string): SwitcherRow[] {
    const byId = new Map((details ?? []).map((d) => [d.id, d]));
    const q = query.trim().toLowerCase();
    return patients
      .map((p): SwitcherRow => byId.get(p.id) ?? { ...p, period: 0, day: 0, lastLogged: undefined })
      .filter((p) => p.id.toLowerCase().includes(q));
  }
  ```
  ```tsx
  // src/ui/PatientSheet.tsx
  const list = switcherRows(patients, rows, query);
  ```
- **Tests to write first (`tests/patientRows.test.ts`), each must fail before the change exists:**
  1. Details for A and B, patients A, B, C: returns three rows, C with `period: 0`.
  2. Details for A and B, patients A only: returns one row.
  3. `details` is `null`: every patient is returned.
  4. Query `"03"` over P-01 to P-06 plus two demo patients, with details for the two demo patients only: returns P-03.
- **Browser check to add in `e2e/patient-switcher.cjs`:** after the six patients are added and the sheet opens, read the row count in the same `evaluate` call that sees the dialog open; it must be 8.
- **Acceptance criteria:**
  1. The four unit tests pass.
  2. `patient-switcher` passes 10 times in a row in the cloud thread.
  3. Devin's desktop run (step 0.6 repeated) shows `patient-switcher: PASS`.
- **If the desktop still fails after this fix:** read the FAIL line. It prints the rows and the search box value.
  - Search box reads `""`: the query was reset. Look at the effect on line 29 (`if (open) setQuery("")`) and at whether the sheet closed and reopened.
  - Rows are right but the count is wrong: the check's selector is the problem, not the app.
  - Anything else: stop and report the line exactly.
- **Stop if:** fixing it seems to need a longer wait in the check. A wait is not the fix.

#### 1.2 Restore rejects bad files; Export cannot be broken by one

- **Why:** A-03. **Register:** F-31. **Branch:** `claude/restore-validation`
- **Files:** `src/data/manage.ts`, `tests/manage.test.ts`, `src/ui/DataScreen.tsx` (message only).
- **Change to `parseBackup`:** keep an entry only if every rule holds. Copy only the named fields, never the whole object.
  - Patient: `id` matches `/^[A-Z0-9-]{2,12}$/` (the same rule as the Add field). `anchor` is a whole number between 2020-01-01 and one day after now. `demo`, if present, is `true`.
  - Log: `patientId` is a kept patient or already on the phone. `itemId` is a whole number 1 to 29. `at` and `loggedAt` are whole numbers in the same range as `anchor`. `approx`, if present, is a boolean. `before`, `deleteReason`: strings of 40 characters or fewer. `beforeNote`, `deleteNote`: strings of 120 or fewer. `deletedAt`, if present, is a whole number in range.
  - Check-in, review, change: same style. `patientId` must be a kept patient.
  - Return a `skipped` count beside the kept entries.
- **Change to `restoreBackup`:** add `skipped` to `RestoreResult`.
- **Change to the message in `DataScreen.tsx`:** when `skipped > 0`, add: ` ${n} entries in the file were not valid and were left out.`
- **Tests to write first:**
  1. The audit's bad file (name as a code, `itemId` 7.5, a log for a patient not in the file): 0 patients, 0 logs, `skipped` 3.
  2. After restoring that file, `buildExport` does not throw.
  3. A log with an extra field `evil: "x"`: the stored log has no `evil` key.
  4. A real export from `buildExport` restores with `skipped` 0 (the existing round-trip test still passes).
- **Acceptance criteria:** the four tests pass; coverage floors hold.
- **Stop if:** a backup made by the current app fails the new rules. That means a rule is too strict. Report which.

#### 1.3 Warn about logs before a patient's first day

- **Why:** A-04. **Register:** F-32, D-19. **Branch:** `claude/logs-before-start`
- **Files:** `src/data/logs.ts`, `src/data/manage.ts`, `src/ui/LogSheet.tsx`, `src/ui/DataScreen.tsx`, tests.
- **Change 1, editing:** `editLog` reads the patient's `anchor`. If the new `at` is earlier, it throws `This patient's first day in the app is <date>. A log can't be earlier than that.` The Log sheet shows that message and keeps the old time.
- **Change 2, restore:** count the restored logs whose `at` is before the start date the patient has on this phone. Add `beforeStart` to `RestoreResult`. Message: ` ${n} logs are from before ${id}'s first day on this phone and are not counted in any period.`
- **Do not** change which start date wins. That is D-19, lane B.
- **Tests first:** edit to one minute before `anchor` throws and stores nothing; restore of the audit's case B reports `beforeStart: 1`.
- **Acceptance criteria:** tests pass; on a patient added today, setting a log's date to yesterday in the Log sheet shows the message.

#### 1.4 A failed save tells the caregiver

- **Why:** A-05. **Register:** F-33. **Branch:** `claude/save-failure`
- **Files:** `src/ui/LogScreen.tsx`, `src/App.tsx`, `src/main.tsx`, new `src/ui/ErrorScreen.tsx`, `e2e/flows.cjs`.
- **Change:**
  1. In `LogScreen.tsx`, wrap the body of `log`, `toggleCheckIn`, `undo`, `patch` and `remove` in `try`/`catch`. On failure show a message with `role="alert"`: `That did not save. Check the phone has free space, then try again.` Do not show the "Logged" confirmation.
  2. Add an error boundary component around `<App />` in `main.tsx`. Its screen says: `Something went wrong. Your saved logs are safe. Close the app and open it again.` with a Reload button.
  3. In `main.tsx`, listen for `unhandledrejection` and show the same alert banner the storage error uses.
- **Check to add in `e2e/flows.cjs`:** make `IDBObjectStore.prototype.add` throw once with `page.evaluate`, tap a behavior, expect the alert text and no "Logged" confirmation.
- **Acceptance criteria:** the new check passes; axe still shows 0 violations; the alert is read by a screen reader (it has `role="alert"`).

#### 1.5 Welcome screen matches the app

- **Why:** A-06. **Register:** decision-log row only. **Branch:** `claude/welcome-copy`
- **File:** `src/ui/DataScreen.tsx`.
- **Old:**
  ```tsx
  <li><b>Review.</b> On day 15, check the app's ratings against what you saw.</li>
  ```
- **New:**
  ```tsx
  <li><b>Back up.</b> Download a backup now and then, so the logs are never only on this phone.</li>
  ```
- Also change `<li><b>Scores.</b>` to `<li><b>Score.</b>` if step 0.3 renamed the tab.
- **Acceptance criteria:** `grep -rn "day 15" src` returns nothing; the welcome card names only screens that exist.

#### 1.6 CSV cells cannot run as formulas

- **Why:** A-07. **Register:** F-34. **Branch:** `claude/csv-safe-cells`
- **Files:** `src/data/exporter.ts`, `tests/logs.test.ts` or a new `tests/exporter.test.ts`.
- **Old:**
  ```ts
  const csv = (rows: (string | number | boolean)[][]) =>
    rows.map((r) => r.map((v) => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v))).join(",")).join("\n");
  ```
- **New:**
  ```ts
  // A cell that starts with = + - @ (or a tab or return) is run as a formula by spreadsheet apps.
  // A leading apostrophe makes it plain text (OWASP, CSV Injection).
  const cell = (v: string | number | boolean) => {
    if (typeof v !== "string") return String(v);
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const csv = (rows: (string | number | boolean)[][]) => rows.map((r) => r.map(cell).join(",")).join("\n");
  ```
- **Tests first:** a `beforeNote` of `=1+1` exports as `'=1+1`; a note with a comma is still quoted; a patient code `P-01` is unchanged.
- **Note for the data dictionary (3.4):** a leading `'` in a note column means the note began with a formula character.

#### 1.7 "Today" stays right when the app is left open

- **Why:** A-11. **Register:** F-35. **Branch:** `claude/day-rollover`
- **Files:** `src/App.tsx`.
- **Change:** call `refresh()` when the page becomes visible again (`visibilitychange` with `document.visibilityState === "visible"`) and at the next local midnight (a timer set from `addDays(localMidnight(now), 1) - now`, reset after it fires). Use the engine's `addDays` and `localMidnight`.
- **Acceptance criteria:** a browser check sets the clock to 23:59:50 with Playwright's `page.clock`, logs once, moves the clock 20 seconds, and sees "Nothing logged yet today".

#### 1.8 Backup reminder

- **Why:** N-01. **Register:** F-36. **Branch:** `claude/backup-reminder`
- **Files:** `src/ui/LogScreen.tsx` or `src/App.tsx`, `src/ui/DataScreen.tsx`.
- **Change:** when there is at least one non-demo patient with a log, and the last export is more than 7 days ago or never, show one quiet line on the Log screen: `Last backup: never. Back up` (a link to `#/data/backup`). It uses the existing `cmai-last-export` value. No new stored field.
- **Acceptance criteria:** shows with a real patient and no export; hidden with demo patients only; hidden for 7 days after an export; axe 0 violations.
- **Kill when:** Devin finds it nagging in use. Remove it and record why.

#### 1.9 Ask the phone to keep the app's data

- **Why:** N-01, Part 7 (frontend). Safari can delete a site's stored data after seven days without use; a Home Screen app is treated separately ([WebKit, 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). Browsers also clear storage when space runs low unless the site has asked to be kept ([MDN, StorageManager.persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)). The app never asks.
- **Register:** F-53. **Branch:** `claude/keep-data`
- **Files:** new `src/data/persist.ts`, `src/main.tsx`, `src/ui/DataScreen.tsx` (About page), new `tests/persist.test.ts`.
- **New (`src/data/persist.ts`):**
  ```ts
  // Asks the browser not to clear this app's data when the phone runs low on space.
  // The answer is shown on the About page so the lab can check a study phone.
  export type KeepState = "kept" | "not-kept" | "unknown";

  export async function askToKeepData(storage: StorageManager | undefined): Promise<KeepState> {
    if (!storage?.persist) return "unknown";
    try {
      return (await storage.persisted()) || (await storage.persist()) ? "kept" : "not-kept";
    } catch {
      return "unknown";
    }
  }
  ```
- **Call it** once from `src/main.tsx` after the first render, as `askToKeepData(navigator.storage)`. The function takes storage as an argument with no default so the tests can pass `undefined`. Do not block the app on it.
- **About page:** one line under the version: `Data on this phone: kept` or `Data on this phone: may be cleared by the phone. Add the app to the Home Screen and back up.`
- **Tests first:** storage with `persist` returning `true` gives `"kept"`; returning `false` gives `"not-kept"`; `undefined` storage gives `"unknown"`; a `persist` that throws gives `"unknown"`.
- **Acceptance criteria:** the four tests pass; the About page shows one of the two lines in the browser checks; nothing new is stored.

#### 1.10 Say what the app does not do

- **Why:** Part 7 (ethics). The 29 behaviors include hitting, hurting self or others and falling on purpose (manual p.12 to 13). A caregiver could believe that logging one tells someone. It tells no one. The small print says "not a medical device" but not this.
- **Register:** P-12 (wording is Dr. Gupta's to approve; built with the wording below). **Branch:** `claude/alerts-no-one`
- **Files:** `src/ui/DataScreen.tsx` (welcome card and About page).
- **Add to the welcome list:**
  ```tsx
  <li><b>This app tells no one.</b> A log is a record for the study. For an injury or an emergency, do what your workplace says.</li>
  ```
- **Add the same sentence** to the About page above the small print.
- **Acceptance criteria:** the sentence is on both screens; reading level is grade 6 or below (check with any readability tool and write the score in the pull request); axe 0 violations.
- **Do not** add an alert, a phone number or a link. What to do in an emergency belongs to the care site.

---

### Stage 2. Checks, CI and deploy

#### 2.1 Dependabot: minors together, majors alone

- **Why:** B-02. **Branch:** `claude/dependabot-groups`. **File:** `.github/dependabot.yml`.
- **Old (npm block):**
  ```yaml
      groups:
        npm:
          patterns: ["*"]
      open-pull-requests-limit: 2
  ```
- **New:**
  ```yaml
      groups:
        npm-minor-and-patch:
          update-types: ["minor", "patch"]
      open-pull-requests-limit: 5
  ```
- A major version now arrives as its own pull request. Reference: [Dependabot options, groups](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference#groups--).
- **Done when:** merged, and the next Dependabot run opens one grouped minor-and-patch pull request that passes.

#### 2.2 Close the three failing Dependabot pull requests

- **Who and where:** Devin, browser. After 2.1 is merged.
- **Do:** close #32, #33 and #42 without merging. Dependabot will reopen what still applies under the new groups.

#### 2.3 Major upgrades, one at a time

- **Why:** B-03, decision 6. One pull request each, in this order. Do not combine.
  1. vitest 5 and `@vitest/coverage-v8` 5. Clears the 3 critical advisories.
  2. vite 8, `@vitejs/plugin-react` 6, `vite-plugin-pwa` 2. After it, install the app fresh in a browser and check the offline reload.
  3. TypeScript 7, only once `typescript-eslint` allows it (`npm info typescript-eslint peerDependencies`). Until then add an `ignore` for `typescript` major versions in `dependabot.yml`.
  4. React 19 with its types.
  5. Recharts 3: **skip it.** Steps 4.3 and 4.4 replace the charts with CSS bars and remove Recharts. Add an `ignore` for `recharts` major versions in `dependabot.yml` until 4.4 merges.
- **For each:** `npm install <package>@<major>`, then the route in 1.4 from row 5. Read the package's migration notes first and link them in the pull request.
- **Acceptance criteria for each:** every check passes with no test changed except where the migration notes require it; `npm audit` has no more advisories than before.
- **Kill when:** one upgrade takes more than one session. Close it, add an `ignore` for that major in `dependabot.yml` with a comment giving the date and reason, and move on.
- **After item 1:** add a CI step in the build job: `npm audit --audit-level=critical` (all packages). Keep the existing app-only step at `high`.

#### 2.4 Workflow hardening

- **Why:** B-04, B-10, B-16. **Branch:** `claude/workflow-hardening`. **File:** `.github/workflows/pages.yml`.
- **Changes:**
  1. Pin every `uses:` to a full commit SHA with the version in a comment, for example `uses: actions/checkout@<40-character sha> # v7.0.0`. Get each SHA from the action's release page. Dependabot keeps SHA pins updated. Reference: [GitHub, security hardening for Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions).
  2. `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` so runs on `main` are never cancelled.
  3. `timeout-minutes: 15` on each job.
  4. New step after the unit tests: `npm run gen:cases && git diff --exit-code docs/test-cases.json`.
  5. New step: `python3 docs/agreement/analyze.py --selftest`.
- **Acceptance criteria:** the pull request's own run is green; `grep -n "uses:" .github/workflows/*.yml` shows a SHA on every line.

#### 2.5 Format every file once

- **Why:** B-06, decision 5. **Branch:** `claude/format-all`
- **Do:** `npx prettier --write .` then check `git diff --stat` touches no file under `docs/audits/`, `docs/agreement/robustness-output/` or `package-lock.json` (they are in `.prettierignore` or should be added). Remove the `e2e/**` exclusion from `lefthook.yml` only if step 2.6 is done.
- **Rules:** no other change in this pull request. Announce it first: every open branch must be rebased after it.
- **Acceptance criteria:** `npx prettier --check .` passes; all checks pass; `git diff -w --stat origin/main` (ignoring whitespace) shows no logic change. Add `npx prettier --check .` to CI.

#### 2.6 Browser checks on Playwright Test, plus WebKit

- **Why:** B-07, B-08, decision 3. **Branch:** `claude/playwright-test`
- **Do:**
  1. Add `@playwright/test` at the same version as `playwright` in `package.json`.
  2. New `playwright.config.ts`: `webServer` runs `npm run build && npx vite preview --port 4173 --strictPort`; projects `chromium` and `webkit`; `trace: "retain-on-failure"`; `retries: 0`.
  3. Convert one script per commit to `e2e/<name>.spec.ts`. Every `ok(condition, "message")` becomes one `expect` with the same message. Keep the order.
  4. `scripts/run-checks.mjs` runs `npx playwright test --project=chromium --reporter=json` and still writes `.checks/report.md` with the same `RESULT:` and `FAIL` lines, because `CLAUDE.md` depends on them.
  5. CI: Chromium job stays required. Add a WebKit job with `continue-on-error: true` for the first two weeks.
  6. Update `CLAUDE.md`, `e2e/README.md`, the `run-cmai` skill and `docs/process/change-process.md`.
- **Acceptance criteria:**
  1. The number of assertions per file is at least the old count: flows 45, navigation 20, scores-period 42, theme 14, patient-switcher 18, sheet 21.
  2. Breaking the app on purpose (hide the Undo button) fails one named test and produces a trace file. Then revert.
  3. The desktop run still answers "Run the CMAI checks" with a `RESULT:` line.
- **WebKit failures:** each one is either a real Safari bug (fix the app, own pull request) or a test assumption (fix the test). List them in the pull request. Make the WebKit job required when the list is empty.
- **Kill when:** more than two sessions. Fall back, reversing decision 3: keep the scripts and add `const browserType = require("playwright")[process.env.BROWSER || "chromium"]`.

#### 2.7 Releases, live check, undo steps

- **Why:** B-09, B-11, N-02, decision 4. **Branch:** `claude/release-steps`
- **Do:**
  1. New `docs/process/release.md`: how to cut a release (bump `version` in `package.json` and `CITATION.cff`, move Unreleased to a dated heading in `CHANGELOG.md`, merge; the tag job from #38 tags it), and how to undo a bad deploy (in GitHub, revert the merge pull request and merge the revert; the deploy runs again).
  2. New last step in the deploy job: fetch `${{ steps.deployment.outputs.page_url }}` and fail if the page does not contain the commit's short SHA. This needs the build stamp from #38 to be written into `index.html` as `<meta name="build" content="...">` in `vite.config.ts`.
  3. Cut release `v0.3.0` as the first tagged version.
- **Acceptance criteria:** a tag `v0.3.0` exists; the deploy job's last step is green; the About page on Devin's phone shows 0.3.0 and the same build as the commit.
- **At lab adoption (not now):** change the deploy job's condition to run only on a `v*` tag.

#### 2.8 Size budget; load charts only where shown

- **Why:** B-14. **Branch:** `claude/size-budget`
- **Do:** load `ScoresScreen` with `React.lazy` and a `Suspense` fallback that reuses the "Loading scores…" line. Set `chunkSizeWarningLimit` back to the default by deleting the `build` line in `vite.config.ts`. Add a script `scripts/check-size.mjs` that fails if the entry script is over 250 KB or any chunk over 600 KB, and run it in CI after the build.
- **Acceptance criteria:** the Log screen works offline on a first reload after install (the lazy chunk is in the precache list in `dist/sw.js`); the size script passes; all browser checks pass.
- **Stop if:** the offline check fails. A chart chunk that is not cached breaks Score offline.
- **After step 4.4:** Recharts is gone, so the lazy load goes too. Lower the budget to what the build then measures plus 10%, and keep the script.

#### 2.9 Stop adding screenshots to git

- **Why:** B-17. Docs-only pull request.
- **Do:** in `docs/process/change-process.md` step 5 and the pull request template, change "screenshots attached" to "screenshots in the pull request description, not committed". Leave existing files alone.

#### 2.10 Manual accessibility pass

- **Why:** N-06. Run once after 0.3, then after each Stage 4 step.
- **Who:** Claude writes the checklist with the `design:accessibility-review` skill; Devin does the phone part.
- **Devin, on his iPhone, about 15 minutes:** turn on VoiceOver. Log one behavior, undo it, switch patient, open Score, read one behavior's rating, open Settings, download a backup. Then set text size to the largest in iOS Display settings and repeat by sight.
- **Record:** a new row V-13 in the register with the date and what failed. Each failure becomes its own lane A step.

#### 2.11 Property tests for the scoring rule

- **Why:** Part 7 (computer science). The 19 hand-worked cases check the answers someone thought of. A property test checks rules that must hold for every input, with thousands of random ones. Tool: [fast-check](https://fast-check.dev/).
- **Register:** V-14. **Branch:** `claude/scoring-properties`
- **Files:** `package.json` (dev dependency `fast-check`), new `tests/engine.properties.test.ts`. No change under `src/`.
- **Properties to write.** Each generates random logs for one behavior inside one 14-day period:
  1. **Order does not matter.** Shuffling the logs gives the same rating.
  2. **More logs never lower the rating.** Adding one log gives a rating equal or higher.
  3. **Removing a log never raises it.** The mirror of 2. This is what makes "deleted logs do not count" safe.
  4. **The bands hold.** With no rating-7 cluster, the rating equals the table in `docs/scoring-spec.md` section 2 for that count.
  5. **Rating 7 only with timing.** A rating of 7 implies at least 7 days each with 3 logs inside 60 minutes (spec section 3).
  6. **Behaviors do not leak.** Logs for item A never change item B's rating.
  7. **Clock changes.** Run 1 to 4 with `TZ=America/New_York` across a period that contains a clock change, as `tests/dst.test.ts` does.
- **Acceptance criteria:** all pass at 1,000 runs each; `npm run test:coverage` time rises by under 10 seconds; the seed is printed on failure.
- **If a property fails:** that is a finding, not a test to fix. Stop, save the failing input the tool prints, and report it. It may be a bug or a rule the spec does not state. Either way it gets a register row.
- **Not now:** mutation testing (Stryker). Worth it after this step if the lab starts changing the rule. Reason: the engine is 223 lines with 100% line coverage; properties find more per hour.

#### 2.12 Dependency review on every pull request

- **Why:** Part 7 (security). Today a pull request can add a package with a known hole and nothing says so until the monthly audit. [dependency-review-action](https://github.com/actions/dependency-review-action) fails the pull request instead.
- **Branch:** `claude/dependency-review`. **File:** `.github/workflows/pages.yml` or a new `.github/workflows/dependency-review.yml`.
- **New job,** pull requests only, pinned to a commit SHA as step 2.4 requires:
  ```yaml
  dependency-review:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<sha> # same pin as the other jobs
      - uses: actions/dependency-review-action@<sha> # version in a comment
        with:
          fail-on-severity: high
  ```
- **Acceptance criteria:** the job is green on its own pull request; it is not a required check for the first two weeks.
- **Devin, browser, after two quiet weeks:** add it to the required checks in the `main` ruleset.

#### 2.13 Diagnostics a caregiver can copy

- **Why:** Part 7 (development). When a caregiver says "it did not save", nobody can see what happened. The app sends nothing anywhere, and must not. So keep a short list on the phone that the caregiver can copy and hand to the lab.
- **Register:** F-54. **Branch:** `claude/diagnostics`. Stacks on 1.4 (it adds the error handling this records).
- **Files:** new `src/ui/diagnostics.ts`, `src/main.tsx`, `src/ui/ErrorScreen.tsx`, `src/ui/DataScreen.tsx` (About page), new `tests/diagnostics.test.ts`.
- **What is kept:** the last 30 errors, in `localStorage` under `cmai-diagnostics`. Each entry: time, the error's name and message cut to 200 characters, the screen name only (the first part of `location.hash`, for example `#/today`; never the rest, which can hold a patient code), app version and build.
- **What is never kept:** patient codes, log contents, notes. A message that contains a patient code is cut at the code. Test this.
- **About page:** a button `Copy diagnostics` that puts the list on the clipboard as text, and a line `Nothing is sent anywhere. Copying is up to you.`
- **Tests first:** the 31st entry drops the oldest; an error message containing `P-03` is stored without it; `localStorage` throwing does not throw out of `record()`.
- **Acceptance criteria:** tests pass; lane A test holds (nothing new leaves the phone; no database change); axe 0 violations.
- **Kill when:** it needs more than this. No dashboards, no upload, no third-party service.

---

### Stage 3. Lab readiness

Claude drafts. Devin takes them to Dr. Gupta. Nothing here changes the app unless the step names a file under `src/`.

#### 3.1 Review packet for Dr. Gupta

- **Why:** C-04, C-05, C-07. One document he can mark in 20 minutes.
- **First:** Devin puts the review workbook, or a note of where it is and what has been marked, in the project folder under `review/`.
- **Output:** a document with one row per decision: ID, the question in one plain sentence, what the app does today, the options, Devin's recommendation, and a box for his answer. Order: what blocks the most first.
  1. Does the lab adopt this app? (moves G1)
  2. Where may real data live, and what comes first: IRB, HIPAA (P-03, P-04)
  3. D-14 locked ratings; D-21 when a period is final; D-20 deleting patients
  4. R1: phone PIN or lab accounts; is ODU REDCap an option
  5. R2: who assigns residents; can two caregivers share one
  6. R4: day ends at midnight or end of shift; D-17 group sum or average; D-18 pattern thresholds
  7. D-01, D-02 count bands and rating 7; D-05 fixed or rolling periods; D-19, D-22
  8. P-01 permission, P-05 ownership, P-08, P-09, citation authors
  9. Usability test and its IRB check (P-06)
  10. **Built on assumed approval, switched off.** One row for each lane B step in Stage 5: what was built, the answer assumed, a picture, and three boxes: `Switch it on as built`, `Change it (say how)`, `Remove it`. Rows: F-44 database fields, F-45 caregiver profiles, F-46 PIN (4 digits, once per shift), F-47 blind day-14 CMAI, F-38 watching hours with D-25, F-39 "it stopped", F-41 three chips, D-23 export format 2 and the label file, F-10 protected backup.
  11. D-24: do caregivers see the app's ratings during the study? Assumed no.
  12. P-10 whose phones; P-11 free-text notes; P-12 the "tells no one" wording.
  13. Does IRB cover data about caregivers (codes, watching hours, their day-14 rating)?
  14. The protocol draft (3.9): sample size, pass mark, preregistration.
- **Rule for the packet:** an assumed answer is shown as an assumption. Never write that something was decided.
- **Done when:** Devin has sent it and the date is in the register's decision log.

#### 3.2 Data management plan, one page

- **Covers:** where data lives at each stage, who can see it, how a code links to a person and who holds that key, how long data is kept, what a backup file may be sent through, what happens to a phone that leaves the study.
- **Includes the change the app needs before real data (A-12):** the backup message must name the approved place, not "email or cloud drive".
- **Sources to cite:** [ODU human subjects research](https://www.odu.edu/research/compliance/humans), [HHS de-identification guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html).

#### 3.3 Threat model and login standard

- **Output:** `docs/security/threat-model.md`. One page. Who might get at the data (someone who picks up the phone, another app user on a shared phone, someone who gets a backup file, someone who changes the hosted site), what each could do, what stops them today, what R1 must add.
- **Standard for the PIN:** [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html). Use the `security-review` skill.
- **Needed before:** 5.1.

#### 3.4 Data dictionary and export format version

- **Output:** `docs/data-dictionary.md`: every column of both CSVs and every key of the backup, with type, unit, time zone, allowed values and an example made of demo data.
- **Lane A part:** write the dictionary for the exports as they are.
- **Lane B part (adds export columns; built in step 5.10, not here):** add `schema_version`, `app_version`, and a UTC offset column for each time.

#### 3.5 Permission, ownership, citation, accounts

Devin's actions, after Dr. Gupta answers 3.1:

1. P-01: send the permission email to the CMAI author. Record the date in `NOTICE` and the register.
2. P-05: confirm with Dr. Gupta whether MIT under your name stands. Source: [ODU BOV Policy 1424](https://www.odu.edu/about/policiesandprocedures/bov/board-of-visitors-policy-1424).
3. `CITATION.cff`: add the authors he names.
4. Ask whether ODU or the lab has a GitHub organization. Moving the repo changes the app's address, and every installed phone must export, reinstall and restore. Do it before the first real install or not at all.

#### 3.6 Internal pilot, usability sessions, agreement study

- **Internal pilot (V-16). Lane A.** Devin, and Shanmei if she offers, uses the lab build for 7 days with a made-up resident, logging from a script of made-up events (write the script first: `docs/study/pilot-script.md`, about 10 events a day, some late, some at night). No real resident, no real behavior. It tests the tool, not people, so it is not a study; if anyone other than Devin and Shanmei would take part, it becomes a usability session and stops for P-06.
  - **Measure:** logs made against events in the script; share logged within 5 minutes; share of watches that ended by timeout (5.6); share of eligible logs with "it stopped" (5.7); time to fill the day-14 form (5.4); every moment Devin had to stop and think, written down the same day.
  - **Kill rules:** the ones written in 5.6 and 5.7. Also: if fewer than 8 in 10 scripted events are logged by the person who built the app, the flow is too heavy. Stop adding features and go back to Part 8.
  - **Also in the pilot:** the first-click test V-15 (4.6).
- **Usability sessions (V-09, V-12). Stop:** they involve people outside the team. Need P-06 answered. Five caregivers or nurses, scripts already in `docs/usability/` and `docs/design/scores-period-verification.md`.
- **Agreement study (V-01). Stop.** Two raters, 12 stories, materials in `docs/agreement/`. The statistic and the pass mark are fixed first in the protocol (3.9).

#### 3.7 Wording once the lab adopts the app

- Change `README.md` line 5, the About page small print and the register intro from "interview prototype" to what Dr. Gupta calls the project. Do not do this before he says so.

#### 3.8 Continuity

- `CONTRIBUTING.md`: how to set up (already in the README), the two lanes, the route in 1.4, who merges.
- Devin: add Shanmei as a collaborator if Dr. Gupta wants her able to review. Write in the register who can merge.
- `docs/process/runbook.md`: the site is down, a deploy is bad (link to `release.md`), a phone lost its data (restore from backup), a check fails only on the desktop.

#### 3.9 Study protocol and analysis plan, draft

- **Why:** Part 7 (research method). The claim the lab wants to make is that the app's rating agrees with a caregiver's own CMAI. That claim is only as strong as the plan written before the data exists. A plan written after can be read to fit.
- **Output:** `docs/study/protocol-draft.md`, about three pages. Lane A to write. **Stop:** registering it or sending it is Dr. Gupta's call, through Devin.
- **Sections, each one short:**
  1. **Question.** Does the app's rating for each behavior fall within 1 point of a blind caregiver CMAI for the same 14 days? The 1-point standard is the manual's own (p.7).
  2. **Design.** Who rates, when, and blind to what. The caregiver fills the day-14 CMAI (step 5.4) without seeing the app's ratings (D-24). Model: Cohen-Mansfield and Libin 2004, informant rating against direct observation ([DOI 10.1002/gps.1171](https://doi.org/10.1002/gps.1171); read at abstract level, confirm the design in the full text before citing).
  3. **Measures.** Per behavior: agreement within 1 point, and a weighted kappa. For the total: an intraclass correlation, with the form chosen and reported as Koo and Li advise ([DOI 10.1016/j.jcm.2016.02.012](https://doi.org/10.1016/j.jcm.2016.02.012)). State the pass mark before the data: 88% of items within 1 point, the manual's reported floor (p.7).
  4. **Sample.** How many residents, periods and caregivers, and why. Leave the number blank for Dr. Gupta with the reasoning that sets it.
  5. **Missing data.** Unlogged days are unknown, not zero (D-11). Watching hours (step 5.6) give the hours actually observed. Say which periods are left out and the rule for it, before seeing any.
  6. **Known biases.** Logging changes what a caregiver notices. A caregiver who sees ratings will anchor on them. Severe episodes get logged late because hands are busy (the `logged_at` minus `occurred_at` gap measures this). Each bias gets one line: how the design limits it and how it will be reported.
  7. **Reporting.** Follow GRRAS for agreement studies ([DOI 10.1016/j.jclinepi.2010.03.002](https://doi.org/10.1016/j.jclinepi.2010.03.002)). If a sensor model is later graded against app labels, follow STARD 2015 ([DOI 10.1136/bmj.h5527](https://doi.org/10.1136/bmj.h5527)).
  8. **Preregistration.** Recommend it ([Center for Open Science](https://www.cos.io/initiatives/prereg)). Dr. Gupta decides.
- **Acceptance criteria:** every number in the draft has a source or is marked "for Dr. Gupta"; the statistic and pass mark are fixed in writing; no real data is used or implied.

#### 3.10 Research notes: add the scan's sources after a full-text check

- **Why:** the scan read most sources at abstract level and says so. `docs/research-notes.md` is the repo's record of what each source changed in the app. Nothing from the scan is in it.
- **Branch:** `claude/research-notes-scan`. **File:** `docs/research-notes.md` only.
- **Do, for each source in Part 9's table:**
  1. Open the publisher's page through the DOI. PubMed and PMC block cloud sessions; Crossref (`https://api.crossref.org/works/<doi>`) and publisher pages work.
  2. Find the number the scan quotes in the full text. If the full text cannot be opened, the row says "abstract only".
  3. Add a row: source with DOI, what it says in one sentence, which step of this plan it supports.
- **Known corrections to carry in** (checked against Crossref on 2026-11-10):
  - The lab's 2019 abstract is Nesbitt, Gupta, Maly, Okhravi and Jain, "Feasibility of Using Wearable Sensors to Detect Agitation in Persons with Dementia", CNS Spectrums ([DOI 10.1017/S1092852919000105](https://doi.org/10.1017/S1092852919000105)). The scan left the author list open.
  - Mishra 2023's title says "risk detection", not agitation detection.
  - Capstick is dated 2024 although the DOI string says 2023. Beltrán is 2018 online, 2019 in print.
  - Husebo's 7.0-point figure came from a secondary summary. Confirm it on the BMJ page or drop the number.
- **Acceptance criteria:** every new row has a DOI that resolves; every quoted number is marked "full text" or "abstract only"; `npm run check:docs` passes.

#### 3.11 Who did what, and how AI was used

- **Why:** Part 7 (what is missing). The quality bar says the work must hold up as the team's own and AI use is declared wherever Dr. Gupta, a venue or ODU asks. Today that is one paragraph in the README. A paper or poster will ask for more.
- **Output:** `docs/lab/contributions.md`. One table of people and roles using the [CRediT](https://credit.niso.org/) role names, and one section "How AI was used" that says, per kind of work (code, scoring spec, literature scan, design mockups, documents), what an AI model drafted and who checked it.
- **Rules:** list only what is true and can be shown from the repo history. Leave Dr. Gupta's and Shanmei's rows for Devin to fill. Do not write an authorship order.
- **Done when:** Devin has read it and corrected it.

#### 3.12 Caregiver quick card and training script

- **Why:** Part 7 (UX). In one caregiver app, 80% of caregivers never used it (Øksnebjerg 2020, [DOI 10.2196/14694](https://doi.org/10.2196/14694), as cited in `docs/research-notes.md`). The first five minutes decide. The app has a welcome card but nothing to hand someone.
- **Output:** `docs/training/quick-card.md` (one side of a page, prints in black and white) and `docs/training/five-minute-script.md` (what the person setting up the phone says and does).
- **Quick card holds:** tap once each time you see it; for pacing, restlessness and mannerisms one tap is one stretch (spec section 4); wrong tap, press Undo; logged late, set when it happened; nothing seen today, say so; this app tells no one (1.10); who to call with a problem (blank for the lab).
- **Script holds:** add to Home Screen, load the practice resident, log three made-up behaviors, undo one, fix a time, remove the practice resident.
- **Acceptance criteria:** reading level grade 6 or below; every screen name on the card matches the app as it stands when the card is written, and the card is updated in the same pull request as any later step that renames a tab (4.2 to 4.4); pictures use demo data only.

#### 3.13 Options note: lab server, accounts, sync

- **Why:** R1 option B, F-11 and proposal F-43 all need data to leave the phone. That is on the Stop list. The design can still be ready.
- **Output:** `docs/design/notes/0NN-server-options.md` (next free number). Lane A to write. **Stop** to build any of it.
- **Compare, one row each:** stay phone-only with protected backup files carried by hand; ODU-hosted [REDCap](https://projectredcap.org/) with the app sending records to it; a small lab server on ODU infrastructure; a commercial cloud database.
- **Columns:** where the data sits, who runs it, what IRB and HIPAA need (P-03, P-04), what a caregiver sees, what breaks offline, cost, what must exist before it can start.
- **State the app's side once:** after step 5.1 every record has an ID that is unique across phones and is never edited in place (edits and deletes are their own records). So joining two phones' data is a union of records. No option above needs a schema change to sync.
- **Recommendation to write:** phone-only until Dr. Gupta names where data may live. This note does not ask whether ODU has REDCap; question 4 of the packet (3.1) does.

#### 3.14 Sensor pairing guide

- **Why:** scan section 3, item 1 (inference in the scan): the app's timed, per-behavior logs can label wristband or video data. That only works if the two clocks can be lined up and the labels come out in a form a model can read.
- **Output:** `docs/study/sensor-pairing.md`, one page: how to use the clock check (5.8) at the start and end of a session, what the label file (5.10) contains, how watching hours (5.6) mark the time nobody was looking, and what the labels cannot say (a behavior nobody logged looks the same as calm unless a watch covers it).
- **Sources to cite:** Iaboni 2022 for per-person models and chart events timed with video ([DOI 10.1002/dad2.12305](https://doi.org/10.1002/dad2.12305)); Bankole 2020 for caregiver-marked times ([DOI 10.1177/1533317520906686](https://doi.org/10.1177/1533317520906686)).
- **Needs:** 5.8 and 5.10 at least `In review`, so the guide describes what exists.

---

### Stage 4. The caregiver screens (note 008 phases 2 to 5, with the round 4 changes)

Lane A. The mockup is the spec: `src/mockup/Screens.tsx` and `src/mockup/mockup.css`, seen with `npm run storybook`. Round 3 is decided. Round 4 is proposed in Part 8 and taken as the working answer (Part 2, rows 8 and 9). Where the mockup and a criterion below disagree, the criterion wins; say so in the pull request.

Rules for every step in this stage:

- Use the `requirement-pr` skill (after step 0.7 fixes it) and the route in 1.4.
- Any number shown that the app did not show before is computed by a pure function in `src/scoring/` with unit tests written first.
- **Shared pieces move, they are not copied.** A tile, badge, segmented control, card or row used by the app lives in `src/ui/` and `src/styles.css`. No file under `src/ui/` or `src/App.tsx` imports from `src/mockup/` or uses a class that starts `mk-`. Check: `grep -rn "mockup/\|mk-" src/ui src/App.tsx` returns nothing.
- Anything marked open in note 008's table is built as the mockup shows it and labeled `Open: <register ID>`. After step 4.8 those labels show in lab view only.
- Every screen has four states designed and checked: first run, nothing yet, one, many.
- Not built in this stage, whatever the mockup shows: sign-in, caregiver names, "by CD" on logs, room numbers. They are Stage 5.
- Touch targets: 44 by 44 px or more for anything tapped mid-shift. The floor in WCAG 2.2 is 24 by 24 ([SC 2.5.8](https://www.w3.org/TR/WCAG22/#target-size-minimum)); 44 is Apple's default control size, used here as the house rule because the user is tired and one-handed.

#### 4.0 Round 4 proposals into the mockup

- **Why:** Part 8. The proposals exist as a patch and pictures. Putting them in Storybook lets Devin try them on his phone-sized screen next to round 3, and gives steps 4.2 to 4.7 a spec to build from.
- **Register:** F-49 (tabs), F-50 (Log on one page), F-51 ("when" on the confirmation), all `Proposed`. **Branch:** `claude/mockup-round-4`
- **Do, cloud thread, in the repo:**
  1. `git checkout -B claude/mockup-round-4 origin/main`
  2. `git apply --3way /mnt/project-files/plans/round-4-mockup-proposals.patch`
  3. `npm ci` then `npm run mockup:align -- --rebuild`
  4. In the four round 4 stories only, remove the room line under the resident code ("Room 12"). The patch still draws it; Part 8, U13 says why it goes. Rerun step 3.
- **Files the patch touches:** `src/mockup/Screens.tsx`, `src/mockup/mockup.css`, `src/mockup/Mockup.stories.tsx`, `scripts/mockup-align-check.mjs`. Nothing under `src/ui/`, `src/data/` or `src/scoring/`.
- **Acceptance criteria:**
  1. `npm run mockup:align` prints `RESULT: PASS (96 screen and display-mode combinations, 0 with problems)`. It did on 2026-11-10 in the cloud.
  2. Storybook shows four new stories named "R4 proposal: ...". The seven round 3 stories are unchanged: `git diff origin/main --stat` shows no deleted story.
  3. `npm run lint`, `npm run typecheck` and `npx prettier --check src/mockup` pass.
- **Stop if:** the patch does not apply because `src/mockup/` changed on `main`. Report which hunk failed. Do not hand-merge the mockup from memory.

#### 4.1 Log (mockup phase 2, F-26)

- **Files:** `src/ui/LogScreen.tsx`, `src/styles.css`, new `src/ui/mostLogged.ts`, new `tests/mostLogged.test.ts`, icons moved from `src/mockup/behavior-icons.tsx` and `src/mockup/iconify-icons.tsx` to `src/ui/`, `NOTICE`, `docs/scoring-spec.md` (one sentence).
- **Acceptance criteria:**
  1. All 29 behaviors show the mockup's icon and name. Tiles are 3 across at 390 px, content left-aligned, today's count top right. Columns are equal width: `grid-template-columns: repeat(3, minmax(0, 1fr))`.
  2. **"Most logged for this resident" has a written rule.** The mockup's three tiles are typed in by hand, so v4's "as the mockup chooses them" named no rule. The rule: the 3 behaviors with the most live logs in the 14 days before today's local midnight; ties go to the lower item number; the row is hidden when fewer than 3 behaviors have a log in that span. It is worked out from logs before today, so the tiles do not move under a thumb during a day.
     ```ts
     // src/ui/mostLogged.ts
     // The Log screen's top row. Looks only at days before today, so the row stays still all day.
     import { addDays, localMidnight } from "../scoring/engine";
     import { isLive, type StoredObservation } from "../data/db";

     export function mostLogged(observations: StoredObservation[], now: number, size = 3): number[] {
       const end = localMidnight(now);
       const start = addDays(end, -14);
       const counts = new Map<number, number>();
       for (const o of observations) {
         if (!isLive(o) || o.at < start || o.at >= end) continue;
         counts.set(o.itemId, (counts.get(o.itemId) ?? 0) + 1);
       }
       if (counts.size < size) return [];
       return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, size).map(([id]) => id);
     }
     ```
     Tests first: a log today does not change the answer; a deleted log is not counted; two behaviors with logs returns `[]`; a tie returns the lower item number first; a log 15 days ago is not counted.
  3. Group tabs work as in the round 3 mockup. (Step 4.6 changes this; build round 3 here.)
  4. One tap still logs. Undo, Edit, delete with a reason and "Nothing to log today" behave as before. `flows` passes with only selector changes. Recent logs stays on this screen until step 4.2 gives it a home.
  5. **The definition stays reachable without a hidden gesture, and without a second button on each tile.** One button under the grid, "What counts as each behavior?", opens a sheet listing all 29: name, what counts, what does not, manual page. The sheet has the same group headings as the grid. Holding a tile opens the sheet at that behavior, as a shortcut. `docs/scoring-spec.md` section 4 says each button shows the description; change that sentence to say where it now is, and add register row F-37: definitions moved off the tile into one sheet.
     - Why not an info button on each tile (v4): a 44 px button inside a tile about 115 px wide leaves a tired thumb two targets a few millimetres apart, one of which writes a record. See Part 8, U4.
  6. `NOTICE` no longer says the icons are "design mockup only".
  7. The confirmation sits above the floating bar and never under it. Undo is 44 px tall or more. Check at 390 by 844 and 360 by 640.
  8. axe 0 violations in 4 modes; step 2.10 repeated.
- **Kill when:** criterion 5 cannot be met. Go back to the mockup, not forward.

#### 4.2 Today tab (mockup phase 3, F-27, R4)

- **Changed from v4:** the tab is named **Today** and has its own route. There is no Report tab holding two views (Part 8, U1).
- **Files:** new `src/ui/TodayScreen.tsx`, `src/ui/route.ts` (`#/today`), `src/App.tsx` (the bar reads Log, Score, Today, Settings until step 4.4 removes Score), new `src/scoring/day.ts` for counts by hour, tests, new browser check `e2e/today`.
- **Acceptance criteria:**
  1. `#/today` survives a reload and the back gesture.
  2. Shows today's date, three figures (logs, behaviors, last log), logs by hour, and one row per behavior logged today that opens to that behavior's logs, newest first.
  3. Each log row has **Edit**, which opens the existing log details sheet (fix the time, add what happened before, or delete with a reason). This screen is now the one place a log is fixed. Remove the Recent logs card from Log in this pull request, and make Log's "N today" figure a button that opens Today.
  4. A day runs from local midnight to local midnight, using the engine's `localMidnight`. Lab view says `Open: R4` beside the date.
  5. No 1 to 7 rating appears for a single day. The CMAI rates two weeks (manual p.2, p.5).
  6. **Nothing logged yet:** the screen says "Nothing logged today" and shows the "Nothing to log today" check-in button (the one on Log today, moved here; same stored check-in, D-11). Tapping it again takes it back.
  7. Deleted logs are not counted. Logs made today but dated yesterday show under their own day, not today.
  8. Counts by hour come from a pure function `logsByHour(observations, dayStart)` in `src/scoring/day.ts`, tested first, including a 23-hour and a 25-hour day.
- **Left for 5.6:** the watching band under the hour chart in the round 4 picture. It needs stored data.

#### 4.3 Two weeks tab (mockup phase 4, F-28, R5, D-17, D-18)

- **Changed from v4:** its own tab and route, and the answer comes first (Part 8, U12).
- **Files:** new `src/ui/TwoWeeksScreen.tsx`, `src/ui/route.ts` (`#/twoweeks` and `#/twoweeks/p<n>`), new functions in `src/scoring/` (`period.ts`, `patterns.ts`), tests, `src/data/exporter.ts` only for the per-period CSV button.
- **Order on screen, top to bottom:** period with earlier and later arrows; "So far this period" (what is lower, what is higher, busiest time); behaviors, this period against last; logs per day; time of day; behavior groups; patterns to look into; export this period.
- **Acceptance criteria:**
  1. Every figure comes from a tested pure function. Group figures use the nursing-home factors already in `src/scoring/items.ts` (manual p.7).
  2. Group average is labeled `Open: D-17`. Pattern thresholds (20 or more logs, 1.5 times share, pairs within 30 minutes 3 or more times) are named constants in `src/scoring/patterns.ts` and labeled `Open: D-18`. Both labels follow step 4.8.
  3. "Lower" and "higher" in the summary use the existing `meaningfulChanges` rule (D-10) for finished periods. For a period in progress the summary says "so far" and names the day, as the mockup does.
  4. Unlogged days show as unknown, never as zero (D-11).
  5. The in-progress period is marked "so far" and left out of comparisons.
  6. **Charts are drawn with plain HTML and CSS as the mockup draws them** (bars as sized elements, the heat map as a grid). Do not add a Recharts chart to this screen. Each chart has a text alternative. Colors come from tokens. Follow the `dataviz` skill.
  7. When study setting `ratingsVisibleToCaregivers` is off (step 5.0, D-24), every 1 to 7 rating and the total are replaced by counts, and the screen says nothing about ratings. Until 5.0 exists, build with ratings shown and leave a `// 5.0` comment at the one place the switch will go.
  8. The pattern card names the evidence in lab view: episodes cluster by time of day (Abedi 2025, preprint, https://arxiv.org/abs/2506.06306) and triggers differ by person (Bankole 2020, DOI 10.1177/1533317520906686). This is proposal F-42 from the scan: it supports this screen and adds nothing to build.
- **Appetite:** two sessions. **Kill when:** a figure needs a rule the lab has not set and cannot be labeled open.

#### 4.4 Fold Score into Two weeks (mockup phase 5, F-29, F-49)

- **Changed from v4:** v4 restyled Score. Score's list is the same table as "Behaviors, this period against last", so this step removes the duplicate instead.
- **Files:** `src/ui/TwoWeeksScreen.tsx`, `src/ui/ScoresScreen.tsx` (deleted at the end), `src/ui/scoreView.ts`, `src/ui/route.ts`, `src/App.tsx`, `e2e/scores-period`, `package.json` (Recharts removed if nothing imports it).
- **Acceptance criteria:**
  1. The bar reads **Log, Today, Two weeks, Settings**.
  2. Everything Score did is on Two weeks: pick a period, each behavior's rating and count, change since last period (D-10), the "+ N not logged (rated 1)" line, unlogged days, the agitated or not marks for the three groups (spec section 6), History of finished periods, and the note that totals often fall without a change in treatment.
  3. Behaviors first, total labeled secondary (D-08 unchanged). The total is the dashed "so far" figure beside the title, as in the round 4 picture.
  4. `#/scores` and `#/scores/p<n>` open `#/twoweeks` and `#/twoweeks/p<n>`. An installed phone with the old address saved still lands in the right place.
  5. `scores-period` keeps every assertion (42 on 2026-11-10), with selector and route changes only.
  6. `grep -rn "recharts" src` returns nothing, and `recharts` is out of `package.json`. This replaces the Recharts 3 upgrade in step 2.3 item 5; tell that thread.
  7. The entry script is under the size budget from step 2.8.
- **Stop if:** an assertion in `scores-period` has no home on the new screen. That means something Score did was dropped. List it; do not delete the assertion.

#### 4.5 Show Dr. Gupta the working screens

- Stop lane: Devin shows him. Devin shows Today and Two weeks and asks the questions held since 2026-11-07 (R4 day end, D-17, D-18, D-08) plus D-24 (who sees ratings). Answers go in the register with the date.

#### 4.6 Log on one page with jump links (F-50)

- **Why:** Part 8, U2. With group tabs, 20 of the 29 behaviors are behind a tab at any moment, and the caregiver must know which research group a behavior belongs to before they can find it. Cursing is under Aggressive, not Verbal, because that is how the items load in the manual's nursing-home factors (p.7). That is a researcher's map. On one page nothing is hidden and a tile never changes place.
- **Needs:** 4.1 (the tiles), 4.0 (the picture). **Branch:** `claude/log-one-page`
- **Files:** `src/ui/LogScreen.tsx`, `src/styles.css`, `e2e/flows`, `e2e/navigation`.
- **Change:** show all four groups one after another, each under its heading. The four tabs stay pinned under the top bar and jump to a group; the tab for the group in view is marked. The app already has this piece: `src/ui/SectionNav.tsx` (F-12, checked on an iPhone 2026-10-23). Use it. Do not write a second one.
- **Acceptance criteria:**
  1. All 29 tiles are in the page at once. No tile is removed from the page by choosing a tab.
  2. Tapping a tab scrolls its heading to just under the pinned tabs, not under them.
  3. A tile's place on the page is the same on every visit.
  4. Keyboard: Tab moves through tiles in reading order; the tabs are links in a `nav`, not `role="tab"`.
  5. `flows` and `navigation` pass; axe 0 violations in 4 modes.
- **How it is judged (V-15):** a first-click test. Show the Log screen, name a behavior, record where the first tap lands and how long it takes, for 8 behaviors, on both layouts. Devin and Shanmei can run it on each other with made-up prompts today. With caregivers it is a Stop (3.6).
- **Kill when:** the first-click test shows tabs are faster and no less accurate. Close the pull request and record the result as V-15. Round 3 stays.

#### 4.7 "When did it happen" on the confirmation (F-51)

- **Why:** Part 8, U5. A caregiver cannot log while they are dealing with hitting or a fall. They log after. Today the log is stamped "now" unless they open Edit and a sheet, three taps later. So the worst behaviors get the latest timestamps, which is exactly the error a sensor study cannot afford: other teams had to correct event times with video (Iaboni 2022, DOI 10.1002/dad2.12305). The fields to fix it already exist (`at`, `approx`).
- **Lane A:** no new stored field. It writes the same two fields the log details sheet writes today.
- **Needs:** 4.1. **Branch:** `claude/when-chips`
- **Files:** `src/ui/LogScreen.tsx`, `src/styles.css`, `e2e/flows`.
- **Change:** under "Logged: Repeating" the confirmation shows four chips: `Just now` (selected), `5 min ago`, `15 min ago`, `Earlier…`. A chip calls the existing `editLog` with `at = loggedAt - minutes` and `approx: true`. `Earlier…` opens the log details sheet. The confirmation stays 8 seconds and holds while touched, as now.
- **Acceptance criteria:**
  1. One tap still logs with the time of the tap. The chips are optional.
  2. Choosing `5 min ago` stores `at` five minutes before `loggedAt` and `approx: true`, and writes one change-history entry.
  3. Choosing `Just now` after another chip puts `at` back to `loggedAt` and clears `approx`.
  4. At large text the chips wrap; nothing runs off the side at 360 px.
  5. The same check as step 1.3: a chip that would put the log before the patient's first day shows that step's message.
- **Kill when:** in the internal pilot (3.6) the chips are tapped by mistake more than they are used on purpose. The change history shows both.

#### 4.8 Lab labels only in lab view

- **Why:** Part 8, U9. "Open (R4): a day ends at midnight here until Dr. Gupta confirms" is a note from the lab to itself. On a caregiver's screen it is noise, and it invites the question "is this app finished?"
- **Needs:** 5.0 (the switch), 4.2 (the first screen with a label). **Files:** new `src/ui/OpenLabel.tsx`, the screens that show a label.
- **Change:** one component, `<OpenLabel id="R4">a day ends at midnight</OpenLabel>`, that renders nothing unless study setting `labView` is on.
- **Acceptance criteria:** `grep -rnE "Open[ :(]+(R[0-9]|[DFPV]-)" src/ui` finds only `OpenLabel.tsx`; with `labView` off, no screen contains the text "Open:"; with it on, every label links to its register row.

---

### Stage 5. Built on assumed approval

Lane B unless a step says otherwise. Read "Rules for lane B work" in 1.3 first. Each step writes its own design note with the `requirement-pr` skill, numbered after the last note in `docs/design/notes/`. The note copies the step's "Assumed answer" and says what changes if Dr. Gupta picks differently.

Order: 5.0, 5.1, 5.2, then 5.3, 5.4, 5.6 in any order, then 5.7 to 5.11.

#### 5.0 Study settings: one place for every switch

- **Why:** lane B features are merged switched off (1.3). That needs one file that says what is on, read by everything, changed by nothing at run time.
- **Lane A:** it adds no field, collects nothing and changes no screen while every switch is off.
- **Register:** F-48. **Branch:** `claude/study-settings`
- **Files:** new `src/study/settings.ts`, new `tests/settings.test.ts`, `vite.config.ts` (one `define`), `src/ui/DataScreen.tsx` (About page line), `README.md`.
- **New (`src/study/settings.ts`):**
  ```ts
  // Every lane B feature reads one switch here. "caregiver" is what a study phone runs: only
  // what Dr. Gupta has signed off. "lab" is for trying features that are built on assumed
  // approval. The mode is fixed when the app is built, so a caregiver cannot turn anything on.
  export interface StudySettings {
    labView: boolean; // show "Open: <ID>" labels and register links
    caregiverProfiles: boolean; // R2 (5.2)
    pin: boolean; // R1 option A (5.3)
    blindCmai: boolean; // day-14 caregiver rating (5.4)
    ratingsVisibleToCaregivers: boolean; // D-24
    watchingHours: boolean; // F-38 (5.6)
    stoppedTap: boolean; // F-39 (5.7)
    extraBeforeChips: boolean; // F-41 (5.9)
    freeTextNotes: boolean; // P-11
    protectBackup: boolean; // F-10 (5.11)
  }

  const CAREGIVER: StudySettings = {
    labView: false,
    caregiverProfiles: false,
    pin: false,
    blindCmai: false,
    ratingsVisibleToCaregivers: true, // today's behavior; flips when D-24 is signed
    watchingHours: false,
    stoppedTap: false,
    extraBeforeChips: false,
    freeTextNotes: true, // today's behavior
    protectBackup: false,
  };

  const LAB: StudySettings = {
    labView: true,
    caregiverProfiles: true,
    pin: true,
    blindCmai: true,
    ratingsVisibleToCaregivers: false,
    watchingHours: true,
    stoppedTap: true,
    extraBeforeChips: true,
    freeTextNotes: true,
    protectBackup: true,
  };

  export type StudyMode = "caregiver" | "lab";
  export const settingsFor = (mode: StudyMode): StudySettings => (mode === "lab" ? LAB : CAREGIVER);
  export const STUDY_MODE: StudyMode = import.meta.env.VITE_STUDY_MODE === "lab" ? "lab" : "caregiver";
  export const study: StudySettings = settingsFor(STUDY_MODE);
  ```
- **Builds:** `npm run build` makes the caregiver build (what GitHub Pages serves). `VITE_STUDY_MODE=lab npm run dev` and Storybook run lab mode. Add `"dev:lab": "VITE_STUDY_MODE=lab vite"` using `cross-env` only if PowerShell needs it; test on Devin's desktop.
- **About page:** `Mode: caregiver` or `Mode: lab (features awaiting sign-off are on)`.
- **Tests first:** `settingsFor("caregiver")` has every lane B switch off and equals today's behavior; an unknown mode string gives caregiver; every key in `LAB` exists in `CAREGIVER` (so a new switch cannot be forgotten in one).
- **When Dr. Gupta signs a row:** one pull request flips that one switch in `CAREGIVER`, and the register row gets the date. Nothing else changes.
- **Acceptance criteria:** tests pass; the caregiver build is byte-for-byte the same in behavior (every existing browser check passes untouched); browser checks gain a second run in lab mode once a lane B feature exists.

#### 5.1 Database version 4

- **Why:** N-08. Everything below needs stored fields. Phones should upgrade once.
- **Register:** F-44, with D-20 (archive), D-22 (time zone), R2. **Branch:** `claude/db-v4`. Stacks on 5.0 and 1.2 (restore validation, which this extends).
- **Assumed answers:** a patient is archived with a reason, never erased, once it has a non-demo log (D-20). Each log records the phone's UTC offset at the moment of logging (D-22). Each record says who made it (R2).
- **Files:** `src/data/db.ts`, new `src/data/ids.ts`, `src/data/logs.ts`, `src/data/manage.ts`, `src/data/exporter.ts` (backup only; CSVs are 5.10), `tests/db.test.ts`, new `tests/fixtures/backup-v3.json` (made-up), `docs/data-dictionary.md`.
- **New fields.** All optional, so version 3 data is valid as it stands.

  | Table | Field | Type | Meaning |
  |---|---|---|---|
  | observations | `uid` | string | An ID unique across phones (`crypto.randomUUID()`). Version 3 logs get one at upgrade |
  | observations | `deviceId` | string | Which phone made it |
  | observations | `by` | string | Caregiver code, for example `C-02`. Empty before 5.2 |
  | observations | `tzOffsetMin` | number | Minutes from UTC on the phone when logged, for example `-300` |
  | observations | `endedAt` | number | When it stopped, if the caregiver said (5.7) |
  | checkins, changes | `by`, `deviceId` | string | As above |
  | patients | `archivedAt`, `archiveReason`, `archiveNote` | number, string, string | Archived, not erased (D-20) |
  | patients | `color` | number | Index into the resident color list, so a badge keeps its color when the list changes order |

- **New tables.**

  | Table | Key and indexes | Fields | Used by |
  |---|---|---|---|
  | `meta` | `key` | `key`, `value`. Rows: `deviceId`, `createdAt` | all |
  | `caregivers` | `id` | `id` (`C-01`), `initials` (2 or 3 letters), `pinSalt`, `pinHash`, `pinIterations`, `failedAttempts`, `lockedAt`, `createdAt`, `archivedAt` | 5.2, 5.3 |
  | `assignments` | `[caregiverId+patientId]` | `caregiverId`, `patientId`, `order`, `at` | 5.2 |
  | `watches` | `uid`, `patientId`, `[patientId+start]` | `uid`, `patientId`, `by`, `deviceId`, `start`, `end`, `startSource`, `endSource`, `tzOffsetMin` | 5.6 |
  | `caregiverRatings` | `uid`, `patientId`, `[patientId+windowStart+by]` | `uid`, `patientId`, `windowStart`, `by`, `deviceId`, `answers` (item number to 1 to 9), `startedAt`, `submittedAt`, `ruleVersion` | 5.4 |

- **Schema, old (`src/data/db.ts`):**
  ```ts
      this.version(3).stores({
        changes: "++id, patientId, observationId",
      });
    }
  ```
- **New:**
  ```ts
      this.version(3).stores({
        changes: "++id, patientId, observationId",
      });
      // Version 4: one upgrade for everything that needs new fields (design note: put this step's note number here). Existing
      // rows are kept. Each old log gets an ID that is unique across phones; nothing else is filled in.
      this.version(4)
        .stores({
          observations: "++id, patientId, [patientId+at], &uid",
          meta: "key",
          caregivers: "id",
          assignments: "[caregiverId+patientId], caregiverId, patientId",
          watches: "uid, patientId, [patientId+start]",
          caregiverRatings: "uid, patientId, [patientId+windowStart+by]",
        })
        .upgrade(async (tx) => {
          const deviceId = newId();
          await tx.table("meta").put({ key: "deviceId", value: deviceId });
          await tx.table("meta").put({ key: "createdAt", value: Date.now() });
          await tx.table("observations").toCollection().modify((o) => {
            if (!o.uid) o.uid = newId();
          });
        });
    }
  ```
  `newId` is `() => crypto.randomUUID()` in `src/data/ids.ts`, with a comment that it needs a secure context (the app is always served over HTTPS or from localhost).
- **A phone installed fresh at version 4** never runs `upgrade`. Add `db.on("populate", ...)` to write the two `meta` rows, and test it.
- **Restore** (`src/data/manage.ts`): match logs by `uid` when both sides have one, else by the old key `patientId|itemId|at|loggedAt`. Validate every new field the way step 1.2 validates the old ones. A version 3 backup restores into version 4.
- **Backup** gains `"formatVersion": 2` and the new tables. Never export `pinSalt`, `pinHash`, `pinIterations`, `failedAttempts` or `lockedAt`. Test that the words do not appear in a backup.
- **Delete patient** (`deletePatient`): if the patient has any log and is not a demo patient, it archives instead (sets the three fields, keeps everything). Demo patients and patients with no logs are still erased. The confirm sheet asks for a reason from a fixed list: `Added by mistake`, `Left the study`, `Duplicate`, `Other` (with a note).
- **Tests to write first:**
  1. Open a version 3 database built from `tests/fixtures/backup-v3.json`, upgrade, and find: every log has a distinct `uid`; counts of every table unchanged; `meta.deviceId` set; scores for every patient identical before and after.
  2. A fresh version 4 database has `meta.deviceId`.
  3. Restore the same backup twice: no duplicates.
  4. Restore a version 3 backup into version 4: `skipped` 0.
  5. A backup contains no `pin` field.
  6. Deleting a non-demo patient with one log leaves the log and sets `archivedAt`.
- **Acceptance criteria:** the six tests pass; `docs/test-cases.json` ratings unchanged; coverage floors hold; every existing browser check passes; the pull request states the undo: "a phone that has opened this build cannot open an older one; export, clear the app, restore".
- **Stop if:** the upgrade test changes any score. A schema change must not move a rating.
- **Before Devin merges:** export a backup from each phone that has the app. Only demo data is on them today.

#### 5.2 R2: caregiver profiles and resident order

- **Register:** F-45, R2. **Switch:** `caregiverProfiles`. **Branch:** `claude/caregivers`
- **Assumed answers:**
  - A caregiver is a code and initials (`C-02`, "JM"). Never a name. Whoever sets up the phone adds caregivers in Settings.
  - Any caregiver on the phone can log for any resident on the phone. "My residents" sets which residents come first in the switcher. It is not a lock. Reason: a lock that is wrong at 3 am stops a log from being made at all, and a missed log is worse for the study than a log by the "wrong" caregiver, which the record shows anyway.
  - Two caregivers can share a resident on one phone. Across two phones they share by backup and restore until a server exists (3.13).
  - The shift label in the mockup ("night shift") is not stored. The time of each log already says it.
- **Files:** new `src/data/caregivers.ts`, new `src/ui/CaregiverScreen.tsx` (Settings page), `src/ui/PatientSheet.tsx`, `src/ui/patientRows.ts`, `src/App.tsx`, `src/ui/LogScreen.tsx`, `src/ui/TodayScreen.tsx`, tests, new browser check `e2e/caregivers`.
- **Behavior with the switch on:**
  1. First open with no caregiver: Settings shows "Add the first caregiver". Until one exists the app works as today and `by` is empty.
  2. The top bar shows the current caregiver's initials next to the resident badge. Tapping them opens "Who is logging?", a list of caregivers on this phone. One tap switches (plus the PIN after 5.3).
  3. Every new log, check-in, change, watch and rating carries `by`.
  4. The resident switcher lists "My residents" first, in the caregiver's order, then "Others on this phone".
  5. Today shows "by JM" on each log, as the mockup does.
  6. A caregiver can be archived, not deleted, once they have a record. Their code is never reused.
- **Acceptance criteria:**
  1. Switch off: no caregiver UI anywhere, `by` never written, all existing checks pass untouched.
  2. Switch on: a log made after switching caregiver carries the new code; the change history for an edit carries the editor's code, which may differ from the logger's.
  3. Codes match `/^C-[0-9]{2,3}$/`. Initials match `/^[A-Z]{2,3}$/`. The form says "Initials only, not a name".
  4. From app open to a saved log for the last resident used: one tap (the tile). Switching caregiver never sits between a caregiver and a tile unless the caregiver chose to switch.
  5. axe 0 violations in 4 modes, in lab mode.

#### 5.3 R1 option A: on-phone PIN

- **Register:** F-46, R1. **Switch:** `pin`. **Branch:** `claude/pin`. Uses the threat model from step 3.3; if that file is not merged yet, read it on branch `claude/project-thread-v7mm5u` (`docs/security/threat-model.md`).
- **What a PIN on the phone is, and is not.** It says who is logging, and it stops a passer-by opening the app. It does not protect the data from someone who has the unlocked phone and a computer: a 4-digit secret has 10,000 values and anything encrypted with it can be opened by trying them all. The phone's own passcode and its built-in storage encryption are the real guard. Write this in the design note and in the threat model in these words. Do not describe the PIN as encryption anywhere.
- **Standard followed:** NIST SP 800-63B treats a secret that unlocks something on the device as an "activation secret": at least 4 characters, 6 recommended, and no more than 10 wrong tries in a row ([SP 800-63B-4, "Activation secrets"](https://pages.nist.gov/800-63-4/sp800-63b.html); read 2026-11-10). It would not pass as a password on its own, where the minimum is 15.
- **Assumed answers:**
  - 4 digits, as the mockup shows. Six is NIST's "should". Four is taken because the caregiver enters it one-handed at the start of a shift; list it in the register as an assumed answer for Dr. Gupta to confirm or raise.
  - Asked **once per shift**: when the app opens with no one signed in, when someone taps "Switch caregiver", and after 12 hours signed in. Never between opening the app and tapping a tile during a shift. Locking the phone does not sign the caregiver out; the phone's lock covers that.
  - Wrong PIN: after 5 tries a 30-second wait that doubles each time; after 10 in a row that caregiver is locked until a setup PIN is entered.
  - **Setup PIN:** 6 digits, set when the first caregiver is added, held by whoever set up the phone. It resets a caregiver's PIN and unlocks a locked one. It reads no data. If it is lost: export a backup, clear the app, restore, set up again. Logs are never behind the PIN, so nothing is lost.
- **Storage:** PBKDF2-HMAC-SHA256 through the browser's Web Crypto, 600,000 iterations ([OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)), a random 16-byte salt per caregiver. Store salt, hash and iteration count. Never store the PIN. Compare hashes in constant time.
  ```ts
  // src/data/pin.ts
  // Turns a PIN into a hash that is slow to guess. The PIN itself is never stored.
  const ITERATIONS = 600_000; // OWASP Password Storage Cheat Sheet, PBKDF2-HMAC-SHA256

  export async function hashPin(pin: string, salt: Uint8Array, iterations = ITERATIONS): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
    return new Uint8Array(bits);
  }

  export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }
  ```
- **Files:** new `src/data/pin.ts`, new `src/data/session.ts` (who is signed in, since when; kept in memory and in `localStorage` as caregiver code and sign-in time only, so closing and reopening the app within 12 hours does not ask again), new `src/ui/SignInScreen.tsx` (the mockup's keypad), `src/App.tsx`, `src/ui/CaregiverScreen.tsx`, tests, new browser check `e2e/sign-in`.
- **Tests first:** the same PIN and salt give the same hash; a different salt gives a different hash; the 5th wrong try starts a wait; the 10th locks; a right PIN clears the count; a backup contains no PIN field; `sameBytes` is false for different lengths.
- **Acceptance criteria:**
  1. Switch off: no sign-in screen; all existing checks pass untouched.
  2. Sign in, close the app, reopen within 12 hours: no PIN asked, one tap logs.
  3. The keypad's keys are 64 px or more, the dots are announced as "2 of 4 digits entered" (the mockup has this), and a wrong PIN says so in words, not by color alone.
  4. Time to hash on Devin's iPhone is under 1 second. If it is over, keep 600,000 and show a spinner; do not lower the count without a register row.
  5. Run `/security-review` on the pull request and fix what it finds.
- **Not now:** Face ID or Touch ID through passkeys (WebAuthn). It would remove the PIN entirely and is the better end state. Reason for not now: whether it works in a Home Screen web app on the phones the lab will use is not known, and P-10 (whose phones) is open. Recorded in Part 7.

#### 5.4 Blind caregiver CMAI at day 14, codes 8 and 9

- **Register:** F-47, D-14, D-06, D-24. **Switch:** `blindCmai`. **Branch:** `claude/blind-cmai`
- **Why it matters most of the lane B steps:** it is the measurement the app's rating is tested against (spec section 5; protocol 3.9). Without it there is no study, only an app.
- **Assumed answers:**
  - When a period ends, each caregiver who logged at least one behavior for that resident in those 14 days is asked for a full CMAI for those 14 days: 29 items, each 1 to 7 with the manual's labels (p.5), or 8 (would happen if not prevented) or 9 (not applicable) (p.3, p.5).
  - Code 8 is a separate code, not an estimate (D-06 default).
  - **Blind:** the caregiver cannot see the app's ratings or the period's counts for that resident before submitting. With `ratingsVisibleToCaregivers` off they never see ratings at all (D-24). The form shows no count, no "most logged", no hint.
  - A submitted rating is locked, like the app's. It can be left half done and finished within 7 days of the period's end. After that it is recorded as not done.
  - It never changes the app's rating, and the app's rating never changes it.
- **Files:** new `src/data/caregiverRatings.ts`, new `src/ui/RatingScreen.tsx`, `src/ui/route.ts` (`#/rating/<patient>/p<n>`), `src/ui/LogScreen.tsx` (one line when a rating is due), `src/data/exporter.ts` (backup only; CSV in 5.10), tests, new browser check `e2e/blind-rating`.
- **The form:** one behavior per row, grouped as on Log, the short name and the same "what counts" text. Seven numbered buttons with the frequency label under the chosen one, then `8` and `9` with their meaning in words. A progress count ("12 of 29"). No default answer and no "mark the rest as never": either would put the app's opinion into the caregiver's answer.
- **Acceptance criteria:**
  1. Switch off: nothing changes.
  2. With a finished period and no submission, Log shows one line: "Two-week rating due for P-03" with a button. It is not a blocker; logging still takes one tap.
  3. The rating screen contains no number taken from the logs. Test: seed a resident with 20 logs of one behavior, open the form, and assert the page text has no "20" and no rating square.
  4. Submitting stores one `caregiverRatings` row with all 29 answers, `by`, `submittedAt` and `ruleVersion`. A second submit for the same caregiver, resident and period is refused.
  5. After submitting, and only in lab view, a comparison table shows the caregiver's answer beside the app's rating for each behavior, with "within 1 point" marked (manual p.7).
  6. The app's scores for `docs/test-cases.json` are unchanged, and no function in `src/scoring/` reads `caregiverRatings`. Test by grep.
  7. Filling all 29 one-handed at 390 px takes under 3 minutes for Devin with made-up answers. Write the time in the pull request.
- **CMAI content:** the 1 to 7 labels are the manual's (p.5). Using them is covered by the same permission question as the item names (P-01). `NOTICE` gets a line for them.
- **Stop if:** the form needs the manual's item wording word for word. Reworded definitions only, as today.

#### 5.5 R1 option B: lab accounts or REDCap

- **Stop.** It needs a server the lab has not provided and an answer on where data may live (P-03, P-04). The design is step 3.13. Do not stand up a test server, a cloud database or a mock sign-in that looks real.

#### 5.6 Watching hours (F-38)

- **Source:** research scan, proposal 1. Sensor studies' "not agitated" class includes sleep, apathy and anything staff did not see (Iaboni 2022, DOI 10.1002/dad2.12305); nurses' charts missed agitation the research data recorded (Khan 2021, preprint, https://arxiv.org/abs/2104.09305; both as read in the scan). That the app can fix this by recording when someone was watching is the scan's inference, not a published result.
- **Register:** F-38, D-25 (how a watch starts and ends), D-11 (which it extends). **Switch:** `watchingHours`. **Branch:** `claude/watching-hours`
- **This is data about caregivers as well as residents** (when a named code was with a resident). The IRB question for it is in the packet (3.1). Built switched off like the rest.
- **Assumed answers (D-25):**
  - A watch starts when the caregiver taps "I'm here" on Log, **or** when they log a behavior for that resident with no watch open. The record says which: `startSource` is `"tap"` or `"log"`.
  - It ends on "I've left", on switching resident or caregiver, on sign-out, or by timeout: a watch with no tap in the app for 4 hours ends at the last tap, and on next open the app asks "Still with P-03 since 2:05 PM?" with `Yes` and `I left about…`. `endSource` is `"tap"`, `"switch"`, `"signout"` or `"timeout"`.
  - A watch with no logs in it means "watched and calm". That is what "Nothing to log today" says by the day (D-11), now by the hour. The check-in button stays for days with no watch.
  - One open watch per caregiver per phone.
- **Files:** new `src/data/watches.ts`, `src/ui/LogScreen.tsx` (the strip from the round 4 picture), `src/ui/TodayScreen.tsx` (the band under the hour chart), new `src/scoring/coverage.ts`, tests, `e2e/flows`.
- **Pure function, tested first:** `watchedMinutesByHour(watches, dayStart): number[24]`, and `coverage(watches, start, end): { watchedMinutes, totalMinutes }`. Overlapping watches by two caregivers count once.
- **Acceptance criteria:**
  1. Switch off: no strip, no band, no `watches` rows.
  2. The strip is one line. Starting or ending a watch is one tap. Logging never requires a watch: a tile tap with no watch open logs and opens one.
  3. Today shows the band on the same 24-hour scale as the bars, and the sentence "A gap with no bar means nobody was watching, not that it was calm."
  4. Once step 4.3 exists, Two weeks shows watched hours per day beside logs per day in lab view. Until then this criterion is noted as pending in the pull request.
  5. No rating changes. Counts are **not** divided by watched hours anywhere in the app (D-12: never scale counts). The export carries both and the analysis plan (3.9) says how they are used.
  6. A watch left open over midnight is cut into two days by the pure function, not in storage.
- **Kill when:** in the internal pilot more than half of watches end by `timeout`. Then the tap is not being used and the data is the app guessing. Record it and go back to D-25.

#### 5.7 Optional "it stopped" tap (F-39)

- **Source:** research scan, proposal 2. Sensor models need a start and an end; other teams got them by reviewing video (Iaboni 2022, DOI 10.1002/dad2.12305).
- **Register:** F-39. **Switch:** `stoppedTap`. **Field:** `endedAt` (5.1). **Branch:** `claude/it-stopped`
- **Assumed answers:** offered only for the three behaviors the spec calls continuous (pacing, mannerisms, general restlessness; spec section 4) and shown as an optional button after one of them is logged. One tap is still one occurrence. `endedAt` is never read by scoring.
- **Change:** after logging one of the three, the Today row for that log, and the confirmation, show `It stopped`. Tapping it stores `endedAt = now` and writes a change-history entry. In the log details sheet it can be corrected like the start time.
- **Acceptance criteria:** switch off, nothing shows; `endedAt` before `at` is refused; ratings for `docs/test-cases.json` unchanged with any `endedAt` values (add it to the property tests in 2.11: "end times never change a rating").
- **Kill when:** the pilot shows it is tapped on fewer than 1 in 10 eligible logs. An end time on a tenth of events is not usable as a label and costs screen space.

#### 5.8 Clock check screen (F-40)

- **Source:** research scan, proposal 3. A log and a wristband must agree to the second to be paired. The scan marks this as standard practice in sensor studies with no single source; treat it as an inference.
- **Lane A:** it stores nothing and collects nothing.
- **Register:** F-40. **Shown when:** `labView` is on. **Branch:** `claude/clock-check`
- **Files:** new `src/ui/ClockScreen.tsx`, `src/ui/route.ts` (`#/data/clock`), `src/ui/DataScreen.tsx` (one row in Settings, lab view only).
- **The screen:** the phone's time to the tenth of a second in large type, the date, the UTC offset, the time zone name, and the device ID from `meta` once 5.1 exists. One sentence: "Film this screen next to the wristband or camera at the start and end of a session."
- **Acceptance criteria:** the time is drawn from `Date.now()` on every animation frame, not from a one-second timer (a timer drifts and skips); the digits do not shift sideways as they change (tabular figures); with reduced motion on it still updates, since the change is the content; axe 0 violations.

#### 5.9 Three more "just before" chips (F-41)

- **Source:** research scan, proposal 4. Indoor temperature and agitation (Tartarini 2017, DOI 10.1177/1533317517704898); sleep (Tanev 2017, DOI 10.1176/appi.neuropsych.16090166, which found average sleep tracked symptoms but one night did not predict the next day); illness under the behavior (Capstick 2024, DOI 10.1038/s41746-023-00995-5, on urinary infections, which predicts infection, not agitation). All as read in the scan, mostly at abstract level; step 3.10 checks them.
- **Lane B:** no new field, but it changes what is collected. **Register:** F-41. **Switch:** `extraBeforeChips`. **Branch:** `claude/before-chips`
- **File:** `src/ui/LogSheet.tsx`, `docs/data-dictionary.md`.
- **Old:**
  ```ts
  export const BEFORE_OPTIONS = ["Personal care or bathing", "Mealtime", "Noise or crowding", "Seemed in pain", "Change in routine", "Visitor or phone call", "Nothing noticed", "Other"];
  ```
- **New:**
  ```ts
  const BEFORE_BASE = ["Personal care or bathing", "Mealtime", "Noise or crowding", "Seemed in pain", "Change in routine", "Visitor or phone call"];
  // F-41, on assumed approval: three causes the sensor literature names and the list lacked.
  const BEFORE_EXTRA = ["Too hot or too cold", "Slept badly last night", "Seemed unwell"];
  export const BEFORE_OPTIONS = [...BEFORE_BASE, ...(study.extraBeforeChips ? BEFORE_EXTRA : []), "Nothing noticed", "Other"];
  ```
- **Acceptance criteria:** switch off, the list is exactly today's eight in today's order; switch on, eleven, with "Nothing noticed" and "Other" still last; restore accepts all eleven values in either mode (a backup from a lab phone must restore on a caregiver phone); the sheet still fits above the keyboard at 360 by 640.
- **Wording is the lab's to change.** "Seemed unwell" is a caregiver's impression, not a finding. The data dictionary says so.

#### 5.10 Export format 2 and the label file (D-23)

- **Why:** A-08, A-14, 3.4, and the scan's main point: the logs are labels for the sensor work, so they should come out in a form a model can read.
- **Register:** D-23. **Branch:** `claude/export-v2`. Needs 5.1 and the data dictionary (3.4).
- **Assumed answers:** every file names its format version and the app version. Every time is given twice: UTC, and local with its offset. Ratings in a finished period are exported as they stand at export, with the export time; "final 24 hours after the period ends" (D-21) is recorded as a column, not enforced by changing data.
- **Changes to `src/data/exporter.ts`:**
  1. `observations.csv` gains `uid`, `device_id`, `caregiver`, `occurred_at_local`, `utc_offset_min`, `ended_at`, `schema_version`, `app_version`. Existing columns keep their names and order; new ones are added at the end, so a script reading format 1 by column name still works.
  2. `scores.csv` gains `schema_version`, `app_version`, `exported_at`, `period_final` (true when the period ended more than 24 hours before export), `watched_minutes`.
  3. New `watches.csv`: `uid`, `patient_id`, `caregiver`, `start`, `end`, `start_source`, `end_source`, `utc_offset_min`.
  4. New `caregiver_ratings.csv`: one row per item per submission, with the app's rating for the same item and period beside it and `within_one_point`.
  5. New `labels.csv`, the file for the sensor work: one row per interval for one resident, in time order. `kind` is `behavior` (with `item_id`, `start`, `end` or empty, `time_approximate`), `watched` (someone was there and logged nothing in this stretch) or `unobserved`. A reader can take "calm" from `watched` rows only.
  6. All CSV cells go through the safe-cell function from step 1.6.
- **Tests first:** format 1 column names are all present, in the same order, at the start of the format 2 header; a log at 23:30 local on a UTC-5 phone has a local date one day before its UTC date; `labels.csv` intervals for a day do not overlap and cover the day exactly; a resident with no watches has no `watched` rows.
- **Acceptance criteria:** tests pass; `docs/data-dictionary.md` has every new column with type, unit, allowed values and a made-up example; a backup and its CSVs made from the demo data are attached to the pull request description, not committed.

#### 5.11 Protect the backup file (F-10)

- **Why:** a backup holds every log. Today it is plain JSON and the app suggests keeping it in email or a cloud drive (A-12). The threat model (3.3) names "someone who gets a backup file".
- **Register:** F-10. **Switch:** `protectBackup`. **Branch:** `claude/protect-backup`
- **Assumed answers:** with the switch on, Export asks for a passphrase of at least 12 characters (shown, not hidden, with "write this down; without it the file cannot be opened"). The file is encrypted with AES-GCM using a key from PBKDF2-HMAC-SHA256, 600,000 iterations, random salt and nonce stored in the file's header. CSVs are not written unprotected when the switch is on: they go inside the same protected file, and the lab opens it with the Restore screen on a lab machine, which can then export CSVs.
- **Unlike the PIN, this is real protection,** because a 12-character passphrase cannot be tried exhaustively. Say so in the design note, and say the limit: a weak passphrase is weak.
- **Files:** new `src/data/protect.ts`, `src/data/exporter.ts`, `src/data/manage.ts`, `src/ui/DataScreen.tsx`, tests.
- **Tests first:** encrypt then decrypt gives the same bytes; a wrong passphrase fails with a clear message and restores nothing; one flipped byte in the file fails (AES-GCM checks integrity); an unprotected format 1 or 2 backup still restores.
- **Also change the message** (A-12): `Keep it somewhere safe, like your email or cloud drive.` becomes `Keep this file where the study team told you to.` in caregiver mode. The data management plan (3.2) names the place.
- **Acceptance criteria:** tests pass; `/security-review` run and addressed; restore of a protected file works offline.

---

### Stage 6. Before any real participant

A checklist, not a build. Every line needs a name and a date in the register. All of it is **Stop**: nothing here is assumed.

- [ ] IRB determination or approval in hand (P-03), and it covers data about caregivers (watching hours, caregiver codes, the day-14 rating), not only residents
- [ ] Data management plan approved (3.2); the app's backup message names the approved place
- [ ] CMAI permission in writing (P-01)
- [ ] Every lane B row that is switched on in the caregiver build has Dr. Gupta's sign-off and a date in the register. A row "built on assumed approval" stays switched off
- [ ] Whose phones (P-10): the lab's or the caregivers' own. If their own: a written rule for what happens to the data when a caregiver leaves
- [ ] Every study phone has a passcode and auto-lock. The PIN in 5.3 does not replace this
- [ ] The app is served from an address the lab or ODU controls, that can send security headers
- [ ] Deploys happen only on a version tag (2.7)
- [ ] Backup file protected (5.11), as the threat model says
- [ ] Data dictionary frozen at a format version (3.4, 5.10)
- [ ] Protocol and analysis plan fixed in writing before the first real log (3.9)
- [ ] Internal pilot done with made-up data and its kill rules checked (3.6, V-16)
- [ ] Agreement study run and reported (V-01)
- [ ] Usability sessions run (V-09)
- [ ] Checked on the real phone models the caregivers will use, including "About" showing `Data on this phone: kept` (1.9)
- [ ] Quick card printed and a named person to call (3.12)
- [ ] A written step for "a phone is lost", "a caregiver leaves" and "real data showed up somewhere it should not be"
- [ ] A written step for the end of the study: export, hand to the lab, clear every phone, who confirms it

---

### Stage 7. Later, design only

#### 7.1 Alert check (F-43)

- **Source:** research scan, proposal 6. When a sensor model flags possible agitation, ask the caregiver "Did you see agitation in the last 10 minutes?" and store the answer. Kleine Deters 2024 ([DOI 10.1016/j.pmcj.2024.101876](https://doi.org/10.1016/j.pmcj.2024.101876)) is the scan's source for staff confirming model flags; read at abstract level.
- **Stop to build.** It needs a sensor model, a server to carry the flag, and a decision that an app in a care setting may prompt staff. None exists.
- **Lane A to write:** `docs/design/notes/0NN-alert-check.md`, one page. What the prompt says, what is stored (flag ID, shown at, answer yes, no or not sure, answered at, by), what it must never do (it is not an alarm; a missed prompt is recorded as missed, not as "no"), and that a "yes" is not a log: the caregiver still taps the behavior.
- **Do not** add a notification permission prompt, a push service or a placeholder screen to the app.

---

## Part 6. Routines

| When | What | Who |
|---|---|---|
| Every pull request | The route in 1.4. `simplify`, then `code-review`. `security-review` if it touches storage, export, restore, sign-in or backup protection | Claude |
| Every lane B pull request | Also: both builds checked (caregiver and lab); the register row says "built on assumed approval, sign-off pending"; the description says how to undo | Claude |
| Every merge | Deploy run green; step marked Done; steps stacked on it rebased | Claude |
| When Dr. Gupta answers a row | One pull request: flip that switch in `src/study/settings.ts` or change the build to his answer; date in the register | Claude, Devin merges |
| First week of each month | Merge the Dependabot minor-and-patch pull request; run the CMAI checks on the desktop | Devin |
| Every quarter | Rerun `plans/whole-project-audit-prompt.md`; download a backup on the phone and restore it on a second device; review `ignore` entries in `dependabot.yml`; reread Part 7's "not now" rows and move any whose reason has gone | Devin and Claude |
| Each release | `docs/process/release.md` | Devin |

---

## Part 7. What a top professional would check

One table per discipline. Each gap is a step in Part 5 or a "not now" with its reason. "Not now" is a decision, not a to-do. Reread them each quarter (Part 6).

### 7.1 Research method

| A professional would ask | Where the project stands | In this plan |
|---|---|---|
| Is the main claim written down before the data exists, with the statistic and the pass mark? | The manual's "within 1 point on 88% of items" (p.7) is named in v4 but there is no protocol | 3.9 |
| Is the comparison blind? | Caregivers see the app's ratings today, so a day-14 CMAI by the same person would lean on them (anchoring; inference from general measurement practice, not a CMAI source) | D-24, 5.4, switch `ratingsVisibleToCaregivers` |
| Does logging change what is noticed? | Not addressed. A caregiver who taps all shift may rate higher at day 14 | 3.9 section 6: report it as a limit; cannot be designed away |
| Does "no log" mean calm or nobody watching? | Only by the day ("Nothing to log today", D-11) | 5.6 watching hours, 5.10 label file |
| Are times accurate enough to pair with sensors? | `at` and `loggedAt` exist; nothing checks the phone's clock | 5.8, 3.14, 4.7 (fewer late timestamps) |
| Are sources read in full? | The scan read most at abstract level and says so | 3.10 |
| Will it be reported to a standard? | None named | 3.9 section 7 (GRRAS; STARD if a model is graded) |
| Who is an author, and how is AI use declared? | One README paragraph | 3.11 |
| Is the rule reproducible later? | `RULE_VERSION` and `docs/test-cases.json` exist | 5.10 puts rule, format and app version in every file |
| **Not now:** a second site, a power calculation by Claude, a public preregistration | | Dr. Gupta's calls. 3.9 leaves the blanks and the reasoning |

### 7.2 Ethics and study conduct

| A professional would ask | Where the project stands | In this plan |
|---|---|---|
| Does any data describe caregivers? | Not today. After 5.2 and 5.6 it does: who logged, and when each code was with a resident | Stage 6 line 1; packet 3.1; built switched off |
| Could a caregiver think a log reports an incident? | The app says "not a medical device" only | 1.10, P-12 |
| Can free text carry a name? | "Other" before-notes and delete notes are free text | P-11: switch `freeTextNotes`; default kept, question in the packet |
| Whose phone is it? | Unknown | P-10; Stage 6 |
| What happens at the end? | Nothing written | Stage 6 last line; 3.2 |
| **Not now:** consent screens inside the app | | Consent is the IRB's process on paper. An in-app checkbox would look like consent without being it |

### 7.3 Computer science

| A professional would ask | Where the project stands | In this plan |
|---|---|---|
| Is the scoring rule right for inputs nobody thought of? | 19 hand cases, 100% line coverage | 2.11 property tests |
| Can two phones' data be joined without conflicts? | Logs have per-phone autoincrement IDs; restore dedupes by a four-field key | 5.1 gives every record a cross-phone ID and device ID. Records are never edited in place, so a join is a set union (3.13) |
| Is time handled once, correctly? | Local time everywhere, DST tests exist, no offset stored | 5.1 `tzOffsetMin`, 5.10 both times, D-22 |
| Is the rule separate from the screens? | Yes: `src/scoring/` is pure | Keep. 5.4 criterion 6 and 5.6 criterion 5 guard it |
| **Not now:** formal proof of the rule; a CRDT library | | The rule is 223 lines and table-driven; properties cover it. Append-only records with unique IDs already merge without a library |

### 7.4 Development practice

| A professional would ask | Where the project stands | In this plan |
|---|---|---|
| Can unfinished or unapproved work merge without reaching users? | No. v4 held it on branches | 5.0 switches; lane B merges dark |
| When it fails on a caregiver's phone, can anyone tell why? | No | 2.13 |
| Is every dependency change reviewed? | Monthly Dependabot only | 2.12 |
| Are releases deliberate and reversible? | Every merge deploys | 2.7 (v4) |
| Do the checks cover Safari? | Chromium only | 2.6 (v4) |
| Can someone else pick this up? | CLAUDE.md, no CONTRIBUTING | 3.8 (v4), 0.7 |
| **Not now:** preview deploy per pull request | | GitHub Pages serves one site. The lab build runs locally and in Storybook. Revisit when the app moves to an ODU address (Stage 6) |
| **Not now:** mutation testing | | See 2.11 |
| **Not now:** error reporting service (Sentry and the like) | | It sends data off the phone. 2.13 is the version that sends nothing |

### 7.5 Security

| A professional would ask | Where the project stands | In this plan |
|---|---|---|
| What is being protected, from whom? | Draft threat model on the lab thread's branch | 3.3 |
| Does the PIN protect the data? | No, and it must not be described as if it did | 5.3 says so in words; phone passcode in Stage 6 |
| Is the PIN stored and limited to a standard? | Not built | 5.3: PBKDF2 600,000 (OWASP), 10 tries (NIST SP 800-63B) |
| Is the backup file safe in email? | Plain JSON, and the app suggests email | 5.11, and the message changes |
| Can a restore file or a CSV attack the lab's machine? | Open in v4 | 1.2, 1.6 (v4) |
| Are the build and deploy hardened? | Partly | 2.4 (v4), 2.12 |
| Does anything leave the phone? | No network calls after load | Keep. Lane A test part 2. 2.13 keeps it true |
| **Not now:** encrypting the database on the phone | | A key derived from a 4-digit PIN gives no real protection, and a long passphrase each shift fails the one-handed test. The phone's own encryption does this job. Revisit with passkeys |
| **Not now:** passkeys (Face ID, Touch ID) | | See 5.3. Depends on P-10 |
| **Not now:** Content-Security-Policy headers | | GitHub Pages cannot send them. Stage 6 (ODU address) |

### 7.6 Database and backend

| A professional would ask | Where the project stands | In this plan |
|---|---|---|
| How many migrations will a study phone see? | Three so far, more implied | 5.1: one, version 4, with an upgrade test written first |
| Is the upgrade tested on real-shaped old data? | No fixture | 5.1 `tests/fixtures/backup-v3.json` |
| Is deletion consistent with "the record is the record"? | Logs soft-delete; patients hard-delete | 5.1 archive (D-20) |
| Is the backup versioned and checked? | No version field | 5.1 `formatVersion`, 1.2 validation, 5.11 integrity |
| Is there a path to a server that does not need a rewrite? | No | 3.13 options; 5.1 IDs make sync a union |
| Is the export a stable contract? | Columns undocumented | 3.4, 5.10 (old columns keep name and order) |
| **Not now:** a server, accounts, live sync | | Stop: no approved place for data (P-03, P-04). Designed in 3.13 |
| **Not now:** moving off IndexedDB (SQLite in the browser) | | Dexie fits the size (thousands of rows per phone) and is tested. No problem to solve |

### 7.7 Frontend

| A professional would ask | Where the project stands | In this plan |
|---|---|---|
| Will the phone keep the data? | The app never asks | 1.9 |
| Does it work in Safari, where the study will run? | Unchecked | 2.6 WebKit; 2.10 manual pass on an iPhone |
| How big is it? | Recharts is the largest piece and draws two simple charts | 4.3, 4.4: CSS bars, Recharts removed; 2.8 budget |
| Is feedback right without sound or vibration? | `navigator.vibrate` does nothing on iPhone | 4.1: the visual confirmation carries it. Do not rely on vibration anywhere |
| Is there one set of styles? | App styles plus `mk-` mockup styles | Stage 4 rule: no `mk-` in `src/ui` |
| **Not now:** Spanish or other languages | | P-09 is open. Do now what is free: no text baked into images, no sentence built by joining fragments |
| **Not now:** tablet layout | | Wait for P-10 |
| **Not now:** native app | | The web app installs, works offline and needs no store review. Revisit only if 1.9 shows data being cleared on real phones |

### 7.8 What nobody had on a list

| Gap | In this plan |
|---|---|
| Training: the first five minutes decide whether a caregiver ever uses it | 3.12 |
| A person to call | 3.12 (blank for the lab), Stage 6 |
| Handover if Devin leaves the lab | 3.8, 3.11 |
| End of study: getting data out and phones cleared | Stage 6, 3.2 |
| A short list of what could sink the study | Below |

**Risks, shortest useful list.** Likelihood and impact are Claude's judgment, for Dr. Gupta and Devin to correct.

| Risk | Likely | Impact | What limits it |
|---|---|---|---|
| Caregivers stop logging after week one | High | The study has no data | 3.12, 4.1, 4.6, 4.7, the internal pilot's kill rules |
| A phone is lost or cleared mid-period | Medium | That resident's period is lost | 1.8, 1.9, 5.11 |
| IRB says caregiver data needs its own consent | Medium | Watching hours and profiles stay off | They are switches; the study runs without them |
| Dr. Gupta picks differently from an assumed answer | High, on some rows | Rework | Each lane B step states the undo; switches; no rating depends on any of it |
| The count bands (D-01) are wrong | Unknown | Agreement fails | Bands are a table; 3.9 fixes the test first; RULE_VERSION records a change |
| Real data lands in GitHub or a chat | Low | Serious | Rule 1.2; made-up data only; Stage 6 step |

---

## Part 8. Design and flow review

The test for every screen: a tired caregiver, mid-shift, one hand, a resident who needs them. The pictures are proposals drawn in the mockup, not app code: `plans/round-4-mockup-proposals.patch` (step 4.0 applies it) and the round 4 page at https://claude.ai/artifact/99uHyDxe2WmGt1b52QhEuQ. These are the assumed picks recorded in Part 2. Any of them can be reversed by Devin, and Dr. Gupta sees the working screens at 4.5.

### 8.1 What changes from round 3, and why

| # | Finding in round 3 | Proposal | Step |
|---|---|---|---|
| U1 | Tabs are named for where data is (Log, Report, Score, Data). Report's "Two weeks" and Score both show the two-week table | Tabs named for the question: **Log, Today, Two weeks, Settings**. Score folds into Two weeks | 4.2 to 4.4, decision 8 |
| U2 | Behaviors sit behind four group tabs. Twenty of 29 are hidden at any time, and a caregiver has to know that cursing is filed under "Aggressive" (factor table, manual p.7) | One page, all four groups, with a row of jump links that stays at the top | 4.6; first-click test V-15 before it merges |
| U3 | "Most logged" is a fixed list in the mockup; if it reorders live, tiles move under the thumb | A written rule: top 3 over the last 14 days up to last midnight, fixed for the day, hidden under 3 | 4.1 |
| U4 | An info button on each of 29 tiles: 29 small targets next to 29 large ones | One "What counts as each behavior?" button opening one searchable sheet | 4.1 (F-37) |
| U5 | To set an earlier time the caregiver opens the log sheet before logging. Severe events are the ones logged late (inference; 3.9 measures it) | Log first, then chips on the confirmation: Just now, 5 min ago, 15 min ago, Earlier… | 4.7 |
| U6 | Nothing says who is with the resident | One-line strip: "With P-03 since 2:05 PM", "I've left" | 5.6 (lane B) |
| U7 | "5 today" is a label. Fixing a log means finding Report | "5 today ›" opens Today. Today is the one place to edit or remove | 4.1, 4.2 |
| U8 | "Nothing to log today" is missing from the round 3 Log screen | It lives on Today's empty state, where the question "what happened today" is asked | 4.2 |
| U9 | "Open (R4)" labels show on caregiver screens | Shown only in lab view | 4.8 |
| U10 | Sign-in position in the flow is undecided | Once per shift, never between opening the app and a tile | 5.3 |
| U11 | Small things: a database icon for Settings; a checkbox icon for Report; mixed icon stroke weights; slashed zeros outside codes; "Remove…" where the sheet also edits | Gear; sun and calendar; one stroke weight; slashed zero only in codes; "Edit…" | 4.0, Stage 4 rules |
| U12 | Two weeks opens with the table; the answer a nurse wants is under it | Answer first: "So far this period" in one sentence, then the table, then detail | 4.3 |
| U13 | Room number on the resident badge | Remove it (P-04: a room number with a date is identifying). The round 4 pictures still show it; 4.0 takes it out | 4.0 |

### 8.2 The flow, with a tap budget

The budget is the acceptance test. A step that adds a tap to any of the first three rows of this table needs a register row saying why.

| Moment | Taps | Notes |
|---|---|---|
| App is open on the right resident; log a behavior | **1** | The tile. Nothing may sit in front of it: no sign-in mid-shift, no sheet, no confirm |
| Wrong tile | 1 | Undo on the confirmation, 8 seconds |
| It happened 15 minutes ago | 1 + 1 | Tile, then the chip |
| Add what was happening just before | 1 + 2 | Tile, "Add detail", chip. Always optional |
| Switch resident | 2 | Badge, row. Own residents first (5.2) |
| Start of shift | PIN (4) + 0 | Lands on Log for the last resident used |
| "What did I log today?" | 1 | "5 today ›" or the Today tab |
| Fix a log from this morning | 3 | Today, the row, Edit |
| "Nothing to log today" | 2 | Today tab, the button |
| "How is P-03 doing?" | 1 | Two weeks tab, answer in the first sentence |
| Day-14 rating | 1 + 29 + 1 | From the one-line prompt on Log |

### 8.3 Rules of taste, so screens stay one family

- One accent color, used for the thing to tap next. Rating colors appear only on ratings.
- A tap target is at least 44 px in this app (house rule; WCAG 2.2 SC 2.5.8 asks for 24). Tiles are far larger; the rule is for everything else.
- Dark mode is a first-class mode: night shift is when the app is used in a dim room. Every picture and check runs in both.
- Words before numbers. "3 times in the last hour" beats a chart for a caregiver; charts are for the nurse and the lab.
- Nothing moves that was not touched. No live reordering, no auto-scroll, no toast that covers a tile.
- No color alone, no sound alone, no vibration alone.
- One icon set (lucide), one stroke weight.
- Every screen answers one question, and its tab says which.

### 8.4 What still needs people, not opinions

Design review finds what an expert can see. It cannot tell whether a caregiver finds "Trying to get somewhere else" under the right group. That is V-15 (a first-click test, five people, made-up data, the internal pilot) and then the usability sessions (V-09, Stop).

---

## Part 9. Research proposals: where each one lives

From the scan "Missed connections in agitation detection" (link in project memory, `cmai-research-scan`). The scan's caution carries over: most sources were read at abstract level; step 3.10 checks them in full text. "Inference" marks a link the scan drew itself.

| # | Proposal | Step | Register | Lane | Main source | Assumed answer |
|---|---|---|---|---|---|---|
| 1 | Watching hours: record when someone was with the resident | 5.6 | F-38, D-25 | B | Iaboni 2022, DOI 10.1002/dad2.12305; Khan 2021, arXiv 2104.09305 (preprint). Fix is inference | Starts on "I'm here" or first log; ends on tap, switch, sign-out or 4 h; source recorded |
| 2 | Optional "it stopped" tap | 5.7 | F-39 | B | Iaboni 2022 (video-reviewed start and end) | Three continuous behaviors only; never read by scoring |
| 3 | Clock check screen | 5.8 | F-40 | A | Standard practice; inference | Lab view only; stores nothing |
| 4 | Three more "just before" chips | 5.9 | F-41 | B | Tartarini 2017, DOI 10.1177/1533317517704898; Tanev 2017, DOI 10.1176/appi.neuropsych.16090166; Capstick 2024, DOI 10.1038/s41746-023-00995-5 | "Too hot or too cold", "Slept badly last night", "Seemed unwell" |
| 5 | Pattern card: what the logs suggest, in a sentence | 4.3 | F-42, D-18 | A (it shows what is already stored) | Bankole 2020, DOI 10.1177/1533317520906686; Husebo 2011, DOI 10.1136/bmj.d4065 for pain. Thresholds are inference | Thresholds as in 4.3 (20 or more logs), named constants, worded "often", never "because" |
| 6 | Alert check | 7.1 | F-43 | Stop | Kleine Deters 2024, DOI 10.1016/j.pmcj.2024.101876 | Design note only |
| also | Label file for sensor work | 5.10, 3.14 | D-23 | B | Scan section 3 (inference) | `labels.csv`: behavior, watched, unobserved |
| also | Blind comparison design | 5.4, 3.9 | F-47, D-24 | B | Cohen-Mansfield and Libin 2004, DOI 10.1002/gps.1171 (abstract level) | Caregivers do not see ratings before the day-14 form |

### 9.1 Register IDs this plan uses

Step 0.8 adds every one of these to `docs/review-register.md`. None is settled by being listed.

| ID | What | Step |
|---|---|---|
| F-30 to F-37, D-19 to D-22, P-08, P-09, V-13 | As proposed in v4, unchanged | as in v4 |
| F-38 to F-43, D-23 | Research proposals and export format 2 (numbers shared with the lab readiness thread) | 5.6 to 5.10, 7.1, 4.3 |
| D-24 | Do caregivers see the app's ratings? Assumed no, for the blind comparison | 5.0, 5.4, 4.3 |
| D-25 | How a watch starts and ends | 5.6 |
| F-44 | Database version 4 fields and tables | 5.1 |
| F-45 | Caregiver profiles | 5.2 |
| F-46 | On-phone PIN | 5.3 |
| F-47 | Blind day-14 CMAI | 5.4 |
| F-48 | Study settings | 5.0 |
| F-49 | Tabs: Log, Today, Two weeks, Settings | 4.0, 4.2 to 4.4 |
| F-50 | Log on one page | 4.6 |
| F-51 | When-chips on the confirmation | 4.7 |
| F-52 | Not used | |
| F-53 | Ask the phone to keep data | 1.9 |
| F-54 | Diagnostics | 2.13 |
| F-10 | Backup protection (existing row) | 5.11 |
| P-10 | Whose phones | Stage 6 |
| P-11 | Free-text notes: keep, limit or remove | 5.0 |
| P-12 | "This app tells no one" wording | 1.10 |
| V-14 | Property tests | 2.11 |
| V-15 | First-click test for Log on one page | 4.6 |
| V-16 | Internal pilot with made-up data | 3.6 |

### 9.2 Standards cited in this plan

Checked on 2026-11-10 by reading the page, except where marked.

- NIST SP 800-63B-4, activation secrets: at least 4 characters, 6 recommended, at most 10 consecutive failures. https://pages.nist.gov/800-63-4/sp800-63b.html
- OWASP Password Storage Cheat Sheet: PBKDF2-HMAC-SHA256, 600,000 iterations. https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- WCAG 2.2 SC 2.5.8 Target Size (Minimum): 24 by 24 CSS px. https://www.w3.org/TR/WCAG22/#target-size-minimum. The app's 44 px is a house rule, not Apple's minimum.
- GRRAS, reporting reliability and agreement studies: DOI 10.1016/j.jclinepi.2010.03.002
- Koo and Li 2016, choosing and reporting an ICC: DOI 10.1016/j.jcm.2016.02.012
- STARD 2015: DOI 10.1136/bmj.h5527
- CRediT contributor roles: https://credit.niso.org/

