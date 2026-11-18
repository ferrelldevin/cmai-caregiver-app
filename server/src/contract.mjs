// Checks a pushed file against contract v1.0.0 (docs/contracts/cmai-export/, copied into the image),
// then against the checks the lab's Python reader makes, so the server never stores a file the
// reader would stop on. The contract has no "self-test" value for data_class yet, so a self-test
// file is checked as "synthetic" and the server keeps the real label (assumed pick, register F-62).
import Ajv2020 from "ajv/dist/2020.js";
import { existsSync, readFileSync } from "node:fs";
import { offsetMin, parseUtc, validZone } from "./dates.mjs";

// In the image the schema sits at ../contract; in a checkout (unit tests) it is in docs/.
const inImage = new URL("../contract/cmai-export.schema.json", import.meta.url);
const inRepo = new URL("../../docs/contracts/cmai-export/cmai-export.schema.json", import.meta.url);
const schema = JSON.parse(readFileSync(existsSync(inImage) ? inImage : inRepo, "utf8"));
const check = new Ajv2020({ allErrors: false }).compile(schema);
const MAX_REVISION = 1_000_000_000; // the reader's cap

/** Returns a plain-English problem, or null when the file is acceptable for a key of `dataClass`. */
export function problemWith(doc, dataClass) {
  if (!doc || typeof doc !== "object" || !doc.header) return "The body is not an export file.";
  // Fixed wording only: nothing the sender wrote is copied into a message (it goes in the audit log).
  if (doc.header.data_class !== dataClass)
    return `This key takes ${dataClass} files, but the file carries another data class. Never mix data classes.`;
  const asContract = { ...doc, header: { ...doc.header, data_class: "synthetic" } };
  if (!check(asContract)) {
    const e = check.errors[0];
    return `Not a valid v1.0.0 file: ${e.instancePath || "file"} ${e.message}.`.slice(0, 160);
  }
  const h = doc.header;
  if (h.record_count !== doc.records.length)
    return `record_count says ${h.record_count} but the file has ${doc.records.length}.`;
  const start = parseUtc(h.range_start_utc);
  const end = parseUtc(h.range_end_utc);
  if (parseUtc(h.exported_at_utc) === null || start === null || end === null)
    return "A header time is not a real UTC time.";
  if (end < start) return "range_end_utc is before range_start_utc.";

  const seen = new Set();
  for (const [i, r] of doc.records.entries()) {
    const at = `Record ${i + 1}`;
    if (r.participant_id !== h.participant_id) return `${at} is for another participant.`;
    if ((r.rating_scale === "none") !== (r.frequency === null)) return `${at}: frequency and rating_scale disagree.`;
    if (r.revision > MAX_REVISION) return `${at}: revision is too large.`;
    const key = `${r.record_id}/${r.revision}`;
    if (seen.has(key)) return `${at}: the same record and revision appear twice in one file.`;
    seen.add(key);
    const begun = parseUtc(r.occurred_start_utc);
    const ended = r.occurred_end_utc === null ? null : parseUtc(r.occurred_end_utc);
    const logged = parseUtc(r.logged_at_utc);
    const revised = parseUtc(r.revised_at_utc);
    if (begun === null || logged === null || revised === null || (r.occurred_end_utc !== null && ended === null))
      return `${at}: a time is not a real UTC time.`;
    if (ended !== null && ended < begun) return `${at}: it ends before it starts.`;
    if (revised < logged) return `${at}: revised before it was logged.`;
    if (!validZone(r.tz_name)) return `${at}: unknown time zone.`;
    if (offsetMin(r.tz_name, begun) !== r.utc_offset_min)
      return `${at}: utc_offset_min does not match the zone at that time.`;
  }
  return null;
}
