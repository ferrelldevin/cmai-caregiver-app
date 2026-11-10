// Caregiver profiles (R2, plan 5.2) on the LAB build: codes and initials, who is logging,
// "by" on every new record, My residents first in the switcher, and axe on each new screen in
// four display modes. The caregiver build never shows any of it (checked by every other e2e script).
// The lab build has the PIN on too (plan 5.3): this script sets PINs with pinIn(); e2e/sign-in.cjs checks the PIN itself.
// usage: node e2e/caregivers.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab)
const { chromium } = require("playwright");
const fs = require("fs");
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const [URL, OUT] = process.argv.slice(2);
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ok", m); };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Types a PIN on the keypad and waits for the next screen (the keypad listens to the keyboard).
async function pinIn(p, pin, next) {
  await p.keyboard.type(pin);
  if (next) await p.getByRole("heading", { name: next }).waitFor();
}
// Sets the setup PIN, then (after the first caregiver is added) that caregiver's PIN.
async function setupPin(p) {
  await p.getByRole("heading", { name: "Choose a setup PIN" }).waitFor();
  await pinIn(p, "246810", "Enter the setup PIN again");
  await pinIn(p, "246810", "Add the first caregiver");
}
async function newPin(p, initials, pin) {
  await p.getByRole("heading", { name: "Setup PIN" }).waitFor();
  await pinIn(p, "246810", `Choose a PIN for ${initials}`);
  await pinIn(p, pin, "Enter it again");
  await pinIn(p, pin);
  await p.locator(".cg-chip", { hasText: initials }).waitFor();
}

async function axe(p, name) {
  await p.waitForTimeout(350);
  await p.evaluate(axeSource);
  const v = await p.evaluate((tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags } }).then((r) => r.violations.map((x) => `${x.id} x${x.nodes.length}`)), TAGS);
  ok(v.length === 0, `axe, ${name}: ${v.join(", ") || "0 violations"}`);
}

// Reads every log and change from the app's own database, as the export would.
const stored = (p) => p.evaluate(() => new Promise((resolve, reject) => {
  const req = indexedDB.open("cmai-tracker");
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const tx = req.result.transaction(["observations", "changes"]);
    const out = {};
    let left = 2;
    for (const name of ["observations", "changes"]) {
      const all = tx.objectStore(name).getAll();
      all.onsuccess = () => { out[name] = all.result; if (--left === 0) { req.result.close(); resolve(out); } };
    }
  };
}));

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, bypassCSP: true });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(URL);
  await p.getByRole("heading", { name: "Welcome to CMAI Tracker" }).waitFor();
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-01"); await p.keyboard.press("Enter");
  const hit = p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ });
  await hit.waitFor();

  // No caregiver yet: the app works as before, and the chip leads to adding one.
  await hit.click(); await p.locator(".snackbar").waitFor();
  ok(true, "with no caregiver, one tap still logs");
  ok((await stored(p)).observations.every((o) => o.by === undefined), "a log made with no caregiver has no code");
  const chip = p.locator(".cg-chip");
  ok((await chip.textContent()).includes("Who?"), "the chip asks Who? when nobody is logging");
  await chip.click();
  await setupPin(p);
  ok(true, "the chip opens the setup PIN, then Add the first caregiver");
  await axe(p, "caregivers page, empty");

  // Initials only.
  const field = p.getByLabel("Caregiver initials");
  ok((await p.locator("#cg-hint").textContent()).includes("Initials only, not a name"), "the form says initials only, not a name");
  await field.fill("Jane"); ok((await field.inputValue()) === "Jan", "the field takes 3 letters at most");
  await field.fill("J"); await p.keyboard.press("Enter");
  await p.getByRole("alert").filter({ hasText: "Initials only" }).waitFor(); ok(true, "one letter is refused");
  await field.fill("jm"); await p.keyboard.press("Enter");
  await newPin(p, "JM", "2580");
  await p.getByText("C-01 · logging now").waitFor(); ok(true, "JM is C-01, sets a PIN, and is logging");
  await field.fill("ab"); await p.keyboard.press("Enter");
  await p.getByText("Added AB as C-02.").waitFor(); ok(true, "AB is C-02");
  ok((await chip.textContent()).includes("JM"), "the first caregiver added is the one logging");
  await p.screenshot({ path: `${OUT}/caregivers-page.png` });

  // A log carries who made it; switching is one tap from the chip and never asked for.
  await p.locator("nav.tabs button", { hasText: "Log" }).click();
  await hit.click(); await p.locator(".snackbar").waitFor();
  // Today lists the log with who made it (F-27 moved recent logs there).
  await p.locator(".today-count").click();
  await p.locator(".acc-head", { hasText: "Hitting" }).click();
  ok((await p.locator(".acc-body").textContent()).includes("by JM"), "Today says the log was by JM");
  await p.locator("nav.tabs button", { hasText: "Log" }).click();
  await chip.click();
  const who = p.getByRole("dialog", { name: "Who is logging?" });
  await who.waitFor(); ok(true, "the chip opens Who is logging?");
  await axe(p, "Who is logging? sheet");
  await who.getByRole("button", { name: /^AB/ }).click();
  await newPin(p, "AB", "3691");
  await p.locator(".switch-notice", { hasText: "AB is logging" }).waitFor(); ok(true, "switching (through AB's new PIN) says who is logging now");
  ok((await chip.textContent()).includes("AB"), "the chip shows AB");
  await p.waitForTimeout(700);
  await p.getByRole("tabpanel").getByRole("button", { name: /^Kicking/ }).click(); await p.locator(".snackbar", { hasText: "Kicking" }).waitFor();
  let data = await stored(p);
  const byItem = (id) => data.observations.find((o) => o.itemId === id && o.by);
  ok(byItem(7).by === "C-01" && byItem(8).by === "C-02", "the log after switching carries C-02; the earlier one keeps C-01");

  // An edit records the editor, who may not be the logger. Logs are fixed on Today.
  await p.locator("nav.tabs button", { hasText: "Today" }).click();
  const hitRow = p.locator(".acc-head", { hasText: "Hitting" });
  if ((await hitRow.getAttribute("aria-expanded")) !== "true") await hitRow.click();
  await p.locator(".acc-body li").first().getByRole("button", { name: /^Edit/ }).click();
  const sheet = p.getByRole("dialog", { name: /^Hitting/ });
  await sheet.waitFor();
  await sheet.getByRole("button", { name: "Mealtime" }).click();
  await sheet.getByRole("button", { name: "Done" }).click();
  await p.waitForTimeout(300);
  data = await stored(p);
  const edit = data.changes.find((c) => c.action === "edit");
  ok(edit && edit.by === "C-02", "the edit to JM's log is recorded as made by C-02");

  // My residents come first in the switcher, in the caregiver's order; the rest stay one tap away.
  await p.locator("nav.tabs button", { hasText: "Settings" }).click();
  for (const code of ["P-02", "P-03"]) { await p.getByLabel("New patient code").fill(code); await p.keyboard.press("Enter"); await p.locator("nav.tabs button", { hasText: "Settings" }).click(); }
  await p.getByRole("link", { name: /Caregivers/ }).click();
  await p.getByRole("heading", { name: "My residents, for AB" }).waitFor();
  await p.locator("button.choice", { hasText: "P-03" }).click();
  await p.locator("button.choice", { hasText: "P-01" }).click();
  ok((await p.locator("button.choice", { hasText: "P-01" }).textContent()).includes("2"), "the order shows as numbers");
  await axe(p, "caregivers page with My residents");
  await p.locator("nav.tabs button", { hasText: "Log" }).click();
  await p.locator(".pt-banner").click();
  const sw = p.getByRole("dialog", { name: "Choose patient" });
  await sw.waitFor();
  const heads = await sw.locator(".sheet-group").allTextContents();
  ok(heads.join("|") === "My residents|Others on this phone", "the switcher has My residents, then Others on this phone");
  const codes = await sw.locator(".sheet-code").allTextContents();
  ok(codes.join(",") === "P-03,P-01,P-02", "P-03 then P-01 (AB's order), then P-02: " + codes.join(","));
  await p.screenshot({ path: `${OUT}/caregivers-switcher.png` });
  await axe(p, "switcher with My residents");
  await sw.getByRole("button", { name: /^P-02/ }).click();
  ok((await p.locator(".pt-id b").textContent()) === "P-02", "a resident outside My residents is one tap away");
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await ctx.close();

  // The new screens in every display mode.
  for (const [name, colorScheme, high] of [["dark", "dark", false], ["light, high contrast", "light", true], ["dark, high contrast", "dark", true]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const q = await c.newPage();
    await q.goto(URL);
    await q.getByRole("button", { name: "Add a patient" }).click();
    await q.getByLabel("New patient code").fill("P-01"); await q.keyboard.press("Enter");
    await q.locator(".cg-chip").click();
    await setupPin(q);
    await q.getByLabel("Caregiver initials").fill("JM"); await q.keyboard.press("Enter");
    await newPin(q, "JM", "2580");
    await q.getByText("C-01 · logging now").waitFor();
    await axe(q, `caregivers page, ${name}`);
    await q.locator("nav.tabs button", { hasText: "Log" }).click();
    await q.locator(".cg-chip").click();
    await q.getByRole("dialog", { name: "Who is logging?" }).waitFor();
    await axe(q, `Who is logging?, ${name}`);
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
