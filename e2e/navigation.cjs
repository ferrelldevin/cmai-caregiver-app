// Navigation checks: Log group tabs, Two weeks and the old Score address, Data hub and pages, back gesture, reload. usage: node e2e/navigation.cjs URL OUTDIR
const { engine } = require("./browser.cjs");
const [URL, OUT] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
(async () => {
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  const shot = (n) => p.mouse.move(1, 1).then(() => p.waitForTimeout(250)).then(() => p.screenshot({ path: `${OUT}/${n}.png` }));
  const tab = (t) => p.locator("nav.tabs button", { hasText: t }).click();

  await p.goto(URL);
  await shot("01-first-run-hub");
  await p.getByRole("button", { name: "Try demo data" }).click();
  await p.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Hitting/ }).waitFor();
  ok(p.url().endsWith("#/log"), "demo load lands on #/log");
  await shot("02-log-top");
  // Log: all 29 behaviors on one page, under four group headings (design note 030 step 3).
  // The bar of group names jumps to a group and stays under the resident bar; it hides nothing.
  const all = p.getByRole("group", { name: "All behaviors" });
  const jumpBar = p.getByRole("navigation", { name: "Jump to a behavior group" });
  const marked = () => jumpBar.locator('[aria-current="true"]').allTextContents();
  ok((await all.locator(".tile-btn").count()) === 29 && (await all.getByRole("heading", { level: 2 }).count()) === 4, "all 29 behaviors are on the page, under four group headings");
  ok((await p.locator('[role="tab"], [role="tablist"], [role="tabpanel"]').count()) === 0, "no behavior sits behind a tab");
  ok((await marked()).join() === "Aggressive", "the bar marks Aggressive at the top of the page");
  for (const [name, heading] of [["Physical", /^Physical/], ["Verbal", /^Verbal/], ["Other", /^Other/], ["Aggressive", /^Aggressive/]]) {
    await jumpBar.getByRole("button", { name, exact: true }).click(); await p.waitForTimeout(900);
    const g = await p.evaluate((n) => {
      const bar = document.querySelector(".group-jump").getBoundingClientRect();
      const pin = document.querySelector(".pin").getBoundingClientRect();
      const i = ["Aggressive", "Physical", "Verbal", "Other"].indexOf(n);
      const sec = document.querySelectorAll(".all-groups section")[i];
      const h = sec.querySelector("h2").getBoundingClientRect();
      const first = sec.querySelector(".tile-btn").getBoundingClientRect();
      return { barTop: bar.top, pinBottom: pin.bottom, barBottom: bar.bottom, hTop: h.top, firstTop: first.top, firstBottom: first.bottom, vh: innerHeight, focus: document.activeElement === sec.querySelector("h2"), text: sec.querySelector("h2").textContent, atEnd: innerHeight + scrollY >= document.documentElement.scrollHeight - 2 };
    }, name);
    ok(heading.test(g.text) && g.focus, `${name}: focus moves to the "${g.text}" heading`);
    ok(Math.abs(g.barTop - g.pinBottom) <= 1, `${name}: the bar stays pinned under the resident bar`);
    ok(g.firstTop >= g.barBottom - 1 && g.firstBottom <= g.vh - 88, `${name}: its first tile is in view, clear of the bar and the tab bar (top ${Math.round(g.firstTop)})`);
    ok(g.atEnd || (g.hTop >= g.barBottom - 4 && g.hTop <= g.barBottom + 40), `${name}: its heading sits right under the bar (or the page is at its end)`);
    ok((await marked()).join() === name, `${name}: the bar marks it, and only it (${await marked()})`);
  }
  await p.keyboard.press("Tab");
  ok(await p.evaluate(() => document.activeElement === document.querySelector("#group-aggressive .tile-btn")), "from the heading, Tab goes to that group's first tile");
  // The mark means "the group at the top". At the end of the page by hand it is still the group
  // at the top, not the last one; only a group asked for by name keeps the mark there.
  await p.mouse.move(195, 500); await p.mouse.wheel(0, 5000); await p.waitForTimeout(500);
  const end = await p.evaluate(() => {
    const line = document.querySelector(".group-jump").getBoundingClientRect().bottom + 24;
    const names = ["Aggressive", "Physical", "Verbal", "Other"];
    let at = names[0];
    document.querySelectorAll(".all-groups section").forEach((s, i) => { if (s.getBoundingClientRect().top <= line) at = names[i]; });
    return { at, atEnd: innerHeight + scrollY >= document.documentElement.scrollHeight - 2 };
  });
  ok(end.atEnd && (await marked()).join() === end.at, `scrolled to the end by hand, the bar marks the group at the top (${end.at}), marked ${await marked()}`);
  // A reload part-way down the page marks the right group without a scroll.
  await p.evaluate(() => window.scrollTo(0, 700)); await p.waitForTimeout(300);
  const mid = (await marked()).join();
  await p.reload(); await all.getByRole("button", { name: /^Hitting/ }).waitFor(); await p.waitForTimeout(500);
  const after = await p.evaluate(() => scrollY);
  ok(after === 0 ? (await marked()).join() === "Aggressive" : (await marked()).join() === mid, `after a reload the bar marks the group at the top (scroll ${after}, marked ${await marked()})`);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  // What counts (F-37): one button under the grid, and holding a tile opens it at that behavior without logging.
  await p.getByRole("button", { name: "What counts as each behavior?" }).click();
  const defs = p.getByRole("dialog", { name: "What counts as each behavior" });
  await defs.waitFor();
  ok((await defs.locator(".def").count()) === 29, "the sheet lists all 29 behaviors");
  ok((await defs.locator(".defs-howto").textContent()).includes("one tap is one stretch"), "the sheet opens with the how-to line that left Log (F-65)");
  ok((await defs.getByRole("heading", { level: 3 }).allTextContents()).length === 4, "under the four group headings");
  await defs.getByRole("button", { name: "Close" }).click(); await defs.waitFor({ state: "hidden" });
  // The count on the Today tab, none shown meaning zero: a hold must leave the number itself unchanged.
  const badge = async () => ((await p.locator(".tab-badge").count()) ? Number(await p.locator(".tab-badge").textContent()) : 0);
  const before = await badge();
  // The page is longer than the screen now, so bring the tile into view before holding it.
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  const kick = await p.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Kicking/ }).boundingBox();
  await p.mouse.move(kick.x + kick.width / 2, kick.y + kick.height / 2); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up();
  await defs.waitFor();
  ok(await defs.locator(".def.on").textContent().then((t) => t.startsWith("Kicking")), "holding Kicking opens the sheet at Kicking");
  await defs.getByRole("button", { name: "Close" }).click(); await defs.waitFor({ state: "hidden" }); await p.waitForTimeout(300);
  ok((await badge()) === before && !(await p.locator(".snackbar").count()), "a hold does not log");
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
  await p.locator("nav.tabs button", { hasText: "Settings" }).click(); await p.waitForTimeout(400);
  ok(p.url().endsWith("#/data"), "on-page Back button returns to the hub");
  await p.getByRole("link", { name: /How ratings/ }).click(); await p.waitForTimeout(300);
  ok(/Data on this phone: (kept|may be cleared)/.test(await p.locator("main").textContent()), "About says whether the phone keeps the data (F-53)");
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
  // A small phone (320 x 568): the welcome page is scrolled to reach "Try demo data", and Log
  // still opens at its first tile; the four group names fit one row (design note 030 step 3).
  const s = await (await b.newContext({ viewport: { width: 320, height: 568 } })).newPage();
  await s.goto(URL);
  await s.getByRole("button", { name: "Try demo data" }).click();
  await s.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Hitting/ }).waitFor(); await s.waitForTimeout(400);
  const small = await s.evaluate(() => {
    const tops = [...document.querySelectorAll(".group-tabs button")].map((x) => Math.round(x.getBoundingClientRect().top));
    return { y: scrollY, oneRow: new Set(tops).size === 1, over: document.documentElement.scrollWidth - innerWidth, target: Math.min(...[...document.querySelectorAll(".group-tabs button")].map((x) => x.getBoundingClientRect().height)) };
  });
  ok(small.y === 0, "small phone: Log opens at the top after the first patient arrives (scrolled " + small.y + ")");
  ok(small.oneRow && small.over <= 0 && small.target >= 44, "small phone: the four group names fit one row, 44 px tall, no sideways scroll " + JSON.stringify(small));
  await s.screenshot({ path: `${OUT}/12-small-phone-log.png` });
  // Large text on the small phone: the names wrap to more rows, and a jump still lands the
  // heading under the taller bar, not behind it.
  await s.evaluate(() => document.querySelectorAll(".group-tabs button").forEach((x) => { x.style.fontSize = "28px"; })); await s.waitForTimeout(300);
  await s.getByRole("navigation", { name: "Jump to a behavior group" }).getByRole("button", { name: "Physical", exact: true }).click(); await s.waitForTimeout(900);
  const big = await s.evaluate(() => {
    const bar = document.querySelector(".group-jump").getBoundingClientRect();
    const tops = new Set([...document.querySelectorAll(".group-tabs button")].map((x) => Math.round(x.getBoundingClientRect().top)));
    const h = document.querySelector("#group-h-physical").getBoundingClientRect();
    return { rows: tops.size, barBottom: Math.round(bar.bottom), hTop: Math.round(h.top), over: document.documentElement.scrollWidth - innerWidth };
  });
  ok(big.rows > 1 && big.hTop >= big.barBottom && big.hTop <= big.barBottom + 60 && big.over <= 0, "small phone, large text: the names wrap and the heading lands under the taller bar " + JSON.stringify(big));
  await s.screenshot({ path: `${OUT}/13-small-phone-large-text.png` });
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
