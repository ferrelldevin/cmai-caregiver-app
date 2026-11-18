# 026. Removing a caregiver asks first

2026-11-18 · Register: F-45 (caregiver profiles) · Status: built on assumed approval (Devin), sign-off pending (Dr. Gupta) · Switch: `caregiverProfiles`, lab build only · No storage change · No scoring change

## Problem

On Settings > Caregivers, "Remove" acted on one tap. It sits beside "Log as", at thumb height, and there is no undo on the page: a caregiver with logs is archived and leaves every list, one without logs is deleted. Removing a patient already asks first (note 004). Found in the menus and pop-ups audit of 2026-11-18.

## Options

1. An undo message after the tap. Fast, but the removed caregiver may be the one logging, and the next log would carry no code until someone noticed.
2. **Chosen:** the same confirm sheet a patient gets: a question, what will happen, Cancel and a red "Remove <initials>". One pattern for every removal in the app.

No reason is asked. A patient's removal needs one because it changes what the study can use (D-20); a caregiver's logs and code stay as they are.

## Decision

- "Remove" opens a sheet titled "Remove <initials>?". It says the caregiver leaves the list on this phone and that logs they made keep their code. If that caregiver is logging now, it says nobody will be chosen afterwards.
- Cancel, Esc, a swipe down or a tap outside keeps the caregiver. From the keyboard, focus starts on Cancel.
- What removal does is unchanged (`removeCaregiver`): archived with records, deleted without.

## Acceptance criteria

1. Remove opens the sheet and nothing is removed until its red button is pressed; Cancel and Esc keep the caregiver (`e2e/caregivers.cjs`).
2. Confirming deletes a caregiver with no logs and archives one with logs, with the same messages as before (`e2e/caregivers.cjs`).
3. The sheet warns when the caregiver is the one logging (`e2e/caregivers.cjs`).
4. axe WCAG 2.2 AA, 0 violations on the sheet (`e2e/caregivers.cjs`).
