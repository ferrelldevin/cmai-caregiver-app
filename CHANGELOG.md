# Changelog

What changed in each release of CMAI Tracker. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

A scoring change is always called out here with its new `RULE_VERSION`. Day-by-day decisions, and who approved them, are in the decision log in [docs/review-register.md](docs/review-register.md).

## [Unreleased]

### Added
- The app remembers the last patient in its own database (new `meta` table, database version 4), not as a patient code in `localStorage`. Older installs are moved across once.
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
