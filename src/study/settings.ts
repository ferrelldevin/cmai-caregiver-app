// Every lane B feature reads one switch here. "caregiver" is what a study phone runs: only
// what Dr. Gupta has signed off. "lab" is for trying features that are built on assumed
// approval. The mode is fixed when the app is built, so a caregiver cannot turn anything on.
// Register F-48. When Dr. Gupta signs a row, one pull request flips that one switch in CAREGIVER.
export interface StudySettings {
  labView: boolean; // show "Open: <ID>" labels and register links
  caregiverProfiles: boolean; // R2, F-45 (plan 5.2)
  pin: boolean; // R1 option A, F-46 (plan 5.3)
  blindCmai: boolean; // day-14 caregiver rating, F-47 (plan 5.4)
  ratingsVisibleToCaregivers: boolean; // D-24
  watchingHours: boolean; // F-38 (plan 5.6)
  stoppedTap: boolean; // F-39 (plan 5.7)
  extraBeforeChips: boolean; // F-41 (plan 5.9)
  freeTextNotes: boolean; // P-11
  exportV2: boolean; // D-23 (plan 5.10): new CSV columns and files
  protectBackup: boolean; // F-10 (plan 5.11)
  archivePatients: boolean; // D-20 (plan 5.1): a patient with real logs is archived, not erased
}

const CAREGIVER: StudySettings = {
  labView: false,
  caregiverProfiles: false,
  pin: false,
  blindCmai: false,
  ratingsVisibleToCaregivers: true, // today's behavior; flips when D-24 is signed
  watchingHours: false,
  stoppedTap: false,
  extraBeforeChips: false,
  freeTextNotes: true, // today's behavior
  exportV2: false,
  protectBackup: false,
  archivePatients: false,
};

const LAB: StudySettings = {
  labView: true,
  caregiverProfiles: true,
  pin: true,
  blindCmai: true,
  ratingsVisibleToCaregivers: false,
  watchingHours: true,
  stoppedTap: true,
  extraBeforeChips: true,
  freeTextNotes: true,
  exportV2: true,
  protectBackup: true,
  archivePatients: true,
};

export type StudyMode = "caregiver" | "lab";

// Only the exact word "lab" turns lab mode on. Anything else, including a typo, is a caregiver build.
export const modeFrom = (value: string | undefined): StudyMode => (value === "lab" ? "lab" : "caregiver");
export const settingsFor = (mode: StudyMode): StudySettings => (mode === "lab" ? LAB : CAREGIVER);
export const STUDY_MODE: StudyMode = modeFrom(import.meta.env.VITE_STUDY_MODE);
export const study: StudySettings = settingsFor(STUDY_MODE);
