// Design mockup of the five-step flow: Login, Log, Score, Report, Settings.
// Not the app: nothing here is imported by src/App.tsx or saved anywhere. It exists so
// layout can be tried in Storybook (npm run storybook) before the real screens change,
// which waits on Dr. Gupta's review (cmai-mobile-plan.md).

import { useState, type CSSProperties, type ReactNode } from "react";
import { GROUP_LABELS, type FactorGroup } from "../scoring/items";
import { Icon, type IconName } from "../ui/Icon";
import { ArrowRightLeft } from "lucide-react";
import { BEHAVIOR_ICONS } from "./behavior-icons";
import {
  BEHAVIOR_SCORES,
  DEMO_CAREGIVER,
  DEMO_PATIENTS,
  GROUP_ORDER,
  PERIOD,
  RATING_LABELS,
  SHORT,
  TODAY_LOGS,
  TOTAL_BEFORE,
  TOTAL_NOW,
} from "./mock-data";
import {
  BLOCKS,
  BUSIEST_BLOCK,
  BUSY_DAY,
  GROUP_AVG,
  HEAT,
  LOGS_BEFORE,
  LOGS_NOW,
  PER_DAY,
  TOGETHER,
  fmtTime,
  periodDate,
  type MockLog,
} from "./mock-history";

export type MockTab = "log" | "score" | "report" | "settings";

const TABS: { id: MockTab; label: string; icon: IconName }[] = [
  { id: "log", label: "Log", icon: "plus" },
  { id: "score", label: "Score", icon: "chart" },
  { id: "report", label: "Report", icon: "review" },
  { id: "settings", label: "Settings", icon: "data" },
];

/** A phone-sized frame: resident banner on top, four tabs at the bottom. */
export function Phone({ tab, children, bare }: { tab?: MockTab; children: ReactNode; bare?: boolean }) {
  // Switch steps through the demo residents, so each badge color can be tried.
  const [who, setWho] = useState(0);
  const pt = DEMO_PATIENTS[who];
  return (
    <div className="mk-phone">
      {!bare && (
        <div className="mk-banner" data-res={who}>
          <span className="mk-banner-who">
            <span className="mk-avatar" aria-hidden>
              <span className="mk-av-letter">{pt.label.slice(-1)}</span>
              <span className="mk-av-num">{pt.short}</span>
            </span>
            <span className="mk-banner-text">
              <b>
                <span className="mk-name">{pt.label}</span>
                <span className="mk-code">{pt.code}</span>
              </b>
              <span>
                <span className="mk-pid">{pt.code} · </span>
                {pt.room}
                <span className="mk-sw-word"> · switch</span>
              </span>
            </span>
            <span className="mk-banner-chev" aria-hidden>
              <Icon name="chevron" size={16} />
            </span>
          </span>
          <button
            type="button"
            className="mk-banner-switch"
            aria-label="Switch resident"
            onClick={() => setWho((who + 1) % DEMO_PATIENTS.length)}
          >
            <ArrowRightLeft size={16} aria-hidden />
            Switch
          </button>
        </div>
      )}
      <div className="mk-body">{children}</div>
      {!bare && (
        <nav className="mk-tabs" aria-label="Sections">
          {TABS.map((t) => (
            <span
              key={t.id}
              className={t.id === tab ? "mk-tab on" : "mk-tab"}
              aria-current={t.id === tab ? "page" : undefined}
            >
              <span className="mk-tab-icon">
                <Icon name={t.icon} size={22} />
              </span>
              {t.label}
            </span>
          ))}
        </nav>
      )}
    </div>
  );
}

/* 1. Login ---------------------------------------------------------------- */

export interface LoginProps {
  step: "sign-in" | "choose-resident";
  method: "phone-pin" | "lab-account";
}

export function LoginScreen({ step, method }: LoginProps) {
  const [pin, setPin] = useState("");
  if (step === "choose-resident") {
    return (
      <Phone bare>
        <h1 className="mk-h1">Who are you caring for?</h1>
        <p className="mk-muted">
          Signed in as {DEMO_CAREGIVER.name}, {DEMO_CAREGIVER.role.toLowerCase()}.
        </p>
        <ul className="mk-list">
          {DEMO_PATIENTS.map((p) => (
            <li key={p.id}>
              <button className="mk-row-btn">
                <b>{p.label}</b>
                <span>{p.room}</span>
                <Icon name="chevron" className="mk-chev" />
              </button>
            </li>
          ))}
        </ul>
        <p className="mk-open">Open (R2): who assigns residents to caregivers.</p>
      </Phone>
    );
  }
  return (
    <Phone bare>
      <div className="mk-login-head">
        <span className="mk-logo" aria-hidden>
          <Icon name="lock" size={28} />
        </span>
        <h1 className="mk-h1">CMAI Tracker</h1>
        <p className="mk-muted">Gupta Lab, Old Dominion University</p>
      </div>
      {method === "phone-pin" ? (
        <>
          <p className="mk-center">Enter your 4-digit PIN</p>
          <div className="mk-pin-dots" aria-label={`${pin.length} of 4 digits`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={i < pin.length ? "on" : ""} />
            ))}
          </div>
          <div className="mk-keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
              k ? (
                <button
                  key={i}
                  onClick={() => setPin(k === "⌫" ? pin.slice(0, -1) : (pin + k).slice(0, 4))}
                  aria-label={k === "⌫" ? "Delete digit" : k}
                >
                  {k}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
        </>
      ) : (
        <form className="mk-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Lab email
            <input type="email" placeholder="name@odu.edu" />
          </label>
          <label>
            Password
            <input type="password" />
          </label>
          <button className="mk-primary">Sign in</button>
        </form>
      )}
      <p className="mk-open">
        Open (R1): phone PIN or lab accounts. Lab accounts move data off the phone, which needs Dr. Gupta (IRB, HIPAA).
      </p>
    </Phone>
  );
}

/* 2. Behavior log --------------------------------------------------------- */

export interface LogProps {
  layout: "grid" | "list";
  columns: 1 | 2 | 3 | 4;
  groupTabs: boolean;
  showFrequent: boolean;
  /** Tile sizing, for trying options live in Storybook's Controls panel. */
  iconSize?: number;
  iconPlacement?: "top" | "beside-name" | "centered";
  tileHeight?: number;
  tilePaddingY?: number;
  tilePaddingX?: number;
  tileGap?: number;
}

export function LogScreen({
  layout,
  columns,
  groupTabs,
  showFrequent,
  iconSize = 26,
  iconPlacement = "top",
  tileHeight = 76,
  tilePaddingY = 8,
  tilePaddingX = 12,
  tileGap = 8,
}: LogProps) {
  const [group, setGroup] = useState<FactorGroup>("aggressive");
  const [counts, setCounts] = useState<Record<number, number>>(() => {
    const c: Record<number, number> = {};
    for (const [id] of TODAY_LOGS) c[id] = (c[id] ?? 0) + 1;
    return c;
  });
  const [last, setLast] = useState<number | null>(null);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const tap = (id: number) => {
    setCounts({ ...counts, [id]: (counts[id] ?? 0) + 1 });
    setLast(id);
  };
  const frequent = [6, 1, 29, 13];
  const shown = groupTabs ? [group] : GROUP_ORDER;

  const tile = (id: number) => {
    const BehaviorIcon = BEHAVIOR_ICONS[id];
    const count = counts[id] ? (
      <span className="mk-badge" aria-label={`${counts[id]} today`}>
        {counts[id]}
      </span>
    ) : null;
    const icon = <BehaviorIcon className="mk-bicon" size={iconSize} aria-hidden />;
    if (layout === "list") {
      return (
        <button key={id} className="mk-line" onClick={() => tap(id)}>
          {icon}
          <span className="mk-tile-name">{SHORT[id]}</span>
          {count}
        </button>
      );
    }
    if (iconPlacement === "beside-name") {
      return (
        <button key={id} className="mk-tile place-beside" onClick={() => tap(id)}>
          {icon}
          <span className="mk-tile-name">{SHORT[id]}</span>
          {count}
        </button>
      );
    }
    if (iconPlacement === "centered") {
      return (
        <button key={id} className="mk-tile place-centered" onClick={() => tap(id)}>
          {count}
          {icon}
          <span className="mk-tile-name">{SHORT[id]}</span>
        </button>
      );
    }
    return (
      <button key={id} className="mk-tile" onClick={() => tap(id)}>
        <span className="mk-tile-top">
          {icon}
          {count}
        </span>
        <span className="mk-tile-name">{SHORT[id]}</span>
      </button>
    );
  };
  const cls = layout === "grid" ? "mk-grid" : "mk-lines";
  const sizing = {
    gridTemplateColumns: layout === "grid" ? `repeat(${columns}, 1fr)` : undefined,
    gap: layout === "grid" ? tileGap : undefined,
    "--mk-tile-h": `${tileHeight}px`,
    "--mk-tile-py": `${tilePaddingY}px`,
    "--mk-tile-px": `${tilePaddingX}px`,
  } as CSSProperties;

  return (
    <Phone tab="log">
      <div className="mk-head">
        <h1 className="mk-h1">Log a behavior</h1>
        <span className="mk-muted">{total} today</span>
      </div>
      {showFrequent && (
        <>
          <h2 className="mk-h2">Most logged for this resident</h2>
          <div className={cls} style={sizing}>
            {frequent.map(tile)}
          </div>
        </>
      )}
      {groupTabs && (
        <div className="mk-seg" role="tablist">
          {GROUP_ORDER.map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={g === group}
              className={g === group ? "on" : ""}
              onClick={() => setGroup(g)}
            >
              {GROUP_LABELS[g].split(/[ ,]/)[0]}
            </button>
          ))}
        </div>
      )}
      {shown.map((g) => (
        <section key={g}>
          {!groupTabs && <h2 className="mk-h2">{GROUP_LABELS[g]}</h2>}
          <div className={cls} style={sizing}>
            {BEHAVIOR_SCORES.filter((b) => b.group === g).map((b) => tile(b.id))}
          </div>
        </section>
      ))}
      <p className="mk-hint">Tap once per event. Hold a tile to see what counts and the manual page.</p>
      {last && (
        <div className="mk-toast" role="status">
          <span>Logged: {SHORT[last]}</span>
          <button
            onClick={() => {
              setCounts({ ...counts, [last]: counts[last] - 1 });
              setLast(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
    </Phone>
  );
}

/* 3. Score ---------------------------------------------------------------- */

export interface ScoreProps {
  order: "behaviors-first" | "total-first";
  showUnlogged: boolean;
}

function Rating({ r }: { r: number }) {
  return (
    <span className={`mk-rating r${r}`} title={RATING_LABELS[r]}>
      {r}
    </span>
  );
}

/** Change from last period, with its size: ↑2, ↓1, or a dash when unchanged. */
function Move({ now, before }: { now: number; before: number }) {
  const d = now - before;
  if (d === 0)
    return (
      <span className="mk-move same" aria-label="No change from last period">
        –
      </span>
    );
  return (
    <span
      className={d < 0 ? "mk-move down" : "mk-move up"}
      aria-label={`${d < 0 ? "Down" : "Up"} ${Math.abs(d)} from last period`}
    >
      {d < 0 ? "↓" : "↑"}
      {Math.abs(d)}
    </span>
  );
}

function TotalLine() {
  return (
    <div className="mk-total-line">
      <span>
        CMAI score <b>{TOTAL_NOW}</b>
        <span className="mk-muted"> / 203 so far</span>
      </span>
      <span className="mk-muted">
        last period {TOTAL_BEFORE} <Move now={TOTAL_NOW} before={TOTAL_BEFORE} />
      </span>
    </div>
  );
}

function BehaviorList({ showUnlogged }: { showUnlogged: boolean }) {
  const seen = BEHAVIOR_SCORES.filter((b) => b.count > 0).sort((a, b) => b.rating - a.rating || b.count - a.count);
  const unseen = BEHAVIOR_SCORES.filter((b) => b.count === 0);
  return (
    <section aria-label="Behaviors this period">
      <ul className="mk-list">
        {seen.map((b) => (
          <li key={b.id} className="mk-srow">
            <Rating r={b.rating} />
            <b>{b.short}</b>
            <span className="mk-muted">{b.count}</span>
            <Move now={b.rating} before={b.before} />
          </li>
        ))}
      </ul>
      {showUnlogged ? (
        <ul className="mk-list mk-quiet">
          {unseen.map((b) => (
            <li key={b.id} className="mk-srow">
              <Rating r={1} />
              <span>{b.short}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mk-more">+ {unseen.length} not logged (rated 1)</p>
      )}
    </section>
  );
}

export function ScoreScreen({ order, showUnlogged }: ScoreProps) {
  return (
    <Phone tab="score">
      <div className="mk-head">
        <h1 className="mk-h1">Score</h1>
        <span className="mk-muted">Day {PERIOD.day} of 14</span>
      </div>
      {order === "total-first" && <TotalLine />}
      <div className="mk-cols" aria-hidden>
        <span>Rating</span>
        <span>Logs</span>
        <span>vs last</span>
      </div>
      <BehaviorList showUnlogged={showUnlogged} />
      {order === "behaviors-first" && <TotalLine />}
      <p className="mk-hint">
        Ratings are provisional until the period ends {PERIOD.end}. Tap a rating for its meaning.
      </p>
    </Phone>
  );
}

/* 4. Report --------------------------------------------------------------- */

export interface ReportProps {
  view: "daily" | "two-week";
  todayLogs?: "as logged" | "busy day";
}

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** The two-week view: dates, charts and the behavior table. */
function TwoWeeks() {
  const today = PERIOD.day - 1;
  const days = Array.from({ length: 14 }, (_, d) => periodDate(d));
  const max = Math.max(...(PER_DAY.filter((n) => n !== null) as number[]));
  const sofar = LOGS_NOW.length;
  const lastSameDays = LOGS_BEFORE.filter((l) => l.day <= today).length;
  const heatMax = Math.max(...HEAT.flat());
  const rows = BEHAVIOR_SCORES.filter((b) => b.count > 0 || b.before > 1).sort(
    (a, b) => b.rating - a.rating || b.count - a.count,
  );
  const lastCount = (id: number) => LOGS_BEFORE.filter((l) => l.itemId === id).length;
  return (
    <>
      <p className="mk-period">
        <b>
          {fmtDate(days[0])} – {fmtDate(days[13])}
        </b>
        <span className="mk-muted">
          Period {PERIOD.number} · day {PERIOD.day} of 14
        </span>
      </p>

      <div className="mk-stats">
        <div>
          <small>Logs so far</small>
          <b>{sofar}</b>
          <span className="mk-muted">
            {lastSameDays} by day {PERIOD.day} last time
          </span>
        </div>
        <div>
          <small>CMAI score</small>
          <b>{TOTAL_NOW}</b>
          <span className="mk-muted">
            last {TOTAL_BEFORE} <Move now={TOTAL_NOW} before={TOTAL_BEFORE} />
          </span>
        </div>
        <div>
          <small>Seen</small>
          <b>{BEHAVIOR_SCORES.filter((b) => b.count > 0).length}</b>
          <span className="mk-muted">of 29</span>
        </div>
      </div>

      <section className="mk-card" aria-labelledby="rp-day">
        <h2 className="mk-card-h" id="rp-day">
          Logs per day
        </h2>
        <div className="mk-daybars" role="img" aria-label={`Logs per day: ${PER_DAY.slice(0, today + 1).join(", ")}`}>
          {days.map((dt, d) => {
            const n = PER_DAY[d];
            return (
              <span
                key={d}
                className={d === today ? "mk-daybar now" : "mk-daybar"}
                title={n === null ? fmtDate(dt) : `${fmtDate(dt)}: ${n} logs`}
              >
                <span className="mk-daybar-n">{n ?? ""}</span>
                <i
                  className={n === null ? "future" : ""}
                  style={{ height: n === null ? 4 : Math.max(4, (n / max) * 72) }}
                />
                <small>{WEEKDAY[dt.getDay()]}</small>
                <small>{dt.getDate()}</small>
              </span>
            );
          })}
        </div>
      </section>

      <section className="mk-card" aria-labelledby="rp-time">
        <h2 className="mk-card-h" id="rp-time">
          Time of day
        </h2>
        <p className="mk-card-sub">
          Most logs fall {BUSIEST_BLOCK.block}m ({BUSIEST_BLOCK.share}%).
        </p>
        <div className="mk-heat" role="table" aria-label="Logs by time of day and day">
          {BLOCKS.map((label, b) => (
            <div key={label} className="mk-heat-row" role="row">
              <small role="rowheader">{label}</small>
              {HEAT[b].map((n, d) => (
                <span
                  key={d}
                  role="cell"
                  className={d > today ? "mk-heat-cell future" : "mk-heat-cell"}
                  title={`${fmtDate(days[d])}, ${label}: ${n} logs`}
                  style={{ background: d > today ? undefined : heatColor(n, heatMax) }}
                />
              ))}
            </div>
          ))}
          <div className="mk-heat-row mk-heat-axis" aria-hidden>
            <small />
            {days.map((dt, d) => (
              <small key={d}>{d % 2 === 0 ? dt.getDate() : ""}</small>
            ))}
          </div>
        </div>
        <div className="mk-heat-key" aria-hidden>
          <small>Fewer</small>
          {[1, 3, 5, 7].map((r) => (
            <span key={r} style={{ background: `var(--r${r})` }} />
          ))}
          <small>More logs</small>
        </div>
      </section>

      <section className="mk-card" aria-labelledby="rp-group">
        <h2 className="mk-card-h" id="rp-group">
          Average rating by group
        </h2>
        <p className="mk-card-sub">
          Mean of each group&apos;s item ratings, 1 to 7 (· number of items). The thin mark is last period.
        </p>
        <ul className="mk-gbars">
          {GROUP_AVG.map((g) => (
            <li key={g.group}>
              <span className="mk-gbars-label">
                {GROUP_LABELS[g.group].split(/[ ,]/)[0]} <small className="mk-muted">· {g.items}</small>
              </span>
              <span className="mk-gbars-track">
                <i style={{ width: `${((g.now - 1) / 6) * 100}%` }} />
                <em style={{ left: `${((g.before - 1) / 6) * 100}%` }} title={`Last period ${g.before.toFixed(1)}`} />
              </span>
              <b>{g.now.toFixed(1)}</b>
            </li>
          ))}
        </ul>
      </section>

      <section className="mk-card" aria-labelledby="rp-table">
        <h2 className="mk-card-h" id="rp-table">
          Behaviors, this period vs last
        </h2>
        <table className="mk-table mk-rtable">
          <thead>
            <tr>
              <th>Behavior</th>
              <th>Rating</th>
              <th>Logs</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td>{b.short}</td>
                <td>
                  <Rating r={b.rating} />
                </td>
                <td>
                  {b.count} <small className="mk-muted">/ {lastCount(b.id)}</small>
                </td>
                <td>
                  <Move now={b.rating} before={b.before} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mk-card-sub">Logs: this period / last period. Change is in rating steps.</p>
      </section>

      <section className="mk-card" aria-labelledby="rp-pat">
        <h2 className="mk-card-h" id="rp-pat">
          Patterns to look into
        </h2>
        <ul className="mk-patterns">
          {TOGETHER.filter((t) => t.times >= 3).map((t) => (
            <li key={`${t.a}-${t.b}`}>
              <b>
                {SHORT[t.a]} and {SHORT[t.b]}
              </b>{" "}
              were logged within 30 minutes of each other {t.times} times.
            </li>
          ))}
          <li>
            <b>{BUSIEST_BLOCK.share}% of logs</b> fall {BUSIEST_BLOCK.block}m, late afternoon into evening.
          </li>
        </ul>
        <p className="mk-card-sub">
          These are patterns in this resident&apos;s logs, not causes. Weekday patterns need more than two weeks.
        </p>
      </section>

      <button className="mk-secondary">
        <Icon name="download" /> Export this period (CSV)
      </button>
    </>
  );
}

function heatColor(n: number, max: number): string {
  if (n === 0) return "var(--r1)";
  const step = Math.min(7, 2 + Math.round(((n - 1) / Math.max(1, max - 1)) * 5));
  return `var(--r${step})`;
}

/** Today's view: grouped by behavior, a tap opens each log's time. */
function Today({ busy }: { busy: boolean }) {
  const logs = busy ? BUSY_DAY : LOGS_NOW.filter((l) => l.day === PERIOD.day - 1);
  const [open, setOpen] = useState<number | null>(null);
  const byItem = new Map<number, MockLog[]>();
  for (const l of logs) byItem.set(l.itemId, [...(byItem.get(l.itemId) ?? []), l]);
  const groups = [...byItem.entries()].sort((a, b) => b[1][b[1].length - 1].minute - a[1][a[1].length - 1].minute);
  const last = logs.reduce((m, l) => Math.max(m, l.minute), 0);
  return (
    <>
      <p className="mk-period">
        <b>{fmtDate(periodDate(PERIOD.day - 1))}</b>
        <span className="mk-muted">Day ends at midnight</span>
      </p>
      <div className="mk-stats">
        <div>
          <small>Logs today</small>
          <b>{logs.length}</b>
        </div>
        <div>
          <small>Behaviors</small>
          <b>{byItem.size}</b>
        </div>
        <div>
          <small>Last log</small>
          <b className="mk-stat-time">{fmtTime(last)}</b>
        </div>
      </div>
      <div className="mk-timeline" role="img" aria-label={`${logs.length} logs between midnight and now`}>
        {logs.map((l, i) => (
          <i
            key={i}
            style={{ left: `${(l.minute / 1440) * 100}%` }}
            title={`${fmtTime(l.minute)} ${SHORT[l.itemId]}`}
          />
        ))}
        <span className="mk-timeline-now" style={{ left: `${((16 * 60 + 30) / 1440) * 100}%` }} />
      </div>
      <div className="mk-timeline-axis" aria-hidden>
        <small>12a</small>
        <small>6a</small>
        <small>12p</small>
        <small>6p</small>
        <small>12a</small>
      </div>
      <ul className="mk-list mk-acc">
        {groups.map(([id, ls]) => {
          const BehaviorIcon = BEHAVIOR_ICONS[id];
          const isOpen = open === id;
          return (
            <li key={id}>
              <button className="mk-acc-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}>
                <BehaviorIcon className="mk-bicon" size={22} aria-hidden />
                <b>{SHORT[id]}</b>
                <span className="mk-muted mk-small">last {fmtTime(ls[ls.length - 1].minute)}</span>
                <span className="mk-badge">{ls.length}</span>
                <span className={isOpen ? "mk-acc-chev open" : "mk-acc-chev"} aria-hidden>
                  <Icon name="chevron" size={16} />
                </span>
              </button>
              {isOpen && (
                <ol className="mk-acc-body">
                  {[...ls].reverse().map((l, i) => (
                    <li key={i}>
                      <span className="mk-time">{fmtTime(l.minute)}</span>
                      <span className="mk-muted mk-small">by {l.by}</span>
                      <button className="mk-link">Remove…</button>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mk-hint">Newest activity first. Removing a log asks for a reason and a confirm.</p>
      <p className="mk-open">Open (R4): a day ends at midnight here until Dr. Gupta confirms.</p>
    </>
  );
}

export function ReportScreen({ view: initial, todayLogs = "as logged" }: ReportProps) {
  const [view, setView] = useState(initial);
  return (
    <Phone tab="report">
      <div className="mk-seg" role="tablist" aria-label="Report range">
        <button
          role="tab"
          aria-selected={view === "daily"}
          className={view === "daily" ? "on" : ""}
          onClick={() => setView("daily")}
        >
          Today
        </button>
        <button
          role="tab"
          aria-selected={view === "two-week"}
          className={view === "two-week" ? "on" : ""}
          onClick={() => setView("two-week")}
        >
          Two weeks
        </button>
      </div>
      {view === "daily" ? <Today busy={todayLogs === "busy day"} /> : <TwoWeeks />}
    </Phone>
  );
}

/* 5. Settings ------------------------------------------------------------- */

export function SettingsScreen() {
  const rows: [string, string][] = [
    ["Residents", "2 assigned to you"],
    ["Text size", "Standard or large"],
    ["Theme", "Match phone"],
    ["Backup and export", "Last backup Nov 2"],
    ["Demo data", "Made-up residents for practice"],
    ["How ratings are worked out", "Scoring rules, manual pages"],
  ];
  return (
    <Phone tab="settings">
      <h1 className="mk-h1">Settings</h1>
      <div className="mk-profile">
        <span className="mk-avatar" aria-hidden>
          C
        </span>
        <span>
          <b>{DEMO_CAREGIVER.name}</b>
          <span className="mk-muted mk-small"> · {DEMO_CAREGIVER.role}</span>
        </span>
      </div>
      <ul className="mk-list">
        {rows.map(([k, v]) => (
          <li key={k}>
            <button className="mk-row-btn">
              <b>{k}</b>
              <span>{v}</span>
              <Icon name="chevron" className="mk-chev" />
            </button>
          </li>
        ))}
      </ul>
      <button className="mk-secondary">Sign out</button>
    </Phone>
  );
}
