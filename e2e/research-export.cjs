// "Export for research" (F-56, design note 018) on the LAB build: pick a resident and a range, see
// what was found, save one JSON file; the caregiver build has no such card; axe in four display modes.
// usage: node e2e/research-export.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab)
const { engine } = require("./browser.cjs");
const fs = require("fs");
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const [URL, OUT] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
async function axe(p, name) {
  // Scroll so the open card sits mid-screen; at the top edge the sticky bar hides the buttons above it.
  await p.getByRole("button", { name: "Save file" }).evaluate((el) => el.scrollIntoView({ block: "center" }));
  await p.locator(".snackbar").waitFor({ state: "hidden" }); // the "Now on" toast would cover a button
  await p.waitForTimeout(300);
  await p.evaluate(axeSource);
  const v = await p.evaluate((tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags } }).then((r) => r.violations.map((x) => `${x.id} x${x.nodes.length}`)), TAGS);
  ok(v.length === 0, `axe, ${name}: ${v.join(", ") || "0 violations"}`);
}
async function withLog(p) {
  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-07"); await p.keyboard.press("Enter");
  await p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ }).click(); await p.locator(".snackbar").waitFor();
  await p.goto(URL.replace(/\/?$/, "/") + "#/data/backup");
  await p.getByRole("heading", { name: "Export for research" }).waitFor();
}

(async () => {
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, bypassCSP: true, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await withLog(p);
  await p.getByRole("button", { name: "Check range" }).click();
  await p.getByText("Found").waitFor();
  const found = await p.locator("#research-h").locator("xpath=..").innerText();
  ok(/1\s+record/.test(found) && found.includes("1 active, 0 deleted"), "it counts the one log just made");
  ok(found.includes("Role set to caregiver because the app does not store one: 1"), "it says how many roles were defaulted");
  ok(found.includes("Older logs with no phone ID, shown as all zeros: 0"), "it says how many logs have the placeholder ID");
  await p.screenshot({ path: `${OUT}/research-export.png` });
  await axe(p, "research export, found");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "Save file" }).click()]);
  ok(/^cmai-export_P-07_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), "the file is named cmai-export_<resident>_<start>_<end>.json");
  const file = `${OUT}/${dl.suggestedFilename()}`;
  await dl.saveAs(file);
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  ok(doc.schema_version === "1.0.0" && doc.header.record_count === 1 && doc.records.length === 1, "the file holds the one record, schema 1.0.0");
  ok(doc.records[0].cmai_item === 7 && doc.records[0].status === "active", "the record is item 7, active");
  ok(!/Hitting|P-07.*P-07.*P-07/.test(JSON.stringify(doc.records)) && !("note" in doc.records[0]), "no item wording or notes in the records");
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await ctx.close();

  for (const [name, colorScheme, high] of [["dark", "dark", false], ["light, high contrast", "light", true], ["dark, high contrast", "dark", true]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const r = await c.newPage();
    await withLog(r);
    await r.getByRole("button", { name: "Check range" }).click();
    await r.getByText("Found").waitFor();
    await axe(r, `research export, ${name}`);
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
