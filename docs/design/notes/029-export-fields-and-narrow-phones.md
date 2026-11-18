# 029. Export fields line up; narrow phones fit

2026-11-18 · Register: F-56 (research export), F-45 (caregiver profiles) · Status: built on assumed approval (Devin), sign-off pending (Dr. Gupta) · Switch: `researchExport` and `caregiverProfiles`, lab build only; the add-form fix is in both builds · No storage change · No scoring change

## Problem

Found in the menus and pop-ups audit of 2026-11-18:

- On "Export for research" the Resident field and the button filled the card, but the two date fields were each a different width and neither reached the edge.
- On a 320 px phone, Settings pages with an add form scrolled 4 px sideways.
- On a 320 px phone, a caregiver's code broke across two lines ("C-" and "02") beside the buttons.

## Options for the pickers

1. Replace the system's resident list and date picker with our own. More code and more to test, and the system pickers are the ones people already know on their phone.
2. **Chosen:** keep the system pickers and fix the layout only.

## Decision

- Every control on the export card fills its space. The two days share a row in equal halves where there is room and stack on a phone.
- The add form's column may shrink below its widest child, which removes the sideways scroll.
- Under 360 px, a caregiver's buttons take their own line and the code never wraps.

## Acceptance criteria

1. The export card's four controls share a left and a right edge at 390 px and 320 px (`e2e/research-export.cjs`).
2. No sideways scroll on Backup at 320 px (`e2e/research-export.cjs`) or on Caregivers at 320 px (`e2e/caregivers.cjs`).
3. At 320 px each caregiver's code is on one line and every button stays inside the card, in every display mode (`e2e/caregivers.cjs`).
