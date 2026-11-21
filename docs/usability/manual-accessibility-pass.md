# Manual accessibility pass (V-13)

Build plan step 2.10. About 15 minutes on an iPhone. The automated axe audit runs on every pull request and passes; it cannot hear VoiceOver or see iOS text sizes. This pass covers what it cannot.

Standard: WCAG 2.2 AA. Made-up data only: use the demo patients.

## Before you start

1. Open the app from the Home Screen icon.
2. Settings, Demo data, Load demo data.
3. iOS Settings, Accessibility, VoiceOver: on. (Triple-click the side button if the shortcut is set.)

VoiceOver basics: swipe right for the next thing, double-tap to press it.

## Part 1. VoiceOver

Mark each line Pass or Fail. For a fail, write what VoiceOver said, word for word.

| #   | Do                                                             | It should say or do                                                                                                                                                       | WCAG         | Pass / Fail |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| 1   | Open the app. Swipe right from the top                         | The patient button first ("P-DEMO-A, demo, Period ..., Choose patient"), then "Log a behavior, P-DEMO-A", heading                                                         | 1.3.1, 2.4.3 |             |
| 2   | Swipe to a behavior tile                                       | The behavior's short name, "button". One swipe per tile, nothing read twice                                                                                               | 4.1.2        |             |
| 3   | Use the rotor (two fingers, twist) set to Headings, swipe down | The four group names are headings, in the order on screen                                                                                                                 | 1.3.1, 2.4.6 |             |
| 4   | Double-tap a tile                                              | "Logged:", the behavior, the patient and the time are spoken without moving your finger                                                                                   | 4.1.3        |             |
| 5   | Swipe to Undo and double-tap, within the time it shows         | The confirmation does not vanish while VoiceOver is on it. After Undo the log is gone from Today                                                                          | 2.2.1        |             |
| 6   | Log again. Swipe to the When? chips and double-tap "5 min ago" | A group named "When did it happen?" with three buttons; "Just now" says "selected". After the double-tap, "5 min ago" says "selected" and the confirmation is still there | 4.1.2, 2.2.1 |             |
| 7   | Double-tap the patient button, pick P-DEMO-B                   | A sheet opens and VoiceOver starts inside it. After the pick: "Now on P-DEMO-B"                                                                                           | 2.4.3, 4.1.3 |             |
| 8   | Open the patient sheet again, then two-finger scrub (a Z)      | The sheet closes and VoiceOver returns to the patient button                                                                                                              | 2.1.2        |             |
| 9   | Swipe to the tab bar                                           | Four buttons: Log, Today, Two weeks, Settings. The one you are on says "selected" or "current page"                                                                       | 4.1.2        |             |
| 10  | Open Two weeks. Swipe to the first behavior in the table       | The behavior, its rating as a number, what the number means in words, and its change, in that order                                                                       | 1.3.1, 1.1.1 |             |
| 11  | Keep swiping through "Logs per day" and "Time of day"          | Each day or time block is spoken with its count. Nothing is announced only as "image" or by a color                                                                       | 1.1.1, 1.4.1 |             |
| 12  | Open Settings, Backup and export, Download backup              | The button is named. After it, something says the backup was saved                                                                                                        | 4.1.2, 4.1.3 |             |
| 13  | On any screen, swipe from top to bottom                        | The order matches the screen top to bottom. Nothing behind an open sheet is reachable                                                                                     | 2.4.3        |             |

## Part 2. Largest text, by sight

VoiceOver off. iOS Settings, Display and Brightness, Text Size: largest. Then Accessibility, Display and Text Size, Larger Text: on, slider to the end. Reopen the app.

| #   | Look at                                   | It should                                                                                                | WCAG   | Pass / Fail |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 14  | Log                                       | Every tile's name is whole, not cut with "...". Tiles do not overlap                                     | 1.4.4  |             |
| 15  | Log one behavior                          | The confirmation shows the behavior's whole name, Edit, Undo and the three When? chips are all on screen | 1.4.4  |             |
| 16  | The tab bar                               | All four names readable. It does not cover the last tile when scrolled to the end                        | 1.4.10 |             |
| 17  | Two weeks, the behaviors table            | No sideways scrolling to read a row. Numbers stay beside their behavior                                  | 1.4.10 |             |
| 18  | Settings, Backup and export               | Buttons wrap instead of running off the side                                                             | 1.4.10 |             |
| 19  | Any sheet (patient switcher, log details) | The sheet scrolls. Its bottom button can be reached                                                      | 1.4.4  |             |
| 20  | Hold the phone sideways on Log            | The screen turns and still works                                                                         | 1.3.4  |             |

## Afterwards

1. Turn VoiceOver and Larger Text back off.
2. Settings, Demo data: remove the demo patients if you do not want them.
3. Give Claude the fail lines. Each one becomes its own fix (lane A) and the date and result go in register row V-13.
