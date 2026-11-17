// Fixed-seed seeder for the research export samples (F-56, design note 018).
// It writes made-up logs into app storage (Dexie, in a test run on fake-indexeddb), then runs the
// real export code on them, edits and deletes through the app's own editLog and deleteLog, and
// exports again. Nothing here writes JSON by hand. Item numbers only, never item wording.
//
// Frequency, review flag and role are not stored by the app today, so the seeder keeps them in a
// side table and hands them to the export as `extras`. The real action passes none.

import { db, type StoredObservation } from "../../../../src/data/db";
import {
  buildResearchExport,
  zoneOffsetMin,
  zonedToUtc,
  type LoggerRole,
  type RecordExtras,
  type ResearchExport,
} from "../../../../src/data/researchExport";
import { deleteLog, editLog } from "../../../../src/data/logs";

export const SEED = 20261117;
export const TZ = "America/New_York";
export const START_DAY = "2026-10-25";
export const END_DAY = "2026-11-08";
export const APP_VERSION = "0.3.0";
export const INSTALL_ID = "3f2b9c1e-6a4d-4e8b-9c7a-1d5e8f0a2b64";
export const EXPORT_1_AT = Date.UTC(2026, 10, 9, 15, 0, 0); // 2026-11-09T15:00:00Z
export const EXPORT_2_AT = Date.UTC(2026, 10, 9, 17, 0, 0);
const CHANGES_AT = Date.UTC(2026, 10, 9, 16, 0, 0);

/** mean records per day, by participant: two busy, two moderate, two light */
const PEOPLE = [
  { id: "P-DEMO-A", mean: 6.5 },
  { id: "P-DEMO-B", mean: 5.5 },
  { id: "P-DEMO-C", mean: 3 },
  { id: "P-DEMO-D", mean: 2.5 },
  { id: "P-DEMO-E", mean: 1.2 },
  { id: "P-DEMO-F", mean: 0.8 },
];
/** the made-up caregivers on the phone; their role is what the export reports */
const ROLE_OF: Record<string, LoggerRole> = { "C-01": "caregiver", "C-02": "staff", "C-03": "researcher" };
const OLDER_DAYS = 4; // P-DEMO-C: the first four days are logs from before database version 4

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export interface Sample {
  dir: "export-1" | "export-2";
  result: ResearchExport;
}

/** Uses and fills the database. Returns the 8 exports in the order they were made. */
export async function makeSamples(): Promise<Sample[]> {
  const rand = rng(SEED);
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const weighted = (weights: number[]) => {
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i;
    return weights.length - 1;
  };
  const uuid = () => {
    const h = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
    h[12] = "4";
    h[16] = "89ab"[Math.floor(rand() * 4)];
    return `${h.slice(0, 8).join("")}-${h.slice(8, 12).join("")}-${h.slice(12, 16).join("")}-${h.slice(16, 20).join("")}-${h.slice(20).join("")}`;
  };
  const poisson = (mean: number) => {
    const limit = Math.exp(-mean);
    let n = 0;
    for (let p = rand(); p > limit; p *= rand()) n++;
    return n;
  };

  const extras = new Map<string, RecordExtras>();
  const [y0, m0, d0] = START_DAY.split("-").map(Number);
  const anchor = zonedToUtc(TZ, y0, m0, d0);
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) await t.clear();
    const rows: StoredObservation[] = [];
    for (const person of PEOPLE) {
      await db.patients.put({ id: person.id, anchor, demo: true });
      // a few items dominate for each person
      const w = Array.from({ length: 29 }, () => 0.3);
      for (const bump of [6, 5, 3, 3]) w[Math.floor(rand() * 29)] += bump;
      for (let day = 0; day < 14; day++) {
        const date = new Date(Date.UTC(y0, m0 - 1, d0 + day));
        const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
        const older = person.id === "P-DEMO-C" && day < OLDER_DAYS;
        const n = rand() < 0.1 ? 0 : Math.min(10, poisson(person.mean));
        for (let k = 0; k < n; k++) {
          const band = rand();
          let hour: number;
          if (band < 0.55) hour = 16 + weighted([2, 4, 4, 3, 1.5, 1]);
          else if (band < 0.7) hour = [22, 23, 0, 1, 2, 3, 4, 5][weighted([0.5, 0.5, 1, 3, 3, 3, 2, 0.5])];
          else hour = 6 + Math.floor(rand() * 10);
          const at = zonedToUtc(TZ, y, m, d, hour, Math.floor(rand() * 60));
          const night = hour >= 22 || hour < 6;
          let loggedAt: number;
          if (night && rand() < 0.8) {
            // logged the next morning, 06:30 to 09:00 local
            const next = hour >= 22 ? 1 : 0;
            const mins = 390 + Math.floor(rand() * 150);
            loggedAt = zonedToUtc(TZ, y, m, d + next, Math.floor(mins / 60), mins % 60);
          } else {
            const minutes = rand() < 0.8 ? between(1, 30) : between(60, 180);
            loggedAt = at + Math.round(minutes * 60_000);
          }
          const r = rand();
          const by = r < 0.8 ? "C-01" : r < 0.95 ? "C-02" : "C-03";
          const o: StoredObservation = {
            uid: uuid(),
            patientId: person.id,
            itemId: 1 + weighted(w),
            at,
            loggedAt,
            ...(loggedAt - at > 3_600_000 && rand() < 0.5 ? { approx: true } : {}),
            ...(rand() < 0.7 ? { endedAt: at + Math.round(between(5, 45)) * 60_000 } : {}),
            ...(older ? {} : { by, deviceId: INSTALL_ID, tzOffsetMin: zoneOffsetMin(TZ, at) }),
          };
          rows.push(o);
          const rated = rand() < 0.5;
          const reviewed = rand() < 0.1;
          extras.set(
            o.uid!,
            older ? {} : { role: ROLE_OF[by], frequency: rated ? 1 + Math.floor(rand() * 7) : null, reviewed },
          );
        }
      }
    }
    await db.observations.bulkAdd(rows);
  });

  const exportOne = async (patientId: string, now: number, dir: Sample["dir"]): Promise<Sample> => ({
    dir,
    result: await buildResearchExport({
      patientId,
      startDay: START_DAY,
      endDay: END_DAY,
      tz: TZ,
      now,
      exportId: uuid(),
      appVersion: APP_VERSION,
      deviceId: INSTALL_ID,
      extras: (o) => extras.get(o.uid!) ?? {},
    }),
  });

  const out: Sample[] = [];
  for (const p of PEOPLE) out.push(await exportOne(p.id, EXPORT_1_AT, "export-1"));

  // After the first export: edit 2 logs and delete 1 for P-DEMO-A and P-DEMO-B, with the app's own functions.
  for (const id of ["P-DEMO-A", "P-DEMO-B"]) {
    const logs = await db.observations.where("patientId").equals(id).toArray();
    // daytime logs with no end time and a real delay: a plain time change is allowed and stays on the same day
    const ok = logs
      .filter((o) => {
        const hour = Number(
          new Date(o.at).toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }),
        );
        return o.endedAt === undefined && hour >= 9 && hour <= 20 && o.loggedAt - o.at > 20 * 60_000;
      })
      .sort((a, b) => a.at - b.at);
    const [first, second, third] = [0, 1, 2].map(() => ok.splice(Math.floor(rand() * ok.length), 1)[0]);
    await editLog(first as StoredObservation & { id: number }, { at: first.at - 7 * 60_000 }, CHANGES_AT);
    await editLog(second as StoredObservation & { id: number }, { at: second.at - 12 * 60_000 }, CHANGES_AT);
    await deleteLog(third as StoredObservation & { id: number }, "Logged twice", undefined, CHANGES_AT + 5 * 60_000);
  }
  for (const id of ["P-DEMO-A", "P-DEMO-B"]) out.push(await exportOne(id, EXPORT_2_AT, "export-2"));
  return out;
}
