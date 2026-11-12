# AI-use ledger

Running record of which AI service did which job on this project, for Dr. Gupta and for Devin's own reference. One line per job. Anything not confirmed is marked "not recorded".

**Rule (Devin, 2026-11-11; P-14, proposed, assumed, sign-off pending):**

- Only code and made-up data may leave Devin's computer. Never CMAI item wording, never real participant data.
- Code reviews and second opinions go to Codex or Grok first. Bulk mechanical edits go to local Ollama. Claude writes and verifies.
- Every outside finding is checked before anything changes.

| Date       | Task                                                                            | Service | Model                      | Why                                        |
| ---------- | ------------------------------------------------------------------------------- | ------- | -------------------------- | ------------------------------------------ |
| 2026-11-10 | Master plan v5: research and design                                             | Claude  | Fable 5.2                  | Planning and design                        |
| 2026-11-10 | Lab readiness documents and lab database frame (PR #46)                         | Claude  | Opus                       | Long, careful drafting with sources        |
| 2026-11-10 | Fixes, checks and the merge run                                                 | Claude  | Sonnet                     | Routine work on the cheaper model          |
| 2026-11-10 | New screens, sign-in, caregivers and watching-hours builds                      | Claude  | Not recorded               | Model followed Devin's default at the time |
| 2026-11-10 | Repo rename and portfolio copy                                                  | Claude  | Not recorded               | As above                                   |
| 2026-11-10 | Project chat: routing, status, the For you page                                 | Claude  | Fable 5.2                  | Coordination                               |
| 2026-11-10 | Review of `src/scoring/engine.ts`: found two edge cases, each checked by Claude | Codex   | OpenAI, model not recorded | Independent second opinion on code         |

Grok, Antigravity and local Ollama are set up and have had no jobs yet.

Rule going forward: each thread adds a line when it sends a job to a service. This file is the source; the project copy is refreshed from it.
