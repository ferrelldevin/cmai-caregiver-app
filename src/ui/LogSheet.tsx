// Log details: the one place a log's time and context are changed, reached from the
// confirmation's Edit and from Recent logs. Changes save as they are made, so Done only
// closes and closing the sheet any way (Esc, backdrop) loses nothing. Grouped form rows,
// then one action row at the bottom: Delete on the left, Done on the right (Devin, 2026-10-24). Design note: docs/design/notes/003-log-confirmation.md.
// Delete is two steps: pick a reason, then confirm. The log is kept, marked deleted with the
// reason (D-14, design note 007).
// "Change" beside the behavior (F-64, design note 025) corrects a wrong pick on the same log: pick
// the right one, confirm. It saves at once with the reason "Wrong behavior"; nothing is deleted.

import { useEffect, useRef, useState } from "react";
import type { StoredObservation } from "../data/db";
import { CHANGE_REASONS, DELETE_REASONS, logVersions, REASON_LABEL, type LogVersion } from "../data/logs";
import { addDays } from "../scoring/engine";
import { GROUP_LABELS, ITEMS, type FactorGroup } from "../scoring/items";
import { SHORT_NAMES } from "./behavior-names";
import { dayAndTime } from "./format";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { study } from "../study/settings";

const BEFORE_BASE = [
  "Personal care or bathing",
  "Mealtime",
  "Noise or crowding",
  "Seemed in pain",
  "Change in routine",
  "Visitor or phone call",
];
// F-41, on assumed approval: three causes the sensor literature names and the list lacked
// (temperature, Tartarini 2017; sleep, Tanev 2017; illness, Capstick 2024). "Seemed unwell" is a
// caregiver's impression, not a finding. Restore accepts all of them in either build.
const BEFORE_EXTRA = ["Too hot or too cold", "Slept badly last night", "Seemed unwell"];
export const BEFORE_OPTIONS = [
  ...BEFORE_BASE,
  ...(study.extraBeforeChips ? BEFORE_EXTRA : []),
  "Nothing noticed",
  "Other",
];
const GROUP_ORDER: FactorGroup[] = ["aggressive", "physical", "verbal", "other"]; // as on the Log screen
const EARLIER = [0, 5, 15, 30, 60]; // minutes before the log was made

const hhmm = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** A clock time typed for the end of a stretch (F-39): the same calendar day as its start. An end before the start is refused when saved. */
export function endFromClock(value: string, at: number) {
  const [h, m] = value.split(":").map(Number);
  const d = new Date(at);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** A clock time typed for a log: the same day it was logged, or the day before if that time came after the log. */
export function fromClock(value: string, loggedAt: number) {
  const [h, m] = value.split(":").map(Number);
  const d = new Date(loggedAt);
  d.setHours(h, m, 0, 0);
  // The calendar day before, not 24 hours before, so the time stays right on the day clocks change.
  return d.getTime() > loggedAt ? addDays(d.getTime(), -1) : d.getTime();
}

interface Props {
  obs: (StoredObservation & { id: number }) | null;
  viaKeyboard: boolean;
  /** Why the last change was not saved, if it was refused. */
  error?: string | null;
  /** With `changeReasons` on, one call per Save change, with the reason's code; otherwise one call per tap, as always. */
  onPatch: (change: Partial<StoredObservation>, reason?: string) => void | Promise<boolean>;
  onDelete: (reason: string, note?: string) => void;
  /** Corrects which behavior the log is for (F-64). Resolves false when it was not saved. */
  onCorrect?: (itemId: number) => Promise<boolean>;
  onClose: () => void;
}

const REASON_LABELS = CHANGE_REASONS.map((c) => REASON_LABEL[c]);

/** What changed between two versions of a log, in words, for the history view. */
function describe(v: LogVersion, prev?: LogVersion) {
  if (v.action === "created") return "Logged";
  if (v.action === "delete") return "Deleted";
  if (v.action === "restore") return "Restored";
  const a = prev?.values;
  const bits: string[] = [];
  if (a && a.itemId !== v.values.itemId)
    bits.push(`behavior ${SHORT_NAMES[a.itemId]} to ${SHORT_NAMES[v.values.itemId]}`);
  if (a && a.at !== v.values.at) bits.push(`time ${hhmm(a.at)} to ${hhmm(v.values.at)}`);
  if (a && a.approx !== v.values.approx) bits.push(v.values.approx ? "marked approximate" : "no longer approximate");
  if (a && a.before !== v.values.before) bits.push(v.values.before ? `before: ${v.values.before}` : "before cleared");
  if (a && a.endedAt !== v.values.endedAt)
    bits.push(v.values.endedAt === undefined ? "end cleared" : `stopped ${hhmm(v.values.endedAt)}`);
  return `Changed: ${bits.join(", ") || "details"}`;
}

export function LogSheet({ obs: saved, viaKeyboard, error, onPatch, onDelete, onCorrect, onClose }: Props) {
  // G11 (`changeReasons`): changes are held until Save change, which asks why. Otherwise they save as made.
  const staged = study.changeReasons;
  const [draft, setDraft] = useState<Partial<StoredObservation>>({});
  const [changing, setChanging] = useState(false); // the reason step for a saved change
  const [why, setWhy] = useState<string | null>(null);
  const [saves, setSaves] = useState(0); // counts saved changes, so the history list reloads
  const [versions, setVersions] = useState<LogVersion[]>([]);
  const obs = saved && staged ? { ...saved, ...draft } : saved;
  const dirty = !!saved && Object.entries(draft).some(([k, v]) => saved[k as keyof StoredObservation] !== v);
  const patch = (change: Partial<StoredObservation>) =>
    staged ? setDraft((d) => ({ ...d, ...change })) : onPatch(change);
  useEffect(() => {
    setDraft({});
    setChanging(false);
    setWhy(null);
  }, [saved?.id]);
  useEffect(() => {
    if (!staged || !saved) return setVersions([]);
    let live = true;
    logVersions(saved.id).then((v) => live && setVersions(v));
    return () => {
      live = false;
    };
  }, [staged, saved?.id, saves]);
  const item = obs ? ITEMS[obs.itemId - 1] : null;
  const minutesBefore = obs ? Math.round((obs.loggedAt - obs.at) / 60_000) : 0;
  const noteWanted = useRef(false); // set by tapping Other, so reopening a log does not jump to the note
  const [deleting, setDeleting] = useState(false); // the reason-and-confirm step
  const [reason, setReason] = useState<string | null>(null);
  const [reasonNote, setReasonNote] = useState("");
  const [picking, setPicking] = useState(false); // the pick-the-right-behavior step (F-64)
  const [pick, setPick] = useState<number | null>(null);
  const reasons = useRef<HTMLDivElement>(null);
  const deleteByKey = useRef(false);
  // Another log, or the sheet closing, always starts back at the details.
  useEffect(() => {
    setDeleting(false);
    setReason(null);
    setReasonNote("");
    setPicking(false);
    setPick(null);
  }, [obs?.id]);
  // The button pressed is gone once the step changes, so focus moves into the new step: the
  // first reason from the keyboard, else the dialog itself (no stray focus ring on a tap, F-14).
  const sheetRoot = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const step = deleting || picking;
    if (step) sheetRoot.current = reasons.current?.closest("dialog") ?? null;
    const target =
      step && deleteByKey.current ? reasons.current?.querySelector<HTMLElement>(".choice") : sheetRoot.current;
    target?.focus({ preventScroll: true });
  }, [deleting, picking]);
  const canDelete = reason !== null && (staged || reason !== "Other" || reasonNote.trim() !== "");
  async function saveChange() {
    const code = CHANGE_REASONS[REASON_LABELS.indexOf(why ?? "")];
    if (!code) return;
    const ok = await onPatch(draft, code);
    if (ok !== false) setDraft({});
    setSaves((n) => n + 1);
    setChanging(false);
    setWhy(null);
  }
  async function saveBehavior() {
    if (pick === null || !onCorrect) return;
    if (await onCorrect(pick)) {
      // An end time held in the draft goes with the old behavior if the new one has none (F-39).
      if (!ITEMS[pick - 1].continuous) setDraft(({ endedAt: _gone, ...rest }) => rest);
      setSaves((n) => n + 1);
    }
    setPicking(false);
    setPick(null);
  }

  return (
    <Sheet
      open={!!obs}
      viaKeyboard={viaKeyboard}
      keyboardFocus=".log-sheet input[type='time']"
      className="log-sheet"
      title={
        deleting
          ? "Delete this log?"
          : picking
            ? "Which behavior was it?"
            : changing
              ? "Why change it?"
              : (item?.name ?? "")
      }
      subtitle={
        obs && (
          <>
            {deleting || picking ? `${item?.name} · ` : ""}
            {obs.patientId} · logged {dayAndTime(obs.loggedAt)}
          </>
        )
      }
      headerClose={false}
      footer={
        obs &&
        (changing ? (
          <>
            <button className="ghost" onClick={() => setChanging(false)}>
              Back
            </button>
            <button disabled={!why} onClick={saveChange}>
              Save change
            </button>
          </>
        ) : picking ? (
          <>
            <button className="ghost" onClick={() => setPicking(false)}>
              Back
            </button>
            <button disabled={pick === null} onClick={saveBehavior}>
              Change behavior
            </button>
          </>
        ) : deleting ? (
          <>
            <button className="ghost" onClick={() => setDeleting(false)}>
              Keep log
            </button>
            <button
              className="danger"
              disabled={!canDelete}
              onClick={() => reason && onDelete(reason, reason === "Other" ? reasonNote : undefined)}
            >
              Delete log
            </button>
          </>
        ) : (
          <>
            <button
              className="text-danger"
              onClick={(e) => {
                deleteByKey.current = e.detail === 0;
                setDeleting(true);
              }}
            >
              <Icon name="trash" size={18} /> Delete log
            </button>
            {dirty ? (
              <button className="sheet-done" onClick={() => setChanging(true)}>
                Save change
              </button>
            ) : (
              <button className="sheet-done" onClick={onClose}>
                Done
              </button>
            )}
          </>
        ))
      }
      onClose={onClose}
    >
      {obs && error && (
        <p className="msg error" role="alert">
          {error}
        </p>
      )}
      {obs && deleting && (
        <div className="sheet-scroll">
          <section className="form-group" aria-labelledby="ls-why">
            <h3 className="form-label" id="ls-why">
              Why are you deleting it?
            </h3>
            <div className="choice-grid" ref={reasons}>
              {(staged ? REASON_LABELS : DELETE_REASONS).map((r) => (
                <button
                  key={r}
                  className="choice"
                  aria-pressed={reason === r}
                  onClick={() => {
                    noteWanted.current = r === "Other";
                    setReason(r);
                  }}
                >
                  <span>{r}</span>
                  {reason === r && <Icon name="check" size={18} />}
                </button>
              ))}
            </div>
            {reason === "Other" && !staged && (
              <label className="other-note">
                <span>What was wrong with it?</span>
                <input
                  type="text"
                  ref={(el) => {
                    if (el && noteWanted.current) {
                      noteWanted.current = false;
                      el.focus({ preventScroll: true });
                      el.scrollIntoView({ block: "nearest" });
                    }
                  }}
                  value={reasonNote}
                  maxLength={120}
                  placeholder="A few words, no names"
                  autoComplete="off"
                  enterKeyHint="done"
                  onChange={(e) => setReasonNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
              </label>
            )}
          </section>
          <p className="muted">
            The log stops counting toward scores. It is kept with your reason, so the research team can see every
            change.
          </p>
        </div>
      )}
      {obs && changing && (
        <div className="sheet-scroll">
          <section className="form-group" aria-labelledby="ls-change-why">
            <h3 className="form-label" id="ls-change-why">
              Why are you changing it?
            </h3>
            <div className="choice-grid">
              {REASON_LABELS.map((r) => (
                <button key={r} className="choice" aria-pressed={why === r} onClick={() => setWhy(r)}>
                  <span>{r}</span>
                  {why === r && <Icon name="check" size={18} />}
                </button>
              ))}
            </div>
          </section>
          <p className="muted">The old version is kept. The research team can see every change and why.</p>
        </div>
      )}
      {obs && picking && (
        <div className="sheet-scroll" ref={reasons}>
          {GROUP_ORDER.map((g) => (
            <section className="form-group" key={g} aria-labelledby={`ls-pick-${g}`}>
              <h3 className="form-label" id={`ls-pick-${g}`}>
                {GROUP_LABELS[g]}
              </h3>
              <div className="choice-grid">
                {ITEMS.filter((i) => i.group === g && i.id !== obs.itemId).map((i) => (
                  <button key={i.id} className="choice" aria-pressed={pick === i.id} onClick={() => setPick(i.id)}>
                    <span>{i.name}</span>
                    {pick === i.id && <Icon name="check" size={18} />}
                  </button>
                ))}
              </div>
            </section>
          ))}
          <p className="muted">
            Same log, same time, counted once. Your first pick is kept in its history, marked Wrong behavior.
          </p>
        </div>
      )}
      {obs && !deleting && !changing && !picking && (
        <div className="sheet-scroll">
          {study.correctBehavior && onCorrect && item && (
            <section className="form-group" aria-labelledby="ls-what">
              <h3 className="form-label" id="ls-what">
                Behavior
              </h3>
              <div className="form-card">
                <div className="form-row">
                  <span>{item.name}</span>
                  <button
                    className="ghost small"
                    aria-label="Change behavior"
                    onClick={(e) => {
                      deleteByKey.current = e.detail === 0;
                      setPicking(true);
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>
            </section>
          )}
          <section className="form-group" aria-labelledby="ls-when">
            <h3 className="form-label" id="ls-when">
              When it happened
            </h3>
            <div className="form-card">
              <label className="form-row">
                <span>Time</span>
                {/* A tinted pill with a clock, so it reads as tappable; iOS shows a bare time otherwise (F-16). */}
                <span className="time-pill">
                  <Icon name="clock" size={18} />
                  <input
                    type="time"
                    value={hhmm(obs.at)}
                    onChange={(e) => e.target.value && patch({ at: fromClock(e.target.value, obs.loggedAt) })}
                  />
                </span>
              </label>
              <div className="form-row stacked">
                <span id="ls-earlier" className="form-hint">
                  How long before you logged it
                </span>
                <div className="quick-times" role="group" aria-labelledby="ls-earlier">
                  {EARLIER.map((m) => (
                    <button
                      key={m}
                      className={minutesBefore === m ? "on" : undefined}
                      aria-pressed={minutesBefore === m}
                      aria-label={
                        m === 0 ? "At log, when I logged it" : `${m === 60 ? "1 hr" : `${m} min`} before logging`
                      }
                      onClick={() => patch({ at: obs.loggedAt - m * 60_000 })}
                    >
                      {m === 0 ? "At log" : m === 60 ? "1 hr" : `${m} min`}
                    </button>
                  ))}
                </div>
              </div>
              <label className="form-row">
                <span>Time is approximate</span>
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={!!obs.approx}
                  onChange={(e) => patch({ approx: e.target.checked })}
                />
              </label>
              {/* F-39, on assumed approval: when a stretch of pacing, mannerisms or restlessness stopped. Optional, never scored. */}
              {study.stoppedTap && item?.continuous && (
                <div className="form-row ended">
                  <label htmlFor="ls-ended" className="ended-label">
                    It stopped
                    <span className="form-hint">Optional</span>
                  </label>
                  <span className="row ended-row">
                    {obs.endedAt !== undefined && (
                      <button
                        className="ghost small"
                        aria-label="Clear when it stopped"
                        onClick={() => patch({ endedAt: undefined })}
                      >
                        Clear
                      </button>
                    )}
                    <span className="time-pill">
                      <Icon name="clock" size={18} />
                      <input
                        id="ls-ended"
                        type="time"
                        value={obs.endedAt !== undefined ? hhmm(obs.endedAt) : ""}
                        onChange={(e) =>
                          patch({ endedAt: e.target.value ? endFromClock(e.target.value, obs.at) : undefined })
                        }
                      />
                    </span>
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="form-group" aria-labelledby="ls-before">
            <h3 className="form-label" id="ls-before">
              What happened just before <span className="muted">Optional</span>
            </h3>
            <div className="choice-grid">
              {BEFORE_OPTIONS.map((o) => (
                <button
                  key={o}
                  className="choice"
                  aria-pressed={obs.before === o}
                  onClick={() => {
                    noteWanted.current = o === "Other" && obs.before !== o;
                    patch({ before: obs.before === o ? undefined : o, beforeNote: undefined });
                  }}
                >
                  <span>{o}</span>
                  {obs.before === o && <Icon name="check" size={18} />}
                </button>
              ))}
            </div>
            {obs.before === "Other" && (
              <label className="other-note">
                <span>What happened?</span>
                <input
                  type="text"
                  ref={(el) => {
                    // Right after Other is tapped: bring the field above the action row and open the keyboard.
                    if (el && noteWanted.current) {
                      noteWanted.current = false;
                      el.focus({ preventScroll: true });
                      el.scrollIntoView({ block: "nearest" });
                    }
                  }}
                  value={obs.beforeNote ?? ""}
                  maxLength={120}
                  placeholder="A few words, no names"
                  autoComplete="off"
                  enterKeyHint="done"
                  onChange={(e) => patch({ beforeNote: e.target.value || undefined })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
              </label>
            )}
          </section>
          {staged && dirty && <p className="muted">Your changes are kept when you press Save change.</p>}
          {/* G11: every version of this log, who made it, when and why. Reads only. */}
          {staged && versions.length > 1 && (
            <details className="log-history">
              <summary>Change history ({versions.length - 1})</summary>
              <ol>
                {versions.map((v, i) => (
                  <li key={v.rev}>
                    <b>
                      v{v.rev} · {dayAndTime(v.at)}
                    </b>
                    <span>
                      {describe(v, versions[i - 1])}
                      {v.reason ? ` · ${REASON_LABEL[v.reason as keyof typeof REASON_LABEL] ?? v.reason}` : ""}
                      {v.by ? ` · ${v.by}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </Sheet>
  );
}
