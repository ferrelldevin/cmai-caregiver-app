# 014. Passphrase-protected backup

2026-11-10 · Register: F-10, A-12 · Status: built on assumed approval (Devin, 2026-11-10), sign-off pending · Switch: `protectBackup` (lab build only) · Build plan v5, step 5.11 · Threat model T4 (draft PR #46)

## Problem

A backup holds every log on the phone. Today it is plain JSON, and the app suggested keeping it "in your email or cloud drive" (A-12). The threat model names "someone who gets a backup file" (T4): a forwarded email, a shared drive, a lost USB stick.

## Decision (assumed answers, each reversible)

- **Export asks for a passphrase** of at least 12 characters (and at least 4 different characters). It is shown, not hidden, with "Write it down: without it the file cannot be opened, by anyone."
- **AES-GCM**, 256-bit key from PBKDF2-HMAC-SHA256 at 600,000 iterations ([OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)), random 16-byte salt and 12-byte nonce in the file's header, through the browser's Web Crypto. The header is bound to the ciphertext as additional data, so changing any byte, header included, makes the file fail to open. Opening refuses iteration counts below 100,000 or above 10,000,000, so a changed header cannot weaken the key or hang the phone.
- **The CSVs go inside.** The protected file holds the backup and every CSV. The lab opens it with Restore on a lab machine.
- **The CSV buttons stay, with a warning.** The plan says no CSV leaves the phone unprotected with the switch on, but the lab machine that restores the file runs the same lab build and needs to export CSVs. So the buttons stay, under "These CSVs are not protected. Make them only on a lab machine." Deviation from the plan, for Dr. Gupta to settle: a separate lab-machine build would remove it.
- **Restore** recognizes a protected file and asks for its passphrase. A wrong passphrase, or a changed file, says "That passphrase does not open this file, or the file was changed. Nothing was restored." and restores nothing. Plain format 1 and 2 backups still restore. It works offline.
- **New message (A-12), both builds:** "Backup saved. Keep this file where the study team told you to." The data management plan (3.2) names the place.

## What this protects, and its limit

Unlike the PIN (note 011), this is real protection: a passphrase of 12 or more characters cannot be tried exhaustively. The limit: a weak passphrase is weak. "password1234" passes the length check and would fall to a dictionary attack. The hint suggests a short sentence; nothing checks against a list of common passphrases.

## Checked

- Unit tests (`tests/protect.test.ts`): round trip (including 100,000 non-ASCII characters); 600,000 iterations by default; wrong passphrase; a changed byte in the data, salt, nonce or iteration count; bad files; short and repetitive passphrases; a protected backup restores, a wrong passphrase restores nothing, a plain backup still restores.
- Browser (`e2e/protect-backup.cjs`, lab build): the file contains no readable patient code or behavior; restore on a second, offline browser; axe 0 violations in four display modes.
- Security review: see the pull request.
