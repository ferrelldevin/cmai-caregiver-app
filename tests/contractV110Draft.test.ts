// S6: the v1.1.0 draft schema is v1.0.0 plus optional fields only. Nothing in the app writes it yet.
declare const process: { cwd: () => string };

import Ajv2020 from "ajv/dist/2020";
// @ts-expect-error this repo has no @types/node; these modules ship with Node
import fs from "node:fs";
// @ts-expect-error see above
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "docs/contracts/cmai-export");
const read = (...p: string[]) => JSON.parse(fs.readFileSync(path.join(DIR, ...p), "utf8"));
const validate = new Ajv2020({ strict: true }).compile(read("cmai-export-1.1.0-draft.schema.json"));
const samples: string[] = [
  ...fs.readdirSync(path.join(DIR, "samples/export-1")),
  ...fs.readdirSync(path.join(DIR, "samples/export-2")),
];

describe("contract v1.1.0 draft (F-60)", () => {
  it("accepts every committed v1.0.0 sample unchanged, and with the version read as 1.1.0", () => {
    expect(samples.length).toBeGreaterThanOrEqual(8);
    for (const dir of ["export-1", "export-2"])
      for (const f of fs.readdirSync(path.join(DIR, "samples", dir))) {
        const doc = read("samples", dir, f);
        expect(validate(doc), `${f}: ${JSON.stringify(validate.errors)}`).toBe(true);
        expect(validate({ ...doc, schema_version: "1.1.0" }), f).toBe(true);
      }
  });

  it("accepts the example with all five new fields", () => {
    const doc = read("example-export-v1.1.0-draft.json");
    expect(validate(doc), JSON.stringify(validate.errors)).toBe(true);
    expect(doc.records.some((r: Record<string, unknown>) => r.time_approximate === true)).toBe(true);
    expect(doc.records.some((r: Record<string, unknown>) => r.change_reason === "wrong_time")).toBe(true);
    expect(doc.observation_windows).toHaveLength(1);
    expect(doc.header.app_commit && doc.header.rule_version).toBeTruthy();
  });

  it("refuses free text and malformed additions", () => {
    const ok = read("example-export-v1.1.0-draft.json");
    const bad = (mut: (d: ReturnType<typeof read>) => void) => {
      const d = structuredClone(ok);
      mut(d);
      return validate(d);
    };
    expect(bad((d) => (d.records[1].change_reason = "the nurse typed this"))).toBe(false);
    expect(bad((d) => (d.records[0].time_approximate = "yes"))).toBe(false);
    expect(bad((d) => delete d.observation_windows[0].end_utc)).toBe(false);
    expect(bad((d) => (d.header.app_commit = "not a commit"))).toBe(false);
    expect(bad((d) => (d.records[0].caregiver_name = "Jane"))).toBe(false);
    expect(bad((d) => (d.schema_version = "2.0.0"))).toBe(false);
  });
});
