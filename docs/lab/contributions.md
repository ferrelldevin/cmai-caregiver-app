# Who did what, and how AI was used

Build plan step 3.11. Draft by Claude on 2026-11-21 from the repository's history. **Devin reads and corrects this before anyone outside the lab sees it.** It is not an authorship order and does not propose one.

Role names are the 14 [CRediT](https://credit.niso.org/) roles. A role is listed only where the repository or the project record shows it.

## People

| Person         | CRediT roles                                                                                               | What the record shows                                                                                                                                                                                                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Devin Ferrell  | Conceptualization, Methodology, Software, Validation, Project administration, Writing (review and editing) | Wrote the requirements and the study's rules (for example, locked ratings, design note 007). Decided every design question put to him (decision log in `docs/review-register.md`). Reviewed and merged the pull requests. Ran the checks on his own machines and the iPhone checks V-03 and V-11. Acting lead on the build |
| Dr. Ajay Gupta | _for Devin to fill in_                                                                                     | Principal investigator. Set the brief the app answers (README) and, in the project record, the direction to keep caregiver burden low. No sign-off is recorded in the register yet                                                                                                                                         |
| Shanmei Li     | _for Devin to fill in_                                                                                     | Teammate. Nothing in this repository is recorded under her name                                                                                                                                                                                                                                                            |

## Sources that are not ours

- The CMAI, its item names and rating anchors: © 1991 Jiska Cohen-Mansfield, used under non-commercial terms. See `NOTICE`. Written permission from the author is deferred until the lab adopts the app (P-01).
- Libraries and their licences: `package.json`, and the summaries in `docs/audits/`.
- Papers: `docs/research-notes.md`, each with its DOI and what it changed in the app.

## How AI was used

Counted on `main` on 2026-11-21: 525 commits. 417 were authored by the Claude coding agent and 103 by Devin (most of those are his merges of reviewed pull requests); 5 by Dependabot. Commit trailers name the model: Claude Sonnet 166, Claude Opus 85, Claude Fable 23.

| Kind of work              | What an AI model did                                                                                          | Who checked it, and how                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code                      | Claude wrote the application code, the unit tests and the browser checks from Devin's written requirements    | Every change went through a pull request with automated checks (lint, types, unit tests, browser checks, axe). Since 2026-11-17 each pull request also has a reviewer that is not its author: Codex, or a different Claude model when Codex is not available. Devin merges, or approves merging |
| Scoring rule              | Claude drafted `docs/scoring-spec.md` and `docs/test-cases.json` from the CMAI manual                         | Hand-worked cases and property tests in CI. The count bands and the meaning of rating 7 are open questions for Dr. Gupta (D-01, D-02). **Nobody with clinical standing has signed off the rule**                                                                                                |
| Literature scan           | Claude searched and summarized sources, most at abstract level, and said so                                   | Not yet checked against full texts (build plan 3.10). A number from the scan is not citable until that is done                                                                                                                                                                                  |
| Design and screens        | Claude drew the mockups and built the screens; Devin picked between options at each round                     | Devin's picks are in the decision log. No caregiver has tested the screens (V-09, V-12 are open)                                                                                                                                                                                                |
| Documents                 | Claude drafted the plans, design notes, data dictionary, threat model, data management plan and review packet | Devin reads them. Nothing has been sent to Dr. Gupta as of this date                                                                                                                                                                                                                            |
| Reviews by other services | Codex (OpenAI) reviewed diffs; each finding was checked against the code before any change                    | One line per job in `docs/lab/ai-use-ledger.md`. Only code and made-up data were sent; never CMAI item wording or participant data                                                                                                                                                              |

## What this means for a paper, poster or class

- Say AI was used, and how, wherever Dr. Gupta, a venue or ODU asks. This page is the source for that statement.
- An AI model is not an author. The people above answer for the work.
- This is lab work, not coursework. If any part becomes a class deliverable, that course's AI policy applies first.

## Not known from the repository

- What Dr. Gupta and Shanmei contributed outside it (meetings, direction, labeled data).
- Whether the lab or ODU needs a specific AI-use statement. Ask before the first submission.
