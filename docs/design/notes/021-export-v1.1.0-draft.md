# 021. Research export contract v1.1.0, draft for Devin's go (S6)

2026-11-17 · Register: F-60 (new), F-57 (folded in) · Status: DRAFT, not agreed, not built · Switch: none · Docs and a test only

## What this is

A draft of the next contract version, written so a reader can see exactly what would change before anyone builds it. **Nothing in the app writes v1.1.0 and the lab reader does not read it yet.** The lab sensor pipeline keeps using v1.0.0.

Files: `docs/contracts/cmai-export/cmai-export-1.1.0-draft.schema.json` and `example-export-v1.1.0-draft.json`. A test (`tests/contractV110Draft.test.ts`) keeps them honest.

## The rule it follows

A MINOR bump: **v1.0.0 plus optional fields only.** No field is renamed, removed or made required. Every committed v1.0.0 sample file passes the draft schema as it is. A reader that ignores unknown fields keeps working; the Python reader today does not (v1.0.0 closes every object), so it must be updated first.

## The five additions

| Where  | Field                 | Type                                                                                                       | What it fixes                                                                                                                             |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| record | `time_approximate`    | boolean                                                                                                    | The caregiver marked the time as a guess. Today a back-dated log looks exact to the sensor team.                                          |
| top    | `observation_windows` | list of `{start_utc, end_utc}`                                                                             | Stretches someone was watching (F-38, D-23). Without them a quiet day and an unwatched day look the same. Absent means unknown, not none. |
| header | `app_commit`          | 7 to 40 hex characters                                                                                     | Which build wrote the file, for repeating a result.                                                                                       |
| header | `rule_version`        | short code such as `cmai-count-rule-2`                                                                     | Which scoring rule the app used, so a rule change is never mixed with a data change.                                                      |
| record | `change_reason`       | one of the six G11 codes (wrong_time, wrong_item, duplicate, wrong_participant, entered_by_mistake, other) | Why the latest edit or delete happened. Absent on revision 1 and on restores. No free text.                                               |

`schema_version` accepts `1.0.0` and `1.1.0`. Anything else is refused.

## What each addition needs before it is real

- **`time_approximate`:** already stored (`approx`). The builder would write it. Cheap.
- **`change_reason`:** already stored in the history (F-59). The builder would write the latest one. Cheap.
- **`app_commit`, `rule_version`:** both known at build time. `RULE_VERSION` exists; the commit needs one build-time value.
- **`observation_windows`:** the app has watching hours (note 015). Needs a decision on which stretches count as watched, and the window logic is the one new thing to build and test.

## Not in this draft

- A per-record zone name taken at log time (F-58). `tz_name` stays the export-time zone with the stop-on-mismatch rule. That change is a storage change, separate.
- Frequency, review flag and role. They stay as in v1.0.0.

## Waiting on

Devin's go. After a yes: update the Python reader first, then the app builder, then the samples, then the lab switches the pipeline over. Dr. Gupta's sign-off still applies to the contract itself.
