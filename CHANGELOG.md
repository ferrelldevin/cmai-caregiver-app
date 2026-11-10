# Changelog

What changed in each release of CMAI Tracker. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

A scoring change is always called out here with its new `RULE_VERSION`. Day-by-day decisions, and who approved them, are in the decision log in [docs/review-register.md](docs/review-register.md).

## [Unreleased]

### Added
- Passphrase-protected backup, lab build only (F-10): Export asks for a passphrase of 12 or more characters and encrypts the backup, with the CSVs inside. Restore opens it, offline too.
- Export format 2, lab build only (D-23): more columns at the end of each CSV (unique ID, phone, caregiver, local time with offset), and three new files: labels, caregiver ratings and watches.
- Three more "just before" choices, lab build only (F-41): Too hot or too cold, Slept badly last night, Seemed unwell.
- Clock check, lab view only (F-40): Settings > Clock check shows the phone's time to the tenth of a second, the UTC offset and the device ID, to film beside a wristband or camera. Stores nothing.
- Blind two-week caregiver rating, lab build only (F-47): after each period, each caregiver who logged gives their own CMAI for those 14 days, without seeing anything from the logs. Locked once submitted; never changes the app's rating. The lab view shows it beside the app's.
- On-phone PIN, lab build only (F-46, R1): each caregiver signs in with a 4-digit PIN once per shift; wrong tries wait, then lock; a setup PIN gives a new PIN. It says who is logging; it does not protect the data. Never in a backup.
- Caregiver profiles, lab build only (F-45, R2): caregivers are a code and initials; a chip shows who is logging and switches in one tap; new records say who made them; My residents come first in the switcher. `npm run checks` also tests the lab build.
- Database version 4 (F-44): every log gets an ID that stays unique across phones, and new logs record the phone and its UTC offset. Backups are format 2 and never include PIN fields; format 1 backups still restore. In the lab build, deleting a patient who has logs archives them with a reason instead of erasing them (D-20). A phone that opens this version cannot go back to an older one without export, clear and restore.
- Study settings (`src/study/settings.ts`, F-48): one switch per feature built before Dr. Gupta's sign-off. The normal build has them all off; `VITE_STUDY_MODE=lab` builds the lab version with them on. Settings > About shows which one is running.
- Editor and Git settings shared through the repo: `.editorconfig`, `.gitattributes` (LF line endings on every machine), recommended VS Code extensions and settings.
- Node 22 pinned in `.nvmrc` and `package.json` `engines`.
- `npm run lint` (ESLint with TypeScript and React hooks rules) and `npm run typecheck`.
- Pre-commit hook (Lefthook): formats and lints staged files, and scans them for secrets when gitleaks is installed.
- `SECURITY.md`, `CITATION.cff` and this changelog.
- CI runs every browser check and the axe audit (4 display modes) on each pull request, plus lint, type check, coverage floors on `src/scoring/` and `src/data/`, and `npm audit` for the app's dependencies. Deploy waits for all of them.
- Content-Security-Policy meta tag in the built app: scripts only from the app's own files plus the inline theme script, allowed by a hash worked out at build time.
- Dependabot: one grouped update PR a month for npm and for GitHub Actions.
- Playwright 1.63.0 and axe-core 4.14.0 pinned as dev dependencies, so the browser checks run the same versions everywhere.

### Security
- The backup message no longer suggests email or a cloud drive; it says to keep the file where the study team said (A-12).
- CSV cells that start with =, +, -, @ get a leading ' so a spreadsheet cannot run them as formulas (F-34).
- Only the deploy job can publish the site. Before, the `pages: write` and `id-token: write` permissions applied to the build job too, including on pull requests.

### Fixed
- Restore from backup checks every entry. A file with a name where a patient code belongs, a half item number, or a log for an unknown patient no longer gets into storage (where it made Export throw). Only the named fields are copied. The message says how many entries were left out (F-31).

### Removed
- `itemById` in `src/scoring/items.ts`: nothing called it and it had no tests.

### Fixed
- A sheet reopened straight after Cancel could close itself: the browser's late "close" event from the first closing shut the new one. Found as an intermittent CI timeout in the `flows` check.
- `NOTICE` said "[requested on DATE / granted on DATE]"; it now says permission has not been requested yet (register P-01).

No change to what a caregiver sees, the scoring rule (`cmai-count-rule-2`) or stored data.

## [0.2.0]

The version in `package.json` before this changelog started. Its changes are in the register's decision log and the git history.
