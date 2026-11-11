// Caregiver profiles (R2, plan 5.2). Codes and initials, never names; any caregiver can log for any resident.
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Lab build for this file: caregiver profiles switched on.
vi.mock("../src/study/settings", async (orig) => {
  const real = await orig<typeof import("../src/study/settings")>();
  return { ...real, study: real.settingsFor("lab") };
});

// The node test run has no localStorage; a map stands in for the phone's.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { db, madeHere } = await import("../src/data/db");
const cg = await import("../src/data/caregivers");
const { editLog } = await import("../src/data/logs");

const T = Date.UTC(2026, 10, 1);

beforeEach(async () => {
  db.close();
  await Dexie.delete("cmai-tracker");
  await db.open();
  cg.chooseLoggingCaregiver(null);
});

describe("caregiver profiles", () => {
  it("codes count up and are never reused, even after a caregiver is removed", async () => {
    expect((await cg.addCaregiver("jm", T)).id).toBe("C-01");
    expect((await cg.addCaregiver(" ab ", T + 1)).initials).toBe("AB");
    expect(await cg.removeCaregiver("C-02")).toBe("deleted");
    expect((await cg.addCaregiver("KL", T + 2)).id).toBe("C-03");
    expect((await cg.activeCaregivers()).map((c) => c.id)).toEqual(["C-01", "C-03"]);
    expect((await cg.activeCaregivers()).every((c) => cg.CAREGIVER_CODE.test(c.id))).toBe(true);
  });

  it("initials only: 2 or 3 letters", async () => {
    for (const bad of ["J", "JOHN", "J M", "J1", "", "Jo-"])
      await expect(cg.addCaregiver(bad)).rejects.toThrow(/Initials only/);
  });

  it("a caregiver with a record is archived, not deleted, and leaves the list", async () => {
    await cg.addCaregiver("JM", T);
    cg.chooseLoggingCaregiver("C-01");
    await db.observations.add({ patientId: "P-01", itemId: 1, at: T, loggedAt: T, ...madeHere() });
    expect(await cg.removeCaregiver("C-01", T + 5)).toBe("archived");
    expect(await db.caregivers.get("C-01")).toMatchObject({ archivedAt: T + 5 });
    expect(await cg.activeCaregivers()).toEqual([]);
  });

  it("a log made after switching caregiver carries the new code", async () => {
    await cg.addCaregiver("JM", T);
    await cg.addCaregiver("AB", T);
    cg.chooseLoggingCaregiver("C-01");
    expect(madeHere().by).toBe("C-01");
    cg.chooseLoggingCaregiver("C-02");
    expect(madeHere().by).toBe("C-02");
    expect(cg.readLoggingCaregiver()).toBe("C-02");
  });

  it("ignores a remembered value that is not a caregiver code", async () => {
    await db.meta.put({ key: "loggingCaregiver", value: "<b>Jane Doe</b>" });
    await cg.loadLoggingCaregiver();
    expect(cg.readLoggingCaregiver()).toBeNull();
  });

  it("who was logging is kept in the database, not in localStorage, and comes back on reopen", async () => {
    cg.chooseLoggingCaregiver("C-01");
    await vi.waitFor(async () => expect((await db.meta.get("loggingCaregiver"))?.value).toBe("C-01"));
    expect(store.size).toBe(0);
    cg.chooseLoggingCaregiver(null);
    await cg.loadLoggingCaregiver();
    expect(cg.readLoggingCaregiver()).toBeNull();
    await db.meta.put({ key: "loggingCaregiver", value: "C-02" });
    await cg.loadLoggingCaregiver();
    expect(cg.readLoggingCaregiver()).toBe("C-02");
    expect(madeHere().by).toBe("C-02");
  });

  it("an edit records the editor's code, which may differ from the logger's", async () => {
    cg.chooseLoggingCaregiver("C-01");
    const id = await db.observations.add({ patientId: "P-01", itemId: 1, at: T, loggedAt: T, ...madeHere() });
    cg.chooseLoggingCaregiver("C-02");
    await editLog({ ...(await db.observations.get(id))!, id }, { approx: true }, T + 1000);
    expect((await db.observations.get(id))?.by).toBe("C-01");
    expect((await db.changes.toArray())[0]).toMatchObject({ action: "edit", by: "C-02" });
  });

  it("My residents come first in the caregiver's order; everyone else follows", async () => {
    await cg.setMyResidents("C-01", ["P-03", "P-01"], T);
    const mine = await cg.myResidents("C-01");
    expect(mine).toEqual(["P-03", "P-01"]);
    const all = ["P-01", "P-02", "P-03", "P-04"].map((id) => ({ id }));
    expect(cg.orderForCaregiver(all, [...mine, "P-GONE"])).toEqual({
      mine: [{ id: "P-03" }, { id: "P-01" }],
      others: [{ id: "P-02" }, { id: "P-04" }],
    });
    await cg.setMyResidents("C-01", ["P-02"], T);
    expect(await cg.myResidents("C-01")).toEqual(["P-02"]);
  });
});
