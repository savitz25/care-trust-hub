# Task 019C.1 — Interview question engine

Domain-only personalization engine for the Facility Tour & Interview Builder.

Version: `facility-interview-builder-v1`

No public route. No Google Places usage. No facility/interview/tour score.

## Library

`packages/domain/src/interview-questions.ts`

Each question has an id, care settings, category, text, why-ask, optional follow-up, concern tags, default priority, and optional published-evidence trigger.

Settings: skilled nursing, short-term rehab, assisted living, memory care, home-care agency.

## Builder

`packages/domain/src/interview-builder.ts`

`buildInterviewChecklist()` returns 12–25 questions in Must Ask / Important / Optional groups. Concern tags rerank; they do not diagnose.

Facility-specific SNF/rehab mode consumes a published evidence DTO only. `deriveFacilityInterviewEvidence()` maps already-published history events, a CMS staffing rating, and an optional current organization facility count into conservative triggers:

- material staffing decline
- CMS staffing rating 1–2 (not “understaffed”)
- recent inspection with recorded deficiencies
- recent CMS penalty
- recent ownership change
- multi-facility organization (count ≥ 3)
- published CA/NY state enforcement or NY complaint inspection

Missing, unpublished, PROBABLE, REVIEW_REQUIRED, Texas-unsafe, and Google claims do not create a concern. One regulatory event yields one question, not a pile of accusations.

Assisted living, memory care, and home-care checklists stay general and disclose the lack of national provider evidence.

## Tests

`packages/domain/src/interview-builder.test.ts` covers cases A–J plus derivation and copy safety.

## Next

Task 019C.2 launches the consumer route on this engine.
