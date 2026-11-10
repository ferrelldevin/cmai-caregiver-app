// Screen 1: one tap logs a behavior. Behaviors are tiles, 3 across, one group at a time
// (round 3 mockup, design note 008 phase 2, F-26). Each tile has an icon to find it by, a
// short name and today's count. What counts, what does not and the manual page (p.12-13)
// used to sit on every button; they are now in one sheet, opened from the button under the
// grid or by holding a tile, so a whole group fits on one screen (F-37). A short
// confirmation offers Edit and Undo for 8 seconds; the timer stops while the caregiver is
// using it (WCAG 2.2.1). Edit opens the log details sheet (design note 003). Earlier logs
// are fixed on the Today tab, which "N logged today" opens (F-27). Every edit, delete and
// undo goes through data/logs.ts so it lands in the change history (design note 007).

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { GROUP_LABELS, ITEMS, type CmaiItem, type FactorGroup } from "../scoring/items";
import { mostLogged } from "./mostLogged";
import { db, localMidnight, type StoredObservation } from "../data/db";
import { deleteLog, editLog, restoreLog, UNDO_REASON } from "../data/logs";
import { BEHAVIOR_ICONS } from "./behavior-icons";
import { SHORT_NAMES } from "./behavior-names";
import { timeOfDay } from "./format";
import { Icon } from "./Icon";
import { LogSheet } from "./LogSheet";
import { DefinitionsSheet } from "./DefinitionsSheet";

const GROUP_ORDER: FactorGroup[] = ["aggressive", "physical", "verbal", "other"];
const tabLabel = (g: FactorGroup) => GROUP_LABELS[g].split(/[ ,]/)[0];
const TOAST_MS = 8000;

type SavedObs = StoredObservation & { id: number };
type Toast = { kind: "logged" | "deleted"; obs: SavedObs };

interface Props {
  patientId: string;
  observations: StoredObservation[];
  onChange: () => void;
  /** Opens the Today tab, where today's logs are listed and fixed. */
  onToday: () => void;
}

export function LogScreen({ patientId, observations, onChange, onToday }: Props) {
  const [defs, setDefs] = useState<{ itemId: number | null; viaKeyboard: boolean } | null>(null);
  const [group, setGroup] = useState<FactorGroup>("aggressive");
  const [toast, setToast] = useState<Toast | null>(null);
  const [held, setHeld] = useState(false); // pointer or focus inside the confirmation
  const [editing, setEditing] = useState<{ obs: SavedObs; viaKeyboard: boolean } | null>(null);
  const lastTap = useRef<{ itemId: number; t: number } | null>(null);
  const [flash, setFlash] = useState<number | null>(null); // the row just logged, highlighted briefly

  const now = Date.now();
  const todayStart = localMidnight(now);
  const todayCounts = new Map<number, number>();
  for (const o of observations) if (o.at >= todayStart) todayCounts.set(o.itemId, (todayCounts.get(o.itemId) ?? 0) + 1);
  const loggedToday = [...todayCounts.values()].reduce((a, b) => a + b, 0);
  const frequent = mostLogged(observations, now);

  // The confirmation closes on its own only while nobody is using it.
  useEffect(() => {
    if (!toast || held) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast, held]);

  // Switching resident closes anything that belonged to the last one.
  useEffect(() => {
    setToast(null);
    setEditing(null);
    setDefs(null);
  }, [patientId]);

  async function log(itemId: number) {
    const t = Date.now();
    // A double tap on the same card within 0.6 s is almost always one event.
    if (lastTap.current && lastTap.current.itemId === itemId && t - lastTap.current.t < 600) return;
    lastTap.current = { itemId, t };
    const obs = { patientId, itemId, at: t, loggedAt: t };
    const id = await db.observations.add(obs);
    navigator.vibrate?.(15);
    setFlash(itemId);
    window.setTimeout(() => setFlash((f) => (f === itemId ? null : f)), 900);
    setToast({ kind: "logged", obs: { ...obs, id } });
    onChange();
  }

  async function undo() {
    if (!toast) return;
    // Undo of a log just made is a delete like any other, with its own reason.
    if (toast.kind === "logged") await deleteLog(toast.obs, UNDO_REASON);
    else await restoreLog(toast.obs);
    setToast(null);
    setHeld(false);
    onChange();
  }

  function edit(o: SavedObs, e: MouseEvent) {
    setToast(null);
    setHeld(false);
    setEditing({ obs: o, viaKeyboard: e.detail === 0 });
  }

  async function patch(change: Partial<StoredObservation>) {
    if (!editing) return;
    // Show the change at once; the save follows.
    setEditing({ ...editing, obs: { ...editing.obs, ...change } });
    await editLog(editing.obs, change);
    onChange();
  }

  async function remove(o: SavedObs, reason: string, note?: string) {
    await deleteLog(o, reason, note);
    setEditing(null);
    setToast({ kind: "deleted", obs: o });
    onChange();
  }

  // Arrow keys move between group tabs, Home and End jump to the ends (WAI-ARIA tabs pattern).
  function tabKeys(e: KeyboardEvent<HTMLButtonElement>) {
    const i = GROUP_ORDER.indexOf(group);
    const next =
      e.key === "ArrowRight"
        ? (i + 1) % GROUP_ORDER.length
        : e.key === "ArrowLeft"
          ? (i + GROUP_ORDER.length - 1) % GROUP_ORDER.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? GROUP_ORDER.length - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    setGroup(GROUP_ORDER[next]);
    document.getElementById(`tab-${GROUP_ORDER[next]}`)?.focus();
  }

  // Holding a tile opens what counts for it, as a shortcut (the button under the grid is
  // the way anyone can find). A hold does not log; moving the finger to scroll cancels it.
  const hold = useRef<{ timer: number; fired: boolean } | null>(null);
  const HOLD_MS = 500;
  function holdStart(itemId: number) {
    holdEnd();
    hold.current = {
      fired: false,
      timer: window.setTimeout(() => {
        if (hold.current) hold.current.fired = true;
        setDefs({ itemId, viaKeyboard: false });
      }, HOLD_MS),
    };
  }
  function holdEnd() {
    if (hold.current) window.clearTimeout(hold.current.timer);
  }

  function tile(item: CmaiItem, where: "frequent" | "group") {
    const BehaviorIcon = BEHAVIOR_ICONS[item.id];
    const n = todayCounts.get(item.id);
    return (
      <li key={`${where}-${item.id}`} className={flash === item.id ? "tile just-logged" : "tile"}>
        <button
          className="tile-btn"
          onPointerDown={() => holdStart(item.id)}
          onPointerUp={holdEnd}
          onPointerLeave={holdEnd}
          onPointerCancel={holdEnd}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (hold.current?.fired) {
              hold.current = null;
              return;
            }
            void log(item.id);
          }}
        >
          <BehaviorIcon className="tile-icon" size={26} aria-hidden />
          <span className="tile-name">{SHORT_NAMES[item.id]}</span>
          {n ? (
            <span className="tile-count">
              {n}
              <span className="sr"> today</span>
            </span>
          ) : null}
        </button>
      </li>
    );
  }

  return (
    <div className="log">
      <div className="log-head">
        <p className="screen-title" aria-hidden>
          Log a behavior
        </p>
        {/* the screen heading is the h1 in App */}
        <button className="today-count" onClick={onToday}>
          {loggedToday ? (
            <>
              <b>{loggedToday}</b> logged today
            </>
          ) : (
            "Nothing logged yet today"
          )}
          <Icon name="chevron" size={16} className="today-count-chev" />
        </button>
      </div>
      <p className="hint">
        Tap a behavior the moment you see it. One tap is one event. For pacing, restlessness and mannerisms, one tap is
        one stretch of it.
      </p>
      {frequent.length > 0 && (
        <section className="log-frequent" aria-labelledby="frequent-h">
          <h2 className="group-title" id="frequent-h">
            Most logged for this resident
          </h2>
          <ul className="tile-grid">{frequent.map((id) => tile(ITEMS[id - 1], "frequent"))}</ul>
        </section>
      )}
      <div className="group-tabs" role="tablist" aria-label="Behavior groups">
        {GROUP_ORDER.map((g) => (
          <button
            key={g}
            id={`tab-${g}`}
            role="tab"
            aria-selected={g === group}
            aria-controls="group-panel"
            tabIndex={g === group ? 0 : -1}
            onClick={() => setGroup(g)}
            onKeyDown={tabKeys}
          >
            {tabLabel(g)}
          </button>
        ))}
      </div>
      <section id="group-panel" className="group" role="tabpanel" aria-labelledby={`tab-${group}`}>
        <h2 className="group-title">{GROUP_LABELS[group]}</h2>
        <ul className="tile-grid">{ITEMS.filter((i) => i.group === group).map((item) => tile(item, "group"))}</ul>
      </section>
      <button className="ghost defs-btn" onClick={(e) => setDefs({ itemId: null, viaKeyboard: e.detail === 0 })}>
        <Icon name="info" size={20} /> What counts as each behavior?
      </button>
      <p className="hint defs-hint">Or hold a tile to read about that one.</p>

      {toast && (
        <div
          className="snackbar"
          role="status"
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setHeld(false);
          }}
        >
          <Icon name={toast.kind === "logged" ? "checkCircle" : "trash"} size={22} className="snackbar-icon" />
          <span className="snackbar-text">
            <b className="snackbar-title">
              <span className="sr">{toast.kind === "logged" ? "Logged: " : "Deleted: "}</span>
              {SHORT_NAMES[toast.obs.itemId]}
            </b>
            <span className="snackbar-meta">
              {toast.kind === "deleted" && "Deleted · "}
              {toast.obs.patientId} · {timeOfDay(toast.obs.at)}
              {toast.obs.approx ? " (about)" : ""}
            </span>
          </span>
          <span className="snackbar-actions">
            {toast.kind === "logged" && (
              <button className="snackbar-btn" onClick={(e) => edit(toast.obs, e)}>
                Edit
              </button>
            )}
            <button className="snackbar-btn" onClick={undo}>
              Undo
            </button>
          </span>
        </div>
      )}

      <DefinitionsSheet open={defs} onClose={() => setDefs(null)} />

      <LogSheet
        obs={editing?.obs ?? null}
        viaKeyboard={editing?.viaKeyboard ?? false}
        onPatch={patch}
        onDelete={(reason, note) => editing && remove(editing.obs, reason, note)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
