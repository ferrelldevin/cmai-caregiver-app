# Pairing the app's logs with a wristband or camera

Build plan step 3.14. One page for whoever runs a recording session. Lab build only. Made-up data until Dr. Gupta says in writing where real data may live. That approval has to cover every file a session makes, not only the app's: the video, the wristband's export, the phone's exports and backups, and how each is moved. Never put a name or anything that identifies a person in a file name.

## Why

The app's logs can label sensor data: each log says which behavior, when, and who saw it. That only works if the phone's clock and the sensor's clock can be lined up, and if the labels say when nobody was looking. This use of the logs is an inference from the research scan (section 3, item 1), not a method the lab has tested.

Two studies, as the build plan cites them and not re-read for this page: Iaboni 2022 built per-person models and had to time chart events against video ([DOI 10.1002/dad2.12305](https://doi.org/10.1002/dad2.12305)); Bankole 2020 used caregiver-marked times ([DOI 10.1177/1533317520906686](https://doi.org/10.1177/1533317520906686)).

## At the start and end of every session

1. On the phone: Settings, Lab and research, and scroll to "Clock check".
2. Make one recording, about 5 seconds, in which the sensor's own clock can be read against the phone's screen:
   - **Camera:** film the phone's screen with the camera you are pairing. The camera's own time for that frame comes from the recording's timestamps, read in the software you will analyse the video in.
   - **Wristband with a display:** film the band's display and the phone's screen in the same shot, with any camera.
   - **Wristband with no display:** it needs a mark you can find in its own data. Tap the band firmly three times, about a second apart, while filming the band and the phone's screen in the same shot. The taps show as three spikes in the band's motion data, at the band's time; the video shows the phone's time at each tap. If the band records no motion, this guide cannot line it up: stop and ask.
3. Write down each device's time zone and UTC offset.
4. Do all of it again at the end of the session.

The screen shows the phone's time to a tenth of a second, the UTC offset, the time zone and the device ID. It stores nothing (F-40). Two readings, start and end, let you measure both the gap between the clocks and how much one drifted.

## During the session

- Whoever is with the resident taps **I'm here** on Today when they start watching and **I've left** when they stop. A log starts a watch by itself if none is open (F-38, D-25).
- Do not change the phone's time zone or set its clock by hand during a session.
- Log each behavior with one tap. For a log made late, set when it happened; the export then marks its time as approximate.
- For pacing, mannerisms and restlessness, tap **It stopped** when the stretch ends (F-39).

## What comes out

Lab build, export format 2 (D-23). The labels and watches are under Settings, Lab and research, "Lab files"; the logs are under Settings, Backup and export. The app says it on the page: these CSVs are not protected, so make them only on a lab machine. Columns are defined in `docs/data-dictionary.md`.

| File        | Use it for                                                                                                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Labels CSV  | The label track. One row per interval for one resident, in time order. `kind` is `behavior`, `watched` or `unobserved`. `start` and `end` are UTC; `start_local` and `utc_offset_min` give the phone's local time |
| Watches CSV | When someone was watching, who, and how each watch started and ended (`start_source`, `end_source`)                                                                                                               |
| Logs CSV    | Every log with `occurred_at`, `logged_at`, `time_approximate`, `ended_at`, `device_id` and `caregiver`                                                                                                            |

## Lining up the clocks

Work in UTC throughout. The app's `start`, `end`, `occurred_at` and `logged_at` are already UTC.

1. From the start recording, pick one frame. Read the phone's time off its screen and the sensor's time for that same moment (the band's display, the tap spike, or the camera's timestamp for the frame). Convert both to UTC. **Offset = phone time minus sensor time.**
2. Do the same for the end recording.
3. Check the two offsets before using them. Over a session they should differ by well under a second or two. A difference near a whole hour, or any jump, is not drift: a time zone, a daylight saving change or a clock that corrected itself got in. Find out which before going on; do not spread a jump across the session.
4. If the two offsets differ a little, the clocks drifted. For a sensor reading taken at time t, use: offset at start + (offset at end minus offset at start) x (t minus start) / (end minus start).
5. **Add the offset to the sensor's times.** Leave the app's times alone: they are the ones in the export and the change history.
6. If one of the two recordings is missing or cannot be read, use the other offset for the whole session and say so with the data. If both are missing, the session cannot be lined up to better than the two clocks' own settings.

## Before using a session's labels

Open the Watches CSV and read `start_source` and `end_source` for that session. A watch that started from a log, not from "I'm here", began when the first behavior was logged, not when the person arrived. A watch that ended by `timeout` ended at the last tap, and the person may have left earlier or stayed later. Leave out the time around either, or mark it uncertain. There is no lab rule for this yet; say what you did.

## What the labels cannot say

- **A behavior nobody logged looks like calm.** Take "calm" only from `watched` rows, and only as "someone was there and logged nothing in the gaps between `behavior` rows". It is not proof: the person watching can miss a behavior or not log it.
- **`unobserved` means no watch was recorded,** not that nobody was there. Unknown, not calm.
- **`behavior` rows sit inside `watched` rows.** A watched stretch is not one calm block; the behaviors logged during it are separate rows with their own times.
- **A log is a moment, not a span,** except the three behaviors with an end time. A `behavior` row with an empty `end` marks when it was seen to start. It does not say when it ended, so the time just after it is not known to be calm.
- **Late logs carry rough times.** Rows with `time_approximate` true were placed by memory. The gap between `logged_at` and `occurred_at` in the Logs CSV shows how late. Leave them out of anything that needs timing to the second.
- **One tap is one event, not its strength.** The app records how often, never how severe.
- **The clock check reads to a tenth of a second** and a video frame is about a thirtieth, but a band's display may update only once a second and a camera's timestamps may be coarser. The lining-up is only as good as the coarsest of these. Treat one second as the limit unless you have measured better.
