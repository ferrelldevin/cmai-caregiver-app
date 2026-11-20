// Watching hours (F-38, D-25, plan 5.6): one line that says whether the caregiver logging now is
// marked as with this resident, with "I'm here" / "I've left". It lives on Today, next to the band
// it feeds, and not on Log: nothing stands before the tiles (design note 030 step 6). A log still
// starts a watch on its own, so nobody has to come here to be counted.
import { useEffect, useState } from "react";
import type { Watch } from "../data/db";
import { endWatch, openWatch, startWatch } from "../data/watches";
import { timeOfDay } from "./format";

interface Props {
  patientId: string;
  /** Anything that changes when a watch may have started or ended elsewhere (a log, a switch). */
  refresh: unknown;
  /** Called after a tap here has started or ended a watch. */
  onChange: () => void;
}

export function WatchStrip({ patientId, refresh, onChange }: Props) {
  const [watch, setWatch] = useState<Watch | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    openWatch()
      .then((w) => live && setWatch(w && w.patientId === patientId ? w : null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [patientId, refresh, version]);
  async function toggle() {
    if (watch) await endWatch("tap");
    else await startWatch(patientId, "tap");
    setVersion((v) => v + 1);
    onChange();
  }
  return (
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
      <button className={watch ? "ghost small" : "small"} onClick={toggle}>
        {watch ? "I've left" : "I'm here"}
      </button>
    </div>
  );
}
