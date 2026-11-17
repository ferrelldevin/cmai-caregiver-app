# 023. A self-hosted sync server on Devin's desktop, for testing the whole pipeline (F-62)

2026-11-17 · Register: F-62, P-15 (new) · Status: server built, app side not yet (PR 2) · Follows design note 020 (option C, run by Devin instead of waiting for a lab server) · Real data stays blocked (G1)

## Why

Note 020 found that logs live only on the phone, so a daily pull has nothing to pull from, and named a lab server as the real answer. That server does not exist yet. Devin approved running a small one in Docker on Devin-Desktop so he can test every step himself (phone or browser, then the server, then the lab's 7:15 task), and so the same files can move to an ODU server later.

## What was built

One compose file in `server/`, two containers, all settings by environment variable.

| Part               | What it is                                                            | Notes                                                                                             |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `db`               | PostgreSQL 17                                                         | No published port. Only the sync service can reach it. Data in a named volume (no host path)      |
| `sync`             | Node 22, one small service (`pg` and `ajv` are its only dependencies) | `POST /v1/logs`, `GET /v1/export`, `GET /healthz`                                                 |
| Keys               | Random secrets, stored only as a SHA-256 hash                         | Role `write` or `read`, a data class, revocable. Made and revoked with `server/src/admin.mjs`     |
| Audit              | `audit_log` table, append-only (a trigger refuses UPDATE and DELETE)  | Every push and pull, allowed or refused: when, which key, which participant, which range, outcome |
| `server/smoke.mjs` | 21 checks against a running server, made-up data only                 | Prints each step so it can be watched                                                             |

Only the push and pull rules are described here; the file is in `server/src/`.

### The three routes

- `POST /v1/logs` with a **write** key: one v1.0.0 file, checked against the contract's own schema (`docs/contracts/cmai-export/cmai-export.schema.json`, copied into the image) plus two cross-checks (record count, one participant). All or nothing.
- `GET /v1/export?participant=P-01&from=2026-11-01&to=2026-11-14[&tz=America/New_York]` with a **read** key: the newest revision of every record for that participant whose start falls in the local days, as a v1.0.0 file. Deleted records come back as `status: "deleted"` tombstones, as in the app's export. The default zone is `DEFAULT_TZ`.
- `GET /healthz`: up or not.

### Merge rules (the "done when" from note 020)

| Case                                          | Result                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| Same file sent twice                          | The second send adds nothing (`added: 0, duplicate: N`)                |
| Same pull twice                               | Same records; only the file's `export_id` and `exported_at_utc` differ |
| A log edited or deleted, then sent            | Stored as revision 2; the next pull returns revision 2                 |
| Same `record_id` and revision, other content  | Refused (409), nothing saved                                           |
| A record seen under another participant/class | Refused (409)                                                          |

Checked on 2026-11-17 on made-up data: `server/smoke.mjs` passes 21 of 21, and the lab's own reader (`cmai_export_check.py`) merges the pulled files: the edit wins as revision 2, the deleted log drops out, and merging a pull a third time changes nothing.

## Data classes

Three classes, kept apart at every step: `synthetic` (made-up demo data), `self-test` (Devin's own logs from using the app) and `real` (a participant). The class is part of the key, not a switch the sender flips.

- A key has one class. A push whose file says another class is refused. A read key returns only its own class.
- **`real` has no key class at all.** The database refuses it (`CHECK`), so even a bug cannot store it. The app is blocked too (`realExports`, G1). One pull request, after Dr. Gupta's written answer, would change both.
- **Self-test data stays on the desktop.** It lives in the Docker volume on Devin-Desktop. It never goes to GitHub, CI, fixtures or an AI chat. The smoke script uses only made-up records it creates itself; a real self-test log is never copied into the repo. `.checks/` and `server/.env` are ignored by git.

### Assumed picks (each "assumed, sign-off pending")

1. **`self-test` as a value of `data_class`.** The contract allows only `synthetic` and `real`. The server checks a self-test file as if it said `synthetic` and stores and returns the true label. The lab's Python reader now accepts `self-test` (one line, plus the `--data-class` choice), and still refuses to merge it with another class. The v1.1.0 draft is not changed here; adding `self-test` to its enum is PR 2.
2. **Zone for the day range.** The app's export uses the phone's zone; the server uses `tz`, defaulting to `DEFAULT_TZ` (America/New_York). Same local-day method as `src/data/researchExport.ts`, copied to `server/src/dates.mjs` because that file imports the phone database. The test suite does not cover the copy yet (watch item).
3. **Header on a pull.** `device_id` and `app_version` come from the most recently received push for the matching records; an empty pull gets the all-zero ID and `0.0.0`.

## What stays unexposed

- The sync port is published on `127.0.0.1` only. Nothing on the LAN or the internet can reach it. Changing `BIND_ADDR` is a decision for Devin, asked each time (a phone on the home network needs it for PR 2).
- No admin web page. Keys are made inside the container.
- No TLS. Fine on localhost. Anything past localhost needs HTTPS first (a reverse proxy on the ODU server).

## Moving to an ODU server

Copy `server/` and `docs/contracts/cmai-export/cmai-export.schema.json`, write a new `.env`, run `docker compose -f server/compose.yaml up -d --build`. Nothing refers to the desktop: no host paths, no machine names, database address by service name. Kill rule from Devin: if moving needs more than the compose file and a settings change, stop and tell him.

Not covered, to settle with whoever runs the ODU server: TLS, backups of the volume, who holds the read key, retention.

## Not built (PR 2, then separate decisions)

- The app's send: a settings switch (off by default), a send queue with retry, the CSP `connect-src` change (T6), the self-test flag on a resident, keys held on the phone.
- `self-test` in the v1.1.0 draft enum.
- The 7:15 task calling the endpoint (needs a read key in a file only Devin's account can read).
- A CI job that starts the stack and runs the smoke script.

## Open questions for Dr. Gupta (register P-15)

1. Does Devin testing the app on himself, with his own logs, count as participant data (IRB, P-03)? Assumed: no, it is lab-tool testing. Until he answers, self-test data never leaves the desktop.
2. Is a lab-run store on a lab desktop acceptable for made-up data while the real store (P-13) is decided?
