# Task 022B.2 — Assisted living consumer launch

Public CA / NY / TX assisted-living research. Not national coverage.

Google Places API requests: **0**

## Live routes

- `/assisted-living`
- `/assisted-living/california`
- `/assisted-living/new-york`
- `/assisted-living/texas`
- `/assisted-living/{ca|ny|tx}/{uuid}/{slug}`

## Public provider counts

Discovery-eligible universe from 022A persist (database truth unless later source refresh):

| State | Discovery-eligible | Explicit memory |
| ----- | -----------------: | --------------: |
| CA    |              7,962 |               0 |
| NY    |                529 |             212 |
| TX    |              1,996 |             732 |
| Total |             10,487 |             944 |

## Status handling

CA licensed public. CA probation public with visible regulator status. CA closed/pending excluded. NY/TX use directory listing language only.

## Memory-care counts

NY 212 SNALR/Dementia. TX 732 Alzheimer certificate. CA none in the official listing.

## Integrations

- Homepage compact entry
- Navigator → `/assisted-living` when AL/memory is suggested (no health answers transferred)
- Cost Planner → Research providers (no dollar transfer)
- Interview Builder `?al=` with official type, capacity, regulator, explicit memory, probation
- Family Workspace typed `cms` / `assisted_living` identities; legacy CCN shortlists migrate

## Sitemap / indexation

Indexed: search hub, three state pages, discovery-eligible provider pages. Search-result query permutations stay `noindex`. Sitemap files `assisted-living-N.xml` include only `PUBLISHABLE_CURRENT` and `PUBLISHABLE_WITH_STATUS`.

Structured data is LocalBusiness name/address/url only. No ratings, reviews, prices, or hours.

## Workspace migration

`parseFamilyWorkspace` accepts legacy `{ccn}` entries as `kind: cms`. Assisted-living IDs are UUIDs and never stored as CCNs.

## Smoke tests

Covered by unit/selector tests plus production smoke after the flag is enabled: search, state pages, licensed/probation/NY memory/TX Alzheimer, Navigator/Planner/Interview/Workspace, sitemap, CMS 14,693 unchanged.

## Google safeguard

**Google Places API requests: 0**
