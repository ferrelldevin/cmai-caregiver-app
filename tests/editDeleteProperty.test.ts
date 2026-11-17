// G8: random edits, deletes and restores, then exports. 1,000 runs, fixed seed, lab build.
// Whatever happens, an export must agree with what the app holds, a record's revision must equal the
// number of real changes made to it, and the same (record, revision) must never carry different content
// in two exports. Every 25th run also goes through the lab's Python reader, merging its two files.
declare const process: { cwd: () => string };

import "fake-indexeddb/auto";
import fc from "fast-check";
// @ts-expect-error this repo has no @types/node; these modules ship with Node
import { spawnSync } from "node:child_process";
// @ts-expect-error see above
import fs from "node:fs";
// @ts-expect-error see above
import os from "node:os";
// @ts-expect-error see above
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/study/settings", async (orig) => {
  const m = await orig<typeof import("../src/study/settings")>();
  return { ...m, study: m.settingsFor("lab") };
});

import { db, madeHere, setLoggingCaregiver, type StoredObservation } from "../src/data/db";
import { CHANGE_REASONS, deleteLog, editLog, logVersions, restoreLog } from "../src/data/logs";
import { buildResearchExport } from "../src/data/researchExport";

const T = Date.UTC(2026, 10, 9, 12);
const MIN = 60_000;
const DEVICE = "e".repeat(8) + "-0000-4000-8000-" + "0".repeat(12);
const CHECKER = path.join(process.cwd(), "docs/contracts/cmai-export/cmai_export_check.py");
type Saved = StoredObservation & { id: number };

type Op =
  | { k: "edit-before"; log: number; before: string; reason: number }
  | { k: "edit-time"; log: number; minutes: number; reason: number }
  | { k: "delete"; log: number; reason: number }
  | { k: "restore"; log: number }
  | { k: "export" };

const op = fc.oneof(
  fc.record({
    k: fc.constant("edit-before" as const),
    log: fc.nat(2),
    before: fc.constantFrom("Mealtime", "Bathing", "Nothing noticed"),
    reason: fc.nat(5),
  }),
  fc.record({
    k: fc.constant("edit-time" as const),
    log: fc.nat(2),
    minutes: fc.integer({ min: 0, max: 500 }),
    reason: fc.nat(5),
  }),
  fc.record({ k: fc.constant("delete" as const), log: fc.nat(2), reason: fc.nat(5) }),
  fc.record({ k: fc.constant("restore" as const), log: fc.nat(2) }),
  fc.record({ k: fc.constant("export" as const) }),
);

const exportNow = (now: number) =>
  buildResearchExport({
    patientId: "P-01",
    startDay: "2026-11-09",
    endDay: "2026-11-09",
    tz: "UTC",
    now,
    deviceId: DEVICE,
  });

describe("G8 random edit and delete runs", () => {
  it("1,000 random runs keep exports, revisions and history consistent", async () => {
    let n = 0;
    await fc.assert(
      fc.asyncProperty(fc.array(op, { minLength: 1, maxLength: 14 }), async (ops: Op[]) => {
        n++;
        for (const t of db.tables) await t.clear();
        await db.patients.put({ id: "P-01", anchor: T - 86_400_000, demo: true });
        setLoggingCaregiver("C-01");
        const model = [] as { item: number; at: number; deleted: boolean; rev: number; before?: string }[];
        const rows: Saved[] = [];
        for (let i = 0; i < 3; i++) {
          const at = T + i * 10 * MIN;
          const id = await db.observations.add({
            patientId: "P-01",
            itemId: i + 1,
            at,
            loggedAt: at + MIN,
            tzOffsetMin: 0,
            ...madeHere(),
          });
          rows.push((await db.observations.get(id)) as Saved);
          model.push({ item: i + 1, at, deleted: false, rev: 1, before: undefined as string | undefined });
        }
        const seen = new Map<string, string>();
        const files: string[] = [];
        let clock = T + 3_600_000;
        const snapshot = async () => {
          const out = await exportNow(clock);
          const recs = JSON.parse(out.text).records as Record<string, unknown>[];
          expect(recs.length).toBe(3);
          for (const r of recs) {
            const i = rows.findIndex((x) => x.uid === r.record_id);
            expect(i).toBeGreaterThanOrEqual(0);
            const m = model[i];
            expect(r.revision).toBe(m.rev);
            expect(r.status).toBe(m.deleted ? "deleted" : "active");
            expect(r.cmai_item).toBe(m.item);
            expect(r.occurred_start_utc).toBe(new Date(m.at).toISOString().slice(0, 19) + "Z");
            const key = `${r.record_id}#${r.revision}`;
            const body = JSON.stringify({ ...r, revised_at_utc: undefined });
            if (seen.has(key)) expect(body, `same revision, different content: ${key}`).toBe(seen.get(key));
            seen.set(key, body);
          }
          files.push(out.text);
        };
        for (const o of ops) {
          clock += 5 * MIN;
          if (o.k === "export") {
            await snapshot();
            continue;
          }
          const i = o.log;
          const row = (await db.observations.get(rows[i].id)) as Saved;
          const m = model[i];
          if (o.k === "edit-before" && !m.deleted) {
            await editLog(row, { before: o.before }, clock, CHANGE_REASONS[o.reason]);
            if (o.before !== m.before) {
              m.before = o.before;
              m.rev++;
            }
          } else if (o.k === "edit-time" && !m.deleted) {
            const at = T + o.minutes * MIN;
            await editLog(row, { at }, clock, CHANGE_REASONS[o.reason]);
            if (at !== m.at) {
              m.at = at;
              m.rev++;
            }
          } else if (o.k === "delete") {
            await deleteLog(row, CHANGE_REASONS[o.reason], undefined, clock);
            if (!m.deleted) {
              m.deleted = true;
              m.rev++;
            }
          } else if (o.k === "restore") {
            await restoreLog(row, clock);
            if (m.deleted) {
              m.deleted = false;
              m.rev++;
            }
          }
        }
        await snapshot();
        // History: the last version of every log is its revision, and every edit or delete has a reason.
        for (let i = 0; i < 3; i++) {
          const v = await logVersions(rows[i].id);
          expect(v[v.length - 1].rev).toBe(model[i].rev);
          expect(v.length).toBe(model[i].rev);
          for (const x of v) if (x.action === "edit" || x.action === "delete") expect(x.reason).toBeTruthy();
        }
        if (n % 25 === 0) {
          const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cmai-prop-"));
          const paths = [files[0], files[files.length - 1]].map((t, j) => {
            const p = path.join(dir, `f${j}.json`);
            fs.writeFileSync(p, t);
            return p;
          });
          const r = spawnSync("python3", [CHECKER, ...paths], { encoding: "utf8" });
          expect(r.status, r.stdout + r.stderr).toBe(0);
        }
      }),
      { numRuns: 1000, seed: 20261117, endOnFailure: true },
    );
    expect(n).toBe(1000);
  }, 300_000);
});
