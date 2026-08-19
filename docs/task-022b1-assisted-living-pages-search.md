# Task 022B.1 — Assisted living pages and search

Consumer pages and search for the CA / NY / TX assisted-living universe. Production flag remains a launch decision for 022B.2.

Google Places API requests: **0**

## Routes

- `/assisted-living` — search
- `/assisted-living/[state]/[provider-id]/[slug]` — published provider page using the internal UUID
- State landings are `/assisted-living/california`, `/new-york`, `/texas` (022B.2)

Flag off: all routes `notFound()`, no homepage CTA.

## Page fields

Official name, city/state, consumer category, official regulatory type, regulator, license/facility ID, licensed capacity, regulator-reported status only when the source supports it, organization roles, dataset, retrieval date, official source link.

No CMS stars, Trust Score, inspection score, or Google rating.

## Search filters

State, city, ZIP, consumer category, explicit memory/dementia designation. Deterministic name sort. Paginated (20). No radius / Google geocoding.

## Status handling

- CA LICENSED: normal discovery
- CA ON PROBATION: public with **Regulator status: On Probation**
- CA CLOSED / PENDING: no page, no search
- NY: “Listed in the current NYS DOH Adult Care Facility dataset.” No invented Active/Licensed
- TX: “Listed in the current HHSC Assisted Living Facility directory.”

## Memory-care logic

Shown only for explicit regulator designations. Names are never used. CA remains `not_reported`.

## Data-gap disclosure

Inspection and enforcement history is not yet integrated. Absence is not a clean record.

## QA

Selector tests cover flag-off, closed/pending hidden, memory filter SQL, and no Google tables.

## Google safeguard

**Google Places API requests: 0**
