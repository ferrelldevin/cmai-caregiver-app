# Runbook: when something goes wrong

Draft, 2026-11-10. Build plan step 3.8. Each entry: how you notice, what to do, where each command runs. Until real data exists (gate G2), every case here involves demo data only.

How the app reaches phones, which most entries depend on: a merge to `main` runs the **Test and deploy** workflow (`.github/workflows/pages.yml`). If both check jobs pass, it publishes to GitHub Pages. Installed phones pick up the new version by themselves the next time the app is opened with a signal (service worker, `registerType: "autoUpdate"` in `vite.config.ts`). If a check fails on `main`, the deploy is skipped without a message (audit B-09).

## 1. The site is down or will not open

1. **Browser:** open the repository's **Actions** tab. Is the latest **Test and deploy** run on `main` green?
   - Red: see entry 2 if a bad change went out, or entry 5 if a check failed.
   - Green: open [githubstatus.com](https://www.githubstatus.com/) and check **Pages**. If GitHub is down, wait; there is nothing to fix on our side.
2. **Phone:** an installed app keeps working offline, so caregivers can keep logging while the site is down. Tell them not to delete the app.
3. If Pages is up but the site shows an old version: **Browser:** in Actions, open **Test and deploy**, press **Run workflow** on `main`.

## 2. A deploy is bad (something broke after a merge)

1. **Browser:** on GitHub, open the merged pull request and press **Revert**. GitHub opens a new pull request that undoes it.
2. Wait for both check jobs, then merge it (Devin). The deploy runs again with the old code.
3. **Phone:** open the app with a signal, close it, open it again. Confirm the problem is gone.
4. Record it: a decision-log row in `docs/review-register.md` saying what broke and when, and a line in `CHANGELOG.md`.

Stored data is not touched by a revert unless the bad change upgraded the database (`src/data/db.ts` version). If it did, stop and do not revert: a phone cannot go back to an older database version. Write a fix forward instead, and test it against a backup made before the bad deploy.

Once PR #38 merges, `docs/process/release.md` covers version tags; follow it for the release after the fix.

## 3. A phone lost its data

How you notice: the app opens on the welcome screen, or a resident's logs are gone.

1. **Phone:** do not log anything new yet, and do not press "Load demo data".
2. Find the most recent backup file (`cmai-backup-<date>.json`) in the approved place (data management plan, section 3).
3. **Phone:** the Data tab (Settings once PR #41 merges), Backup and export, **Restore from backup**, choose the file. The message says how many patients and logs came back. Logs already on the phone are kept and not doubled.
4. Check one resident's Score screen against the last known counts.
5. Logs made after that backup are lost. Write down the dates in the register so the analysis treats them as unknown, not as calm days (D-11).
6. Find the cause: was the app installed to the Home Screen? Safari can clear a website's data after 7 days of Safari use without visiting it; Home Screen apps keep their own count ([WebKit, 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). Install it, and press **Ask the browser to keep data** on the Data tab's Keep data safe page.

A restore can report fewer logs than expected if the file is damaged; see audit A-03 and plan step 1.2.

## 4. A phone is lost or stolen

1. Tell Dr. Gupta the same day (data management plan, section 5).
2. The last backup is the record from now on. Note the gap in the register as in entry 3, step 5.
3. Set up the replacement phone and restore the last backup onto it.

## 5. A check fails only on the desktop

How you notice: "Run the CMAI checks" on DEVIN-DESKTOP prints `RESULT: FAIL`, while CI on the same commit is green.

1. **PowerShell, in `C:\lab\cmai-tracker`:** `node -v` must print `v22`. If not, run `fnm use`.
2. **PowerShell:** `git status` must be clean and `git log -1` must match the commit CI ran. Then `npm ci` (always after a pull that changed `package.json` or `package-lock.json`).
3. **PowerShell:** port 4173 must be free: `netstat -ano | findstr :4173`. Close whatever holds it.
4. **Claude Code on the desktop:** say `Run the CMAI checks` again. Paste the `RESULT:` line and every `FAIL` line into the project thread exactly as printed.
5. A cloud thread reproduces it and fixes it in a pull request. Do not fix it on the desktop (`CLAUDE.md`), and do not add a longer wait to make it pass.

## 6. Real data shows up somewhere it should not be

Stop, do not copy it further, and tell Dr. Gupta the same day. Follow the data management plan, section 6. In a pull request or issue: do not quote it in a comment. Deleting it in a new commit is not enough; the history still holds it.

## 7. A security problem is reported

Reports come in privately through the repository's **Security** tab ([SECURITY.md](../../SECURITY.md)). Devin reads it, opens a private fix with GitHub's security advisory, and tells Dr. Gupta if participant data could be involved. Check `docs/security/threat-model.md` for which threat it is and update it in the fix.
