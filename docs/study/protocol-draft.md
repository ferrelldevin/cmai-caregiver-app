# Study protocol and analysis plan (draft)

Build plan step 3.9. Drafted by Claude on 2026-11-21 for Devin to take to Dr. Gupta. **Not sent, not registered, not approved.** Registering it or sending it is Dr. Gupta's call, through Devin. No real data is used or implied anywhere in this draft.

Why now: the claim the lab wants to make is that the app's rating agrees with a caregiver's own CMAI. That claim is only as strong as the plan written before the data exists. A plan written afterwards can be read to fit.

Blanks marked **for Dr. Gupta** are his to fill. Sources marked _abstract only_ have not been read in full by anyone on the build; confirm them in the full text before this draft is cited.

## 1. Question

For the same resident and the same 14 days, does the app's rating for each behavior fall within 1 point of a blind caregiver CMAI?

The 1-point standard is the manual's own measure of agreement between raters (CMAI Instruction Manual, Cohen-Mansfield 1991, p.7, as used in `docs/agreement/README.md`).

Not asked here: whether the app measures agitation better than the CMAI, whether it detects change sooner, or anything about sensors. Those are later studies.

## 2. Design

- **Who rates.** The caregiver who logged during the period. The app's own rating comes from that caregiver's logs by the written rule (`docs/scoring-spec.md`, `RULE_VERSION`), with no person in between.
- **When.** After each 14-day period ends, the caregiver fills the two-week rating in the app (F-47): all 29 behaviors, 1 to 7, with codes 8 and 9 where the manual allows them. It locks on submit.
- **Blind to what.** The caregiver does not see the app's ratings before or while rating (D-24, assumed, sign-off pending). The app shows them nothing from the logs on that form.
- **Not blind to.** Their own memory of logging. The same person produces both numbers. This is the main weakness of the design; see section 6.
- **Stronger variant, for Dr. Gupta:** a second informant who did not log (another shift's caregiver or a nurse) also fills a paper CMAI for the same 14 days. Then the app is compared with someone who never touched it.
- **Model.** Informant rating against direct observation, after Cohen-Mansfield and Libin 2004 ([DOI 10.1002/gps.1171](https://doi.org/10.1002/gps.1171); _abstract only_).

## 3. Measures

Fixed here, before any data.

| Level         | Statistic                                                                  | Pass mark                                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Each behavior | Share of resident-periods where the app is within 1 point of the caregiver | Reported per behavior; no pass mark per behavior                                                                                                            |
| All behaviors | Share of all item ratings within 1 point                                   | **88% or more**, the manual's inter-rater figure (p.7). Primary outcome                                                                                     |
| Each behavior | Quadratic weighted kappa                                                   | Reported with a 95% interval; no pass mark                                                                                                                  |
| Total score   | Intraclass correlation, two-way, absolute agreement, single measure        | Reported with a 95% interval, form named as Koo and Li advise ([DOI 10.1016/j.jcm.2016.02.012](https://doi.org/10.1016/j.jcm.2016.02.012); _abstract only_) |
| Direction     | Mean of app minus caregiver, per behavior, with limits of agreement        | Reported; shows whether the count rule runs high or low                                                                                                     |

Why 88%: the app cannot be expected to agree with a rater better than raters agree with each other.

Codes 8 (would occur if not prevented) and 9 (not applicable) have no count equivalent. Item ratings where the caregiver chose 8 or 9 are reported in their own table and left out of the statistics above.

The code that computes these already exists for the story-based check: `docs/agreement/analyze.py`.

## 4. Sample

| Quantity                | Number            | What sets it                                                                                                                   |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Residents               | **for Dr. Gupta** | Ratings from one resident are not independent. The interval around 88% narrows with residents, not with behaviors per resident |
| Periods per resident    | **for Dr. Gupta** | At least 2, so a first period (learning the app) can be compared with a later one                                              |
| Caregivers per resident | **for Dr. Gupta** | 1 is the minimum. 2 allows the stronger variant in section 2                                                                   |

For scale, and as arithmetic only: with 29 behaviors, 10 residents and 2 periods there are 580 item ratings, but the unit that matters is the resident. A statistician should set the number; this draft does not.

## 5. Missing data

Rules fixed before seeing any data.

- **Unlogged days are unknown, not zero** (D-11). The app never scales a count up.
- **A period is left out** of the primary outcome when fewer than **for Dr. Gupta** of its 14 days have a log or a "nothing to log" check-in. Proposed: fewer than 10. Left-out periods are counted and reported.
- **Watching hours** (F-38), where used, give the hours someone was actually observing. They are reported beside each period; they do not change a rating.
- **A rating not submitted** within **for Dr. Gupta** days of the period ending is missing. Proposed: 3 days, because the CMAI asks about the last two weeks and memory moves on.
- **Deleted logs** do not count. Every delete carries a reason and stays in the history.
- No imputation.

## 6. Known biases

| Bias                                                              | How the design limits it                                               | How it is reported                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| The same person logs and rates, so the two numbers share a memory | The stronger variant in section 2                                      | Stated as the main limitation; agreement with a non-logging informant shown apart |
| Logging changes what a caregiver notices                          | None within this design                                                | Stated. First period compared with later periods                                  |
| A caregiver who sees ratings anchors on them                      | Ratings hidden until the form is submitted (D-24)                      | Any breach is recorded and that period reported apart                             |
| Severe episodes are logged late, because hands are busy           | A late log can be given its real time; the export marks it approximate | The gap between `logged_at` and `occurred_at`, per behavior                       |
| Busy shifts log less                                              | Check-ins and watching hours show coverage                             | Agreement shown against days covered                                              |
| The count rule's bands were set by the build, not by a clinician  | D-01 and D-02 are open questions for Dr. Gupta                         | `RULE_VERSION` is stamped on every export; a rule change restarts the comparison  |

## 7. Reporting

- Agreement studies: GRRAS ([DOI 10.1016/j.jclinepi.2010.03.002](https://doi.org/10.1016/j.jclinepi.2010.03.002); _abstract only_).
- If a sensor model is later graded against app labels: STARD 2015 ([DOI 10.1136/bmj.h5527](https://doi.org/10.1136/bmj.h5527); _abstract only_).
- Say how AI was used in building the app: `docs/lab/contributions.md`, once Devin has corrected it.
- Report every left-out period and every deviation from this plan, with the date.

## 8. Preregistration

Recommended, because the pass mark and the leave-out rules are exactly the choices a reader will suspect were made afterwards. The [Center for Open Science](https://www.cos.io/initiatives/prereg) hosts registrations at no cost. Dr. Gupta decides.

## 9. Before any of this can start

All of these are Stop items in the build plan. None is done.

1. IRB determination, including whether it covers data about caregivers: their codes, watching hours and their own ratings (review packet, question 13).
2. Where real data may live, in writing (P-03, P-04).
3. The lab adopts the app (G1), and the rule's open decisions are settled (D-01, D-02).
4. The internal pilot with made-up data has run and no kill rule fired (V-16, `docs/study/pilot-script.md`).
5. Written permission from the CMAI's author (P-01).

## What Devin should check before taking this to Dr. Gupta

- [ ] The manual's p.7 says what sections 1 and 3 say it does: the 1-point standard and the 88% figure.
- [ ] The four _abstract only_ sources, in full text.
- [ ] Section 4 has been seen by someone who can size a sample.
