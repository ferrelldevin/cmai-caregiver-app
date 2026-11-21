# Pairing the app's logs with a wristband or camera

Build plan step 3.14. One page for whoever runs a recording session. Lab build only. Made-up data until Dr. Gupta says in writing where real data may live.

## Why

The app's logs can label sensor data: each log says which behavior, when, and who saw it. That only works if the phone's clock and the sensor's clock can be lined up, and if the labels say when nobody was looking. This use of the logs is an inference from the research scan (section 3, item 1), not a method the lab has tested.

Two studies, as the build plan cites them and not re-read for this page: Iaboni 2022 built per-person models and had to time chart events against video ([DOI 10.1002/dad2.12305](https://doi.org/10.1002/dad2.12305)); Bankole 2020 used caregiver-marked times ([DOI 10.1177/1533317520906686](https://doi.org/10.1177/1533317520906686)).

## At the start and end of every session

1. On the phone: Settings, Lab and research, and scroll to "Clock check".
2. Hold the phone so the camera sees the screen, or hold it beside the wristband's own display, and record for 5 seconds. For a wristband with no display, tap the band three times in view of the camera while the phone is in shot.
3. Do the same again at the end of the session.

The screen shows the phone's time to a tenth of a second, the UTC offset, the time zone and the device ID. It stores nothing (F-40). Two readings, start and end, let you measure both the gap between the clocks and how much one drifted.

## During the session

- Whoever is with the resident taps **I'm here** on Today when they start watching and **I've left** when they stop. A log starts a watch by itself if none is open (F-38, D-25).
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

1. From the start recording, read the phone's time off the screen in one video frame, and the sensor's time for the same frame. The difference is the offset at the start.
2. Do the same for the end recording. If the two offsets differ, the clocks drifted; spread the difference evenly across the session.
3. Shift the sensor's times by the offset, not the app's. The app's times are the ones in the export and the change history.

## What the labels cannot say

- **A behavior nobody logged looks like calm.** Take "calm" only from `watched` rows. An `unobserved` row means nobody was watching: unknown, not calm.
- **A watched row is not proof of calm either.** It means someone was there and logged nothing. A watch that ended by timeout (`end_source`) may cover time when the person had already left.
- **A log is a moment, not a span,** except the three behaviors with an end time. A `behavior` row with an empty `end` marks when it was seen to start, nothing more.
- **Late logs carry rough times.** Rows with `time_approximate` true were placed by memory. The gap between `logged_at` and `occurred_at` shows how late. Leave them out of anything that needs timing to the second.
- **One tap is one event, not its strength.** The app records how often, never how severe.
- **The clock check reads to a tenth of a second,** and a video frame is about a thirtieth. Claims finer than a few tenths of a second are not supported.
