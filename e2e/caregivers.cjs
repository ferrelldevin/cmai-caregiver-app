// Caregiver profiles (R2, plan 5.2) on the LAB build: codes and initials, who is logging,
// "by" on every new record, My residents first in the switcher, and axe on each new screen in
// four display modes. The caregiver build never shows any of it (checked by every other e2e script).
// The PIN is switched off (design note 030 step 5): nothing here asks for one. e2e/sign-in.cjs checks the PIN on its own build.
// usage: node e2e/caregivers.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab)
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

// G11: with change reasons on, edits are held until "Save change". It saves them with a reason worked
// out from what changed and closes the sheet (design note 030 step 4); a refused save keeps it open.
const saveChange = async (sheet) => {
  await sheet.getByRole("button", { name: "Save change" }).click();
};

(async () => {
  const b = await engine.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, bypassCSP: true });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(URL);
  await p.getByRole("heading", { name: "Welcome to CMAI Tracker" }).waitFor();
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-01"); await p.keyboard.press("Enter");
  const hit = p.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Hitting/ });
  await hit.waitFor();

  // No caregiver yet: the app works as before, and the chip leads to adding one.
  await hit.click(); await p.locator(".snackbar").waitFor();
  ok(true, "with no caregiver, one tap still logs");
  ok((await stored(p)).observations.every((o) => o.by === undefined), "a log made with no caregiver has no code");
  const chip = p.locator(".cg-chip");
  ok((await chip.textContent()).includes("Who?"), "the chip asks Who? when nobody is logging");
  await chip.click();
  await p.getByRole("heading", { name: "Add the first caregiver" }).waitFor();
  ok((await p.getByText(/PIN/).count()) === 0, "the chip opens Add the first caregiver, and nothing asks for a PIN");
  await axe(p, "caregivers page, empty");

  // Initials only.
  const field = p.getByLabel("Caregiver initials");
  ok((await p.locator("#cg-hint").textContent()).includes("Initials only, not a name"), "the form says initials only, not a name");
  await field.fill("Jane"); ok((await field.inputValue()) === "Jan", "the field takes 3 letters at most");
  await field.fill("J"); await p.keyboard.press("Enter");
  await p.getByRole("alert").filter({ hasText: "Initials only" }).waitFor(); ok(true, "one letter is refused");
  await field.fill("jm"); await p.keyboard.press("Enter");
  await p.getByText("C-01 · logging now").waitFor(); ok(true, "JM is C-01 and is logging, with no PIN to choose");
  await field.fill("ab"); await p.keyboard.press("Enter");
  await p.getByText("Added AB as C-02.").waitFor(); ok(true, "AB is C-02");
  ok((await chip.textContent()).includes("JM"), "the first caregiver added is the one logging");
  // F-58: a role for research exports, stored once on the profile. Caregiver unless changed.
  const role = p.getByRole("radiogroup", { name: "Role for JM" });
  ok(await role.getByRole("radio", { name: "Caregiver" }).isChecked(), "the role starts as Caregiver");
  await role.getByRole("radio", { name: "Researcher" }).check();
  await p.waitForFunction(() => new Promise((res) => { const r = indexedDB.open("cmai-tracker"); r.onsuccess = () => { const g = r.result.transaction("caregivers").objectStore("caregivers").getAll(); g.onsuccess = () => { r.result.close(); res(g.result.some((c) => c.initials === "JM" && c.role === "researcher")); }; }; }));
  ok(await role.getByRole("radio", { name: "Researcher" }).isChecked(), "the role is saved on the profile and shown");
  // The role sits on its own line: nothing in a caregiver's row overlaps or runs past the card.
  const fit = await p.evaluate(() => {
    const card = document.querySelector(".patient-list").getBoundingClientRect();
    return [...document.querySelectorAll(".patient-list li")].every((li) => {
      const text = li.querySelector(".patient-main").getBoundingClientRect();
      const actions = li.querySelector(".row").getBoundingClientRect();
      const pick = li.querySelector(".role-pick").getBoundingClientRect();
      const choices = [...li.querySelectorAll(".role-pick label")];
      return text.right <= actions.left && actions.right <= card.right + 1 && pick.right <= card.right + 1 &&
        pick.top >= Math.max(text.bottom, actions.bottom) &&
        choices.every((l) => {
          const word = l.querySelector("span"), hit = l.querySelector("input").getBoundingClientRect();
          return word.scrollWidth <= word.clientWidth && hit.height >= 44 && hit.left >= pick.left && hit.right <= pick.right + 1;
        });
    });
  });
  ok(fit, "at phone width each row's text, actions and role fit the card without overlapping, and every role target is 44 px tall");
  await p.screenshot({ path: `${OUT}/caregivers-page.png` });

  // A log carries who made it; switching is one tap from the chip and never asked for.
  await p.locator("nav.tabs button", { hasText: "Log" }).click();
  await hit.click(); await p.locator(".snackbar").waitFor();
  // Today lists the log with who made it (F-27 moved recent logs there).
  await p.locator("nav.tabs button", { hasText: "Today" }).click();
  await p.locator(".acc-head", { hasText: "Hitting" }).click();
  ok((await p.locator(".acc-body").textContent()).includes("by JM"), "Today says the log was by JM");
  await p.locator("nav.tabs button", { hasText: "Log" }).click();
  await chip.click();
  const who = p.getByRole("dialog", { name: "Who is logging?" });
  await who.waitFor(); ok(true, "the chip opens Who is logging?");
  await axe(p, "Who is logging? sheet");
  // With the PIN off there is no shift to end: Manage caregivers is the sheet's one action (Sign out is checked with the PIN, e2e/sign-in.cjs).
  ok((await who.locator(".sheet-actions button").count()) === 1 && (await who.getByRole("button", { name: "Sign out" }).count()) === 0, "the sheet offers Manage caregivers and no Sign out");
  await who.getByRole("button", { name: /^AB/ }).click();
  await p.locator(".switch-notice", { hasText: "AB is logging" }).waitFor(); ok(true, "switching is that one tap, and says who is logging now");
  // Who is logging is remembered on this phone: closing and opening the app asks nothing (design note 030 step 5).
  await p.reload();
  await hit.waitFor();
  ok((await p.locator(".signin").count()) === 0 && (await p.getByText(/PIN/).count()) === 0 && (await chip.textContent()).includes("AB"), "after a reload the app opens on the tiles with AB still logging, and no sign-in screen");
  const nBefore = (await stored(p)).observations.length;
  await hit.click(); await p.locator(".snackbar").waitFor();
  const made = (await stored(p)).observations;
  ok(made.length === nBefore + 1 && made[made.length - 1].by === "C-02", "the first tap after opening logs, and the log carries AB's code");
  await chip.click();
  await who.getByRole("button", { name: /^JM/ }).click();
  await p.locator(".switch-notice", { hasText: "JM is logging" }).waitFor();
  await chip.click();
  await who.getByRole("button", { name: /^AB/ }).click();
  await p.locator(".switch-notice", { hasText: "AB is logging" }).waitFor(); ok(true, "switching back and forth is one tap each way");
  // The message sits just above the tab bar: clear of the banner, any page title and any Back button.
  await p.waitForTimeout(300);
  const spot = await p.evaluate(() => {
    const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right }; };
    const n = box(".switch-notice"), tabs = box("nav.tabs"), pin = box(".pin");
    const hits = [...document.querySelectorAll("h1, h2, .back-btn")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.left < n.r && r.right > n.l && r.top < n.b && r.bottom > n.t; }).length;
    return { aboveTabs: n.b <= tabs.t, belowBanner: n.t >= pin.b, hits, inView: n.l >= 0 && n.r <= innerWidth };
  });
  ok(spot.aboveTabs && spot.belowBanner && spot.inView && spot.hits === 0, `the message sits above the tab bar and covers no title or Back button (${JSON.stringify(spot)})`);
  // The longest message the app can make (a 12-letter patient code) wraps inside a 320 px screen.
  await p.setViewportSize({ width: 320, height: 844 });
  const long = await p.evaluate(() => {
    const n = document.querySelector(".switch-notice"), c = n.cloneNode(true);
    c.className = "switch-notice on"; c.removeAttribute("role"); c.lastChild.textContent = " Now on WWWWWWWWWWWW";
    n.parentNode.appendChild(c);
    const r = c.getBoundingClientRect(), tabs = document.querySelector("nav.tabs").getBoundingClientRect();
    const out = { l: r.left, r: r.right, b: r.bottom, w: innerWidth, tabsTop: tabs.top, clipped: c.scrollWidth > c.clientWidth };
    c.remove();
    return out;
  });
  ok(long.l >= 0 && long.r <= long.w && long.b <= long.tabsTop && !long.clipped, `the longest message stays inside a 320 px screen (${JSON.stringify(long)})`);
  await p.setViewportSize({ width: 390, height: 844 });
  ok((await chip.textContent()).includes("AB"), "the chip shows AB");
  await p.waitForTimeout(700);
  await p.getByRole("group", { name: "All behaviors" }).getByRole("button", { name: /^Kicking/ }).click(); await p.locator(".snackbar", { hasText: "Kicking" }).waitFor();
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
  await saveChange(p.locator(".log-sheet"));
  await sheet.waitFor({ state: "hidden" });
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
  await sw.locator(".sheet-group").nth(1).waitFor(); // the groups fill in after the assignments load
  const heads = await sw.locator(".sheet-group").allTextContents();
  ok(heads.join("|") === "My residents|Others on this phone", "the switcher has My residents, then Others on this phone: " + heads.join("|"));
  const codes = await sw.locator(".sheet-code").allTextContents();
  ok(codes.join(",") === "P-03,P-01,P-02", "P-03 then P-01 (AB's order), then P-02: " + codes.join(","));
  await p.screenshot({ path: `${OUT}/caregivers-switcher.png` });
  await axe(p, "switcher with My residents");
  await sw.getByRole("button", { name: /^P-02/ }).click();
  ok((await p.locator(".pt-id b").textContent()) === "P-02", "a resident outside My residents is one tap away");

  // Removing a caregiver asks first (design note 026): Cancel keeps them, the confirm removes or archives.
  await p.locator("nav.tabs button", { hasText: "Settings" }).click();
  await p.locator(".menu-row", { hasText: "Caregivers" }).click();
  await p.getByLabel("Caregiver initials").fill("qr"); await p.keyboard.press("Enter");
  await p.getByText("Added QR as C-03.").waitFor();
  await p.getByRole("button", { name: "Remove QR" }).click();
  const ask = p.getByRole("dialog", { name: "Remove QR?" });
  await ask.waitFor();
  ok((await ask.textContent()).includes("stay, with the code C-03"), "Remove asks first and says the logs keep the code");
  await axe(p, "Remove caregiver sheet");
  await p.screenshot({ path: `${OUT}/caregivers-remove.png` });
  await ask.getByRole("button", { name: "Cancel" }).click();
  await ask.waitFor({ state: "hidden" });
  ok(await p.getByRole("button", { name: "Remove QR" }).isVisible(), "Cancel keeps the caregiver");
  await p.getByRole("button", { name: "Remove QR" }).click();
  await ask.getByRole("button", { name: "Remove QR" }).click();
  await p.getByText("Removed QR (C-03).").waitFor();
  const profiles = () => p.evaluate(() => new Promise((res) => { const r = indexedDB.open("cmai-tracker"); r.onsuccess = () => { const g = r.result.transaction("caregivers").objectStore("caregivers").getAll(); g.onsuccess = () => { r.result.close(); res(g.result); }; }; }));
  ok(!(await profiles()).some((c) => c.id === "C-03"), "confirming deletes a caregiver with no logs");
  await p.getByRole("button", { name: "Remove JM" }).click();
  await p.getByRole("dialog", { name: "Remove JM?" }).getByRole("button", { name: "Remove JM" }).click();
  await p.getByText("JM (C-01) is archived. Their logs keep their code.").waitFor();
  ok((await profiles()).some((c) => c.id === "C-01" && c.archivedAt) && (await stored(p)).observations.some((o) => o.by === "C-01"), "confirming archives a caregiver who has logs, and the logs keep C-01");
  ok((await p.getByRole("button", { name: "Remove JM" }).count()) === 0, "the archived caregiver leaves the list");
  await p.getByRole("button", { name: "Remove AB" }).click();
  ok((await p.getByRole("dialog", { name: "Remove AB?" }).textContent()).includes("AB is logging now"), "removing whoever is logging says nobody will be chosen");
  await p.keyboard.press("Escape");
  ok(await p.getByRole("button", { name: "Remove AB" }).isVisible(), "Esc keeps the caregiver");
  ok(await p.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Remove AB"), "closing the sheet puts focus back on the button that opened it");
  await p.getByRole("button", { name: "Remove AB" }).click();
  await p.getByRole("dialog", { name: "Remove AB?" }).getByRole("button", { name: "Remove AB" }).click();
  await p.locator(".cg-chip", { hasText: "Who?" }).waitFor(); ok(true, "after removing whoever was logging, nobody is chosen");
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
    await q.getByLabel("Caregiver initials").fill("JM"); await q.keyboard.press("Enter");
    await q.getByText("C-01 · logging now").waitFor();
    // Three wide letters, the most a caregiver can have, stay inside the round badge.
    await q.getByLabel("Caregiver initials").fill("WWW"); await q.keyboard.press("Enter");
    await q.getByText("Added WWW as C-02.").waitFor();
    // The text box's corners must lie inside the circle, not just inside the square around it.
    const fits = (sel) => q.locator(sel, { hasText: "WWW" }).evaluateAll((els) => els.length > 0 && els.every((e) => {
      const g = document.createRange(); g.selectNodeContents(e);
      const t = g.getBoundingClientRect(), radius = e.clientWidth / 2;
      return e.classList.contains("long") && e.clientWidth === e.clientHeight && Math.hypot(t.width / 2, t.height / 2) <= radius;
    }));
    ok(await fits(".patient-list .cg-badge"), `three letters fit the badge in the caregiver list, ${name}`);
    // A 320 px phone: no sideways scroll, and each caregiver's code stays on one line.
    await q.setViewportSize({ width: 320, height: 844 });
    const narrow = await q.evaluate(() => ({
      over: document.documentElement.scrollWidth - innerWidth,
      oneLine: [...document.querySelectorAll(".cg-list .cg-code")].every((e) => e.getClientRects().length === 1) && [...document.querySelectorAll(".cg-list .patient-main")].every((e) => e.scrollWidth <= e.clientWidth + 1),
      inCard: [...document.querySelectorAll(".cg-list button")].every((e) => e.getBoundingClientRect().right <= e.closest(".card").getBoundingClientRect().right),
    }));
    ok(narrow.over <= 0 && narrow.oneLine && narrow.inCard, `the caregiver list fits a 320 px phone, ${name} (${JSON.stringify(narrow)})`);
    await q.setViewportSize({ width: 390, height: 844 });
    await axe(q, `caregivers page, ${name}`);
    await q.locator("nav.tabs button", { hasText: "Log" }).click();
    await q.locator(".cg-chip").click();
    await q.getByRole("dialog", { name: "Who is logging?" }).waitFor();
    await axe(q, `Who is logging?, ${name}`);
    ok(await fits(".sheet-row .cg-badge"), `three letters fit the badge in Who is logging?, ${name}`);
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
