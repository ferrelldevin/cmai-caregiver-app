// Three more "just before" chips (F-41, plan 5.9) on the LAB build: eleven chips with Nothing
// noticed and Other last, the sheet fits a 360 x 640 screen, a chip saves, axe in four modes.
// usage: node e2e/before-chips.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab)
const { chromium } = require("playwright");
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
async function openSheet(p) {
  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-01"); await p.keyboard.press("Enter");
  await p.getByRole("button", { name: /^7 Hitting/ }).click(); await p.locator(".snackbar").waitFor();
  await p.getByRole("button", { name: /^Edit Hitting/ }).first().click();
  const sheet = p.getByRole("dialog", { name: /^Hitting/ });
  await sheet.waitFor();
  return sheet;
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, bypassCSP: true });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const sheet = await openSheet(p);
  const chips = await sheet.locator("button.choice").allTextContents();
  const before = chips.filter((t) => !/^(Yes|No)$/.test(t.trim()));
  ok(["Too hot or too cold", "Slept badly last night", "Seemed unwell"].every((c) => before.some((t) => t.includes(c))), "the three new chips are there");
  const iNothing = before.findIndex((t) => t.includes("Nothing noticed")), iOther = before.findIndex((t) => t.includes("Other"));
  const iUnwell = before.findIndex((t) => t.includes("Seemed unwell"));
  ok(iUnwell < iNothing && iNothing < iOther, "Nothing noticed and Other are still last");
  const box = await sheet.boundingBox();
  ok(box.height <= 640 && box.y >= 0, `the sheet fits 360 x 640 (${Math.round(box.height)} px tall)`);
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/before-chips.png` });
  await axe(p, "log sheet with eleven chips");
  await sheet.getByRole("button", { name: "Too hot or too cold" }).click();
  await sheet.getByRole("button", { name: "Done" }).click();
  await p.waitForTimeout(300);
  const saved = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open("cmai-tracker"); r.onsuccess = () => { const g = r.result.transaction("observations").objectStore("observations").getAll(); g.onsuccess = () => res(g.result.map((o) => o.before)); }; }));
  ok(saved.includes("Too hot or too cold"), "a new chip is saved with the log");
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await ctx.close();
  for (const [name, colorScheme, high] of [["dark", "dark", false], ["light, high contrast", "light", true], ["dark, high contrast", "dark", true]]) {
    const c = await b.newContext({ viewport: { width: 360, height: 640 }, colorScheme, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const q = await c.newPage();
    await openSheet(q);
    await axe(q, `log sheet, ${name}`);
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
