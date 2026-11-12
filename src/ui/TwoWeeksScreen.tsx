// Two weeks tab (F-28, build plan v5 steps 4.3 and 4.4; round 3 mockup "Report, two weeks", in
// the round 4 order: the answer first). One CMAI period: what stood out, each behavior this
// period against last, logs per day, time of day, behavior groups with the agitated marks,
// patterns, and History of finished periods. Score folded in here (F-29): the total is
// secondary, in the chip beside the title (D-08), and behaviors come first. Every figure
// comes from a tested pure function (src/scoring/period.ts, patterns.ts, engine.ts). Charts
// are plain HTML and CSS, each with a text alternative. Ratings come from the count rule and
// nobody can change them (D-14). The period in progress is "so far" and is left out of
// comparisons (D-10). Unlogged days are unknown, never zero (D-11).

import { useEffect, useMemo, useState } from "react";
import type { CheckIn, StoredObservation } from "../data/db";
import { addDays, meaningfulChanges, RATING_LABELS } from "../scoring/engine";
import { GROUP_LABELS, ITEMS, type FactorGroup } from "../scoring/items";
import { groupLogCounts, itemCounts, periodDays, timeOfDayGrid } from "../scoring/period";
import { busiestBlock, pairsTogether, PAIR_MINUTES } from "../scoring/patterns";
import { BEHAVIOR_ICONS } from "./behavior-icons";
import { shortDate } from "./format";
import { SHORT_NAMES } from "./behavior-names";
import { Icon } from "./Icon";
import { OpenLabel } from "./OpenLabel";
import { changeSince, periodBehaviors, selectedPeriod } from "./scoreView";
import type { ScoredWindow } from "./useCmaiData";

const FACTORS = ["aggressive", "physical", "verbal"] as const;
const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
const BLOCK_HOURS = 4;
const md = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const wmd = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const groupName = (g: FactorGroup) => GROUP_LABELS[g].split(/[ ,]/)[0];

/** Four plain-language legend steps that fit the busiest cell (round 3 mockup). */
function heatBins(max: number): { to: number; step: number; label: string }[] {
  if (max <= 3)
    return [
      { to: 0, step: 1, label: "0" },
      { to: 1, step: 3, label: "1" },
      { to: 2, step: 5, label: "2" },
      { to: Infinity, step: 7, label: "3+" },
    ];
  const a = Math.ceil(max / 3);
  return [
    { to: 0, step: 1, label: "0" },
    { to: a, step: 3, label: a === 1 ? "1" : `1–${a}` },
    { to: 2 * a, step: 5, label: `${a + 1}–${2 * a}` },
    { to: Infinity, step: 7, label: `${2 * a + 1}+` },
  ];
}

function Rating({ r, provisional }: { r: number; provisional: boolean }) {
  return (
    <span className={`rating-cell sm r${r}${provisional ? " provisional" : ""}`} title={RATING_LABELS[r]}>
      {r}
    </span>
  );
}

interface Props {
  windows: ScoredWindow[];
  observations: StoredObservation[];
  checkins: CheckIn[];
  hasActivity: boolean;
  period?: number; // 1-based, from the URL
  onPeriod: (period: number) => void;
  onLog: () => void;
  onExport: () => void;
}

export function TwoWeeksScreen({
  windows,
  observations,
  checkins,
  hasActivity,
  period,
  onPeriod,
  onLog,
  onExport,
}: Props) {
  const selected = selectedPeriod(windows, period);
  const sel = windows[selected];
  const prev = selected > 0 ? windows[selected - 1] : null;
  const now = Date.now();
  const [showAll, setShowAll] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // A comparison belongs to the period it was opened from.
  useEffect(() => setHistoryOpen(false), [selected]);

  const figures = useMemo(() => {
    if (!sel) return null;
    const { windowStart, windowEnd } = sel.score;
    const inPeriod = observations.filter((o) => o.at >= windowStart && o.at < windowEnd);
    const counts = itemCounts(observations, windowStart, windowEnd);
    const lastCounts = prev ? itemCounts(observations, prev.score.windowStart, prev.score.windowEnd) : {};
    const grid = timeOfDayGrid(observations, windowStart, BLOCK_HOURS);
    return {
      counts,
      lastCounts,
      days: periodDays(observations, checkins, windowStart, now),
      grid,
      busiest: busiestBlock(grid),
      pairs: pairsTogether(inPeriod),
      groups: groupLogCounts(counts),
      lastGroups: groupLogCounts(lastCounts),
      total: inPeriod.length,
    };
  }, [sel, prev, observations, checkins, now]);

  if (!sel || !figures || !hasActivity) {
    return (
      <div className="empty">
        <p>
          <b>No logs yet for this patient.</b>
        </p>
        <p>Log a behavior or record a quiet day to start seeing this patient's two weeks.</p>
        <button onClick={onLog}>
          <Icon name="plus" /> Go to Log
        </button>
      </div>
    );
  }

  const inProgress = sel.score.provisional;
  const { windowStart, windowEnd } = sel.score;
  const lastDay = addDays(windowEnd, -1);
  const dayOf = Math.min(14, figures.days.findIndex((d) => d.state === "today") + 1 || 14);
  // This period's behaviors only, as Score showed them; "Show all 29" brings back the rest.
  const rows = periodBehaviors(sel, showAll).sort(
    (a, b) =>
      sel.ratings[b.id] - sel.ratings[a.id] ||
      (figures.counts[b.id] ?? 0) - (figures.counts[a.id] ?? 0) ||
      (figures.lastCounts[b.id] ?? 0) - (figures.lastCounts[a.id] ?? 0),
  );
  const notLogged = ITEMS.length - periodBehaviors(sel, false).length;
  // Over all 29, so a behavior that dropped out of this period's list still counts as lower.
  const moves = new Map(ITEMS.map((i) => [i.id, changeSince(windows, selected, i.id)]));
  const down = ITEMS.filter((i) => moves.get(i.id)?.change === "down");
  const up = ITEMS.filter((i) => moves.get(i.id)?.change === "up");
  const mostLogged = rows
    .filter((i) => (figures.counts[i.id] ?? 0) > 0)
    .sort((a, b) => (figures.counts[b.id] ?? 0) - (figures.counts[a.id] ?? 0) || a.id - b.id)
    .slice(0, 3);
  const dayMax = Math.max(1, ...figures.days.map((d) => d.count));
  const heatMax = Math.max(0, ...figures.grid.cells.flat());
  const bins = heatBins(heatMax);
  const shownDays = figures.days.filter((d) => d.state !== "future");
  const names = (items: typeof rows) => items.map((i) => SHORT_NAMES[i.id]).join(", ");
  const finished = windows.filter((w) => !w.score.provisional);
  const history = new Map(ITEMS.map((i) => [i.id, meaningfulChanges(finished.map((w) => w.ratings[i.id]))]));
  const current = windows[windows.length - 1];

  return (
    <div className="twoweeks">
      {/* The total is secondary (manual p.5, D-08): a chip beside the title, not a headline. */}
      <div className="tw-head" id="tw-total">
        <p className="screen-title" aria-hidden>
          Two weeks
        </p>
        <p className={inProgress ? "total-chip so-far" : "total-chip"}>
          Total score <span className="sr">(secondary)</span>
          <b className="score-total-value">{sel.summary.total}</b>
          {inProgress ? " so far" : ""}
          {prev ? ` · last ${prev.summary.total}` : ""}
        </p>
        <p className="tw-coverage">
          {sel.summary.itemsInTotal} of 29 ratings · app-derived{inProgress ? " · so far" : ""}.{" "}
          {sel.elapsed - sel.unlogged} of {sel.elapsed} ended days recorded
          {sel.unlogged > 0 ? `; ${sel.unlogged} unlogged days are unknown, so scores may read low` : ""}
          {sel.elapsed === 0 ? "; today has not ended yet" : ""}.
        </p>
      </div>

      {/* Period: earlier and later, the dates, and where today is in it. */}
      <div className="pnav" role="group" aria-label="Choose a two-week period">
        <button
          className="ghost icon-btn"
          aria-label="Earlier period"
          disabled={selected === 0}
          onClick={() => onPeriod(selected)}
        >
          <Icon name="chevron" size={22} className="back-icon" />
        </button>
        <p className="pnav-label" role="status">
          <b>
            {md(windowStart)} – {md(lastDay)}
          </b>
          <small>
            Period {selected + 1} · {inProgress ? `day ${dayOf} of 14, so far` : "ended"}
            {/* The banner shows today's period; say so when this page shows an earlier one. */}
            {selected < windows.length - 1 && current.score.provisional && (
              <> · period {windows.length} is in progress</>
            )}
          </small>
        </p>
        <button
          className="ghost icon-btn"
          aria-label="Later period"
          disabled={selected === windows.length - 1}
          onClick={() => onPeriod(selected + 2)}
        >
          <Icon name="chevron" size={22} className="fwd-icon" />
        </button>
      </div>

      {/* The answer first (Part 8, U12). */}
      <section className="card summary" aria-labelledby="tw-sum">
        <h2 className="card-h" id="tw-sum">
          {inProgress ? "So far this period" : "This period"}
        </h2>
        <ul className="findings">
          {inProgress ? (
            mostLogged.length > 0 && (
              <li>
                <b>Most logged:</b> {mostLogged.map((i) => `${SHORT_NAMES[i.id]} (${figures.counts[i.id]})`).join(", ")}
                .
              </li>
            )
          ) : prev ? (
            <>
              <li>
                <b>Lower than last period:</b> {down.length ? `${names(down)}.` : "none by the change rule."}
              </li>
              <li>
                <b>Higher:</b> {up.length ? `${names(up)}.` : "none by the change rule."}
              </li>
            </>
          ) : (
            <li>This is the first period, so there is nothing to compare with yet.</li>
          )}
          {figures.busiest && (
            <li>
              <b>Busiest time:</b> {figures.busiest.label} ({figures.busiest.pct}% of logs).
            </li>
          )}
          {figures.total === 0 && <li>No behaviors logged in this period.</li>}
        </ul>
        <p className="card-sub">
          {inProgress
            ? `Day ${dayOf} of 14, so these can still change. Lower and higher are shown when the period ends on ${wmd(lastDay)}.`
            : "Lower and higher use the change rule: 2 or more rating steps, or 1 step the same way twice in a row (D-10)."}
        </p>
      </section>

      {/* What Score showed: each behavior, this period against last. */}
      <section className="card" id="tw-behaviors" aria-labelledby="tw-table">
        <h2 className="card-h" id="tw-table">
          Behaviors, this period vs last
        </h2>
        {rows.length === 0 ? (
          <p className="muted">No behaviors logged in this period.</p>
        ) : (
          <table className="rtable">
            <caption className="sr">
              Each behavior's rating and logs in period {selected + 1}, logs in the period before, and the change
            </caption>
            <thead>
              <tr>
                <th rowSpan={2} scope="col">
                  Behavior
                </th>
                <th rowSpan={2} scope="col">
                  Rating
                </th>
                <th colSpan={2} scope="colgroup" className="th-group">
                  Logs
                </th>
                <th rowSpan={2} scope="col">
                  Change
                </th>
              </tr>
              <tr>
                <th scope="col" className="th-sub">
                  Now
                </th>
                <th scope="col" className="th-sub">
                  Last
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const move = moves.get(item.id)!;
                const BehaviorIcon = BEHAVIOR_ICONS[item.id];
                return (
                  <tr key={item.id} data-behavior={item.id}>
                    <th scope="row">
                      <BehaviorIcon className="tile-icon" size={18} aria-hidden />
                      <span>{SHORT_NAMES[item.id]}</span>
                    </th>
                    {/* 5.0: the one place a "ratings visible to caregivers" switch would hide this column. */}
                    <td>
                      <Rating r={sel.ratings[item.id]} provisional={inProgress} />
                      <span className="sr">, {RATING_LABELS[sel.ratings[item.id]]}. App-derived from logs</span>
                    </td>
                    <td className="td-num">{figures.counts[item.id] ?? 0}</td>
                    <td className="td-num td-last">{prev ? (figures.lastCounts[item.id] ?? 0) : "–"}</td>
                    <td className="td-move">
                      <span className={`move ${move.change ?? "same"}`} aria-hidden>
                        {move.change === "up" ? "↑" : move.change === "down" ? "↓" : "–"}
                      </span>
                      <span className="sr">
                        {inProgress && prev ? `Not compared until the period ends (${move.text})` : move.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!showAll && <p className="more">+ {notLogged} not logged (rated 1)</p>}
        <button className="ghost" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show logged behaviors" : "Show all 29 behaviors"}
        </button>
        <p className="card-sub">
          Change compares finished periods only{inProgress ? "; this one is still in progress" : ""}. Ratings come from
          the logs and nobody can change them.
        </p>
        <details className="score-explanation">
          <summary>How to read these scores</summary>
          <p>
            Recorded days have a behavior log or a quiet-day check-in. Unlogged days are unknown, not zero. Today is not
            counted until it ends.
          </p>
          {sel.summary.specialCodes.length > 0 && (
            <p>
              Excluded from total and group averages:{" "}
              {sel.summary.specialCodes.map((c) => `#${c.itemId}: ${RATING_LABELS[c.code]}`).join("; ")}.
            </p>
          )}
          <p>
            These CMAI-based (app-derived) ratings come from the count rule alone, not a CMAI interview. Counts are
            logged occurrences in this period; deleted logs are not counted. Nobody can change a rating by hand, so it
            can be compared fairly with a caregiver's own rating.
          </p>
          <p>
            The total is secondary: the manual (p.5) advises reading individual behaviors. A lower total does not by
            itself show an effect of treatment.
          </p>
        </details>
      </section>

      <section className="card" aria-labelledby="tw-day">
        <h2 className="card-h" id="tw-day">
          Logs per day
        </h2>
        <div
          className="daybars"
          role="img"
          aria-label={`Logs per day: ${shownDays
            .map(
              (d) =>
                `${md(d.start)} ${d.state === "unknown" ? "not logged" : d.count}${d.state === "today" ? " so far" : ""}`,
            )
            .join(", ")}`}
        >
          {figures.days.map((d) => {
            const date = new Date(d.start);
            return (
              <span
                key={d.start}
                className={`daybar ${d.state}`}
                title={`${wmd(d.start)}: ${d.state === "unknown" ? "not logged" : d.state === "future" ? "not yet" : `${d.count} logs`}`}
              >
                <span className="daybar-n">{d.state === "unknown" ? "?" : d.state === "future" ? "" : d.count}</span>
                <i
                  style={{
                    height: d.state === "future" || d.state === "unknown" ? 4 : Math.max(4, (d.count / dayMax) * 72),
                  }}
                />
                <small>{WEEKDAY[date.getDay()]}</small>
                <small>{date.getDate()}</small>
              </span>
            );
          })}
        </div>
        <p className="card-sub">? marks a day with no log and no "nothing to log" check-in: unknown, not zero.</p>
      </section>

      <section className="card" aria-labelledby="tw-time">
        <h2 className="card-h" id="tw-time">
          Time of day
        </h2>
        {figures.total === 0 ? (
          <p className="muted">No logs in this period yet.</p>
        ) : (
          <>
            <div className="tod" role="table" aria-label="Logs by time of day (rows) and day of the period (columns)">
              {figures.grid.labels.map((label, b) => (
                <div key={label} className="tod-row" role="row">
                  <small role="rowheader">{label}</small>
                  {figures.grid.cells[b].map((n, d) => {
                    const day = figures.days[d];
                    return (
                      <span
                        key={d}
                        role="cell"
                        title={`${wmd(day.start)}, ${label}: ${day.state === "future" ? "not yet" : `${n} logs`}`}
                        aria-label={`${wmd(day.start)}, ${label}: ${day.state === "future" ? "not yet" : `${n} logs`}`}
                        className={day.state === "future" ? "tod-cell future" : "tod-cell"}
                        style={{
                          background:
                            day.state === "future" ? undefined : `var(--r${bins.find((x) => n <= x.to)!.step})`,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
              <div className="tod-row tod-axis" aria-hidden>
                <small />
                {figures.days.map((d, i) => (
                  <small key={d.start} className={d.state === "today" ? "now" : ""}>
                    {i % 2 === 0 || d.state === "today" ? new Date(d.start).getDate() : ""}
                  </small>
                ))}
              </div>
            </div>
            <div className="key" aria-label="Legend: logs in a block">
              <span className="key-title">Logs</span>
              {bins.map((x) => (
                <span key={x.label} className="key-item">
                  <span style={{ background: `var(--r${x.step})` }} />
                  {x.label}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="tw-group">
        <h2 className="card-h" id="tw-group">
          Behavior groups
        </h2>
        <p className="card-sub">
          The manual's nursing-home groups (p.7). Each square is one behavior's rating (1 to 7). The mark says whether
          the group meets the manual's agitated rule (p.5 to 6){inProgress ? ", so far" : ""}.
        </p>
        <ul className="groups">
          {FACTORS.map((g) => {
            const items = ITEMS.filter((i) => i.group === g).sort((a, b) => sel.ratings[b.id] - sel.ratings[a.id]);
            const f = sel.summary.factors[g];
            const lastF = prev?.summary.factors[g];
            return (
              <li key={g}>
                <b className="groups-name">{groupName(g)}</b>
                <div
                  className="groups-squares"
                  role="img"
                  aria-label={`${groupName(g)} ratings: ${items.map((i) => sel.ratings[i.id]).join(", ")}`}
                >
                  {items.map((i) => (
                    <span key={i.id} className={`mini r${sel.ratings[i.id]}`}>
                      {sel.ratings[i.id] > 1 ? sel.ratings[i.id] : ""}
                    </span>
                  ))}
                </div>
                <span className="groups-logs muted">
                  {figures.groups[g]} logs{prev ? ` · ${figures.lastGroups[g]} last period` : ""}
                </span>
                <span className={sel.summary.agitated[g] ? "groups-status warn" : "groups-status ok"}>
                  <Icon name={sel.summary.agitated[g] ? "alert" : "check"} size={16} />
                  {sel.summary.agitated[g] ? "Meets agitated rule" : "Below threshold"}
                </span>
                <div className="groups-avg">
                  <b aria-label={`Average rating ${f.n ? f.mean.toFixed(2) : "not available"}`}>
                    {f.n ? f.mean.toFixed(2) : "–"}
                  </b>
                  {lastF && <span className="muted">last {lastF.n ? lastF.mean.toFixed(2) : "–"}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <OpenLabel id="D-17">
          The group figure is the average rating. Research often reports the group sum instead.
        </OpenLabel>
      </section>

      <section className="card" aria-labelledby="tw-pat">
        <h2 className="card-h" id="tw-pat">
          Patterns to look into
        </h2>
        {figures.pairs.length === 0 && !figures.busiest ? (
          <p className="muted">
            None yet. Patterns show once there are enough logs (20 in the period) and something stands out.
          </p>
        ) : (
          <ul className="findings">
            {figures.pairs.slice(0, 3).map((p) => (
              <li key={`${p.a}-${p.b}`}>
                <b>
                  {SHORT_NAMES[p.a]} and {SHORT_NAMES[p.b]}
                </b>{" "}
                were logged within {PAIR_MINUTES} minutes of each other {p.times} times.
              </li>
            ))}
            {figures.busiest && (
              <li>
                <b>{figures.busiest.pct}% of logs</b> fall {figures.busiest.label}.
              </li>
            )}
          </ul>
        )}
        <p className="card-sub">Found by simple counting on the phone. Patterns, not causes.</p>
        <OpenLabel id="D-18">
          The thresholds (20 logs, 1.5 times an even share, 3 pairs within 30 minutes) are a first guess. Episodes
          cluster by time of day (Abedi 2025, preprint) and triggers differ by person (Bankole 2020).
        </OpenLabel>
      </section>

      <section className="card" id="tw-history" aria-labelledby="tw-hist">
        <h2 className="card-h" id="tw-hist">
          History
        </h2>
        <details open={historyOpen} onToggle={(e) => setHistoryOpen(e.currentTarget.open)}>
          <summary>Compare finished periods ({finished.length})</summary>
          {historyOpen &&
            (finished.length < 2 ? (
              <p>At least two finished periods are needed to compare. A period in progress is left out.</p>
            ) : (
              <>
                <p className="card-sub">
                  Finished periods only; unlogged days stay unknown. Separate from period {selected + 1} above.
                </p>
                <div className="heat-wrap">
                  <table className="heat">
                    <caption>Behavior ratings across finished periods</caption>
                    <thead>
                      <tr>
                        <th scope="col">Behavior</th>
                        {finished.map((w, i) => (
                          <th key={w.score.windowStart} scope="col">
                            P{i + 1}
                            <span className="sub">{shortDate(w.score.windowStart)}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="unlogged-row">
                        <th scope="row">Unlogged days</th>
                        {finished.map((w) => (
                          <td key={w.score.windowStart}>{w.unlogged}</td>
                        ))}
                      </tr>
                      {ITEMS.filter((item) => showAll || finished.some((w) => w.ratings[item.id] > 1)).map((item) => (
                        <tr key={item.id}>
                          <th scope="row">{SHORT_NAMES[item.id]}</th>
                          {finished.map((w, i) => {
                            const change = history.get(item.id)?.[i];
                            return (
                              <td key={w.score.windowStart} className={`r${w.ratings[item.id]}`}>
                                {w.ratings[item.id]}
                                {change && (
                                  <span
                                    className="chg"
                                    aria-label={change === "up" ? "changed, more often" : "changed, less often"}
                                  >
                                    {change === "up" ? "↑" : "↓"}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="card-sub">
                  Arrows mark a 2-point change, or 1 point the same way over two finished periods in a row. Codes 8 and
                  9 are never compared.
                </p>
                <table className="rtable history-groups">
                  <caption>Group averages and totals, finished periods</caption>
                  <thead>
                    <tr>
                      <th scope="col">Period</th>
                      {FACTORS.map((g) => (
                        <th key={g} scope="col">
                          {groupName(g)}
                        </th>
                      ))}
                      <th scope="col">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finished.map((w, i) => (
                      <tr key={w.score.windowStart}>
                        <th scope="row">P{i + 1}</th>
                        {FACTORS.map((g) => (
                          <td key={g}>{w.summary.factors[g].n ? w.summary.factors[g].mean.toFixed(2) : "–"}</td>
                        ))}
                        <td>{w.summary.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ))}
        </details>
      </section>

      <button className="ghost wide" onClick={onExport}>
        <Icon name="download" /> Export or back up data
      </button>
    </div>
  );
}
