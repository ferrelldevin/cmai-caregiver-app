// Push and pull. A push is all-or-nothing. Sending the same file twice changes nothing. A record
// arrives again only as a newer revision; the same revision with different content is refused.
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { audit, pool } from "./db.mjs";
import { utcText } from "./dates.mjs";

export class Refused extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Stores a checked file. `okAudit` is the audit row for a successful push; it is written in the
 * same transaction, so data is never stored without its audit row.
 */
export async function pushFile(doc, key, okAudit) {
  const { header, records } = doc;
  const client = await pool.connect();
  const counts = { added: 0, duplicate: 0 };
  try {
    await client.query("BEGIN");
    // Records are handled in a fixed order, each under its own lock, so two pushes that carry the
    // same record wait for each other instead of racing (or deadlocking on each other).
    for (const r of [...records].sort((a, b) => a.record_id.localeCompare(b.record_id))) {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [r.record_id]);
      const stored = await client.query(
        "SELECT revision, record, data_class, participant_id FROM observations WHERE record_id = $1",
        [r.record_id],
      );
      for (const old of stored.rows)
        if (old.data_class !== header.data_class || old.participant_id !== header.participant_id)
          throw new Refused(409, "A record in this file is already stored for another participant or data class.");
      const sameRevision = stored.rows.find((old) => old.revision === r.revision);
      if (sameRevision) {
        if (!isDeepStrictEqual(sameRevision.record, r))
          throw new Refused(
            409,
            "A record in this file has a revision that is already stored with different content. Nothing was saved.",
          );
        counts.duplicate++;
        continue;
      }
      await client.query(
        `INSERT INTO observations (record_id, revision, data_class, participant_id, occurred_start_utc, record, source_device, source_app_version, pushed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          r.record_id,
          r.revision,
          header.data_class,
          header.participant_id,
          r.occurred_start_utc,
          r,
          header.device_id,
          header.app_version,
          key.id,
        ],
      );
      counts.added++;
    }
    await audit({ ...okAudit, detail: `added ${counts.added}, already had ${counts.duplicate}` }, client);
    await client.query("COMMIT");
    return counts;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * The newest revision of every record for one participant that has any revision starting in
 * [start, end), as a v1.0.0 file. Matching on any revision (not only the newest) means an edit that
 * moved a log to another day still comes back for its old day, so the reader replaces the old copy.
 * With `since`, only records that received a new revision after that instant.
 */
export async function pullFile({ dataClass, participantId, start, end, since }) {
  const params = [dataClass, participantId, start, end];
  let changed = "";
  if (since) {
    params.push(since);
    changed = `AND record_id IN (
         SELECT record_id FROM observations WHERE data_class = $1 AND participant_id = $2 AND received_at > $5)`;
  }
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (record_id) record, source_device, source_app_version, received_at
       FROM observations
       WHERE data_class = $1 AND participant_id = $2
         AND record_id IN (
           SELECT record_id FROM observations
           WHERE data_class = $1 AND participant_id = $2 AND occurred_start_utc >= $3 AND occurred_start_utc < $4)
         ${changed}
       ORDER BY record_id, revision DESC
     ) latest
     ORDER BY (record->>'occurred_start_utc')::timestamptz, record->>'record_id'`,
    params,
  );
  const newest = rows.reduce((a, r) => (!a || r.received_at > a.received_at ? r : a), null);
  return {
    schema_version: "1.0.0",
    header: {
      export_id: randomUUID(),
      exported_at_utc: utcText(new Date()),
      app_version: newest?.source_app_version ?? "0.0.0",
      device_id: newest?.source_device ?? "00000000-0000-0000-0000-000000000000",
      participant_id: participantId,
      data_class: dataClass,
      range_start_utc: utcText(start),
      range_end_utc: utcText(end),
      record_count: rows.length,
    },
    records: rows.map((r) => r.record),
  };
}
