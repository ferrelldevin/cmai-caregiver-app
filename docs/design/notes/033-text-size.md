# 033. Text follows the reader's own text size

2026-11-21 · Register: F-69 · Lane A · Both builds · No storage change · No scoring change · No export change

## Problem

Every font size in the app was a fixed number of pixels. A caregiver who has set Larger Text on their iPhone, or a bigger font in their Android browser, got the same small text as everyone else (F-69, found while writing the manual accessibility checklist, V-13). Older caregivers are the likeliest to have that setting on. Devin chose "Build it" on a decision card on 2026-11-21.

## The simplicity rule first

Design note 030 (F-65): open, tap, done. Nothing here adds a step, a setting or a screen. The phone's own setting is the control; the app has none of its own.

## Options looked at

1. An in-app "Text size" setting. Rejected: one more thing to find, and the phone already has the answer.
2. Follow the setting with no upper limit. Rejected: at the largest iPhone accessibility size body text is about three times the usual. Tried at twice the usual: the patient banner and the tab bar took about half of a 390 x 844 screen and no behavior tile was fully visible without scrolling. One-tap logging matters more than the last step of size.
3. **Chosen:** follow the setting up to one and a half times the usual size (17px body text becomes at most 25.5px), and make the layout give room at that size. Past that, zooming with two fingers still works, as before.

## What it does

- The five type sizes in `src/styles.css` are in rem, so they grow with the browser's font size. At the usual setting they are 13, 15, 17, 20 and 24px, as before.
- On iPhone and iPad the root font is `-apple-system-body`, which is the size chosen under Settings, Display & Brightness, Text Size (and Larger Text under Accessibility). It is 17px at the default setting, so the sizes are counted from 17 there and from 16 elsewhere. Other browsers ignore that rule. That keyword also sets the weight, style and line height on the root; they are the usual ones, and `body` sets its own line height.
- Each size stops at one and a half times its usual value.
- Log: the tiles are three across (four on a wide screen), or fewer when a behavior's name needs the room. At the largest followed size on a phone they are two across. A long name may break inside its tile and never runs out of it.
- Two weeks: when the ratings table is wider than the phone, its card scrolls sideways (`card-scroll`). The page does not.
- The few sizes that were written as bare pixels or rem now follow the same five sizes.
- The clock check's time (lab build) stays a fixed size: it is already the largest text in the app and has to fit one line.

## What it does not do

- It does not change spacing, icons or touch targets. They were already at least 44px.
- It does not change anything at the usual text size. The screenshots and checks at the default are unchanged.
- It is **not confirmed on a real iPhone.** The checks drive Chromium, which has no `-apple-system-body`, so they set the root font size by hand and exercise only the sizes counted from 16. Whether an installed Home Screen app picks up the setting, at the default, a middle and an accessibility size, and after the setting is changed while the app is open, is line 14 of the manual accessibility checklist. Until then the iPhone half of this is built but unproven.

## Risk and kill rule

At larger text fewer tiles fit on the first screen, so a caregiver with Larger Text scrolls more to reach a behavior. That is the trade they chose on their phone.

**Kill when:** the phone pass (build plan 2.10) shows the app unusable at a size it follows, and the fix is not small. Reverting is one PR; nothing is stored.

## Acceptance criteria

1. At the usual text size body text is 17px and the tiles are three across at 360px wide (`e2e/flows.cjs`).
2. With the root font size raised, body text grows in step, to at most 25.5px (`e2e/flows.cjs`).
3. At the largest followed size at 360px wide, every tile name stays inside its tile and the page does not scroll sideways (`e2e/flows.cjs`).
4. Every screen of both builds was opened at the usual size, one and a quarter times and one and a half times, at 390 and 360px wide, on demo data: no page scrolls sideways.
5. axe WCAG 2.2 AA, 0 violations, 4 display modes (`docs/audits/axe-run.cjs`).
