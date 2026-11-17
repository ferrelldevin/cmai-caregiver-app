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

/** Minutes from UTC in `tz` at the instant `ms`. */
export function offsetMin(tz, ms) {
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

/** Start of `day` (plus `plus` days) in `tz` as a Date, or null when `day` is not a real date in 2000 to 2100. */
export function localDayStart(tz, day, plus = 0) {
  const m = DAY.exec(day ?? "");
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const real = new Date(Date.UTC(y, mo - 1, d));
  // Check the date itself first, so 2026-02-31 is refused whatever `plus` is.
  if (y < 2000 || y > 2100 || real.getUTCMonth() !== mo - 1 || real.getUTCDate() !== d) return null;
  const shifted = new Date(Date.UTC(y, mo - 1, d + plus));
  return new Date(dayStartMs(tz, shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate()));
}

export const utcText = (date) => date.toISOString().slice(0, 19) + "Z";

/** A contract timestamp (YYYY-MM-DDTHH:MM:SSZ) as ms, or null when it is not a real instant in 2000 to 2100. */
export function parseUtc(text) {
  if (typeof text !== "string") return null;
  const date = new Date(text);
  const ms = date.getTime();
  if (Number.isNaN(ms) || utcText(date) !== text) return null; // 2026-02-31T25:61:61Z does not round-trip
  const year = date.getUTCFullYear();
  return year >= 2000 && year <= 2100 ? ms : null;
}
