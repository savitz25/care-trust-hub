# Task 019B.2 — Senior Care Cost Planner launch

Consumer UI over `senior-care-cost-planner-v1`. Educational planning only.

Route: `/tools/senior-care-cost-planner`

Flag: `CARE_ENABLE_SENIOR_CARE_COST_PLANNER` (fail-closed).

## UX

Users pick one or more scenarios, then see only the relevant inputs:

- Home care: hours/day, days/week, published or custom hourly rate
- Assisted living: published monthly median, optional add-on and entrance fee, or custom monthly
- Memory care: user-entered monthly amount only
- Skilled nursing: semi-private or private, published daily median or custom
- Short-term rehab: Medicare context plus optional expected planning amount

Comparison table shows gross monthly, gross annual, and remaining monthly after user-entered support. Print / Save PDF uses the browser print view.

## Benchmark integration

Published values, year, source, and geography notes come from 019B.1. Custom rates are labeled as user-entered. Break-even hours/week appear when home care and assisted living are both selected.

## Privacy

No login, lead form, or persisted finances. Coarse scenario selection may be stored in `sessionStorage` when arriving from the Navigator. Dollar amounts are not placed in URLs or analytics.

## Payer safety

No Medicare/Medicaid/VA/LTC eligibility or coverage determination. Support fields accept only known amounts the user types.

## Navigator integration

Navigator results can open the planner with coarse setting names only. The planner links back to the Navigator. No health answers are transferred.

## Facility-search bridge

Skilled nursing or rehab in the comparison can continue to `/search`. Assisted living and memory care do not use that directory as if it covers those settings.

## Tests

Feature flag, comparison, 24-hour warning, memory-care custom amount, SNF search bridge, custom rate, LTC remaining floor, and Navigator mapping.

## Deployment

Enable the flag in Vercel Production and Preview, then redeploy if the first build started before the variable existed.

## Google safeguard

No Places adapter or enrichment.

Google Places API requests: 0
