# Task 021B — Assisted living pilot ingestion

Pilots from 021A: **California, New York, Texas**.

No public pages. No `/search` or sitemap changes. Flag `CARE_ENABLE_ASSISTED_LIVING_INTELLIGENCE` remains off. No production migration was applied.

## Sources

- CA: CDSS CCL RCFE CSV on CHHS Open Data
- NY: Health Data NY HFIS General Information + Certification Information (Adult Home, Enriched Housing Program)
- TX: HHSC Directory of Assisted Living Facility Providers (al.xlsx)

Google Places API requests: 0

## Coverage

Retrieved 2026-08-19. Full machine report: `docs/task-021b-coverage.json`.

| State |    Raw | Canonical | VERIFIED | Review |                      Active / listed | Closed |           Memory explicit | Publication-eligible |
| ----- | -----: | --------: | -------: | -----: | -----------------------------------: | -----: | ------------------------: | -------------------: |
| CA    | 12,522 |    12,522 |   12,522 |      0 |                       7,939 licensed |  3,821 |                         0 |               12,522 |
| NY    |    529 |       529 |      529 |      0 |                   status not in HFIS |      — |        212 SNALR/Dementia |                  529 |
| TX    |  1,996 |     1,996 |    1,996 |      0 | 1,996 licensed (directory is active) |      — | 732 Alzheimer certificate |                1,996 |

Totals: 15,047 canonical providers. Second unchanged parse: **idempotent**.

## Identity

`STATE:REGULATOR:SOURCE_FACILITY_ID`. CA Facility Number, NY Facility ID, TX Facility ID. Duplicate CA numbers collapse to one provider. Name-only rows cannot verify.

## Memory care

- CA: `not_reported` (no official dementia column in the RCFE listing)
- NY: SNALR or Dementia bed attribute → explicit memory/dementia license (212)
- TX: Alzheimer Certificate Number → specialty endorsement (732)

No name inference.

## Organizations

CA: licensee + administrator. NY: operator. TX: owner (source label), administrator, management company. Roles are not flattened.

## Enforcement

Deferred. CCLD/TULIP/NY surveillance are not a single ID-safe extract. No events forced.

## QA

Automated identity gates plus fixture cases (duplicate CA ID, NY SNALR, TX Alzheimer certificate, name-only rejection). Critical wrong-facility assignments: **0** — every VERIFIED row keeps the official source ID.

## Existing CMS safety

CMS 14,693 / unique CCN universe is unused by this adapter. No merge by address or brand.

## Next

Ready for Task 022 publication. Do not begin it here.
