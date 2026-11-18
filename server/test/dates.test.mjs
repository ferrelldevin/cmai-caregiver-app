import assert from "node:assert/strict";
import { test } from "node:test";
import { localDayStart, offsetMin, parseUtc, utcText } from "../src/dates.mjs";

const NY = "America/New_York";
const iso = (d) => d?.toISOString();

test("a local day starts at local midnight, across both clock changes", () => {
  assert.equal(iso(localDayStart(NY, "2026-11-02")), "2026-11-02T05:00:00.000Z"); // EST
  assert.equal(iso(localDayStart(NY, "2026-10-31")), "2026-10-31T04:00:00.000Z"); // EDT
  assert.equal(iso(localDayStart(NY, "2026-11-01")), "2026-11-01T04:00:00.000Z"); // the day clocks fall back
  assert.equal(iso(localDayStart(NY, "2026-11-01", 1)), "2026-11-02T05:00:00.000Z"); // that day is 25 hours long
  assert.equal(iso(localDayStart(NY, "2026-03-08", 1)), "2026-03-09T04:00:00.000Z"); // spring forward: 23 hours
});

test("a zone where midnight does not exist still gives the first instant of the day", () => {
  assert.equal(iso(localDayStart("Asia/Beirut", "2026-03-29")), "2026-03-28T22:00:00.000Z");
});

test("a date that does not exist is refused, whatever the offset", () => {
  for (const d of ["2026-02-31", "2026-11-00", "2026-13-45", "1999-01-01", "2101-01-01", "x", "", null])
    for (const plus of [0, 1]) assert.equal(localDayStart(NY, d, plus), null, `${d} plus ${plus}`);
});

test("UTC times must be real instants that round-trip", () => {
  assert.equal(parseUtc("2026-11-02T14:05:00Z"), Date.UTC(2026, 10, 2, 14, 5, 0));
  for (const t of [
    "2026-02-31T25:61:61Z",
    "0000-00-00T00:00:00Z",
    "2026-11-02T14:05:00",
    "1999-12-31T23:59:59Z",
    5,
    null,
  ])
    assert.equal(parseUtc(t), null, String(t));
  assert.equal(utcText(new Date(Date.UTC(2026, 10, 2, 14, 5, 0))), "2026-11-02T14:05:00Z");
});

test("offsetMin follows the zone's rules", () => {
  assert.equal(offsetMin(NY, Date.UTC(2026, 6, 1)), -240);
  assert.equal(offsetMin(NY, Date.UTC(2026, 10, 2, 12)), -300);
});
