// Fails when a built script is bigger than the budget (build plan step 2.8). Run after `npm run build`.
// Sizes are bytes on disk, before compression. The entry script is the one index.html loads first.
// Budget: the entry measured about 302 KB on 2026-11-10 with Recharts loaded only on Scores; 330 KB is
// that plus about 10%. The plan's first guess of 250 KB was below what React and Dexie alone take.
// 2026-11-11: raised to 415 KB. Main moved to React 19 and Vite 8 and merged features; the entry now measures
// 376 KB (415 is that plus about 10%). No Recharts, duplicate library or dev-only code is in the entry.
// 2026-11-11 (step 4.3): Log, Today and Two weeks are in the entry now, so it measures 419 KB; the limit is 460 KB
// (that plus about 10%). Step 4.4 removes Recharts and the lazy Scores chunk; its numbers are set there.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const ENTRY_LIMIT = 460 * 1000;
const CHUNK_LIMIT = 600 * 1000;

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("check-size: dist/index.html is missing. Run `npm run build` first.");
  process.exit(2);
}
const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
const entryRef =
  /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(html) ??
  /<script[^>]+src="([^"]+\.js)"[^>]+type="module"/.exec(html);
if (!entryRef) {
  console.error("check-size: could not find the entry script in dist/index.html.");
  process.exit(2);
}
const entry = path.basename(entryRef[1]);
const files = fs.readdirSync(path.join(DIST, "assets")).filter((f) => f.endsWith(".js"));
const kb = (n) => `${Math.round(n / 1000)} KB`;
const problems = [];
for (const f of files) {
  const size = fs.statSync(path.join(DIST, "assets", f)).size;
  const limit = f === entry ? ENTRY_LIMIT : CHUNK_LIMIT;
  console.log(`${f === entry ? "entry" : "chunk"} ${f}: ${kb(size)} (limit ${kb(limit)})`);
  if (size > limit) problems.push(`${f} is ${kb(size)}, over its ${kb(limit)} limit`);
}
if (problems.length) {
  console.error(`check-size failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("check-size: all scripts are within budget");
