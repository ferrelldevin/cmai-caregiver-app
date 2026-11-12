// "It stopped" (F-39, plan 5.7) on the LAB build: after logging pacing, mannerisms or
// restlessness the confirmation and the Today row offer "It stopped"; the log details sheet can
// correct the end like the start; an end before the start is refused; hitting gets none.
// axe in four display modes.
// usage: node e2e/it-stopped.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab)
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
const logs = (p) => p.evaluate(() => new Promise((res) => { const r = indexedDB.open("cmai-tracker"); r.onsuccess = () => { const g = r.result.transaction("observations").objectStore("observations").getAll(); g.onsuccess = () => { r.result.close(); res(g.result); }; }; }));
const changes = (p) => p.evaluate(() => new Promise((res) => { const r = indexedDB.open("cmai-tracker"); r.onsuccess = () => { const g = r.result.transaction("changes").objectStore("changes").getAll(); g.onsuccess = () => { r.result.close(); res(g.result); }; }; }));
async function start(p) {
  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-01"); await p.keyboard.press("Enter");
  await p.getByRole("tab", { name: /Physical/ }).click();
}
const tile = (p, name) => p.getByRole("tabpanel").getByRole("button", { name: new RegExp("^" + name) });

(async () => {
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, bypassCSP: true });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await start(p);

  await tile(p, "Pacing").click();
  const bar = p.locator(".snackbar");
  await bar.waitFor();
  const stop = bar.getByRole("button", { name: "It stopped" });
  ok(await stop.isVisible(), "the confirmation offers It stopped after pacing");
  const box = await bar.boundingBox();
  ok(box.x >= 0 && box.x + box.width <= 360, `the confirmation with three buttons fits at 360 px (${Math.round(box.width)} px)`);
  ok(await p.locator(".snackbar-title").evaluate((el) => el.scrollWidth <= el.clientWidth), "the behavior's name is not cut off");
  for (const btn of await bar.getByRole("button").all()) {
    const bb = await btn.boundingBox();
    ok(bb.height >= 24 && bb.width >= 24, `"${await btn.textContent()}" is at least 24 by 24 px`);
  }
  await p.screenshot({ path: `${OUT}/it-stopped-confirm.png` });
  await axe(p, "confirmation with It stopped");
  await stop.click();
  await bar.filter({ hasText: " to " }).waitFor();
  let ls = await logs(p);
  ok(ls.length === 1 && ls[0].endedAt >= ls[0].at, "one tap stores when it stopped");
  ok((await changes(p)).some((c) => c.action === "edit" && c.to && c.to.endedAt === ls[0].endedAt), "the change history has it");
  ok((await bar.getByRole("button", { name: "It stopped" }).count()) === 0, "the button goes once it is stored");

  // A behavior that is one event gets none.
  await p.getByRole("tab", { name: /Aggressive/ }).click();
  await tile(p, "Hitting").click();
  await bar.filter({ hasText: "Hitting" }).waitFor();
  ok((await bar.getByRole("button", { name: "It stopped" }).count()) === 0, "hitting gets no It stopped");

  // Today: an open stretch offers it on its row; a stored one shows both times.
  await p.getByRole("tab", { name: /Physical/ }).click();
  await tile(p, "Pacing").click();
  await p.waitForTimeout(700);
  await p.locator("nav.tabs button", { hasText: "Today" }).click();
  await p.getByRole("button", { name: /^Pacing/ }).click();
  const rowStop = p.getByRole("button", { name: /^It stopped: Pacing from/ });
  ok((await rowStop.count()) === 1, "Today offers It stopped on the pacing log with no end, and only there");
  ok((await p.locator(".acc-time", { hasText: " to " }).count()) === 1, "the stopped log shows both times");
  await p.screenshot({ path: `${OUT}/it-stopped-today.png` });
  await axe(p, "Today with It stopped");
  await rowStop.click();
  await p.locator(".acc-time", { hasText: " to " }).nth(1).waitFor();
  ok((await logs(p)).filter((o) => o.itemId === 1).every((o) => o.endedAt >= o.at), "Today's It stopped stores it too");

  // The sheet: correct the end like the start; an end before the start is refused.
  await p.getByRole("button", { name: /^Edit Pacing/ }).first().click();
  const ended = p.locator("#ls-ended");
  await ended.waitFor();
  ls = (await logs(p)).filter((o) => o.itemId === 1);
  const target = ls.find((o) => o.endedAt !== undefined);
  const d = new Date(target.at);
  const before = new Date(target.at - 2 * 3600_000);
  if (before.getDate() === d.getDate()) {
    const hhmm = (x) => `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
    await ended.fill(hhmm(before));
    const alert = p.locator(".log-sheet .msg.error");
    await alert.waitFor();
    ok((await alert.textContent()).includes("can't stop before it started"), "an end before the start is refused, and says why");
    ok((await logs(p)).every((o) => o.endedAt === undefined || o.endedAt >= o.at), "nothing invalid was stored");
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/it-stopped-sheet.png` });
    await axe(p, "sheet with the refusal");
  } else console.log("  (skipped the refusal step: within 2 hours of midnight)");
  await p.getByRole("button", { name: "Clear when it stopped" }).click();
  await p.waitForFunction(() => !document.querySelector("#ls-ended")?.value);
  ok(true, "Clear takes the end back");
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await ctx.close();

  for (const [name, colorScheme, high] of [["dark", "dark", false], ["light, high contrast", "light", true], ["dark, high contrast", "dark", true]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const q = await c.newPage();
    await start(q);
    await tile(q, "Pacing").click();
    await q.locator(".snackbar").getByRole("button", { name: "It stopped" }).waitFor();
    await axe(q, `confirmation, ${name}`);
    await q.locator("nav.tabs button", { hasText: "Today" }).click();
    await q.getByRole("button", { name: /^Pacing/ }).click();
    await axe(q, `Today, ${name}`);
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
