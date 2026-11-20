// Change reasons (G11, design note 019) on the LAB build: edits are held until "Save change", which asks
// why from a pick list; a delete asks the same list and takes no free text; the history view shows
// every version with who, when and why; nothing is rewritten. axe in four display modes.
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
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, bypassCSP: true });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const sheet = await openSheet(p);

  await sheet.getByRole("button", { name: "Mealtime" }).click();
  ok((await stored(p)).logs[0].before === undefined, "a change is held, not saved, until Save change");
  ok(await sheet.getByText("Your changes are kept when you press Save change").isVisible(), "the sheet says so");
  await sheet.getByRole("button", { name: "Save change" }).click();
  await sheet.getByRole("button", { name: "Why are you changing it?" }).count();
  const shown = await sheet.locator("button.choice").allTextContents();
  ok(REASONS.every((r) => shown.some((t) => t.includes(r))) && shown.length === 6, "the reason list has the six reasons and nothing else");
  ok(await sheet.getByRole("button", { name: "Save change" }).isDisabled(), "Save change waits for a reason");
  await p.screenshot({ path: `${OUT}/change-reason.png` });
  await axe(p, "reason step");
  await sheet.getByRole("button", { name: "Back" }).click();
  ok((await stored(p)).changes.length === 0, "Back saves nothing");
  await sheet.getByRole("button", { name: "Save change" }).click();
  await sheet.getByRole("button", { name: "Wrong time" }).click();
  await sheet.getByRole("button", { name: "Save change" }).click();
  await sheet.getByText("Change history (1)").waitFor();
  let d = await stored(p);
  ok(d.logs[0].before === "Mealtime" && d.logs[0].rev === 2, "the change is saved, revision 2");
  ok(d.changes.length === 1 && d.changes[0].reason === "wrong_time" && d.changes[0].action === "edit", "the entry carries the reason code wrong_time");
  await sheet.getByText("Change history (1)").click();
  const hist = await sheet.locator(".log-history li").allTextContents();
  ok(hist.length === 2 && hist[0].includes("Logged") && hist[1].includes("Changed") && hist[1].includes("Wrong time"), "the history view lists the log and the change with its reason");
  await p.screenshot({ path: `${OUT}/change-history.png` });
  await axe(p, "history view");

  // A second change adds a second entry; the first is untouched.
  await sheet.getByRole("button", { name: "Mealtime" }).click(); // clears the chip
  await sheet.getByRole("button", { name: "Save change" }).click();
  await sheet.getByRole("button", { name: "Other" }).click();
  await sheet.getByRole("button", { name: "Save change" }).click();
  await sheet.getByText("Change history (2)").waitFor();
  const first = JSON.stringify(d.changes[0]);
  d = await stored(p);
  ok(d.changes.length === 2 && JSON.stringify(d.changes[0]) === first, "history is append-only: two entries, the first unchanged");

  // Delete: same list, and Other takes no free text.
  await sheet.getByRole("button", { name: "Delete log" }).click();
  await sheet.getByRole("button", { name: "Other" }).click();
  ok(!(await sheet.getByPlaceholder("A few words, no names").count()), "Other asks for no free text");
  await sheet.getByRole("button", { name: "Delete log" }).click();
  await p.locator(".snackbar").waitFor();
  d = await stored(p);
  ok(d.logs.length === 1 && d.logs[0].deletedAt !== undefined && d.logs[0].deleteNote === undefined, "the log is kept, marked deleted, with no note");
  ok(d.changes.at(-1).action === "delete" && d.changes.at(-1).reason === "other" && d.logs[0].rev === 4, "the delete is a tombstone entry with reason other, revision 4");
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await ctx.close();

  for (const [name, colorScheme, high] of [["dark", "dark", false], ["light, high contrast", "light", true], ["dark, high contrast", "dark", true]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const q = await c.newPage();
    const s = await openSheet(q);
    await s.getByRole("button", { name: "Mealtime" }).click();
    await s.getByRole("button", { name: "Save change" }).click();
    await axe(q, `reason step, ${name}`);
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
