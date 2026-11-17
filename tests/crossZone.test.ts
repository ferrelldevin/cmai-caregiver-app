// G2: the export's time-zone arithmetic against Python's zoneinfo, in about 20 zones, around every
// clock change of 2026. The app computes offsets with Intl; the lab reader checks them with zoneinfo.
// Two independent tables that must agree, including half-hour and 45-minute zones and a 30-minute change.
declare const process: { cwd: () => string };

import "fake-indexeddb/auto";
// @ts-expect-error this repo has no @types/node; these modules ship with Node
import { spawnSync } from "node:child_process";
// @ts-expect-error see above
import fs from "node:fs";
// @ts-expect-error see above
import os from "node:os";
// @ts-expect-error see above
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/data/db";
import { buildResearchExport, zoneOffsetMin, zonedToUtc } from "../src/data/researchExport";

const ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/St_Johns",
  "America/Sao_Paulo",
  "America/Santiago",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Berlin",
  "Europe/Athens",
  "Africa/Cairo",
  "Asia/Tehran",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Australia/Adelaide",
  "Australia/Lord_Howe",
  "Pacific/Auckland",
  "Pacific/Chatham",
  "Pacific/Apia",
];

const CONTRACT = path.join(process.cwd(), "docs/contracts/cmai-export");
const Y2026 = Date.UTC(2026, 0, 1);
const HOUR = 3_600_000;
const localDay = (tz: string, ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);

/** Every instant in 2026 (to the hour) where the zone's offset changes: JS finds it, Python is asked to confirm. */
function changes(tz: string): number[] {
  const out: number[] = [];
  let prev = zoneOffsetMin(tz, Y2026);
  for (let t = Y2026 + HOUR; t < Y2026 + 366 * 24 * HOUR; t += HOUR) {
    const cur = zoneOffsetMin(tz, t);
    if (cur !== prev) out.push(t);
    prev = cur;
  }
  return out;
}

/** Offsets (minutes) and local midnights from Python's zoneinfo for the given instants. */
function pythonOffsets(tz: string, instants: number[], days: string[]) {
  const code = `
import json, sys
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
d = json.load(sys.stdin); z = ZoneInfo(d["tz"])
offs = [round(datetime.fromtimestamp(t/1000, timezone.utc).astimezone(z).utcoffset().total_seconds()/60) for t in d["instants"]]
mid = []
for day in d["days"]:
    y, m, dd = map(int, day.split("-"))
    mid.append(int(datetime(y, m, dd, tzinfo=z).astimezone(timezone.utc).timestamp()*1000))
print(json.dumps({"offs": offs, "mid": mid}))`;
  const r = spawnSync("python3", ["-I", "-c", code], {
    input: JSON.stringify({ tz, instants, days }),
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout) as { offs: number[]; mid: number[] };
}

beforeEach(async () => {
  for (const t of db.tables) await t.clear();
  await db.patients.put({ id: "P-01", anchor: Y2026, demo: true });
});

describe("export time zones, JS against Python zoneinfo (G2)", () => {
  it("really finds the clock changes (so the tests below are not empty)", () => {
    const count = (tz: string) => changes(tz).length;
    expect(count("America/New_York")).toBe(2);
    expect(count("Australia/Lord_Howe")).toBe(2);
    expect(count("Pacific/Chatham")).toBe(2);
    expect(count("Asia/Kolkata")).toBe(0);
    expect(
      zoneOffsetMin("Australia/Lord_Howe", Date.UTC(2026, 0, 15)) -
        zoneOffsetMin("Australia/Lord_Howe", Date.UTC(2026, 6, 15)),
    ).toBe(30);
  });

  it.each(ZONES)("%s: offsets and local midnights agree around every 2026 clock change", (tz) => {
    const shifts = changes(tz);
    const instants: number[] = [];
    const days = new Set<string>();
    for (const s of shifts)
      for (let m = -240; m <= 240; m += 15) {
        instants.push(s + m * 60_000);
        days.add(localDay(tz, s + m * 60_000));
      }
    // And a plain winter and summer instant, so zones with no change are still checked.
    instants.push(Date.UTC(2026, 0, 15, 12), Date.UTC(2026, 6, 15, 12));
    const py = pythonOffsets(tz, instants, [...days]);
    expect(instants.map((t) => zoneOffsetMin(tz, t))).toEqual(py.offs);
    expect(
      [...days].map((d) => {
        const [y, m, dd] = d.split("-").map(Number);
        return zonedToUtc(tz, y, m, dd);
      }),
    ).toEqual(py.mid);
  });

  it.each(ZONES)("%s: a file of logs across each clock change passes the Python reader", async (tz) => {
    const shifts = changes(tz);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cmai-zone-"));
    for (const s of shifts) {
      await db.observations.clear();
      for (let m = -180; m <= 180; m += 30) {
        const at = s + m * 60_000;
        await db.observations.add({
          patientId: "P-01",
          itemId: 5,
          at,
          loggedAt: at + 60_000,
          tzOffsetMin: zoneOffsetMin(tz, at),
          uid: crypto.randomUUID(),
          deviceId: "d".repeat(8) + "-0000-4000-8000-" + "0".repeat(12),
          rev: 1,
        });
      }
      const out = await buildResearchExport({
        patientId: "P-01",
        startDay: localDay(tz, s - 24 * HOUR),
        endDay: localDay(tz, s + 24 * HOUR),
        tz,
        now: Date.UTC(2026, 11, 1),
        deviceId: "e".repeat(8) + "-0000-4000-8000-" + "0".repeat(12),
      });
      const file = path.join(tmp, "x.json");
      fs.writeFileSync(file, out.text);
      const r = spawnSync("python3", [path.join(CONTRACT, "cmai_export_check.py"), file], { encoding: "utf8" });
      expect(r.status, `${tz} at ${new Date(s).toISOString()}: ${r.stdout}${r.stderr}`).toBe(0);
    }
  });
});
