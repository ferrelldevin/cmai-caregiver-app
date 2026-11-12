// Marks something on screen that is built on an assumed answer until the lab decides
// (review register). One component, so build plan step 4.8 can show these to the lab only
// by changing this file: once study setting `labView` exists, it renders nothing unless
// lab view is on.

import type { ReactNode } from "react";

export function OpenLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p className="open-label">
      <b>Open: {id}</b> {children}
    </p>
  );
}
