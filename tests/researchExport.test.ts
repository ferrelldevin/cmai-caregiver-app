// Research export (F-56, design note 018). Acceptance criteria 1 to 9 are named in the test titles.
// The made-up samples come from the seeder in docs/contracts/cmai-export/samples/, through the real export code.
// `WRITE_SAMPLES=1 npx vitest run tests/researchExport.test.ts` rewrites the committed sample files and their README.
declare const process: { env: Record<string, string | undefined>; cwd: () => string };

import "fake-indexeddb/auto";
import Ajv2020 from "ajv/dist/2020";
// @ts-expect-error this repo has no @types/node; these modules ship with Node
import { spawnSync } from "node:child_process";
// @ts-expect-error see above
import fs from "node:fs";
// @ts-expect-error see above
import os from "node:os";
// @ts-expect-error see above
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PLACEHOLDER_DEVICE_ID } from "../src/data/researchExport";
import {
  END_DAY,
  INSTALL_ID,
  SEED,
  START_DAY,
  TZ,
  makeSamples,
  type Sample,
} from "../docs/contracts/cmai-export/samples/seed-samples";

const CONTRACT = path.join(process.cwd(), "docs/contracts/cmai-export");
const SAMPLES = path.join(CONTRACT, "samples");
const checker = (...args: string[]) =>
  spawnSync("python3", [path.join(CONTRACT, "cmai_export_check.py"), ...args], { encoding: "utf8" }) as {
    status: number;
    stdout: string;
    stderr: string;
  };
const validate = new Ajv2020({ strict: true }).compile(
  JSON.parse(fs.readFileSync(path.join(CONTRACT, "cmai-export.schema.json"), "utf8")),
);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cmai-export-"));

describe("research export samples", () => {
  let samples: Sample[];
  const file = (s: Sample) => path.join(SAMPLES, s.dir, s.result.fileName);
  beforeAll(async () => {
    samples = await makeSamples();
  });

  it("1. makes 8 files: 6 participants, then 2 re-exports", () => {
    expect(samples.map((s) => s.dir)).toEqual(Array(6).fill("export-1").concat(["export-2", "export-2"]));
    expect(new Set(samples.map((s) => `${s.dir}/${s.result.fileName}`)).size).toBe(8);
    expect(samples[0].result.fileName).toBe(`cmai-export_P-DEMO-A_${START_DAY}_${END_DAY}.json`);
  });

  it("2. every file validates against the schema (draft 2020-12, Ajv)", () => {
    for (const s of samples) {
      const ok = validate(JSON.parse(s.result.text));
      expect(ok, `${s.result.fileName}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });

  it("3. the reader check prints OK on every file (--data-class synthetic)", () => {
    for (const s of samples) {
      const f = path.join(tmp, `${s.dir}-${s.result.fileName}`);
      fs.writeFileSync(f, s.result.text);
      const r = checker(f, "--data-class", "synthetic");
      expect(r.stderr).toBe("");
      expect(r.stdout).toMatch(/^OK: 1 file\(s\), \d+ active record\(s\) after merge/);
    }
  });

  it("4. the edit wins, the deleted record is gone, the count is right", () => {
    for (const id of ["P-DEMO-A", "P-DEMO-B"]) {
      const one = samples.find((s) => s.dir === "export-1" && s.result.fileName.includes(id))!;
      const two = samples.find((s) => s.dir === "export-2" && s.result.fileName.includes(id))!;
      const a = JSON.parse(one.result.text).records;
      const b = JSON.parse(two.result.text).records;
      const edited = b.filter((r: { revision: number; status: string }) => r.revision === 2 && r.status === "active");
      const gone = b.filter((r: { status: string }) => r.status === "deleted");
      expect(edited).toHaveLength(2);
      expect(gone).toHaveLength(1);
      expect(b).toHaveLength(a.length); // a full snapshot: tombstones are included, nothing else changes
      const f1 = path.join(tmp, `m1-${id}.json`);
      const f2 = path.join(tmp, `m2-${id}.json`);
      const csv = path.join(tmp, `m-${id}.csv`);
      fs.writeFileSync(f1, one.result.text);
      fs.writeFileSync(f2, two.result.text);
      const r = checker(f1, f2, "--data-class", "synthetic", "--events-csv", csv);
      expect(r.stdout).toContain(`OK: 2 file(s), ${a.length - 1} active record(s) after merge`);
      const rows = fs.readFileSync(csv, "utf8");
      expect(rows).not.toContain(gone[0].record_id);
      for (const e of edited) {
        expect(rows).toContain(e.record_id);
        const before = a.find((x: { record_id: string }) => x.record_id === e.record_id);
        expect(e.occurred_start_utc).not.toBe(before.occurred_start_utc);
        expect(rows).toContain(e.occurred_start_utc); // the merged row is the edited one
        expect(rows).not.toContain(before.occurred_start_utc);
      }
    }
  });

  it("5. the seed data crosses the 1 Nov 2026 clock change: offsets go from -240 to -300", () => {
    const offsets = new Set(
      samples.flatMap((s) =>
        JSON.parse(s.result.text).records.map((r: { utc_offset_min: number }) => r.utc_offset_min),
      ),
    );
    expect([...offsets].sort((a, b) => a - b)).toEqual([-300, -240]);
  });

  it("6. the shape asked for: counts, placeholder IDs, defaults, ends, roles", () => {
    const all = samples.slice(0, 6).map((s) => JSON.parse(s.result.text));
    const recs = all.flatMap((d) => d.records);
    expect(all.map((d) => d.header.participant_id)).toEqual(["A", "B", "C", "D", "E", "F"].map((x) => `P-DEMO-${x}`));
    expect(all.every((d) => d.header.data_class === "synthetic")).toBe(true);
    const placeholders = all.flatMap((d) =>
      d.records.filter((r: { device_id: string }) => r.device_id === PLACEHOLDER_DEVICE_ID),
    );
    expect(placeholders.length).toBeGreaterThan(0);
    expect(
      all
        .filter((d) => d.records.some((r: { device_id: string }) => r.device_id === PLACEHOLDER_DEVICE_ID))
        .map((d) => d.header.participant_id),
    ).toEqual(["P-DEMO-C"]);
    expect(recs.some((r: { device_id: string }) => r.device_id === INSTALL_ID)).toBe(true);
    expect(new Set(recs.map((r: { logger_role: string }) => r.logger_role))).toEqual(
      new Set(["caregiver", "staff", "researcher"]),
    );
    const count = (n: number) => all[n].records.length;
    expect(count(0) + count(1)).toBeGreaterThan(count(2) + count(3));
    expect(count(2) + count(3)).toBeGreaterThan(count(4) + count(5));
    for (const r of recs) expect((r.rating_scale === "none") === (r.frequency === null)).toBe(true);
    expect(new Set(recs.map((r: { cmai_item: number }) => r.cmai_item)).size).toBeGreaterThan(10);
  });

  it("7. the committed sample files are exactly what the seeder makes", () => {
    if (process.env.WRITE_SAMPLES) {
      for (const s of samples) {
        fs.mkdirSync(path.join(SAMPLES, s.dir), { recursive: true });
        fs.writeFileSync(file(s), s.result.text);
      }
      fs.writeFileSync(path.join(SAMPLES, "README.md"), readme(samples));
    }
    for (const s of samples) expect(fs.readFileSync(file(s), "utf8")).toBe(s.result.text);
    expect(fs.readFileSync(path.join(SAMPLES, "README.md"), "utf8")).toBe(readme(samples));
  });
});

function readme(samples: Sample[]) {
  const row = (s: Sample) => {
    const f = path.join(tmp, `readme-${s.dir}-${s.result.fileName}`);
    fs.writeFileSync(f, s.result.text);
    const r = checker(f, "--data-class", "synthetic");
    const x = s.result.summary;
    return `| \`${s.dir}/${s.result.fileName}\` | ${x.total} | ${x.active} | ${x.deleted} | ${x.placeholderDevice} | ${x.approxTime} | \`${r.stdout.trim()}\` |`;
  };
  const rows = samples.map(row);
  const merged = ["P-DEMO-A", "P-DEMO-B"].map((id) => {
    const [one, two] = ["export-1", "export-2"].map((d) =>
      path.join(tmp, `readme-${d}-cmai-export_${id}_${START_DAY}_${END_DAY}.json`),
    );
    return `- ${id}: \`${checker(one, two, "--data-class", "synthetic").stdout.trim()}\``;
  });
  return `# Made-up sample exports (research export contract v1.0.0)

Made-up data only. Six participants, \`data_class: "synthetic"\`, item numbers only. Made by running the real export code on fake logs; nothing here was written by hand. Register F-56, design note 018. Status: assumed, sign-off pending (Dr. Gupta).

## How they were made

- Seeder: [seed-samples.ts](./seed-samples.ts). Fixed seed \`${SEED}\`. Run: \`WRITE_SAMPLES=1 npx vitest run tests/researchExport.test.ts\` (rewrites these files); a normal \`npm test\` fails if any file differs from what the seeder makes.
- Participants P-DEMO-A to P-DEMO-F, \`tz_name: ${TZ}\`, local days ${START_DAY} to ${END_DAY} (14 days). The range crosses the 1 Nov 2026 clock change, so \`utc_offset_min\` goes from -240 to -300.
- \`export-1/\`: one file per participant, exported 2026-11-09T15:00:00Z. P-DEMO-C's first 4 days are "older logs": no install ID, so they carry the placeholder \`${PLACEHOLDER_DEVICE_ID}\`.
- Then, with the app's own \`editLog\` and \`deleteLog\`, 2 logs were edited and 1 deleted for P-DEMO-A and for P-DEMO-B, and those two were exported again to \`export-2/\` (2026-11-09T17:00:00Z). Each re-export is a full snapshot: edited logs have \`revision: 2\`, the deleted one is a tombstone.
- Frequency, review flag and role are not stored by the app today. The seeder keeps them on the side and hands them to the export, so the file shows the contract's rated branch. The real "Export for research" action writes \`frequency: null\`, \`rating_scale: "none"\`, \`reviewed: false\` and role "caregiver".
- The app only lets "It stopped" set an end time on three behaviors. These samples give about 70% of logs an end time on any behavior, as the request asked. A real export will have far fewer.

## Counts and check output

Checks: schema validation (Ajv, draft 2020-12) in \`tests/researchExport.test.ts\`, and \`python cmai_export_check.py <file> --data-class synthetic\` (Python 3.11+, stdlib only), output below.

| File | Records | Active | Deleted | Placeholder install ID | Approximate time | Reader check |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

Edit and delete, both files of a participant checked together (edit wins, deleted record gone):

${merged.join("\n")}
`;
}
