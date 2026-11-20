// Watching hours (F-38, D-25, plan 5.6): one line that says whether the caregiver logging now is
// marked as with this resident, with "I'm here" / "I've left". It lives on Today, next to the band
// it feeds, and not on Log: nothing stands before the tiles (design note 030 step 6). A log still
// starts a watch on its own, so nobody has to come here to be counted.
import { useEffect, useState } from "react";
import type { Watch } from "../data/db";
import { endWatch, onWatchChange, openWatch, startWatch } from "../data/watches";
import { timeOfDay } from "./format";

interface Props {
  patientId: string;
  /** Called after a tap here has started or ended a watch. */
  onChange: () => void;
}

export function WatchStrip({ patientId, onChange }: Props) {
  // The open watch of whoever is logging, for any resident; `undefined` until it has been read.
  const [open, setOpen] = useState<Watch | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const read = () =>
      openWatch()
        .then((w) => live && setOpen(w ?? null))
        .catch(() => {});
    read();
    const stop = onWatchChange(read);
    return () => {
      live = false;
      stop();
    };
  }, []);
  // Only a watch for the resident on screen is shown or ended here: after a switch of resident the
  // strip never borrows the last one's.
  const watch = open && open.patientId === patientId ? open : null;
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (busy || open === undefined) return;
    setBusy(true);
    try {
      if (watch) await endWatch("tap");
      else await startWatch(patientId, "tap");
      onChange();
    } finally {
      setBusy(false);
    }
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
