// "What counts as each behavior?" (F-37, build plan 4.1). One sheet lists all 29 behaviors
// under the same group headings as the Log grid: what to log, what not to, and the manual
// page with the full definition (p.12-13). It replaces the description that used to sit on
// every log button. Opened from the button under the grid, or by holding a tile, which
// opens it at that behavior. Short descriptions are in our own words; the CMAI is
// (c) Cohen-Mansfield (see NOTICE).

import { useEffect } from "react";
import { GROUP_LABELS, ITEMS, type FactorGroup } from "../scoring/items";
import { BEHAVIOR_ICONS } from "./behavior-icons";
import { SHORT_NAMES } from "./behavior-names";
import { Sheet } from "./Sheet";

const GROUP_ORDER: FactorGroup[] = ["aggressive", "physical", "verbal", "other"];

interface Props {
  /** Open, and at which behavior (null: from the top). */
  open: { itemId: number | null; viaKeyboard: boolean } | null;
  onClose: () => void;
}

export function DefinitionsSheet({ open, onClose }: Props) {
  // Opened by holding a tile: bring that behavior into view and mark it.
  useEffect(() => {
    if (!open?.itemId) return;
    const id = window.requestAnimationFrame(() =>
      document.getElementById(`def-${open.itemId}`)?.scrollIntoView({ block: "start" }),
    );
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  return (
    <Sheet
      open={!!open}
      viaKeyboard={open?.viaKeyboard ?? false}
      className="defs-sheet"
      title="What counts as each behavior"
      subtitle="Short descriptions in our own words. The manual page has the full definition."
      onClose={onClose}
    >
      {GROUP_ORDER.map((g) => (
        <section key={g} className="defs-group" aria-labelledby={`defs-${g}`}>
          <h3 id={`defs-${g}`} className="group-title">
            {GROUP_LABELS[g]}
          </h3>
          <dl>
            {ITEMS.filter((i) => i.group === g).map((item) => {
              const BehaviorIcon = BEHAVIOR_ICONS[item.id];
              return (
                <div key={item.id} id={`def-${item.id}`} className={open?.itemId === item.id ? "def on" : "def"}>
                  <dt>
                    <BehaviorIcon className="tile-icon" size={22} aria-hidden />
                    <span>
                      {item.name}
                      {SHORT_NAMES[item.id] !== item.name && (
                        <span className="muted"> · on the tile: {SHORT_NAMES[item.id]}</span>
                      )}
                    </span>
                  </dt>
                  <dd>
                    <p>{item.counts}</p>
                    {item.continuous && (
                      <p className="muted">One tap is one stretch of it, not each step or movement.</p>
                    )}
                    {item.doesNotCount && (
                      <p>
                        <b>Not this behavior:</b> {item.doesNotCount}
                      </p>
                    )}
                    <p className="ref">Manual p.{item.manualPage}</p>
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </Sheet>
  );
}
