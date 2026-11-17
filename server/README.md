# CMAI sync server

A small server the app can send logs to and the lab's daily task can read from. Design: [note 023](../docs/design/notes/023-self-hosted-sync.md). Made-up and self-test data only. Real data is refused.

Every command says where it runs. Run them from the repo root.

## Start it (PowerShell or Git Bash, on the machine that hosts it)

```bash
cp server/.env.example server/.env
```

Open `server/.env` and set `POSTGRES_PASSWORD` to a long random string. Then:

```bash
docker compose -f server/compose.yaml up -d --build
```

Check it: <http://127.0.0.1:8787/healthz> shows `{"ok": true}`.

## Make keys (inside the container)

```bash
docker compose -f server/compose.yaml exec sync node src/admin.mjs key:create --role write --class self-test --label "my phone"
docker compose -f server/compose.yaml exec sync node src/admin.mjs key:create --role read --class self-test --label "7:15 task"
```

The secret is printed once. Other commands: `key:list`, `key:revoke <id>`, `audit [count]`.

## Watch it work (Git Bash or PowerShell, repo root, Node 22)

```bash
WRITE_KEY=cmai_write_... READ_KEY=cmai_read_... node server/smoke.mjs http://127.0.0.1:8787
```

In PowerShell set the keys first: `$env:WRITE_KEY="..."; $env:READ_KEY="..."; node server/smoke.mjs`.

## Pull one participant and range by hand

```bash
curl -H "Authorization: Bearer cmai_read_..." "http://127.0.0.1:8787/v1/export?participant=P-01&from=2026-11-01&to=2026-11-14" -o pull.json
```

To get only what changed since the last run (what the daily task should do), add `&since=<time>`. Every pull sends an `x-cmai-next-since` header to use next time. See [note 023](../docs/design/notes/023-self-hosted-sync.md).

## Tests (any shell, repo root)

```bash
npm ci --prefix server
npm test --prefix server
```

## After a reboot

Both containers restart by themselves (`restart: unless-stopped`), but only once Docker Desktop is running. Turn on Docker Desktop > Settings > General > "Start Docker Desktop when you sign in".

## Stop and clean up

```bash
docker compose -f server/compose.yaml down
```

Add `-v` to also delete the database volume (this erases all stored logs and the audit trail).
