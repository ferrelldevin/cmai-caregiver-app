// Passphrase-protected backup (F-10, plan 5.11). Low iteration counts keep tests fast where noted.
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("__APP_VERSION__", "0.0.0-test");
const pr = await import("../src/data/protect");
const { db } = await import("../src/data/db");
const { restoreBackup } = await import("../src/data/manage");
const { buildExport } = await import("../src/data/exporter");

const PASS = "blue kettle on the stove";
const T = Date.UTC(2026, 9, 1);

beforeEach(async () => {
  db.close();
  await Dexie.delete("cmai-tracker");
  await db.open();
});

describe("protect and unprotect", () => {
  it("encrypt then decrypt gives the same text, and the file holds none of it", async () => {
    const plain = JSON.stringify({ note: "made-up P-01 data", n: "é😀".repeat(50_000) });
    const file = await pr.protect(plain, PASS, 100_000);
    expect(pr.isProtected(file)).toBe(true);
    expect(file).not.toContain("P-01");
    expect(await pr.unprotect(file, PASS)).toBe(plain);
  });

  it("uses 600,000 iterations by default", async () => {
    expect(JSON.parse(await pr.protect("x", PASS)).iterations).toBe(600_000);
  });

  it("a wrong passphrase fails with a clear message", async () => {
    const file = await pr.protect("secret", PASS, 100_000);
    await expect(pr.unprotect(file, "blue kettle on the oven")).rejects.toThrow(pr.WRONG);
  });

  it("one changed byte, in the data or the header, fails", async () => {
    const file = JSON.parse(await pr.protect("secret text here", PASS, 100_000));
    const flip = (s: string, i = 2) => s.slice(0, i) + (s[i] === "A" ? "B" : "A") + s.slice(i + 1);
    await expect(pr.unprotect(JSON.stringify({ ...file, data: flip(file.data) }), PASS)).rejects.toThrow(pr.WRONG);
    await expect(pr.unprotect(JSON.stringify({ ...file, iterations: 100_001 }), PASS)).rejects.toThrow(pr.WRONG);
    await expect(pr.unprotect(JSON.stringify({ ...file, iterations: 1 }), PASS)).rejects.toThrow(pr.WRONG);
    await expect(pr.unprotect(JSON.stringify({ ...file, salt: flip(file.salt) }), PASS)).rejects.toThrow(pr.WRONG);
    await expect(pr.unprotect(JSON.stringify({ ...file, iv: "AAAA" }), PASS)).rejects.toThrow(pr.WRONG);
    await expect(pr.unprotect("not json", PASS)).rejects.toThrow(pr.WRONG);
    await expect(pr.unprotect(JSON.stringify({ app: "other" }), PASS)).rejects.toThrow("not a protected");
  });

  it("refuses short or repetitive passphrases", async () => {
    expect(pr.passProblem("short")).toMatch(/at least 12/);
    expect(pr.passProblem("aaaaaaaaaaaaaaa")).toMatch(/different/);
    expect(pr.passProblem(PASS)).toBeNull();
    await expect(pr.protect("x", "short")).rejects.toThrow(/at least 12/);
    expect(pr.isProtected("{")).toBe(false);
    expect(pr.isProtected('{"formatVersion":2}')).toBe(false);
  });
});

describe("restoring", () => {
  it("a protected backup restores; a wrong passphrase restores nothing; plain backups still restore", async () => {
    await db.patients.add({ id: "P-01", anchor: T });
    await db.observations.add({ patientId: "P-01", itemId: 7, at: T + 1, loggedAt: T + 1 });
    const plain = (await buildExport(T + 10)).json;
    const file = await pr.protect(pr.bundle(plain, { "labels.csv": "patient_id" }), PASS, 100_000);
    await db.observations.clear();
    await db.patients.clear();

    await expect(pr.unprotect(file, "wrong passphrase!!")).rejects.toThrow(pr.WRONG);
    expect(await db.observations.count()).toBe(0);

    const opened = await pr.unprotect(file, PASS);
    expect(JSON.parse(opened).csv["labels.csv"]).toBe("patient_id");
    await restoreBackup(pr.backupFrom(opened));
    expect(await db.observations.count()).toBe(1);

    await db.observations.clear();
    await db.patients.clear();
    await restoreBackup(pr.backupFrom(plain)); // an unprotected format 2 backup passes through
    expect(pr.backupFrom("{")).toBe("{");
    expect(await db.observations.count()).toBe(1);
  });
});
