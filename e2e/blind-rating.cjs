// The caregiver's blind two-week CMAI (F-47, plan 5.4) on the LAB build: due only after a
// period ends and only for a caregiver who logged in it; the form shows nothing from the logs;
// all 29 answers, then submit and lock; the lab view compares with the app; axe in four modes.
// usage: node e2e/blind-rating.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab)
const { engine } = require("./browser.cjs");
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
const heading = (p, name) => p.getByRole("heading", { name }).waitFor();
async function pinIn(p, pin, next) { await p.keyboard.type(pin); if (next) await heading(p, next); }

// The app's own database, opened at whatever version it is.
const idb = (p, fn, arg) => p.evaluate(([src, a]) => new Promise((resolve, reject) => {
  const req = indexedDB.open("cmai-tracker");
  req.onerror = () => reject(req.error);
  req.onsuccess = () => { const db = req.result; (0, eval)(src)(db, a).then((r) => { db.close(); resolve(r); }, reject); };
}), [fn.toString(), arg]);

// P-01 whose period 1 ended yesterday, JM (C-01) signed in, and 20 made-up Hitting logs by JM in period 1.
async function setUp(p) {
  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-01"); await p.keyboard.press("Enter");
  await p.locator(".cg-chip").click();
  await heading(p, "Choose a setup PIN");
  await pinIn(p, "246810", "Enter the setup PIN again");
  await pinIn(p, "246810", "Add the first caregiver");
  await p.getByLabel("Caregiver initials").fill("JM"); await p.keyboard.press("Enter");
  await heading(p, "Setup PIN"); // a first PIN needs the setup PIN
  await pinIn(p, "246810", "Choose a PIN for JM");
  await pinIn(p, "2580", "Enter it again");
  await pinIn(p, "2580");
  await p.locator(".cg-chip", { hasText: "JM" }).waitFor();
  await idb(p, (db) => new Promise((resolve, reject) => {
    const tx = db.transaction(["patients", "observations"], "readwrite");
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 15);
    const anchor = d.getTime();
    const pt = tx.objectStore("patients");
    pt.get("P-01").onsuccess = (e) => pt.put({ ...e.target.result, anchor });
    for (let i = 0; i < 20; i++) {
      const at = anchor + (i % 13) * 86400000 + 9 * 3600000 + i * 60000;
      tx.objectStore("observations").add({ patientId: "P-01", itemId: 7, at, loggedAt: at, by: "C-01", uid: crypto.randomUUID() });
    }
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  }));
  await p.reload();
  await p.locator("nav.tabs button", { hasText: "Log" }).click();
}

(async () => {
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, bypassCSP: true });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await setUp(p);

  // Due, but never in the way of a log.
  const due = p.locator(".due-line");
  await due.waitFor();
  ok((await due.textContent()).includes("Two-week rating due for P-01"), "Log shows: Two-week rating due for P-01");
  await p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ }).click(); await p.locator(".snackbar").waitFor();
  ok(true, "logging still takes one tap with a rating due");
  await p.screenshot({ path: `${OUT}/rating-due.png` });
  await axe(p, "Log with a rating due");

  // Blind: no number from the logs.
  await due.getByRole("button", { name: "Rate" }).click();
  await heading(p, "Two-week rating: P-01, period 1");
  ok(p.url().includes("#/rating/P-01/p1"), "the rating has its own address");
  const text = await p.locator("main").innerText();
  ok(!/\b2[01]\b/.test(text), "the form has no 20 (or 21) anywhere, though JM logged Hitting 20 times (21 with today's)");
  ok(await p.locator(".heat, .score-overview, .period-scores, .chart").count() === 0, "no rating square or score on the form");
  ok(await p.locator(".rate-btn[aria-pressed=true]").count() === 0, "no answer is chosen in advance");
  ok(!/mark the rest|all never/i.test(text), "no shortcut to mark the rest");
  ok((await p.locator(".rate-row").count()) === 29, "29 behaviors");
  await p.screenshot({ path: `${OUT}/rating-form.png` });
  await axe(p, "rating form");

  // Answer all 29, one tap each (Hitting 4, Kicking 8, Spitting 9, the rest 1).
  const t0 = Date.now();
  const rows = p.locator(".rate-row");
  for (let i = 0; i < 29; i++) {
    const row = rows.nth(i);
    const name = await row.locator(".rate-name").textContent();
    const label = /^Hitting/.test(name) ? /^4,/ : /^Kicking/.test(name) ? /^8 ·/ : /^Spitting/.test(name) ? /^9 ·/ : /^1,/;
    await row.getByRole("button", { name: label }).click();
    if (/^Hitting/.test(name)) {
      await p.waitForTimeout(100);
      const words = await row.locator(".rate-label").textContent();
      ok(words === "Several times a week", `the chosen number shows in words: Hitting 4, ${words}`);
    }
  }
  console.log(`  (29 answers by script in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  ok((await p.locator(".rate-progress").textContent()) === "29 of 29 answered", "progress says 29 of 29");

  // Leaving and coming back keeps the answers.
  await p.goBack();
  await p.locator(".due-line").waitFor();
  await p.locator(".due-line").getByRole("button", { name: "Rate" }).click();
  await p.locator(".rate-progress", { hasText: "29 of 29" }).waitFor(); ok(true, "answers are kept when leaving before submitting");

  await p.getByRole("button", { name: "Submit rating" }).click();
  await p.getByText("Once submitted, nobody can change it.").waitFor(); ok(true, "submitting asks once, in words");
  await p.getByRole("button", { name: "Submit and lock" }).click();
  await heading(p, "P-01, period 1: submitted");
  const stored = await idb(p, (db) => new Promise((resolve) => { const r = db.transaction("caregiverRatings").objectStore("caregiverRatings").getAll(); r.onsuccess = () => resolve(r.result); }));
  ok(stored.length === 1 && stored[0].by === "C-01" && stored[0].submittedAt && stored[0].ruleVersion === "cmai-count-rule-2" && Object.keys(stored[0].answers).length === 29,
    "one row: 29 answers, by C-01, submittedAt, ruleVersion");

  // Lab view only, after submitting: caregiver beside app.
  const hitting = p.locator("table.cmp tr", { hasText: "Hitting" });
  await hitting.waitFor();
  const cells = await hitting.locator("td").allTextContents();
  ok(cells.join("|") === "4|5|Yes", "Hitting: JM 4, app 5 (20 logs in period 1), within 1: " + cells.join("|"));
  const kicking = await p.locator("table.cmp tr", { hasText: "Kicking" }).locator("td").allTextContents();
  ok(kicking[2] === "No", "code 8 is never within 1");
  await p.screenshot({ path: `${OUT}/rating-submitted.png`, fullPage: false });
  await axe(p, "submitted, lab view");

  // Locked, and no longer due.
  await p.getByRole("button", { name: "Back to Log" }).click();
  await p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ }).waitFor();
  ok(await p.locator(".due-line").count() === 0, "no rating due after submitting");
  await p.goto(URL.replace(/\/?$/, "/") + "#/rating/P-01/p1");
  await heading(p, "P-01, period 1: submitted");
  ok(await p.locator(".rate-btn").count() === 0, "opening it again shows it locked, with nothing to change");
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await ctx.close();

  for (const [name, colorScheme, high] of [["dark", "dark", false], ["light, high contrast", "light", true], ["dark, high contrast", "dark", true]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const q = await c.newPage();
    await setUp(q);
    await q.locator(".due-line").getByRole("button", { name: "Rate" }).click();
    await heading(q, "Two-week rating: P-01, period 1");
    await q.locator(".rate-row").first().getByRole("button", { name: /^3,/ }).click();
    await axe(q, `rating form, ${name}`);
    if (name === "dark") await q.screenshot({ path: `${OUT}/rating-form-dark.png` });
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
