import { describe, expect, it } from "vitest";
import { LAB_TOOLS, modeFrom, settingsFor, STUDY_MODE, study } from "../src/study/settings";

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
  researchExport: false,
  realExports: false,
  changeReasons: false,
  correctBehavior: false,
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
    expect(lab.labView && lab.caregiverProfiles && lab.blindCmai).toBe(true);
    expect(lab.watchingHours && lab.stoppedTap && lab.extraBeforeChips && lab.exportV2 && lab.protectBackup).toBe(true);
    expect(lab.archivePatients && lab.researchExport && lab.changeReasons && lab.correctBehavior).toBe(true);
    expect(lab.realExports).toBe(false); // real data waits on Dr. Gupta in writing, not on a build mode
    expect(lab.ratingsVisibleToCaregivers).toBe(false);
  });

  it("the PIN is off in both builds, and only a lab build made with it asked for has it", () => {
    expect(settingsFor("lab").pin).toBe(false);
    expect(settingsFor("caregiver").pin).toBe(false);
    expect(settingsFor("lab", true).pin).toBe(true);
    expect(settingsFor("caregiver", true).pin).toBe(false);
    expect(settingsFor("lab", true)).toEqual({ ...settingsFor("lab"), pin: true });
  });

  it("the test run uses the caregiver build", () => {
    expect(STUDY_MODE).toBe("caregiver");
    expect(study).toEqual(TODAY);
  });

  // The lab's tools sit on "Lab and research", a page only a build with labView has (design note 030 step 7).
  it("turns a lab tool on only in a build that has the Lab and research page", () => {
    for (const mode of ["caregiver", "lab"] as const)
      for (const pin of [false, true]) {
        const s = settingsFor(mode, pin);
        for (const tool of LAB_TOOLS) expect(s[tool] && !s.labView, `${mode}: ${tool} without labView`).toBe(false);
      }
  });
});
