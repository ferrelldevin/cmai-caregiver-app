# Data management plan (one page)

Draft for Dr. Gupta, 2026-11-10. Build plan step 3.2. Prepared by Claude (cloud thread) for Devin. Not approved. Lines marked **assumed** follow the recommended answer in the review packet and need Dr. Gupta's sign-off; each names its register ID.

**Today:** no real data exists. The app, the repo and every chat hold made-up demo data only. This plan says what must be true before that changes (gate G2).

## 1. What is collected

Per resident code: which of the 29 CMAI behaviors happened, the exact time, an "approximate" flag, what happened just before (pick list), an optional note of up to 120 characters, deletes with a reason, and a change history. Ratings are computed from these, never typed. Full list: `docs/data-dictionary.md`.

Not collected: names, rooms, dates of birth, diagnoses, photos, audio, location. Caregivers are told not to type names in notes; the app cannot check this, so note columns are marked "check before sharing" (P-11).

## 2. Is it identifiable?

- The code (such as `P-01`) is pseudonymous. Whoever holds the key that links codes to people can name everyone.
- If the data come from a clinic or nursing home covered by HIPAA, exact event times count as identifiers. Safe Harbor de-identification removes "all elements of dates (except year) for dates that are directly related to an individual" ([HHS guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html), 45 CFR 164.514(b)(2)(i)(C)). Every log is a date and time, so the exports are **not** de-identified under Safe Harbor.
- Inference, to confirm with ODU: the realistic routes are Expert Determination (the other method HHS names), or a limited data set under a data use agreement (45 CFR 164.514(e), not read today). This is P-04.
- HHS allows a re-identification code if it is "not derived from or related to information about the individual" and the means of re-identification is not disclosed (same page, 164.514(c)). **Assumed** (P-04): codes are assigned in order (`P-01`, `P-02`…), never from initials, room or birth date.

## 3. Where data lives, stage by stage

| Stage                   | Where                                                                                                                                                                       | Who can see it                   | **Assumed** answer (register ID)                                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On the phone            | The app's storage on a study phone                                                                                                                                          | Whoever holds the unlocked phone | Every study phone has a passcode; the phone's own storage encryption is the guard. Whose phones they are is open (P-10). A caregiver PIN says who logged, but is not encryption (R1, F-46; `docs/security/threat-model.md`) |
| Backup leaves the phone | Protected with a passphrase of 12 or more characters (F-10), and kept in one approved ODU-managed storage location, never personal email, personal cloud or a messaging app | Dr. Gupta and named lab members  | Dr. Gupta names the place in writing (P-04). The app's backup message changes to name it (audit A-12)                                                                                                                       |
| Analysis                | Lab computers or ODU-managed storage                                                                                                                                        | Named lab members                | CSVs are made at the lab from the backup, or queried from the lab database, not sent from the phone (P-04)                                                                                                                  |
| Lab database            | One SQLite file on lab or ODU-managed storage, later an ODU-managed PostgreSQL server; loaded from backups by `scripts/backup-to-sql.mjs` (`docs/data/lab-database.md`)     | Named lab members                | Which database is open (P-13, assumed: SQLite now, PostgreSQL later). Same tables in both, so moving is a copy                                                                                                              |
| The code key            | One file, kept apart from the data, by Dr. Gupta or the person he names                                                                                                     | That person only                 | Never in the app, GitHub, any AI chat or the same folder as exports (P-04)                                                                                                                                                  |
| Never                   | GitHub, personal Google Drive, any AI chat, screenshots in pull requests                                                                                                    | Nobody                           | Project rule, now                                                                                                                                                                                                           |

## 4. Approvals before the first real log

1. ODU IRB: submissions go electronically through OneAegis; the decision tree on the [ODU human subjects page](https://www.odu.edu/research/compliance/humans) says whether it goes to the college committee or the IRB; contact irb@odu.edu; investigators complete the CITI human subjects course (same page). P-03.
2. Site agreement and HIPAA route, if residents come from a clinic or nursing home (P-04).
3. CMAI permission from the author for this use (P-01).
4. This plan approved, with the place in section 3 filled in.

## 5. Keeping and deleting

- **Assumed** (P-04): keep study data for as long as the IRB approval and ODU's records rules require; Dr. Gupta sets the number of years. Not known to us today.
- A phone leaving the study (end of study, broken, reassigned): download a backup, restore it on a lab device and check the counts match, then delete each patient on the Data tab and remove the app. Note: deleting a patient also erases that patient's change history on the phone (audit A-09), so the backup must be checked first. D-20 asks whether deleting should become archiving.
- A lost phone: tell Dr. Gupta the same day; the last backup is the record from then on.

## 6. If real data shows up in the wrong place

Stop, do not copy it further, tell Dr. Gupta the same day, and follow what the IRB approval says about reporting. A commit that deletes it from GitHub is not enough, because the history still holds it: it needs a history rewrite and a request to GitHub Support (GitHub Docs, [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)).

## 7. Who answers for what

| Role                                | Person                          | **Assumed**   |
| ----------------------------------- | ------------------------------- | ------------- |
| Owner of the data and this plan     | Dr. Ajay Gupta, PI              |               |
| Keeps the app and the export format | Devin Ferrell                   |               |
| Second reviewer of code changes     | Shanmei Li, if Dr. Gupta agrees | Plan step 3.8 |
| Holds the code key                  | Named by Dr. Gupta              | P-04          |

Sources: [ODU human subjects research](https://www.odu.edu/research/compliance/humans); [HHS de-identification guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html). Both read on 2026-11-10. AI was used to draft this page.
