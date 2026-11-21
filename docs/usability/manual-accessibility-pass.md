# Manual accessibility pass (V-13)

Build plan step 2.10. About 15 minutes on an iPhone. The automated axe audit runs on every pull request and passes; it cannot hear VoiceOver or see iOS text sizes. This pass covers what it cannot.

The WCAG 2.2 numbers say what each line is about. This pass plus axe is not a full WCAG audit and does not prove conformance.

Made-up data only: use the demo patients.

## Before you start

1. Write down the iPhone model and iOS version, and your current text size settings so you can put them back.
2. Open the app from the Home Screen icon.
3. Settings, Demo data, Load demo data.
4. iOS Settings, Accessibility, VoiceOver: on. (Triple-click the side button if the shortcut is set.)

VoiceOver basics: tap near the top with four fingers to jump to the first thing, swipe right with one finger for the next thing, double-tap to press it.

## Part 1. VoiceOver

Mark each line Pass or Fail. For a fail, write what you did, what should have happened and what did. Where VoiceOver spoke, write what it said, word for word.

| #   | Do                                                                                       | It should say or do                                                                                                                                                                                                             | WCAG         | Pass / Fail |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| 1   | Open the app. Four-finger tap near the top, then swipe right                             | The patient button first ("P-DEMO-A, demo, Period ..., Choose patient"), then "Log a behavior, P-DEMO-A", heading                                                                                                               | 1.3.1, 2.4.3 |             |
| 2   | Swipe to a behavior tile                                                                 | The behavior's short name, "button". Each tile is one stop and its name is not read twice (VoiceOver's own hints do not count)                                                                                                  | 4.1.2        |             |
| 3   | Four-finger tap near the top. Set the rotor (two fingers, twist) to Headings, swipe down | The four group names are headings, in the order on screen, and each name says what is in the group                                                                                                                              | 1.3.1, 2.4.6 |             |
| 4   | Double-tap a tile                                                                        | "Logged:", the behavior, the patient and the time are spoken on their own, without moving your finger                                                                                                                           | 4.1.3        |             |
| 5   | Straight after, swipe to Undo and double-tap                                             | You reach Undo before the confirmation goes, and it does not go while VoiceOver is on it. Fail if it went first. After Undo, Today shows no log for that tap                                                                    | 2.2.1        |             |
| 6   | Log again. Swipe to the three chips after "When?" and double-tap "5 min ago"             | "Just now" is read as the chosen one (VoiceOver may say "selected" or "pressed"). After the double-tap, "5 min ago" is the chosen one and "Just now" is not. Today shows one log, not two, five minutes earlier, marked "about" | 4.1.2        |             |
| 7   | Double-tap the patient button, pick P-DEMO-B                                             | A sheet opens and VoiceOver starts inside it. After the pick, "Now on P-DEMO-B" is spoken on its own. A tile logged now shows on Today for P-DEMO-B only                                                                        | 2.4.3, 4.1.3 |             |
| 8   | Open the patient sheet again. Close it with its Close button or a two-finger scrub (a Z) | The sheet closes and VoiceOver returns to the patient button                                                                                                                                                                    | 2.4.3        |             |
| 9   | Swipe to the tab bar                                                                     | Log, Today, Two weeks, Settings. The one you are on is read as the current one ("selected" or "current page")                                                                                                                   | 4.1.2        |             |
| 10  | Open Two weeks. Swipe to the first behavior in the table                                 | You can tell which behavior each number belongs to, what the rating number means in words, and its change                                                                                                                       | 1.3.1        |             |
| 11  | Keep swiping through "Logs per day" and "Time of day"                                    | Each day or time block is spoken with its count. Nothing is announced only as "image"                                                                                                                                           | 1.1.1        |             |
| 12  | Open Settings, Backup and export, Download backup                                        | The button is named. Afterwards the app's "Last export" line shows today, or iOS shows its download prompt. Write down which                                                                                                    | 4.1.2, 4.1.3 |             |
| 13  | With the patient sheet open, swipe right through everything, past the last thing in it   | VoiceOver stays inside the sheet. Nothing behind it is reachable. The order makes sense                                                                                                                                         | 2.4.3        |             |

## Part 2. Bigger text, by sight

VoiceOver off.

**Built, not yet seen on a phone (register F-69, design note 033):** the app now follows the iPhone's text size up to one and a half times the usual size. Line 14 confirms that on a real phone. If the text does not grow, write that down and do lines 15 to 20 by zooming with two fingers.

iOS Settings, Accessibility, Display & Text Size, Larger Text: turn on Larger Accessibility Sizes and move the slider to the end. Reopen the app.

| #   | Look at                                           | It should                                                                                                  | WCAG   | Pass / Fail |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 14  | Log, before and after turning Larger Text on      | The text gets bigger, up to about one and a half times (F-69). Write down what you see                     | 1.4.4  |             |
| 15  | Log. Spread two fingers to zoom to about double   | The page zooms. Every tile's name is whole, not cut with "...", and every tile can be reached by scrolling | 1.4.4  |             |
| 16  | Log one behavior, still zoomed                    | The confirmation's behavior name, Edit, Undo and the three When? chips can all be reached                  | 1.4.4  |             |
| 17  | Not zoomed: the tab bar                           | All four names readable. It does not cover the last tile when scrolled to the end                          | 1.4.10 |             |
| 18  | Not zoomed: Two weeks, the behaviors table        | A row can be read without sideways scrolling. Numbers stay beside their behavior                           | 1.4.10 |             |
| 19  | Any sheet (patient switcher, log details), zoomed | Everything in the sheet, down to its bottom button, can be reached                                         | 1.4.4  |             |
| 20  | Hold the phone sideways on Log                    | The screen turns. A tile still logs and the tab bar still switches screens                                 | 1.3.4  |             |

## Afterwards

1. Turn VoiceOver off and put your text size settings back as they were.
2. Settings, Demo data: remove the demo patients if you do not want them.
3. Give Claude the fail lines. Each one becomes its own fix (lane A) and the date and result go in register row V-13.
