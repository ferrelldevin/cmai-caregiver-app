// F-58 storage picks: the IANA zone name saved on each new log, and a role saved once on the caregiver
// profile and stamped on the export. Older logs and profiles without them keep the assumed defaults.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, type StoredObservation } from "../src/data/db";
import { addCaregiver, setCaregiverRole } from "../src/data/caregivers";
import { zoneName } from "../src/data/ids";
import { parseBackup } from "../src/data/manage";
import { buildResearchExport, ExportBlocked, zoneOffsetMin, zonedToUtc } from "../src/data/researchExport";

const NY = "America/New_York";
const TOKYO = "Asia/Tokyo";
const T = zonedToUtc(NY, 2026, 11, 2, 12);
const base = {
  patientId: "P-01",
  startDay: "2026-11-02",
  endDay: "2026-11-02",
  tz: NY,
  now: Date.UTC(2026, 10, 9),
  deviceId: "d".repeat(8) + "-0000-4000-8000-" + "0".repeat(12),
};
async function add(o: Partial<StoredObservation>) {
  const at = o.at ?? T;
  await db.observations.add({ patientId: "P-01", itemId: 5, at, loggedAt: at, ...o });
}
const recs = (text: string) => JSON.parse(text).records as Record<string, unknown>[];

beforeEach(async () => {
  for (const t of db.tables) await t.clear();
  await db.patients.put({ id: "P-01", anchor: T - 86_400_000, demo: true });
});

describe("zone name saved on each log", () => {
  it("is used for the record's zone and offset, and counted", async () => {
    await add({ tzName: NY, tzOffsetMin: zoneOffsetMin(NY, T) });
    await add({ at: T + 60_000, tzOffsetMin: zoneOffsetMin(NY, T + 60_000) }); // an older log
    const out = await buildResearchExport(base);
    expect(recs(out.text).map((r) => r.tz_name)).toEqual([NY, NY]);
    expect(out.summary.zoneFromLog).toBe(1);
  });

  it("a log made in another zone exports in that zone, with no mismatch stop", async () => {
    await add({ tzName: TOKYO, tzOffsetMin: 540 });
    const [r] = recs((await buildResearchExport(base)).text);
    expect(r).toMatchObject({ tz_name: TOKYO, utc_offset_min: 540 });
  });

  it("still stops when a stored offset disagrees with the log's own zone", async () => {
    await add({ tzName: TOKYO, tzOffsetMin: -300 });
    await expect(buildResearchExport(base)).rejects.toBeInstanceOf(ExportBlocked);
  });

  it("the phone's zone name is a valid IANA name", () => {
    expect(zoneName()).toMatch(/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/);
  });

  it("a backup keeps a good zone name and refuses a bad one", () => {
    const text = (tzName: unknown) =>
      JSON.stringify({
        format: 2,
        exportedAt: T,
        patients: [{ id: "P-01", anchor: T - 1 }],
        observations: [{ patientId: "P-01", itemId: 5, at: T, loggedAt: T, tzName }],
      });
    const good = parseBackup(text(NY));
    expect(good.observations[0].tzName).toBe(NY);
    expect(() => parseBackup(text("not a zone!"))).not.toThrow(); // a bad row is dropped, not fatal
    expect(parseBackup(text("not a zone!")).observations).toHaveLength(0);
  });
});

describe("role saved on the caregiver profile", () => {
  it("is stamped on that caregiver's records; others default to caregiver and are counted", async () => {
    const jm = await addCaregiver("JM");
    const ab = await addCaregiver("AB");
    await setCaregiverRole(jm.id, "researcher");
    await setCaregiverRole(ab.id, "caregiver"); // the default is stored as nothing
    expect((await db.caregivers.get(ab.id))?.role).toBeUndefined();
    await add({ by: jm.id, tzOffsetMin: -300 });
    await add({ by: ab.id, at: T + 1000, tzOffsetMin: -300 });
    await add({ at: T + 2000, tzOffsetMin: -300 }); // nobody recorded
    const out = await buildResearchExport(base);
    expect(recs(out.text).map((r) => r.logger_role)).toEqual(["researcher", "caregiver", "caregiver"]);
    expect(out.summary.defaultedRole).toBe(2);
  });

  it("a backup keeps staff and researcher, and drops anything else", () => {
    const text = (role: unknown) =>
      JSON.stringify({
        format: 2,
        exportedAt: T,
        patients: [],
        observations: [],
        caregivers: [{ id: "C-01", initials: "JM", createdAt: T, role }],
      });
    expect(parseBackup(text("staff")).caregivers[0].role).toBe("staff");
    expect(parseBackup(text("researcher")).caregivers[0].role).toBe("researcher");
    expect(parseBackup(text("admin")).caregivers[0].role).toBeUndefined();
  });
});
