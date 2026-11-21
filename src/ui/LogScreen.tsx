// Screen 1: one tap logs a behavior. Behaviors are tiles, 3 across, all 29 on one page under
// their four group headings; the bar of group names jumps to a group and stays in reach while
// the page scrolls (design note 030 step 3; it was one group at a time, F-26). Each tile has an icon to find it by, a
// short name and today's count. What counts, what does not and the manual page (p.12-13)
// used to sit on every button; they are now in one sheet, opened from the button under the
// grid or by holding a tile (F-37). A short
// confirmation offers Edit and Undo, and three chips (Just now, 5 min ago, 15 min ago) that move
// the time back from when it was logged (F-51, design note 032), for 8 seconds; the timer stops while the caregiver is
// using it (WCAG 2.2.1). Edit opens the log details sheet (design note 003). Earlier logs
// are fixed on the Today tab, whose badge in the tab bar carries today's count (F-27, F-65).
// The screen starts with tiles: the how-to line shows only until this resident has a first
// log, and stays in the "what counts" sheet (design note 030 step 2). Every edit, delete and
// undo goes through data/logs.ts so it lands in the change history (design note 007).

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { GROUP_LABELS, ITEMS, type CmaiItem, type FactorGroup } from "../scoring/items";
import { mostLogged } from "./mostLogged";
import { db, localMidnight, madeHere, type StoredObservation } from "../data/db";
import { utcOffsetMin, zoneName } from "../data/ids";
import { startWatch } from "../data/watches";
import { study } from "../study/settings";
import {
  deleteLog,
  correctItem,
  editLog,
  LOG_GONE,
  LogTimeError,
  restoreLog,
  stopLog,
  UNDO_REASON,
} from "../data/logs";
import { BEHAVIOR_ICONS } from "./behavior-icons";
import { SHORT_NAMES } from "./behavior-names";
import { timeOfDay } from "./format";
import { record } from "./diagnostics";
import { Icon } from "./Icon";
import { LogSheet, reasonFor } from "./LogSheet";
import { DefinitionsSheet, HOW_TO_LOG } from "./DefinitionsSheet";

const GROUP_ORDER: FactorGroup[] = ["aggressive", "physical", "verbal", "other"];
const tabLabel = (g: FactorGroup) => GROUP_LABELS[g].split(/[ ,]/)[0];
const TOAST_MS = 8000;

type SavedObs = StoredObservation & { id: number };
type Toast = { kind: "logged" | "deleted"; obs: SavedObs };

// Chips count back from loggedAt, never from the last chip, so each is the same minutes whatever came before.
const WHEN_CHIPS = [
  { label: "Just now", minutes: 0 },
  { label: "5 min ago", minutes: 5 },
  { label: "15 min ago", minutes: 15 },
];
const whenMinutes = (o: StoredObservation) =>
  o.at === o.loggedAt ? 0 : o.approx ? (o.loggedAt - o.at) / 60_000 : null;

export const SAVE_FAILED = "That did not save. Check the phone has free space, then try again.";

interface Props {
  patientId: string;
  observations: StoredObservation[];
  onChange: () => void;
  /** Periods whose two-week rating the caregiver logging now still has to give (F-47). Never a blocker. */
  ratingsDue?: number[];
  onRate?: (period: number) => void;
}

export function LogScreen({ patientId, observations, onChange, ratingsDue = [], onRate }: Props) {
  const [defs, setDefs] = useState<{ itemId: number | null; viaKeyboard: boolean } | null>(null);
  const [group, setGroup] = useState<FactorGroup>("aggressive"); // the group at the top of the page now
  const [toast, setToast] = useState<Toast | null>(null);
  const [held, setHeld] = useState(false); // pointer or focus inside the confirmation
  const [editing, setEditing] = useState<{ obs: SavedObs; viaKeyboard: boolean } | null>(null);
  const [saveError, setSaveError] = useState(false); // the last save failed
  const [editError, setEditError] = useState<string | null>(null);
  const [whenError, setWhenError] = useState<{ id: number; message: string } | null>(null); // a chip refused, for that log
  const lastTap = useRef<{ itemId: number; t: number } | null>(null);
  const [flash, setFlash] = useState<number | null>(null); // the row just logged, highlighted briefly

  const now = Date.now();
  const todayStart = localMidnight(now);
  const todayCounts = new Map<number, number>();
  for (const o of observations) if (o.at >= todayStart) todayCounts.set(o.itemId, (todayCounts.get(o.itemId) ?? 0) + 1);
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

  // The resident on screen now, read after an await to see whether it is still the one a log was for.
  const shown = useRef(patientId);
  useEffect(() => {
    shown.current = patientId;
  }, [patientId]);

  async function log(itemId: number) {
    const t = Date.now();
    // A double tap on the same card within 0.6 s is almost always one event.
    if (lastTap.current && lastTap.current.itemId === itemId && t - lastTap.current.t < 600) return;
    lastTap.current = { itemId, t };
    const obs = {
      patientId,
      itemId,
      at: t,
      loggedAt: t,
      ...madeHere(),
      tzOffsetMin: utcOffsetMin(t),
      ...(zoneName() ? { tzName: zoneName() } : {}),
    };
    setSaveError(false);
    let id: number;
    try {
      id = await db.observations.add(obs);
    } catch (e) {
      record(e);
      lastTap.current = null; // the tap did not count, so a second tap is allowed at once
      setSaveError(true);
      return;
    }
    // A log with no watch open starts one (D-25): logging never requires a watch. With one open for
    // this resident, startWatch changes nothing. The strip that shows it is on Today (design note 030 step 6).
    // A resident switched away from while the save was on its way gets no watch: the switch ended it.
    if (study.watchingHours && shown.current === patientId) await startWatch(patientId, "log", t).catch(record);
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

  // F-51: the same two fields, and the same change-history entry and reason, as the log details sheet writes for a time.
  async function moveTime(minutes: number) {
    if (!toast || toast.kind !== "logged" || whenMinutes(toast.obs) === minutes) return;
    const o = toast.obs;
    const change = minutes ? { at: o.loggedAt - minutes * 60_000, approx: true } : { at: o.loggedAt, approx: false };
    setWhenError(null);
    setSaveError(false);
    try {
      await editLog(o, change, undefined, reasonFor(change));
    } catch (e) {
      if (e instanceof LogTimeError) {
        setWhenError({ id: o.id, message: e.message });
        setToast({ ...toast }); // the message gets its 8 seconds too
      } else {
        record(e);
        setSaveError(true);
      }
      return;
    }
    setToast((t) => (t && t.obs.id === o.id ? { kind: "logged", obs: { ...t.obs, ...change } } : t));
    onChange();
  }

  function edit(o: SavedObs, e: MouseEvent) {
    setToast(null);
    setHeld(false);
    setEditError(null);
    setEditing({ obs: o, viaKeyboard: e.detail === 0 });
  }

  // F-64: the same log with the right behavior. The sheet then shows the log as it is stored now.
  async function correct(itemId: number): Promise<boolean> {
    if (!editing) return false;
    setEditError(null);
    let stored: SavedObs | null;
    try {
      stored = await correctItem(editing.obs, itemId);
    } catch (e) {
      record(e);
      setEditError(SAVE_FAILED);
      return false;
    }
    onChange();
    if (!stored) {
      setEditError(LOG_GONE);
      return false;
    }
    setEditing({ ...editing, obs: stored });
    return true;
  }

  async function patch(change: Partial<StoredObservation>, reason?: string): Promise<boolean> {
    if (!editing) return false;
    // Show the change at once; the save follows. If the save is refused, the old values come back.
    const before = editing;
    setEditing({ ...editing, obs: { ...editing.obs, ...change } });
    setEditError(null);
    try {
      await editLog(editing.obs, change, undefined, reason);
      onChange();
      return true;
    } catch (e) {
      if (!(e instanceof LogTimeError)) record(e);
      setEditing(before);
      setEditError(e instanceof LogTimeError ? e.message : SAVE_FAILED);
      return false;
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

  // The bar of group names follows the page: it marks the group whose tiles are at the top now,
  // which is the one whose heading last passed under the bar. One exception, kept narrow: a
  // short last group cannot reach the top, so a group that was asked for by name stays marked
  // while the page is at its end and that group is in view. A scroll by hand drops the exception.
  const picked = useRef<FactorGroup | null>(null);
  const markRef = useRef<() => void>(() => {});
  useEffect(() => {
    let frame = 0;
    const mark = () => {
      frame = 0;
      const bar = document.querySelector(".group-jump")?.getBoundingClientRect();
      if (!bar) return;
      const line = bar.bottom + 24;
      let at: FactorGroup = GROUP_ORDER[0];
      for (const g of GROUP_ORDER) {
        const top = document.getElementById(`group-${g}`)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line) at = g;
      }
      const want = picked.current;
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const wantTop = want ? document.getElementById(`group-${want}`)?.getBoundingClientRect().top : undefined;
      const inView = wantTop !== undefined && wantTop >= bar.bottom - 4 && wantTop < window.innerHeight;
      setGroup(want && atEnd && inView ? want : at);
    };
    const soon = () => {
      if (!frame) frame = window.requestAnimationFrame(mark);
    };
    const byHand = () => {
      picked.current = null;
    };
    markRef.current = soon;
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    window.addEventListener("wheel", byHand, { passive: true });
    window.addEventListener("touchmove", byHand, { passive: true });
    window.addEventListener("keydown", byHand);
    soon(); // a reload can restore the page part-way down
    return () => {
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
      window.removeEventListener("wheel", byHand);
      window.removeEventListener("touchmove", byHand);
      window.removeEventListener("keydown", byHand);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  // What sits above the groups changes height without a scroll (the how-to line leaves, "most
  // logged" arrives, another resident), so the mark is worked out again then.
  const above = `${patientId} ${observations.length === 0} ${frequent.length}`;
  useEffect(() => markRef.current(), [above]);

  // A group name brings that group's heading to just under both pinned bars, whatever their
  // height is now (the bar of names wraps with large text). Focus goes to the heading, so a
  // keyboard or a screen reader carries on from there; nothing is hidden, so nothing is selected.
  function jump(g: FactorGroup) {
    const section = document.getElementById(`group-${g}`);
    const bar = document.querySelector<HTMLElement>(".group-jump");
    if (!section || !bar) return;
    const pinned = (document.querySelector<HTMLElement>(".pin")?.offsetHeight ?? 0) + bar.offsetHeight;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    picked.current = g;
    window.scrollTo({
      top: Math.max(0, section.getBoundingClientRect().top + window.scrollY - pinned),
      behavior: calm ? "auto" : "smooth",
    });
    document.getElementById(`group-h-${g}`)?.focus({ preventScroll: true });
    markRef.current();
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
      {observations.length === 0 && <p className="hint log-howto">{HOW_TO_LOG}</p>}
      {frequent.length > 0 && (
        <section className="log-frequent" aria-labelledby="frequent-h">
          <h2 className="group-title" id="frequent-h">
            Most logged for this resident
          </h2>
          <ul className="tile-grid">{frequent.map((id) => tile(ITEMS[id - 1], "frequent"))}</ul>
        </section>
      )}
      <nav className="group-jump" aria-label="Jump to a behavior group">
        <div className="group-tabs">
          {GROUP_ORDER.map((g) => (
            <button key={g} aria-current={g === group ? "true" : undefined} onClick={() => jump(g)}>
              {tabLabel(g)}
            </button>
          ))}
        </div>
      </nav>
      <div className="all-groups" role="group" aria-label="All behaviors">
        {GROUP_ORDER.map((g) => (
          <section key={g} id={`group-${g}`} className="group" aria-labelledby={`group-h-${g}`}>
            <h2 className="group-title" id={`group-h-${g}`} tabIndex={-1}>
              {GROUP_LABELS[g]}
            </h2>
            <ul className="tile-grid">{ITEMS.filter((i) => i.group === g).map((item) => tile(item, "group"))}</ul>
          </section>
        ))}
      </div>
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
          {toast.kind === "logged" && (
            <div className="snackbar-when" role="group" aria-label="When did it happen?">
              <span className="snackbar-when-label" aria-hidden="true">
                When?
              </span>
              {WHEN_CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className="when-chip"
                  aria-pressed={whenMinutes(toast.obs) === c.minutes}
                  onClick={() => void moveTime(c.minutes)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          {whenError?.id === toast.obs.id && (
            <p className="snackbar-when-error" role="alert">
              {whenError.message}
            </p>
          )}
        </div>
      )}

      <DefinitionsSheet open={defs} onClose={() => setDefs(null)} />

      <LogSheet
        obs={editing?.obs ?? null}
        viaKeyboard={editing?.viaKeyboard ?? false}
        error={editError}
        onPatch={patch}
        onCorrect={correct}
        onDelete={(reason, note) => editing && remove(editing.obs, reason, note)}
        onClose={() => {
          setEditing(null);
          setEditError(null);
        }}
      />
    </div>
  );
}
