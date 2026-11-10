// Asks the browser not to clear this app's data when the phone runs low on space (F-53).
// The answer is shown on the About page so the lab can check a study phone.
// Why: browsers may clear a site's storage under pressure unless it asks to be kept
// (https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).

export type KeepState = "kept" | "not-kept" | "unknown";

let answer: KeepState = "unknown";

/** The last answer from `askToKeepData`; "unknown" until it has run. */
export const keepState = (): KeepState => answer;

export async function askToKeepData(storage: StorageManager | undefined = navigator.storage): Promise<KeepState> {
  if (!storage?.persist) return (answer = "unknown");
  try {
    answer = (await storage.persisted()) || (await storage.persist()) ? "kept" : "not-kept";
  } catch {
    answer = "unknown";
  }
  return answer;
}
