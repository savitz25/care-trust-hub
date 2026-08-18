# Task 019A — Senior Care Needs Navigator

Educational tool that helps a family understand which senior-care settings may be worth investigating. It does not diagnose, determine medical necessity, or place anyone.

## Purpose

Move from “research a facility” to “what kind of care should we look into?” Answers stay in the browser. No account, lead form, or health-profile database.

Route: `/tools/care-needs-navigator`

Flag: `CARE_ENABLE_CARE_NEEDS_NAVIGATOR` (fail-closed, independent of facility-evidence flags).

## Question domains

About 17 required questions in five steps:

1. Daily activities
2. Mobility and safety
3. Memory and supervision
4. Medical and rehabilitation needs
5. Caregiver support

Optional strain and overnight-availability follow-ups appear only when relevant.

## Decision logic

Version: `care-needs-navigator-v1`

Answers become a descriptive need profile (ADL, mobility, cognition, clinical, rehab, medications, caregiver, overnight). Deterministic rules assign each setting an alignment:

- Strongly worth investigating
- May be appropriate
- Could remain an option
- Less aligned with the needs described

Multiple settings can qualify. Missing and Not sure answers are never treated as yes or severe. Hospitalization alone does not imply inpatient rehab. One weak ADL signal does not imply skilled nursing.

## Result settings

Aging in place, non-medical home care, home health, assisted living, memory-supportive care, skilled nursing, and short-term rehabilitation.

Each result shows why it may fit, what it provides, what it does not provide, and questions for professionals.

## Privacy

Answers live only in the current page session. They are not written to the database, local storage, or a shareable URL. No name, date of birth, diagnosis list, insurance, phone, or email is collected. Vercel Analytics already strips query strings. The Navigator does not send answer payloads to analytics.

## Clinical limitations

Not an emergency triage tool. An immediate-safety answer shows guidance to seek emergency or professional help. Home-health eligibility is left to clinicians and payers.

## SNF research bridge

When skilled nursing or short-term rehab is aligned, results link to existing `/search`. SeniorTrustHub covers 14,693 CMS-certified nursing facilities. The tool does not choose a medically appropriate facility.

## Assisted living / memory care

No fabricated directory. Those results explain the setting and state that national evidence coverage is not built yet. They do not send users into SNF search as if it covered those settings.

## QA

Seven personas are locked in domain tests. UI tests cover start, independent / ADL / memory / skilled-nursing paths, and the search bridge.

## Deployment

Enable the flag in Vercel Production/Preview after CI passes. Disabling it 404s the route and removes homepage promotion.

## Google API cost safeguard

The Navigator module and UI import no Google Places adapter, make no server enrichment calls, and do not require `GOOGLE_PLACES_API_KEY`.

Google Places API requests: 0
