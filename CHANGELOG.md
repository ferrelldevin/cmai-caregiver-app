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

### Fixed
- `NOTICE` said "[requested on DATE / granted on DATE]"; it now says permission has not been requested yet (register P-01).

No change to the app, the scoring rule (`cmai-count-rule-2`) or stored data.

## [0.2.0]

The version in `package.json` before this changelog started. Its changes are in the register's decision log and the git history.
