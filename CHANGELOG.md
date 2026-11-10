# Changelog

What changed in each release of CMAI Tracker. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

A scoring change is always called out here with its new `RULE_VERSION`. Day-by-day decisions, and who approved them, are in the decision log in [docs/review-register.md](docs/review-register.md).

## [Unreleased]

### Added
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
- Vitest and its coverage tool upgraded to 5.1.0 and Vite to 6.4.6: the 3 critical and 1 high advisories in the test tools are gone. CI also fails on any critical advisory in any dependency.
- GitHub Actions in `pages.yml` are pinned to full commit SHAs, so a moved tag cannot change what runs. Runs on `main` are never cancelled, and every job stops after 15 minutes.
- Only the deploy job can publish the site. Before, the `pages: write` and `id-token: write` permissions applied to the build job too, including on pull requests.

### Changed
- CI fails when `docs/test-cases.json` is out of date with `npm run gen:cases`, and runs the agreement script's self-test.

### Removed
- `itemById` in `src/scoring/items.ts`: nothing called it and it had no tests.

### Fixed
- A sheet reopened straight after Cancel could close itself: the browser's late "close" event from the first closing shut the new one. Found as an intermittent CI timeout in the `flows` check.
- `NOTICE` said "[requested on DATE / granted on DATE]"; it now says permission has not been requested yet (register P-01).

No change to what a caregiver sees, the scoring rule (`cmai-count-rule-2`) or stored data.

## [0.2.0]

The version in `package.json` before this changelog started. Its changes are in the register's decision log and the git history.
