// Runs the sync (src/data/sync.ts) while the app is open: a check every 20 seconds, at once when the
// phone comes back online or the app comes back to the front, and right after "Send now". After a
// failure it waits 30 seconds, then 60, doubling up to 15 minutes. A "no" from the server (bad key,
// refused file) is tried again only every 15 minutes, since asking faster changes nothing.
// A web page cannot send while it is closed; the next open sends whatever is waiting.

import { useSyncExternalStore } from "react";
import { study } from "../study/settings";
import {
  loadConfig,
  resetSent,
  retryDelaySec,
  saveConfig,
  syncOnce,
  type SyncConfig,
  type SyncState,
} from "../data/sync";

const TICK_MS = 20_000;

let config: SyncConfig = loadConfig();
let state: SyncState = { kind: "off" };
let tries = 0;
let notBefore = 0; // no automatic attempt before this time
let running = false;
let started = false;
const listeners = new Set<() => void>();

const publish = (next: SyncState) => {
  state = next;
  listeners.forEach((l) => l());
};

export const getSyncState = () => state;
export const getSyncConfig = () => config;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const useSyncState = () => ({
  state: useSyncExternalStore(subscribe, getSyncState),
  config: useSyncExternalStore(subscribe, getSyncConfig),
});

/** Seconds until the next automatic attempt, or 0 when none is waiting. */
export const secondsUntilRetry = () =>
  state.kind === "waiting" ? Math.max(0, Math.ceil((notBefore - Date.now()) / 1000)) : 0;

let again = false; // someone asked for a pass while one was running: do one more when it ends

/** One attempt now. `manual` skips the wait (the "Send now" button and changes made in the card). */
export async function runSync(manual = false): Promise<void> {
  if (!study.syncToLab) return;
  if (running) {
    if (manual) again = true; // do not lose a change made mid-pass
    return;
  }
  if (!manual && Date.now() < notBefore) return;
  running = true;
  try {
    do {
      again = false;
      // getConfig: the pass looks again before each send, so a switch turned off mid-pass stops it.
      const next = await syncOnce({ origin: __SYNC_ORIGIN__, config, getConfig: () => config });
      if (next.kind === "waiting") {
        tries += 1;
        notBefore = Date.now() + (next.refused ? 900 : retryDelaySec(tries)) * 1000;
      } else {
        tries = 0;
        notBefore = 0;
      }
      publish(next);
    } while (again);
  } finally {
    running = false;
  }
}

export function changeSyncConfig(next: SyncConfig): void {
  config = next;
  try {
    saveConfig(next);
  } catch {
    /* full or blocked storage: the setting holds until the app is closed */
  }
  tries = 0;
  notBefore = 0;
  publish(next.on ? state : { kind: "off" });
  void runSync(true);
}

/** Send every self-test resident in full again, whatever the app thinks the server has (after a server was replaced or emptied). */
export function sendEverythingAgain(): void {
  resetSent();
  tries = 0;
  notBefore = 0;
  void runSync(true);
}

/** Call once, when the app opens. Does nothing in the caregiver build. */
export function startSync(): void {
  if (started || !study.syncToLab) return;
  started = true;
  void runSync(true);
  setInterval(() => void runSync(), TICK_MS);
  // Coming back online retries a network failure at once, but never a "no" from the server before its 15 minutes.
  window.addEventListener("online", () => void runSync(!(state.kind === "waiting" && state.refused)));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void runSync();
  });
}
