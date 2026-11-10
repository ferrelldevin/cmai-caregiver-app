// Where the app is, kept in the URL hash: #/log, #/scores, #/scores/p<n>, #/data,
// #/data/<page>. The old #/review (removed with D-14) is unknown, so it lands on the start screen. Picking a period on Scores replaces the entry, like a tab.
// Switching tabs replaces the history entry (the platform norm: Back does not walk through
// tab taps). Opening a Data page pushes one, so the back gesture returns to the Data hub.
// A reload lands on the same screen.

import { useEffect, useRef, useState } from "react";
import { study } from "../study/settings";

export type Tab = "log" | "scores" | "data";
export type DataPage = "backup" | "display" | "safe" | "demo" | "about" | "caregivers";
/** `period` is 1-based, as people read it ("Period 3"); absent means the default period. */
export interface Route {
  tab: Tab;
  page: DataPage | null;
  period?: number;
  rating?: RatingTarget;
}
/** The caregiver's two-week rating for one resident and period (F-47, plan 5.4): #/rating/P-03/p2. */
export interface RatingTarget {
  patientId: string;
  period: number;
}

const TABS: readonly Tab[] = ["log", "scores", "data"];
// The caregivers page exists only while caregiver profiles are switched on (R2, plan 5.2).
const PAGES: readonly DataPage[] = [
  "backup",
  "display",
  "safe",
  "demo",
  "about",
  ...(study.caregiverProfiles ? (["caregivers"] as const) : []),
];

export function parseRoute(hash: string): Route | null {
  const [tab, page, extra] = hash.replace(/^#\/?/, "").split("/");
  if (tab === "rating" && study.blindCmai) {
    const n = /^p([1-9]\d{0,3})$/.exec(extra ?? "");
    if (!n || !/^[A-Z0-9-]{1,20}$/.test(page ?? "")) return null;
    return { tab: "log", page: null, rating: { patientId: page, period: Number(n[1]) } };
  }
  if (!TABS.includes(tab as Tab)) return null;
  if (tab === "scores") {
    const n = /^p([1-9]\d{0,3})$/.exec(page ?? "");
    return n ? { tab, page: null, period: Number(n[1]) } : { tab, page: null };
  }
  return { tab: tab as Tab, page: tab === "data" && PAGES.includes(page as DataPage) ? (page as DataPage) : null };
}

export const routeHash = (r: Route) =>
  r.rating
    ? `#/rating/${r.rating.patientId}/p${r.rating.period}`
    : `#/${r.tab}${r.page ? `/${r.page}` : r.tab === "scores" && r.period ? `/p${r.period}` : ""}`;

/**
 * The current route, plus go() and back(). Only a Data page is pushed onto history, and
 * leaving it by any route pops it first, so the stack never holds more than hub + page.
 */
export function useRoute(fallback: () => Route) {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash) ?? fallback());
  const pending = useRef<Route | null>(null);

  useEffect(() => {
    const sync = () => {
      const target = pending.current;
      pending.current = null;
      if (target) history.replaceState(null, "", routeHash(target));
      setRoute(target ?? parseRoute(location.hash) ?? fallback());
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
    // fallback only matters when the hash is empty or unknown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushed = () => (history.state as { cmaiPage?: boolean } | null)?.cmaiPage === true;

  const go = (next: Route) => {
    // A Data page or a rating is pushed, so the back gesture returns to where it was opened.
    const isPage = (r: Route) => !!(r.page || r.rating);
    if (isPage(route) && pushed() && !isPage(next)) {
      // Pop the page we pushed, then land on the target in its place.
      pending.current = next;
      history.back();
      return;
    }
    const hash = routeHash(next);
    if (isPage(next) && !isPage(route)) history.pushState({ cmaiPage: true }, "", hash);
    else if (hash !== location.hash) history.replaceState(null, "", hash);
    setRoute(next);
  };

  const back = () => go({ tab: route.tab, page: null });
  return { route, go, back };
}
