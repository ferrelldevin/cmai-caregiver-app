# 011. On-phone PIN: who is signing in, once per shift

2026-11-10 · Register: F-46, R1 · Status: built on assumed approval (Devin, 2026-11-10), sign-off pending · Switch: `pin` (lab build only; needs `caregiverProfiles`) · Build plan v5, step 5.3 · Threat model: `docs/security/threat-model.md` (draft PR #46), "Assumed design: R1 option A"

## What the PIN is, and is not
It says who is logging, and it stops a passer-by opening the app. It does not protect the data from someone who has the unlocked phone and a computer: a 4-digit secret has 10,000 values and anything protected with it can be opened by trying them all. The phone's own passcode and its built-in storage encryption are the real guard. The PIN is not encryption, and no screen or document calls it that.

In NIST SP 800-63B-4 terms it is an activation secret, a secret that unlocks something on the device ([SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html), read 2026-11-10). It would not pass as a password on its own.

## Decision (assumed answers, each reversible)
| Rule | Built | Source |
|---|---|---|
| Length | 4 digits | NIST minimum. 6 is NIST's "should": Dr. Gupta confirms or raises it |
| Easy PINs | One digit repeated (`0000`) and straight runs (`1234`, `4321`) refused | NIST recommends a blocklist |
| Wrong tries | From the 5th, a wait of 30 s that doubles each time. At the 10th in a row the caregiver is locked | NIST: no more than 10 |
| When asked | App opened with nobody signed in; switching caregiver; 12 hours after sign-in. Never between opening the app and a tile. Locking the phone does not sign out | Plan 5.3 |
| Setup PIN | 6 digits, chosen before the first caregiver. Gives a caregiver a new PIN (forgotten or locked). Opens no data. Waits after 5 wrong tries, never locks | Plan 5.3 |
| Storage | PBKDF2-HMAC-SHA256 (Web Crypto), 600,000 iterations, random 16-byte salt per PIN. Salt, hash and count only; compared in constant time | [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) |
| Backups | No PIN field and no setup PIN, ever. Restore drops any it finds | Note 009 |
| Session | `localStorage` holds the caregiver code and sign-in time only. A time in the future or over 12 hours old is ignored | Plan 5.3 |

## Flow
1. Settings > Caregivers on a new phone: "Choose a setup PIN", twice. Then "Add the first caregiver".
2. Adding the first caregiver asks them to choose a PIN, twice. They are signed in.
3. From then on, opening the app with nobody signed in shows "Who is logging?" over the whole screen: tap your initials, enter your PIN. Nothing of the app shows behind it.
4. The chip in the resident bar opens "Who is logging?". Another caregiver asks for their PIN (or to choose one, the first time). Cancel keeps the one signed in. "Sign out" ends the shift on this phone.
5. "Forgot PIN?" (or "Unlock with the setup PIN" once locked) asks for the setup PIN, then a new PIN twice.

If the setup PIN is lost: export a backup, clear the app, restore, set up again. Logs are never behind a PIN, so nothing is lost.

## Known limits (accepted for now, in the threat model)
- **A caregiver with no PIN yet** gets one only through the setup PIN: whoever set up the phone enters it, then the caregiver chooses theirs. The security review of the PR found that without this, anyone could claim a caregiver restored from a backup by picking them first. It costs one more step per caregiver, once. After clear and restore the phone has no setup PIN, so the sign-in screen asks for a new one before showing the caregivers; whoever does the restore is there for that step.
- **Anyone signed in can add or remove caregivers.** Removing needs no setup PIN. A removed caregiver with records is archived, never deleted (note 010).
- **Someone with the unlocked phone and developer tools** can read storage or clear the counts. That is the threat-model T1 limit above, not something a PIN can fix.

## Acceptance criteria (plan 5.3)
1. Switch off (caregiver build): no sign-in screen; every existing check passes untouched. Done.
2. Sign in, close the app, reopen within 12 hours: no PIN asked, one tap logs. Checked in `e2e/sign-in.cjs`.
3. Keys 72 px (64 or more); the dots are announced as "2 of 4 digits entered"; a wrong PIN says so in words. Checked, axe 0 violations in four display modes.
4. Hash time: 94 ms in Node 22 on the cloud machine; not yet timed on Devin's iPhone (needs a phone). A "Checking…" line shows while it runs. The count is not lowered.
5. Security review: see the pull request.

## Not now
Face ID or Touch ID through passkeys (WebAuthn) would replace the PIN and is the better end state. Whether it works in a Home Screen web app on the lab's phones is not known, and whose phones they are is open (P-10).
