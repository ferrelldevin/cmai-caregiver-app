// Database: connection pool and the one-time table setup. Safe to run on every start.
// Connection settings come from the standard PGHOST, PGPORT, PGUSER, PGPASSWORD and PGDATABASE
// variables, so a password with odd characters never has to survive being put inside a URL.
import { createHash } from "node:crypto";
import pg from "pg";

// Two database logins. The owner (PGUSER, from the compose file) makes and changes the tables, and is
// used only by setup() at start. The service and the admin commands run as `cmai_app`, which can read
// and add rows but cannot alter or drop a table or trigger, and cannot change or delete the audit log.
// Its password is derived from the owner's, so there is no second secret to keep.
const APP_ROLE = "cmai_app";
const appPassword = () =>
  createHash("sha256")
    .update(`cmai-app:${process.env.PGPASSWORD ?? ""}`)
    .digest("hex");

export const pool = new pg.Pool({ user: APP_ROLE, password: appPassword() });
// An idle connection that drops (database restart) must not crash the service.
pool.on("error", (e) => console.error("database connection error:", e.message));

const SETUP = `
CREATE TABLE IF NOT EXISTS api_keys (
  id          serial PRIMARY KEY,
  label       text NOT NULL,
  role        text NOT NULL CHECK (role IN ('write', 'read')),
  -- 'real' is not allowed here on purpose (G1): the store refuses it until Dr. Gupta says in writing where it may live.
  data_class  text NOT NULL CHECK (data_class IN ('self-test', 'synthetic')),
  key_hash    text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);

CREATE TABLE IF NOT EXISTS observations (
  record_id          uuid NOT NULL,
  revision           integer NOT NULL CHECK (revision >= 1),
  data_class         text NOT NULL CHECK (data_class IN ('self-test', 'synthetic')),
  participant_id     text NOT NULL,
  occurred_start_utc timestamptz NOT NULL,
  record             jsonb NOT NULL,
  source_device      uuid NOT NULL,
  source_app_version text NOT NULL,
  pushed_by          integer NOT NULL REFERENCES api_keys (id),
  received_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (record_id, revision)
);
CREATE INDEX IF NOT EXISTS observations_lookup ON observations (data_class, participant_id, occurred_start_utc);
CREATE INDEX IF NOT EXISTS observations_received ON observations (data_class, participant_id, received_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id             bigserial PRIMARY KEY,
  at             timestamptz NOT NULL DEFAULT now(),
  key_id         integer,
  action         text NOT NULL,
  data_class     text,
  participant_id text,
  range_start    timestamptz,
  range_end      timestamptz,
  outcome        text NOT NULL,
  record_count   integer,
  detail         text
);
-- Added after the first version: where the request came from (the address the service saw).
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS remote_addr text;

-- The audit trail can only grow: no edit, no delete, no truncate.
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_log_no_change ON audit_log;
CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();
`;

const GRANTS = () => `
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN CREATE ROLE ${APP_ROLE} LOGIN; END IF;
END $$;
ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${appPassword()}'; -- hex digits only, safe to write inline
REVOKE ALL ON api_keys, observations, audit_log FROM ${APP_ROLE};
GRANT SELECT, INSERT ON api_keys, observations, audit_log TO ${APP_ROLE};
GRANT UPDATE (revoked_at) ON api_keys TO ${APP_ROLE};
GRANT DELETE ON observations TO ${APP_ROLE}; -- only for the admin "data:delete" command; no route deletes
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE};
`;

export async function setup() {
  const owner = new pg.Pool({ max: 1 });
  try {
    await owner.query(SETUP);
    await owner.query(GRANTS());
  } finally {
    await owner.end();
  }
}

/** Longest text kept in an audit row. Sender-chosen text is never copied in, only fixed messages. */
const DETAIL_MAX = 200;

/** Writes one audit row. Pass `client` to write it inside a transaction. */
export async function audit(a, client = pool) {
  await client.query(
    `INSERT INTO audit_log (key_id, action, data_class, participant_id, range_start, range_end, outcome, record_count, detail, remote_addr)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      a.keyId ?? null,
      a.action,
      a.dataClass ?? null,
      a.participantId ?? null,
      a.rangeStart ?? null,
      a.rangeEnd ?? null,
      a.outcome,
      a.count ?? null,
      a.detail == null ? null : String(a.detail).slice(0, DETAIL_MAX),
      a.remoteAddr ?? null,
    ],
  );
}
