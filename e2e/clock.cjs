// Clock check (F-40, plan 5.8) on the LAB build: the time moves by the tenth of a second, also
// with reduced motion; digits are tabular; axe in four display modes.
// usage: node e2e/clock.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab)
const { engine } = require("./browser.cjs");
const fs = require("fs");
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const [URL, OUT] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
async function axe(p, name) {
  await p.evaluate(axeSource);
  const v = await p.evaluate((tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags } }).then((r) => r.violations.map((x) => `${x.id} x${x.nodes.length}`)), TAGS);
  ok(v.length === 0, `axe, ${name}: ${v.join(", ") || "0 violations"}`);
}
const page = URL.replace(/\/?$/, "/") + "#/data/clock";

(async () => {
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  for (const [name, colorScheme, high, reduced] of [["light, reduced motion", "light", false, true], ["dark", "dark", false, false], ["light, high contrast", "light", true, false], ["dark, high contrast", "dark", true, false]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme, reducedMotion: reduced ? "reduce" : "no-preference", deviceScaleFactor: 2, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const p = await c.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(page);
    await p.getByRole("heading", { name: "This phone's clock" }).waitFor();
    const t = p.locator(".clock-time");
    if (name.startsWith("light, reduced")) {
      const a = await t.textContent(); await p.waitForTimeout(250); const z = await t.textContent();
      ok(/^\d\d:\d\d:\d\d\.\d$/.test(a), `the time reads to the tenth of a second: ${a}`);
      ok(a !== z, `it moves, with reduced motion on: ${a} then ${z}`);
      ok((await t.evaluate((el) => getComputedStyle(el).fontVariantNumeric)).includes("tabular-nums"), "the digits are tabular");
      ok((await p.locator(".clock").textContent()).includes("Film this screen next to the wristband"), "it says what it is for");
      ok(/Device ID: [0-9a-f-]{36}/.test(await p.locator(".clock").textContent()), "it shows the device ID");
      ok(/UTC[+−]\d\d:\d\d/.test(await p.locator(".clock").textContent()), "it shows the UTC offset");
      await p.screenshot({ path: `${OUT}/clock.png` });
    }
    await axe(p, `clock, ${name}`);
    ok(errs.length === 0, "no page errors: " + errs.join("; "));
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
