# Changelog

What changed in each release of CMAI Tracker. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

A scoring change is always called out here with its new `RULE_VERSION`. Day-by-day decisions, and who approved them, are in the decision log in [docs/review-register.md](docs/review-register.md).

## [Unreleased]

### Changed

- "When did it happen" chips on the confirmation (F-51, design note 032). After a log, "When?" offers Just now, 5 min ago and 15 min ago; a chip moves the log back from when it was logged and marks the time approximate, as the log details sheet does, and the change history keeps the old time. Three chips, not four: Earlier… is left out because Edit in the same bar opens the same sheet. A chip before the resident's first day is refused with the first-day message. Both builds; in the lab build the reason is filled in as "Wrong time" and nothing is asked.
- The app opens on Log (F-65, design note 030 step 8). Brought back after 5 minutes or more out of sight, it shows Log wherever it was left; sooner, it stays. A rating, an open sheet or a field being typed in is never taken away. Both builds. Last step of the simplicity plan.
- Lab build: one "Lab and research" row in Settings (F-65, design note 030 step 7). It holds the research export, the lab spreadsheets, each caregiver's role, the clock check and demo data. Backup and export and Caregivers carry no lab tools; the Clock check and Demo data rows are gone and their old addresses open the new page. The caregiver build is unchanged.
- Lab build: the watching strip leaves Log (F-65, design note 030 step 6). "I'm here" and "I've left" now sit on Today, above the band they feed; a log still starts a watch by itself. Nothing about watching stands before the tiles. The caregiver build is unchanged.
- Lab build: no PIN (F-65, F-67, design note 030 step 5). Who is logging is remembered on the phone; adding a caregiver asks for initials only; switching is one tap; no sign-in screen. The PIN code is kept, switched off, and its check still runs against its own build (`VITE_STUDY_PIN=on`). A log's "by" code is no longer backed by a secret. The caregiver build is unchanged.
- Lab build: changing a log no longer asks why (F-65, design note 030 step 4). Save change fills in the reason from what was changed (a time is "Wrong time", what happened before is "Other") and closes the sheet: 3 taps to move a log 5 minutes, was 6. A delete still asks. The caregiver build is unchanged.
- All 29 behaviors on one page (F-65, design note 030 step 3). Log shows every behavior under its four group headings. The group names are a bar that stays in reach while the page scrolls and jumps to a group; no behavior sits behind a tab. Log also opens at its first tile when the first patient is added on a small phone.
- Log starts with tiles (F-65, design note 030 step 2). The title, the how-to lines and the backup line no longer sit above the behaviors. Today's count is on the Today tab, a due backup is a dot on the Settings tab and "Backup due." on the Backup row in Settings, and the how-to line shows until a resident's first log and stays in the "what counts" sheet.

### Fixed

- Three places still used screen names the app no longer has: the welcome card said "Score", Today's quiet-day line said "on Score", and the back button on every Settings page said "Data". They now say "Two weeks" and "Settings", as the tab bar does (F-49).
- Notes from the lab to itself ("Open: R4", "Open: D-17", "Open: D-18") no longer show on a caregiver's Today and Two weeks screens; they show in the lab build only, where a register ID links to the register (F-65, design note 030, build plan 4.8). First step of the simplicity plan.

### Added

- Register row F-70, a question with nothing built: whether 88% within 1 point is the right pass mark for agreement. An outside review reports the manual gives three figures (92%, 92%, 88%); not yet confirmed.
- Register row F-69, a finding with nothing built: the app does not follow the iPhone's text size setting. Zooming with two fingers is not blocked; the checklist confirms it on a phone.
- A checklist for the manual accessibility pass on an iPhone: VoiceOver and the largest text size, 20 lines, about 15 minutes (V-13, build plan 2.10). No app change.
- The script for the internal pilot: seven days, one made-up resident, 72 made-up events from a fixed seed, with what to write down each evening and how each measure is read from the backup (V-16, build plan 3.6). No app change.
- Sensor pairing guide, one page: filming the clock check at the start and end of a session, which lab file holds what, how to line up two clocks, and what the labels cannot say (build plan 3.14). No app change.
- A draft of who did what and how AI was used, with CRediT role names and counts from the commit history, for Devin to correct (build plan 3.11). No app change.
- A draft study protocol and analysis plan: the question, the design, the statistics and the 88% pass mark fixed before any data, the leave-out rules, the known biases, and the blanks that are Dr. Gupta's (build plan 3.9). Not sent. No app change.
- Design note 031 (F-66): the one-tap episode, episode grouping and daily check proposal for the lab home study, checked against the code and the simplicity rule. Proposal only; nothing built.
- Correct a wrong behavior, lab build only (F-64, design note 025): "Change" beside the behavior on the log details sheet. The same log is corrected and its history keeps the first pick with the reason Wrong behavior; nothing is deleted, no second log is made, and it is counted once. No database version, no export format change, no scoring change.
- Each new log saves the phone's time-zone name, and each caregiver profile can carry a role (Caregiver, Staff, Researcher) in the lab build; the research export uses both (F-58). Older records keep the old defaults. No database version.
- Design note 022 (F-61): how real research exports could be locked with a lab-held passphrase. Design only; nothing built.
- Draft of research export contract v1.1.0 (F-60): v1.0.0 plus five optional fields, as a schema, an example and a test. Not built and not in use; waiting for Devin's go.
- A random test (1,000 runs, fixed seed) of edits, deletes and restores followed by exports: revision always equals the number of real changes, the same revision never carries different content, history matches, and every 25th run passes the lab's Python reader (G8). No app change.
- A test that checks the export's time-zone arithmetic against Python's zoneinfo in 21 zones around every 2026 clock change, half-hour and 45-minute zones included (G2). No app change.
- Change reasons, lab build only (F-59): every edit and delete asks why from a list of six; edits are held until Save change; history is never rewritten; the log details sheet shows every version. A revision counter on each log feeds the research export.
- "Export for research" refuses a resident who is not demo data until the `realExports` setting is turned on (needs Dr. Gupta in writing).
- "Export for research", lab build only (F-56, design note 018): one resident and date range to one JSON file in the research export contract v1.0.0. Read-only; shows how many records used each assumed default before saving. No storage or scoring change. Made-up sample files in `docs/contracts/cmai-export/samples/`.

- Safari (WebKit) browser checks: `npm run checks:webkit` runs the same checks in WebKit, and CI runs them as a job that does not block a merge for now. The screenshot check stays Chromium only.

### Added

- "It stopped", lab build only (F-39): after logging pacing, mannerisms or restlessness, one tap records when the stretch ended, from the confirmation or from Today; the log details sheet can correct it. An end before the start is refused. No scoring change.

- Watching hours, lab build only (F-38, D-25): "I'm here" / "I've left" on Log, a log starts a watch when none is open, a band on Today showing when someone was watching, and after 4 hours with no tap the app asks "Still with P-02?". No scoring change.

- The backup message no longer suggests email or a cloud drive; it says to keep the file where the study team said (A-12).
- Passphrase-protected backup, lab build only (F-10): Export asks for a passphrase of 12 or more characters and encrypts the backup, with the CSVs inside. Restore opens it, offline too.

- CSV cells that start with =, +, -, @ get a leading ' so a spreadsheet cannot run them as formulas (F-34).
- Export format 2, lab build only (D-23): more columns at the end of each CSV (unique ID, phone, caregiver, local time with offset), and three new files: labels, caregiver ratings and watches.

- Three more "just before" choices, lab build only (F-41): Too hot or too cold, Slept badly last night, Seemed unwell.

- Clock check, lab view only (F-40): Settings > Clock check shows the phone's time to the tenth of a second, the UTC offset and the device ID, to film beside a wristband or camera. Stores nothing.

- Blind two-week caregiver rating, lab build only (F-47): after each period, each caregiver who logged gives their own CMAI for those 14 days, without seeing anything from the logs. Locked once submitted; never changes the app's rating. The lab view shows it beside the app's.

- On-phone PIN, lab build only (F-46, R1): each caregiver signs in with a 4-digit PIN once per shift; wrong tries wait, then lock; a setup PIN gives a new PIN. It says who is logging; it does not protect the data. Never in a backup.

- Caregiver profiles, lab build only (F-45, R2): caregivers are a code and initials; a chip shows who is logging and switches in one tap; new records say who made them; My residents come first in the switcher. Who is logging is kept in the app's database, not in localStorage. `npm run checks` also tests the lab build.

- Database version 4 (F-44): every log gets an ID that stays unique across phones, and new logs record the phone and its UTC offset. Backups are format 2 and never include PIN fields; format 1 backups still restore. In the lab build, deleting a patient who has logs archives them with a reason instead of erasing them (D-20). A phone that opens this version cannot go back to an older one without export, clear and restore.

### Fixed

- Settings no longer scrolls 4 px sideways on a 320 px phone. Lab build: the fields on "Export for research" line up on both edges, and on a 320 px phone a caregiver's code stays on one line (design note 029).
- The short message after a switch ("Now on P-02", "AB is logging") now shows just above the tab bar instead of on top of the page title or the Back button. Lab build: three-letter initials fit their round badge, and "Manage caregivers" and "Sign out" no longer touch (design note 028).
- Lab build: removing a caregiver now asks first, in the same confirm sheet a patient gets. Before, one tap on "Remove" removed or archived them (F-45, design note 026).
- Lab build: a caregiver's role is now three choices on their own line (Caregiver, Staff, Researcher) instead of a dropdown that covered the caregiver's code and pushed "Remove" off the card at phone width (F-58, design note 027).
- Restore leaves out a review or "Nothing to log today" check-in whose key names a different patient, window or day than its own fields. Before, such an entry was stored under the key and could stand in for another patient's review.

## [0.3.0] - 2026-11-12

### Changed

- Repository renamed from `cmai-tracker` to `cmai-caregiver-app`. The live app moves to https://ferrelldevin.github.io/cmai-caregiver-app/ (GitHub Pages does not redirect the old address). The app name stays CMAI Tracker, and the on-phone database keeps its name, so data on Android and desktop carries over; an iPhone Home Screen copy needs Export, then Restore at the new address.
- Log screen from the round 3 mockup (F-26): behavior tiles 3 across with icons and today's count, group tabs, and a "Most logged for this resident" row.
- What counts as each behavior moved off the buttons into one sheet, opened under the tiles or by holding a tile (F-37).
- Score folded into Two weeks (F-29): the bar is now Log, Today, Two weeks, Settings. Everything Score showed is on Two weeks, with the total as a secondary chip beside the title. Old Score addresses still open the right period. The Score screen and the Recharts library are removed.
- New Two weeks tab (F-28): one 14-day period with the answer first, each behavior against last period, logs per day, time of day, behavior groups (Open: D-17) and patterns to look into (Open: D-18), drawn without a chart library.
- New Today tab (F-27): today's logs by hour and by behavior, where a log is fixed or removed. Recent logs and "Nothing to log today" moved there from Log.

### Added

- Issue forms for bug reports and change requests, each warning against real participant data.
- Every file is now formatted with Prettier, and `npm run lint` fails on unformatted files (so CI does too). No logic changed.

- Study settings (`src/study/settings.ts`, F-48): one switch per feature built before Dr. Gupta's sign-off. The normal build has them all off; `VITE_STUDY_MODE=lab` builds the lab version with them on. Settings > About shows which one is running.
- Lab readiness drafts for Dr. Gupta (build plan Stage 3): `docs/security/threat-model.md`, `docs/data-dictionary.md`, `docs/lab/data-management-plan.md`, `docs/lab/review-packet.md`, `CONTRIBUTING.md` and `docs/process/runbook.md`. Docs only; no app, scoring or export change.
- Lab database frame: `docs/data/lab-schema.sql` (runs on SQLite and PostgreSQL), `docs/data/lab-database.md`, and `scripts/backup-to-sql.mjs`, which loads a backup file and its scores CSV into it. Tested in `tests/backupToSql.test.ts`. Reads files only; the app is unchanged.
- The app no longer saves a patient code in `localStorage`. It opens on the resident with the newest log (the first resident when there are no logs), and removes the old saved code on first open.
- `docs/process/release.md`: how to cut a release and how to undo a bad deploy. The deploy job now checks that the live page shows the commit it just deployed.
- Property tests for the scoring rule (fast-check): order of logs, adding or removing a log, the count bands, the 60-minute cluster edge, the 7-day threshold, and behaviors not affecting each other, across a clock change. No change to the rule.
- Size check in CI (`npm run check:size`): fails if the first script grows past 415 KB or any other script past 600 KB.
- Copy diagnostics (About page): the last 30 errors are kept on the phone, with no patient codes or log contents, so a caregiver can copy them and hand them to the lab. Nothing is sent anywhere.
- Editor and Git settings shared through the repo: `.editorconfig`, `.gitattributes` (LF line endings on every machine), recommended VS Code extensions and settings.
- Node 22 pinned in `.nvmrc` and `package.json` `engines`.
- `npm run lint` (ESLint with TypeScript and React hooks rules) and `npm run typecheck`.
- Pre-commit hook (Lefthook): formats and lints staged files, and scans them for secrets when gitleaks is installed.
- `SECURITY.md`, `CITATION.cff` and this changelog.
- CI runs every browser check and the axe audit (4 display modes) on each pull request, plus lint, type check, coverage floors on `src/scoring/` and `src/data/`, and `npm audit` for the app's dependencies. Deploy waits for all of them.
- Content-Security-Policy meta tag in the built app: scripts only from the app's own files plus the inline theme script, allowed by a hash worked out at build time.
- Dependabot: one grouped update PR a month for npm and for GitHub Actions.
- Playwright 1.63.0 and axe-core 4.14.0 pinned as dev dependencies, so the browser checks run the same versions everywhere.
- `npm run check:docs`, run in CI: every rule in the scoring spec names the check that tests it, and the run fails if that check is renamed or removed; relative links, `file:line` references and register IDs must all resolve.
- Screenshot comparison (`e2e/screenshots.cjs`): Log, Scores, Data and Display at phone size, light and dark, compared with saved baselines; differences fail the check and save a diff image.
- Database upgrade test from version 2, and a test that fails when a new schema version has no upgrade test.
- Test that a phone restored from a backup shows the same ratings as the phone that made it.
- Backups name the app version and build commit next to the rule version; the "How ratings are worked out" page shows the build too.
- A version bump in `package.json` merged to main is tagged `v<version>` automatically.
- `CODEOWNERS` requests Devin's review on the scoring rule, its test cases, the spec, the register and CI.

### Changed

- CI: the browser job runs in Playwright's own container image (`mcr.microsoft.com/playwright`, same version as `package.json`), so Chromium and its libraries and fonts come with the image and nothing is installed from apt. An Ubuntu mirror outage no longer fails the job before any check runs. No check changes.
- Dependabot: minor and patch npm updates stay in one monthly pull request; a major version arrives alone, so one breaking upgrade no longer fails the whole batch (B-02). Recharts major upgrades are ignored, because step 4.4 removes it, and TypeScript majors are ignored until typescript-eslint supports them.
- Change process and pull request template: screenshots go in the pull request description, not in the repository (B-17).

### Security

- Vitest and its coverage tool upgraded to 5.1.0 and Vite to 6.4.6: the 3 critical and 1 high advisories in the test tools are gone. CI also fails on any critical advisory in any dependency.
- GitHub Actions in `pages.yml` are pinned to full commit SHAs, so a moved tag cannot change what runs. Runs on `main` are never cancelled, and every job stops after 15 minutes.
- Only the deploy job can publish the site. Before, the `pages: write` and `id-token: write` permissions applied to the build job too, including on pull requests.
- CSV export: a note that starts with `=`, `+`, `-`, `@`, a tab or a return gets a leading apostrophe, so Excel and Sheets show it as text instead of running it as a formula (F-34). A leading `'` in a note column means the note began with one of those characters.

### Changed

- A new CI job, Dependency review, fails a pull request that adds a dependency with a known high-severity advisory.
- React 19. The app looks and behaves the same.
- Build tools upgraded: Vite 8, the React plugin 6 and the PWA plugin 2. The app and its offline behavior are unchanged.
- CI fails when `docs/test-cases.json` is out of date with `npm run gen:cases`, and runs the agreement script's self-test.

### Fixed

- Restore from backup checks every entry. A file with a name where a patient code belongs, a half item number, or a log for an unknown patient no longer gets into storage (where it made Export throw). Only the named fields are copied. The message says how many entries were left out (F-31).

### Fixed

- Moving a log's time to before the patient's first day is refused with a message, and the old time stays. Before, the log silently dropped out of every period (F-32).
- Restore tells the caregiver how many restored logs are dated before the patient's first day on this phone and so are not counted. Which start date wins is still an open question (D-19).

### Fixed

- A save that fails (full phone, blocked storage) now says "That did not save. Check the phone has free space, then try again." and shows no "Logged" confirmation. Before, the tap looked as if it had worked or did nothing (F-33).
- A crash anywhere in the app shows "Something went wrong. Your saved logs are safe." with a Reload button, instead of a blank page. An unhandled save failure shows an alert.

### Fixed

- Welcome card no longer describes a "Review" step that does not exist (ratings are locked); it now tells caregivers to back up (A-06).
- "Today" stays right when the app is left open: the count and Today lists refresh at midnight and when the phone returns to the app. Before, a log made after midnight could be counted against yesterday until a reload (F-35).

### Added

- A quiet line on the Log screen, "Last backup: never. Back up" (or the days since), for a real patient with logs when the last export is over a week old. It opens the backup page. Hidden for demo patients. Reads the existing last-export value; stores nothing new (F-36).

### Added

- The app asks the browser to keep its data when the phone runs low on space, and the About page says whether it was kept (F-53).

### Added

- Welcome card and About page say "This app tells no one. A log is a record for the study. For an injury or an emergency, do what your workplace says." so a caregiver does not think logging a hit alerts anyone (P-12; wording is Dr. Gupta's to approve).

### Removed

- `itemById` in `src/scoring/items.ts`: nothing called it and it had no tests.

### Fixed

- The patient switcher lists the current patients the first time it opens after patients are added or deleted. Before, it could show the previous list, and search said "No patient code contains …" for a patient that existed (F-30).
- The scoring spec said the Total card lists the behaviors marked as changed; since F-20 each behavior row says how it moved instead. The spec now says so, and F-20 has its own register row.
- A sheet reopened straight after Cancel could close itself: the browser's late "close" event from the first closing shut the new one. Found as an intermittent CI timeout in the `flows` check.
- `NOTICE` said "[requested on DATE / granted on DATE]"; it now says permission has not been requested yet (register P-01).

No change to what a caregiver sees, the scoring rule (`cmai-count-rule-2`) or stored data.

## [0.2.0]

The version in `package.json` before this changelog started. Its changes are in the register's decision log and the git history.
