// On-phone PIN (R1 option A, plan 5.3) on the LAB build: asked once per shift, never between
// opening the app and a tile; wrong PINs said in words; a wait from the 5th; the setup PIN gives
// a new PIN; keys of 64 px or more; axe on the sign-in screen in four display modes.
// usage: node e2e/sign-in.cjs URL OUTDIR   (URL serves a build made with VITE_STUDY_MODE=lab)
const { chromium } = require("playwright");
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

// A phone with a setup PIN, P-01, and JM (C-01) with PIN 2580; signed in as JM.
async function setUp(p) {
  await p.goto(URL);
  await p.getByRole("button", { name: "Add a patient" }).click();
  await p.getByLabel("New patient code").fill("P-01"); await p.keyboard.press("Enter");
  await p.locator(".cg-chip").click();
  await heading(p, "Choose a setup PIN");
  await pinIn(p, "246810", "Enter the setup PIN again");
  await pinIn(p, "246810", "Add the first caregiver");
  await p.getByLabel("Caregiver initials").fill("JM"); await p.keyboard.press("Enter");
  // A first PIN needs the setup PIN, so nobody can claim a caregiver who has not signed in yet.
  await heading(p, "Setup PIN");
  await pinIn(p, "246810", "Choose a PIN for JM");
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, bypassCSP: true });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await setUp(p);
  await p.screenshot({ path: `${OUT}/sign-in-new-pin.png` });

  // The keypad: big keys, dots announced in words, easy PINs refused.
  const sizes = await p.locator(".keypad .key").evaluateAll((ks) => ks.map((k) => Math.min(k.getBoundingClientRect().width, k.getBoundingClientRect().height)));
  ok(sizes.length === 11 && sizes.every((s) => s >= 64), `11 keys, each 64 px or more (${Math.min(...sizes)} px)`);
  await p.getByRole("button", { name: "2", exact: true }).click();
  await p.getByRole("button", { name: "5", exact: true }).click();
  ok((await p.locator(".pinpad .sr").textContent()) === "2 of 4 digits entered", "the dots are announced as 2 of 4 digits entered");
  await p.getByRole("button", { name: "Delete last digit" }).click();
  ok((await p.locator(".pinpad .sr").textContent()) === "1 of 4 digits entered", "delete removes one digit");
  await p.getByRole("button", { name: "Delete last digit" }).click();
  await axe(p, "choose a PIN");
  await pinIn(p, "1234");
  await p.getByRole("alert").filter({ hasText: "too easy to guess" }).waitFor(); ok(true, "1234 is refused in words");
  await pinIn(p, "2580", "Enter it again");
  await pinIn(p, "2589");
  await p.getByRole("alert").filter({ hasText: "different" }).waitFor(); ok(true, "two different PINs are refused in words");
  await pinIn(p, "2580", "Enter it again");
  await pinIn(p, "2580");
  await p.locator(".cg-chip", { hasText: "JM" }).waitFor(); ok(true, "JM is signed in after choosing a PIN");

  // Once per shift: reopening within 12 hours asks nothing; one tap logs.
  await p.reload();
  const hit = p.getByRole("tabpanel").getByRole("button", { name: /^Hitting/ });
  await p.locator("nav.tabs button", { hasText: "Log" }).click();
  await hit.waitFor();
  ok(await p.locator(".signin").count() === 0, "reopening within 12 hours asks no PIN");
  await hit.click(); await p.locator(".snackbar").waitFor(); ok(true, "one tap logs after reopening");

  // After 12 hours the PIN is asked again; nothing of the app shows behind it.
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("cmai-session")); s.at -= 12 * 3600 * 1000; localStorage.setItem("cmai-session", JSON.stringify(s)); });
  await p.reload();
  await heading(p, "Who is logging?");
  ok(await p.locator("nav.tabs").count() === 0 && await p.locator(".pt-banner").count() === 0, "after 12 hours the sign-in screen covers the app");
  await axe(p, "who is logging, signed out");
  await p.getByRole("button", { name: /^JM/ }).click();
  await heading(p, "PIN for JM");
  await p.screenshot({ path: `${OUT}/sign-in-pin.png` });
  await axe(p, "PIN for JM");

  // Wrong PINs: said in words, a wait from the 5th.
  await pinIn(p, "1111");
  await p.getByRole("alert").filter({ hasText: "Wrong PIN. 4 tries left before a wait." }).waitFor(); ok(true, "a wrong PIN says so in words, with the tries left");
  for (let i = 0; i < 4; i++) { await pinIn(p, "1111"); await p.waitForTimeout(100); await p.locator(".key:not([disabled])").first().waitFor({ timeout: 5000 }).catch(() => {}); }
  await p.getByRole("alert").filter({ hasText: /Too many tries: wait \d+ seconds/ }).waitFor(); ok(true, "the 5th wrong PIN starts a wait, in words");
  ok(await p.locator(".keypad .key[disabled]").count() >= 10, "the keypad is off during the wait");
  await p.screenshot({ path: `${OUT}/sign-in-wait.png` });

  // Forgot PIN: the setup PIN gives JM a new one (and works during a wait).
  await p.getByRole("button", { name: "Forgot PIN?" }).click();
  await heading(p, "Setup PIN");
  await pinIn(p, "246810", "Choose a PIN for JM");
  await pinIn(p, "3691", "Enter it again");
  await pinIn(p, "3691");
  await p.locator(".cg-chip", { hasText: "JM" }).waitFor(); ok(true, "the setup PIN gives JM a new PIN and signs them in");

  // Switching asks the other caregiver's PIN; Cancel keeps the one signed in; Sign out ends the shift.
  await p.locator("nav.tabs button", { hasText: "Settings" }).click();
  await p.getByRole("link", { name: /Caregivers/ }).click();
  await p.getByLabel("Caregiver initials").fill("AB"); await p.keyboard.press("Enter");
  await p.getByText("Added AB as C-02.").waitFor();
  await p.locator("nav.tabs button", { hasText: "Log" }).click();
  await p.locator(".cg-chip").click();
  await p.getByRole("dialog", { name: "Who is logging?" }).getByRole("button", { name: /^AB/ }).click();
  await heading(p, "Setup PIN");
  ok((await p.locator(".signin .muted").first().textContent()).includes("AB has no PIN yet"), "a caregiver with no PIN yet cannot be claimed without the setup PIN");
  await p.keyboard.type("135799");
  await p.locator(".signin .msg.error").waitFor();
  ok(await p.getByRole("heading", { name: "Setup PIN" }).isVisible(), "a wrong setup PIN does not open Choose a PIN");
  await pinIn(p, "246810", "Choose a PIN for AB");
  await p.getByRole("button", { name: "Cancel" }).click();
  await p.locator(".cg-chip", { hasText: "JM" }).waitFor(); ok(true, "Cancel on a switch keeps JM signed in");
  await p.locator(".cg-chip").click();
  await p.getByRole("dialog", { name: "Who is logging?" }).getByRole("button", { name: "Sign out" }).click();
  await heading(p, "Who is logging?");
  ok(await p.locator(".signin").count() === 1, "Sign out shows the sign-in screen");
  ok(await p.evaluate(() => localStorage.getItem("cmai-session")) === null, "Sign out forgets the shift");
  const stored = await p.evaluate(() => JSON.stringify(localStorage));
  ok(!stored.includes("2580") && !stored.includes("3691") && !stored.includes("246810"), "no PIN is kept in localStorage");
  // After clear and restore the phone has caregivers but no setup PIN: it is chosen before anyone gets a PIN.
  await p.evaluate(() => new Promise((res) => { const r = indexedDB.open("cmai-tracker"); r.onsuccess = () => { const t = r.result.transaction("meta", "readwrite"); t.objectStore("meta").delete("setupPin"); t.oncomplete = () => { r.result.close(); res(); }; }; }));
  await p.reload();
  await heading(p, "Choose a setup PIN");
  ok(await p.locator(".signin-list").count() === 0, "with no setup PIN, the caregiver list waits until one is chosen");
  ok(errs.length === 0, "no page errors: " + errs.join("; "));
  await ctx.close();

  // The sign-in screen in every display mode.
  for (const [name, colorScheme, high] of [["dark", "dark", false], ["light, high contrast", "light", true], ["dark, high contrast", "dark", true]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme, bypassCSP: true });
    if (high) await c.addInitScript(() => localStorage.setItem("cmai-contrast", "high"));
    const q = await c.newPage();
    await setUp(q);
    await axe(q, `choose a PIN, ${name}`);
    await pinIn(q, "1234");
    await q.getByRole("alert").waitFor();
    await axe(q, `refused PIN, ${name}`);
    if (name === "dark") await q.screenshot({ path: `${OUT}/sign-in-new-pin-dark.png` });
    await c.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
