// Change reasons (G11, design note 019) on the LAB build: edits are held until "Save change", which
// saves them with a reason worked out from what changed and asks nothing (design note 030 step 4);
// a delete still asks, from the pick list, and takes no free text; the history view shows
// every version with who, when and why; nothing is rewritten; a "When?" chip on the confirmation saves as Wrong time and asks nothing (F-51). axe in four display modes.
// usage: node e2e/change-reasons.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab)
const { engine } = require("./browser.cjs");
const fs = require("fs");
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const [URL, OUT] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
async function axe(p, name) {
  await p.waitForTimeout(300);
  await p.evaluate(axeSource);
  const v = await p.evaluate((tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags } }).then((r) => r.violations.map((x) => `${x.id} x${x.nodes.length}`)), TAGS);
  ok(v.length === 0, `axe, ${name}: ${v.join(", ") || "0 violations"}`);
}
const stored = (p) => p.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("cmai-tracker");
  r.onsuccess = () => {
    const tx = r.result.transaction(["observations", "changes"]);
    const o = tx.objectStore("observations").getAll(), c = tx.objectStore("changes").getAll();
    tx.oncomplete = () => res({ logs: o.result, changes: c.result });
  };
}));
const REASONS = ["Wrong time", "Wrong behavior", "Logged twice", "Wrong patient", "Tapped by mistake", "Other"];
// Save change closes the sheet (design note 030 step 4), so a check that goes on with the same log
// opens it again from Today, as a caregiver would.
async function reopen(p, name) {
  await p.locator("nav.tabs button", { hasText: "Today" }).click();
  const row = p.locator(".acc-head", { hasText: name });
  await row.waitFor();
  if ((await row.getAttribute("aria-expanded")) !== "true") await row.click();
  await p.locator(".acc-body li").first().getByRole("button", { name: /^Edit/ }).click();
  await p.getByRole("dialog", { name: new RegExp("^" + name) }).waitFor();
  return p.locator(".log-sheet");
}
async function openSheet(p) {
  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-01"); await p.keyboard.press("Enter");
  await p.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Hitting/ }).click(); await p.locator(".snackbar").waitFor();
  await p.locator(".snackbar").getByRole("button", { name: "Edit" }).click();
  const sheet = p.getByRole("dialog", { name: /^Hitting/ });
  await sheet.waitFor();
  return p.locator(".log-sheet"); // its name changes on the reason step
}

(async () => {
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  // The chip step moves a log back 5 minutes, which is refused before the resident's first day (local midnight),
  // so the page's clock starts at midday whatever time the check runs; it then runs on at real speed.
  const midday = new Date(); midday.setUTCHours(12, 0, 0, 0);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, bypassCSP: true, timezoneId: "UTC" });
  const p = await ctx.newPage();
  await p.clock.install({ time: midday });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const sheet = await openSheet(p);

  // What happened before: held until Save change, then saved as "Other" with nothing asked.
  await sheet.getByRole("button", { name: "Mealtime" }).click();
  ok((await stored(p)).logs[0].before === undefined, "a change is held, not saved, until Save change");
  ok(await sheet.getByText('Press Save change to keep this. It is recorded as "Other"').isVisible(), "the sheet says so, and names the reason it will record");
  await p.screenshot({ path: `${OUT}/change-reason.png` });
  await axe(p, "held change");
  await sheet.getByRole("button", { name: "Mealtime" }).click(); // off again: nothing differs from the stored log
  ok((await sheet.getByRole("button", { name: "Done" }).count()) === 1 && !(await sheet.getByRole("button", { name: "Save change" }).count()), "a chip tapped on and off again is no change: Done, not Save change");
  await sheet.getByRole("button", { name: "Mealtime" }).click();
  await sheet.getByRole("button", { name: "Save change" }).click();
  await sheet.waitFor({ state: "hidden" });
  ok((await p.locator(".log-sheet button.choice", { hasText: "Wrong time" }).count()) === 0, "Save change asks no reason and closes the sheet");
  let d = await stored(p);
  ok(d.logs[0].before === "Mealtime" && d.logs[0].rev === 2, "the change is saved, revision 2");
  ok(d.changes.length === 1 && d.changes[0].reason === "other" && d.changes[0].action === "edit", "the entry carries the reason code other");
  ok(d.changes[0].from && !("before" in d.changes[0].from && d.changes[0].from.before !== undefined) && d.changes[0].to.before === "Mealtime", "the entry keeps the old value (no chip) next to the new one");

  // A time: one tap on "5 min", one on Save change, recorded as wrong_time. Nothing else is asked.
  let again = await reopen(p, "Hitting");
  await again.getByRole("button", { name: "5 min before logging", exact: true }).click();
  ok(await again.getByText('It is recorded as "Wrong time"').isVisible(), "a time change says it will be recorded as Wrong time");
  await again.getByRole("button", { name: "Save change" }).click();
  await again.waitFor({ state: "hidden" });
  const first = JSON.stringify(d.changes[0]);
  d = await stored(p);
  ok(d.changes.length === 2 && d.changes[1].reason === "wrong_time" && d.logs[0].loggedAt - d.logs[0].at === 5 * 60_000 && d.logs[0].rev === 3, "the time moved 5 minutes, reason code wrong_time, revision 3");
  ok(JSON.stringify(d.changes[0]) === first, "history is append-only: two entries, the first unchanged");
  ok(d.changes[1].from.at === d.logs[0].loggedAt && d.changes[1].to.at === d.logs[0].at, "the second entry keeps the old time next to the new one");

  // A time and a chip in one save are one entry, recorded as wrong_time.
  again = await reopen(p, "Hitting");
  await again.getByRole("switch", { name: "Time is approximate" }).click();
  await again.getByRole("button", { name: "Mealtime" }).click(); // clears the chip
  await again.getByRole("button", { name: "Save change" }).click();
  await again.waitFor({ state: "hidden" });
  d = await stored(p);
  ok(d.changes.length === 3 && d.changes[2].reason === "wrong_time" && d.logs[0].approx === true && d.logs[0].before === undefined, "a time and a chip together are one entry, reason code wrong_time");

  const sheet2 = await reopen(p, "Hitting");
  await sheet2.getByText("Change history (3)").click();
  const hist = await sheet2.locator(".log-history li").allTextContents();
  ok(hist.length === 4 && hist[0].includes("Logged") && hist[1].includes("Other") && hist[2].includes("Wrong time") && hist[3].includes("Wrong time"), "the history view lists the log and each change with its reason");
  await p.screenshot({ path: `${OUT}/change-history.png` });
  await axe(p, "history view");

  // Delete still asks why: the six reasons and nothing else, and Other takes no free text.
  await sheet2.getByRole("button", { name: "Delete log" }).click();
  const shown = await sheet2.locator("button.choice").allTextContents();
  ok(REASONS.every((r) => shown.some((t) => t.includes(r))) && shown.length === 6, "the delete reason list has the six reasons and nothing else");
  ok(await sheet2.getByRole("button", { name: "Delete log" }).isDisabled(), "Delete log waits for a reason");
  await axe(p, "delete reason step");
  await sheet2.getByRole("button", { name: "Other" }).click();
  ok(!(await sheet2.getByPlaceholder("A few words, no names").count()), "Other asks for no free text");
  await sheet2.getByRole("button", { name: "Delete log" }).click();
  await p.locator(".snackbar").waitFor();
  d = await stored(p);
  ok(d.logs.length === 1 && d.logs[0].deletedAt !== undefined && d.logs[0].deleteNote === undefined, "the log is kept, marked deleted, with no note");
  ok(d.changes.at(-1).action === "delete" && d.changes.at(-1).reason === "other" && d.logs[0].rev === 5, "the delete is a tombstone entry with reason other, revision 5");
  // The "When?" chips on the confirmation (F-51): one tap, saved as wrong_time, nothing asked.
  await p.goto(URL);
  await p.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Hitting/ }).click();
  const snack = p.locator(".snackbar"); await snack.waitFor();
  await snack.getByRole("button", { name: "5 min ago", exact: true }).click();
  await p.waitForFunction(() => /\(about\)/.test(document.querySelector(".snackbar-meta")?.textContent ?? ""));
  ok((await p.getByRole("dialog").count()) === 0 && (await p.locator("button.choice").count()) === 0, "a chip asks nothing: no sheet and no reason list");
  d = await stored(p);
  const chipped = d.logs.at(-1); // the log just made
  const entry = d.changes.find((c) => c.observationId === chipped?.id);
  ok(chipped.loggedAt - chipped.at === 5 * 60_000 && chipped.approx === true && entry && entry.reason === "wrong_time" && entry.action === "edit", "a chip saves the time with the reason code wrong_time");
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await ctx.close();

  for (const [name, colorScheme, high] of [["dark", "dark", false], ["light, high contrast", "light", true], ["dark, high contrast", "dark", true]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const q = await c.newPage();
    const s = await openSheet(q);
    await s.getByRole("button", { name: "Mealtime" }).click();
    await axe(q, `held change, ${name}`);
    await s.getByRole("button", { name: "Delete log" }).click();
    await axe(q, `delete reason step, ${name}`);
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
