# Review packet for Dr. Gupta

Draft, 2026-11-10. Build plan step 3.1. Prepared by Claude (cloud thread) for Devin to bring to Dr. Gupta. Not sent. About 25 minutes.

## How to mark it

Every row already has an answer: an assumption the team is building on now, so work does not stop while this packet waits. Nothing in it has been decided. Mark each row once.

| Mark | Means |
|---|---|
| ✓ | Confirmed. The assumed answer becomes the lab's rule, with today's date |
| ✗ and a letter | Reversed. Use the option letter you want instead; the work built on the old answer is changed |
| ? | Talk it through with Devin first |

Section A blocks the most work, so it comes first. Section D can be confirmed in one mark. Section E lists what is being built behind switched-off settings. Devin copies every mark into `docs/review-register.md` with the date.

## What this packet is built from, and what is missing

- Built from `docs/review-register.md` on `main` at `b753f6f`, the 2026-11-10 whole-project audit, design note 008, and the 2026-11-10 research scan *Missed connections in agitation detection*.
- **Missing: the review workbook.** It is with Dr. Gupta and not in the project folder or the repo (audit C-05). If it already has marks, the workbook's marks win over this packet; Devin copies them into the register.
- IDs marked *proposed* are not in the register yet (plan step 0.8 adds them). P-07 exists only in pull request #41.
- Not verified by us: whether ODU offers REDCap to this lab; how many years ODU requires data to be kept; the author list of the lab's 2019 CNS Spectrums abstract.
- AI was used to draft this packet and the documents it points to.

---

## A. Decisions that block the most (about 10 minutes)

| # | ID | Question | App today | Options | Assumed answer, and what is built on it | Mark |
|---|---|---|---|---|---|---|
| A1 | G1 | Does the lab adopt CMAI Tracker for its work? | Called an "interview prototype" (`README.md`, About page; audit A-13) | **a** Yes. **b** Not yet, keep as a prototype. **c** No | **a.** Bug fixes, checks and the round 3 mockup screens are being built now (plan Stages 0 to 4). The "prototype" wording changes only after this mark (plan 3.7) | |
| A2 | P-03 | What IRB review comes first, before any real resident or caregiver data? | No real data. Demo data only | **a** Submit to the ODU IRB through OneAegis before the first real log ([ODU human subjects](https://www.odu.edu/research/compliance/humans)). **b** Ask the IRB for a determination first (decision tree, same page). **c** Covered by an existing protocol: which one? | **a.** Nothing that collects real data is built or run until approval is in the register | |
| A3 | P-04 | Where may real data live, and who holds the key that links codes to people? | Backup message says "your email or cloud drive" (audit A-12) | **a** One ODU-managed storage place you name; you or a person you name hold the key, kept apart from the data. **b** A site partner's system (for example a clinic's). **c** REDCap, if ODU offers it | **a.** The data management plan (`docs/lab/data-management-plan.md`) is written this way. The backup message changes to name your place once you name it | |
| A4 | P-04 | If residents come from a clinic or nursing home covered by HIPAA: which route? Exact event times are dates, which Safe Harbor removes ([HHS](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html)) | Exports hold exact times | **a** Limited data set with a data use agreement (inference, to confirm with ODU). **b** Expert Determination. **c** Not a covered entity, so HIPAA does not apply | **a.** Exports keep exact times, because the scoring rule needs them (spec section 3) | |
| A5 | D-14 | Ratings come from live logs only; nobody can change one. Confirm? | Built that way since 2026-10-27 (design note 007) | **a** Confirm. **b** Allow a reviewer's rating beside the app's, never replacing it (spec section 5) | **a.** Already built. The blind caregiver CMAI at day 14 (5.4) waits for your mark on D-06 | |
| A6 | D-21 *proposed* | When is a finished period's rating final? Today a log can still be edited or deleted for 24 hours, so two exports can differ (audit A-10) | Recomputed on every export | **a** Final 24 hours after the period ends; the export says so. **b** Final the moment the period ends; no edits across the line. **c** Never frozen; analysts use the latest export | **a.** The data dictionary tells analysts this rule now. Marking periods "final" in the export is built with format 2 (D-23) | |
| A7 | D-20 *proposed* | Can a patient be deleted once real logging starts? Today deleting erases the history too (audit A-09) | Deleted for good after a confirm | **a** Archive with a reason; never erase. **b** Delete allowed, with a reason, and the history kept. **c** Keep as is | **a.** Designed into database version 4 (plan 5.1), one upgrade with R2 | |
| A8 | R1, F-46 *proposed* | Sign-in: a PIN on the phone, or lab accounts? | No sign-in | **a** A 4-digit PIN per caregiver on the phone, asked once per shift, never between taps; 10 wrong tries locks it until a setup PIN. It says who is logging; it does not protect the data, which the phone's own passcode does. NIST recommends 6 digits for this kind of PIN ([SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/), "Activation secrets"). **b** Same, 6 digits. **c** Lab accounts with two factors (AAL2), data on a server. **d** ODU REDCap | **a.** Being built switched off (plan 5.3; `docs/security/threat-model.md`). Four digits because caregivers enter it one-handed at shift start. **c** or **d** means a server and a new IRB question | |
| A9 | R2, F-45 *proposed* | Who sets up caregivers and residents? Can two caregivers share a resident? | One phone, no caregivers | **a** Whoever sets up the phone does it in Settings. Caregivers are codes plus initials, never names. Any caregiver on the phone can log for any resident on it; "My residents" is an order, not a lock. **b** Each caregiver sees only assigned residents. **c** One caregiver per resident | **a.** Being built switched off (plan 5.2). Sharing across phones (sync, F-11) waits for A3 | |
| A10 | P-07 (PR #41) | Is clear-text storage on the phone acceptable, with the phone's own passcode and storage encryption as the guard? | Codes and logs stored in clear in the browser | **a** Yes, with a rule that every study phone has a passcode; the backup file gets its own passphrase (F-10). **b** Also encrypt inside the app | **a.** The CodeQL warning is dismissed with this reason. A PIN would not make in-app encryption strong (threat model) | |

## B. Screens and reports (about 4 minutes)

| # | ID | Question | App today | Options | Assumed answer, and what is built on it | Mark |
|---|---|---|---|---|---|---|
| B1 | D-16, R4 | What does the daily report show, and when does a day end? | No daily report. "Today" starts at local midnight | **a** Counts per behavior and logs by hour; never a 1 to 7 rating for one day (the CMAI rates two weeks, manual p.2, p.5); the day runs midnight to midnight. **b** Same, but the day ends at the end of a shift (give the time) | **a.** Report, Today is built this way, labeled "Open: R4" on screen (plan 4.2) | |
| B2 | D-17 | Two-week report, behavior groups: show the group's average rating or its sum? | Not built | **a** Average, 1 to 7. **b** Sum of the group's ratings, as research usually reports | **a**, labeled "Open: D-17" on screen (plan 4.3). Changing to **b** is one function | |
| B3 | D-18 | Pattern thresholds: 20+ logs before a pattern shows, 1.5 × share, pairs within 30 minutes at least 3 times | Not built | **a** Use these for now. **b** Set your own | **a**, as named constants, labeled "Open: D-18" (plan 4.3) | |
| B4 | D-08, D-15 | On Score, lead with each behavior's rating, or the total? Manual p.5 calls a summed total "not useful"; trials use it | Behaviors first, total labeled secondary | **a** Behaviors first, total secondary. **b** Total on top, still labeled secondary, as the mockup shows | **a.** Plan 4.4 builds behaviors first | |
| B5 | F-23, F-24, F-26 to F-29, F-37 *proposed* | The round 3 mockup screens: shorter Log with icons, a Settings tab, Report, new Score rows. Behavior definitions move from the tile to an info button on each tile | Older layout | **a** Go ahead. **b** Show me the working screens first | **a.** Being built (plan 4.1 to 4.4). You see the working screens at plan step 4.5 | |

## C. Six ideas from the research scan (about 3 minutes)

From *Missed connections in agitation detection* (2026-11-10, Devin's project). None changes how a rating is computed. Each is optional for the caregiver.

| # | ID | Idea | Why, with source | Assumed answer, and what is built on it | Mark |
|---|---|---|---|---|---|
| C1 | F-38, D-25 *proposed* | **Watching hours.** One tap "I'm here", one "I've left"; a log also starts a watch; it ends after 4 hours with a question | Tells calm from unobserved by the hour. Sensor studies' "not agitated" labels include time nobody was watching ([Iaboni 2022](https://doi.org/10.1002/dad2.12305)). Extends D-11. Inference that this improves labels | Yes. Being built switched off (plan 5.6), row E1d. Data about caregivers too, so see row E4 | |
| C2 | F-39 *proposed* | **Optional "it stopped" tap**, giving each episode an end time | Sensor models need start and end; other teams got them from video review (Iaboni 2022). One tap still counts as one occurrence (spec section 4) | Yes. Being built switched off, row E1e. Scoring unchanged | |
| C3 | F-40 *proposed* | **Clock check screen**: the phone's exact time, to film or note when a wearable session starts | Logs and wristband data must line up to the second. Inference, no single source | Yes. Display only, no stored data, so it can be built now (lane A) | |
| C4 | F-41 *proposed* | **Three more "just before" choices:** too hot or cold; poor sleep last night; seemed unwell | Room temperature ([Tartarini 2017](https://doi.org/10.1177/1533317517704898)), sleep ([Tanev 2017](https://doi.org/10.1176/appi.neuropsych.16090166); one night did not predict the next day there), infection ([Capstick 2024](https://doi.org/10.1038/s41746-023-00995-5)) | Yes. Being built switched off, row E1f | |
| C5 | F-42 *proposed* | **Pattern card per resident**: time of day, top "just before" reasons | Episodes cluster in the afternoon ([Abedi 2025, preprint](https://arxiv.org/abs/2506.06306)); triggers differ by person ([Bankole 2020](https://doi.org/10.1177/1533317520906686)) | Yes. It is the patterns part of the two-week report (B3, plan 4.3) | |
| C6 | F-43 *proposed* | **Alert check, later:** when a sensor model exists, the app asks "Did this happen?" | Reviewers call for a human in the loop because false alarms stop adoption ([Kleine Deters 2024](https://doi.org/10.1016/j.pmcj.2024.101876)) | Not before G2. Needs a server, so A3 and A2 first. Nothing built | |
| C7 | (question) | May the open datasets TIHM ([Palermo 2023](https://doi.org/10.1038/s41597-023-02519-y), CC BY 4.0) and BESI ([Mendeley Data](https://doi.org/10.17632/tm8z3hsvbp.2), CC BY 4.0) sit on lab machines for practice? | Both public and de-identified per their pages | Not downloaded until you mark this | |
| C8 | (question) | Who are the authors of the lab's 2019 smartwatch pilot abstract ([CNS Spectrums, DOI 10.1017/S1092852919000105](https://doi.org/10.1017/S1092852919000105))? | Needed to cite it correctly | Cited by DOI only until you say | |

## D. Defaults to confirm in one mark (about 2 minutes)

One mark confirms every row below. Cross out any row you want to change or discuss.

| ID | Rule in the app today | Source |
|---|---|---|
| D-01 | Count to rating: 0 → 1, 1 → 2, 2 to 4 → 3, 5 to 13 → 4, 14 to 28 → 5, 29+ → 6 | Spec section 2; manual p.5 labels |
| D-02 | Rating 7: 3+ logs within 60 minutes on 7 or more of the 14 days | Spec section 3 |
| D-03 | Likely 7s are not asked about; the rating falls back to the count bands | Register; robustness study |
| D-04 | 29-item long form, 1 to 7 | Manual p.22 |
| D-05 | 14-day periods fixed from the first day, not rolling | Spec section 1 |
| D-06 | Code 8 (prevented) is a separate code, given only in a caregiver's own rating | Manual p.3, p.5 |
| D-07 | No instruction shown about partly prevented behaviors | Manual p.24 |
| D-09 | Nursing-home factor groups | Manual p.7 |
| D-10 | A change counts as meaningful at 2+ points, or 1 point in the same direction over two finished periods | Manual p.7 |
| D-11 | Unlogged days are flagged as unknown, not left out of trends | Spec section 7 |
| D-12 | Counts are never scaled up to make up for missed logs | Robustness study |
| D-13 | Back-dated (approximate) logs count in rating-7 clusters like any other | Spec section 3 |
| D-19 *proposed* | A log before the patient's first day is kept, counted in no period, and the caregiver is warned. When a backup is merged onto a phone that already has the patient, the phone's start date stays | Audit A-04; plan 1.3 |
| D-22 *proposed* | Each log stores the phone's offset from UTC, so the local day can be rebuilt | Audit A-14; data dictionary part 2 |
| D-23 *proposed* | Export format 2: format version, app version, UTC offsets, caregiver code (`docs/data-dictionary.md`) | Audit A-08 |
| P-08 *proposed* | The app is a research tool, not a medical device; the small print says so | Audit N-07 |
| P-09 *proposed* | English only for the pilot | Audit N-05 |

## E. Being built on an assumed answer, switched off (about 4 minutes)

Each of these is being built now (plan v5, Stage 5) behind a study setting that stays **off**, so caregivers do not see it until you mark it. None is built yet as of 2026-11-10. Nothing here was decided; each is an assumption. Tick one box per row. Devin shows you the screens (plan step 4.5).

| # | ID | What is being built | Answer assumed | Switch it on as built | Change it (say how) | Remove it |
|---|---|---|---|---|---|---|
| E1 | F-44 | Database version 4: one upgrade with every new field (plan 5.1; data dictionary part 2) | Archive instead of delete (A7), UTC offset on each log (D-22), who made each record | ☐ | ☐ | ☐ |
| E1a | F-45 | Caregiver profiles (plan 5.2) | Row A9, option a | ☐ | ☐ | ☐ |
| E1b | F-46 | PIN (plan 5.3) | Row A8, option a: 4 digits, once per shift | ☐ | ☐ | ☐ |
| E1c | F-47 | Blind day-14 CMAI by the caregiver, with codes 8 and 9 (plan 5.4; spec section 5) | Caregiver cannot see the app's ratings or counts before submitting (D-24, row E2) | ☐ | ☐ | ☐ |
| E1d | F-38, D-25 | Watching hours (plan 5.6) | Row C1 | ☐ | ☐ | ☐ |
| E1e | F-39 | "It stopped" tap | Row C2 | ☐ | ☐ | ☐ |
| E1f | F-41 | Three more "just before" choices | Row C4 | ☐ | ☐ | ☐ |
| E1g | D-23 | Export format 2 and `labels.csv` for the sensor work (plan 5.10) | Data dictionary part 2 | ☐ | ☐ | ☐ |
| E1h | F-10 | Passphrase-protected backup, 12 characters or more (plan 5.11) | Row A10 | ☐ | ☐ | ☐ |

| # | ID | Question | Assumed answer, and what is built on it | Mark |
|---|---|---|---|---|
| E2 | D-24 *proposed* | Do caregivers see the app's 1 to 7 ratings during a study? If they do, their own day-14 CMAI may lean on them (inference from general measurement practice, not a CMAI source) | No. Caregivers see counts and charts; ratings show only in lab view. One study setting | |
| E3 | P-10, P-11, P-12 *proposed* | **P-10:** are study phones the lab's or the caregivers' own? **P-11:** keep the optional free-text notes (120 characters, "no names" beside them)? **P-12:** approve the wording "This app tells no one. A log is a record for the study. For an injury or an emergency, do what your workplace says." | P-10: not assumed, it decides the passkey and tablet questions. P-11: kept, and marked "check before sharing" in the data dictionary. P-12: built with this wording (plan 1.10) | |
| E4 | P-03 | Does the IRB submission cover data about caregivers too: their codes, watching hours, and their day-14 ratings? | Yes, listed in the submission with A2 | |
| E5 | (plan 3.9) | The study protocol and analysis plan draft: sample size, the pass mark (row F4), and whether to preregister | Drafted by Devin and Claude with blanks for your numbers; not registered or sent until you mark it | |
| E6 | P-13 *proposed* | Which database does the lab keep study data in once it leaves the phones: one SQLite file on lab or ODU-managed storage, an ODU-managed PostgreSQL server, REDCap, or something the lab already uses? | One SQLite file now, a PostgreSQL server later. The frame is built for both and tested on both with made-up data: `docs/data/lab-schema.sql`, explained in `docs/data/lab-database.md`. REDCap would need a mapping, not built yet | |
| E7 | P-14 *proposed* | Outside AI services (Codex, Grok, Antigravity, and Ollama running on Devin's own computer) are now used on the code, on Devin's personal subscriptions. Is that acceptable? | Yes, with this limit (Devin, 2026-11-11): only code and made-up data leave his computer, never CMAI item wording, never real participant data. Reviews go to Codex or Grok first, bulk edits to local Ollama, Claude writes and verifies, and every outside finding is checked before anything changes. Every use is recorded in the AI-use ledger (`docs/lab/ai-use-ledger.md`). Assumed, sign-off pending | |

## F. Permissions, people and studies (about 2 minutes)

| # | ID | Question | Assumed answer, and what happens on it | Mark |
|---|---|---|---|---|
| F1 | P-01, P-02 | May Devin send the drafted permission email to the CMAI author? Non-commercial use only | Yes, after you read the wording. The date goes in `NOTICE` and the register | |
| F2 | P-05 | Code license and ownership: MIT under Devin's name, or as ODU policy requires ([ODU BOV Policy 1424](https://www.odu.edu/about/policiesandprocedures/bov/board-of-visitors-policy-1424))? | Stays MIT until you say; `CITATION.cff` gets the authors you name | |
| F3 | P-06 | Do usability sessions with caregivers or nurses need an IRB determination? | Yes, ask with A2. Sessions (V-09, V-12) wait | |
| F4 | V-01 | Agreement study pass mark, fixed before it runs: app within 1 point of each rater on 88% or more of items (manual p.7), with weighted kappa reported beside it | Yes. Written down before the study, so the result cannot be read to fit (plan 3.6) | |
| F5 | (3.8) | May Shanmei Li review and merge pull requests? | Yes. Devin adds her as a collaborator; the register records who can merge | |
| F6 | (3.5) | Move the repo to an ODU or lab GitHub organization? Moving changes the app's address, so every phone must back up, reinstall and restore | Only before the first real install, or never. Stays on Devin's account until you say | |

---

Every patient, count and example in this packet and the documents it points to is made-up demo data.
