# 024. The app sends a self-test resident's logs to the lab server (F-63)

2026-11-17 · Register: F-63 (new), F-62, P-15 · Status: built, lab build only, off until someone turns it on · Follows design notes 020 and 023 · Real data stays blocked (G1)

## Problem

Note 023 built a server Devin can run. Nothing in the app could reach it: the app has no network code, and the page's security policy stops it sending data anywhere. Devin wants to test phone, server and the lab's 7:15 task on his own logs, with as little risk to real data as possible.

## What it does

A card on the Backup page, **Send to the lab server**, in the lab build only (`syncToLab`, register F-63).

| Part            | Behavior                                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Send switch     | Off on a new phone. Even with it on, nothing is sent until a key is pasted and a resident is marked                                                                                      |
| Key             | A write key for class `self-test`, made on the server. Kept in this phone's browser storage, never in backups, never shown on screen, never inside the file                              |
| Self-test mark  | A switch per resident. Not offered for demo residents. Only a marked, active resident is ever sent                                                                                       |
| What is sent    | The same v1.0.0 research export `buildResearchExport` makes, whole history of that resident, header `data_class: "self-test"`. Item numbers and times only. Nothing new leaves the phone |
| When            | While the page is open: right after a change in the card, every 20 seconds, when the phone comes back online, and when the app comes back to the front                                   |
| After a failure | Waits 30 s, then 60, 120 ... up to 15 minutes. A "no" from the server (bad key, refused file) is retried only every 15 minutes, since asking faster changes nothing                      |
| Status          | One line in plain words: not sending, waiting for a key, nothing to send yet, up to date at 2:41 PM, or the problem in the server's words with how many are unsent                       |
| Send now        | Skips the wait                                                                                                                                                                           |

## Why there is no queue table

A retry queue would be a new IndexedDB table, which means a **database version bump**, which cannot be undone once phones upgrade (note 009). It is also not needed: the server keeps the newest revision of each record and ignores repeats (note 023), so sending the whole file again is always safe. "Unsent" is simply "the records no longer match what the server last accepted" (a SHA-256 of the records is kept per resident in `localStorage`). If that is lost, the file is sent again. Tradeoff: the whole history is resent after any change. Fine for a tester's own logs (the server limit is 5 MB per push, tens of thousands of records); revisit before anything larger.

## Pinned to one address

- `VITE_SYNC_ORIGIN` is read at build time, only in the lab build, and only a plain `https://` address or `http://127.0.0.1` / `localhost` is accepted (anything else fails the build).
- The same address goes into the page's `connect-src` and into the app. It is not typed by a person. The caregiver build ignores it and keeps `connect-src 'self'`.
- A lab build made without it shows "no lab server address built in" and cannot send. The deployed GitHub Pages build is a caregiver build, so nothing about the live app changes.
- Threat model T6 (an attacker who can merge): the lab build's one address can be changed in a pull request; the page still cannot reach any other. Noted in `docs/security/threat-model.md`.

## Where it can run

The server must allow the page's origin (`ALLOWED_ORIGIN`) and the phone must be able to reach `VITE_SYNC_ORIGIN`. For a phone that means HTTPS (a browser blocks an HTTPS page from calling plain `http://`). The plan from note 023: Tailscale Serve on Devin-Desktop gives `https://tower-desk.tail25672a.ts.net:8787`, tailnet only. That command is a change to the desktop's Tailscale setup and is run only with Devin's say-so; nothing in this change does it.

## Assumed picks (each "assumed, sign-off pending")

1. The key sits in browser storage like the logs themselves (P-07). Anyone who can read the phone's storage can read it. A write key can push but cannot read anything back, and can be revoked on the server.
2. Sending happens only while the page is open. A web page cannot send when closed; the next open sends what is waiting.
3. `self-test` is outside contract v1.0.0. The manual export still refuses a self-test resident (only the sync passes `allowSelfTest`). `self-test` is added to the v1.1.0 draft enum.
4. A resident marked self-test is trusted to be made up. The app cannot tell. The card says so in words next to the switches.

## Checked (2026-11-17, Devin-Desktop, made-up data)

| Check                                                                                                   | How                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules: who is sent, repeats skipped, resend after an edit, each failure class, partial failure, backoff | 17 unit tests, `tests/sync.test.ts`                                                                                                                                                                                           |
| The card in a real browser, server pretended                                                            | `e2e/sync.cjs`, in `npm run checks`: switch starts off, nothing sent until key and switch, down then up, refusal text, no other address reachable, axe 0 violations, both builds' page policy                                 |
| The whole path, nothing pretended                                                                       | `e2e/sync-live.cjs` against the real Docker stack: send, **server stopped and started with the app open**, the app's own retry sends, a delete arrives as a revision-2 tombstone, the lab reader merges, the audit log has it |

Not covered: a real phone, the Tailscale HTTPS route, and a closed-tab send (impossible by design).

## Not done

- No Tailscale Serve entry and no change to who can reach the server.
- No delete path for test data on the server, no per-participant key, no rate limit (note 023 lists these).
- The 7:15 task still has no key file and no `since` cursor store.
