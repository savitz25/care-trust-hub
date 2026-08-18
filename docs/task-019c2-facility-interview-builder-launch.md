# Task 019C.2 — Facility Tour & Interview Builder launch

Consumer UI over `facility-interview-builder-v1`.

Route: `/tools/facility-tour-interview-builder`

Flag: `CARE_ENABLE_FACILITY_INTERVIEW_BUILDER` (fail-closed, independent of Navigator, Cost Planner, and facility-evidence flags).

## UX

Two short steps, then a checklist:

1. Care setting: skilled nursing, short-term rehab, assisted living, memory care, or home-care agency
2. Optional priorities such as staffing, falls, memory, medications, rehab, communication, meals, cost, inspections, and ownership
3. Generated checklist grouped as Must ask, Important follow-ups, and Additional questions

Users can check questions off, expand Why ask?, hide questions and restore them, and keep optional notes in the current browser. Checking boxes does not create a score.

## Entry modes

- General checklist: no database read
- Specific CMS nursing facility: `?ccn=` from the facility page only. Assisted living, memory care, and home-care stay general and disclose the lack of national provider evidence.

Facility-specific URLs canonicalize to the base tool and are noindex.

## Facility evidence

Facility mode consumes published CMS identity plus published Facility History and, when Ownership V2 is on, a published organization facility count. Triggers reuse the 019C.1 engine. Evidence links return to SeniorTrustHub staffing, inspections, penalties, history, ownership, or state-license sections.

Never uses REVIEW_REQUIRED, PROBABLE, unpublished Texas fields, or Google claims.

## Privacy

No account, lead form, email, diagnosis, or saved health/finance profile. Checkmarks, hidden questions, and notes stay in `sessionStorage`. Concern tags and notes are not sent to analytics (`PrivacyAnalytics` also strips query strings).

## Print

Print / Save PDF uses the browser print dialog and includes the facility or care setting, questions, Why ask, evidence references, blank note lines, generation date, and the SeniorTrustHub disclaimer.

## Tool integrations

- Facility page: **Build questions for this facility →** with CCN only
- Care Needs Navigator: **Build questions to ask providers →** transfers a coarse care setting only
- Cost Planner: **Questions to ask about pricing and fees →** may preselect cost/contracts; no dollar amounts
- Homepage compact entry when the flag is on
- Search cards are unchanged

## Tests

Domain A–J, feature-flag isolation, generic and facility-specific UI, hide/restore, Navigator and Cost Planner bridges, facility CTA, and source scans for Google / lead capture / scores.

## Deployment

Enable `CARE_ENABLE_FACILITY_INTERVIEW_BUILDER=true` in Vercel Production and Preview, then redeploy if the first build started before the variable existed.

## Google safeguard

The Builder does not call Places Text Search, Place Details, enrichment refresh, or Place ID resolution.

Google Places API requests: 0
