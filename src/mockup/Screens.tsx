// Design mockup of the five-step flow: Login, Log, Score, Report, Settings.
// Not the app: nothing here is imported by src/App.tsx or saved anywhere. It exists so
// layout can be tried in Storybook (npm run storybook) before the real screens change,
// which waits on Dr. Gupta's review (cmai-mobile-plan.md).

import { useState, type CSSProperties, type ReactNode } from "react";
import { GROUP_LABELS, type FactorGroup } from "../scoring/items";
import { Icon, type IconName } from "../ui/Icon";
import { BEHAVIOR_ICONS } from "./behavior-icons";
import {
  BEHAVIOR_SCORES,
  DAILY_TOTALS,
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

export type MockTab = "log" | "score" | "report" | "settings";

const TABS: { id: MockTab; label: string; icon: IconName }[] = [
  { id: "log", label: "Log", icon: "plus" },
  { id: "score", label: "Score", icon: "chart" },
  { id: "report", label: "Report", icon: "review" },
  { id: "settings", label: "Settings", icon: "data" },
];

/** A phone-sized frame: resident banner on top, four tabs at the bottom. */
export function Phone({ tab, children, bare }: { tab?: MockTab; children: ReactNode; bare?: boolean }) {
  return (
    <div className="mk-phone">
      {!bare && (
        <div className="mk-banner">
          <span className="mk-banner-who">
            <span className="mk-avatar" aria-hidden>
              A
            </span>
            <span className="mk-banner-text">
              <b>{DEMO_PATIENTS[0].label}</b>
              <span>
                <span className="mk-pid">{DEMO_PATIENTS[0].id} · </span>
                {DEMO_PATIENTS[0].room}
                <span className="mk-sw-word"> · switch</span>
              </span>
            </span>
            <span className="mk-banner-chev" aria-hidden>
              <Icon name="chevron" size={16} />
            </span>
          </span>
          <span className="mk-banner-switch">Switch</span>
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

function TotalCard() {
  const diff = TOTAL_NOW - TOTAL_BEFORE;
  return (
    <section className="mk-total" aria-labelledby="mk-total-h">
      <div className="mk-total-top">
        <h2 id="mk-total-h">Current CMAI score</h2>
        <span className="mk-chip">Secondary</span>
      </div>
      <p className="mk-total-num">
        <b>{TOTAL_NOW}</b>
        <span>of 203</span>
      </p>
      <p className="mk-muted mk-small">
        Sum of all 29 behavior ratings (lowest 29). Day {PERIOD.day} of 14, so far.{" "}
        {diff < 0 ? `${-diff} lower` : `${diff} higher`} than last period.
      </p>
      <p className="mk-muted mk-small">CMAI-based (app-derived). Read changes through the behaviors below.</p>
    </section>
  );
}

function BehaviorList({ showUnlogged }: { showUnlogged: boolean }) {
  const seen = BEHAVIOR_SCORES.filter((b) => b.count > 0).sort((a, b) => b.rating - a.rating || b.count - a.count);
  const unseen = BEHAVIOR_SCORES.filter((b) => b.count === 0);
  return (
    <section aria-labelledby="mk-beh-h">
      <h2 className="mk-section-h" id="mk-beh-h">
        Behaviors <span className="mk-muted">rating 1 to 7</span>
      </h2>
      <ul className="mk-list">
        {seen.map((b) => {
          const move = b.rating - b.before;
          return (
            <li key={b.id} className="mk-beh">
              <Rating r={b.rating} />
              <span className="mk-beh-text">
                <b>{b.name}</b>
                <span>
                  {b.count} {b.count === 1 ? "log" : "logs"} · {RATING_LABELS[b.rating]}
                </span>
              </span>
              {move !== 0 && (
                <span className={move < 0 ? "mk-move down" : "mk-move up"}>
                  {move < 0 ? "↓" : "↑"}
                  {Math.abs(move)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {showUnlogged ? (
        <ul className="mk-list mk-quiet">
          {unseen.map((b) => (
            <li key={b.id} className="mk-beh">
              <Rating r={1} />
              <span className="mk-beh-text">
                <span>{b.name}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mk-more">{unseen.length} behaviors not logged this period, each rated 1 · Show</p>
      )}
    </section>
  );
}

export function ScoreScreen({ order, showUnlogged }: ScoreProps) {
  return (
    <Phone tab="score">
      <div className="mk-head">
        <h1 className="mk-h1">Score</h1>
        <span className="mk-muted">
          Period {PERIOD.number}: {PERIOD.start} to {PERIOD.end}
        </span>
      </div>
      {order === "total-first" && <TotalCard />}
      <BehaviorList showUnlogged={showUnlogged} />
      {order === "behaviors-first" && <TotalCard />}
    </Phone>
  );
}

/* 4. Report --------------------------------------------------------------- */

export interface ReportProps {
  view: "daily" | "two-week";
}

export function ReportScreen({ view: initial }: ReportProps) {
  const [view, setView] = useState(initial);
  const max = Math.max(...DAILY_TOTALS);
  const changed = BEHAVIOR_SCORES.filter((b) => b.count > 0 || b.before > 1);
  return (
    <Phone tab="report">
      <h1 className="mk-h1">Report</h1>
      <div className="mk-seg" role="tablist">
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
      {view === "daily" ? (
        <>
          <p className="mk-muted">Wednesday, Nov 4 · {TODAY_LOGS.length} logs</p>
          <p className="mk-note">
            A day shows counts only. CMAI ratings cover two weeks, so a single day has no 1 to 7 rating.
          </p>
          <ul className="mk-list">
            {TODAY_LOGS.map(([id, time], i) => (
              <li key={i} className="mk-beh">
                <span className="mk-time">{time}</span>
                <span className="mk-beh-text">
                  <b>{SHORT[id]}</b>
                </span>
              </li>
            ))}
          </ul>
          <p className="mk-open">Open (R4): does a day end at midnight or at the end of a shift?</p>
        </>
      ) : (
        <>
          <p className="mk-muted">
            Period {PERIOD.number}, {PERIOD.start} to {PERIOD.end} · day {PERIOD.day} of 14
          </p>
          <h2 className="mk-h2">Logs per day</h2>
          <div className="mk-bars" aria-label="Logs per day">
            {Array.from({ length: 14 }, (_, d) => (
              <span key={d} className="mk-bar">
                <i style={{ height: d < DAILY_TOTALS.length ? (DAILY_TOTALS[d] / max) * 96 : 0 }} />
                <small>{d + 1}</small>
              </span>
            ))}
          </div>
          <h2 className="mk-h2">Ratings, this period vs last</h2>
          <table className="mk-table">
            <thead>
              <tr>
                <th>Behavior</th>
                <th>Last</th>
                <th>Now</th>
              </tr>
            </thead>
            <tbody>
              {changed.map((b) => (
                <tr key={b.id}>
                  <td>{b.short}</td>
                  <td>
                    <Rating r={b.before} />
                  </td>
                  <td>
                    <Rating r={b.rating} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mk-muted mk-small">
            Current CMAI score {TOTAL_NOW} (last period {TOTAL_BEFORE}). Secondary, app-derived.
          </p>
          <button className="mk-secondary">
            <Icon name="download" /> Export this report
          </button>
        </>
      )}
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
