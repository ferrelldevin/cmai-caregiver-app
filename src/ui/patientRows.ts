// The switcher's rows: every current patient, with period and last log once the database has
// answered. Built from the patient list, never from an earlier answer, so a patient added or
// deleted since the sheet was last open is right from the first paint.
import type { Patient } from "../data/db";
import type { PatientSummary } from "../data/patients";

export type SwitcherRow = Patient & { period: number; day: number; lastLogged: number | null | undefined };

export function switcherRows(patients: Patient[], details: PatientSummary[] | null, query: string): SwitcherRow[] {
  const byId = new Map((details ?? []).map((d) => [d.id, d]));
  const q = query.trim().toLowerCase();
  return patients
    .map((p): SwitcherRow => byId.get(p.id) ?? { ...p, period: 0, day: 0, lastLogged: undefined })
    .filter((p) => p.id.toLowerCase().includes(q));
}
