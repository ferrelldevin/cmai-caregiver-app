// Lab admin commands, run inside the container (there is no admin web page):
//   docker compose exec sync node src/admin.mjs key:create --role write|read --class self-test|synthetic --label "text"
//   docker compose exec sync node src/admin.mjs key:list
//   docker compose exec sync node src/admin.mjs key:revoke <id>
//   docker compose exec sync node src/admin.mjs audit [count]
//   docker compose exec sync node src/admin.mjs data:delete --participant P-07 --class self-test
//     (removes one participant's stored records in one class, for a tester starting over; the audit log keeps the record of it)
// Making and revoking keys is written to the audit log too.
import { audit, pool, setup } from "./db.mjs";
import { createKey } from "./keys.mjs";

const [cmd, ...rest] = process.argv.slice(2);
/** The value after `--name`, or undefined when the flag is missing or the next word is another flag. */
const flag = (n) => {
  const i = rest.indexOf(`--${n}`);
  const v = i < 0 ? undefined : rest[i + 1];
  return v === undefined || v.startsWith("--") ? undefined : v;
};
await setup();

if (cmd === "key:create") {
  const role = flag("role");
  const dataClass = flag("class");
  const label = flag("label");
  if (!["write", "read"].includes(role) || !["self-test", "synthetic"].includes(dataClass) || !label) {
    console.error('Usage: key:create --role write|read --class self-test|synthetic --label "who or what holds it"');
    process.exitCode = 1;
  } else {
    const { id, secret } = await createKey({ label, role, dataClass });
    await audit({ keyId: id, action: "key:create", dataClass, outcome: "ok", detail: `${role} key "${label}"` });
    console.log(`Key ${id} (${role}, ${dataClass}, "${label}"). Shown once, store it now:\n${secret}`);
  }
} else if (cmd === "key:list") {
  const { rows } = await pool.query(
    "SELECT id, label, role, data_class, created_at, revoked_at FROM api_keys ORDER BY id",
  );
  console.table(rows);
} else if (cmd === "key:revoke") {
  const id = Number(rest[0]);
  const { rowCount } = await pool.query("UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL", [
    id,
  ]);
  if (rowCount) await audit({ keyId: id, action: "key:revoke", outcome: "ok" });
  console.log(rowCount ? `Key ${id} revoked.` : "No live key with that id.");
} else if (cmd === "data:delete") {
  const participant = flag("participant");
  const dataClass = flag("class");
  if (!/^[A-Z]{1,5}(-[A-Z0-9]{1,12})+$/.test(participant ?? "") || !["self-test", "synthetic"].includes(dataClass)) {
    console.error("Usage: data:delete --participant P-07 --class self-test|synthetic");
    process.exitCode = 1;
  } else {
    const { rowCount } = await pool.query("DELETE FROM observations WHERE participant_id = $1 AND data_class = $2", [
      participant,
      dataClass,
    ]);
    await audit({ action: "data:delete", dataClass, participantId: participant, outcome: "ok", count: rowCount });
    console.log(`Removed ${rowCount} stored revisions for ${participant} (${dataClass}).`);
  }
} else if (cmd === "audit") {
  const { rows } = await pool.query(
    "SELECT id, at, key_id, action, data_class, participant_id, range_start, range_end, outcome, record_count, remote_addr, detail FROM audit_log ORDER BY id DESC LIMIT $1",
    [Number(rest[0] ?? 20)],
  );
  console.table(rows);
} else {
  console.error("Commands: key:create, key:list, key:revoke <id>, audit [count], data:delete");
  process.exitCode = 1;
}
await pool.end();
