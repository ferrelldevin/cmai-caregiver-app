// "Send to the lab server" (F-62, lab build only): the send switch (off until someone turns it on),
// the key, which residents are the tester's own test data, and what is happening now.
// Sends the same file "Export for research" makes, for self-test residents only.

import { useEffect, useState } from "react";
import { db, type Patient } from "../data/db";
import type { SyncState } from "../data/sync";
import { Icon } from "./Icon";
import { changeSyncConfig, runSync, secondsUntilRetry, sendEverythingAgain, useSyncState } from "./syncRunner";

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function statusLine(s: SyncState, retryIn: number): string {
  switch (s.kind) {
    case "off":
      return "Not sending. The switch is off.";
    case "no-server":
      return "This version has no lab server address built in, so it cannot send.";
    case "no-key":
      return "Waiting for a key.";
    case "no-residents":
      return "Nothing to send yet: mark a resident as self-test below, and log something for them.";
    case "ok":
      return `Up to date at ${clock(s.at)}. ${s.sent} ${s.sent === 1 ? "resident" : "residents"} on the server.`;
    case "waiting":
      return `${s.reason} ${s.unsent} not sent yet. ${
        s.refused ? "Trying again in 15 minutes, or press Send now." : `Trying again in ${retryIn} s.`
      }`;
  }
}

export function SyncCard({ patients, onChange }: { patients: Patient[]; onChange: () => void }) {
  const { state, config } = useSyncState();
  const [key, setKey] = useState("");
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const real = patients.filter((p) => !p.demo);

  const mark = async (p: Patient, on: boolean) => {
    await db.patients.update(p.id, { selfTest: on ? true : undefined });
    onChange();
    void runSync(true);
  };

  return (
    <section className="card" aria-labelledby="sync-h">
      <h2 id="sync-h">Send to the lab server</h2>
      <p className="muted">
        For testing the lab pipeline with your own logs. Sends the same file as "Export for research", for residents
        marked self-test only, whenever there is signal. Item numbers and times only.
      </p>
      <label className="form-row">
        <span>Send logs to the lab server</span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={config.on}
          onChange={(e) => changeSyncConfig({ ...config, on: e.target.checked })}
        />
      </label>
      <div className="rx-field">
        <label htmlFor="sync-key" className="field-label">
          Server key
        </label>
        <input
          id="sync-key"
          type="password"
          value={key}
          placeholder={config.key ? "A key is saved on this phone" : "Paste the write key"}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="row wrap">
          <button
            className="ghost"
            disabled={!key.trim()}
            onClick={() => {
              changeSyncConfig({ ...config, key: key.trim() });
              setKey("");
            }}
          >
            Save key
          </button>
          {config.key && (
            <button className="ghost" onClick={() => changeSyncConfig({ ...config, key: "", on: false })}>
              Remove key
            </button>
          )}
        </div>
        <p className="muted">The key stays on this phone, in the browser's storage. It is not in backups.</p>
      </div>
      <h3 className="form-label">Which residents are your own test data</h3>
      {real.length === 0 ? (
        <p className="muted">Add a resident first. Demo residents are never sent from here.</p>
      ) : (
        real.map((p) => (
          <label className="form-row" key={p.id}>
            <span>{p.id} is self-test</span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={p.selfTest === true}
              onChange={(e) => void mark(p, e.target.checked)}
            />
          </label>
        ))
      )}
      <p className="msg error">
        <Icon name="alert" size={18} /> Mark only a resident you made up to test with. A real resident's logs must never
        be sent.
      </p>
      <p aria-live="polite" className={state.kind === "ok" ? "ok-line" : "muted"} data-sync-state={state.kind}>
        {statusLine(state, secondsUntilRetry())}
      </p>
      <div className="row wrap">
        <button className="ghost" onClick={() => void runSync(true)} disabled={!config.on}>
          Send now
        </button>
        <button className="ghost" onClick={sendEverythingAgain} disabled={!config.on}>
          Send everything again
        </button>
      </div>
      <p className="muted">
        "Send everything again" is for after the lab server was replaced or emptied. The server ignores anything it
        already has.
      </p>
    </section>
  );
}
