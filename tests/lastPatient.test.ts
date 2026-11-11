// The "reopen on this patient" pointer: kept in the database, never as a code in localStorage.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../src/data/db";
import { readLastPatient, saveLastPatient } from "../src/data/lastPatient";

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
  await db.meta.clear();
});

describe("last patient pointer", () => {
  it("is empty on a fresh phone", async () => {
    fakeLocalStorage();
    expect(await readLastPatient()).toBeNull();
  });

  it("is saved in the database and never writes a code to localStorage", async () => {
    const ls = fakeLocalStorage();
    await saveLastPatient("P-07");
    expect(await readLastPatient()).toBe("P-07");
    expect(await db.meta.get("lastPatient")).toEqual({ key: "lastPatient", value: "P-07" });
    expect([...ls.keys()]).toEqual([]);
  });

  it("forgets the patient when saved as null", async () => {
    fakeLocalStorage();
    await saveLastPatient("P-07");
    await saveLastPatient(null);
    expect(await readLastPatient()).toBeNull();
  });

  it("moves an old localStorage code into the database once and removes it", async () => {
    const ls = fakeLocalStorage({ "cmai-patient": "P-03" });
    expect(await readLastPatient()).toBe("P-03");
    expect(ls.has("cmai-patient")).toBe(false);
    expect((await db.meta.get("lastPatient"))?.value).toBe("P-03");
    expect(await readLastPatient()).toBe("P-03"); // second read comes from the database
  });

  it("an old code wins over a stale database row, because it is the newer choice", async () => {
    fakeLocalStorage({ "cmai-patient": "P-09" });
    await db.meta.put({ key: "lastPatient", value: "P-01" });
    expect(await readLastPatient()).toBe("P-09");
  });

  it("does not throw when localStorage is blocked", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    await saveLastPatient("P-02");
    expect(await readLastPatient()).toBe("P-02");
  });

  it("does not throw when the database is unreadable", async () => {
    fakeLocalStorage({ "cmai-patient": "P-04" });
    const get = vi.spyOn(db.meta, "get").mockRejectedValue(new Error("closed"));
    const put = vi.spyOn(db.meta, "put").mockRejectedValue(new Error("closed"));
    expect(await readLastPatient()).toBe("P-04"); // the code just taken is still honored
    await expect(saveLastPatient("P-05")).resolves.toBeUndefined();
    get.mockRestore();
    put.mockRestore();
  });
});
