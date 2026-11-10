// The switcher's rows come from the current patient list, never from an earlier database answer.
import { describe, expect, it } from "vitest";
import type { Patient } from "../src/data/db";
import type { PatientSummary } from "../src/data/patients";
import { switcherRows } from "../src/ui/patientRows";

const patient = (id: string, demo = false): Patient => ({ id, anchor: 0, ...(demo ? { demo: true } : {}) });
const detail = (id: string, demo = false): PatientSummary => ({
  ...patient(id, demo),
  period: 2,
  day: 5,
  lastLogged: 1000,
});

describe("switcherRows", () => {
  it("lists a patient the details do not know yet, with period 0", () => {
    const rows = switcherRows([patient("A"), patient("B"), patient("C")], [detail("A"), detail("B")], "");
    expect(rows.map((r) => r.id)).toEqual(["A", "B", "C"]);
    expect(rows[0].period).toBe(2);
    expect(rows[2].period).toBe(0);
    expect(rows[2].lastLogged).toBeUndefined();
  });

  it("drops a patient the details still hold but the list no longer has", () => {
    expect(switcherRows([patient("A")], [detail("A"), detail("B")], "").map((r) => r.id)).toEqual(["A"]);
  });

  it("returns every patient while the details are still loading", () => {
    expect(switcherRows([patient("A"), patient("B")], null, "").map((r) => r.id)).toEqual(["A", "B"]);
  });

  it("finds P-03 among eight patients when details cover only the two demo patients", () => {
    const patients = [
      patient("P-DEMO-A", true),
      patient("P-DEMO-B", true),
      ...["P-01", "P-02", "P-03", "P-04", "P-05", "P-06"].map((id) => patient(id)),
    ];
    const details = [detail("P-DEMO-A", true), detail("P-DEMO-B", true)];
    expect(switcherRows(patients, details, "03").map((r) => r.id)).toEqual(["P-03"]);
  });
});
