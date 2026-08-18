# Task 019B.1 — Senior Care Cost Benchmarks & Calculation Engine

Versioned planning math for 019B.2. Educational only. Not a quote, eligibility decision, or consumer UI.

Version: `senior-care-cost-planner-v1`

## Sources

Retrieved 2026-08-18.

| Setting                                         | Source                                                     | Year | Geography             | Unit                           | Value                                                    |
| ----------------------------------------------- | ---------------------------------------------------------- | ---- | --------------------- | ------------------------------ | -------------------------------------------------------- |
| Non-medical home care                           | CareScout 2025 Cost of Care Survey                         | 2025 | National median       | USD / hour                     | 35                                                       |
| Private-duty nursing in the home (context only) | CareScout 2025                                             | 2025 | National median       | USD / hour                     | 90                                                       |
| Adult day (optional aging-at-home add-on)       | CareScout 2025                                             | 2025 | National median       | USD / day                      | 95                                                       |
| Assisted living                                 | CareScout 2025                                             | 2025 | National median       | USD / month                    | 6,200                                                    |
| Memory care                                     | No distinct published national median in CareScout 2025    | —    | —                     | Custom monthly                 | User-entered                                             |
| Nursing home semi-private                       | CareScout 2025                                             | 2025 | National median       | USD / day                      | 315                                                      |
| Nursing home private                            | CareScout 2025                                             | 2025 | National median       | USD / day                      | 355                                                      |
| Medicare SNF cost-sharing                       | CMS 2026 Parts A & B fact sheet; Medicare.gov SNF coverage | 2026 | National program rule | Deductible / daily coinsurance | $1,736 Part A deductible; $0 days 1–20; $217 days 21–100 |

CareScout URL: https://investor.genworth.com/news-events/press-releases/detail/1054/carescout-releases-2025-cost-of-care-survey-results

CMS URL: https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles

2025 CareScout figures are labeled 2025. They are not relabeled as 2026.

## Geography

Requested metro or state → if no stored local/state median → national CareScout 2025 median.

This version stores national medians only. ZIP prices are not invented.

## Formulas

- Home care weekly = hours/day × days/week × hourly rate
- Home care monthly = weekly × (52 / 12)
- Home care annual = monthly × 12
- SNF monthly equivalent = daily × (365 / 12)
- SNF annual equivalent = daily × 365
- Assisted living monthly = base + optional care add-on
- Remaining planning amount = max(0, monthly − user-entered monthly support)
- Break-even hours/week = assisted-living monthly ÷ (home-care hourly × (52 / 12))

Consumer-facing money values round to the nearest dollar.

## Payer limitations

Medicare SNF amounts are published program rules. The engine does not determine eligibility or what an individual will pay. Medicaid, VA, and LTC insurance amounts are accepted only when the user enters a known figure. No spend-down or asset questions.

## Tests

Personas A–J, monthly conversion, overrides, add-ons, offsets, zero floor, break-even, geography fallback, and safety copy.

## Google API safeguard

No Places adapter, no enrichment jobs, no `GOOGLE_PLACES_API_KEY`.

Google Places API requests: 0
