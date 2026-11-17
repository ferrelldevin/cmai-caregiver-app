# Made-up sample exports (research export contract v1.0.0)

Made-up data only. Six participants, `data_class: "synthetic"`, item numbers only. Made by running the real export code on fake logs; nothing here was written by hand. Register F-56, design note 018. Status: assumed, sign-off pending (Dr. Gupta).

## How they were made

- Seeder: [seed-samples.ts](./seed-samples.ts). Fixed seed `20261117`. Run: `WRITE_SAMPLES=1 npx vitest run tests/researchExport.test.ts` (rewrites these files); a normal `npm test` fails if any file differs from what the seeder makes.
- Participants P-DEMO-A to P-DEMO-F, `tz_name: America/New_York`, local days 2026-10-25 to 2026-11-08 (14 days). The range crosses the 1 Nov 2026 clock change, so `utc_offset_min` goes from -240 to -300.
- `export-1/`: one file per participant, exported 2026-11-09T15:00:00Z. P-DEMO-C's first 4 days are "older logs": no install ID, so they carry the placeholder `00000000-0000-0000-0000-000000000000`.
- Then, with the app's own `editLog` and `deleteLog`, 2 logs were edited and 1 deleted for P-DEMO-A and for P-DEMO-B, and those two were exported again to `export-2/` (2026-11-09T17:00:00Z). Each re-export is a full snapshot: edited logs have `revision: 2`, the deleted one is a tombstone.
- Frequency, review flag and role are not stored by the app today. The seeder keeps them on the side and hands them to the export, so the file shows the contract's rated branch. The real "Export for research" action writes `frequency: null`, `rating_scale: "none"`, `reviewed: false` and role "caregiver".
- The app only lets "It stopped" set an end time on three behaviors. These samples give about 70% of logs an end time on any behavior, as the request asked. A real export will have far fewer.

## Counts and check output

Checks: schema validation (Ajv, draft 2020-12) in `tests/researchExport.test.ts`, and `python cmai_export_check.py <file> --data-class synthetic` (Python 3.11+, stdlib only), output below.

| File | Records | Active | Deleted | Placeholder install ID | Approximate time | Reader check |
| --- | --- | --- | --- | --- | --- | --- |
| `export-1/cmai-export_P-DEMO-A_2026-10-25_2026-11-08.json` | 79 | 79 | 0 | 0 | 13 | `OK: 1 file(s), 79 active record(s) after merge` |
| `export-1/cmai-export_P-DEMO-B_2026-10-25_2026-11-08.json` | 58 | 58 | 0 | 0 | 11 | `OK: 1 file(s), 58 active record(s) after merge` |
| `export-1/cmai-export_P-DEMO-C_2026-10-25_2026-11-08.json` | 36 | 36 | 0 | 8 | 5 | `OK: 1 file(s), 36 active record(s) after merge` |
| `export-1/cmai-export_P-DEMO-D_2026-10-25_2026-11-08.json` | 26 | 26 | 0 | 0 | 3 | `OK: 1 file(s), 26 active record(s) after merge` |
| `export-1/cmai-export_P-DEMO-E_2026-10-25_2026-11-08.json` | 16 | 16 | 0 | 0 | 1 | `OK: 1 file(s), 16 active record(s) after merge` |
| `export-1/cmai-export_P-DEMO-F_2026-10-25_2026-11-08.json` | 8 | 8 | 0 | 0 | 1 | `OK: 1 file(s), 8 active record(s) after merge` |
| `export-2/cmai-export_P-DEMO-A_2026-10-25_2026-11-08.json` | 79 | 78 | 1 | 0 | 13 | `OK: 1 file(s), 78 active record(s) after merge` |
| `export-2/cmai-export_P-DEMO-B_2026-10-25_2026-11-08.json` | 58 | 57 | 1 | 0 | 11 | `OK: 1 file(s), 57 active record(s) after merge` |

Edit and delete, both files of a participant checked together (edit wins, deleted record gone):

- P-DEMO-A: `OK: 2 file(s), 78 active record(s) after merge`
- P-DEMO-B: `OK: 2 file(s), 57 active record(s) after merge`
