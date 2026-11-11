// The Log screen's backup reminder: when it shows and when it stays quiet (F-36).
import { describe, expect, it } from "vitest";
import { backupReminder } from "../src/data/backupReminder";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 0, 20);

describe("backupReminder", () => {
  it("asks when a real patient has logs and never exported", () => {
    expect(backupReminder(NOW, null, false, 3)).toBe("Last backup: never.");
  });
  it("stays quiet for demo patients", () => {
    expect(backupReminder(NOW, null, true, 3)).toBeNull();
  });
  it("stays quiet before the first log", () => {
    expect(backupReminder(NOW, null, false, 0)).toBeNull();
  });
  it("stays quiet for seven days after an export", () => {
    expect(backupReminder(NOW, NOW - 7 * DAY, false, 3)).toBeNull();
  });
  it("says how many days ago once it is more than seven", () => {
    expect(backupReminder(NOW, NOW - 8 * DAY - 5, false, 3)).toBe("Last backup: 8 days ago.");
  });
});
