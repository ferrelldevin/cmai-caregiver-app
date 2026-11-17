// Sending a self-test resident's logs to the lab server (F-62, design note 023 and 024).
// Lab build only, and only a resident the tester marked "self-test" is ever sent. The file is the
// same v1.0.0 research export the manual action makes, built by the same code, so nothing new leaves
// the phone. The server keeps the newest revision of every record and ignores repeats, which is what
// makes it safe to send the whole file again after any failure: there is no queue to lose or corrupt,
// and no database version to change. "Unsent" simply means the file no longer matches what the server
// last accepted. This file holds the rules; src/ui/syncRunner.ts owns the timers and events.

import { db, isActive, type Patient } from "./db";
import { buildResearchExport, ExportBlocked } from "./researchExport";

export interface SyncConfig {
  on: boolean; // the send switch. Off until a person turns it on
  key: string; // a write key for the "self-test" class, made on the server; kept on this phone only
}

export const NO_CONFIG: SyncConfig = { on: false, key: "" };
const CONFIG_KEY = "cmai-sync";
const SENT_KEY = "cmai-sync-sent";

/** A tiny key-value store; the phone's localStorage in the app, a plain object in tests. */
export interface KeyValue {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const browserStore = (): KeyValue | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // blocked storage: the app still works, sending just stays off
  }
};

export function loadConfig(store: KeyValue | null = browserStore()): SyncConfig {
  try {
    const raw = JSON.parse(store?.getItem(CONFIG_KEY) ?? "null");
    if (raw && typeof raw.on === "boolean" && typeof raw.key === "string") return { on: raw.on, key: raw.key };
  } catch {
    /* fall through to the default */
  }
  return NO_CONFIG;
}

export function saveConfig(config: SyncConfig, store: KeyValue | null = browserStore()): void {
  store?.setItem(CONFIG_KEY, JSON.stringify(config));
}

type Sent = Record<string, string>; // resident code -> fingerprint of the records the server last accepted

function loadSent(store: KeyValue | null): Sent {
  try {
    const raw = JSON.parse(store?.getItem(SENT_KEY) ?? "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

/** What the person sees. `waiting` covers both "can't reach it" and "it said no": both are tried again later. */
export type SyncState =
  | { kind: "off" }
  | { kind: "no-server" } // this version was built with no lab server address
  | { kind: "no-key" }
  | { kind: "no-residents" } // nobody is marked self-test, or none has a log yet
  | { kind: "ok"; at: number; sent: number } // everything marked self-test is on the server
  | { kind: "waiting"; reason: string; unsent: number; refused: boolean };

/** Where a failure sits: worth trying again soon (network, server busy) or told no (bad key, bad file). */
export function classify(status: number): "retry" | "refused" {
  return status === 408 || status === 425 || status === 429 || status >= 500 ? "retry" : "refused";
}

/** Seconds to wait before attempt number `tries` (1, 2, 3 ...): 30 s, doubling, never over 15 minutes. */
export const retryDelaySec = (tries: number) => Math.min(30 * 2 ** Math.max(0, tries - 1), 900);

const dayText = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function fingerprint(records: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(records));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Residents the sync may send: marked self-test, never demo, not archived. */
export async function selfTestResidents(): Promise<Patient[]> {
  return (await db.patients.toArray()).filter((p) => p.selfTest === true && !p.demo && isActive(p));
}

export interface SyncDeps {
  origin: string;
  config: SyncConfig;
  fetch?: typeof fetch;
  now?: number;
  /** Where "what the server last accepted" is kept. Defaults to this phone's localStorage. */
  store?: KeyValue | null;
}

/**
 * One pass: for each self-test resident whose records changed since the server last accepted them,
 * build the export and send it. Stops at the first failure and says why. Never throws.
 */
export async function syncOnce(deps: SyncDeps): Promise<SyncState> {
  const { origin, config } = deps;
  const send = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now();
  const store = deps.store === undefined ? browserStore() : deps.store;
  if (!config.on) return { kind: "off" };
  if (!origin) return { kind: "no-server" };
  if (!config.key) return { kind: "no-key" };

  const sent = loadSent(store);
  const todo: { patient: Patient; text: string; print: string }[] = [];
  let upToDate = 0;
  for (const patient of await selfTestResidents()) {
    const logs = await db.observations.where("patientId").equals(patient.id).toArray();
    if (!logs.length) continue;
    const first = Math.min(...logs.map((o) => o.at));
    const last = Math.max(now, ...logs.map((o) => o.at));
    try {
      const built = await buildResearchExport({
        patientId: patient.id,
        startDay: dayText(first),
        endDay: dayText(last),
        allowSelfTest: true,
        now,
      });
      const print = await fingerprint(JSON.parse(built.text).records);
      if (sent[patient.id] === print) upToDate++;
      else todo.push({ patient, text: built.text, print });
    } catch (e) {
      const reason = e instanceof ExportBlocked ? e.message : "The export could not be built.";
      return { kind: "waiting", reason: `${patient.id}: ${reason}`, unsent: 1, refused: true };
    }
  }
  if (!upToDate && !todo.length) return { kind: "no-residents" };

  let delivered = 0;
  for (const { patient, text, print } of todo) {
    let res: Response;
    try {
      res = await send(`${origin}/v1/logs`, {
        method: "POST",
        headers: { authorization: `Bearer ${config.key}`, "content-type": "application/json" },
        body: text,
      });
    } catch {
      return {
        kind: "waiting",
        reason: "The lab server cannot be reached.",
        unsent: todo.length - delivered,
        refused: false,
      };
    }
    if (!res.ok) {
      const refused = classify(res.status) === "refused";
      let said = "";
      try {
        said = String((await res.json()).error ?? "").slice(0, 160);
      } catch {
        /* the reply was not JSON */
      }
      return {
        kind: "waiting",
        reason: said || `The server answered ${res.status}.`,
        unsent: todo.length - delivered,
        refused,
      };
    }
    sent[patient.id] = print;
    delivered++;
    store?.setItem(SENT_KEY, JSON.stringify(sent)); // saved per resident, so a later failure does not resend this one
  }
  return { kind: "ok", at: now, sent: upToDate + delivered };
}
