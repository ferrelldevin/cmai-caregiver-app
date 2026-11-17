// G11 (design note 019): with `changeReasons` on (lab build) every edit and delete needs a reason
// from a pick list, history is append-only, and every version can be read back with who, when and why.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/study/settings", async (orig) => {
  const m = await orig<typeof import("../src/study/settings")>();
  return { ...m, study: m.settingsFor("lab") };
});

import { db, setLoggingCaregiver, madeHere, type StoredObservation } from "../src/data/db";
import {
  CHANGE_REASONS,
  deleteLog,
  editLog,
  LogReasonError,
  logVersions,
  REASON_LABEL,
  restoreLog,
  stopLog,
  UNDO_REASON,
} from "../src/data/logs";
import { parseBackup } from "../src/data/manage";

const T = Date.UTC(2026, 10, 9, 15);
const MIN = 60_000;
type Saved = StoredObservation & { id: number };
async function make(): Promise<Saved> {
  setLoggingCaregiver("C-01");
  const id = await db.observations.add({ patientId: "P-01", itemId: 1, at: T, loggedAt: T + 5 * MIN, ...madeHere() });
  return (await db.observations.get(id)) as Saved;
}

beforeEach(async () => {
  for (const t of db.tables) await t.clear();
  await db.patients.put({ id: "P-01", anchor: T - 86_400_000 });
});

describe("G11 change reasons (lab build)", () => {
  it("the reasons are the six codes and nothing else", () => {
    expect([...CHANGE_REASONS]).toEqual([
      "wrong_time",
      "wrong_item",
      "duplicate",
      "wrong_participant",
      "entered_by_mistake",
      "other",
    ]);
    expect(Object.keys(REASON_LABEL)).toEqual([...CHANGE_REASONS]);
  });

  it("an edit with no reason, or a made-up one, is refused and nothing is written", async () => {
    const o = await make();
    for (const bad of [undefined, "", "typo", "Wrong time ", "free text here"]) {
      await expect(editLog(o, { approx: true }, T + MIN, bad)).rejects.toBeInstanceOf(LogReasonError);
    }
    expect(await db.changes.count()).toBe(0);
    expect(await db.observations.get(o.id)).toMatchObject({ rev: 1 });
    expect((await db.observations.get(o.id))?.approx).toBeUndefined();
  });

  it("a delete with no reason is refused; the old label words still work and map to a code", async () => {
    const o = await make();
    await expect(deleteLog(o, "")).rejects.toBeInstanceOf(LogReasonError);
    await expect(deleteLog(o, "because I said so")).rejects.toBeInstanceOf(LogReasonError);
    expect(await db.changes.count()).toBe(0);
    await deleteLog(o, "Tapped by mistake", "typed note is dropped", T + MIN);
    const c = (await db.changes.toArray())[0];
    expect(c).toMatchObject({ action: "delete", reason: "entered_by_mistake" });
    const row = await db.observations.get(o.id);
    expect(row).toMatchObject({ deleteReason: "Tapped by mistake" });
    expect(row?.deleteNote).toBeUndefined(); // no free text
  });

  it("'Other' needs no note, and takes none", async () => {
    const o = await make();
    await deleteLog(o, "other", undefined, T + MIN);
    expect((await db.observations.get(o.id))?.deletedAt).toBe(T + MIN);
  });

  it("the Undo toast's delete counts as entered by mistake", async () => {
    const o = await make();
    await deleteLog(o, UNDO_REASON, undefined, T + MIN);
    expect((await db.changes.toArray())[0].reason).toBe("entered_by_mistake");
  });

  it("history is append-only: two edits a minute apart are two entries, the first never rewritten", async () => {
    const o = await make();
    await editLog(o, { at: T - 10 * MIN }, T + 10 * MIN, "wrong_time");
    const first = JSON.stringify((await db.changes.toArray())[0]);
    await editLog(o, { approx: true }, T + 11 * MIN, "other");
    const all = await db.changes.toArray();
    expect(all).toHaveLength(2);
    expect(JSON.stringify(all[0])).toBe(first);
    expect(all.map((c) => c.reason)).toEqual(["wrong_time", "other"]);
  });

  it("reads back every version: who, when, why and what it said", async () => {
    const o = await make();
    setLoggingCaregiver("C-02");
    await editLog(o, { at: T - 10 * MIN }, T + 10 * MIN, "wrong_time");
    setLoggingCaregiver("C-03");
    await editLog(o, { approx: true, before: "Mealtime" }, T + 20 * MIN, "other");
    setLoggingCaregiver("C-02");
    await deleteLog(o, "duplicate", undefined, T + 30 * MIN);
    await restoreLog(o, T + 40 * MIN);
    const v = await logVersions(o.id);
    expect(v.map((x) => [x.rev, x.action, x.by, x.reason, x.at])).toEqual([
      [1, "created", "C-01", undefined, T + 5 * MIN],
      [2, "edit", "C-02", "wrong_time", T + 10 * MIN],
      [3, "edit", "C-03", "other", T + 20 * MIN],
      [4, "delete", "C-02", "duplicate", T + 30 * MIN],
      [5, "restore", "C-02", undefined, T + 40 * MIN],
    ]);
    expect(v.map((x) => x.values)).toEqual([
      { at: T, approx: false, before: undefined, endedAt: undefined, deleted: false },
      { at: T - 10 * MIN, approx: false, before: undefined, endedAt: undefined, deleted: false },
      { at: T - 10 * MIN, approx: true, before: "Mealtime", endedAt: undefined, deleted: false },
      { at: T - 10 * MIN, approx: true, before: "Mealtime", endedAt: undefined, deleted: true },
      { at: T - 10 * MIN, approx: true, before: "Mealtime", endedAt: undefined, deleted: false },
    ]);
    expect((await db.observations.get(o.id))?.rev).toBe(5); // rev is 1 + changes, always
  });

  it("'It stopped' is the first end time, not a correction: no reason, still in the history", async () => {
    const o = await make();
    await stopLog(o, T + 30 * MIN);
    const v = await logVersions(o.id);
    expect(v).toHaveLength(2);
    expect(v[1]).toMatchObject({ action: "edit", reason: undefined, values: { endedAt: T + 30 * MIN } });
    expect(v[0].values.endedAt).toBeUndefined();
  });

  it("no hard delete: a delete keeps the row and marks it", async () => {
    const o = await make();
    await deleteLog(o, "wrong_item", undefined, T + MIN);
    expect(await db.observations.count()).toBe(1);
    expect((await db.observations.get(o.id))?.deletedAt).toBe(T + MIN);
  });

  it("a backup keeps reasons and revisions; a made-up reason in a file is dropped", async () => {
    const o = await make();
    await editLog(o, { approx: true }, T + MIN, "wrong_time");
    const good = {
      patients: await db.patients.toArray(),
      observations: await db.observations.toArray(),
      changes: await db.changes.toArray(),
    };
    const parsed = parseBackup(JSON.stringify(good), T + 86_400_000);
    expect(parsed.changes[0].reason).toBe("wrong_time");
    expect(parsed.observations[0].rev).toBe(2);
    const bad = { ...good, changes: [{ ...good.changes[0], reason: "free text" }] };
    expect(parseBackup(JSON.stringify(bad), T + 86_400_000).changes).toHaveLength(0);
  });
});
