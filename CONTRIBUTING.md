# Contributing to CMAI Tracker

For anyone joining the work: a lab member, a student, or an AI coding agent. Setup is in [README.md, "Run it"](README.md#run-it). The full build order is `docs/process/build-plan.md` once build plan step 0.7 lands it in the repo; until then it is in the project folder.

## Rules that do not bend

- **Made-up data only**, in code, tests, screenshots, pull requests, issues and chats. If you see anything that looks like real participant data, follow [SECURITY.md](SECURITY.md) and do not copy it.
- **Nobody edits a rating.** Ratings come from live logs only (register D-14). A delete needs a reason and a confirm.
- **A scoring change** needs a new `RULE_VERSION` in `src/scoring/engine.ts`, updated `docs/test-cases.json`, and Dr. Gupta's sign-off in `docs/review-register.md`.
- **Open scoring and data questions get a register ID.** Never settle one quietly in code.
- **Any claim about the CMAI or the research cites its source**: a manual page, a DOI or a register ID. Say when something is your inference.
- **CMAI content is © Cohen-Mansfield**, used under non-commercial terms. Keep `NOTICE` accurate.

## Which work may start: two lanes

| Lane | Covers | May start |
|---|---|---|
| **A. Build now** | Bug fixes, tests, checks, CI, docs, and screens that only change how existing data is shown | Now |
| **B. Needs Dr. Gupta** | Anything that changes a rating, adds or changes a stored field, adds sign-in or caregiver identity, sends data off the phone, or involves a real person | When its register row shows his sign-off with a date |

Work is lane A only if all four hold:

1. Ratings for `docs/test-cases.json` are unchanged.
2. No new field or table in `src/data/db.ts`.
3. Nothing leaves the phone that did not before.
4. Reverting the pull request puts the app back exactly.

## How a change gets made

The route is in [docs/process/change-process.md](docs/process/change-process.md): problem, shape, design every state, build, verify, record, ship. In practice, one change per pull request:

1. Branch from the latest `main`. Run `npm ci`.
2. Write the failing test or check first, and see it fail for the reason you expect.
3. Make the change. Touch only the files it needs.
4. Run `npm run lint`, `npm run typecheck`, `npm run test:coverage` and `npm run checks` (on a cloud machine: `CHROME=/opt/pw-browsers/chromium npm run checks`).
5. For anything a caregiver can see: use the app on demo data, and attach before and after screenshots at 390 px wide, light and dark.
6. Add a decision-log row to `docs/review-register.md` and a line under Unreleased in `CHANGELOG.md`.
7. Open a **draft** pull request with the template. List each acceptance criterion and how you checked it.

Never skip, weaken or delete a test to get a check green. Never push to `main`. Never run `npm audit fix --force`.

## Who does what

| Who | Does |
|---|---|
| Dr. Ajay Gupta (PI) | Signs off scoring rules, data location, IRB items and anything in the review register |
| Devin Ferrell | Maintainer. Marks pull requests ready, merges, changes GitHub settings, talks to Dr. Gupta |
| Shanmei Li | Teammate. Review and merge rights once Dr. Gupta agrees (review packet E5) |
| AI coding agents | Draft changes and open draft pull requests. They never merge, never mark a pull request ready, never send anything outside the project |

A merge to `main` deploys to every installed phone (see `docs/process/runbook.md`). Treat every merge as a release.

## Credit and AI use

- Name the people, libraries, datasets and sources you used.
- Commits made with an AI agent carry a `Co-Authored-By` line naming it. The README's "How this was built" section says how AI was used; keep it true.
- If any of this work becomes a class assignment, that course's AI policy applies first.
