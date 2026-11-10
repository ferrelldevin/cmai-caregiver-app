---
name: requirement-pr
description: Shape and open the pull request for one mobile requirement (R1 to R5) from cmai-mobile-plan.md. Use when starting work on any R requirement.
---

# One requirement, one pull request

## Before writing code

1. Open `docs/process/build-plan.md`. Take the first step that is Not started and whose Needs are Done.
2. Check its lane. Lane A may start. Lane B is built behind a study setting that is off in the caregiver build, and its register row says "Built on assumed approval. Sign-off pending". A step marked Stop does not start.
3. Find its open points in `docs/review-register.md`. Any scoring or data question without a decision gets a new register ID (D-xx, F-xx). Never settle it silently in code.
4. Write the design note in `docs/design/notes/NNN-<topic>.md`, numbered after the last note in docs/design/notes/. It holds: the problem, the options considered, the one chosen and why, and numbered acceptance criteria that can each be tested.

## Rules that do not bend

- Ratings are locked; nobody edits a score. Deletes need a reason and a confirm.
- Made-up data only, in code, tests, screenshots and the PR.
- Scoring changes need a new `RULE_VERSION` in `src/scoring/engine.ts` and updated `docs/test-cases.json`.
- Any claim about the CMAI cites the manual page, a DOI, or a register ID.

## Building it

- Each acceptance criterion gets a unit test or an `e2e/` check that names it.
- Use it for real with the `run-cmai` skill.
- R1 or anything touching storage, exports or sign-in: run `/security-review`.
- Run `/simplify`, then `/code-review` on the diff.

## The PR

Fill `.github/pull_request_template.md`: Problem (with register IDs), Shape (link the design note), What changes, States checked, Verified, Recorded. List which acceptance criteria are met and how each was checked. Open it as a draft; Devin moves it to ready.
