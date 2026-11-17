# 020. Getting logs to the lab every day: the sync design (G12, design only)

2026-11-17 · Status: design only, nothing built · Stop: any server or account the lab has not provided · Decision needed from Dr. Gupta (below)

## The answer to the first question

**The logs live only on the phone or browser.** Checked in the code on 2026-11-17:

- Storage is IndexedDB through Dexie (`src/data/db.ts`). No other store.
- No network call in `src/`: no `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` or `EventSource` (searched).
- The built page's Content-Security-Policy is `connect-src 'self'` (`vite.config.ts`), so the page cannot send data to another site even if code tried.
- The app is a static site on GitHub Pages. It has no backend, no accounts and no server.
- Data leaves a phone only when a person saves a file: the backup (JSON), the CSVs and the new research export.

So an automated daily pull has nothing to pull from. A scheduled task on the lab desktop cannot reach a phone's IndexedDB.

## Options

| #   | Option                                                                                                                                                                                               | Needs                                                 | Caregiver burden                                    | Verdict                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| A   | Manual: a lab person opens the app, runs Export for research, moves the file to the lab desktop (cable or lab-approved transfer)                                                                     | Nothing new                                           | None (the lab person, not the caregiver)            | Works today, with made-up data only. Not automatic   |
| B   | Synthetic feed for the pipeline: a script on the lab desktop runs the app's real export on seeded made-up data (the same code as the samples) so the 7:15 task and the merge can be tested every day | Nothing new (Node and the repo)                       | None                                                | Recommended now. Tests the whole path with no server |
| C   | Push: the app sends the same v1.0.0 file to a lab-run store, then the lab's daily task reads from that store                                                                                         | A lab server or store, keys, a CSP change, IRB answer | None if automatic, but needs a signal at some point | The real answer. **Stop**: not provided              |
| D   | Lab-provided existing store (REDCap or the lab database, P-13) instead of a new server                                                                                                               | The lab's decision and an account                     | None                                                | Same as C with less to run. **Stop**                 |
| E   | Personal cloud drive or personal accounts                                                                                                                                                            | A personal account                                    | None                                                | **Rejected**: lab work stays on lab or ODU accounts  |

## Recommendation

1. **Now:** A for people, B for the pipeline test. Neither needs a server. B gives the 7:15 task a file every day to merge, so repeat pulls, edits arriving as revision 2 and tombstones are exercised for real, on made-up data.
2. **When the lab provides a store (C or D):** push, not pull. A phone is not a server, so the direction is app to store, then lab task from store.

## Shape of the push, for when it is approved

- **What is sent:** exactly the v1.0.0 file the manual action makes, one per resident and range, built by the same code. Nothing else.
- **Repeat sends are safe:** the reader keeps the newest `revision` per `record_id`; the same revision with the same content is ignored.
- **Keys:** one write-only key per install, so it can be revoked for one phone; one read-only key for the lab task. Neither key can do the other's job. Who holds them is Dr. Gupta's call.
- **Audit:** the store logs every write and every read: when, which key, which resident and range.
- **Real data:** refused at the app (`realExports` is off, G1) and again at the store, until Dr. Gupta says in writing where real data may land.
- **Page policy:** `connect-src` changes from `'self'` to `'self'` plus the one lab origin. That is a deliberate, reviewed change to the threat model (T6).
- **Offline:** a send queue on the phone, retried when there is signal. No tap from the caregiver.
- **Burden:** none added. Sending is automatic or done by the lab person.

## Decisions for Dr. Gupta

1. Will the lab provide a server or store for logs, and who runs it (a new server, REDCap, or the lab database)?
2. Where may real exports land, and who holds the keys (P-03, P-04)?
3. May a phone send data off itself at all in this study, even automatically (IRB)?
4. Who may run exports, and is the audit trail enough?
5. Until then: is option A or B acceptable for pipeline testing on made-up data?

## Done when (for a later build, not now)

Two pulls of the same made-up data merge to the same records with no duplicates, and an edit between pulls arrives as revision 2. Not started.
