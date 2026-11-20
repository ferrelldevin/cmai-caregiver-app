// Every lane B feature reads one switch here. "caregiver" is what a study phone runs: only
// what Dr. Gupta has signed off. "lab" is for trying features that are built on assumed
// approval. The mode is fixed when the app is built, so a caregiver cannot turn anything on.
// Register F-48. When Dr. Gupta signs a row, one pull request flips that one switch in CAREGIVER.
export interface StudySettings {
  labView: boolean; // show "Open: <ID>" labels and register links
  caregiverProfiles: boolean; // R2, F-45 (plan 5.2)
  pin: boolean; // R1 option A, F-46 (plan 5.3). Off in both builds since design note 030 step 5; see LAB_PIN below
  blindCmai: boolean; // day-14 caregiver rating, F-47 (plan 5.4)
  ratingsVisibleToCaregivers: boolean; // D-24
  watchingHours: boolean; // F-38 (plan 5.6)
  stoppedTap: boolean; // F-39 (plan 5.7)
  extraBeforeChips: boolean; // F-41 (plan 5.9)
  freeTextNotes: boolean; // P-11
  exportV2: boolean; // D-23 (plan 5.10): new CSV columns and files
  protectBackup: boolean; // F-10 (plan 5.11)
  archivePatients: boolean; // D-20 (plan 5.1): a patient with real logs is archived, not erased
  changeReasons: boolean; // G11: every edit and delete needs a reason from a pick list; history is append-only; a history view per log
  correctBehavior: boolean; // F-64: "Change behavior" on a log, saved as a new revision of the same log with the reason wrong_item
  realExports: boolean; // G1: allow "Export for research" for a resident who is not demo data. Off in both builds until Dr. Gupta says in writing where real exports may be kept (P-03, P-04)
  researchExport: boolean; // F-56: "Export for research", the JSON file for the lab pipeline (contract v1.0.0)
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
  changeReasons: false,
  correctBehavior: false,
  realExports: false,
  researchExport: false,
};

const LAB: StudySettings = {
  labView: true,
  caregiverProfiles: true,
  pin: false, // who is logging is remembered; the phone's own lock is the login (design note 030 step 5)
  blindCmai: true,
  ratingsVisibleToCaregivers: false,
  watchingHours: true,
  stoppedTap: true,
  extraBeforeChips: true,
  freeTextNotes: true,
  exportV2: true,
  protectBackup: true,
  archivePatients: true,
  changeReasons: true,
  correctBehavior: true,
  realExports: false, // not a sign-off feature: stays off in the lab build too
  researchExport: true,
};

export type StudyMode = "caregiver" | "lab";

// Only the exact word "lab" turns lab mode on. Anything else, including a typo, is a caregiver build.
export const modeFrom = (value: string | undefined): StudyMode => (value === "lab" ? "lab" : "caregiver");
// The PIN is switched off, not removed. A lab build made with VITE_STUDY_PIN=on has it, so its
// check (e2e/sign-in.cjs) keeps running and the code is known to work if Dr. Gupta asks for it back.
// Only the exact word "on" counts, and only in a lab build: a caregiver build can never have the PIN.
export const settingsFor = (mode: StudyMode, pin = false): StudySettings =>
  mode === "lab" ? { ...LAB, pin } : CAREGIVER;
export const STUDY_MODE: StudyMode = modeFrom(import.meta.env.VITE_STUDY_MODE);
export const LAB_PIN: boolean = import.meta.env.VITE_STUDY_PIN === "on";
export const study: StudySettings = settingsFor(STUDY_MODE, LAB_PIN);
