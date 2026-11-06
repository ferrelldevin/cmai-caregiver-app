---
name: run-cmai
description: Build and open CMAI Tracker on demo data to confirm a change works by using it. Use before calling any UI change done, or when asked to run, start or screenshot the app.
---

# Run CMAI Tracker

The lab's bar is "done means checked by using it, not by reading it". This is how to use it.

## Start it

```sh
npm ci                          # only if package.json or package-lock.json changed
npm run build
npx vite preview --port 4173 --strictPort
```

Open http://localhost:4173/ (base is `./`, so not `/cmai-tracker/`). If port 4173 is taken, stop the other preview first; `scripts/run-checks.mjs` uses the same port.

Drive it with Playwright Chromium (`require('playwright')`), or set `CHROME` to a Chromium binary. Cloud sessions cannot reach the GitHub Pages site, so always use the local preview.

## Load data

Only made-up data. Never type or paste real participant data.

- Go to `#/data/demo` and press the load button: six weeks for P-DEMO-A (improving) and P-DEMO-B (worsening).
- Remove it afterwards from the same page.

## Click through what changed

Routes live in the hash: `#/log`, `#/scores`, `#/scores/p<n>`, `#/data`, `#/data/<backup|display|safe|demo|about>`.

For every screen the change touches, check:

1. Phone width (390 x 844) and desktop.
2. Light, dark, light high contrast, dark high contrast (`#/data/display`).
3. Empty state (no patients), first run, and with demo data.
4. Back gesture and reload land on the same screen.
5. Offline: load once, go offline, reload.

Take before and after screenshots at deviceScaleFactor 2 for the PR.

## Then run the checks

`npm run checks` runs every `e2e/` check and the axe audit in 4 modes and writes `.checks/report.md`. Do not use `checks:report` from a cloud session; that one pushes and is for the home desktop (see `CLAUDE.md`).
