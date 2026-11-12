// Asking the browser to keep the app's data (F-53).
import { describe, expect, it } from "vitest";
import { askToKeepData, keepState } from "../src/data/persist";

const storage = (persisted: boolean, persist: () => Promise<boolean>) =>
  ({ persisted: async () => persisted, persist }) as unknown as StorageManager;

describe("askToKeepData", () => {
  it("kept when the browser says yes", async () => {
    expect(await askToKeepData(storage(false, async () => true))).toBe("kept");
    expect(keepState()).toBe("kept");
  });
  it("kept without asking again when it already is", async () => {
    expect(
      await askToKeepData(
        storage(true, async () => {
          throw new Error("should not ask");
        }),
      ),
    ).toBe("kept");
  });
  it("not kept when the browser says no", async () => {
    expect(await askToKeepData(storage(false, async () => false))).toBe("not-kept");
  });
  it("unknown when there is no storage API", async () => {
    expect(await askToKeepData(undefined)).toBe("unknown");
  });
  it("unknown when the request throws", async () => {
    expect(
      await askToKeepData(
        storage(false, async () => {
          throw new Error("blocked");
        }),
      ),
    ).toBe("unknown");
  });
});
