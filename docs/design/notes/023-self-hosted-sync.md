# 023. A self-hosted sync server on Devin's desktop, for testing the whole pipeline (F-62)

2026-11-17 · Register: F-62, P-15 (new) · Status: server built and reviewed; the app side is in design note 024 · Follows design note 020 (option C, run by Devin instead of waiting for a lab server) · Real data stays blocked (G1)

## Why

Note 020 found that logs live only on the phone, so a daily pull has nothing to pull from, and named a lab server as the real answer. That server does not exist yet. Devin approved running a small one in Docker on Devin-Desktop so he can test every step himself (phone or browser, then the server, then the lab's 7:15 task), and so the same files can move to an ODU server later.

## What was built

One compose file in `server/`, two containers, all settings by environment variable.

| Part               | What it is                                                                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `db`               | PostgreSQL 17                                                             | No published port. Only the sync service can reach it. Data in a named volume (no host path)                                                                                                                                                                                                                                                                                                                                         |
| `sync`             | Node 22, one small service (`pg` and `ajv` are its only dependencies)     | `POST /v1/logs`, `GET /v1/export`, `GET /healthz`. Database settings are separate `PG*` variables, not one URL                                                                                                                                                                                                                                                                                                                       |
| Keys               | Random secrets, stored only as a SHA-256 hash                             | Role `write` or `read`, a data class, revocable. Made and revoked with `server/src/admin.mjs`, which is audited too                                                                                                                                                                                                                                                                                                                  |
| Audit              | `audit_log` table, append-only (triggers refuse UPDATE, DELETE, TRUNCATE) | Every push and pull that carries a key, allowed or refused, and every wrong method, server error (best effort: if the database itself is down there is nothing to write to), key made or revoked, and data removed: when, which key, participant, range, outcome, source address. Not audited: browser permission checks (OPTIONS), and requests without a valid key beyond 30 a minute per address (one row says the limit was hit) |
| `server/test/`     | 8 unit tests (dates, contract checks)                                     | `npm test --prefix server`                                                                                                                                                                                                                                                                                                                                                                                                           |
| `server/smoke.mjs` | 32 checks against a running server, made-up data only                     | Prints each step so it can be watched                                                                                                                                                                                                                                                                                                                                                                                                |
| CI                 | `.github/workflows/server.yml`                                            | Unit tests, then the stack in Docker and the smoke script, on pull requests that touch `server/` or the contract                                                                                                                                                                                                                                                                                                                     |

### The three routes

- `POST /v1/logs` with a **write** key: one v1.0.0 file. It is checked against the contract's schema (`docs/contracts/cmai-export/cmai-export.schema.json`, copied into the image) and then against the same cross-checks the lab's Python reader makes: real UTC times, `utc_offset_min` matches the zone at that moment, end not before start, revised not before logged, no repeated record and revision, revision under 10^9. A file the reader would stop on is refused here, so it never reaches the lab. All or nothing.
- `GET /v1/export?participant=P-01&from=2026-11-01&to=2026-11-14[&tz=America/New_York][&since=<time>]` with a **read** key: the newest revision of every record for that participant, as a v1.0.0 file. Deleted records come back as `status: "deleted"` tombstones, as in the app's export. The default zone is `DEFAULT_TZ`. Dates must be real (2026-02-31 is refused).
- `GET /healthz`: up, and the database answers.

### How the 7:15 task should pull (decided 2026-11-17, from the review)

A pull by day only sees logs that start in those days. A late edit, a late delete, or logs a phone sends after being offline would fall on days already pulled. So:

- **Matching** uses any stored revision: a record is returned for a day if any of its revisions started in that day, and the newest revision is what comes back. An edit that moves a log to the next day still reaches the old day's pull, where it replaces the old copy.
- **`since`** returns only records that got a new revision after that time. Every pull sends `x-cmai-next-since`: the time the pull was asked, minus 5 minutes (a push that was still committing is never missed; the reader merges repeats, so extra records are harmless).
- **The daily task** pulls the whole study window (for example `from=2026-11-01&to=2026-12-31`) with `since=<last next-since>`, and saves the new `x-cmai-next-since` for the next run. A first run, or any doubt, omits `since` and gets everything. Option not taken: always pull the full range (simpler, heavier, and grows without limit).

### Merge rules (the "done when" from note 020)

| Case                                          | Result                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| Same file sent twice                          | The second send adds nothing (`added: 0, duplicate: N`)                |
| Same pull twice                               | Same records; only the file's `export_id` and `exported_at_utc` differ |
| A log edited or deleted, then sent            | Stored as revision 2; the next pull returns revision 2                 |
| Same `record_id` and revision, other content  | Refused (409), nothing saved                                           |
| A record seen under another participant/class | Refused (409)                                                          |
| Two pushes at once with the same record       | One waits for the other (a lock per record, taken in a fixed order)    |

Checked on 2026-11-17 on made-up data: the smoke script passes 32 of 32 and the unit tests 8 of 8. The lab's reader (`cmai_export_check.py`) merges the pulled files: the edit wins as revision 2, the deleted log drops out, and merging a pull again changes nothing. Not yet tested: two pushes truly at once (reasoned from the lock, not run), and CI (the workflow is new).

## Data classes

Three classes, kept apart at every step: `synthetic` (made-up demo data), `self-test` (Devin's own logs from using the app) and `real` (a participant). The class is part of the key, not a switch the sender flips.

- A key has one class. A push whose file says another class is refused. A read key returns only its own class.
- **`real` has no key class at all.** The database refuses the label (`CHECK`), so a bug in the service cannot store a file that says `real`. This is a rule about the label, not the contents: the server cannot tell whether a file labeled `self-test` or `synthetic` really holds made-up data. That is a trust boundary: whoever holds a write key is trusted, and the app only sends residents the tester marked. The service no longer runs as the database owner: it runs as `cmai_app`, which can read and add rows but cannot alter or drop tables or triggers, and cannot update, delete or truncate the audit log. Whoever holds the owner password (`.env`) can still change anything, and an existing volume does not pick up a changed `CHECK` (no numbered migrations). The app is blocked too (`realExports`, G1).
- **Self-test data stays on the desktop.** It lives in the Docker volume on Devin-Desktop. It never goes to GitHub, CI, fixtures or an AI chat. The smoke script and CI use only made-up records the script creates itself; a real self-test log is never copied into the repo. `.checks/` and `server/.env` are ignored by git.
- **Nothing the sender wrote goes into the audit log.** Refusals use fixed wording, and audit text is cut at 200 characters, so a refused file's content cannot be stored there.

### Assumed picks (each "assumed, sign-off pending")

1. **`self-test` as a value of `data_class`.** The contract allows only `synthetic` and `real`. The server checks a self-test file as if it said `synthetic` and stores and returns the true label, so **a self-test pull is not a valid v1.0.0 file** until the schema gains the value. The lab's Python reader now accepts `self-test`, and refuses to merge files of different data classes (it did not before; it checked only participants). `self-test` is now also in the v1.1.0 draft enum (note 024).
2. **Zone for the day range.** The app's export uses the phone's zone; the server uses `tz`, defaulting to `DEFAULT_TZ` (America/New_York). Same local-day method as `src/data/researchExport.ts`, copied to `server/src/dates.mjs` because that file imports the phone database. A unit test covers both clock changes and a zone with no midnight; nothing yet compares the copy to the original on the same inputs (watch item).
3. **Header on a pull.** `device_id` and `app_version` come from the most recently received push for the matching records; an empty pull gets the all-zero ID and `0.0.0`.
4. **A write key is not tied to one participant or device.** Note 020 imagined one key per install; any write key can push for any participant in its class. Fine for one tester; revisit before more than one phone.

## What stays unexposed

- The sync port is published on `127.0.0.1` only. Nothing on the LAN or the internet can reach it. Changing `BIND_ADDR` is a decision for Devin, asked each time.
- **A phone cannot reach it yet, and the reason is not only the port.** The deployed app is served over HTTPS (GitHub Pages), and a browser blocks calls from an HTTPS page to a plain `http://` address (mixed content). A plain-HTTP LAN address would also send the write key unencrypted. PR 2 needs an HTTPS route first: a Tailscale HTTPS address (the tailnet already exists for the sensor dashboard) or a small reverse proxy. That choice is made before PR 2, not after.
- No admin web page. Keys are made inside the container.
- Requests without a valid key are limited to 30 a minute per address, so a page open on the machine cannot fill the audit log; a pull is limited to 800 days. There is no limit for requests with a valid key.

## Moving to an ODU server

**This does not pass the kill rule as first worded.** The compose file builds the service from this repository, so the ODU host needs a checkout of `server/` and the contract schema, a build, and access to the npm and Docker registries. Two honest options: (a) accept "a repo checkout plus `.env` plus one command" as the move (assumed pick, this is what the steps below say), or (b) publish an image and have compose reference it, so the move really is the compose file and a settings change. Devin's call.

Steps for (a): copy `server/` and `docs/contracts/cmai-export/cmai-export.schema.json` (kept at the same relative path), write a new `.env`, run `docker compose -f server/compose.yaml up -d --build`. Nothing refers to the desktop: no host paths, no machine names, the database is found by service name.

**Data does not move by itself.** Keys, stored logs and the audit trail live in the database volume. Moving them needs `pg_dump` and `pg_restore`; moving the code does not. Changing `POSTGRES_PASSWORD` after the first start does nothing, because the volume keeps the first one.

Not covered, to settle with whoever runs the ODU server: TLS, volume backups, who holds the read key, retention, and numbered migrations.

## Not built here (the app side is note 024; the rest are separate decisions)

- The app's send: a settings switch (off by default), a send queue with retry, the CSP `connect-src` change (T6), the self-test flag on a resident, keys held on the phone. A permanent refusal (409, 422) must stop retrying; that needs the error replies to carry the CORS headers (they now do when `ALLOWED_ORIGIN` is set).
- `self-test` in the v1.1.0 draft enum.
- The HTTPS route (above).
- The 7:15 task calling the endpoint (needs a read key in a file only Devin's account can read, and the `since` cursor saved between runs).
- Removing a participant's test data (no delete path yet; the smoke script leaves a new made-up participant each run).

## Reviews

**1. Fable 5.2 (a second Claude model), 2026-11-17, at Devin's request.** Found a pull-model gap, a push race, audit gaps, contract checks the server lacked, a date bug and a reader gap. Three findings were re-checked against the code before any change. All fixed in this PR except what is written above as open.

**2. Codex (OpenAI, run by Devin through `second-opinion.mjs`), 2026-11-17.** 13 findings on this server and the app side. Each was checked against the code.

- **Fixed here:**
  - The incremental-pull cursor can no longer be outrun. A push's statement, lock and idle times are capped at 30 s, well inside the 5-minute margin, so a push cannot commit later than the margin allows.
  - The service now runs without owner rights, so the audit trail is append-only against the service itself.
  - Wrong-method requests are audited, unauthenticated requests are rate-limited, and a pull is capped at 800 days.
  - Replies sent before a body was read no longer cut the sender off.
  - An admin `data:delete` lets a tester start over.
- **Not changed, and why:**
  - CORS for GET: a browser never pulls; the lab task is not a browser.
  - The service listening on all container interfaces: it must, for the published port, and the only other container on the network is the database.
  - Resending the identical file after a failed try: the server ignores repeats by content, so a new `export_id` is harmless.
  - Real data being "impossible": it is a trust boundary, now worded as one.
- **Open, from this review:** a record whose exported role or time zone changes after it was sent is refused with 409 for its unchanged revision. The export reads the caregiver's current role, and the phone's current zone for logs made before F-58. The way out is `data:delete` for that participant and "Send everything again" in the app. A real fix needs the role and zone saved on each log (a database version), which is a separate decision (F-58).

Note 024 has the app-side findings.

## Open questions for Dr. Gupta (register P-15)

1. Does Devin testing the app on himself, with his own logs, count as participant data (IRB, P-03)? Assumed: no, it is lab-tool testing. Until he answers, self-test data never leaves the desktop.
2. Is a lab-run store on a lab desktop acceptable for made-up data while the real store (P-13) is decided?
