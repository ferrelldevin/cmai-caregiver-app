// Correcting a wrong behavior (F-64, design note 025) on the LAB build: "Change" beside the behavior
// opens a pick list; confirming changes the same log (same ID, revision + 1) and writes one history
// entry with the reason wrong_item. Nothing is deleted and no second log is made. axe in four modes.
// usage: node e2e/correct-behavior.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab)
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
async function openSheet(p) {
  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-01"); await p.keyboard.press("Enter");
  await p.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Hitting/ }).click(); await p.locator(".snackbar").waitFor();
  await p.locator(".snackbar").getByRole("button", { name: "Edit" }).click();
  await p.getByRole("dialog", { name: /^Hitting/ }).waitFor();
  return p.locator(".log-sheet"); // its name changes on the pick step
}

(async () => {
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, bypassCSP: true });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const sheet = await openSheet(p);
  const before = (await stored(p)).logs[0];
  await p.waitForTimeout(400); // the sheet has finished sliding up
  await p.screenshot({ path: `${OUT}/correct-behavior-row.png` });
  await axe(p, "details with the behavior row");

  await sheet.getByRole("button", { name: "Change behavior" }).click();
  await p.getByRole("dialog", { name: /^Which behavior was it/ }).waitFor();
  const shown = await sheet.locator("button.choice").allTextContents();
  ok(shown.length === 28 && !shown.some((t) => t.startsWith("Hitting")), "the list has the other 28 behaviors, not the one already picked");
  ok(await sheet.getByRole("button", { name: "Change behavior" }).isDisabled(), "Change behavior waits for a pick");
  await sheet.getByRole("button", { name: "Kicking" }).click();
  await p.screenshot({ path: `${OUT}/correct-behavior-pick.png` });
  await axe(p, "pick step");
  await sheet.getByRole("button", { name: "Back" }).click();
  let d = await stored(p);
  ok(d.changes.length === 0 && d.logs[0].itemId === before.itemId, "Back saves nothing");

  await sheet.getByRole("button", { name: "Change behavior" }).click();
  await sheet.getByRole("button", { name: "Kicking" }).click();
  await sheet.getByRole("button", { name: "Change behavior" }).click();
  await p.getByRole("dialog", { name: /^Kicking/ }).waitFor();
  d = await stored(p);
  ok(d.logs.length === 1, "still one log: nothing deleted, no second log");
  ok(d.logs[0].uid === before.uid && d.logs[0].at === before.at && d.logs[0].loggedAt === before.loggedAt, "same log: same ID and times");
  ok(d.logs[0].itemId === 8 && d.logs[0].rev === 2 && d.logs[0].deletedAt === undefined, "it is now item 8, revision 2, still counting");
  const c = d.changes[0];
  ok(d.changes.length === 1 && c.action === "edit" && c.reason === "wrong_item" && c.from.itemId === 7 && c.to.itemId === 8, "one history entry: item 7 to 8, reason wrong_item");
  await sheet.getByText("Change history (1)").click();
  const hist = await sheet.locator(".log-history li").allTextContents();
  ok(hist.length === 2 && hist[1].includes("behavior Hitting to Kicking") && hist[1].includes("Wrong behavior"), "the history view shows the old and new behavior and the reason");
  await p.screenshot({ path: `${OUT}/correct-behavior-history.png` });
  await axe(p, "after the correction");
  ok((await p.evaluate(() => [...document.querySelectorAll(".tile")].find((t) => t.textContent.startsWith("Kicking"))?.querySelector(".tile-count")?.textContent ?? "")).startsWith("1"), "Kicking's tile counts the log today");

  // Keyboard: Back from the pick list returns focus to the Change button.
  await sheet.getByRole("button", { name: "Change behavior" }).focus();
  await p.keyboard.press("Enter");
  await p.getByRole("dialog", { name: /^Which behavior was it/ }).waitFor();
  await sheet.getByRole("button", { name: "Back" }).focus();
  await p.keyboard.press("Enter");
  await p.getByRole("dialog", { name: /^Kicking/ }).waitFor();
  ok(await p.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Change behavior"), "Back by keyboard returns focus to Change");

  // A held edit (note 019) survives a correction and is saved on its own, with its own reason.
  await sheet.getByRole("button", { name: "Mealtime" }).click();
  await sheet.getByRole("button", { name: "Change behavior" }).click();
  await sheet.getByRole("button", { name: "Pushing" }).click();
  await sheet.getByRole("button", { name: "Change behavior" }).click();
  await p.getByRole("dialog", { name: /^Pushing/ }).waitFor();
  d = await stored(p);
  ok(d.logs[0].itemId === 10 && d.logs[0].rev === 3 && d.logs[0].before === undefined, "a correction saves at once and leaves a held edit unsaved");
  await sheet.getByRole("button", { name: "Save change" }).click();
  await sheet.getByRole("button", { name: "Other" }).click();
  await sheet.getByRole("button", { name: "Save change" }).click();
  await sheet.getByText("Change history (3)").waitFor();
  d = await stored(p);
  ok(d.logs[0].itemId === 10 && d.logs[0].before === "Mealtime" && d.logs[0].rev === 4, "the held edit then saves on the corrected log");

  // Deleted behind the open sheet (another tab): the correction is refused and the sheet says so.
  await p.evaluate(() => new Promise((res) => {
    const r = indexedDB.open("cmai-tracker");
    r.onsuccess = () => {
      const st = r.result.transaction("observations", "readwrite").objectStore("observations");
      const g = st.getAll();
      g.onsuccess = () => { st.put({ ...g.result[0], deletedAt: Date.now(), deleteReason: "Tapped by mistake" }).onsuccess = res; };
    };
  }));
  await sheet.getByRole("button", { name: "Change behavior" }).click();
  await sheet.getByRole("button", { name: "Kicking" }).click();
  await sheet.getByRole("button", { name: "Change behavior" }).click();
  await sheet.getByRole("alert").waitFor();
  d = await stored(p);
  ok((await sheet.getByRole("alert").innerText()).includes("was deleted") && d.logs[0].itemId === 10 && d.changes.length === 3, "a log deleted behind the sheet is not changed, and the sheet says so");
  await p.keyboard.press("Escape");
  await p.locator(".log-sheet[open]").waitFor({ state: "detached" }).catch(() => {});
  const tiles = p.getByRole("group", { name: "All behaviors" });
  ok(!(await tiles.getByRole("button", { name: /^Hitting/ }).locator(".tile-count").count()), "Hitting's tile no longer counts it");
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await ctx.close();

  for (const [name, colorScheme, high] of [["dark", "dark", false], ["light, high contrast", "light", true], ["dark, high contrast", "dark", true]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const q = await c.newPage();
    const s = await openSheet(q);
    await axe(q, `details, ${name}`);
    await s.getByRole("button", { name: "Change behavior" }).click();
    await s.getByRole("button", { name: "Kicking" }).click();
    await axe(q, `pick step, ${name}`);
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
