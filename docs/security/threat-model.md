# Threat model and login standard

Draft, 2026-11-10. Build plan step 3.3. Checked against `main` at `b753f6f`. Written by Claude (cloud thread) for Devin to take to Dr. Gupta. Nothing here changes the app.

Lines marked **assumed, sign-off pending** follow the build plan's recommended answer, which Devin asked us to build on until Dr. Gupta confirms or reverses it (2026-11-10). Each names the register ID that holds the decision. IDs marked *proposed* are not in `docs/review-register.md` yet (build plan step 0.8 adds them).

## Bottom line

- Today the data is only as safe as the phone's own lock. The app adds no lock and no encryption of its own (P-07, *proposed* in PR #41).
- The two biggest gaps before real data are **the backup file** (plain JSON, sent wherever the caregiver chooses) and **the hosted site** (one personal GitHub account can change the app on every phone at once).
- A PIN screen on its own would not protect the data. It only matters if the PIN also unlocks an encryption key, and even then a 6-digit PIN protects against a casual person, not a determined one with the file.
- Login standard: [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html). Its rules for a PIN that unlocks something on the device are in section 3.2.10; for passwords, 3.1.1.2.

## What is being protected

| Asset | Where it lives | Why it matters |
|---|---|---|
| Behavior logs: resident code, behavior, exact time, "what happened before", short notes | Phone, IndexedDB database `cmai-tracker` (`src/data/db.ts`) | Health information about a person with dementia once the code can be linked to them |
| The key that links a code (such as `P-01`) to a real person | Not in the app. Held by the lab (see the data management plan) | Whoever has the key and an export can name the person |
| Backup file (`cmai-backup-<date>.json`) and the two CSVs | Wherever the caregiver saves or sends them | A full copy of everything on the phone, unencrypted |
| Ratings and the change history | Phone and exports | The study's results. Integrity matters as much as secrecy (D-14, D-21) |
| The app itself | GitHub repo `ferrelldevin/cmai-tracker`, built by GitHub Actions, served by GitHub Pages | A changed app runs on every installed phone and can read everything on it |
| Last-picked resident code | Phone, `localStorage` key `cmai-patient` (`src/App.tsx:28`) | A copy of a code already in IndexedDB |

## Who might get at the data

Each row: what they could do, what stops them today, and what is still missing. "Today" is verified in the code unless it says inference.

| # | Who | What they could do | What stops them today | Gap | Fix, and where it is tracked |
|---|---|---|---|---|---|
| T1 | Someone who picks up an **unlocked** phone with the app open, such as a visitor or another resident's family | Read every resident's logs, add or delete logs, export a backup | Nothing in the app. Deletes need a reason and stay in the history (`src/data/logs.ts`) | No app lock, no timeout | R1 PIN with auto-lock (below). **Assumed, sign-off pending:** R1 option A (register R1, P-07) |
| T2 | Someone with a **locked** phone that was lost or stolen | Nothing without the phone's passcode | The phone's own passcode and storage encryption. Inference: we have not checked which phone models the lab will use | A phone with no passcode | Lab rule: study phones must have a passcode. Stage 6 checklist line "checked on the real phone models" |
| T3 | **Another caregiver on a shared phone** | Log under the wrong name, see residents not assigned to them | Nothing. There are no caregiver identities; the change history has no "who" field (`src/data/db.ts`, `LogChange`) | Logs cannot be tied to a caregiver | R2 caregiver profiles, one schema change in database version 4 (plan step 5.1, N-08). **Assumed, sign-off pending:** R2 |
| T4 | Someone who **gets a backup or CSV file**: a forwarded email, a shared drive, a lost USB stick | Read everything, for every resident on that phone | Patients are codes, never names (`src/data/db.ts:7`). Nothing else. The app suggests "your email or cloud drive" (`src/ui/DataScreen.tsx:136`, audit A-12) | Plain-text file sent through unapproved places | Data management plan names the approved place (P-04). Encrypted backup (F-10). **Assumed, sign-off pending:** F-10 backup encryption with a lab-held passphrase, before G2 |
| T5 | Someone who **hands the lab a crafted backup** or note | A file that breaks Export after restore (A-03). A note starting with `=` that a spreadsheet runs as a formula when the research team opens the CSV (A-07) | Restore checks a few types only (`src/data/manage.ts:20-40`). CSV cells are not escaped for formulas (`src/data/exporter.ts:11-12`) | Both proven in the 2026-11-10 audit | Plan steps 1.2 (F-31, *proposed*) and 1.6 (F-34, *proposed*). Lane A, no sign-off needed |
| T6 | Someone who **changes the hosted app**: a stolen GitHub login, a bad dependency, a bad pull request, a compromised GitHub Action | Ship code that copies every log to a server, to every installed phone, on their next open | Pull request required on `main`, both check jobs required, no force push (ruleset "Main", verified 2026-11-04). Content-Security-Policy `connect-src 'self'` stops the page sending data to other sites (`vite.config.ts:22-33`). Dependabot, CodeQL, secret scanning | One person can merge and deploy (C-10). Actions are pinned to tags, not commits (B-04). Every merge reaches every phone at once (B-09). An attacker who can merge can also change the policy | Two-person review once Shanmei has access (plan 3.8). Commit-pinned actions (2.4). Deploy only on a version tag (2.7). A lab or ODU address that sends security headers (Stage 6, N-04) |
| T7 | **Another website** that frames the app | Trick a caregiver into tapping inside a hidden frame (clickjacking) | Nothing. A policy in a `<meta>` tag cannot block framing; that needs an HTTP header, and GitHub Pages cannot send one (N-04). Inference: low risk while the app has no sign-in and nothing to steal by a click | No `frame-ancestors` | Host that sends headers, before G2 (Stage 6) |
| T8 | **The phone itself** loses the data: Safari clears storage, the app is deleted, a save fails | Logs gone with no warning | Settings has a button that asks the browser to keep the app's storage, and tells iPhone users to install the app (`src/ui/DataScreen.tsx:156, 207`). WebKit says data of a site unused for 7 days of Safari use can be deleted, and that Home Screen apps keep their own count ([WebKit, 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)) | No backup reminder (N-01). A failed save shows nothing (A-05) | Plan steps 1.4 (F-33, *proposed*) and 1.8 (F-36, *proposed*) |
| T9 | **Logs go to the wrong resident** | Wrong data in the study, which nobody can tell apart later | Resident code on the Log screen and the confirmation (F-01). The switcher bug can open the first patient instead (A-01, A-02) | A-01 | Plan step 1.1 (F-30, *proposed*) |
| T10 | **People on the team**, without meaning to: a real name typed in a note, an export pasted into an AI chat, a screenshot in a pull request | Real data in a place it may not be | Notes say "no names" (`src/ui/LogSheet.tsx`). Project rule: made-up data only in GitHub, personal Drive and AI chats until Dr. Gupta says where it may live | Free-text notes cannot be checked for names | Caregiver training. Data management plan section "if real data shows up in the wrong place" |

## What R1 (login) must add

### Assumed design: R1 option A, a PIN on the phone

**Assumed, sign-off pending** (R1, P-07, F-10). Recommended because it keeps data on the phone, so it needs no server and no new IRB question about where data goes. Option B (lab accounts or REDCap) waits for P-03 and P-04.

In NIST's terms, an on-phone PIN is an **activation secret**: something that unlocks a factor stored on the device (SP 800-63B-4, section 3.2.10). The app's design follows that section:

| Rule | NIST 800-63B-4 | Our design |
|---|---|---|
| Length | At least 4 characters; 6 recommended; all-digit PINs are allowed (3.2.10) | 6 digits |
| Common PINs | A blocklist is recommended (SHOULD), not required, for activation secrets (3.2.10) | Refuse one digit repeated (`000000`), straight runs (`123456`, `654321`) and a short list of the most common PINs kept in one file |
| Wrong attempts | No more than 10 wrong tries, then the authenticator is disabled and a different one is needed (3.2.10) | After 10 wrong tries the PIN stops working. The lab unlocks it with a recovery code it holds, or the phone restores from the latest backup |
| Composition and forced changes | Composition rules and periodic forced changes are not allowed for passwords (3.1.1.2, items 5 and 6) | No rules beyond length and the blocklist. Changed only if someone else may know it |
| One per person | | One PIN per caregiver profile (needs R2 first, plan 5.2 then 5.3) |
| Lock after inactivity | Not taken from NIST. Proposal | Lock after 5 minutes in the background, and on every cold start. **Assumed, sign-off pending** (R1) |

**What makes a PIN worth having.** A PIN screen that only hides the app leaves the database readable by anyone who can open the browser's storage. The PIN must also unlock an encryption key:

1. On setup, the app makes a random data key with the browser's Web Crypto API and encrypts each stored record with AES-GCM.
2. The data key is itself encrypted with a key derived from the PIN (PBKDF2 or a slower derivation) and stored beside the data.
3. Inference, important: a 6-digit PIN has one million values, so anyone who copies the encrypted database can try them all in minutes. The PIN protects against T1 and T3 (a person at the phone, stopped after 10 tries). It does not protect a copied file. That is why backups (T4) need their own, longer passphrase.

**Backup files.** **Assumed, sign-off pending** (F-10, P-04): the backup is encrypted with a passphrase the lab sets on each study phone and holds itself, at least 15 characters. The 15 is borrowed from NIST's minimum for a password used on its own (3.1.1.2, item 1); a backup passphrase is not an authenticator in NIST's sense, so this is our choice, not a NIST requirement. The CSVs for analysis are made at the lab, from the restored backup, not on the phone.

### If Dr. Gupta picks option B, lab accounts

- Use an account system ODU or the lab already runs rather than building one. Whether ODU single sign-on or ODU REDCap can be used for this app is **not verified**; it is a question in the review packet (R1, P-03).
- Aim for AAL2: proof of two distinct factors (SP 800-63B-4, section 2).
- If passwords are used: at least 15 characters when used alone, at least 8 with a second factor; check against a blocklist; no composition rules; no forced periodic changes (3.1.1.2).
- Data then leaves the phone, which changes T4, T6 and the IRB question. A new threat model is written before any code.

## What must be true before real data (gate G2)

These are the threat-model lines of the plan's Stage 6 checklist.

- [ ] T1, T3: PIN with encryption at rest built and checked (plan 5.3), or Dr. Gupta records in the register that study phones are lab-controlled and single-user.
- [ ] T4: backup encryption built (F-10), and the backup message names the approved place (A-12).
- [ ] T5: plan steps 1.2 and 1.6 merged.
- [ ] T6: deploys only on a version tag (2.7); actions pinned to commits (2.4); a second reviewer with access.
- [ ] T7: served from an address that sends security headers.
- [ ] T8: backup reminder (1.8) and save-failure message (1.4) merged; a quarterly restore drill on a second device (plan Part 6).
- [ ] This document reviewed again after R1 and R2 are designed.

## Not covered

- The lab's own computers and storage after a file arrives there. That is the data management plan's job.
- Sensor and video data from the lab's other work. Not in this app.
- Checked only by reading: the phones' own encryption, GitHub's settings (last verified 2026-11-04).
