// Local days to UTC instants, for any IANA zone (same method as src/data/researchExport.ts; kept
// separate because that file imports the phone database).

export const validZone = (tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

function offsetMin(tz, ms) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, Number(x.value)]),
  );
  return Math.round(
    (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000) / 60_000,
  );
}

/** The first instant of local day `y-mo-d` in `tz`. */
function dayStartMs(tz, y, mo, d) {
  const wall = Date.UTC(y, mo - 1, d);
  const before = offsetMin(tz, wall - 86_400_000);
  const after = offsetMin(tz, wall + 86_400_000);
  const places = [before, after].filter((o) => offsetMin(tz, wall - o * 60_000) === o).map((o) => wall - o * 60_000);
  return places.length ? Math.min(...places) : wall - before * 60_000;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Start of `day` (plus `plus` days) in `tz` as a Date, or null when `day` is not a real YYYY-MM-DD. */
export function localDayStart(tz, day, plus = 0) {
  const m = DAY.exec(day ?? "");
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + plus));
  if (plus === 0 && (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3])) return null; // 2026-02-31
  return new Date(dayStartMs(tz, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
}

export const utcText = (date) => date.toISOString().slice(0, 19) + "Z";
