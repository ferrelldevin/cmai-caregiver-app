// The blind caregiver CMAI at day 14 (F-47, plan 5.4). Made-up data only.
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/study/settings", async (orig) => {
  const real = await orig<typeof import("../src/study/settings")>();
  return { ...real, study: real.settingsFor("lab") };
});
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });

const { db, setLoggingCaregiver } = await import("../src/data/db");
const r = await import("../src/data/caregiverRatings");
const { addDays } = await import("../src/scoring/engine");
const { ITEMS } = await import("../src/scoring/items");

const ANCHOR = new Date(2026, 9, 1).getTime(); // local midnight, 1 Oct 2026
const P = { id: "P-01", anchor: ANCHOR };
const END = addDays(ANCHOR, 14);
const log = (at: number, by = "C-01", itemId = 7) =>
  db.observations.add({ patientId: "P-01", itemId, at, loggedAt: at, by });

beforeEach(async () => {
  db.close();
  await Dexie.delete("cmai-tracker");
  await db.open();
  await db.patients.add(P);
  setLoggingCaregiver("C-02"); // the phone's default is someone else: the rating keeps its own `by`
});

describe("when a rating is due", () => {
  it("only after the period ends, only for a caregiver who logged in it, until 7 days later", async () => {
    await log(ANCHOR + 3600_000);
    expect(await r.ratingsDue(P, "C-01", END - 1)).toEqual([]);
    expect(await r.ratingsDue(P, "C-01", END)).toEqual([1]);
    expect(await r.ratingsDue(P, "C-03", END)).toEqual([]);
    expect(await r.ratingStatus(P, 1, "C-01", addDays(END, 7))).toBe("missed");
    expect(await r.ratingsDue(P, "C-01", addDays(END, 7))).toEqual([]);
    expect(await r.ratingStatus(P, 2, "C-01", END)).toBe("none");
  });

  it("a deleted log does not make a rating due", async () => {
    const id = await log(ANCHOR + 1);
    await db.observations.update(id, { deletedAt: ANCHOR + 2 });
    expect(await r.ratingsDue(P, "C-01", END)).toEqual([]);
  });
});

describe("answering and submitting", () => {
  it("saves answers as it goes, needs all 29, then locks", async () => {
    await log(ANCHOR + 1);
    await r.saveAnswer(P, 1, "C-01", 1, 3, END + 10);
    expect(await r.ratingStatus(P, 1, "C-01", END + 20)).toBe("started");
    await expect(r.submitRating(P, 1, "C-01", END + 30)).rejects.toThrow("28 behaviors have no answer yet.");
    for (const item of ITEMS.slice(1)) await r.saveAnswer(P, 1, "C-01", item.id, item.id === 2 ? 8 : 1, END + 40);
    await r.saveAnswer(P, 1, "C-01", 29, 9, END + 41); // changing an answer before submitting is fine
    const done = await r.submitRating(P, 1, "C-01", END + 50);
    expect(done.submittedAt).toBe(END + 50);
    expect(done.by).toBe("C-01");
    expect(done.startedAt).toBe(END + 10);
    expect(done.ruleVersion).toBe("cmai-count-rule-2");
    expect(Object.keys(done.answers)).toHaveLength(29);
    expect(done.answers[2]).toBe(8);
    expect(done.answers[29]).toBe(9);
    expect(await r.ratingStatus(P, 1, "C-01", END + 60)).toBe("submitted");
    await expect(r.submitRating(P, 1, "C-01", END + 60)).rejects.toThrow("already submitted");
    await expect(r.saveAnswer(P, 1, "C-01", 1, 4, END + 60)).rejects.toThrow("locked");
    expect(await db.caregiverRatings.count()).toBe(1);
  });

  it("refuses answers out of range, before the end, after the deadline, or with nobody logging", async () => {
    await expect(r.saveAnswer(P, 1, "C-01", 1, 0, END)).rejects.toThrow("1 to 7, 8 or 9");
    await expect(r.saveAnswer(P, 1, "C-01", 30, 1, END)).rejects.toThrow("No behavior 30");
    await expect(r.saveAnswer(P, 1, "C-01", 1, 1, END - 1)).rejects.toThrow("not ended");
    await expect(r.saveAnswer(P, 1, "C-01", 1, 1, addDays(END, 7))).rejects.toThrow("within 7 days");
    await expect(r.saveAnswer(P, 1, "", 1, 1, END)).rejects.toThrow("who is logging");
    await expect(r.submitRating(P, 1, "C-01", END)).rejects.toThrow("No answers yet");
  });

  it("within 1 point, as the manual says; codes 8 and 9 never are", () => {
    expect(r.withinOne(3, 4)).toBe(true);
    expect(r.withinOne(3, 5)).toBe(false);
    expect(r.withinOne(8, 7)).toBe(false);
    expect(r.withinOne(9, 1)).toBe(false);
  });
});

describe("blind both ways", () => {
  it("no scoring code reads the caregiver's rating", () => {
    const sources = import.meta.glob<string>("../src/scoring/*.ts", { query: "?raw", import: "default", eager: true });
    expect(Object.keys(sources).length).toBeGreaterThan(1);
    for (const text of Object.values(sources)) expect(text).not.toMatch(/caregiverRating|CaregiverRating/);
  });
});
