// CSV cells that a spreadsheet would run as a formula are written as plain text (F-34).
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/data/db";
import { buildExport } from "../src/data/exporter";

const T0 = Date.UTC(2026, 0, 1);

beforeEach(async () => {
  db.close();
  await Dexie.delete("cmai-tracker");
  await db.open();
  await db.patients.add({ id: "P-01", anchor: T0 });
});

async function exportWithNote(beforeNote: string) {
  await db.observations.add({
    patientId: "P-01",
    itemId: 7,
    at: T0 + 1000,
    loggedAt: T0 + 1000,
    before: "Other",
    beforeNote,
  });
  const { observationsCsv } = await buildExport(T0 + 86_400_000);
  return observationsCsv.split("\n")[1];
}

describe("observations.csv cells", () => {
  it.each(["=1+1", "+1", "-1", "@SUM(A1)"])("a note starting with %s is written as text", async (note) => {
    expect(await exportWithNote(note)).toContain(`,'${note},`);
  });

  it("a note that starts with a tab is written as text", async () => {
    expect(await exportWithNote("\tx")).toContain(",'\tx,");
  });

  it("a note with a comma is still quoted", async () => {
    expect(await exportWithNote("loud, then quiet")).toContain(',"loud, then quiet",');
  });

  it("a note that is both formula-like and has a comma is quoted after the apostrophe", async () => {
    expect(await exportWithNote("=A1,B1")).toContain(`,"'=A1,B1",`);
  });

  it("a patient code is unchanged", async () => {
    expect((await exportWithNote("ok")).startsWith("P-01,")).toBe(true);
  });
});
