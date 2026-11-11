// Navigation checks: Log group tabs, Two weeks and the old Score address, Data hub and pages, back gesture, reload. usage: node e2e/navigation.cjs URL OUTDIR
const { chromium } = require("playwright");
const [URL, OUT] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  const shot = (n) => p.mouse.move(1, 1).then(() => p.waitForTimeout(250)).then(() => p.screenshot({ path: `${OUT}/${n}.png` }));
  const tab = (t) => p.locator("nav.tabs button", { hasText: t }).click();

  await p.goto(URL);
  await shot("01-first-run-hub");
  await p.getByRole("button", { name: "Try demo data" }).click();
  await p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ }).waitFor();
  ok(p.url().endsWith("#/log"), "demo load lands on #/log");
  await shot("02-log-top");
  // Log: group tabs (F-26). One group at a time; arrow keys move between tabs.
  const selected = () => p.evaluate(() => document.querySelector('[role="tablist"][aria-label="Behavior groups"] [aria-selected="true"]')?.textContent);
  ok(await selected() === "Aggressive", "Log opens on Aggressive");
  await p.getByRole("tab", { name: "Physical" }).click();
  ok(await selected() === "Physical" && (await p.getByRole("tabpanel").getByRole("button", { name: /^Pacing/ }).count()) === 1, "Physical tab shows physical behaviors");
  await p.keyboard.press("ArrowRight");
  ok(await selected() === "Verbal" && await p.evaluate(() => document.activeElement?.textContent) === "Verbal", "ArrowRight moves to Verbal and focuses it");
  await p.keyboard.press("Home");
  ok(await selected() === "Aggressive", "Home goes back to the first group");
  // What counts (F-37): one button under the grid, and holding a tile opens it at that behavior without logging.
  await p.getByRole("button", { name: "What counts as each behavior?" }).click();
  const defs = p.getByRole("dialog", { name: "What counts as each behavior" });
  await defs.waitFor();
  ok((await defs.locator(".def").count()) === 29, "the sheet lists all 29 behaviors");
  ok((await defs.getByRole("heading", { level: 3 }).allTextContents()).length === 4, "under the four group headings");
  await defs.getByRole("button", { name: "Close" }).click(); await defs.waitFor({ state: "hidden" });
  const before = await p.locator(".today-count").textContent();
  const kick = await p.getByRole("tabpanel").getByRole("button", { name: /^Kicking/ }).boundingBox();
  await p.mouse.move(kick.x + kick.width / 2, kick.y + kick.height / 2); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up();
  await defs.waitFor();
  ok(await defs.locator(".def.on").textContent().then((t) => t.startsWith("Kicking")), "holding Kicking opens the sheet at Kicking");
  await defs.getByRole("button", { name: "Close" }).click(); await defs.waitFor({ state: "hidden" }); await p.waitForTimeout(300);
  ok((await p.locator(".today-count").textContent()) === before && !(await p.locator(".snackbar").count()), "a hold does not log");
  await p.mouse.wheel(0, 1200); await p.waitForTimeout(400);
  await shot("03-log-scrolled");
  // Tap the active tab: back to top
  await tab(/^Log$/); await p.waitForTimeout(1600);
  ok(await p.evaluate(() => window.scrollY) === 0, "tapping the current tab scrolls to top");
  // Two weeks (Score folded into it, build plan 4.4)
  await tab(/two weeks/i); await p.waitForTimeout(600);
  ok(p.url().endsWith("#/twoweeks"), "Two weeks in URL");
  await p.goto(p.url().replace(/#.*$/, "#/scores/p2")); await p.reload(); await p.waitForTimeout(800);
  ok(p.url().endsWith("#/twoweeks/p2") && (await p.locator(".pnav-label").textContent()).includes("Period 2 ·"), "an old #/scores/p2 address opens Two weeks on period 2");
  await shot("05-twoweeks");
  await p.reload(); await p.waitForTimeout(800);
  ok(p.url().endsWith("#/twoweeks/p2") && (await p.locator("nav.tabs button.on").textContent()).includes("Two weeks"), "reload stays on Two weeks");
  // The day-14 review screen is gone (D-14): no tab, and its old address lands on the start screen.
  ok(!(await p.locator("nav.tabs button", { hasText: "Review" }).count()), "no Review tab");
  await p.goto(p.url().replace(/#.*$/, "#/review")); await p.reload(); await p.waitForTimeout(800);
  ok((await p.locator("nav.tabs button.on").textContent()).includes("Log"), "old #/review address opens Log");
  // Data hub and pages
  await tab(/settings/i); await p.waitForTimeout(500);
  ok(p.url().endsWith("#/data"), "Data hub in URL");
  await shot("08-data-hub");
  await p.getByRole("link", { name: /Display/ }).click(); await p.waitForTimeout(400);
  ok(p.url().endsWith("#/data/display"), "row opens #/data/display");
  ok((await p.locator("h1").textContent()).startsWith("Display"), "page heading is Display");
  await shot("09-data-display");
  await p.goBack(); await p.waitForTimeout(400);
  ok(p.url().endsWith("#/data") && await p.getByRole("link", { name: /Backup and export/ }).isVisible(), "back gesture returns to the hub");
  await p.getByRole("link", { name: /Backup and export/ }).click(); await p.waitForTimeout(300);
  await shot("10-data-backup");
  await p.getByRole("button", { name: "Settings", exact: true }).click(); await p.waitForTimeout(400);
  ok(p.url().endsWith("#/data"), "on-page Back button returns to the hub");
  await p.getByRole("link", { name: /How ratings/ }).click(); await p.waitForTimeout(300);
  ok(await p.getByRole("button", { name: "Copy diagnostics" }).isVisible(), "About page has a Copy diagnostics button");
  ok(await p.getByText("Nothing is sent anywhere. Copying is up to you.").isVisible(), "About page says nothing is sent anywhere");
  await tab(/^Log$/); await p.waitForTimeout(500);
  ok(p.url().endsWith("#/log"), "switching tab from a Data page goes to Log");
  await p.goBack(); await p.waitForTimeout(400);
  ok(!p.url().endsWith("#/data/about"), "Back after leaving a Data page does not reopen it (now " + p.url().split("#")[1] + ")");
  // Page heights now pinned
  ok(errs.length === 0, "no console errors " + JSON.stringify(errs));
  // Desktop look
  const d = await (await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 })).newPage();
  await d.goto(URL); await d.getByRole("button", { name: "Try demo data" }).click(); await d.waitForTimeout(800);
  await d.mouse.wheel(0, 900); await d.waitForTimeout(500); await d.mouse.move(1, 1);
  await d.screenshot({ path: `${OUT}/11-desktop-log-scrolled.png` });
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
