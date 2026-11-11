// The quiet "back up" line on the Log screen (F-36). Shown only for a real patient who has logs,
// when the last export is more than a week old or there is none. Reads the same
// "cmai-last-export" value the Data screen writes; stores nothing of its own.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The line to show, or null when no reminder is due. `lastExport` is the time of the last export, or null for never. */
export function backupReminder(now: number, lastExport: number | null, demo: boolean, logCount: number): string | null {
  if (demo || logCount === 0) return null;
  if (lastExport === null) return "Last backup: never.";
  if (now - lastExport <= WEEK_MS) return null;
  const days = Math.floor((now - lastExport) / (24 * 60 * 60 * 1000));
  return `Last backup: ${days} days ago.`;
}
