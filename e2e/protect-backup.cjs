// Passphrase-protected backup (F-10, plan 5.11) on the LAB build: Export asks for a passphrase
// of 12+ characters, the file holds no readable data, a wrong passphrase restores nothing, the
// right one restores offline on another phone; axe in four display modes.
// usage: node e2e/protect-backup.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab)
const { chromium } = require("playwright");
const fs = require("fs");
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const [URL, OUT] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
async function axe(p, name) {
  await p.waitForTimeout(300);
  await p.evaluate(axeSource);
  const v = await p.evaluate((tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags } }).then((r) => r.violations.map((x) => `${x.id} x${x.nodes.length}`)), TAGS);
  ok(v.length === 0, `axe, ${name}: ${v.join(", ") || "0 violations"}`);
}
const PASS = "blue kettle on the stove";
async function withLog(p) {
  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-07"); await p.keyboard.press("Enter");
  await p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ }).click(); await p.locator(".snackbar").waitFor();
  await p.goto(URL.replace(/\/?$/, "/") + "#/data/backup");
  await p.getByRole("button", { name: "Download backup" }).click();
  await p.getByLabel("Passphrase for this file").waitFor();
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, bypassCSP: true, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await withLog(p);
  ok(true, "Download backup asks for a passphrase");
  ok((await p.locator("#pass-hint").textContent()).includes("Write it down"), "it says to write the passphrase down");
  ok(await p.getByLabel("Passphrase for this file").getAttribute("type") === "text", "the passphrase is shown, not hidden");
  await p.getByLabel("Passphrase for this file").fill("too short");
  await p.getByRole("button", { name: "Download protected backup" }).click();
  await p.getByText("Use at least 12 characters").waitFor(); ok(true, "a short passphrase is refused in words");
  await p.getByLabel("Passphrase for this file").fill(PASS);
  await p.screenshot({ path: `${OUT}/protect-export.png` });
  await axe(p, "passphrase form");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "Download protected backup" }).click()]);
  const file = `${OUT}/${dl.suggestedFilename()}`;
  await dl.saveAs(file);
  await p.getByText("Protected backup saved, with the CSVs inside").waitFor(); ok(true, "the message names the CSVs inside and where to keep it");
  const text = fs.readFileSync(file, "utf8");
  ok(dl.suggestedFilename().endsWith(".protected.json"), "the file name says it is protected");
  ok(!text.includes("P-07") && !text.includes("Hitting"), "the file holds no readable code or behavior");
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await ctx.close();

  // Another phone, offline.
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: true });
  const q = await c2.newPage();
  await q.goto(URL.replace(/\/?$/, "/") + "#/data/backup");
  await q.getByRole("button", { name: "Restore from backup" }).waitFor();
  await c2.setOffline(true);
  await q.locator('input[type="file"]').setInputFiles(file);
  await q.getByLabel("Passphrase that protects this file").waitFor(); ok(true, "a protected file asks for its passphrase");
  await q.getByLabel("Passphrase that protects this file").fill("blue kettle on the oven");
  await q.getByRole("button", { name: "Open and restore" }).click();
  await q.getByText("does not open this file").waitFor(); ok(true, "a wrong passphrase says so");
  ok(!(await q.locator("main").innerText()).includes("P-07"), "and restores nothing");
  await q.getByLabel("Passphrase that protects this file").fill(PASS);
  await q.getByRole("button", { name: "Open and restore" }).click();
  await q.getByText(/Restored 1 new patient and 1 new log/).waitFor(); ok(true, "the right passphrase restores, offline");
  await c2.close();

  for (const [name, colorScheme, high] of [["dark", "dark", false], ["light, high contrast", "light", true], ["dark, high contrast", "dark", true]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const r = await c.newPage();
    await withLog(r);
    await axe(r, `passphrase form, ${name}`);
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
