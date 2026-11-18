// Sending self-test residents to the lab server (F-62, design note 024): only marked residents are
// sent, the file is the research export, repeats are skipped, every failure says what happened and
// leaves nothing marked as sent. The server is a stand-in function; the real one is checked by
// server/smoke.mjs and e2e/sync-live.cjs.
import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/data/db";
import { parseBackup } from "../src/data/manage";
import { buildResearchExport, currentZone, ExportBlocked, zoneOffsetMin } from "../src/data/researchExport";
import {
  classify,
  loadConfig,
  NO_CONFIG,
  resetSent,
  retryDelaySec,
  saveConfig,
  selfTestResidents,
  syncOnce,
} from "../src/data/sync";
import type { KeyValue } from "../src/data/sync";

const NOW = Date.UTC(2026, 10, 9, 15, 0, 0);
const ORIGIN = "https://lab.example:8787";
const ON = { on: true, key: "cmai_write_testkeytestkeytestkey" };

const memory = (): KeyValue & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

type Call = {
  url: string;
  headers: Record<string, string>;
  doc: { header: Record<string, unknown>; records: Record<string, unknown>[] };
};
/** A pretend server: records each request and answers with the next scripted reply (default 200). */
function server(...replies: (number | "down" | { status: number; body: string })[]) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, doc: JSON.parse(init.body as string) });
    const r = replies.length > 1 ? replies.shift()! : (replies[0] ?? 200);
    if (r === "down") throw new TypeError("Failed to fetch");
    const { status, body } =
      typeof r === "number" ? { status: r, body: JSON.stringify({ ok: true, error: `said ${r}` }) } : r;
    return new Response(body, { status });
  }) as typeof fetch;
  return { calls, f };
}

async function resident(id: string, extra: Record<string, unknown> = {}, logs = 2) {
  await db.patients.put({ id, anchor: NOW - 5 * 86_400_000, ...extra });
  for (let i = 0; i < logs; i++) {
    const at = NOW - (i + 1) * 3_600_000;
    await db.observations.add({
      patientId: id,
      itemId: 5 + i,
      at,
      loggedAt: at + 1000,
      tzOffsetMin: zoneOffsetMin(currentZone(), at),
    });
  }
}
const run = (s: ReturnType<typeof server>, store: KeyValue | null, config = ON, origin = ORIGIN) =>
  syncOnce({ origin, config, fetch: s.f, now: NOW, store });

beforeAll(async () => {
  await db.open();
});
beforeEach(async () => {
  for (const t of db.tables) await t.clear();
});

describe("what it needs before it sends anything", () => {
  it("says why, and sends nothing, when the switch is off, no server is built in, or there is no key", async () => {
    await resident("P-07", { selfTest: true });
    const s = server();
    expect(await run(s, memory(), { ...ON, on: false })).toEqual({ kind: "off" });
    expect(await run(s, memory(), ON, "")).toEqual({ kind: "no-server" });
    expect(await run(s, memory(), { on: true, key: "" })).toEqual({ kind: "no-key" });
    expect(s.calls).toHaveLength(0);
  });

  it("the switch is off until someone turns it on, and a damaged setting reads as off", () => {
    const store = memory();
    expect(loadConfig(store)).toEqual(NO_CONFIG);
    store.setItem("cmai-sync", "{not json");
    expect(loadConfig(store)).toEqual(NO_CONFIG);
    store.setItem("cmai-sync", JSON.stringify({ on: "yes", key: 5 }));
    expect(loadConfig(store)).toEqual(NO_CONFIG);
    saveConfig(ON, store);
    expect(loadConfig(store)).toEqual(ON);
    expect(loadConfig(null)).toEqual(NO_CONFIG);
    expect(() => saveConfig(ON, null)).not.toThrow(); // blocked storage
  });

  it("blocked browser storage does not stop the app", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      expect(loadConfig()).toEqual(NO_CONFIG);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete (globalThis as Record<string, unknown>).localStorage;
    }
  });

  it("with nobody marked self-test, or no logs yet, there is nothing to send", async () => {
    const s = server();
    await resident("P-07", {}, 3); // real resident, not marked
    expect(await run(s, memory())).toEqual({ kind: "no-residents" });
    await resident("P-08", { selfTest: true }, 0); // marked, no logs
    expect(await run(s, memory())).toEqual({ kind: "no-residents" });
    expect(s.calls).toHaveLength(0);
  });
});

describe("who is sent", () => {
  it("only a marked, active resident that is not demo data", async () => {
    await resident("P-01", { selfTest: true });
    await resident("P-02"); // real, not marked
    await resident("P-DEMO-A", { demo: true, selfTest: true }); // demo can never be self-test
    await resident("P-03", { selfTest: true, archivedAt: NOW, archiveReason: "Duplicate" });
    expect((await selfTestResidents()).map((p) => p.id)).toEqual(["P-01"]);
    const s = server();
    await run(s, memory());
    expect(s.calls.map((c) => c.doc.header.participant_id)).toEqual(["P-01"]);
  });

  it("the file is the research export, labeled self-test, with the key in the header", async () => {
    await resident("P-07", { selfTest: true });
    const s = server();
    const result = await run(s, memory());
    expect(result).toEqual({ kind: "ok", at: NOW, sent: 1 });
    const [call] = s.calls;
    expect(call.url).toBe(`${ORIGIN}/v1/logs`);
    expect(call.headers.authorization).toBe(`Bearer ${ON.key}`);
    expect(call.doc.header).toMatchObject({
      participant_id: "P-07",
      data_class: "self-test",
      record_count: 2,
    });
    const manual = await buildResearchExport({
      patientId: "P-07",
      startDay: "2026-11-09",
      endDay: "2026-11-09",
      allowSelfTest: true,
      now: NOW,
    });
    expect(Object.keys(JSON.parse(manual.text))).toEqual(["schema_version", "header", "records"]);
    expect(call.doc.records.every((r) => typeof r.cmai_item === "number" && !("note" in r))).toBe(true);
  });

  it("the manual export still refuses a self-test resident: only the sync may send one", async () => {
    await resident("P-07", { selfTest: true });
    const input = { patientId: "P-07", startDay: "2026-11-09", endDay: "2026-11-09", now: NOW };
    await expect(buildResearchExport(input)).rejects.toThrow(ExportBlocked);
    await expect(buildResearchExport({ ...input, allowSelfTest: true })).resolves.toBeTruthy();
    // A resident that is not marked cannot be let through by the flag.
    await resident("P-08");
    await expect(buildResearchExport({ ...input, patientId: "P-08", allowSelfTest: true })).rejects.toThrow(
      ExportBlocked,
    );
  });

  it("the mark survives a backup and restore, and demo data cannot carry it", () => {
    const backup = (patients: unknown[]) => JSON.stringify({ format: 2, patients, observations: [] });
    const good = parseBackup(backup([{ id: "P-07", anchor: NOW, selfTest: true }]));
    expect(good.patients[0].selfTest).toBe(true);
    const bad = parseBackup(
      backup([
        { id: "P-DEMO-A", anchor: NOW, demo: true, selfTest: true },
        { id: "P-09", anchor: NOW, selfTest: "yes" },
      ]),
    );
    expect(bad.patients).toHaveLength(0);
  });
});

describe("repeats, edits and failures", () => {
  it("sends once, skips what the server already has, and sends again after an edit", async () => {
    await resident("P-07", { selfTest: true });
    const s = server();
    const store = memory();
    expect(await run(s, store)).toMatchObject({ kind: "ok", sent: 1 });
    expect(s.calls).toHaveLength(1);
    expect(await run(s, store)).toMatchObject({ kind: "ok", sent: 1 });
    expect(s.calls).toHaveLength(1); // nothing changed: nothing sent
    const first = await db.observations.where("patientId").equals("P-07").first();
    await db.observations.update(first!.id!, { itemId: 20, rev: 2 });
    await run(s, store);
    expect(s.calls).toHaveLength(2);
    expect(s.calls[1].doc.records.find((r) => r.cmai_item === 20)).toBeTruthy();
  });

  it("when the server cannot be reached nothing is marked sent, and the next try sends it", async () => {
    await resident("P-07", { selfTest: true });
    const store = memory();
    const down = server("down");
    expect(await run(down, store)).toEqual({
      kind: "waiting",
      reason: "The lab server cannot be reached.",
      unsent: 1,
      refused: false,
    });
    expect(store.data["cmai-sync-sent"]).toBeUndefined();
    const up = server(200);
    expect(await run(up, store)).toMatchObject({ kind: "ok" });
    expect(up.calls).toHaveLength(1);
  });

  it("a busy or broken server is tried again; a 'no' is shown in the server's words and not hammered", async () => {
    await resident("P-07", { selfTest: true });
    const busy = await run(server(503), memory());
    expect(busy).toMatchObject({ kind: "waiting", refused: false, reason: "said 503" });
    expect(await run(server(429), memory())).toMatchObject({ refused: false });
    const bad = await run(server({ status: 401, body: JSON.stringify({ error: "A valid key is needed." }) }), memory());
    expect(bad).toEqual({ kind: "waiting", reason: "A valid key is needed.", unsent: 1, refused: true });
    const conflict = await run(server({ status: 409, body: JSON.stringify({ error: "x".repeat(500) }) }), memory());
    expect(conflict.kind === "waiting" && conflict.reason.length).toBe(160);
    const html = await run(server({ status: 502, body: "<html>bad gateway</html>" }), memory());
    expect(html).toMatchObject({ reason: "The server answered 502.", refused: false });
    const empty = await run(server({ status: 422, body: JSON.stringify({}) }), memory());
    expect(empty).toMatchObject({ reason: "The server answered 422.", refused: true });
  });

  it("a damaged record of what was sent just means sending again", async () => {
    await resident("P-07", { selfTest: true });
    for (const bad of ["not json", "[]", "5"]) {
      const store = memory();
      store.setItem("cmai-sync-sent", bad);
      const s = server();
      expect(await run(s, store)).toMatchObject({ kind: "ok" });
      expect(s.calls).toHaveLength(1);
    }
  });

  it("with two residents, one that was accepted stays sent when the second fails", async () => {
    await resident("P-07", { selfTest: true });
    await resident("P-08", { selfTest: true });
    const store = memory();
    const s = server(200, 503);
    const result = await run(s, store);
    expect(result).toMatchObject({ kind: "waiting", unsent: 1 });
    const saved = JSON.parse(store.data["cmai-sync-sent"]).prints;
    expect(Object.keys(saved)).toHaveLength(1);
    const again = server(200);
    expect(await run(again, store)).toMatchObject({ kind: "ok", sent: 2 });
    expect(again.calls).toHaveLength(1); // only the one that had failed
  });

  it("a log the export cannot take (phone zone changed) is reported, not skipped", async () => {
    await resident("P-07", { selfTest: true }, 0);
    const at = NOW - 3_600_000;
    await db.observations.add({
      patientId: "P-07",
      itemId: 5,
      at,
      loggedAt: at,
      tzOffsetMin: zoneOffsetMin(currentZone(), at) + 60,
    });
    const s = server();
    const result = await run(s, memory());
    expect(result).toMatchObject({ kind: "waiting", refused: true });
    expect(result.kind === "waiting" && result.reason).toMatch(/^P-07: /);
    expect(s.calls).toHaveLength(0);
  });

  it("an unexpected error building the file is reported without leaking details", async () => {
    await resident("P-07", { selfTest: true });
    const original = db.observations.where.bind(db.observations);
    let n = 0;
    (db.observations as unknown as { where: unknown }).where = (...args: unknown[]) => {
      if (++n > 1) throw new Error("secret disk detail");
      return (original as (...a: unknown[]) => unknown)(...args);
    };
    try {
      const result = await run(server(), memory());
      expect(result).toMatchObject({ kind: "waiting", refused: true, reason: "P-07: The export could not be built." });
    } finally {
      (db.observations as unknown as { where: unknown }).where = original;
    }
  });
});

describe("changes made while a pass is running, and a different server", () => {
  it("a resident unmarked while an earlier one is being sent is not sent", async () => {
    await resident("P-07", { selfTest: true });
    await resident("P-08", { selfTest: true });
    const store = memory();
    const calls: string[] = [];
    const f = (async (_url: string, init: RequestInit) => {
      const doc = JSON.parse(init.body as string);
      calls.push(doc.header.participant_id);
      if (calls.length === 1) await db.patients.update(calls[0] === "P-07" ? "P-08" : "P-07", { selfTest: undefined });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const result = await syncOnce({ origin: ORIGIN, config: ON, fetch: f, now: NOW, store });
    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ kind: "ok", sent: 1 });
  });

  it("an archived resident, a removed key, or the switch turned off mid-pass stops what has not gone out", async () => {
    for (const change of ["archive", "key", "off"] as const) {
      for (const t of db.tables) await t.clear();
      await resident("P-07", { selfTest: true });
      await resident("P-08", { selfTest: true });
      let live = { ...ON };
      let n = 0;
      const f = (async () => {
        n++;
        if (n === 1) {
          if (change === "archive") await db.patients.update("P-08", { archivedAt: NOW, archiveReason: "Duplicate" });
          if (change === "archive") await db.patients.update("P-07", { archivedAt: NOW, archiveReason: "Duplicate" });
          if (change === "key") live = { on: true, key: "" };
          if (change === "off") live = { on: false, key: ON.key };
        }
        return new Response("{}", { status: 200 });
      }) as typeof fetch;
      const result = await syncOnce({
        origin: ORIGIN,
        config: ON,
        getConfig: () => live,
        fetch: f,
        now: NOW,
        store: memory(),
      });
      expect(n, change).toBe(1);
      expect(result.kind, change).toBe(change === "archive" ? "ok" : change === "key" ? "no-key" : "off");
    }
  });

  it("a new key or a different server address is sent everything again; so is 'send everything again'", async () => {
    await resident("P-07", { selfTest: true });
    const store = memory();
    const s = server();
    await run(s, store);
    await run(s, store);
    expect(s.calls).toHaveLength(1);
    await run(s, store, { on: true, key: "cmai_write_anotherkeyanotherkeyanother" });
    expect(s.calls).toHaveLength(2);
    await run(s, store, { on: true, key: "cmai_write_anotherkeyanotherkeyanother" }, "https://other.example:8787");
    expect(s.calls).toHaveLength(3);
    await run(s, store, { on: true, key: "cmai_write_anotherkeyanotherkeyanother" }, "https://other.example:8787");
    expect(s.calls).toHaveLength(3);
    resetSent(store);
    await run(s, store, { on: true, key: "cmai_write_anotherkeyanotherkeyanother" }, "https://other.example:8787");
    expect(s.calls).toHaveLength(4);
    expect(() => resetSent(null)).not.toThrow();
  });

  it("a phone that cannot save its notes, or cannot read its database, reports a wait instead of crashing", async () => {
    await resident("P-07", { selfTest: true });
    const full: KeyValue = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(await run(server(), full)).toMatchObject({ kind: "ok", sent: 1 }); // it was accepted; it will just be sent again later
    const original = db.patients.toArray.bind(db.patients);
    (db.patients as unknown as { toArray: unknown }).toArray = () => Promise.reject(new Error("disk"));
    try {
      expect(await run(server(), memory())).toEqual({
        kind: "waiting",
        reason: "Something went wrong on this phone. It will try again.",
        unsent: 1,
        refused: false,
      });
    } finally {
      (db.patients as unknown as { toArray: unknown }).toArray = original;
    }
  });
});

describe("timing", () => {
  it("classifies replies: only busy-server codes are worth retrying soon", () => {
    for (const s of [408, 425, 429, 500, 502, 503, 504]) expect(classify(s)).toBe("retry");
    for (const s of [400, 401, 403, 404, 409, 413, 422]) expect(classify(s)).toBe("refused");
  });
  it("backs off 30 s, 60 s, 120 s ... never past 15 minutes", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(retryDelaySec)).toEqual([30, 60, 120, 240, 480, 900, 900, 900]);
    expect(retryDelaySec(0)).toBe(30);
  });
});
