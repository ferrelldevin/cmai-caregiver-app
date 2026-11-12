// Patient switcher checks: sheet contents, keyboard and Esc, backdrop, confirmation, search, Manage patients.
// usage: node e2e/patient-switcher.cjs URL OUTDIR
const { chromium } = require("playwright");
const [URL, OUT] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  const banner = () => p.getByRole("button", { name: /Choose patient$/ });
  const sheet = () => p.getByRole("dialog", { name: "Choose patient" });
  const shot = (n) => p.waitForTimeout(300).then(() => p.screenshot({ path: `${OUT}/${n}.png` }));

  await p.goto(URL);
  await p.getByRole("button", { name: "Try demo data" }).click();
  await p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ }).waitFor();
  await shot("sw-01-log");
  ok((await banner().getAttribute("aria-haspopup")) === "dialog", "banner is a button that opens a dialog");
  await banner().click();
  await sheet().waitFor();
  const rows = sheet().getByRole("button", { name: /^P-/ });
  ok(await rows.count() === 2, "sheet lists both patients");
  // The rows show codes at once and add period, day and last log when the database answers (about 10 ms
  // later here, longer on a CI runner), so wait for the details before reading them.
  await rows.nth(0).filter({ hasText: "Last log" }).waitFor({ timeout: 5000 }).catch(() => {});
  const first = await rows.nth(0).textContent();
  ok(/Period \d+ · day \d+ of 14/.test(first) && /Last log /.test(first), "rows show period, day and last log: " + first);
  ok((await rows.nth(0).getAttribute("aria-current")) === "true", "current patient is marked");
  ok(await p.evaluate(() => document.activeElement?.tagName === "DIALOG" && !document.querySelector(".sheet :focus-visible")), "opened by tap: focus on the sheet, no focus ring on any row");
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.sheet-row[aria-current="true"] .tag')).backgroundColor !== getComputedStyle(document.querySelector('.sheet-row[aria-current="true"]')).backgroundColor), "demo tag keeps its pill on the current row");
  await shot("sw-02-sheet");
  await p.keyboard.press("Escape");
  ok(!(await sheet().isVisible()), "Esc closes the sheet");
  ok(await p.evaluate(() => document.activeElement?.classList.contains("pt-banner")), "focus returns to the banner");
  await p.waitForTimeout(100); // let the app see the close before reopening (a person cannot press this fast)
  await p.keyboard.press("Enter"); await sheet().waitFor();
  ok(await p.evaluate(() => document.activeElement?.getAttribute("aria-current") === "true"), "opened by keyboard: focus starts on the current patient");
  await p.keyboard.press("Escape");
  await banner().click(); await sheet().waitFor();
  await p.mouse.click(195, 40); await p.waitForTimeout(200);
  ok(!(await sheet().isVisible()), "tapping the backdrop closes the sheet");
  await banner().click(); await sheet().getByRole("button", { name: /^P-DEMO-B/ }).click();
  await p.getByRole("status").filter({ hasText: "Now on P-DEMO-B" }).waitFor();
  ok((await banner().locator(".pt-id b").textContent()) === "P-DEMO-B", "switch takes effect, banner says P-DEMO-B");
  await shot("sw-03-switched");
  ok(await p.evaluate(() => !document.querySelector(".pt-banner").matches(":focus-visible")), "no keyboard focus ring left after a tap");
  await p.waitForTimeout(4300);
  ok((await p.locator(".switch-notice").textContent()).trim() === "", "confirmation clears after 4 seconds");
  // Search appears with 8+ patients
  await p.locator("nav.tabs button", { hasText: /settings/i }).click();
  for (const n of ["P-01", "P-02", "P-03", "P-04", "P-05", "P-06"]) {
    await p.getByRole("textbox", { name: "New patient code" }).fill(n);
    await p.getByRole("button", { name: "Add", exact: true }).click();
    await p.locator("nav.tabs button", { hasText: /settings/i }).click();
  }
  await banner().click(); await sheet().waitFor();
  // Read the row count in the same call that sees the dialog open: the list must be current from the first paint.
  const firstPaint = await p.evaluate(() => document.querySelectorAll("dialog[open] .sheet-row").length);
  ok(firstPaint === 8, "sheet lists all 8 patients on first paint (saw " + firstPaint + ")");
  const search = sheet().getByRole("searchbox", { name: "Find a patient by code" });
  // The 8th patient comes in with the last Add's refresh, which can land after the sheet opens.
  await search.waitFor({ timeout: 5000 }).catch(() => {});
  ok(await search.isVisible(), "search shows with 8 patients");
  // After typing, wait up to 3 s for the list to filter, then read the sheet once so the check and its
  // message agree. A failure prints the rows and the search box: a box that reads "" means the query was reset.
  const seen = async () => {
    const labels = await rows.allTextContents();
    return { n: labels.length, text: `${labels.length} rows [${labels.map((t) => t.slice(0, 12)).join(", ")}], search box "${await search.inputValue()}"` };
  };
  await search.fill("03");
  await p.waitForFunction(() => document.querySelectorAll("dialog[open] .sheet-row").length === 1, null, { timeout: 3000 }).catch(() => {});
  const s03 = await seen();
  ok(s03.n === 1, "search filters to P-03" + (s03.n === 1 ? "" : " (saw " + s03.text + ")"));
  await shot("sw-04-search");
  await search.fill("zz");
  const empty = sheet().getByText('No patient code contains "zz".');
  await empty.waitFor({ timeout: 3000 }).catch(() => {});
  ok(await empty.isVisible(), "empty search result explains itself" + ((await empty.isVisible()) ? "" : " (saw " + (await seen()).text + ")"));
  await sheet().getByRole("button", { name: "Manage patients" }).click();
  ok(p.url().endsWith("#/data") && !(await sheet().isVisible()), "Manage patients opens the Data hub");
  // Dark + desktop look
  const d = await (await b.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: "dark", deviceScaleFactor: 2 })).newPage();
  await d.goto(URL); await d.getByRole("button", { name: "Try demo data" }).click(); await d.waitForTimeout(800);
  await d.getByRole("button", { name: /Choose patient$/ }).click(); await d.waitForTimeout(400);
  await d.screenshot({ path: `${OUT}/sw-05-desktop-dark.png` });
  ok(errs.length === 0, "no console errors " + JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
