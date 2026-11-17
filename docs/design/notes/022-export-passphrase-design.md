# 022. A passphrase for real exports, design only (G7)

2026-11-17 · Register: F-61 (new) · Status: DESIGN ONLY, nothing built · Stop: real exports stay off (G1) until Dr. Gupta answers in writing · Docs only

## Problem

Today's export is a plain JSON file, which is fine for made-up data. A file of real logs on a phone is a readable record of a person's behavior with a study ID, a date and a device. It could sit in Downloads, a messaging app, an email attachment or a lost USB stick. If real exports are ever allowed, the file should be useless to anyone without the key. A passphrase on the file is the simplest way to get that without a server.

**Encryption is necessary, not sufficient.** It does not decide where real files may be kept, who may export, or whether the IRB allows it. Those stay Dr. Gupta's (P-03, P-04).

## Recommendation (plain version)

- The lab chooses one study passphrase and keeps it. **Caregivers never choose, see or type it** (Dr. Gupta's limit: as little caregiver burden as possible).
- The app locks the file with it and never stores it. A lab person or the lab's setup enters it once per phone for the export.
- The lab opens the file with a small script and the same passphrase.
- Lose the passphrase and the file cannot be opened. That is the point, so the lab must store it somewhere safe.

## How it would work

| Part                | Pick                                                                                                                               | Why                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Cipher              | AES-256-GCM through the browser's own Web Crypto                                                                                   | Built in, no new library, tamper-evident (a changed file fails to open rather than opening wrong)                   |
| Key from passphrase | PBKDF2 with SHA-256, at least 600,000 rounds, a random 16-byte salt per file                                                       | Also built in. A stronger option (Argon2id) needs a library shipped in the page; revisit if the lab wants it        |
| Nonce               | Random 12 bytes per file                                                                                                           | Never reused with a key                                                                                             |
| File                | `cmai-export_….json.enc`: a small JSON envelope with `format`, `kdf`, `rounds`, `salt`, `nonce`, `ciphertext`                      | The inside is exactly the v1.0.0 (or later) file, unchanged, so the schema and reader work after opening            |
| Readable outside    | Only `format` and the encryption settings                                                                                          | No participant ID, dates or counts outside. The file name drops the participant ID too (a random export ID instead) |
| Passphrase          | Chosen by the lab: six random words or 20+ characters. Never typed by a caregiver, never stored in the app, never in the file name | Strength matters more than the cipher: PBKDF2 slows a guesser but cannot save a short passphrase                    |
| Wrong passphrase    | The app and the script say "Could not open this file" and nothing more                                                             | No hint about which part failed                                                                                     |

## The lab side

The reader today is Python standard library only. AES-GCM is not in the standard library, so opening the file needs the `cryptography` package on the lab desktop (or the OpenSSL command line). That is a small, common dependency, but it is a new one for the lab, so it is a decision, not a given.

## What would still be needed first

1. Dr. Gupta's written answer on **where real exports may be kept** and whether a phone may hold them at all.
2. Who holds the passphrase, how many people know it, and how it changes if someone leaves the lab (a change means old files need the old passphrase kept).
3. Whether one passphrase for the study is enough, or one per site or per participant (more passphrases mean more to lose).
4. The IRB's view: some boards treat an encrypted file as still personal data, so encryption may not widen what is allowed.

## Done when (for a later build, not now)

- A file made with a made-up passphrase opens with the right one in the app test and in the Python script, byte-for-byte equal to the plain export.
- A wrong passphrase, a changed file and a truncated file all fail with the same plain message.
- No passphrase is written to storage, logs, the file name or the history. A test searches the stored data for it.
- Real exports are still refused unless `realExports` is on (G1). Encryption never turns it on.

## Not in this design

Sending the file anywhere (see note 020), a passphrase for the backup file, per-person accounts, or recovery of a lost passphrase.
