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
import { db, localMidnight, madeHere, type StoredObservation } from "../data/db";
import { utcOffsetMin } from "../data/ids";
import { endWatch, openWatch, startWatch } from "../data/watches";
import { study } from "../study/settings";
import type { Watch } from "../data/db";
import { deleteLog, editLog, LogTimeError, restoreLog, stopLog, UNDO_REASON } from "../data/logs";
import { BEHAVIOR_ICONS } from "./behavior-icons";
import { SHORT_NAMES } from "./behavior-names";
import { timeOfDay } from "./format";
import { record } from "./diagnostics";
import { Icon } from "./Icon";
import { LogSheet } from "./LogSheet";
import { DefinitionsSheet } from "./DefinitionsSheet";

const GROUP_ORDER: FactorGroup[] = ["aggressive", "physical", "verbal", "other"];
const tabLabel = (g: FactorGroup) => GROUP_LABELS[g].split(/[ ,]/)[0];
const TOAST_MS = 8000;

type SavedObs = StoredObservation & { id: number };
type Toast = { kind: "logged" | "deleted"; obs: SavedObs };

export const SAVE_FAILED = "That did not save. Check the phone has free space, then try again.";

interface Props {
  patientId: string;
  observations: StoredObservation[];
  onChange: () => void;
  /** Opens the Today tab, where today's logs are listed and fixed. */
  onToday: () => void;
  /** Periods whose two-week rating the caregiver logging now still has to give (F-47). Never a blocker. */
  ratingsDue?: number[];
  onRate?: (period: number) => void;
}

export function LogScreen({ patientId, observations, onChange, onToday, ratingsDue = [], onRate }: Props) {
  const [defs, setDefs] = useState<{ itemId: number | null; viaKeyboard: boolean } | null>(null);
  const [group, setGroup] = useState<FactorGroup>("aggressive");
  const [toast, setToast] = useState<Toast | null>(null);
  const [held, setHeld] = useState(false); // pointer or focus inside the confirmation
  const [editing, setEditing] = useState<{ obs: SavedObs; viaKeyboard: boolean } | null>(null);
  const [saveError, setSaveError] = useState(false); // the last save failed
  const [editError, setEditError] = useState<string | null>(null);
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

  // Watching hours (F-38, plan 5.6): the strip says whether someone is marked as with this resident.
  const [watch, setWatch] = useState<Watch | null>(null);
  const [watchVersion, setWatchVersion] = useState(0);
  useEffect(() => {
    if (!study.watchingHours) return;
    let live = true;
    openWatch().then((w) => live && setWatch(w && w.patientId === patientId ? w : null));
    return () => {
      live = false;
    };
  }, [patientId, watchVersion]);
  async function toggleWatch() {
    if (watch) await endWatch("tap");
    else await startWatch(patientId, "tap");
    setWatchVersion((v) => v + 1);
    onChange();
  }

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
    const obs = { patientId, itemId, at: t, loggedAt: t, ...madeHere(), tzOffsetMin: utcOffsetMin(t) };
    const id = await db.observations.add(obs);
    // A log with no watch open starts one (D-25): logging never requires a watch.
    if (study.watchingHours && !watch) {
      await startWatch(patientId, "log", t);
      setWatchVersion((v) => v + 1);
    }
    navigator.vibrate?.(15);
    setFlash(itemId);
    window.setTimeout(() => setFlash((f) => (f === itemId ? null : f)), 900);
    setToast({ kind: "logged", obs: { ...obs, id } });
    onChange();
  }

  async function undo() {
    if (!toast) return;
    setSaveError(false);
    try {
      // Undo of a log just made is a delete like any other, with its own reason.
      if (toast.kind === "logged") await deleteLog(toast.obs, UNDO_REASON);
      else await restoreLog(toast.obs);
    } catch (e) {
      record(e);
      setSaveError(true);
      return;
    }
    setToast(null);
    setHeld(false);
    onChange();
  }

  // "It stopped" (F-39): the end of a stretch, now. The confirmation stays, showing both times.
  const stoppable = (t: Toast) =>
    t.kind === "logged" && study.stoppedTap && !!ITEMS[t.obs.itemId - 1].continuous && t.obs.endedAt === undefined;
  async function stopped(o: SavedObs) {
    const now = Date.now();
    await stopLog(o, now);
    setToast({ kind: "logged", obs: { ...o, endedAt: now } });
    onChange();
  }

  function edit(o: SavedObs, e: MouseEvent) {
    setToast(null);
    setHeld(false);
    setEditError(null);
    setEditing({ obs: o, viaKeyboard: e.detail === 0 });
  }

  async function patch(change: Partial<StoredObservation>) {
    if (!editing) return;
    // Show the change at once; the save follows. If the save is refused, the old values come back.
    const before = editing;
    setEditing({ ...editing, obs: { ...editing.obs, ...change } });
    setEditError(null);
    try {
      await editLog(editing.obs, change);
      onChange();
    } catch (e) {
      if (!(e instanceof LogTimeError)) record(e);
      setEditing(before);
      setEditError(e instanceof LogTimeError ? e.message : SAVE_FAILED);
    }
  }

  async function remove(o: SavedObs, reason: string, note?: string) {
    try {
      await deleteLog(o, reason, note);
    } catch (e) {
      record(e);
      setEditError(SAVE_FAILED);
      return;
    }
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
      {saveError && (
        <p className="banner save-alert" role="alert">
          {SAVE_FAILED}
        </p>
      )}
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
      {onRate && ratingsDue.length > 0 && (
        <div className="due-line">
          <p>
            Two-week rating due for {patientId}
            {ratingsDue.length > 1 ? ` (period ${ratingsDue[0]})` : ""}
          </p>
          <button className="small" onClick={() => onRate(ratingsDue[0])}>
            Rate
          </button>
        </div>
      )}
      {study.watchingHours && (
        <div className={watch ? "watch-strip on" : "watch-strip"}>
          <p>
            {watch ? (
              <>
                With {patientId} since <b>{timeOfDay(watch.start)}</b>
              </>
            ) : (
              `Not marked as with ${patientId}`
            )}
          </p>
          <button className={watch ? "ghost small" : "small"} onClick={toggleWatch}>
            {watch ? "I've left" : "I'm here"}
          </button>
        </div>
      )}
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
          className={stoppable(toast) ? "snackbar three" : "snackbar"}
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
              {toast.obs.endedAt !== undefined ? ` to ${timeOfDay(toast.obs.endedAt)}` : ""}
            </span>
          </span>
          <span className="snackbar-actions">
            {stoppable(toast) && (
              <button className="snackbar-btn" onClick={() => stopped(toast.obs)}>
                It stopped
              </button>
            )}
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
        error={editError}
        onPatch={patch}
        onDelete={(reason, note) => editing && remove(editing.obs, reason, note)}
        onClose={() => {
          setEditing(null);
          setEditError(null);
        }}
      />
    </div>
  );
}
