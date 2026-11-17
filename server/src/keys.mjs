// Keys: random secrets, stored only as a SHA-256 hash. The secret is shown once, when it is made.
import { createHash, randomBytes } from "node:crypto";
import { pool } from "./db.mjs";

const hash = (secret) => createHash("sha256").update(secret).digest("hex");

export async function createKey({ label, role, dataClass }) {
  const secret = `cmai_${role}_${randomBytes(24).toString("base64url")}`;
  const { rows } = await pool.query(
    "INSERT INTO api_keys (label, role, data_class, key_hash) VALUES ($1, $2, $3, $4) RETURNING id",
    [label, role, dataClass, hash(secret)],
  );
  return { id: rows[0].id, secret };
}

/** The live key for an Authorization header, or null (unknown, revoked or malformed). */
export async function findKey(header) {
  const m = /^Bearer (cmai_(?:write|read)_[A-Za-z0-9_-]{20,})$/.exec(header ?? "");
  if (!m) return null;
  const { rows } = await pool.query(
    "SELECT id, label, role, data_class FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL",
    [hash(m[1])],
  );
  return rows[0] ?? null;
}
