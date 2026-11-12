// Today tab checks (F-27, build plan v5 4.2): route, reload and back, empty state and the quiet-day
// check-in, figures, logs by hour, a row per behavior that opens to its logs, Edit and delete, no
// rating for a single day. Made-up demo data only. usage: node e2e/today.cjs URL OUTDIR
const { engine } = require("./browser.cjs");
const [URL, OUT] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
(async () => {
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  const tab = (t) => p.locator("nav.tabs button", { hasText: t }).click();
  const stat = (label) => p.locator(".stats > div", { hasText: label }).locator("dd").textContent();

  await p.goto(URL);
  await p.getByRole("button", { name: "Try demo data" }).click();
  await p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ }).waitFor();
  ok((await p.locator("nav.tabs button").allTextContents()).join(",") === "Log,Today,Two weeks,Settings", "the bar reads Log, Today, Two weeks, Settings");

  // Nothing logged yet today: say so, and offer the quiet-day check-in (moved here from Log).
  await tab("Today");
  ok(p.url().endsWith("#/today"), "Today has its own address");
  await p.getByRole("heading", { name: "Nothing logged today" }).waitFor(); ok(true, "nothing yet: the screen says so");
  ok((await stat("Logs today")) === "0" && (await stat("Last log")) === "None", "figures read 0 and None");
  const quiet = p.getByRole("button", { name: /Nothing to log today/ });
  await quiet.click(); await p.waitForTimeout(300); ok((await quiet.getAttribute("aria-pressed")) === "true", "the quiet-day check-in can be set here");
  await quiet.click(); await p.waitForTimeout(300); ok((await quiet.getAttribute("aria-pressed")) === "false", "and tapping again takes it back");
  await p.screenshot({ path: `${OUT}/today-empty.png` });
  ok(!(await p.locator(".log").getByText("Nothing to log today").count()), "Log no longer has the check-in");

  // Three logs, two behaviors.
  await tab("Log");
  ok(!(await p.getByRole("heading", { name: "Recent logs" }).count()), "Log no longer has Recent logs");
  for (const n of ["Hitting", "Spitting", "Hitting"]) { await p.getByRole("tabpanel").getByRole("button", { name: new RegExp("^" + n) }).click(); await p.waitForTimeout(700); }
  await p.locator(".today-count").click();
  ok(p.url().endsWith("#/today"), "'3 logged today' on Log opens Today");
  ok((await stat("Logs today")) === "3" && (await stat("Behaviors")) === "2", "3 logs, 2 behaviors");
  const hours = await p.locator(".hours").getAttribute("aria-label");
  ok(/: 3\b/.test(hours) && hours.startsWith("Logs by hour today"), "logs by hour has a text alternative with the counts: " + hours);
  ok((await p.locator(".acc-head").first().textContent()).includes("Hitting"), "the behavior logged last comes first");
  ok(!/rating|\b[1-7]\s*\/\s*7\b|Score:/i.test(await p.locator(".today").innerText()), "no 1 to 7 rating for a single day");

  // A row opens to its logs; Edit fixes or removes one.
  const head = p.locator(".acc-head", { hasText: "Hitting" });
  await head.click();
  ok((await head.getAttribute("aria-expanded")) === "true" && (await p.locator(".acc-body li").count()) === 2, "Hitting opens to its 2 logs");
  await p.screenshot({ path: `${OUT}/today-open.png` });
  await p.locator(".acc-body li").first().getByRole("button", { name: /^Edit/ }).click();
  const sheet = p.getByRole("dialog", { name: /^Hitting/ });
  await sheet.waitFor();
  await sheet.getByRole("button", { name: "Delete log" }).click();
  const del = p.getByRole("dialog", { name: "Delete this log?" });
  await del.getByRole("button", { name: "Tapped by mistake" }).click();
  await del.getByRole("button", { name: "Delete log" }).click();
  await p.locator(".snackbar", { hasText: "Deleted" }).waitFor();
  await p.waitForTimeout(400);
  ok((await stat("Logs today")) === "2" && (await p.locator(".acc-body li").count()) === 1, "a deleted log is not counted");
  await p.locator(".snackbar").getByRole("button", { name: "Undo" }).click(); await p.waitForTimeout(400);
  ok((await stat("Logs today")) === "3", "Undo brings it back");

  // Reload and back.
  await p.reload(); await p.waitForTimeout(800);
  ok(p.url().endsWith("#/today") && (await p.locator("nav.tabs button.on").textContent()).includes("Today"), "reload stays on Today");
  await tab("Settings"); await p.getByRole("link", { name: /^Display/ }).click(); await p.waitForTimeout(300);
  await p.goBack(); await p.waitForTimeout(300);
  ok(p.url().endsWith("#/data"), "back from a Settings page lands on Settings");
  await tab("Today"); await p.waitForTimeout(300);
  ok(p.url().endsWith("#/today"), "and Today is one tap away");

  ok(errs.length === 0, "no page errors: " + errs.join(" | "));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
