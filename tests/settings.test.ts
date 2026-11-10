import { describe, expect, it } from "vitest";
import { modeFrom, settingsFor, STUDY_MODE, study } from "../src/study/settings";

// Today's behavior, written out by hand so a change to the caregiver build has to change this test too.
const TODAY = {
  labView: false,
  caregiverProfiles: false,
  pin: false,
  blindCmai: false,
  ratingsVisibleToCaregivers: true,
  watchingHours: false,
  stoppedTap: false,
  extraBeforeChips: false,
  freeTextNotes: true,
  exportV2: false,
  protectBackup: false,
  archivePatients: false,
};

describe("study settings", () => {
  it("caregiver mode has every lane B switch off and matches today's app", () => {
    expect(settingsFor("caregiver")).toEqual(TODAY);
  });

  it("only the exact word 'lab' gives lab mode", () => {
    expect(modeFrom("lab")).toBe("lab");
    for (const value of [undefined, "", "LAB", "Lab", " lab", "caregiver", "true", "1"]) {
      expect(modeFrom(value)).toBe("caregiver");
    }
  });

  it("lab and caregiver have the same switches, so a new one cannot be left out of either", () => {
    expect(Object.keys(settingsFor("lab")).sort()).toEqual(Object.keys(settingsFor("caregiver")).sort());
  });

  it("lab mode turns on every feature awaiting sign-off", () => {
    const lab = settingsFor("lab");
    expect(lab.labView && lab.caregiverProfiles && lab.pin && lab.blindCmai).toBe(true);
    expect(lab.watchingHours && lab.stoppedTap && lab.extraBeforeChips && lab.exportV2 && lab.protectBackup).toBe(true);
    expect(lab.archivePatients).toBe(true);
    expect(lab.ratingsVisibleToCaregivers).toBe(false);
  });

  it("the test run uses the caregiver build", () => {
    expect(STUDY_MODE).toBe("caregiver");
    expect(study).toEqual(TODAY);
  });
});
