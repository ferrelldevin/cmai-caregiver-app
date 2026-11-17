// The sync service. Three routes:
//   POST /v1/logs    a write key sends one v1.0.0 file
//   GET  /v1/export  a read key gets one participant and date range back as a v1.0.0 file
//   GET  /healthz    is it up
// Every push and pull, allowed or refused, is written to audit_log.
import { createServer } from "node:http";
import { audit, setup } from "./db.mjs";
import { findKey } from "./keys.mjs";
import { problemWith } from "./contract.mjs";
import { localDayStart, validZone } from "./dates.mjs";
import { pullFile, pushFile, Refused } from "./store.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const DEFAULT_TZ = process.env.DEFAULT_TZ ?? "America/New_York";
const ORIGIN = process.env.ALLOWED_ORIGIN || "";
const MAX_BODY = 5 * 1024 * 1024;
const PARTICIPANT = /^[A-Z]{1,5}(-[A-Z0-9]{1,12})+$/;

const send = (res, status, body, extra = {}) => {
  const text = typeof body === "string" ? body : JSON.stringify(body, null, 2) + "\n";
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...extra });
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

async function push(req, res, key, cors) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." }, cors);
  let doc;
  try {
    doc = JSON.parse(await readBody(req));
  } catch (e) {
    if (e instanceof Refused) throw e;
    await audit({ keyId: key.id, action: "push", dataClass: key.data_class, outcome: "refused", detail: "not JSON" });
    return send(res, 400, { error: "The body is not JSON." }, cors);
  }
  const h = doc?.header ?? {};
  const base = {
    keyId: key.id,
    action: "push",
    dataClass: key.data_class,
    participantId: PARTICIPANT.test(h.participant_id) ? h.participant_id : null,
  };
  const problem = problemWith(doc, key.data_class);
  if (problem) {
    await audit({ ...base, outcome: "refused", detail: problem });
    return send(res, 422, { error: problem }, cors);
  }
  const range = { rangeStart: h.range_start_utc, rangeEnd: h.range_end_utc };
  try {
    const counts = await pushFile(doc, key);
    await audit({
      ...base,
      ...range,
      outcome: "ok",
      count: doc.records.length,
      detail: `added ${counts.added}, already had ${counts.duplicate}`,
    });
    return send(res, 200, { ok: true, ...counts }, cors);
  } catch (e) {
    if (e instanceof Refused) await audit({ ...base, ...range, outcome: "refused", detail: e.message });
    throw e;
  }
}

async function pull(req, res, key, url) {
  if (req.method !== "GET") return send(res, 405, { error: "Use GET." });
  const participantId = url.searchParams.get("participant") ?? "";
  const tz = url.searchParams.get("tz") ?? DEFAULT_TZ;
  const zoneOk = validZone(tz);
  const start = zoneOk && localDayStart(tz, url.searchParams.get("from"));
  const end = zoneOk && localDayStart(tz, url.searchParams.get("to"), 1);
  const base = {
    keyId: key.id,
    action: "pull",
    dataClass: key.data_class,
    participantId: PARTICIPANT.test(participantId) ? participantId : null,
  };
  if (!PARTICIPANT.test(participantId) || !start || !end || start >= end) {
    const problem =
      "Use ?participant=P-01&from=YYYY-MM-DD&to=YYYY-MM-DD (and optionally &tz=America/New_York). The last day cannot be before the first.";
    await audit({ ...base, outcome: "refused", detail: problem });
    return send(res, 400, { error: problem });
  }
  const doc = await pullFile({ dataClass: key.data_class, participantId, start, end });
  await audit({ ...base, rangeStart: start, rangeEnd: end, outcome: "ok", count: doc.records.length });
  const name = `cmai-export_${participantId}_${url.searchParams.get("from")}_${url.searchParams.get("to")}.json`;
  return send(res, 200, doc, { "content-disposition": `attachment; filename="${name}"` });
}

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const cors = ORIGIN
    ? {
        "access-control-allow-origin": ORIGIN,
        "access-control-allow-headers": "authorization, content-type",
        "access-control-allow-methods": "POST, OPTIONS",
        vary: "origin",
      }
    : {};
  if (req.method === "OPTIONS") return send(res, 204, "", cors);
  if (url.pathname === "/healthz") return send(res, 200, { ok: true });

  const route = url.pathname === "/v1/logs" ? "push" : url.pathname === "/v1/export" ? "pull" : null;
  if (!route) return send(res, 404, { error: "Not found." }, cors);
  const key = await findKey(req.headers.authorization);
  if (!key) {
    await audit({ action: route, outcome: "denied", detail: "no valid key" });
    return send(res, 401, { error: "A valid key is needed." }, cors);
  }
  if ((route === "push") !== (key.role === "write")) {
    await audit({
      keyId: key.id,
      action: route,
      dataClass: key.data_class,
      outcome: "denied",
      detail: `a ${key.role} key cannot ${route}`,
    });
    return send(res, 403, { error: `A ${key.role} key cannot do that.` }, cors);
  }
  return route === "push" ? push(req, res, key, cors) : pull(req, res, key, url);
}

await setup();
createServer((req, res) => {
  handle(req, res).catch((e) => {
    if (e instanceof Refused) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: "Something went wrong on the server. Nothing was saved." });
  });
}).listen(PORT, () => console.log(`cmai-sync listening on ${PORT}`));
