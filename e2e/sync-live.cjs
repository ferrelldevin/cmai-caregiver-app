// The whole path with nothing pretended (F-62, design note 024): the lab build in a real browser, the
// real sync server and database in Docker, made-up data only. Not part of `npm run checks` because it
// needs Docker and the server running; run it by hand on the machine that hosts the server.
//
// What it does, and checks: a new resident is marked self-test and its first log is sent; the server is
// STOPPED, a second log is made and the app says it cannot send; the server is STARTED and the app
// sends by itself (no button) once its retry comes round; a third log is deleted with a reason and
// arrives as a revision-2 tombstone; the lab's Python reader merges the pulls; the audit log shows it.
//
// usage (repo root, Git Bash):
//   WRITE_KEY=cmai_write_... READ_KEY=cmai_read_... node e2e/sync-live.cjs http://127.0.0.1:4174/ OUTDIR
// The server must allow the page's origin (ALLOWED_ORIGIN=http://127.0.0.1:4174 in server/.env) and the
// page must be the lab build made with VITE_SYNC_ORIGIN=http://127.0.0.1:8787.
const { engine } = require("./browser.cjs");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const [URL, OUT] = process.argv.slice(2);
const { WRITE_KEY, READ_KEY } = process.env;
const SERVER = process.env.SERVER || "http://127.0.0.1:8787";
const ROOT = path.join(__dirname, "..");
const COMPOSE = ["compose", "-f", path.join(ROOT, "server", "compose.yaml")];
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
const say = (m) => console.log("\n" + m);
if (!URL || !OUT || !WRITE_KEY || !READ_KEY) throw new Error("usage: WRITE_KEY=... READ_KEY=... node e2e/sync-live.cjs URL OUTDIR");
fs.mkdirSync(OUT, { recursive: true });
const docker = (...args) => spawnSync("docker", [...COMPOSE, ...args], { cwd: ROOT, encoding: "utf8" });
const CODE = "P-" + Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 4).toUpperCase().padEnd(4, "X");
const day = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const pull = async (name) => {
  const q = `participant=${CODE}&from=${day(Date.now() - 86_400_000)}&to=${day(Date.now() + 86_400_000)}`;
  const res = await fetch(`${SERVER}/v1/export?${q}`, { headers: { authorization: `Bearer ${READ_KEY}` } });
  const doc = await res.json();
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(doc, null, 2) + "\n");
  return { res, doc };
};
async function waitFor(fn, what, seconds) {
  for (let i = 0; i < seconds * 2; i++) { if (await fn()) return; await new Promise((r) => setTimeout(r, 500)); }
  throw new Error(`FAIL: timed out after ${seconds} s waiting for ${what}`);
}

(async () => {
  ok((await fetch(`${SERVER}/healthz`)).ok, `the server is up at ${SERVER}`);
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  // The page's own security policy stays on: it is part of the path being checked.
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const state = () => p.locator("[data-sync-state]").innerText();
  const log = async (name) => {
    await p.goto(URL.replace(/\/?$/, "/") + "#/log");
    await p.getByRole("tabpanel").getByRole("button", { name }).click();
    await p.locator(".snackbar").waitFor();
  };
  const toCard = async () => {
    await p.goto(URL.replace(/\/?$/, "/") + "#/data/backup");
    await p.getByRole("heading", { name: "Send to the lab server" }).waitFor();
  };
  const turnOn = async (sw) => { await sw.click(); await waitFor(() => sw.isChecked(), "a switch to turn on", 5); };

  say(`1. A made-up resident ${CODE}, marked self-test, first log sent`);
  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill(CODE); await p.keyboard.press("Enter");
  await p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ }).click(); await p.locator(".snackbar").waitFor();
  await toCard();
  ok(!(await p.getByRole("switch", { name: "Send logs to the lab server" }).isChecked()), "the send switch starts off");
  await turnOn(p.getByRole("switch", { name: `${CODE} is self-test` }));
  await p.getByLabel("Server key").fill(WRITE_KEY);
  await p.getByRole("button", { name: "Save key" }).click();
  await turnOn(p.getByRole("switch", { name: "Send logs to the lab server" }));
  await waitFor(async () => /Up to date/.test(await state()), "the first send", 20);
  let { doc } = await pull("pull-1.json");
  ok(doc.header.data_class === "self-test" && doc.records.length === 1, "the server holds exactly that one log, labeled self-test");

  say("2. The server is stopped; a second log is made; the app says it cannot send");
  ok(docker("stop", "sync").status === 0, "the sync container is stopped");
  await log(/^Hitting/);
  await toCard();
  await p.getByRole("button", { name: "Send now" }).click();
  await waitFor(async () => /cannot be reached/.test(await state()), "the app to notice", 20);
  ok(/1 not sent yet/.test(await state()), "it counts the log it could not send: " + (await state()).replace(/\s+/g, " "));
  await p.screenshot({ path: path.join(OUT, "sync-waiting.png") });

  say("3. The server is started; the app sends by itself (no button)");
  ok(docker("start", "sync").status === 0, "the sync container is started");
  await waitFor(async () => (await fetch(`${SERVER}/healthz`).catch(() => ({ ok: false }))).ok, "the server to answer", 40);
  await waitFor(async () => /Up to date/.test(await state()), "the app's own retry (up to 90 s)", 120);
  ({ doc } = await pull("pull-2.json"));
  ok(doc.records.length === 2, "the server now holds both logs");
  await p.screenshot({ path: path.join(OUT, "sync-ok.png") });

  say("4. A third log is deleted with a reason; it arrives as a revision-2 tombstone");
  await p.goto(URL.replace(/\/?$/, "/") + "#/log");
  await p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ }).click(); await p.locator(".snackbar").waitFor();
  await p.locator(".snackbar").getByRole("button", { name: "Edit" }).click();
  const sheet = p.locator(".log-sheet");
  await sheet.getByRole("button", { name: "Delete log" }).click();
  await sheet.getByRole("button", { name: "Other" }).click();
  await sheet.getByRole("button", { name: "Delete log" }).click();
  await p.locator(".snackbar").waitFor();
  await toCard();
  await p.getByRole("button", { name: "Send now" }).click();
  await waitFor(async () => (await pull("pull-3.json")).doc.records.some((r) => r.status === "deleted"), "the tombstone to arrive", 20);
  ({ doc } = await pull("pull-3.json"));
  const dead = doc.records.filter((r) => r.status === "deleted");
  ok(doc.records.length === 3 && dead.length === 1 && dead[0].revision === 2, "three records, one of them a deleted revision-2 record");
  const again = (await pull("pull-3b.json")).doc;
  ok(JSON.stringify(again.records) === JSON.stringify(doc.records), "pulling again returns exactly the same records");
  const changed = await fetch(`${SERVER}/v1/export?participant=${CODE}&from=${day(Date.now() - 86_400_000)}&to=${day(Date.now() + 86_400_000)}&since=${new Date(Date.now() - 3_600_000).toISOString()}`, { headers: { authorization: `Bearer ${READ_KEY}` } });
  ok(changed.ok && Boolean(changed.headers.get("x-cmai-next-since")), "the changed-since pull works and returns the next cursor");

  say("5. The lab's own reader merges the pulls");
  const read = spawnSync("python3", [path.join(ROOT, "docs/contracts/cmai-export/cmai_export_check.py"), path.join(OUT, "pull-1.json"), path.join(OUT, "pull-2.json"), path.join(OUT, "pull-3.json"), "--participant", CODE, "--data-class", "self-test"], { encoding: "utf8" });
  console.log("  " + (read.stdout || read.stderr).trim());
  ok(read.status === 0 && /2 active record/.test(read.stdout), "the reader accepts all three pulls and ends with 2 active records (the deleted one is gone)");

  say("6. The audit log");
  const audit = docker("exec", "-T", "sync", "node", "src/admin.mjs", "audit", "40").stdout;
  ok(/'push'/.test(audit) && /'pull'/.test(audit) && audit.includes(`'${CODE}'`), "the audit log has this resident's pushes and pulls");
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await b.close();
  console.log(`\nAll live checks passed for ${CODE}. Files: ${OUT}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
