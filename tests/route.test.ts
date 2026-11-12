// Screens in the URL hash, so the back gesture and a reload keep your place.
import { describe, expect, it } from "vitest";
import { parseRoute, routeHash } from "../src/ui/route";

describe("routes", () => {
  it("reads each tab", () => {
    for (const tab of ["log", "today", "twoweeks", "data"] as const)
      expect(parseRoute(`#/${tab}`)).toEqual({ tab, page: null });
  });

  it("treats the removed #/review screen as unknown, so it lands on the start screen", () => {
    expect(parseRoute("#/review")).toBeNull();
  });

  it("reads a Data page, and only under Data", () => {
    expect(parseRoute("#/data/backup")).toEqual({ tab: "data", page: "backup" });
    expect(parseRoute("#/log/backup")).toEqual({ tab: "log", page: null });
  });

  it("drops what it does not know", () => {
    expect(parseRoute("")).toBeNull();
    expect(parseRoute("#group-physical")).toBeNull();
    expect(parseRoute("#/settings")).toBeNull();
    expect(parseRoute("#/data/nope")).toEqual({ tab: "data", page: null });
  });

  it("writes what it reads", () => {
    for (const h of ["#/log", "#/today", "#/data", "#/data/display", "#/data/about"])
      expect(routeHash(parseRoute(h)!)).toBe(h);
  });

  it("reads the Today tab (F-27)", () => {
    expect(parseRoute("#/today")).toEqual({ tab: "today", page: null });
    expect(parseRoute("#/today/extra")).toEqual({ tab: "today", page: null });
  });
});

describe("Two weeks period in the URL (F-28)", () => {
  it("reads the tab and a period", () => {
    expect(parseRoute("#/twoweeks")).toEqual({ tab: "twoweeks", page: null });
    expect(parseRoute("#/twoweeks/p2")).toEqual({ tab: "twoweeks", page: null, period: 2 });
  });
  it("drops a period it cannot read", () => {
    for (const h of ["#/twoweeks/p0", "#/twoweeks/2", "#/twoweeks/backup"])
      expect(parseRoute(h)).toEqual({ tab: "twoweeks", page: null });
  });
  it("writes what it reads", () => {
    for (const h of ["#/twoweeks", "#/twoweeks/p4"]) expect(routeHash(parseRoute(h)!)).toBe(h);
  });
});

describe("old Score addresses (Score folded into Two weeks, build plan 4.4)", () => {
  it("opens Two weeks, keeping the period", () => {
    expect(parseRoute("#/scores")).toEqual({ tab: "twoweeks", page: null });
    expect(parseRoute("#/scores/p3")).toEqual({ tab: "twoweeks", page: null, period: 3 });
  });
  it("drops a period it cannot read", () => {
    for (const h of ["#/scores/p0", "#/scores/3", "#/scores/px", "#/scores/backup"])
      expect(parseRoute(h)).toEqual({ tab: "twoweeks", page: null });
  });
  it("is written as the Two weeks address", () => {
    expect(routeHash(parseRoute("#/scores/p2")!)).toBe("#/twoweeks/p2");
    expect(routeHash({ tab: "log", page: null, period: 2 })).toBe("#/log");
  });
});

describe("pages behind a study switch", () => {
  it("the caregivers page does not exist in the caregiver build (R2 switched off)", () => {
    expect(parseRoute("#/data/caregivers")).toEqual({ tab: "data", page: null });
  });
});
