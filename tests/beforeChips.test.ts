// Three more "just before" chips (F-41, plan 5.9), behind `extraBeforeChips`.
import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";

const TODAY = [
  "Personal care or bathing",
  "Mealtime",
  "Noise or crowding",
  "Seemed in pain",
  "Change in routine",
  "Visitor or phone call",
  "Nothing noticed",
  "Other",
];

async function optionsIn(mode: "caregiver" | "lab") {
  vi.resetModules();
  vi.doMock("../src/study/settings", async (orig) => {
    const real = await orig<typeof import("../src/study/settings")>();
    return { ...real, study: real.settingsFor(mode) };
  });
  return (await import("../src/ui/LogSheet")).BEFORE_OPTIONS;
}

describe("just before chips", () => {
  it("switch off: exactly today's eight, in today's order", async () => {
    expect(await optionsIn("caregiver")).toEqual(TODAY);
  });

  it("switch on: eleven, with Nothing noticed and Other still last", async () => {
    const lab = await optionsIn("lab");
    expect(lab).toHaveLength(11);
    expect(lab.slice(-2)).toEqual(["Nothing noticed", "Other"]);
    expect(lab).toEqual(expect.arrayContaining(["Too hot or too cold", "Slept badly last night", "Seemed unwell"]));
  });

  it("a backup from a lab phone restores on a caregiver phone with every chip", async () => {
    vi.resetModules();
    vi.doUnmock("../src/study/settings");
    const { db } = await import("../src/data/db");
    const { restoreBackup } = await import("../src/data/manage");
    await db.open();
    const T = Date.UTC(2026, 9, 1);
    const extra = ["Too hot or too cold", "Slept badly last night", "Seemed unwell"];
    const backup = {
      app: "cmai-tracker",
      formatVersion: 2,
      patients: [{ id: "P-01", anchor: T, createdAt: T }],
      observations: extra.map((before, i) => ({ patientId: "P-01", itemId: 7, at: T + i, loggedAt: T + i, before })),
    };
    await restoreBackup(JSON.stringify(backup));
    expect((await db.observations.toArray()).map((o) => o.before).sort()).toEqual([...extra].sort());
  });
});
