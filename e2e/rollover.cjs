// "Today" stays right when the app is left open past midnight, and when the phone wakes the next day. usage: node e2e/rollover.cjs URL OUTDIR
const { chromium } = require("playwright");
const [URL] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "America/New_York" });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.clock.install({ time: new Date("2026-01-30T23:59:50-05:00") });
  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-01"); await p.keyboard.press("Enter");
  await p.getByRole("button", { name: /^7 Hitting/ }).click();
  await p.locator(".today-count").filter({ hasText: "1 logged today" }).waitFor();
  ok(true, "a log made at 23:59:50 counts as today");
  // The app stays open past midnight: the timer must refresh it without any tap.
  // First let the confirmation close, so nothing else is about to redraw the screen.
  await p.clock.fastForward(9_000);
  await p.locator(".snackbar").waitFor({ state: "detached", timeout: 5000 });
  ok((await p.locator(".today-count").textContent()).includes("1 logged today"), "still 23:59:59: still today");
  await p.clock.fastForward(5_000);
  await p.getByText("Nothing logged yet today").waitFor({ timeout: 5000 });
  ok(true, "after midnight the count starts again at nothing logged yet today");
  // The phone sleeps through midnight: coming back to the app refreshes it.
  await p.getByRole("button", { name: /^7 Hitting/ }).click();
  await p.locator(".today-count").filter({ hasText: "1 logged today" }).waitFor();
  await p.clock.fastForward(24 * 60 * 60 * 1000 - 5_000); // to just before the next midnight... then past it while hidden
  await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.getByText("Nothing logged yet today").waitFor({ timeout: 5000 });
  ok(true, "returning to the app on a new day refreshes today");
  ok(errs.length === 0, "no console errors " + JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
