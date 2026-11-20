// Marks something on screen that is built on an assumed answer until the lab decides
// (review register). These are notes from the lab to itself, so they render only in the lab
// build (study setting `labView`, build plan step 4.8): a caregiver never sees one. In the lab
// build a register ID (D-, F-, P- or V-) links to the register, where its row is.

import type { ReactNode } from "react";
import { study } from "../study/settings";

const REGISTER = "https://github.com/ferrelldevin/cmai-caregiver-app/blob/main/docs/review-register.md";

export function OpenLabel({ id, children }: { id: string; children: ReactNode }) {
  if (!study.labView) return null;
  return (
    <p className="open-label">
      <b>
        Open:{" "}
        {/^[DFPV]-\d+$/.test(id) ? (
          <a href={REGISTER} target="_blank" rel="noreferrer">
            {id}
          </a>
        ) : (
          id
        )}
      </b>{" "}
      {children}
    </p>
  );
}
