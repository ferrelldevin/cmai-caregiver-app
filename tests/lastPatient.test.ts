// Which patient the app opens on: the one with the newest activity, with no copy of a code kept anywhere else.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkInKey, db } from "../src/data/db";
import { clearLegacyPatientCode, patientWithNewestActivity, startingPatient } from "../src/data/lastPatient";

const T0 = Date.UTC(2026, 0, 1);
const H = 3_600_000;

async function reset() {
  await Promise.all([db.patients.clear(), db.observations.clear(), db.checkins.clear()]);
  await db.patients.bulkAdd([
    { id: "P-01", anchor: T0 },
    { id: "P-02", anchor: T0 },
    { id: "P-03", anchor: T0 },
  ]);
}

function fakeLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

beforeEach(async () => {
  vi.unstubAllGlobals();
  await reset();
});

describe("patient to open on", () => {
  it("is null when nobody has logged anything, so the caller falls back to the first patient", async () => {
    expect(await patientWithNewestActivity()).toBeNull();
  });

  it("is the patient whose log was entered most recently", async () => {
    await db.observations.bulkAdd([
      { patientId: "P-01", itemId: 1, at: T0 + H, loggedAt: T0 + H },
      { patientId: "P-03", itemId: 2, at: T0 + 2 * H, loggedAt: T0 + 2 * H },
      { patientId: "P-02", itemId: 3, at: T0 + 3 * H, loggedAt: T0 + 3 * H },
    ]);
    expect(await patientWithNewestActivity()).toBe("P-02");
  });

  it("goes by when a log was entered, not when the behavior happened", async () => {
    await db.observations.bulkAdd([
      { patientId: "P-01", itemId: 1, at: T0 + 5 * H, loggedAt: T0 + 6 * H }, // late entry of an old event
      { patientId: "P-02", itemId: 1, at: T0 + 9 * H, loggedAt: T0 + 7 * H },
    ]);
    expect(await patientWithNewestActivity()).toBe("P-02");
  });

  it("ignores deleted logs", async () => {
    await db.observations.bulkAdd([
      { patientId: "P-01", itemId: 1, at: T0 + H, loggedAt: T0 + H },
      {
        patientId: "P-02",
        itemId: 1,
        at: T0 + 2 * H,
        loggedAt: T0 + 2 * H,
        deletedAt: T0 + 3 * H,
        deleteReason: "Entered by mistake",
      },
    ]);
    expect(await patientWithNewestActivity()).toBe("P-01");
  });

  it("counts a 'nothing to log' check-in as activity", async () => {
    await db.observations.add({ patientId: "P-01", itemId: 1, at: T0 + H, loggedAt: T0 + H });
    await db.checkins.add({ key: checkInKey("P-03", T0), patientId: "P-03", day: T0, at: T0 + 2 * H });
    expect(await patientWithNewestActivity()).toBe("P-03");
  });

  it("ignores rows for a patient that no longer exists", async () => {
    await db.observations.add({ patientId: "P-99", itemId: 1, at: T0 + 9 * H, loggedAt: T0 + 9 * H });
    await db.observations.add({ patientId: "P-01", itemId: 1, at: T0 + H, loggedAt: T0 + H });
    expect(await patientWithNewestActivity()).toBe("P-01");
  });

  it("breaks a tie by the earlier code, whatever order the database returns rows in", async () => {
    await db.observations.bulkAdd([
      { patientId: "P-03", itemId: 1, at: T0 + H, loggedAt: T0 + H },
      { patientId: "P-02", itemId: 1, at: T0 + H, loggedAt: T0 + H },
    ]);
    expect(await patientWithNewestActivity()).toBe("P-02");
  });

  it("returns null instead of throwing when the database cannot be read", async () => {
    const spy = vi.spyOn(db.patients, "toArray").mockRejectedValue(new Error("closed"));
    expect(await patientWithNewestActivity()).toBeNull();
    spy.mockRestore();
  });
});

describe("old localStorage code", () => {
  it("is removed on the first open and never written again", async () => {
    const ls = fakeLocalStorage({ "cmai-patient": "P-03", "cmai-last-export": "1" });
    await db.observations.add({ patientId: "P-01", itemId: 1, at: T0 + H, loggedAt: T0 + H });
    expect(await startingPatient()).toBe("P-01");
    expect(ls.has("cmai-patient")).toBe(false);
    expect(ls.get("cmai-last-export")).toBe("1"); // other keys are left alone
  });

  it("does not throw when localStorage is blocked", async () => {
    vi.stubGlobal("localStorage", {
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => clearLegacyPatientCode()).not.toThrow();
  });
});
