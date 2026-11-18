# 028. Who is logging? sheet and the switch message

2026-11-18 · Register: F-45 (caregiver profiles), note 002 (patient switcher) · Status: built on assumed approval (Devin), sign-off pending (Dr. Gupta) · Switch: none for the message (both builds); the sheet is `caregiverProfiles`, lab build only · No storage change · No scoring change

## Problem

Found in the menus and pop-ups audit of 2026-11-18:

- Three-letter initials spilled out of the round badge in "Who is logging?", the caregiver list and the sign-in list.
- In "Who is logging?", "Manage caregivers" and "Sign out" were stacked with no space between them.
- The 4-second message after a switch ("Now on P-02", "AB is logging") hung under the banner, on top of the page title or the Back button.

## Options for the message

1. Keep it under the banner and push the page down while it shows. The page would jump twice in 4 seconds.
2. Put it inside the banner. The banner is already full at 320 px.
3. **Chosen:** show it just above the tab bar, where the "Logged" message already appears. One place for every short message, clear of titles and Back buttons. If a "Logged" message is on screen, this one sits above it.

## Decision

- The badge is 44 px, and three-letter initials use the smaller text size so they stay inside the circle.
- The sheet's two buttons sit side by side with space between them, and wrap with the same space on a narrow phone.
- The switch message moves to just above the tab bar. Its words, its 4 seconds and its screen reader announcement are unchanged.

## Acceptance criteria

1. Three wide letters fit the badge in the caregiver list and in "Who is logging?", in every display mode (`e2e/caregivers.cjs`).
2. "Manage caregivers" and "Sign out" have at least 8 px between them (`e2e/caregivers.cjs`).
3. The switch message sits above the tab bar, below the banner, and covers no title or Back button (`e2e/caregivers.cjs`).
4. The message still clears after 4 seconds (`e2e/patient-switcher.cjs`).
5. axe WCAG 2.2 AA, 0 violations on the sheet (`e2e/caregivers.cjs`).
