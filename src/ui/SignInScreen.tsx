// Sign-in with an on-phone PIN (R1 option A, F-46, plan 5.3, design note 011), on assumed
// approval behind the `pin` switch. Asked once per shift: when the app opens with nobody signed
// in, when a caregiver switches, and after 12 hours. Never between opening the app and a tile.
// The PIN says who is logging. It does not protect the data; the phone's passcode does.

import { useEffect, useRef, useState } from "react";
import { db, type Caregiver } from "../data/db";
import {
  checkPin,
  checkSetupPin,
  hasSetupPin,
  hasPin,
  isLocked,
  pinProblem,
  PIN_LENGTH,
  resetPin,
  SETUP_PIN_LENGTH,
  setSetupPin,
  type PinResult,
} from "../data/pin";
import { Icon } from "./Icon";

type Step =
  | { kind: "choose" }
  | { kind: "enter"; c: Caregiver }
  | { kind: "new"; c: Caregiver; first?: string; setupPin?: string }
  | { kind: "setup"; c: Caregiver; first?: boolean };

interface Props {
  caregivers: Caregiver[];
  /** Start on this caregiver's keypad; null starts on the list. */
  start: string | null;
  /** Shown when someone is already signed in: going back keeps them signed in. */
  onCancel?: () => void;
  onSignedIn: (id: string) => void;
}

const seconds = (ms: number) => Math.max(1, Math.ceil(ms / 1000));

/** Words for a refused PIN. Never color alone (acceptance criterion 3). */
function refusal(r: Exclude<PinResult, { ok: true }>, now: number): string {
  switch (r.reason) {
    case "wrong":
      return `Wrong PIN. ${r.triesBeforeWait} ${r.triesBeforeWait === 1 ? "try" : "tries"} left before a wait.`;
    case "wait":
      return `Wrong PIN. Too many tries: wait ${seconds(r.until - now)} seconds.`;
    case "locked":
      return "Locked after 10 wrong PINs. Whoever set up this phone can unlock it with the setup PIN.";
    case "no-pin":
      return "No PIN is set yet.";
  }
}

export function SignInScreen({ caregivers, start, onCancel, onSignedIn }: Props) {
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [error, setError] = useState("");
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  // No setup PIN on this phone (for example after clear and restore): it is chosen first, before
  // anyone can be given a PIN.
  const [noSetup, setNoSetup] = useState(false);
  useEffect(() => {
    let live = true;
    hasSetupPin().then((has) => live && setNoSetup(!has));
    return () => {
      live = false;
    };
  }, []);

  async function open(id: string) {
    const c = await db.caregivers.get(id);
    setError("");
    setWaitUntil(0);
    if (!c) return setStep({ kind: "choose" });
    // A first PIN is chosen with the setup PIN, so nobody can claim a caregiver who has not signed in
    // yet, such as one restored from a backup (security review of #70).
    setStep(hasPin(c) ? { kind: "enter", c } : { kind: "setup", c, first: true });
    if (isLocked(c)) setError(refusal({ ok: false, reason: "locked" }, Date.now()));
  }

  useEffect(() => {
    if (start) void open(start);
  }, [start]);

  useEffect(() => headRef.current?.focus(), [step]);

  // A running wait counts down in words, then the keypad comes back.
  useEffect(() => {
    if (!waitUntil) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= waitUntil) {
        setWaitUntil(0);
        setError("");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [waitUntil]);

  function refused(r: Exclude<PinResult, { ok: true }>) {
    const n = Date.now();
    setNow(n);
    setError(refusal(r, n));
    if (r.reason === "wait") setWaitUntil(r.until);
    if (r.reason === "locked" && step.kind === "enter") setStep({ kind: "enter", c: { ...step.c, lockedAt: n } });
  }

  async function submit(pin: string) {
    setBusy(true);
    try {
      if (step.kind === "enter") {
        const r = await checkPin(step.c.id, pin);
        if (r.ok) return onSignedIn(step.c.id);
        refused(r);
      } else if (step.kind === "setup") {
        const r = await checkSetupPin(pin);
        if (r.ok) {
          setError("");
          setStep({ kind: "new", c: step.c, setupPin: pin });
        } else refused(r);
      } else if (step.kind === "new") {
        if (!step.first) {
          const problem = pinProblem(pin);
          if (problem) return setError(problem);
          setError("");
          return setStep({ ...step, first: pin });
        }
        if (pin !== step.first) {
          setError("The two PINs were different. Choose a PIN again.");
          return setStep({ kind: "new", c: step.c, setupPin: step.setupPin });
        }
        // Every new PIN, first or forgotten, goes through the setup PIN.
        if (!step.setupPin) return setStep({ kind: "setup", c: step.c, first: !hasPin(step.c) });
        const r = await resetPin(step.c.id, step.setupPin, pin);
        if (!r.ok) return refused(r);
        onSignedIn(step.c.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const back = () => {
    setError("");
    setWaitUntil(0);
    if (step.kind !== "choose" && !start) return setStep({ kind: "choose" });
    onCancel?.();
  };
  const showBack = step.kind !== "choose" ? !!onCancel || !start : !!onCancel;
  const waiting = waitUntil > now;
  const locked = step.kind === "enter" && isLocked(step.c);

  let title = "Who is logging?";
  let hint = "Tap your initials, then enter your PIN. You stay signed in for 12 hours.";
  if (step.kind === "enter") {
    title = `PIN for ${step.c.initials}`;
    hint = `${step.c.id}. Enter your ${PIN_LENGTH}-digit PIN.`;
  } else if (step.kind === "setup") {
    title = "Setup PIN";
    hint = step.first
      ? `${step.c.initials} has no PIN yet. Whoever set up this phone enters the ${SETUP_PIN_LENGTH}-digit setup PIN, then ${step.c.initials} chooses one.`
      : `Whoever set up this phone enters the ${SETUP_PIN_LENGTH}-digit setup PIN to give ${step.c.initials} a new PIN.`;
  } else if (step.kind === "new") {
    title = step.first ? "Enter it again" : `Choose a PIN for ${step.c.initials}`;
    hint = step.first
      ? "The same 4 digits, to check."
      : `${PIN_LENGTH} digits, not 1111 or 1234. It says who is logging; it is not a password for the data.`;
  }

  return (
    <div className="signin">
      <div className="signin-inner">
        <div className="signin-top">
          {showBack ? (
            <button className="ghost small" onClick={back}>
              {step.kind === "choose" || start ? "Cancel" : "Back"}
            </button>
          ) : (
            <span />
          )}
          <span className="brand">
            <img src="icon.svg" alt="" width="24" height="24" />
            <b>CMAI Tracker</b>
          </span>
        </div>
        <h1 ref={headRef} tabIndex={-1}>
          {title}
        </h1>
        <p className="muted">{hint}</p>

        {step.kind === "choose" && noSetup ? (
          <SetupPinCard onDone={() => setNoSetup(false)} />
        ) : step.kind === "choose" ? (
          <ul className="sheet-list signin-list">
            {caregivers.map((c) => (
              <li key={c.id}>
                <button className="sheet-row" onClick={() => open(c.id)}>
                  <span className="cg-badge" aria-hidden>
                    {c.initials}
                  </span>
                  <span className="sheet-text">
                    <span className="sheet-code">{c.initials}</span>
                    <span className="sheet-meta">{c.id}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <>
            {error && (
              <p className="msg error" role="alert">
                <Icon name="alert" size={18} /> {error}
              </p>
            )}
            {/* The count is shown, not announced each second: the alert above already said how long. */}
            {waiting && (
              <p className="muted pin-busy" aria-hidden>
                Keypad back in {seconds(waitUntil - now)} s
              </p>
            )}
            {!locked && (
              <PinPad
                key={`${step.kind}-${"first" in step && step.first ? 2 : 1}`}
                length={step.kind === "setup" ? SETUP_PIN_LENGTH : PIN_LENGTH}
                label={title}
                disabled={busy || waiting}
                busy={busy}
                onComplete={submit}
              />
            )}
            {step.kind === "enter" && (
              <button
                className="ghost signin-forgot"
                onClick={() => {
                  setError("");
                  setWaitUntil(0);
                  setStep({ kind: "setup", c: step.c });
                }}
              >
                <Icon name="lock" size={18} /> {locked ? "Unlock with the setup PIN" : "Forgot PIN?"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface PadProps {
  length: number;
  label: string;
  disabled: boolean;
  busy: boolean;
  onComplete: (pin: string) => void;
}

/** The mockup's keypad: keys of 64 px or more, dots announced as "2 of 4 digits entered". */
export function PinPad({ length, label, disabled, busy, onComplete }: PadProps) {
  const [digits, setDigits] = useState("");

  function press(d: string) {
    if (disabled) return;
    const next = (digits + d).slice(0, length);
    setDigits(next);
    if (next.length === length) {
      setDigits("");
      onComplete(next);
    }
  }
  const del = () => !disabled && setDigits((s) => s.slice(0, -1));

  // A hardware keyboard types digits too.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") del();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="pinpad" role="group" aria-label={label}>
      <div className="pin-dots" aria-hidden>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={i < digits.length ? "on" : ""} />
        ))}
      </div>
      <p className="sr" aria-live="polite">
        {busy ? "Checking" : `${digits.length} of ${length} digits entered`}
      </p>
      {busy && <p className="muted pin-busy">Checking…</p>}
      <div className="keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} className="key" disabled={disabled} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <span />
        <button className="key" disabled={disabled} onClick={() => press("0")}>
          0
        </button>
        <button className="key key-del" disabled={disabled || !digits} aria-label="Delete last digit" onClick={del}>
          ⌫
        </button>
      </div>
    </div>
  );
}

/** Shown on the Caregivers page until the phone has a setup PIN: it comes before the first caregiver. */
export function SetupPinCard({ onDone }: { onDone: () => void }) {
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function complete(pin: string) {
    if (first === null) {
      const problem = pinProblem(pin, SETUP_PIN_LENGTH);
      if (problem) return setError(problem.replace("1111 or 1234", "111111 or 123456"));
      setError("");
      return setFirst(pin);
    }
    if (pin !== first) {
      setFirst(null);
      return setError("The two setup PINs were different. Choose one again.");
    }
    setBusy(true);
    try {
      await setSetupPin(pin);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const label = first === null ? "Choose a setup PIN" : "Enter the setup PIN again";
  return (
    <section className="card" aria-labelledby="setup-h">
      <h2 id="setup-h">{label}</h2>
      <p className="muted">
        {SETUP_PIN_LENGTH} digits, kept by whoever sets up this phone. It gives a caregiver a new PIN when they forget
        theirs or are locked out. It does not open any data.
      </p>
      {error && (
        <p className="msg error" role="alert">
          <Icon name="alert" size={18} /> {error}
        </p>
      )}
      <PinPad
        key={first === null ? 1 : 2}
        length={SETUP_PIN_LENGTH}
        label={label}
        disabled={busy}
        busy={busy}
        onComplete={complete}
      />
    </section>
  );
}
