// The reason an edit records is worked out from what it changes (design note 030 step 4).
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/study/settings", () => ({ study: { changeReasons: true } }));

describe("reasonFor", () => {
  it("records a time, its exactness or its end as wrong_time", async () => {
    const { reasonFor } = await import("../src/ui/LogSheet");
    expect(reasonFor({ at: 1 })).toBe("wrong_time");
    expect(reasonFor({ approx: true })).toBe("wrong_time");
    expect(reasonFor({ endedAt: 5 })).toBe("wrong_time");
    expect(reasonFor({ endedAt: undefined })).toBe("wrong_time"); // an end taken back
  });
  it("records what happened before as other", async () => {
    const { reasonFor } = await import("../src/ui/LogSheet");
    expect(reasonFor({ before: "Mealtime" })).toBe("other");
    expect(reasonFor({ before: undefined, beforeNote: undefined })).toBe("other");
  });
  it("records a time and a chip saved together as wrong_time", async () => {
    const { reasonFor } = await import("../src/ui/LogSheet");
    expect(reasonFor({ before: "Mealtime", at: 1 })).toBe("wrong_time");
  });
});
