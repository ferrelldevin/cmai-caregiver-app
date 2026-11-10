// On-phone PIN (R1 option A, F-46, plan 5.3). Low iteration counts keep the tests fast; one
// test checks the real count. The PIN identifies a caregiver; it does not protect the data.
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { db } = await import("../src/data/db");
const pin = await import("../src/data/pin");
const session = await import("../src/data/session");
const { addCaregiver } = await import("../src/data/caregivers");
const { buildExport } = await import("../src/data/exporter");

const T = Date.UTC(2026, 10, 1);
const FAST = 1000;
const salt = (n: number) => new Uint8Array(16).fill(n);

beforeEach(async () => {
  db.close();
  await Dexie.delete("cmai-tracker");
  await db.open();
  store.clear();
  await addCaregiver("JM", T);
});

describe("PIN hashing", () => {
  it("the same PIN and salt give the same hash; another salt gives another", async () => {
    const a = await pin.hashPin("2580", salt(1), FAST);
    expect(pin.sameBytes(a, await pin.hashPin("2580", salt(1), FAST))).toBe(true);
    expect(pin.sameBytes(a, await pin.hashPin("2580", salt(2), FAST))).toBe(false);
    expect(pin.sameBytes(a, await pin.hashPin("2581", salt(1), FAST))).toBe(false);
    expect(a.length).toBe(32);
  });

  it("sameBytes is false for different lengths", () => {
    expect(pin.sameBytes(new Uint8Array(2), new Uint8Array(3))).toBe(false);
  });

  it("uses 600,000 iterations unless told otherwise", async () => {
    expect(pin.ITERATIONS).toBe(600_000);
    await pin.setPin("C-01", "2580");
    expect((await db.caregivers.get("C-01"))!.pinIterations).toBe(600_000);
  });

  it("refuses PINs that are guessed first, and the wrong length", () => {
    for (const p of ["0000", "7777", "1234", "6789", "4321", "0123"]) expect(pin.pinProblem(p)).toMatch(/too easy/);
    expect(pin.pinProblem("123")).toBe("Use 4 digits.");
    expect(pin.pinProblem("12a4")).toBe("Use 4 digits.");
    expect(pin.pinProblem("2580")).toBeNull();
    expect(pin.pinProblem("123456", 6)).toMatch(/too easy/);
    expect(pin.pinProblem("246810", 6)).toBeNull();
  });
});

describe("checking a caregiver's PIN", () => {
  it("never stores the PIN itself", async () => {
    await pin.setPin("C-01", "2580", FAST);
    expect(JSON.stringify(await db.caregivers.get("C-01"))).not.toContain("2580");
  });

  it("the 5th wrong try starts a wait that doubles; the 10th locks; a right PIN clears the count", async () => {
    await pin.setPin("C-01", "2580", FAST);
    let now = T;
    for (let i = 1; i <= 4; i++) {
      expect(await pin.checkPin("C-01", "1111", now)).toEqual({ ok: false, reason: "wrong", triesBeforeWait: 5 - i });
    }
    expect(await pin.checkPin("C-01", "1111", now)).toEqual({ ok: false, reason: "wait", until: now + 30_000 });
    // During the wait even the right PIN is not checked.
    expect((await pin.checkPin("C-01", "2580", now + 29_999)).ok).toBe(false);
    now += 30_000;
    expect(await pin.checkPin("C-01", "1111", now)).toEqual({ ok: false, reason: "wait", until: now + 60_000 });
    now += 60_000;
    expect(await pin.checkPin("C-01", "2580", now)).toEqual({ ok: true });
    expect((await db.caregivers.get("C-01"))!.failedAttempts).toBe(0);

    for (let i = 1; i <= 9; i++) {
      await pin.checkPin("C-01", "1111", now);
      now += pin.waitAfter(i);
    }
    expect(await pin.checkPin("C-01", "1111", now)).toEqual({ ok: false, reason: "locked" });
    expect(await pin.checkPin("C-01", "2580", now + 1e9)).toEqual({ ok: false, reason: "locked" });
  });

  it("a caregiver with no PIN yet, or unknown, is not signed in", async () => {
    expect(await pin.checkPin("C-01", "2580", T)).toEqual({ ok: false, reason: "no-pin" });
    expect(await pin.checkPin("C-09", "2580", T)).toEqual({ ok: false, reason: "no-pin" });
    await expect(pin.setPin("C-09", "2580", FAST)).rejects.toThrow(/No caregiver/);
    await expect(pin.setPin("C-01", "1234", FAST)).rejects.toThrow(/too easy/);
  });
});

describe("the setup PIN", () => {
  it("unlocks a locked caregiver with a new PIN, and reads no data", async () => {
    expect(await pin.hasSetupPin()).toBe(false);
    await pin.setSetupPin("246810", FAST);
    expect(await pin.hasSetupPin()).toBe(true);
    await pin.setPin("C-01", "2580", FAST);
    await db.caregivers.update("C-01", { lockedAt: T, failedAttempts: 10 });

    expect(await pin.resetPin("C-01", "000001", "3691", T, FAST)).toEqual({
      ok: false,
      reason: "wrong",
      triesBeforeWait: 4,
    });
    expect(await pin.resetPin("C-01", "246810", "3691", T, FAST)).toEqual({ ok: true });
    const c = (await db.caregivers.get("C-01"))!;
    expect(pin.isLocked(c)).toBe(false);
    expect(await pin.checkPin("C-01", "3691", T)).toEqual({ ok: true });
    await expect(pin.resetPin("C-01", "246810", "1111", T, FAST)).rejects.toThrow(/too easy/);
  });

  it("waits after 5 wrong tries but never locks", async () => {
    await pin.setSetupPin("246810", FAST);
    let now = T;
    for (let i = 1; i <= 12; i++) {
      await pin.checkSetupPin("000001", now);
      now += pin.waitAfter(i);
    }
    expect(await pin.checkSetupPin("246810", now)).toEqual({ ok: true });
    expect(pin.waitAfter(40)).toBe(30_000 * 1024);
  });

  it("refuses an easy setup PIN and an unset one", async () => {
    await expect(pin.setSetupPin("123456", FAST)).rejects.toThrow(/123456/);
    expect(await pin.checkSetupPin("246810", T)).toEqual({ ok: false, reason: "no-pin" });
    await db.meta.put({ key: "setupPin", value: "not json" });
    expect(await pin.hasSetupPin()).toBe(false);
  });
});

describe("backups", () => {
  it("contain no PIN field and no setup PIN", async () => {
    await pin.setSetupPin("246810", FAST);
    await pin.setPin("C-01", "2580", FAST);
    await pin.checkPin("C-01", "1111", T);
    const text = JSON.stringify(await buildExport(T));
    for (const f of ["pinSalt", "pinHash", "pinIterations", "failedAttempts", "lastFailedAt", "lockedAt", "setupPin"]) {
      expect(text).not.toContain(f);
    }
  });
});

describe("the sign-in lasts one shift", () => {
  it("survives a reopen within 12 hours, then ends", () => {
    session.startSession("C-01", T);
    expect(session.readSession(T + 1)).toEqual({ id: "C-01", at: T });
    expect(session.readSession(T + session.SHIFT_MS - 1)?.id).toBe("C-01");
    expect(session.readSession(T + session.SHIFT_MS)).toBeNull();
    expect(session.readSession(T - 1)).toBeNull(); // a clock set back does not stretch a shift
    session.endSession();
    expect(session.readSession(T + 1)).toBeNull();
  });

  it("ignores anything stored that is not a caregiver code and a time", () => {
    for (const v of ["{", '{"id":"Jane","at":1}', '{"id":"C-01"}', "null"]) {
      store.set("cmai-session", v);
      expect(session.readSession(T)).toBeNull();
    }
  });
});
