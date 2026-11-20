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
  await p.locator("#research-h").locator("xpath=..").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await p.locator(".snackbar").waitFor({ state: "hidden" }); // the "Now on" toast would cover a button
  await p.waitForTimeout(300);
  await p.evaluate(axeSource);
  const v = await p.evaluate((tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags } }).then((r) => r.violations.map((x) => `${x.id} x${x.nodes.length}`)), TAGS);
  ok(v.length === 0, `axe, ${name}: ${v.join(", ") || "0 violations"}`);
}
async function openCard(p) {
  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-07"); await p.keyboard.press("Enter");
  await p.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Hitting/ }).click(); await p.locator(".snackbar").waitFor();
  await p.goto(URL.replace(/\/?$/, "/") + "#/data/lab");
  await p.getByRole("heading", { name: "Export for research" }).waitFor();
  // F-58: a new log carries the phone's zone name, not only its offset.
  const zone = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open("cmai-tracker"); r.onsuccess = () => { const g = r.result.transaction("observations").objectStore("observations").getAll(); g.onsuccess = () => { r.result.close(); res(g.result[0] && g.result[0].tzName); }; }; }));
  ok(typeof zone === "string" && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(zone), `a new log saves its zone name (${zone})`);
}
async function withDemo(p) {
  await openCard(p);
  await p.goto(URL.replace(/\/?$/, "/") + "#/data/demo");
  await p.getByRole("button", { name: "Load demo data" }).click();
  await p.getByRole("heading", { name: /^Log a behavior/ }).waitFor(); // loading demo data opens the Log tab
  await p.goto(URL.replace(/\/?$/, "/") + "#/data/lab");
  await p.getByLabel("Resident").selectOption("P-DEMO-A");
}

(async () => {
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, bypassCSP: true, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await openCard(p);
  // Every control on the card lines up on both edges, at phone width and on a 320 px phone.
  for (const w of [430, 390, 320]) {
    await p.setViewportSize({ width: w, height: 844 });
    const edges = await p.evaluate(() => ["#rx-patient", "#rx-start", "#rx-end"].map((s) => document.querySelector(s)).concat([...document.querySelectorAll("#research-h ~ .rx-field > button")]).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; }));
    const stacked = edges.every(([l, r]) => l === edges[0][0] && r === edges[0][1]);
    const halves = edges[1][0] === edges[0][0] && edges[2][1] === edges[0][1] && Math.abs((edges[1][1] - edges[1][0]) - (edges[2][1] - edges[2][0])) <= 1;
    ok(edges.length === 4 && (stacked || halves), `the export fields line up on both edges at ${w} px (${JSON.stringify(edges)})`);
    if (w === 430) ok(halves && !stacked, "with room, the two days share a row in equal halves");
    ok(await p.evaluate(() => ["#rx-start", "#rx-end"].every((s) => { const e = document.querySelector(s); return e.scrollWidth <= e.clientWidth; })), `each date shows in full at ${w} px`);
    ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `no sideways scroll on Backup at ${w} px`);
  }
  await p.setViewportSize({ width: 390, height: 844 });
  await p.getByRole("button", { name: "Check range" }).click();
  await p.getByRole("alert").getByText(/Only made-up \(demo\) residents can be exported/).waitFor();
  ok(!(await p.getByRole("button", { name: "Save file" }).count()), "a real resident (P-07) is refused in words and nothing can be saved (G1)");
  await p.goto(URL.replace(/\/?$/, "/") + "#/data/demo");
  await p.getByRole("button", { name: "Load demo data" }).click();
  await p.getByRole("heading", { name: /^Log a behavior/ }).waitFor(); // loading demo data opens the Log tab
  await p.goto(URL.replace(/\/?$/, "/") + "#/data/lab");
  await p.getByLabel("Resident").selectOption("P-DEMO-A");
  await p.getByRole("button", { name: "Check range" }).click();
  await p.getByText("Found").waitFor();
  const found = await p.locator("#research-h").locator("xpath=..").innerText();
  const n = Number(/(\d+)\s+records?/.exec(found)?.[1]);
  ok(n > 10, `it counts the demo resident's logs in the last 14 days (${n})`);
  ok(/Role set to caregiver because no role is saved for who logged it: \d+/.test(found), "it says how many roles were defaulted");
  ok(/Older logs with no phone ID, shown as all zeros: \d+/.test(found), "it says how many logs have the placeholder ID");
  await p.screenshot({ path: `${OUT}/research-export.png` });
  await axe(p, "research export, found");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "Save file" }).click()]);
  ok(/^cmai-export_P-DEMO-A_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), "the file is named cmai-export_<resident>_<start>_<end>.json");
  const file = `${OUT}/${dl.suggestedFilename()}`;
  await dl.saveAs(file);
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  ok(doc.schema_version === "1.0.0" && doc.header.record_count === n && doc.records.length === n, "the file holds the same records, schema 1.0.0");
  ok(doc.header.data_class === "synthetic", "a demo resident is marked synthetic");
  ok(doc.records.every((r) => r.cmai_item >= 1 && r.cmai_item <= 29 && r.participant_id === "P-DEMO-A") && !("note" in doc.records[0]), "item numbers only, no wording or notes");
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await ctx.close();

  for (const [name, colorScheme, high] of [["dark", "dark", false], ["light, high contrast", "light", true], ["dark, high contrast", "dark", true]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const r = await c.newPage();
    await withDemo(r);
    await r.getByRole("button", { name: "Check range" }).click();
    await r.getByText("Found").waitFor();
    await axe(r, `research export, ${name}`);
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
