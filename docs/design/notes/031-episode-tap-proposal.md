# 031. One-tap episode start, episode grouping and daily check: proposal check

2026-11-20 · Register: F-66 (new) · Status: proposed, Dr. Gupta sign-off pending · Not built · No code, no switch, no database version, no export change · Docs only

## What this is

A register proposal Devin brought from the Gupta Lab Research project on 2026-11-20 for the lab home sensor study. This note files it and checks it against the code, the scoring spec, the export draft and the simplicity rule (F-65, note 030) before anyone builds it. Nothing here is decided.

## The proposal, in short

1. "Episode now" button on the home screen: one tap stores an episode with the device-clock time of the tap, no behavior chosen.
2. Details later: behavior numbers (several), "Episode over" or an end time, an optional suspected cause from a fixed list (pain, toilet, woke upset, noise, other), no free text. Each behavior record carries the episode's ID.
3. An episode entered after the fact is marked as entered and approximate.
4. A once-a-day "Any episodes since yesterday?" yes or no, stored as its own dated record.
5. Export v1.1.0 adds `episodes`, `episode_id` on records and `daily_checks`.

No change to ratings, scoring rules or item wording. Sync server out of scope.

## Checked against the code and plan

| Claim or part                               | What the repo says                                                                                                                                                                                                                                                                                                                                                         | Result                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `time_approximate` is planned in v1.1.0, S6 | Yes, in the **draft** only: note 021 (titled S6), F-60, `docs/contracts/cmai-export/cmai-export-1.1.0-draft.schema.json`. Draft, not agreed, not built in the research JSON export; the lab reader does not read it. The CSV exports already carry `time_approximate` (`src/data/exporter.ts`, `docs/data-dictionary.md`).                                                 | Confirmed, with that caveat       |
| What `time_approximate` means               | It exports the stored `approx` flag, which the caregiver sets with "Time is approximate" on the log sheet (`src/ui/LogSheet.tsx`, `src/data/db.ts`). The proposal sets it automatically for any entered episode. That changes the meaning from "the caregiver said it is a guess" to "it was not tapped".                                                                  | Conflict: one field, two meanings |
| A time typed in later is a recollection     | Every log already keeps `at` (when it happened) and `loggedAt` (when it was entered), and a time edit leaves a `wrong_time` history entry (F-59). A tile tap already stores the device-clock time to the millisecond. Tapped versus entered can be read from these approximately without a new field: a log entered a few seconds after the event looks the same as a tap. | Mostly covered already            |
| "Episode over"                              | F-39 "It stopped" stores `endedAt`, lab build only, for the three continuous behaviors. The proposal ends any episode.                                                                                                                                                                                                                                                     | Overlaps F-39                     |
| Suspected cause list                        | The app has "what happened just before" chips (`before`), plus F-41's three more. A second fixed list asks the same question twice.                                                                                                                                                                                                                                        | Overlaps; reuse `before`          |
| A quiet day versus a day nobody logged      | F-38 watching hours and D-25 already target this, and the v1.1.0 draft carries them as `observation_windows`. The daily check is a second answer to the same gap.                                                                                                                                                                                                          | Overlaps F-38, D-25, F-60         |
| Episode grouping                            | Nothing groups logs today. This is the one new thing. Scoring spec section 4: one tap is one occurrence of one behavior. Grouped behaviors still count one each; an episode with no behavior must count zero and must never reach `src/scoring/`.                                                                                                                          | New; must stay out of scoring     |
| Storage                                     | Episodes and daily checks are new tables, so a database version 5. A Dexie version cannot be taken back on phones that have opened it.                                                                                                                                                                                                                                     | Irreversible step                 |
| Export v1.1.0                               | The draft has five additions; this adds three more and `time_source`. The draft must be amended and the Python reader updated first (v1.0.0 closes every object). The lab database schema (`docs/data/lab-schema.sql`) would need episode and daily check tables too.                                                                                                      | Needs a draft revision            |
| Item wording                                | Behavior numbers only, no free text.                                                                                                                                                                                                                                                                                                                                       | Fine                              |
| Sync server "question 31"                   | No question 31 was found in `docs/lab/review-packet.md` or the Library copy; the sync server is on open PR 109.                                                                                                                                                                                                                                                            | Not verified                      |

## Against the simplicity rule (F-65, note 030)

The rule: nothing is asked before the tap; everything else comes after the tap and is optional, or lives in Settings.

- **"Episode now" on the home screen** puts a second large target above or beside the tiles. Simplicity step 2 (merged in PR 117) made Log start with tiles, and step 3 puts all 29 on one page. A caregiver then chooses between two ways to log before tapping, and an episode tap with no behavior needs a second visit to be useful. That is two steps where the tile is one.
- **The daily check** is a question the app asks on its own, every day, whether or not anything happened. That is new caregiver burden, and if it shows on opening the app it breaks "nothing asked before the tap". Step 6 removes the "I'm here" strip for the same reason.
- **Details later** is consistent with the rule only if every detail stays optional and the app never nags for it.

## What would fit (Claude's reading, for discussion, not decided)

- No new button: the first tile tap starts the episode, and its time is already the tap time. Further tiles within a set gap join the same episode. Grouping is then automatic and adds no tap.
- Tapped versus entered comes from `at` and `loggedAt`, exported as `time_source`; `time_approximate` keeps its meaning (the caregiver's own mark).
- End time and cause reuse F-39 and the `before` chips.
- Quiet days come from `observation_windows` (F-38, D-25). If the study still needs an explicit "no", it lives in the lab build only, in Settings or Today, never as a prompt on opening.
- Everything behind one lab-build switch, so the caregiver build is unchanged.

## Acceptance criteria for this filing

1. F-66 is in `docs/review-register.md` with status "Proposed, Dr. Gupta sign-off pending" and links here.
2. No source, test, schema or sample file changes; no CMAI item wording added.
3. CI passes on the pull request.

The proposal's own acceptance criteria (tap written within 1 second, details keep the tap time, edit re-exports as revision + 1, a "no" day exports a daily check and no episode, the v1.1.0 file passes the lab reader with no duplicates) apply to the build, if one is approved.

## Independent review

Codex was asked first (Devin-Laptop, by Remote Control); the request was not allowed within 30 minutes, so per the review gate a different Claude model reviewed it: Claude Sonnet 5.5, a separate session in the cloud container, reading the repo files. It confirmed the code claims and found five things, all checked against the code: the CSV exports already carry `time_approximate` (only the research JSON lacks it), tapped versus entered is only approximate from `at` and `loggedAt`, the lab database schema would change too, and two references to register rows that were then only on open PRs (fixed; F-65 has since merged). Nothing left the cloud session.

## Open for Dr. Gupta and Devin

- Does the home study need an explicit daily "no", or do watched stretches (F-38) answer it?
- Should an episode be its own record, or a gap rule over taps that already exist?
- May the lab build take a database version 5 for this, given it cannot be undone?

## Sources

- Proposal text: Devin, 2026-11-20, from the Gupta Lab Research project.
- Scoring spec section 4, `docs/scoring-spec.md`.
- Notes 015 (watching hours), 019 (change reasons), 021 (v1.1.0 draft), 030 (open, tap, done; F-65).
