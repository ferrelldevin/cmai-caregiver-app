// Caregivers on this phone (R2, plan 5.2, design note 010), on assumed approval behind the
// `caregiverProfiles` switch. Two parts: the Settings page that adds caregivers and sets
// "My residents", and the "Who is logging?" sheet opened from the caregiver chip.
// A caregiver is a code and initials, never a name. Choosing who logs never blocks a log.

import { useEffect, useState } from "react";
import type { Caregiver, Patient } from "../data/db";
import { addCaregiver, myResidents, removeCaregiver, setMyResidents } from "../data/caregivers";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

interface PageProps {
  caregivers: Caregiver[];
  loggingAs: string | null;
  patients: Patient[];
  onLogAs: (id: string | null) => void;
  onChange: () => void;
}

export function CaregiverPage({ caregivers, loggingAs, patients, onLogAs, onChange }: PageProps) {
  const [initials, setInitials] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [mine, setMine] = useState<string[]>([]);
  const me = caregivers.find((c) => c.id === loggingAs);

  useEffect(() => {
    let live = true;
    if (me) myResidents(me.id).then((ids) => live && setMine(ids));
    else setMine([]);
    return () => {
      live = false;
    };
  }, [me]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      const c = await addCaregiver(initials);
      setInitials("");
      setMsg({ text: `Added ${c.initials} as ${c.id}.` });
      // The first caregiver on the phone is the one logging, so nobody has to pick.
      if (!loggingAs) onLogAs(c.id);
      onChange();
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : String(err), error: true });
    }
  }

  async function remove(c: Caregiver) {
    const how = await removeCaregiver(c.id);
    if (c.id === loggingAs) onLogAs(null);
    setMsg({
      text:
        how === "archived"
          ? `${c.initials} (${c.id}) is archived. Their logs keep their code.`
          : `Removed ${c.initials} (${c.id}).`,
    });
    onChange();
  }

  async function toggleMine(id: string) {
    if (!me) return;
    const next = mine.includes(id) ? mine.filter((m) => m !== id) : [...mine, id];
    setMine(next);
    await setMyResidents(me.id, next);
  }

  return (
    <>
      <section className="card" aria-labelledby="cg-h">
        <h2 id="cg-h">{caregivers.length ? "Caregivers on this phone" : "Add the first caregiver"}</h2>
        <p className="muted">Each log records who made it. Any caregiver can log for any resident on this phone.</p>
        <form className="add-patient" onSubmit={add}>
          <label htmlFor="cg-initials" className="field-label">
            Caregiver initials
          </label>
          <p className="muted small-print" id="cg-hint">
            Initials only, not a name. The app gives each caregiver a code such as C-01.
          </p>
          <div className="row">
            <input
              id="cg-initials"
              aria-describedby="cg-hint"
              value={initials}
              onChange={(e) => {
                setInitials(e.target.value);
                setMsg(null);
              }}
              placeholder="e.g. JM"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={3}
            />
            <button type="submit">Add</button>
          </div>
        </form>
        {msg && (
          <p className={msg.error ? "msg error" : "msg"} role={msg.error ? "alert" : "status"}>
            {msg.text}
          </p>
        )}
        {caregivers.length > 0 && (
          <ul className="patient-list">
            {caregivers.map((c) => (
              <li key={c.id} className={c.id === loggingAs ? "current" : ""}>
                <span className="cg-badge" aria-hidden>
                  {c.initials}
                </span>
                <div className="patient-main">
                  <b>{c.initials}</b>
                  <span className="muted">{c.id === loggingAs ? `${c.id} · logging now` : c.id}</span>
                </div>
                <div className="row">
                  {c.id !== loggingAs && (
                    <button className="ghost small" aria-label={`Log as ${c.initials}`} onClick={() => onLogAs(c.id)}>
                      Log as
                    </button>
                  )}
                  <button
                    className="ghost small danger-text"
                    aria-label={`Remove ${c.initials}`}
                    onClick={() => remove(c)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {me && patients.length > 0 && (
        <section className="card" aria-labelledby="mine-h">
          <h2 id="mine-h">My residents, for {me.initials}</h2>
          <p className="muted">
            Tap the residents you look after, in the order you want them. They come first when you switch resident.
            Everyone else stays one tap away.
          </p>
          <div className="choice-grid">
            {patients.map((p) => {
              const n = mine.indexOf(p.id);
              return (
                <button key={p.id} className="choice" aria-pressed={n >= 0} onClick={() => toggleMine(p.id)}>
                  <span>
                    {p.id}
                    {n >= 0 && <span className="muted"> · {n + 1}</span>}
                  </span>
                  {n >= 0 && <Icon name="check" size={18} />}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

interface SheetProps {
  open: boolean;
  viaKeyboard: boolean;
  caregivers: Caregiver[];
  loggingAs: string | null;
  onPick: (id: string) => void;
  onManage: () => void;
  onClose: () => void;
}

/** "Who is logging?": one tap switches. Opened only when a caregiver chooses to switch. */
export function WhoSheet({ open, viaKeyboard, caregivers, loggingAs, onPick, onManage, onClose }: SheetProps) {
  return (
    <Sheet
      open={open}
      viaKeyboard={viaKeyboard}
      keyboardFocus='[aria-current="true"]'
      title="Who is logging?"
      onClose={onClose}
    >
      <ul className="sheet-list">
        {caregivers.map((c) => (
          <li key={c.id}>
            <button className="sheet-row" aria-current={c.id === loggingAs} onClick={() => onPick(c.id)}>
              <span className="cg-badge" aria-hidden>
                {c.initials}
              </span>
              <span className="sheet-text">
                <span className="sheet-code">{c.initials}</span>
                <span className="sheet-meta">{c.id}</span>
              </span>
              {c.id === loggingAs && <Icon name="check" size={22} className="sheet-check" />}
            </button>
          </li>
        ))}
      </ul>
      <button className="ghost sheet-manage" onClick={onManage}>
        <Icon name="user" size={18} /> Manage caregivers
      </button>
    </Sheet>
  );
}
