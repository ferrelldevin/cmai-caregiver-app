# CLAUDE.md

## "Run the CMAI checks"

When asked to run the CMAI checks (or the browser checks), do exactly this and nothing else:

1. Run `git status --porcelain`. If anything is listed, stop and say which files have uncommitted changes. Do not stash, reset or commit them.
2. Run `git checkout main` and `git pull origin main`.
3. Run `npm run checks:report`. It installs what it needs, builds the app, runs every check in `e2e/` (flows, navigation, scores-period, theme, patient-switcher, sheet, screenshots) and the accessibility audit (`docs/audits/axe-run.cjs`, 4 display modes) against a local preview, then the lab-build checks (`e2e/caregivers.cjs`, `e2e/sign-in.cjs`, `e2e/blind-rating.cjs`, `e2e/clock.cjs`, `e2e/before-chips.cjs`, `e2e/protect-backup.cjs`) against a second preview on port 4174, writes `.checks/report.md` and pushes that one file to the `checks-report` branch, where the cloud session reads it.
4. Reply with the `RESULT:` line and every `FAIL` line from the report, exactly as printed.

Rules for this task:

- Change no code, test or doc. Do not fix failures here; they are fixed in a pull request from the cloud session.
- The only thing pushed is the report, by the script. Never push to `main` or any other branch.
- The checks use made-up demo data only. Never add real participant data.
- If a step fails before the checks run (install, build, port 4173 or 4174 in use), the report says so; reply with that.
