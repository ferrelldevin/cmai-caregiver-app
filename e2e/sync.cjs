// "Send to the lab server" (F-62, design notes 023 and 024) on the LAB build, with the server played by
// the test (Playwright answers the requests), so it runs anywhere. The same flow against the real
// Docker server is e2e/sync-live.cjs. Checks: the switch is off and nothing is sent until it is turned on
// with a key; a self-test resident is sent as one v1.0.0 file labeled self-test with the key; a server
// that is down is reported and recovered from; a "no" is shown in the server's words; the page's
// security policy allows exactly the one server and nothing else; the caregiver build allows none.
// usage: node e2e/sync.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab VITE_SYNC_ORIGIN=http://127.0.0.1:8787)
const { engine } = require("./browser.cjs");
const fs = require("fs");
const path = require("path");
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const [URL, OUT] = process.argv.slice(2);
const ORIGIN = "http://127.0.0.1:8787";
const KEY = "cmai_write_e2ekeye2ekeye2ekeye2ekey";
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "POST, OPTIONS" };
const csp = (file) => /connect-src ([^;"]*)/.exec(fs.readFileSync(path.join(__dirname, "..", file, "index.html"), "utf8"))?.[1];

(async () => {
  ok(csp("dist") === "'self'", "the caregiver build's page policy allows only itself: connect-src " + csp("dist"));
  ok(csp("dist-lab") === `'self' ${ORIGIN}`, "the lab build allows itself and exactly the one lab server: connect-src " + csp("dist-lab"));

  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  // No bypassCSP here: the page's own security policy is part of what is being checked.
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const seen = []; // what reached the pretend server
  let mode = "down"; // down | ok | no
  await ctx.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    seen.push({ auth: req.headers()["authorization"], body: JSON.parse(req.postData() || "{}") });
    if (mode === "down") return route.abort("connectionrefused");
    if (mode === "no") return route.fulfill({ status: 401, headers: cors, contentType: "application/json", body: JSON.stringify({ error: "A valid key is needed." }) });
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ ok: true, added: 1, duplicate: 0 }) });
  });
  const status = () => p.locator("[data-sync-state]").innerText();
  const settle = (ms = 700) => p.waitForTimeout(ms);
  // A switch saves to storage before it flips, so click it and wait for it to read "on".
  const turnOn = async (sw) => { await sw.click(); for (let i = 0; i < 50 && !(await sw.isChecked()); i++) await p.waitForTimeout(100); ok(await sw.isChecked(), "switch is on"); };

  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-07"); await p.keyboard.press("Enter");
  await p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ }).click(); await p.locator(".snackbar").waitFor();
  await p.goto(URL.replace(/\/?$/, "/") + "#/data/backup");
  await p.getByRole("heading", { name: "Send to the lab server" }).waitFor();
  const sw = p.getByRole("switch", { name: "Send logs to the lab server" });
  ok(!(await sw.isChecked()), "the send switch is off on a new phone");
  ok(/Not sending/.test(await status()) && seen.length === 0, "nothing is sent while the switch is off");

  await turnOn(p.getByRole("switch", { name: "P-07 is self-test" }));
  await turnOn(sw); await settle();
  ok(/Waiting for a key/.test(await status()) && seen.length === 0, "switch on but no key: it waits and sends nothing");
  await p.getByLabel("Server key").fill(KEY);
  await p.getByRole("button", { name: "Save key" }).click(); await settle();
  ok(seen.length === 1 && /cannot be reached/.test(await status()) && /1 not sent yet/.test(await status()), "server down: it says so and counts what is unsent");
  ok(seen[0].auth === `Bearer ${KEY}`, "the key goes in the Authorization header");
  ok(seen[0].body.header.data_class === "self-test" && seen[0].body.header.participant_id === "P-07" && seen[0].body.records.length === 1, "the file is P-07's export, labeled self-test, one record");
  ok(!JSON.stringify(seen[0].body).includes(KEY), "the key is not inside the file");
  ok((await p.evaluate(() => document.body.innerText)).includes(KEY) === false, "the key is never shown on screen");

  mode = "no";
  await p.getByRole("button", { name: "Send now" }).click(); await settle();
  ok(/A valid key is needed\./.test(await status()) && /15 minutes/.test(await status()), "a refusal is shown in the server's words, with the slower retry");

  mode = "ok";
  await p.getByRole("button", { name: "Send now" }).click(); await settle();
  ok(/Up to date/.test(await status()) && /1 resident/.test(await status()), "when the server is back, one press sends and it says up to date");
  const n = seen.length;
  await p.getByRole("button", { name: "Send now" }).click(); await settle();
  ok(seen.length === n, "pressing again sends nothing: the server already has these records");

  await p.goto(URL.replace(/\/?$/, "/") + "#/log");
  await p.getByRole("tabpanel").getByRole("button", { name: /^Pacing|^Hitting/ }).first().click(); await p.locator(".snackbar").waitFor();
  await p.goto(URL.replace(/\/?$/, "/") + "#/data/backup");
  await p.getByRole("heading", { name: "Send to the lab server" }).waitFor();
  await p.getByRole("button", { name: "Send now" }).click(); await settle();
  ok(seen.length === n + 1 && seen[n].body.records.length === 2, "a new log is sent with the old one (the whole file; the server ignores repeats)");

  const blocked = await p.evaluate(() => fetch("https://example.com/").then(() => false, () => true));
  ok(blocked, "the page cannot reach any other address (the security policy blocks it)");

  await p.screenshot({ path: `${OUT}/sync.png` });
  await p.locator("#sync-h").locator("xpath=..").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await p.locator(".snackbar").waitFor({ state: "hidden" }).catch(() => {});
  await p.waitForTimeout(300);
  await p.evaluate(axeSource);
  const v = await p.evaluate((tags) => window.axe.run(document.getElementById("sync-h").parentElement, { runOnly: { type: "tag", values: tags } }).then((r) => r.violations.map((x) => `${x.id} x${x.nodes.length} ${x.nodes.map((n) => n.target).join("|")}`)), TAGS);
  ok(v.length === 0, `axe, send card: ${v.join(", ") || "0 violations"}`);
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
