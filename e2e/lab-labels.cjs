// Lab notes (build plan 4.8) on the LAB build: "Open: <ID>" labels show on Today and Two weeks,
// a register ID links to the review register, and axe passes in four display modes. The
// caregiver build shows none of them (e2e/today.cjs, e2e/twoweeks.cjs).
// usage: node e2e/lab-labels.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab)
const { engine } = require("./browser.cjs");
const fs = require("fs");
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const [URL, OUT] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const REGISTER = "https://github.com/ferrelldevin/cmai-caregiver-app/blob/main/docs/review-register.md";
async function axe(p, name) {
  await p.waitForTimeout(350);
  await p.evaluate(axeSource);
  const v = await p.evaluate((tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags } }).then((r) => r.violations.map((x) => `${x.id} x${x.nodes.length}`)), TAGS);
  ok(v.length === 0, `axe, ${name}: ${v.join(", ") || "0 violations"}`);
}

(async () => {
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  for (const [name, colorScheme, high] of [["light", "light", false], ["dark", "dark", false], ["light, high contrast", "light", true], ["dark, high contrast", "dark", true]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme, deviceScaleFactor: 2, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const p = await c.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    // Made-up demo data only: two demo residents with finished periods.
    await p.goto(URL.replace(/\/?$/, "/") + "#/data/demo");
    await p.getByRole("button", { name: "Load demo data" }).click();
    await p.getByRole("heading", { name: /^Log a behavior/ }).waitFor();

    // The mode asked for is the mode drawn, or the axe runs below would all test the same screen.
    const drawn = await p.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.contrast ?? "normal"].join(", "));
    ok(drawn === `${colorScheme}, ${high ? "high" : "normal"}`, `the app is drawn in ${name} (${drawn})`);

    await p.locator("nav.tabs button", { hasText: "Today" }).click();
    const r4 = p.locator(".open-label", { hasText: /^Open: R4 / });
    await r4.waitFor();
    if (name === "light") {
      ok((await r4.locator("a").count()) === 0, "R4 is a requirement, not a register row, so it is not a link");
      await p.screenshot({ path: `${OUT}/lab-labels-today.png` });
    }
    await axe(p, `Today with its lab note, ${name}`);

    await p.locator("nav.tabs button", { hasText: "Two weeks" }).click();
    await p.locator(".open-label", { hasText: "Open: D-17" }).waitFor();
    if (name === "light") {
      for (const id of ["D-17", "D-18"]) {
        const a = p.locator(".open-label", { hasText: `Open: ${id}` }).locator("a");
        ok((await a.count()) === 1 && (await a.getAttribute("href")) === REGISTER && (await a.textContent()) === id, `${id} links to the review register`);
      }
      const d18 = await p.locator(".open-label", { hasText: "Open: D-18" }).innerText();
      ok(/Abedi 2025/.test(d18) && /Bankole 2020/.test(d18), "the D-18 note still names its evidence");
      ok((await p.getByRole("link", { name: "D-17 in the review register (opens in a new tab)" }).count()) === 1, "a link says where it goes and that it opens a new tab");
      await p.locator(".open-label", { hasText: "Open: D-18" }).scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${OUT}/lab-labels-twoweeks.png` });
    }
    await axe(p, `Two weeks with its lab notes, ${name}`);
    ok(errs.length === 0, "no page errors: " + errs.join("; "));
    await c.close();
  }
  await b.close();
  console.log("LAB LABELS OK");
})().catch((e) => { console.error(e.message); process.exit(1); });
