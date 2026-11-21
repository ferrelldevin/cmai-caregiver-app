# Study protocol and analysis plan (draft)

Build plan step 3.9. Drafted by Claude on 2026-11-21 for Devin to take to Dr. Gupta. **Not sent, not registered, not approved.** Registering it or sending it is Dr. Gupta's call, through Devin. No real data is used or implied anywhere in this draft.

Why now: the claim the lab wants to make is that the app's rating agrees with a caregiver's own CMAI. That claim is only as strong as the plan written before the data exists. A plan written afterwards can be read to fit.

Everything here is **proposed**. Nothing is fixed until Dr. Gupta settles the blanks and the open questions, and that has to happen before any data is collected. Blanks marked **for Dr. Gupta** are his to fill. Sources marked _abstract only_ have not been read in full by anyone on the build; confirm them in the full text before this draft is cited.

## 1. Question

For the same resident and the same 14 named days, does the app's rating for each behavior fall within 1 point of a blind caregiver CMAI?

The 1-point standard is the manual's own measure of agreement between raters (CMAI Instruction Manual, Cohen-Mansfield 1991, p.7, as used in `docs/agreement/README.md`).

Not asked here: whether the app measures agitation better than the CMAI, whether it detects change sooner, or anything about sensors. Those are later studies.

## 2. Design

- **Who rates.** The caregiver who logged during the period. The app's own rating comes from that caregiver's logs by the written rule (`docs/scoring-spec.md`, `RULE_VERSION`), with no person in between.
- **When.** After each 14-day period ends, the caregiver fills the two-week rating in the app (F-47): all 29 behaviors, 1 to 7, with codes 8 and 9 where the manual allows them. It locks on submit. The form must name the period's start and end dates, so a rating filled a few days late is still about the same 14 days, not the 14 days before the day it was filled.
- **Blind to what.** The caregiver does not see the app's ratings before or while rating (D-24, assumed, sign-off pending). The app shows them nothing from the logs on that form.
- **Not blind to.** Their own memory of logging. The same person produces both numbers. This is the main weakness of the design; see section 6.
- **Stronger variant, for Dr. Gupta to decide (in or out, before the start):** a second informant who did not log also fills a paper CMAI for the same 14 named days. Then the app is compared with someone who never touched it. It is a separate comparison with its own analysis, and it has its own weakness: a person on another shift sees a different part of the resident's day, so some disagreement would not be the app's. If it is in, say who may be the second informant and how much of the period they must have seen.
- **Related work, not a model for this design.** Cohen-Mansfield and Libin 2004 compared informant ratings with direct observation by correlation ([DOI 10.1002/gps.1171](https://doi.org/10.1002/gps.1171); _abstract only_). The app's logs are caregiver-entered, not independent observation, and correlation is not agreement.

## 3. Measures

Proposed here; to be fixed before any data.

**Primary outcome.** Of all eligible item ratings (one behavior, one resident, one period; caregiver rating 1 to 7; period meets the coverage rule in section 5), the share where the app's rating is within 1 point of the caregiver's. Reported with a 95% interval from a bootstrap that resamples whole residents, so that 29 behaviors and several periods from one resident are not counted as independent. **For Dr. Gupta or a statistician:** whether each item rating counts equally (residents with more periods weigh more) or each resident counts equally.

**Pass mark: open (register F-70).** The build has used "88% or more" as the manual's inter-rater figure (p.7), and this draft first did too. The outside review of this draft reports that p.7 gives three figures from three nursing-home units, 92%, 92% and 88%. If so, 88% is the lowest of three observed results, not a standard. Nobody on the build has confirmed this in the manual. Two more reasons it is not settled:

- The same caregiver produces both numbers here, so they can agree more than two independent raters would. The inter-rater figure is not a ceiling for this comparison.
- A point estimate of 88% is weak evidence. A stricter rule is that the lower end of the 95% interval must clear the mark.

Dr. Gupta sets the mark and the rule, for the use the lab intends, before any data.

**Chance.** Most behaviors are rated 1 or 2 for most residents, and on such a scale two unrelated ratings are often within 1 point. So the primary outcome is always shown beside the share expected by chance from the two sets of ratings (the sum, over pairs of ratings within 1 point, of the app's share at one rating times the caregiver's share at the other). An overall pass says little about behaviors that are frequent for a resident; those are shown apart.

| Level               | Reported                                                                                                                                                                                                                                 | Notes                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| All behaviors       | The full 7 by 7 table of app rating against caregiver rating; exact agreement; within 1 point; differences of 3 or more                                                                                                                  | The table is the result. The percentages are summaries of it                                                  |
| Each behavior       | Within 1 point, and the spread of app minus caregiver                                                                                                                                                                                    | No pass mark per behavior                                                                                     |
| Each behavior       | Quadratic weighted kappa with a resident-bootstrap interval                                                                                                                                                                              | Unstable or undefined when nearly every rating is 1; reported as "not estimable" then, never dropped silently |
| By caregiver rating | Within 1 point for items the caregiver rated 1 to 2, 3 to 5 and 6 to 7                                                                                                                                                                   | Shows whether agreement holds where the behavior is frequent                                                  |
| Large misses        | Items the app rated 1 that the caregiver rated 5 or more, listed                                                                                                                                                                         | The error that matters most in use                                                                            |
| Total score         | Intraclass correlation, two-way, absolute agreement, single measure, form named as Koo and Li advise ([DOI 10.1016/j.jcm.2016.02.012](https://doi.org/10.1016/j.jcm.2016.02.012); _abstract only_), with the spread of total differences | Only for periods where both totals cover the same items; see section 5                                        |

Codes 8 (would occur if not prevented) and 9 (not applicable) have no count equivalent. Item ratings where the caregiver chose 8 or 9 are left out of the statistics above and reported in their own table, by behavior, because leaving them out could remove exactly the hard cases.

The code that computes within 1 point and the weighted kappa already exists for the story-based check (`docs/agreement/analyze.py`). The bootstrap, the chance figure and the tables above are not written yet. The scoring rule, the form and the analysis code are frozen, with their versions written down, before the first period starts.

## 4. Sample

| Quantity                | Number            | What sets it                                                                                                                                      |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Residents               | **for Dr. Gupta** | Ratings from one resident are not independent. The interval narrows mainly with residents, and depends on how alike one resident's ratings are    |
| Periods per resident    | **for Dr. Gupta** | At least 2, so a first period (learning the app) can be looked at beside a later one. That look is exploratory: residents and staffing change too |
| Caregivers per resident | **for Dr. Gupta** | 1 is the minimum. 2 allows the stronger variant in section 2                                                                                      |

For scale, and as arithmetic only: with 29 behaviors, 10 residents and 2 periods there are 580 item ratings, but the unit that matters is the resident. A statistician should set the number, for the interval on the primary outcome and allowing for left-out periods; this draft does not. Where the residents come from, who is eligible, and how caregivers are trained are also **for Dr. Gupta** and are not in this draft.

## 5. Missing data

Rules proposed here, to be fixed before any data.

- **Unlogged days are unknown, not zero** (D-11). The app never scales a count up.
- **A period is left out** of the primary outcome when fewer than **for Dr. Gupta** of its 14 days have a log or a "nothing to log" check-in. Proposed: fewer than 10. Left-out periods are counted and reported.
- **Watching hours** (F-38), where used, give the hours someone was actually observing. They are reported beside each period; they do not change a rating.
- **A rating not submitted** within **for Dr. Gupta** days of the period ending is missing. Proposed: 3 days, because the CMAI asks about the last two weeks and memory moves on.
- **Deleted logs** do not count. Every delete carries a reason and stays in the history.
- **Totals** are compared only for periods where the caregiver gave a 1 to 7 rating on all 29 behaviors. A total over fewer items is not the same score.
- No imputation. That is a choice, not a cure: left-out periods may be the busy ones where the app would disagree most. So every left-out resident, period and item is counted with its reason, the left-out periods are described beside the kept ones, and the primary outcome is also shown with the coverage rule at 7 and at 12 days.

## 6. Known biases

| Bias                                                              | How the design limits it                                                                                            | How it is reported                                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| The same person logs and rates, so the two numbers share a memory | Only the stronger variant in section 2, if Dr. Gupta includes it. Otherwise none                                    | Stated as the main limitation; agreement with a non-logging informant shown apart                       |
| Logging changes what a caregiver notices                          | None within this design                                                                                             | Stated. First period compared with later periods                                                        |
| A caregiver who sees ratings anchors on them                      | Ratings hidden until the form is submitted (D-24). Checking that this holds on the study build is a start condition | Any breach is recorded and that period reported apart                                                   |
| Severe episodes are logged late, because hands are busy           | A late log can be given its real time; the export marks it approximate                                              | The gap between `logged_at` and `occurred_at`, per behavior                                             |
| Busy shifts log less                                              | Check-ins and watching hours show coverage                                                                          | Agreement shown against days covered                                                                    |
| The count rule's bands were set by the build, not by a clinician  | D-01 and D-02 are open questions for Dr. Gupta                                                                      | `RULE_VERSION` is stamped on every export. Periods rated under different rule versions are never pooled |

## 7. Reporting

- Agreement studies: GRRAS, a guide to reporting, not to design ([DOI 10.1016/j.jclinepi.2010.03.002](https://doi.org/10.1016/j.jclinepi.2010.03.002); _abstract only_).
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

- [ ] The manual's p.7: is within 1 point its measure of agreement, and are its figures 92%, 92% and 88%? (F-70)
- [ ] The four _abstract only_ sources, in full text.
- [ ] Section 4 has been seen by someone who can size a sample.
