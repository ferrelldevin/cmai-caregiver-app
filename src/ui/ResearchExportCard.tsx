// "Export for research" (F-56, lab build only): one resident, one date range, one JSON file for the
// lab pipeline. Shows what it found before saving. Read-only: nothing here changes a log or a rating.

import { useState } from "react";
import { download } from "../data/exporter";
import type { Patient } from "../data/db";
import { buildResearchExport, ExportBlocked, type ResearchExport } from "../data/researchExport";
import { Icon } from "./Icon";

const dayText = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function ResearchExportCard({ patients, current }: { patients: Patient[]; current: string | null }) {
  const today = dayText(Date.now());
  const [patientId, setPatientId] = useState(current ?? patients[0]?.id ?? "");
  const [startDay, setStartDay] = useState(dayText(Date.now() - 13 * 86_400_000));
  const [endDay, setEndDay] = useState(today);
  const [found, setFound] = useState<ResearchExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const forget = () => {
    setFound(null);
    setError(null);
  };

  async function check() {
    forget();
    try {
      setFound(await buildResearchExport({ patientId, startDay, endDay }));
    } catch (e) {
      setError(e instanceof ExportBlocked ? e.message : `Export did not work: ${e instanceof Error ? e.message : e}.`);
    }
  }

  const s = found?.summary;
  return (
    <section className="card" aria-labelledby="research-h">
      <h2 id="research-h">Export for research</h2>
      <p className="muted">
        One resident, one date range, one JSON file for the lab pipeline. It holds behavior numbers and times only, no
        names or notes. Nothing in the app changes.
      </p>
      <div className="rx-field">
        <label htmlFor="rx-patient" className="field-label">
          Resident
        </label>
        <select
          id="rx-patient"
          value={patientId}
          onChange={(e) => {
            setPatientId(e.target.value);
            forget();
          }}
        >
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id}
            </option>
          ))}
        </select>
      </div>
      <div className="row wrap">
        <div className="rx-field">
          <label htmlFor="rx-start" className="field-label">
            First day
          </label>
          <input
            id="rx-start"
            type="date"
            value={startDay}
            max={endDay}
            onChange={(e) => {
              setStartDay(e.target.value);
              forget();
            }}
          />
        </div>
        <div className="rx-field">
          <label htmlFor="rx-end" className="field-label">
            Last day
          </label>
          <input
            id="rx-end"
            type="date"
            value={endDay}
            min={startDay}
            onChange={(e) => {
              setEndDay(e.target.value);
              forget();
            }}
          />
        </div>
      </div>
      <div className="row wrap rx-field">
        <button className="ghost" onClick={check} disabled={!patientId}>
          Check range
        </button>
      </div>
      {error && (
        <p className="msg error" role="alert">
          <Icon name="alert" size={18} /> {error}
        </p>
      )}
      {found && s && (
        <div aria-live="polite">
          <h3 className="form-label">Found</h3>
          <ul>
            <li>
              <b>{s.total}</b> {s.total === 1 ? "record" : "records"} ({s.active} active, {s.deleted} deleted, kept as
              deleted marks)
            </li>
            <li>
              Time zone saved with the log: {s.zoneFromLog} of {s.total}. The rest use this phone's zone, {s.tz}:{" "}
              {s.total - s.zoneFromLog}
              {s.offsetFromZone > 0 && `; ${s.offsetFromZone} older logs had no stored offset`}
            </li>
            <li>
              Older logs with no phone ID, shown as all zeros: <b>{s.placeholderDevice}</b>
            </li>
            <li>
              Role set to caregiver because no role is saved for who logged it: <b>{s.defaultedRole}</b>
            </li>
            <li>
              No frequency or review flag (not stored): <b>{s.noFrequency}</b>
            </li>
            <li>
              Marked "approximate time", exported as exact times: <b>{s.approxTime}</b>
            </li>
          </ul>
          <button
            onClick={() => {
              download(found.fileName, found.text, "application/json");
            }}
          >
            Save file
          </button>
          <p className="muted">{found.fileName}</p>
        </div>
      )}
    </section>
  );
}
