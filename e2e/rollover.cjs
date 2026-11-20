// "Today" stays right when the app is left open past midnight, and when the phone wakes the next day; coming back after a real absence shows Log. usage: node e2e/rollover.cjs URL OUTDIR
const { engine } = require("./browser.cjs");
const [URL] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
(async () => {
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "America/New_York" });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.clock.install({ time: new Date("2026-01-30T23:59:30-05:00") });
  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-01"); await p.keyboard.press("Enter");
  ok((await p.locator(".log-howto").textContent()).startsWith("Tap a behavior the moment you see it"), "before a first log, Log shows the one how-to line (F-65)");
  await p.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Hitting/ }).click();
  await p.locator(".log-howto").waitFor({ state: "detached" }); ok(true, "and it leaves with the first log");
  await p.locator(".tab-badge").filter({ hasText: "1" }).waitFor();
  ok(true, "a log made at 23:59:30 counts as today");
  // The app stays open past midnight: the timer must refresh it without any tap.
  // First let the confirmation close, so nothing else is about to redraw the screen.
  await p.clock.fastForward(9_000);
  await p.locator(".snackbar").waitFor({ state: "detached", timeout: 5000 });
  ok((await p.locator(".tab-badge").textContent()) === "1", "still 23:59:40: still today");
  await p.clock.fastForward(24_000);
  await p.locator(".tab-badge").waitFor({ state: "detached", timeout: 5000 });
  ok(true, "after midnight the count starts again: no badge on Today");
  // The phone sleeps through midnight: coming back to the app refreshes it.
  await p.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Hitting/ }).click();
  await p.locator(".tab-badge").filter({ hasText: "1" }).waitFor();
  await p.clock.fastForward(24 * 60 * 60 * 1000 - 5_000); // to just before the next midnight... then past it while hidden
  await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.locator(".tab-badge").waitFor({ state: "detached", timeout: 5000 });
  ok(true, "returning to the app on a new day refreshes today");
  // Opening the app means Log (design note 030 step 8). Left on another screen and brought back
  // after a real absence, it shows Log; after a short look away, or with something in progress, it stays.
  const see = (state) => p.evaluate((v) => { Object.defineProperty(document, "visibilityState", { value: v, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); }, state);
  const away = async (ms) => { await see("hidden"); await p.clock.fastForward(ms); await see("visible"); await p.waitForTimeout(300); };
  const tab = (t) => p.locator("nav.tabs button", { hasText: t }).click();
  const onLog = async () => p.url().endsWith("#/log") && (await p.getByRole("group", { name: "All behaviors" }).isVisible());
  await tab("Today"); await p.waitForFunction(() => location.hash === "#/today");
  await away(4 * 60_000);
  ok(p.url().endsWith("#/today"), "left on Today and back within 4 minutes: still Today");
  await away(6 * 60_000);
  ok(await onLog(), "left on Today and back after 6 minutes: Log");
  await tab("Two weeks"); await p.waitForFunction(() => location.hash.startsWith("#/twoweeks"));
  await away(60 * 60_000);
  ok(await onLog(), "left on Two weeks for an hour: Log");
  await tab("Settings");
  await p.getByRole("navigation", { name: "More" }).getByRole("link", { name: /^Display/ }).click();
  await p.getByRole("heading", { name: "Display", level: 1 }).waitFor();
  await away(6 * 60_000);
  ok(await onLog(), "left on a Settings page: Log");
  await p.goBack(); await p.waitForTimeout(300);
  ok(!p.url().includes("#/data/display"), "and the back gesture does not return to that page");
  // Something in progress is never taken away: an open sheet, or a field being typed in.
  await p.goto(URL.replace(/\/?$/, "/") + "#/today"); await p.waitForFunction(() => location.hash === "#/today");
  await p.getByRole("button", { name: /Choose patient$/ }).click();
  await p.locator("dialog[open]").waitFor();
  await away(6 * 60_000);
  ok(p.url().endsWith("#/today") && (await p.locator("dialog[open]").count()) === 1, "a sheet left open on Today is still there after 6 minutes");
  await p.keyboard.press("Escape"); await p.locator("dialog[open]").waitFor({ state: "detached" });
  await tab("Settings");
  await p.getByLabel("New patient code").fill("P-0");
  await away(6 * 60_000);
  ok(p.url().endsWith("#/data") && (await p.getByLabel("New patient code").inputValue()) === "P-0", "a code half typed in Settings is still there after 6 minutes");
  // Already on Log: nothing moves, the page stays where it was scrolled.
  await tab("Log"); await p.getByRole("navigation", { name: "Jump to a behavior group" }).getByRole("button", { name: "Other", exact: true }).click(); await p.waitForTimeout(900);
  const y = await p.evaluate(() => scrollY);
  await away(6 * 60_000);
  ok(y > 0 && (await p.evaluate(() => scrollY)) === y, "left on Log: Log stays where it was scrolled");
  ok(errs.length === 0, "no console errors " + JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
