# Task 016 — National Facility History & Timeline

Derived a CARFAX-style facility timeline from CMS evidence SeniorTrustHub already stores. No new external sources. No scores.

## Event model

Append-only `facility_history_event` plus read view `published_facility_history_event`. Events are deterministic, fingerprinted, and publication-eligible by derivation version `facility-history-v1`.

Each event has type, family, date, date precision/basis, importance (HIGH/MEDIUM/LOW), title, summary, optional previous/new values, source locator, and an evidence link to an existing page section.

State event types are reserved for Task 017 and are not derived now.

## Derivation rules

- **Ratings:** only when two valid 1–5 observations from successive Provider Information releases differ. The warehouse currently has one snapshot release, so **0 rating events**. Missing ratings never become 0.
- **Staffing:** consecutive PBJ quarters. Material if |Δ| ≥ 0.20 HPRD, or |Δ| ≥ 0.10 and ≥ 10% of the prior value. Tiny rounding changes are suppressed.
- **Inspections:** one event per survey. Routine Fire Safety Standard surveys are omitted. Deficiencies are summarized onto the inspection, not listed individually. Higher-severity (G–L) findings make the event HIGH.
- **Penalties:** one event per CMS fine or payment denial. Amounts are preserved. Fines ≥ $10,000 and payment denials are HIGH.
- **Ownership:** one event per provider/date/change type. Personal names are omitted. Organization names appear only when the source name looks like an entity.

Reruns use `ON CONFLICT (fingerprint) DO NOTHING`.

## UX

Facility pages add **Facility History** with:

- a deterministic **What changed recently?** summary (or a neutral empty state)
- All / Ratings / Staffing / Inspections / Enforcement / Ownership filters
- year groups, newest first
- 12 events by default, with “View more”

The previous thin regulatory chronology is hidden when this section is published. Canonical facility URLs are unchanged.

## Kill switch

`CARE_ENABLE_FACILITY_HISTORY=true` plus the real-provider UI flag. Missing values fail closed.

## National backfill

|                          |   Count |
| ------------------------ | ------: |
| Facilities with ≥1 event |  14,693 |
| Total events             | 147,396 |
| Rating                   |       0 |
| Staffing                 |  20,265 |
| Inspection               | 105,792 |
| Enforcement / penalties  |  16,166 |
| Ownership                |   5,173 |

Idempotent second run inserted 0 rows. Canonical facilities / CCNs remain 14,693 / 14,693. Google and state claims were unchanged.

## Next

**Task 017 — State Enforcement & Inspection Intelligence.** Do not start it here.
