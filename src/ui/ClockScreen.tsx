// Clock check (F-40, plan 5.8; lane A: it stores and collects nothing), shown in the lab view.
// A log and a wristband or camera must agree to the second to be paired, so the lab films this
// screen beside the other device at the start and end of a session. That pairing practice is an
// inference from sensor studies, not a single source (research scan, proposal 3).

import { useEffect, useRef } from "react";
import { thisDevice } from "../data/db";

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

function offsetText(d: Date) {
  const m = -d.getTimezoneOffset();
  return `UTC${m < 0 ? "−" : "+"}${pad(Math.floor(Math.abs(m) / 60))}:${pad(Math.abs(m) % 60)}`;
}

export function ClockScreen() {
  const timeRef = useRef<HTMLSpanElement>(null);
  const dateRef = useRef<HTMLSpanElement>(null);
  const zoneRef = useRef<HTMLSpanElement>(null);

  // Drawn from Date.now() on every frame, not from a one-second timer, which drifts and skips.
  // It runs with reduced motion on too: the changing time is the content, not decoration.
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const d = new Date(Date.now());
      if (timeRef.current)
        timeRef.current.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${Math.floor(d.getMilliseconds() / 100)}`;
      if (dateRef.current)
        dateRef.current.textContent = d.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      if (zoneRef.current)
        zoneRef.current.textContent = `${offsetText(d)} · ${Intl.DateTimeFormat().resolvedOptions().timeZone ?? "time zone unknown"}`;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <section className="card clock" aria-labelledby="clock-h">
      <h2 id="clock-h">This phone's clock</h2>
      <p>Film this screen next to the wristband or camera at the start and end of a session.</p>
      {/* Not announced every tenth of a second; a screen reader reads it when asked. */}
      <p className="clock-time">
        <span ref={timeRef} />
      </p>
      <p className="clock-date">
        <span ref={dateRef} />
      </p>
      <p className="muted">
        <span ref={zoneRef} />
      </p>
      <p className="muted small-print">Device ID: {thisDevice() ?? "not set yet"}</p>
    </section>
  );
}
