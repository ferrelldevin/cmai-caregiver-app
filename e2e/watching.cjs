// Watching hours (F-38, D-25, plan 5.6) on the LAB build: nothing about watching on Log (design
// note 030 step 6), a log starts a watch, the strip on Today with I've left and I'm here, switching
// resident ends it, the band on Today, the 4-hour timeout question; axe in four display modes.
// usage: node e2e/watching.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab)
const { engine } = require("./browser.cjs");
const fs = require("fs");
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const [URL, OUT] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
async function axe(p, name) {
  await p.waitForTimeout(350);
  await p.evaluate(axeSource);
  const v = await p.evaluate((tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags } }).then((r) => r.violations.map((x) => `${x.id} x${x.nodes.length}`)), TAGS);
  ok(v.length === 0, `axe, ${name}: ${v.join(", ") || "0 violations"}`);
}
const watches = (p) => p.evaluate(() => new Promise((res) => { const r = indexedDB.open("cmai-tracker"); r.onsuccess = () => { const g = r.result.transaction("watches").objectStore("watches").getAll(); g.onsuccess = () => { r.result.close(); res(g.result); }; }; }));
async function start(p) {
  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-01"); await p.keyboard.press("Enter");
  await p.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Hitting/ }).waitFor();
}
const tab = (p, name) => p.locator("nav.tabs button", { hasText: name }).click();

(async () => {
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, bypassCSP: true });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await start(p);
  const strip = p.locator(".watch-strip");
  // Log: nothing about watching stands before the tiles, before or after a log.
  ok((await strip.count()) === 0 && (await p.getByRole("button", { name: "I'm here" }).count()) === 0, "Log has no watching strip and no I'm here button");
  await axe(p, "Log, no strip");
  await tab(p, "Today");
  await strip.waitFor();
  ok((await strip.textContent()).includes("Not marked as with P-01"), "Today's strip says nobody is marked as with P-01");
  ok((await strip.boundingBox()).height <= 60, `the strip is one line (${Math.round((await strip.boundingBox()).height)} px)`);
  await axe(p, "Today with the strip, nothing logged");

  await tab(p, "Log");
  await p.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Hitting/ }).click(); await p.locator(".snackbar").waitFor();
  await p.waitForFunction(() => new Promise((res) => { const r = indexedDB.open("cmai-tracker"); r.onsuccess = () => { const g = r.result.transaction("watches").objectStore("watches").getAll(); g.onsuccess = () => { r.result.close(); res(g.result.length === 1); }; }; }));
  let ws = await watches(p);
  ok(ws.length === 1 && ws[0].startSource === "log" && ws[0].end === undefined, "a log with no watch open starts one: stored, one open watch, started by a log");
  ok((await strip.count()) === 0, "Log still shows no strip once a watch is open");
  await p.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Hitting/ }).click();
  await p.waitForFunction(() => new Promise((res) => { const r = indexedDB.open("cmai-tracker"); r.onsuccess = () => { const g = r.result.transaction("observations").objectStore("observations").count(); g.onsuccess = () => { r.result.close(); res(g.result === 2); }; }; }));
  await p.waitForTimeout(500); // the watch step follows the save
  const after = await watches(p);
  ok(after.length === 1 && after[0].uid === ws[0].uid && after[0].start === ws[0].start && after[0].end === undefined, "a second log is saved and starts no second watch: the first is still open, unchanged");
  await p.screenshot({ path: `${OUT}/watching-log.png` });

  await tab(p, "Today");
  await strip.filter({ hasText: "With P-01 since" }).waitFor(); ok(true, "Today's strip says With P-01 since the log");
  await strip.getByRole("button", { name: "I've left" }).click();
  await strip.filter({ hasText: "Not marked" }).waitFor();
  ws = await watches(p);
  ok(ws[0].endSource === "tap" && ws[0].end >= ws[0].start, "I've left ends it with one tap");
  await strip.getByRole("button", { name: "I'm here" }).click();
  await strip.filter({ hasText: "since" }).waitFor();
  ok((await watches(p)).some((w) => w.startSource === "tap" && w.end === undefined), "I'm here starts one with one tap");

  // Today: the band and its sentence.
  await p.locator(".watch-band").waitFor();
  ok((await p.locator(".watch-note").textContent()).includes("A gap with no bar means nobody was watching, not that it was calm."), "Today says a gap is not calm");
  ok((await p.locator(".watch-band span").count()) === 24, "the band has the same 24 hours as the bars");
  await p.screenshot({ path: `${OUT}/watching-today.png` });
  await axe(p, "Today with the band");

  // Switching resident ends the watch.
  await p.locator("nav.tabs button", { hasText: "Settings" }).click();
  await p.getByLabel("New patient code").fill("P-02"); await p.keyboard.press("Enter");
  await p.waitForTimeout(500);
  ws = await watches(p);
  ok(ws.every((w) => w.end !== undefined) && ws.some((w) => w.endSource === "switch"), "switching resident ends the watch as a switch");

  // 4 hours with no tap: it ended at the last tap, and the app asks once.
  await p.locator("nav.tabs button", { hasText: "Today" }).click();
  await p.locator(".watch-strip").getByRole("button", { name: "I'm here" }).click();
  await p.locator(".watch-strip", { hasText: "With P-02 since" }).waitFor();
  await p.evaluate(() => new Promise((res) => {
    const five = Date.now() - 5 * 3600_000;
    localStorage.setItem("cmai-last-tap", String(five));
    const r = indexedDB.open("cmai-tracker");
    r.onsuccess = () => {
      const st = r.result.transaction("watches", "readwrite").objectStore("watches");
      st.getAll().onsuccess = (e) => { for (const w of e.target.result) if (w.end === undefined) st.put({ ...w, start: five - 3600_000 }); };
      st.transaction.oncomplete = () => { r.result.close(); res(); };
    };
  }));
  await p.reload();
  const still = p.locator(".still-with");
  await still.waitFor();
  ok((await still.textContent()).includes("Still with P-02"), "after 4 hours with no tap the app asks: Still with P-02?");
  ok((await watches(p)).some((w) => w.endSource === "timeout"), "the watch ended at the last tap, as a timeout");
  await p.screenshot({ path: `${OUT}/watching-still.png` });
  await axe(p, "Still with? question");
  // The strip follows a change it did not make, with no tap on Today: ended by the timeout, carried on by the answer.
  await tab(p, "Today");
  // The app reopened on P-01. Its strip never borrows P-02's watch.
  await p.locator(".watch-strip", { hasText: "Not marked as with P-01" }).waitFor(); ok(true, "P-01's strip says not marked, whatever P-02's watch did");
  await p.getByRole("button", { name: /Choose patient$/ }).click();
  await p.getByRole("dialog", { name: "Choose patient" }).locator(".sheet-row", { hasText: "P-02" }).click();
  await p.locator(".watch-strip", { hasText: "Not marked as with P-02" }).waitFor(); ok(true, "Today's strip shows the timeout ended the watch");
  await still.getByRole("button", { name: "Yes, still here" }).click();
  await still.waitFor({ state: "detached" });
  await p.locator(".watch-strip", { hasText: "With P-02 since" }).waitFor(); ok(true, "and shows it carried on after Yes, still here, without leaving Today");
  ok((await watches(p)).some((w) => w.patientId === "P-02" && w.end === undefined), "Yes, still here carries the watch on");
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await ctx.close();

  for (const [name, colorScheme, high] of [["dark", "dark", false], ["light, high contrast", "light", true], ["dark, high contrast", "dark", true]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const q = await c.newPage();
    await start(q);
    await q.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Hitting/ }).click();
    await q.locator(".snackbar").waitFor();
    await q.locator("nav.tabs button", { hasText: "Today" }).click();
    await q.locator(".watch-strip", { hasText: "since" }).waitFor();
    await q.locator(".watch-band").waitFor();
    await axe(q, `Today with the band, ${name}`);
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
