# 010. Caregiver profiles: who is logging, and My residents

2026-11-10 · Register: F-45, R2 · Status: built on assumed approval (Devin, 2026-11-10), sign-off pending · Switch: `caregiverProfiles` (lab build only) · Build plan v5, step 5.2

## Problem

R2 asks for caregiver and patient selection. Today a log says which resident and when, but not who made it, so the study cannot tell two caregivers' logs apart or compare a caregiver's own rating with the logs they made (F-47). Design note 007 left "who made the change" out for the same reason.

## Options

1. **Accounts with names and passwords.** Needs a server the lab has not provided (plan 5.5, Stop).
2. **A caregiver list on the phone: a code and initials, picked once, remembered.** Works offline, holds no names, and costs one tap to switch.
3. **Lock each resident to one caregiver.** A wrong lock at 3 am stops a log from being made at all.

## Decision (assumed answers, each reversible)

Option 2, with "My residents" as an order, not a lock.

- **A caregiver is a code and initials** (`C-02`, "JM"), never a name. Codes count up and are never reused, even after a caregiver with no records is removed (the highest number is kept in `meta`).
- **Whoever sets up the phone adds caregivers** in Settings > Caregivers. The first one added becomes the one logging.
- **Any caregiver can log for any resident on the phone.** A missed log is worse for the study than a log by the "wrong" caregiver, which the record shows anyway.
- **Who is logging** shows as a chip with their initials at the right of the resident bar. Tapping it opens "Who is logging?"; one tap switches. Nothing asks who is logging between opening the app and tapping a tile. With no caregiver chosen the chip reads "Who?" and logging works as before, with no code.
- **Every new log, check-in and change carries `by`.** An edit records the editor, who may differ from the logger.
- **My residents** sets the order of the resident switcher: "My residents" first in the caregiver's order, then "Others on this phone". Set in Settings > Caregivers by tapping residents in order.
- **A caregiver with a record is archived, not deleted.** Their code stays on their records and leaves the list.
- **Recent logs** say "by JM". The Today tab (plan 4.2) will show the same when it exists.
- **The shift label** in the mockup ("night shift") is not stored: the time of each log already says it.

## Layout

With the chip beside it, the resident bar's Switch pill shows its icon only, so "Period 1 · day 1 of 14" stays on one line at 390 px with three initials. The whole bar is still one button named "Choose patient". This is a lab-build layout; the round 4 mockup (plan 4.0) owns the final bar.

## Switched off (the caregiver build)

No chip, no Caregivers row, `#/data/caregivers` is not a page, and `by` is never written (`madeHere()` checks the switch). Every existing browser check passes untouched.

## Checked

- Unit tests: `tests/caregivers.test.ts` (codes, initials, archive, switching, editor's code, My residents order) and a route test.
- Browser: `e2e/caregivers.cjs` runs against the lab build in `npm run checks` (a second preview on port 4174): 31 steps, including axe with 0 violations on the new screens in light, dark and both high-contrast modes.
- Not yet checked on a phone, and not timed with a real caregiver (V-16, internal pilot).

## What would change if Dr. Gupta picks differently

- **No caregiver identity (R2 declined):** the switch stays off. `by` is never written.
- **Residents locked to caregivers:** `orderForCaregiver` becomes a filter, and the switcher hides others. One function and one sheet.
- **Names instead of initials:** not without the IRB's say and a place for the data to live (P-03, P-04).
