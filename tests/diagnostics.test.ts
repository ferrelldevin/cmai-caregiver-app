// Diagnostics a caregiver can copy (build plan step 2.13, F-54). Nothing is sent anywhere.
// Written first: the 31st entry drops the oldest; a message with a patient code is stored without
// it; storage that throws does not throw out of record().
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asText, DIAGNOSTICS_KEY, entries, MAX_ENTRIES, record, scrub, screenName } from "../src/ui/diagnostics";

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("location", { hash: "#/log" });
});

describe("diagnostics", () => {
  it("keeps time, name, message, screen and version", () => {
    record(new TypeError("boom"), 1_700_000_000_000);
    const [e] = entries();
    expect(e).toMatchObject({ at: 1_700_000_000_000, name: "TypeError", message: "boom", screen: "#/log" });
    expect(typeof e.version).toBe("string");
  });

  it("the 31st entry drops the oldest", () => {
    for (let i = 1; i <= MAX_ENTRIES + 1; i++) record(new Error(`error number ${i}`), i);
    const list = entries();
    expect(list).toHaveLength(MAX_ENTRIES);
    expect(list[0].message).toBe("error number 2");
    expect(list[MAX_ENTRIES - 1].message).toBe(`error number ${MAX_ENTRIES + 1}`);
  });

  it("an error message with a patient code is stored without it", () => {
    record(new Error("Could not save a log for P-03 at 4 pm"));
    const stored = localStorage.getItem(DIAGNOSTICS_KEY) ?? "";
    expect(stored).not.toContain("P-03");
    expect(entries()[0].message).toBe("Could not save a log for [cut]");
  });

  it("codes without a hyphen are cut too, and an ordinary message is left alone", () => {
    expect(scrub("patient AB12 missing")).toBe("patient [cut]");
    expect(scrub("QuotaExceededError: the storage is full")).toBe("QuotaExceededError: the storage is full");
  });

  it("cuts a message to 200 characters", () => {
    expect(scrub("x".repeat(500)).length).toBeLessThanOrEqual(201);
  });

  it("keeps only the first part of the screen hash", () => {
    expect(screenName("#/log/P-03?x=1")).toBe("#/log");
    expect(screenName("#/scores/p2")).toBe("#/scores");
    expect(screenName("#/P-03")).toBe("#/");
    expect(screenName("")).toBe("#/");
    location.hash = "#/data/backup";
    record(new Error("x"));
    expect(entries()[0].screen).toBe("#/data");
  });

  it("storage that throws does not throw out of record()", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    });
    expect(() => record(new Error("x"))).not.toThrow();
    expect(entries()).toEqual([]);
  });

  it("a damaged list is treated as empty", () => {
    localStorage.setItem(DIAGNOSTICS_KEY, "{not json");
    expect(entries()).toEqual([]);
    record(new Error("x"));
    expect(entries()).toHaveLength(1);
  });

  it("copies as plain text, and says so when nothing has gone wrong", () => {
    expect(asText()).toContain("Nothing has gone wrong");
    record(new Error("oops"), Date.UTC(2026, 10, 10, 12));
    expect(asText()).toContain("2026-11-10T12:00:00.000Z · #/log · Error: oops");
  });
});
