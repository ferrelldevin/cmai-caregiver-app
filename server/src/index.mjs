// The sync service. Three routes:
//   POST /v1/logs    a write key sends one v1.0.0 file
//   GET  /v1/export  a read key gets one participant and date range back as a v1.0.0 file
//                    (add &since=<time> for only the records changed after that time)
//   GET  /healthz    is it up, and can it reach the database
// Every push and pull that carries a key, allowed or refused, is written to audit_log, and so is
// every request without a valid key (denied) and every server error.
import { createServer } from "node:http";
import { audit, pool, setup } from "./db.mjs";
import { findKey } from "./keys.mjs";
import { problemWith } from "./contract.mjs";
import { localDayStart, validZone } from "./dates.mjs";
import { makeLimiter } from "./limit.mjs";
import { pullFile, pushFile, Refused } from "./store.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const DEFAULT_TZ = process.env.DEFAULT_TZ ?? "America/New_York";
const ORIGIN = process.env.ALLOWED_ORIGIN || "";
const MAX_BODY = 5 * 1024 * 1024;
const PARTICIPANT = /^[A-Z]{1,5}(-[A-Z0-9]{1,12})+$/;
const MAX_RANGE_DAYS = 800; // a pull returns every record in range; keep one answer a sensible size
const unauthenticated = makeLimiter(30, 60_000); // requests without a valid key, per address, per minute
const SINCE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
/** `next-since` is backdated by this much so a push that was still committing during a pull is never missed. */
const SINCE_MARGIN_MS = 5 * 60_000;

if (!validZone(DEFAULT_TZ))
  throw new Error(`DEFAULT_TZ "${DEFAULT_TZ}" is not a time zone name like America/New_York.`);

const corsFor = () =>
  ORIGIN
    ? {
        "access-control-allow-origin": ORIGIN,
        "access-control-allow-headers": "authorization, content-type",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-expose-headers": "x-cmai-next-since",
        vary: "origin",
      }
    : {};

const send = (res, status, body, extra = {}) => {
  const text = typeof body === "string" ? body : JSON.stringify(body, null, 2) + "\n";
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...corsFor(), ...extra });
  res.end(text);
};

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new Refused(413, "That file is too large.");
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function push(req, res, key, remoteAddr) {
  const base = { keyId: key.id, action: "push", dataClass: key.data_class, remoteAddr };
  if (req.method !== "POST") {
    await audit({ ...base, outcome: "denied", detail: "wrong method" });
    return send(res, 405, { error: "Use POST." });
  }
  let doc;
  try {
    doc = JSON.parse(await readBody(req));
  } catch (e) {
    const detail = e instanceof Refused ? e.message : "not JSON";
    await audit({ ...base, outcome: "refused", detail });
    return send(res, e instanceof Refused ? e.status : 400, {
      error: e instanceof Refused ? e.message : "The body is not JSON.",
    });
  }
  const h = doc?.header ?? {};
  base.participantId = PARTICIPANT.test(h.participant_id) ? h.participant_id : null;
  const problem = problemWith(doc, key.data_class);
  if (problem) {
    await audit({ ...base, outcome: "refused", detail: problem });
    return send(res, 422, { error: problem });
  }
  const range = { rangeStart: h.range_start_utc, rangeEnd: h.range_end_utc };
  try {
    const counts = await pushFile(doc, key, { ...base, ...range, outcome: "ok", count: doc.records.length });
    return send(res, 200, { ok: true, ...counts });
  } catch (e) {
    if (e instanceof Refused) await audit({ ...base, ...range, outcome: "refused", detail: e.message });
    throw e;
  }
}

async function pull(req, res, key, url, remoteAddr) {
  if (req.method !== "GET") {
    await audit({
      keyId: key.id,
      action: "pull",
      dataClass: key.data_class,
      outcome: "denied",
      detail: "wrong method",
      remoteAddr,
    });
    return send(res, 405, { error: "Use GET." });
  }
  const participantId = url.searchParams.get("participant") ?? "";
  const tz = url.searchParams.get("tz") ?? DEFAULT_TZ;
  const zoneOk = validZone(tz);
  const start = zoneOk && localDayStart(tz, url.searchParams.get("from"));
  const end = zoneOk && localDayStart(tz, url.searchParams.get("to"), 1);
  const sinceText = url.searchParams.get("since");
  const since = sinceText === null ? null : new Date(sinceText);
  const sinceBad = since !== null && (!SINCE.test(sinceText) || Number.isNaN(since.getTime()));
  const base = {
    keyId: key.id,
    action: "pull",
    dataClass: key.data_class,
    participantId: PARTICIPANT.test(participantId) ? participantId : null,
    remoteAddr,
  };
  if (
    !PARTICIPANT.test(participantId) ||
    !start ||
    !end ||
    start >= end ||
    sinceBad ||
    end - start > MAX_RANGE_DAYS * 86_400_000
  ) {
    const problem =
      "Use ?participant=P-01&from=YYYY-MM-DD&to=YYYY-MM-DD (optionally &tz=America/New_York and &since=2026-11-17T12:00:00Z). The dates must be real, the last day cannot be before the first, and the range can be at most 800 days.";
    await audit({ ...base, outcome: "refused", detail: problem });
    return send(res, 400, { error: problem });
  }
  const asked = new Date();
  const doc = await pullFile({ dataClass: key.data_class, participantId, start, end, since });
  await audit({
    ...base,
    rangeStart: start,
    rangeEnd: end,
    outcome: "ok",
    count: doc.records.length,
    detail: since ? `changed since ${since.toISOString()}` : null,
  });
  const name = `cmai-export_${participantId}_${url.searchParams.get("from")}_${url.searchParams.get("to")}.json`;
  return send(res, 200, doc, {
    "content-disposition": `attachment; filename="${name}"`,
    "x-cmai-next-since": new Date(asked.getTime() - SINCE_MARGIN_MS).toISOString(),
  });
}

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const remoteAddr = req.socket.remoteAddress ?? null;
  // A browser's permission check before a push. It carries no key and touches no data, so it is answered and not audited.
  if (req.method === "OPTIONS") return send(res, 204, "");
  if (url.pathname === "/healthz") {
    await pool.query("SELECT 1");
    return send(res, 200, { ok: true });
  }

  const route = url.pathname === "/v1/logs" ? "push" : url.pathname === "/v1/export" ? "pull" : null;
  if (!route) return send(res, 404, { error: "Not found." });
  const key = await findKey(req.headers.authorization);
  if (!key) {
    // Without a limit, anything that can reach the port could make the service write an audit row per request.
    const turn = unauthenticated(remoteAddr ?? "unknown");
    if (turn.ok) await audit({ action: route, outcome: "denied", detail: "no valid key", remoteAddr });
    else if (turn.first)
      await audit({
        action: route,
        outcome: "denied",
        detail: "too many requests without a key; the rest this minute are not logged",
        remoteAddr,
      });
    return turn.ok
      ? send(res, 401, { error: "A valid key is needed." })
      : send(res, 429, { error: "Too many requests." });
  }
  if ((route === "push") !== (key.role === "write")) {
    await audit({
      keyId: key.id,
      action: route,
      dataClass: key.data_class,
      outcome: "denied",
      detail: `a ${key.role} key cannot ${route}`,
      remoteAddr,
    });
    return send(res, 403, { error: `A ${key.role} key cannot do that.` });
  }
  req.keyContext = { key, route, remoteAddr };
  return route === "push" ? push(req, res, key, remoteAddr) : pull(req, res, key, url, remoteAddr);
}

await setup();
createServer((req, res) => {
  // A reply sent before the body was read (wrong method, bad key) must not leave the sender writing into a closed connection.
  res.on("finish", () => req.resume());
  handle(req, res).catch(async (e) => {
    if (e instanceof Refused) return send(res, e.status, { error: e.message });
    console.error(e);
    const ctx = req.keyContext;
    // Best effort: the database may be the thing that failed.
    await audit({
      keyId: ctx?.key.id,
      action: ctx?.route ?? "request",
      dataClass: ctx?.key.data_class,
      outcome: "error",
      detail: "server error",
      remoteAddr: ctx?.remoteAddr,
    }).catch(() => {});
    if (!res.headersSent) send(res, 500, { error: "Something went wrong on the server. Nothing was saved." });
  });
}).listen(PORT, () => console.log(`cmai-sync listening on ${PORT}`));
