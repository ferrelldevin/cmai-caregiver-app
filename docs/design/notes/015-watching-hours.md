# 015. Watching hours

2026-11-10 · Register: F-38, D-25 · Status: built on assumed approval (Devin, 2026-11-10), sign-off pending · Switch: `watchingHours` (lab build only) · Build plan v5, step 5.6

## Problem

A day with no logs reads as calm. It may only mean nobody was with the resident. The CMAI asks how often a behavior happened over two weeks, and the sensor work needs to know which stretches were watched and calm and which were simply not watched. Today the app cannot tell them apart.

## Decision (assumed answers, each reversible)

- **A watch** is a stretch when one caregiver was with one resident. It is stored in the `watches` table from database version 4 (note 009): resident, start, end, how it started (`tap` or `log`), how it ended (`tap`, `switch`, `signout`, `timeout`), caregiver, phone and UTC offset.
- **How it starts and ends (D-25).** A one-line strip on Log says "With P-01 since 2:05 PM" or "Not marked as with P-01", with one button: "I'm here" or "I've left". A log with no watch open starts one, so logging never needs a watch. Switching resident, switching caregiver or signing out ends it. One open watch per caregiver per phone.
- **4 hours with no tap** in the app ends the watch at the last tap, not at the moment the app noticed. The next time the app opens it asks once: "Still with P-02 since 9:10 AM?" with "Yes, still here" (the watch carries on) or "No, I left about then" (it stays ended at the last tap). Four hours is a guess for a long stretch with nothing to log; the lab sets it.
- **Today** shows a band under the logs-by-hour bars, on the same 24 hours, darker for more minutes watched, with the sentence "A gap with no bar means nobody was watching, not that it was calm." Two caregivers watching at once count once.
- **Export format 2** (note 013) already carries `watches.csv`, `watched_minutes` on scores and the watched / unobserved stretches in `labels.csv`.

## What it does not do

- It does not change any score or rating rule. `watched_minutes` is reported, not used.
- It does not track where anyone is. The strip is a caregiver's own tap.
- It records when caregivers were with residents, which is data about caregivers too. The IRB question is in the review packet (3.1).

## Known limits

- The 4-hour clock lives on the phone. A phone left on a cart with the app open for hours still counts as watching until the timeout.
- The "Two weeks" part of criterion 4 (watched days in the two-week view) waits for the Two weeks tab (mockup phase 4).

## Checked

- Unit tests (`tests/watches.test.ts`): overlapping watches count once; minutes by hour, an open watch up to now, a watch over midnight split into two days; one open watch per caregiver; a switch ends the old one; the timeout ends at the last tap and "Yes, still here" undoes it; private mode counts from the start; the open watch is found when the app starts before the database has opened.
- Browser (`e2e/watching.cjs`, lab build): the strip is one line; a log starts a watch; "I've left" and "I'm here" each take one tap; switching resident ends the watch; the band and its sentence on Today; after 4 hours with no tap the app asks and "Yes, still here" carries on; axe 0 violations in four display modes. The browser check found that the open watch was missed on app start (the phone ID was read before the database opened), so the timeout never fired; fixed in `src/data/watches.ts`.
- The caregiver build shows none of it: `watchingHours` is off there (`tests/settings.test.ts`), and the caregiver-build checks pass unchanged.
