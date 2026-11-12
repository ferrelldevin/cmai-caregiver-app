// Two weeks tab checks (F-28, build plan v5 4.3): route and period in the URL, the answer first,
// lower and higher only for finished periods, the in-progress period marked "so far" and left out
// of comparisons, plain HTML charts with text alternatives (no Recharts), open labels D-17 and
// D-18, export link. Made-up demo data only. usage: node e2e/twoweeks.cjs URL OUTDIR
const { chromium } = require("playwright");
const [URL, OUT] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  const tab = (t) => p.locator("nav.tabs button", { hasText: t }).click();
  const h2 = (name) => p.getByRole("heading", { name, exact: true });

  await p.goto(URL);
  await p.getByRole("button", { name: "Try demo data" }).click();
  await p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ }).waitFor();

  // Opens on the latest finished period, with its own address.
  await tab("Two weeks");
  await h2("This period").waitFor();
  ok(p.url().endsWith("#/twoweeks"), "Two weeks has its own address");
  ok((await p.locator(".pnav-label").innerText()).includes("ended"), "it opens on the latest finished period");

  // The answer comes first: the summary sits above the table (Part 8, U12).
  const order = await p.locator(".twoweeks h2").allTextContents();
  ok(order.join("|") === "This period|Behaviors, this period vs last|Logs per day|Time of day|Behavior groups|Patterns to look into|History",
    "order: summary, table, per day, time of day, groups, patterns, history: " + order.join(" | "));
  ok((await p.locator(".total-chip").innerText()).startsWith("Total score") && (await p.locator(".total-chip .sr").textContent()) === "(secondary)", "the total is a chip beside the title, labeled secondary (D-08)");
  ok((await p.locator("nav.tabs button").allTextContents()).join(",") === "Log,Today,Two weeks,Settings", "Score is folded in: the bar reads Log, Today, Two weeks, Settings");
  const sum = await p.locator(".summary").innerText();
  ok(/Lower than last period:/.test(sum) && /Higher:/.test(sum), "a finished period says what is lower and what is higher");
  ok(/Busiest time: .+ \(\d+% of logs\)/.test(sum), "and the busiest time of day");

  // Table: every behavior logged here or last period, with its rating and both counts.
  const rows = p.locator(".rtable tbody tr");
  const n = await rows.count();
  ok(n > 0 && (await p.locator(".rtable .rating-cell").count()) === n, `${n} behaviors, each with a rating`);
  ok(/\+ \d+ not logged \(rated 1\)/.test(await p.locator(".more").innerText()), "the rest are summed up in one line");
  const down = await p.locator(".rtable .move.down").count();
  ok(down >= 1 && (await p.locator(".rtable .td-move", { has: p.locator(".move.down") }).first().textContent()).includes("Down from"), "a change has words, not just an arrow");

  // Charts: plain elements with text alternatives; no Recharts on this screen.
  ok((await p.locator(".twoweeks .recharts-wrapper, .twoweeks svg.recharts-surface").count()) === 0, "no Recharts chart on Two weeks");
  const perDay = await p.locator(".daybars").getAttribute("aria-label");
  ok(perDay.startsWith("Logs per day:") && perDay.split(",").length === 14, "logs per day has a text alternative for all 14 days");
  ok((await p.locator(".tod [role=row]").count()) === 6 && (await p.locator(".tod [role=cell]").count()) === 84, "time of day is a 6 by 14 grid");
  ok(/: \d+ logs$/.test(await p.locator(".tod [role=cell]").first().getAttribute("aria-label")), "each cell says its count");
  ok((await p.locator(".key-item").count()) === 4, "the grid has a 4-step legend");

  // Open labels for what the lab has not set.
  ok((await p.locator(".open-label", { hasText: "Open: D-17" }).count()) === 1, "group average is labeled Open: D-17");
  const d18 = p.locator(".open-label", { hasText: "Open: D-18" });
  ok((await d18.count()) === 1 && /Abedi 2025/.test(await d18.innerText()) && /Bankole 2020/.test(await d18.innerText()), "patterns are labeled Open: D-18 with the evidence");
  ok(!/\bbecause\b/i.test(await p.locator("section", { has: h2("Patterns to look into") }).innerText()), "patterns never say 'because'");
  await p.screenshot({ path: `${OUT}/twoweeks-finished.png`, fullPage: true });

  // The period in progress: "so far", the day named, no comparisons.
  const later = p.getByRole("button", { name: "Later period" });
  const box = await later.boundingBox();
  ok(box.width >= 44 && box.height >= 44, "period arrows are at least 44px");
  await later.click();
  await h2("So far this period").waitFor();
  ok(/#\/twoweeks\/p\d+$/.test(p.url()), "the period is in the address");
  ok(/day \d+ of 14, so far/.test(await p.locator(".pnav-label").innerText()), "the period in progress names the day");
  ok(!/Lower than last period|Higher:/.test(await p.locator(".summary").innerText()), "no lower or higher while in progress");
  ok((await p.locator(".rtable .move.up, .rtable .move.down").count()) === 0, "and no change arrows");
  ok((await p.locator(".rtable .rating-cell.provisional").count()) === (await p.locator(".rtable .rating-cell").count()), "its ratings are marked provisional");
  const dayN = Number(/day (\d+) of 14/.exec(await p.locator(".pnav-label").innerText())[1]);
  ok((await p.locator(".daybars").getAttribute("aria-label")).split(",").length === dayN, `days still to come are left out of the text alternative (${dayN} listed)`);
  const url = p.url();
  await p.reload(); await h2("So far this period").waitFor();
  ok(p.url() === url, "reload keeps the period");

  // A new log shows up so far.
  await tab("Log");
  await p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ }).click(); await p.waitForTimeout(700);
  await tab("Two weeks"); await h2("So far this period").waitFor();
  ok(p.url() === url, "coming back keeps the chosen period");
  ok(/Most logged: Hitting \(1\)/.test(await p.locator(".summary").innerText()), "a log from today is counted so far");
  ok(/\bso far\b/.test(await p.locator(".daybars").getAttribute("aria-label")), "today's bar is marked so far");
  await p.screenshot({ path: `${OUT}/twoweeks-in-progress.png`, fullPage: true });

  // Earlier goes back; export goes to Backup and export.
  await p.getByRole("button", { name: "Earlier period" }).click();
  await h2("This period").waitFor(); ok(true, "Earlier period goes back to the finished one");
  await p.getByRole("button", { name: /^Export/ }).click(); await p.waitForTimeout(300);
  ok(p.url().endsWith("#/data/backup"), "Export opens Settings, Backup and export");

  ok(errs.length === 0, "no page errors: " + errs.join(" | "));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
