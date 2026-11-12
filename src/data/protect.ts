// Passphrase-protected backup (F-10, plan 5.11, design note 014), on assumed approval behind
// `protectBackup`. Unlike the PIN this is real protection: a passphrase of 12 or more characters
// cannot be tried exhaustively. The limit: a weak passphrase is weak.
// AES-GCM with a 256-bit key from PBKDF2-HMAC-SHA256 at 600,000 iterations (OWASP), a random
// 16-byte salt and 12-byte nonce in the file's header. The header is bound to the ciphertext as
// additional data, so changing any byte of the file, header included, makes it fail to open.

export const PASS_MIN = 12;
export const PROTECT_ITERATIONS = 600_000;
const MAGIC = "cmai-tracker-protected";

interface Header {
  app: typeof MAGIC;
  version: 1;
  kdf: "PBKDF2-HMAC-SHA256";
  iterations: number;
  salt: string;
  iv: string;
}
interface ProtectedFile extends Header {
  data: string;
}

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
// Large inputs: btoa on a spread of a big array overflows the stack, so encode in chunks.
function b64Big(b: Uint8Array) {
  let out = "";
  for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(out);
}
const headerBytes = (h: Header) =>
  new TextEncoder().encode(JSON.stringify([h.app, h.version, h.kdf, h.iterations, h.salt, h.iv]));

async function keyFrom(pass: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Why a passphrase is refused, or null. */
export function passProblem(pass: string): string | null {
  if (pass.length < PASS_MIN) return `Use at least ${PASS_MIN} characters. A short sentence is easiest to remember.`;
  if (new Set(pass).size < 4) return "Use more different characters.";
  return null;
}

export function isProtected(text: string): boolean {
  try {
    return (JSON.parse(text) as { app?: string }).app === MAGIC;
  } catch {
    return false;
  }
}

/** Encrypts `plain` into a protected file (JSON text). */
export async function protect(plain: string, pass: string, iterations = PROTECT_ITERATIONS): Promise<string> {
  const problem = passProblem(pass);
  if (problem) throw new Error(problem);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header: Header = {
    app: MAGIC,
    version: 1,
    kdf: "PBKDF2-HMAC-SHA256",
    iterations,
    salt: b64(salt),
    iv: b64(iv),
  };
  const key = await keyFrom(pass, salt, iterations);
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: headerBytes(header) as BufferSource },
    key,
    new TextEncoder().encode(plain),
  );
  const file: ProtectedFile = { ...header, data: b64Big(new Uint8Array(data)) };
  return JSON.stringify(file);
}

export const WRONG = "That passphrase does not open this file, or the file was changed. Nothing was restored.";

/** Opens a protected file. A wrong passphrase or a changed byte throws WRONG; nothing is returned. */
export async function unprotect(text: string, pass: string): Promise<string> {
  let f: ProtectedFile;
  try {
    f = JSON.parse(text) as ProtectedFile;
  } catch {
    throw new Error(WRONG);
  }
  if (f.app !== MAGIC || f.version !== 1 || f.kdf !== "PBKDF2-HMAC-SHA256")
    throw new Error("This is not a protected CMAI Tracker file.");
  // A changed count could make opening take forever, or make the key weak: accept only sane values.
  if (!Number.isInteger(f.iterations) || f.iterations < 100_000 || f.iterations > 10_000_000) throw new Error(WRONG);
  try {
    const salt = unb64(f.salt),
      iv = unb64(f.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error(WRONG);
    const key = await keyFrom(pass, salt, f.iterations);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource, additionalData: headerBytes(f) as BufferSource },
      key,
      unb64(f.data) as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error(WRONG);
  }
}

// What goes inside a protected file: the backup and every CSV, so no CSV leaves the phone
// unprotected. The lab opens it with Restore on a lab machine, then exports CSVs there.
interface Bundle {
  cmaiBundle: 1;
  backup: string;
  csv: Record<string, string>;
}

export const bundle = (backup: string, csv: Record<string, string>) =>
  JSON.stringify({ cmaiBundle: 1, backup, csv } satisfies Bundle);

/** The backup inside opened text: a bundle's backup, or the text itself for a plain backup. */
export function backupFrom(plain: string): string {
  try {
    const b = JSON.parse(plain) as Partial<Bundle>;
    return b.cmaiBundle === 1 && typeof b.backup === "string" ? b.backup : plain;
  } catch {
    return plain;
  }
}
