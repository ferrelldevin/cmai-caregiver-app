// Checks a pushed file against contract v1.0.0 (docs/contracts/cmai-export/, copied into the image).
// The contract has no "self-test" value for data_class yet, so a self-test file is checked as
// "synthetic" and the server keeps the real label (assumed pick, register F-62).
import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../contract/cmai-export.schema.json", import.meta.url), "utf8"));
const check = new Ajv2020({ allErrors: false }).compile(schema);

/** Returns a plain-English problem, or null when the file is acceptable for a key of `dataClass`. */
export function problemWith(doc, dataClass) {
  if (!doc || typeof doc !== "object" || !doc.header) return "The body is not an export file.";
  if (doc.header.data_class !== dataClass)
    return `This key takes ${dataClass} files, but the file says ${JSON.stringify(doc.header.data_class)}. Never mix data classes.`;
  const asContract = { ...doc, header: { ...doc.header, data_class: "synthetic" } };
  if (!check(asContract)) {
    const e = check.errors[0];
    return `Not a valid v1.0.0 file: ${e.instancePath || "file"} ${e.message}.`;
  }
  if (doc.header.record_count !== doc.records.length)
    return `record_count says ${doc.header.record_count} but the file has ${doc.records.length}.`;
  for (const r of doc.records) {
    if (r.participant_id !== doc.header.participant_id) return `Record ${r.record_id} is for another participant.`;
    if ((r.rating_scale === "none") !== (r.frequency === null))
      return `Record ${r.record_id}: frequency and rating_scale disagree.`;
  }
  return null;
}
