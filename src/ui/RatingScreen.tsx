// The caregiver's own two-week CMAI (F-47, plan 5.4, design note 012), on assumed approval
// behind `blindCmai`. Blind: nothing on this screen comes from the logs (no count, no "most
// logged", no default answer, no "mark the rest as never"), so the app's opinion cannot enter
// the caregiver's answer. Only after submitting, and only in the lab view, does the app's
// rating appear beside it.

import { useEffect, useState } from "react";
import { ratingFor, saveAnswer, submitRating, withinOne } from "../data/caregiverRatings";
import { db, isLive, type Patient } from "../data/db";
import { RATING_LABELS, scoreWindow, appRatings } from "../scoring/engine";
import { GROUP_LABELS, ITEMS, type FactorGroup } from "../scoring/items";
import { study } from "../study/settings";
import { Icon } from "./Icon";

const GROUP_ORDER: FactorGroup[] = ["aggressive", "physical", "verbal", "other"];
const SCALE = [1, 2, 3, 4, 5, 6, 7];

interface Props {
  patient: Patient;
  period: number;
  by: string;
  byInitials: string;
  onDone: () => void;
}

export function RatingScreen({ patient, period, by, byInitials, onDone }: Props) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState<{ windowStart: number; at: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  // The app's rating, read only once the caregiver's is locked, and only for the lab view.
  const [app, setApp] = useState<Record<number, number> | null>(null);

  useEffect(() => {
    let live = true;
    ratingFor(patient, period, by).then((row) => {
      if (!live) return;
      setAnswers(row?.answers ?? {});
      if (row?.submittedAt !== undefined) setSubmitted({ windowStart: row.windowStart, at: row.submittedAt });
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [patient, period, by]);

  useEffect(() => {
    if (!submitted || !study.labView) return;
    let live = true;
    db.observations
      .where("patientId")
      .equals(patient.id)
      .filter(isLive)
      .toArray()
      .then((obs) => live && setApp(appRatings(scoreWindow(obs, submitted.windowStart, Date.now()))));
    return () => {
      live = false;
    };
  }, [submitted, patient.id]);

  const done = ITEMS.filter((i) => answers[i.id] !== undefined).length;

  async function answer(itemId: number, value: number) {
    setError("");
    setConfirming(false);
    setAnswers((a) => ({ ...a, [itemId]: value }));
    try {
      await saveAnswer(patient, period, by, itemId, value);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submit() {
    try {
      const row = await submitRating(patient, period, by);
      setSubmitted({ windowStart: row.windowStart, at: row.submittedAt! });
      setConfirming(false);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!ready) return null;

  if (submitted) {
    const within = app ? ITEMS.filter((i) => withinOne(answers[i.id], app[i.id])).length : 0;
    return (
      <div className="rating">
        <h2>
          {patient.id}, period {period}: submitted
        </h2>
        <p className="msg" role="status">
          <Icon name="check" size={18} /> {byInitials}'s rating is saved and locked. It never changes the app's rating.
        </p>
        {app && (
          <section className="card" aria-labelledby="cmp-h">
            <h3 id="cmp-h">Lab view: caregiver beside app</h3>
            <p className="muted">
              Within 1 point on {within} of {ITEMS.length} behaviors (manual p.7). Codes 8 and 9 are never counted as
              within.
            </p>
            <table className="cmp">
              <thead>
                <tr>
                  <th scope="col">Behavior</th>
                  <th scope="col">{byInitials}</th>
                  <th scope="col">App</th>
                  <th scope="col">Within 1</th>
                </tr>
              </thead>
              <tbody>
                {ITEMS.map((i) => (
                  <tr key={i.id}>
                    <th scope="row">{i.name}</th>
                    <td>{answers[i.id]}</td>
                    <td>{app[i.id]}</td>
                    <td>{withinOne(answers[i.id], app[i.id]) ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <button onClick={onDone}>Back to Log</button>
      </div>
    );
  }

  return (
    <div className="rating">
      <h2>
        Two-week rating: {patient.id}, period {period}
      </h2>
      <p className="muted">
        For each behavior, how often did it happen in the 14 days of period {period}, as you saw it? Answer from memory,
        not from the app. Your answers save as you go; submit within 7 days of the period's end.
      </p>
      <p className="muted small-print">
        1 to 7 is how often. 8: would happen if not prevented. 9: does not apply to this resident.
      </p>
      {GROUP_ORDER.map((g) => (
        <section key={g} className="group" aria-labelledby={`rg-${g}`}>
          <h3 className="group-title" id={`rg-${g}`}>
            {GROUP_LABELS[g]}
          </h3>
          <ul className="rate-list">
            {ITEMS.filter((i) => i.group === g).map((item) => {
              const a = answers[item.id];
              return (
                <li key={item.id} className="rate-row">
                  <p className="rate-name" id={`ri-${item.id}`}>
                    {item.name}
                  </p>
                  <p className="muted small-print">{item.counts}</p>
                  <div className="rate-scale" role="group" aria-labelledby={`ri-${item.id}`}>
                    {SCALE.map((n) => (
                      <button
                        key={n}
                        className="rate-btn"
                        aria-pressed={a === n}
                        aria-label={`${n}, ${RATING_LABELS[n]}`}
                        onClick={() => answer(item.id, n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="rate-label" aria-hidden>
                    {a !== undefined && a <= 7 ? RATING_LABELS[a] : " "}
                  </p>
                  <div className="rate-codes" role="group" aria-label={`${item.name}: other answers`}>
                    {[8, 9].map((n) => (
                      <button
                        key={n}
                        className="rate-btn wide"
                        aria-pressed={a === n}
                        onClick={() => answer(item.id, n)}
                      >
                        {n} · {n === 8 ? "If not prevented" : "Not applicable"}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="rate-foot">
        {error && (
          <p className="msg error" role="alert">
            {error}
          </p>
        )}
        <p className="rate-progress" aria-live="polite">
          {done} of {ITEMS.length} answered
        </p>
        {confirming ? (
          <div className="row">
            <button onClick={submit}>Submit and lock</button>
            <button className="ghost" onClick={() => setConfirming(false)}>
              Not yet
            </button>
          </div>
        ) : (
          <button disabled={done < ITEMS.length} onClick={() => setConfirming(true)}>
            Submit rating
          </button>
        )}
        {confirming && <p className="muted small-print">Once submitted, nobody can change it.</p>}
      </div>
    </div>
  );
}
