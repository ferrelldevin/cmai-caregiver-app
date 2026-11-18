# 023. Role is three choices in view, not a dropdown

2026-11-18 · Register: F-58 (the role part) · Status: built on assumed approval (Devin), sign-off pending (Dr. Gupta) · Switch: `researchExport`, lab build only · No storage change · No scoring change

## Problem

The role added with F-58 was a dropdown in the same line as a caregiver's initials, code, "Log as" and "Remove". At phone width (390 px) that line needs more room than the card has: the dropdown covered the caregiver's code, and "Remove" ran past the edge of the card. Found by using the lab build on 2026-11-18; Devin asked for the fix the same day.

## Options

1. Keep the dropdown and let the line wrap. Cheapest, but the role stays two taps (open, pick) and hidden until opened.
2. Move everything about a caregiver into a sheet opened by tapping the row. Cleanest list, but one more tap for "Log as", and a new sheet to maintain for three small actions.
3. **Chosen:** give the role its own line under the row, as three choices that are always in view. One tap, the current role is readable without opening anything, and nothing shares the line with the initials and code any more. Three fixed, short choices is the case a segmented control is for (Apple Human Interface Guidelines, "Segmented controls": a small set of mutually exclusive choices); a dropdown earns its place when the list is long or changes.

## Decision

- The role is a group of three real radio buttons (Caregiver, Staff, Researcher), drawn as one segmented control in the style of the quick times on the log details sheet. The group is named "Role for <initials>" for screen readers; arrow keys move between choices as radio buttons do.
- Each choice is as wide as its word, so "Researcher" is never cut. Under 360 px the word "Role" moves above the three choices.
- Each choice is 44 px tall, the house touch size (WCAG 2.2 SC 2.5.8 asks for 24 px).
- What is stored does not change: `role` on the caregiver profile, "caregiver" when unset.

## Acceptance criteria

1. At 390 px, in every caregiver row, the initials and code, the actions and the role do not overlap and stay inside the card, and each role choice is at least 44 px tall and shows its whole word (`e2e/caregivers.cjs`).
2. Picking a role saves it on the profile and shows it as picked (`e2e/caregivers.cjs`).
3. axe WCAG 2.2 AA, 0 violations on the Caregivers page in 4 display modes (`e2e/caregivers.cjs`).
4. Checked by using it at 320, 360 and 390 px in light, dark and high contrast.
