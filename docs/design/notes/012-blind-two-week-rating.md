# 012. The caregiver's blind two-week rating

2026-11-10 · Register: F-47, D-14, D-06, D-24 · Status: built on assumed approval (Devin, 2026-11-10), sign-off pending · Switch: `blindCmai` (lab build only; needs `caregiverProfiles`) · Build plan v5, step 5.4

## Problem

The study tests the app's rating against a caregiver's own CMAI for the same 14 days (spec section 5; protocol 3.9). Since D-14 removed the day-14 review, nothing in the app records that rating. Without it there is no study, only an app.

## Decision (assumed answers, each reversible)

- **Who and when.** When a period ends, each caregiver who logged at least one behavior for that resident in those 14 days owes a full CMAI for them: 29 behaviors, each 1 to 7 with the manual's labels (p.5), or 8 (would happen if not prevented) or 9 (not applicable) (p.3, p.5). Code 8 is a separate code, not an estimate (D-06 default).
- **Blind.** The form shows no count, no "most logged", no score, no default answer and no "mark the rest as never". Nothing on it comes from the logs. Item numbers are left off too, so no number on the screen can be read as a count. With `ratingsVisibleToCaregivers` off (D-24), caregivers never see the app's ratings at all.
- **Never a blocker.** Log shows one line, "Two-week rating due for P-03", with a Rate button. Logging still takes one tap.
- **Saved as it goes.** Each answer is stored as it is tapped, so a caregiver can stop and come back. The rating can be finished up to 7 days after the period ends. After that it is "missed" (computed, not stored) and no longer asked for.
- **Locked.** Submit needs all 29 answers and asks once ("Once submitted, nobody can change it"). A second submit for the same caregiver, resident and period is refused, and restore keeps one per caregiver, resident and period (note 009).
- **Both ways blind.** No function in `src/scoring/` reads the caregiver's rating (a unit test greps for it), and the app's rating never changes it. `RULE_VERSION` is stored with each rating so the comparison knows which rule made the app's side.
- **Lab view only, after submitting.** A table puts the caregiver's answer beside the app's rating for each behavior, with "within 1 point" (manual p.7). Codes 8 and 9 never count as within. A caregiver phone (lab view off) shows only "saved and locked".
- **Address.** `#/rating/P-03/p2`, so Back returns to Log and a reload stays on the form.

## Checked

- Unit tests (`tests/caregiverRatings.test.ts`): due only after the end and only for a caregiver who logged; a deleted log does not count; 7-day limit; 29 answers to submit; locked after; within-1 rule; no scoring file reads it.
- Browser (`e2e/blind-rating.cjs`, lab build): 20 made-up Hitting logs by JM, and the form's text has no "20" or "21" and no score element; no answer chosen in advance; 29 answers kept across leaving; one stored row with `by`, `submittedAt`, `ruleVersion`; lab table shows JM 4 beside the app's 5, within 1; axe 0 violations in four display modes.
- Not yet done: acceptance criterion 7, Devin filling all 29 one-handed at 390 px in under 3 minutes. A script takes 4 s; a person needs timing on a phone.

## What would change if Dr. Gupta picks differently

- **A paper CMAI instead:** switch off. The data model stays for a later import.
- **Only the primary caregiver rates:** `ratingStatus` filters by My residents (note 010) instead of "logged at least once".
- **Code 8 as an estimate:** the 8 button asks for 1 to 7 afterwards; `answers` keeps both. Needs a register row first.
