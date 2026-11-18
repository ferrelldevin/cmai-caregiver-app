// End-to-end check against a running server, with made-up data only. Prints each step so you can
// watch it happen. Run from the repo root (see docs/design/notes/023-self-hosted-sync.md):
//   WRITE_KEY=... READ_KEY=... node server/smoke.mjs [http://127.0.0.1:8787] [out-folder]
// Optional: give an out-folder and it saves the three pulled files there for the Python reader.
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const BASE = process.argv[2] ?? "http://127.0.0.1:8787";
const OUT = process.argv[3];
const { WRITE_KEY, READ_KEY } = process.env;
if (!WRITE_KEY || !READ_KEY) throw new Error("Set WRITE_KEY and READ_KEY (self-test keys).");

let failed = 0;
const step = (ok, text) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${text}`);
  if (!ok) failed++;
};
const call = async (method, path, key, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};

// Made-up: a new participant code each run (so it can be re-run), three logs on 2026-11-02 (New York time, UTC-5 after the clock change).
const PARTICIPANT = `P-T${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
const DEVICE = randomUUID();
const record = (n, at, extra = {}) => ({
  record_id: randomUUID(),
  revision: 1,
  status: "active",
  participant_id: PARTICIPANT,
  device_id: DEVICE,
  logger_role: "researcher",
  occurred_start_utc: at,
  occurred_end_utc: null,
  utc_offset_min: -300,
  tz_name: "America/New_York",
  logged_at_utc: at,
  revised_at_utc: at,
  cmai_item: n,
  frequency: null,
  rating_scale: "none",
  reviewed: false,
  ...extra,
});
const file = (records) => ({
  schema_version: "1.0.0",
  header: {
    export_id: randomUUID(),
    exported_at_utc: "2026-11-03T12:00:00Z",
    app_version: "0.3.0",
    device_id: DEVICE,
    participant_id: PARTICIPANT,
    data_class: "self-test",
    range_start_utc: "2026-11-02T05:00:00Z",
    range_end_utc: "2026-11-03T05:00:00Z",
    record_count: records.length,
  },
  records,
});
const a = record(3, "2026-11-02T14:05:00Z");
const b = record(7, "2026-11-02T15:20:00Z");
const c = record(12, "2026-11-02T18:40:00Z");
const query = `/v1/export?participant=${PARTICIPANT}&from=2026-11-02&to=2026-11-02`;
const save = (name, doc) => {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${name}`, JSON.stringify(doc, null, 2) + "\n");
};

console.log(`Server: ${BASE}\n`);
step((await call("GET", "/healthz")).status === 200, "server is up");

console.log("\n1. Send three logs, then send the same file again");
let r = await call("POST", "/v1/logs", WRITE_KEY, file([a, b, c]));
step(r.status === 200 && r.json.added === 3, `first send added 3 (${JSON.stringify(r.json)})`);
r = await call("POST", "/v1/logs", WRITE_KEY, file([a, b, c]));
step(
  r.status === 200 && r.json.added === 0 && r.json.duplicate === 3,
  `second send added 0, 3 already had (${JSON.stringify(r.json)})`,
);

console.log("\n2. Pull the day twice: same records both times");
const p1 = await call("GET", query, READ_KEY);
const p2 = await call("GET", query, READ_KEY);
save("pull-1.json", p1.json);
step(p1.status === 200 && p1.json.records.length === 3, "pull 1 has 3 records");
step(isDeepStrictEqual(p1.json.records, p2.json.records), "pull 2 has exactly the same records");
step(p1.json.header.export_id !== p2.json.header.export_id, "each pull is its own file (new export_id)");
step(p1.json.header.data_class === "self-test", "the file says self-test");

console.log("\n3. Edit one log (revision 2) and delete another, then pull again");
const a2 = { ...a, revision: 2, cmai_item: 4, revised_at_utc: "2026-11-02T16:00:00Z" };
const b2 = { ...b, revision: 2, status: "deleted", revised_at_utc: "2026-11-02T16:05:00Z" };
r = await call("POST", "/v1/logs", WRITE_KEY, file([a2, b2]));
step(r.status === 200 && r.json.added === 2, "edit and delete accepted as revision 2");
const p3 = await call("GET", query, READ_KEY);
save("pull-2.json", p3.json);
const byId = Object.fromEntries(p3.json.records.map((x) => [x.record_id, x]));
step(p3.json.records.length === 3, "still 3 records (no duplicates)");
step(byId[a.record_id].revision === 2 && byId[a.record_id].cmai_item === 4, "the edited log arrives as revision 2");
step(
  byId[b.record_id].revision === 2 && byId[b.record_id].status === "deleted",
  "the deleted log arrives as a revision 2 tombstone",
);
step(byId[c.record_id].revision === 1, "the untouched log is still revision 1");

console.log("\n3b. A late change on an old day, and only-what-changed pulls (the 7:15 task's way)");
const cursor = new Date().toISOString();
await new Promise((done) => setTimeout(done, 50));
const c2 = { ...c, revision: 2, cmai_item: 13, revised_at_utc: "2026-11-02T19:00:00Z" };
r = await call("POST", "/v1/logs", WRITE_KEY, file([c2]));
step(r.status === 200 && r.json.added === 1, "a later edit of one log is accepted");
const wide = `/v1/export?participant=${PARTICIPANT}&from=2026-11-01&to=2026-11-30`;
const changed = await call("GET", `${wide}&since=${cursor}`, READ_KEY);
step(
  changed.json.records.length === 1 &&
    changed.json.records[0].record_id === c.record_id &&
    changed.json.records[0].revision === 2,
  "pulling since the cursor returns just that one log, as revision 2",
);
const later = new Date(Date.now() + 60_000).toISOString();
const quiet = await call("GET", `${wide}&since=${later}`, READ_KEY);
step(quiet.status === 200 && quiet.json.records.length === 0, "pulling since a later time returns nothing");
const withNext = await fetch(BASE + wide, { headers: { authorization: `Bearer ${READ_KEY}` } });
step(
  Boolean(Date.parse(withNext.headers.get("x-cmai-next-since"))),
  "each pull says where the next since should start",
);
// An edit that moves a log to the next day: the old day must still hear about it.
const d1 = record(8, "2026-11-02T20:30:00Z");
await call("POST", "/v1/logs", WRITE_KEY, file([d1]));
const d2 = { ...d1, revision: 2, occurred_start_utc: "2026-11-03T14:00:00Z", revised_at_utc: "2026-11-03T14:05:00Z" };
r = await call("POST", "/v1/logs", WRITE_KEY, file([d2]));
step(r.status === 200, "an edit that moves a log to the next day is accepted");
const oldDay = await call("GET", query, READ_KEY);
step(
  oldDay.json.records.some((x) => x.record_id === d1.record_id && x.revision === 2),
  "the old day's pull still returns it, as revision 2, so the reader replaces the old copy",
);

console.log("\n4. Things that must be refused");
r = await call("POST", "/v1/logs", WRITE_KEY, file([{ ...a, cmai_item: 9 }]));
step(r.status === 409, "same revision, different content: 409, nothing saved");
r = await call("POST", "/v1/logs", WRITE_KEY, {
  ...file([record(5, "2026-11-02T20:00:00Z")]),
  header: { ...file([]).header, data_class: "real", record_count: 1 },
});
step(r.status === 422, "a file that says real: refused");
r = await call("POST", "/v1/logs", WRITE_KEY, { ...file([a]), extra: 1 });
step(r.status === 422, "a file that breaks the contract: refused");
r = await call("POST", "/v1/logs", READ_KEY, file([a]));
step(r.status === 403, "a read key cannot send");
r = await call("GET", query, WRITE_KEY);
step(r.status === 403, "a write key cannot read");
r = await call("GET", query, "cmai_read_notarealkeynotarealkey");
step(r.status === 401, "an unknown key: 401");
r = await call("GET", query);
step(r.status === 401, "no key: 401");
r = await call("GET", `/v1/export?participant=${PARTICIPANT}&from=2026-11-05&to=2026-11-02`, READ_KEY);
step(r.status === 400, "a range that runs backwards: 400");
r = await call("GET", `/v1/export?participant=${PARTICIPANT}&from=2026-11-02&to=2026-02-31`, READ_KEY);
step(r.status === 400, "an end date that does not exist (2026-02-31): 400, not silently March");
r = await call("GET", `${query}&since=yesterday`, READ_KEY);
step(r.status === 400, "a since that is not a time: 400");
r = await call("POST", "/v1/logs", WRITE_KEY, file([{ ...record(5, "2026-11-02T21:00:00Z"), utc_offset_min: -240 }]));
step(r.status === 422, "an offset that does not match the zone (the lab reader would stop on it): refused");
const moved = file([{ ...a, participant_id: "P-OTHER" }]);
moved.header.participant_id = "P-OTHER";
r = await call("POST", "/v1/logs", WRITE_KEY, moved);
step(r.status === 409, "a record already stored for another participant: 409");
r = await call("PUT", "/v1/logs", WRITE_KEY, file([a]));
step(r.status === 405, "the wrong method: 405");
r = await call("GET", `/v1/export?participant=${PARTICIPANT}&from=2020-01-01&to=2026-12-31`, READ_KEY);
step(r.status === 400, "a range of more than 800 days: 400");
const p4 = await call("GET", `/v1/export?participant=P-NOBODY&from=2026-11-02&to=2026-11-02`, READ_KEY);
step(p4.status === 200 && p4.json.records.length === 0, "an unknown participant: an empty file, not an error");
save("pull-empty.json", p4.json);
// Last: the refused 6 MB upload leaves its connection unusable, so nothing may follow it.
const big = await fetch(BASE + "/v1/logs", {
  method: "POST",
  headers: { authorization: `Bearer ${WRITE_KEY}`, "content-type": "application/json" },
  body: JSON.stringify({ pad: "x".repeat(6 * 1024 * 1024) }),
}).catch(() => null);
step(big === null || big.status === 413, "a 6 MB body: refused (413, or the connection is cut)");

console.log(
  failed
    ? `\n${failed} check(s) FAILED`
    : "\nAll checks passed. Look at the audit trail:\n  docker compose -f server/compose.yaml exec sync node src/admin.mjs audit 30",
);
process.exit(failed ? 1 : 0);
