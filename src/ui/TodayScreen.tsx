// Today tab (F-27, build plan v5 step 4.2; round 3 mockup "Report, today"). This shift at a
// glance: today's date, three figures, logs by hour, and one row per behavior that opens to
// its logs. It is the one place a log is fixed: Edit opens the log details sheet (fix the
// time, add what happened before, or delete with a reason). A day runs from local midnight
// to local midnight (R4, open). No 1 to 7 rating is shown for a single day: the CMAI rates
// two weeks (manual p.2, p.5).

import { useEffect, useState, type MouseEvent } from "react";
import { checkInKey, db, localMidnight, type CheckIn, type StoredObservation } from "../data/db";
import { deleteLog, editLog, LogTimeError, restoreLog } from "../data/logs";
import { dayLogs, logsByHour } from "../scoring/day";
import { ITEMS } from "../scoring/items";
import { BEHAVIOR_ICONS } from "./behavior-icons";
import { SHORT_NAMES } from "./behavior-names";
import { timeOfDay } from "./format";
import { record } from "./diagnostics";
import { Icon } from "./Icon";
import { SAVE_FAILED } from "./LogScreen";
import { LogSheet } from "./LogSheet";
import { OpenLabel } from "./OpenLabel";

type SavedObs = StoredObservation & { id: number };
const TOAST_MS = 8000;
const hourLabel = (h: number) => (h === 0 ? "midnight" : h === 12 ? "noon" : h < 12 ? `${h} AM` : `${h - 12} PM`);

interface Props {
  patientId: string;
  observations: StoredObservation[];
  checkins: CheckIn[];
  onChange: () => void;
}

export function TodayScreen({ patientId, observations, checkins, onChange }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ obs: SavedObs; viaKeyboard: boolean } | null>(null);
  const [deleted, setDeleted] = useState<SavedObs | null>(null);
  const [saveError, setSaveError] = useState(false); // the last save failed
  const [editError, setEditError] = useState<string | null>(null);

  const now = Date.now();
  const today = localMidnight(now);
  const groups = dayLogs(observations, today);
  const hours = logsByHour(observations, today);
  const total = hours.reduce((a, b) => a + b, 0);
  const last = groups[0]?.logs[0];
  const hmax = Math.max(1, ...hours);
  const nowHour = new Date(now).getHours();
  const checkedIn = checkins.some((c) => c.day === today);
  const busiest = hours.indexOf(Math.max(...hours));

  useEffect(() => {
    setEditing(null);
    setDeleted(null);
    setOpen(null);
  }, [patientId]);

  useEffect(() => {
    if (!deleted) return;
    const t = window.setTimeout(() => setDeleted(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [deleted]);

  // One per patient per day (D-11). Tapping again takes it back.
  async function toggleCheckIn() {
    const key = checkInKey(patientId, today);
    setSaveError(false);
    try {
      if (checkedIn) await db.checkins.delete(key);
      else await db.checkins.put({ key, patientId, day: today, at: Date.now() });
    } catch (e) {
      record(e);
      setSaveError(true);
      return;
    }
    onChange();
  }

  function edit(o: SavedObs, e: MouseEvent) {
    setDeleted(null);
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
    setDeleted(o);
    onChange();
  }

  async function undoDelete() {
    if (!deleted) return;
    setSaveError(false);
    try {
      await restoreLog(deleted);
    } catch (e) {
      record(e);
      setSaveError(true);
      return;
    }
    setDeleted(null);
    onChange();
  }

  return (
    <div className="today">
      {saveError && (
        <p className="banner save-alert" role="alert">
          {SAVE_FAILED}
        </p>
      )}
      <div className="log-head">
        <p className="screen-title" aria-hidden>
          Today
        </p>
        <p className="today-date">
          <b>{new Date(now).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</b>
          <span className="muted"> · day ends at midnight</span>
        </p>
      </div>
      <OpenLabel id="R4">A day ends at midnight here until Dr. Gupta confirms.</OpenLabel>

      <dl className="stats">
        <div>
          <dt>Logs today</dt>
          <dd>{total}</dd>
        </div>
        <div>
          <dt>Behaviors</dt>
          <dd>{groups.length}</dd>
        </div>
        <div>
          <dt>Last log</dt>
          <dd className="stat-time">{last ? timeOfDay(last.at) : "None"}</dd>
        </div>
      </dl>

      {total === 0 ? (
        <section className="card today-empty" aria-labelledby="today-empty-h">
          <h2 id="today-empty-h">Nothing logged today</h2>
          <p className="muted">
            Saw none of these behaviors today? Tap this so the app knows today was quiet, not missed. Days with no logs
            and no check-in show as "unlogged" on Score.
          </p>
          <button className={checkedIn ? "ghost" : ""} aria-pressed={checkedIn} onClick={toggleCheckIn}>
            {checkedIn ? "✓ Nothing to log today (tap to undo)" : "Nothing to log today"}
          </button>
        </section>
      ) : (
        <>
          <section className="card hours-card" aria-labelledby="hours-h">
            <h2 className="card-h" id="hours-h">
              Logs by hour
            </h2>
            <div
              className="hours"
              role="img"
              aria-label={`Logs by hour today. ${hours
                .map((n, h) => (n ? `${hourLabel(h)}: ${n}` : ""))
                .filter(Boolean)
                .join(", ")}. Busiest: ${hourLabel(busiest)}.`}
            >
              {hours.map((n, h) => (
                <span key={h} className={h > nowHour ? "hour future" : h === nowHour ? "hour now" : "hour"}>
                  {n > 0 && <small>{n}</small>}
                  <i style={{ height: h > nowHour ? 3 : n === 0 ? 2 : Math.max(4, (n / hmax) * 56) }} />
                </span>
              ))}
            </div>
            <div className="hours-axis" aria-hidden>
              <small>12a</small>
              <small>6a</small>
              <small>12p</small>
              <small>6p</small>
              <small>12a</small>
            </div>
          </section>

          <ul className="acc">
            {groups.map(({ itemId, logs }) => {
              const BehaviorIcon = BEHAVIOR_ICONS[itemId];
              const isOpen = open === itemId;
              return (
                <li key={itemId}>
                  <button
                    className="acc-head"
                    aria-expanded={isOpen}
                    aria-controls={`today-${itemId}`}
                    onClick={() => setOpen(isOpen ? null : itemId)}
                  >
                    <BehaviorIcon className="tile-icon" size={22} aria-hidden />
                    <b className="acc-name">{SHORT_NAMES[itemId]}</b>
                    <span className="muted acc-last">last {timeOfDay(logs[0].at)}</span>
                    <span className="tile-count">
                      {logs.length}
                      <span className="sr"> {logs.length === 1 ? "log" : "logs"}</span>
                    </span>
                    <span className={isOpen ? "acc-chev open" : "acc-chev"} aria-hidden>
                      <Icon name="chevron" size={16} />
                    </span>
                  </button>
                  {isOpen && (
                    <ol className="acc-body" id={`today-${itemId}`}>
                      {logs.map((o) => (
                        <li key={o.id}>
                          <span className="acc-time">
                            {timeOfDay(o.at)}
                            {o.approx ? " (about)" : ""}
                          </span>
                          <span className="muted acc-before">
                            {o.before ? `before: ${o.before}${o.beforeNote ? ` (${o.beforeNote})` : ""}` : ""}
                          </span>
                          <button
                            className="ghost small"
                            aria-label={`Edit ${ITEMS[itemId - 1].name} at ${timeOfDay(o.at)}`}
                            onClick={(e) => edit(o as SavedObs, e)}
                          >
                            Edit
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="hint">
            Newest activity first. Edit fixes a time or removes a log. Removing asks for a reason and a confirm.
          </p>
        </>
      )}

      {deleted && (
        <div className="snackbar" role="status">
          <Icon name="trash" size={22} className="snackbar-icon" />
          <span className="snackbar-text">
            <b className="snackbar-title">
              <span className="sr">Deleted: </span>
              {SHORT_NAMES[deleted.itemId]}
            </b>
            <span className="snackbar-meta">
              Deleted · {deleted.patientId} · {timeOfDay(deleted.at)}
            </span>
          </span>
          <span className="snackbar-actions">
            <button className="snackbar-btn" onClick={undoDelete}>
              Undo
            </button>
          </span>
        </div>
      )}

      <LogSheet
        obs={editing?.obs ?? null}
        viaKeyboard={editing?.viaKeyboard ?? false}
        error={editError}
        onPatch={patch}
        onDelete={(reason, note) => editing && remove(editing.obs, reason, note)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
