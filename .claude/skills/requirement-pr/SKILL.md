---
name: requirement-pr
description: Shape and open the pull request for one mobile requirement (R1 to R5) from cmai-mobile-plan.md. Use when starting work on any R requirement.
---

# One requirement, one pull request

## Before writing code

1. Confirm Dr. Gupta has marked up the review workbook for this requirement. If not, stop and say so.
2. Take the next requirement in the plan's build order. One requirement per PR.
3. Find its open points in `docs/review-register.md`. Any scoring or data question without a decision gets a new register ID (D-xx, F-xx). Never settle it silently in code.
4. Write the design note in `docs/design/notes/NNN-<topic>.md`, numbered after the last note (`008` sign-in and caregivers, `009` daily report and Scores fold). It holds: the problem, the options considered, the one chosen and why, and numbered acceptance criteria that can each be tested.

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
