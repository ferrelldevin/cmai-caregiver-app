# Changelog

What changed in each release of CMAI Tracker. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

A scoring change is always called out here with its new `RULE_VERSION`. Day-by-day decisions, and who approved them, are in the decision log in [docs/review-register.md](docs/review-register.md).

## [Unreleased]

### Changed

- Log screen from the round 3 mockup (F-26): behavior tiles 3 across with icons and today's count, group tabs, and a "Most logged for this resident" row.
- What counts as each behavior moved off the buttons into one sheet, opened under the tiles or by holding a tile (F-37).
- Score folded into Two weeks (F-29): the bar is now Log, Today, Two weeks, Settings. Everything Score showed is on Two weeks, with the total as a secondary chip beside the title. Old Score addresses still open the right period. The Score screen and the Recharts library are removed.
- New Two weeks tab (F-28): one 14-day period with the answer first, each behavior against last period, logs per day, time of day, behavior groups (Open: D-17) and patterns to look into (Open: D-18), drawn without a chart library.
- New Today tab (F-27): today's logs by hour and by behavior, where a log is fixed or removed. Recent logs and "Nothing to log today" moved there from Log.

### Added

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
