// The on-phone PIN (R1 option A, F-46, plan 5.3, design note 011), on assumed approval behind
// the `pin` switch. The PIN says who is logging and stops a passer-by opening the app. It does
// not protect the data: a 4-digit secret has 10,000 values, so anything protected by it can be
// opened by trying them all. The phone's own passcode and storage encryption are the real guard.
// In NIST SP 800-63B-4 terms it is an "activation secret". Only a salt, a slow hash and the
// iteration count are stored, never the PIN, and none of them is ever in a backup.

import { db, type Caregiver } from "./db";

export const ITERATIONS = 600_000; // OWASP Password Storage Cheat Sheet, PBKDF2-HMAC-SHA256
export const PIN_LENGTH = 4; // assumed answer: NIST's minimum; 6 is its "should" (register F-46)
export const SETUP_PIN_LENGTH = 6;
export const WAIT_FROM = 5; // wrong tries before the first wait
export const FIRST_WAIT_MS = 30_000; // doubles with each wrong try after that
export const LOCK_AT = 10; // NIST: no more than 10 wrong tries in a row
const SETUP_KEY = "setupPin";

/** Turns a PIN into a hash that is slow to guess. */
export async function hashPin(pin: string, salt: Uint8Array, iterations = ITERATIONS): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Compares two hashes without stopping at the first difference. */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const newSalt = () => crypto.getRandomValues(new Uint8Array(16));

/** Why a new PIN is refused, or null. One digit repeated and straight runs are the PINs tried first. */
export function pinProblem(pin: string, length = PIN_LENGTH): string | null {
  if (!new RegExp(`^[0-9]{${length}}$`).test(pin)) return `Use ${length} digits.`;
  const d = [...pin].map(Number);
  const steps = new Set(d.slice(1).map((n, i) => n - d[i]));
  if (steps.size === 1 && [0, 1, -1].includes([...steps][0]))
    return "That PIN is too easy to guess, like 1111 or 1234. Choose another.";
  return null;
}

/** How long to wait after this many wrong tries in a row. */
export function waitAfter(failed: number): number {
  if (failed < WAIT_FROM) return 0;
  return FIRST_WAIT_MS * 2 ** Math.min(failed - WAIT_FROM, 10);
}

export type PinResult =
  | { ok: true }
  | { ok: false; reason: "wrong"; triesBeforeWait: number }
  | { ok: false; reason: "wait"; until: number }
  | { ok: false; reason: "locked" }
  | { ok: false; reason: "no-pin" };

interface Counted {
  failedAttempts?: number;
  lastFailedAt?: number;
}

/** A wait still running, if any. */
function waiting(c: Counted, now: number): number | null {
  const f = c.failedAttempts ?? 0;
  const until = (c.lastFailedAt ?? 0) + waitAfter(f);
  return f >= WAIT_FROM && now < until ? until : null;
}

function afterWrong(c: Counted, now: number) {
  const failedAttempts = (c.failedAttempts ?? 0) + 1;
  return { failedAttempts, lastFailedAt: now };
}

function wrongResult(failed: number, now: number): PinResult {
  if (failed >= WAIT_FROM) return { ok: false, reason: "wait", until: now + waitAfter(failed) };
  return { ok: false, reason: "wrong", triesBeforeWait: WAIT_FROM - failed };
}

/** Gives a caregiver a new PIN and clears any wrong tries or lock. */
export async function setPin(id: string, pin: string, iterations = ITERATIONS) {
  const problem = pinProblem(pin);
  if (problem) throw new Error(problem);
  const salt = newSalt();
  const hash = await hashPin(pin, salt, iterations);
  const n = await db.caregivers.update(id, {
    pinSalt: salt,
    pinHash: hash,
    pinIterations: iterations,
    failedAttempts: 0,
    lastFailedAt: undefined,
    lockedAt: undefined,
  });
  if (!n) throw new Error(`No caregiver ${id} on this phone.`);
}

export const hasPin = (c: Caregiver) => !!(c.pinHash && c.pinSalt && c.pinIterations);
export const isLocked = (c: Caregiver) => c.lockedAt !== undefined;

/** Checks a caregiver's PIN, counting wrong tries: a wait from the 5th, a lock at the 10th. */
export async function checkPin(id: string, pin: string, now = Date.now()): Promise<PinResult> {
  const c = await db.caregivers.get(id);
  if (!c || !hasPin(c)) return { ok: false, reason: "no-pin" };
  if (isLocked(c)) return { ok: false, reason: "locked" };
  const until = waiting(c, now);
  if (until) return { ok: false, reason: "wait", until };
  const hash = await hashPin(pin, c.pinSalt!, c.pinIterations!);
  // Read again after the slow hash, so two tries at once both count.
  const fresh = (await db.caregivers.get(id)) ?? c;
  if (sameBytes(hash, c.pinHash!)) {
    await db.caregivers.update(id, { failedAttempts: 0, lastFailedAt: undefined });
    return { ok: true };
  }
  const next = afterWrong(fresh, now);
  if (next.failedAttempts >= LOCK_AT) {
    await db.caregivers.update(id, { ...next, lockedAt: now });
    return { ok: false, reason: "locked" };
  }
  await db.caregivers.update(id, next);
  return wrongResult(next.failedAttempts, now);
}

// The setup PIN: 6 digits, held by whoever set up the phone. It resets or unlocks a caregiver's
// PIN and reads no data. It never locks (that would leave no way in short of clearing the app);
// its waits keep doubling instead. Stored in `meta`, which no backup carries.

interface SetupRecord extends Counted {
  salt: string;
  hash: string;
  iterations: number;
}

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((h) => parseInt(h, 16)));

async function readSetup(): Promise<SetupRecord | null> {
  const row = await db.meta.get(SETUP_KEY);
  if (typeof row?.value !== "string") return null;
  try {
    const r = JSON.parse(row.value) as SetupRecord;
    return typeof r.salt === "string" && typeof r.hash === "string" && typeof r.iterations === "number" ? r : null;
  } catch {
    return null;
  }
}

const writeSetup = (r: SetupRecord) => db.meta.put({ key: SETUP_KEY, value: JSON.stringify(r) });

export const hasSetupPin = async () => (await readSetup()) !== null;

/** Sets the setup PIN the first time. Changing it later needs the old one (`checkSetupPin` first). */
export async function setSetupPin(pin: string, iterations = ITERATIONS) {
  const problem = pinProblem(pin, SETUP_PIN_LENGTH);
  if (problem) throw new Error(problem.replace("1111 or 1234", "111111 or 123456"));
  const salt = newSalt();
  await writeSetup({ salt: hex(salt), hash: hex(await hashPin(pin, salt, iterations)), iterations });
}

export async function checkSetupPin(pin: string, now = Date.now()): Promise<PinResult> {
  const r = await readSetup();
  if (!r) return { ok: false, reason: "no-pin" };
  const until = waiting(r, now);
  if (until) return { ok: false, reason: "wait", until };
  const hash = await hashPin(pin, unhex(r.salt), r.iterations);
  const fresh = (await readSetup()) ?? r;
  if (sameBytes(hash, unhex(r.hash))) {
    await writeSetup({ salt: fresh.salt, hash: fresh.hash, iterations: fresh.iterations });
    return { ok: true };
  }
  const next = afterWrong(fresh, now);
  await writeSetup({ ...fresh, ...next });
  return wrongResult(next.failedAttempts, now);
}

/** With the setup PIN, gives a caregiver a new PIN: unlocks a locked one, or resets a forgotten one. */
export async function resetPin(
  id: string,
  setupPin: string,
  newPin: string,
  now = Date.now(),
  iterations = ITERATIONS,
) {
  const problem = pinProblem(newPin);
  if (problem) throw new Error(problem);
  const r = await checkSetupPin(setupPin, now);
  if (!r.ok) return r;
  await setPin(id, newPin, iterations);
  return r;
}
