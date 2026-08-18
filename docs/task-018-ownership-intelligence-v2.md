# Task 018 — Ownership Intelligence V2

Turns existing CMS ownership, chain, and CA/NY/TX licensee/operator evidence into consumer-readable facility summaries and published organization portfolio pages. No Secretary of State scrape. No beneficial-owner research. No owner score.

## Entity semantics

Roles stay distinct:

- CMS owner / indirect owner
- managing organization
- state operator
- state licensee
- CMS chain / common-control group

A facility may have a chain, a legal owner, and an operator at the same time. Those labels are never collapsed.

Organizations are resolved only through existing CMS `organization_id` values (PAC / enrollment identifiers). Compatible punctuation (`LLC` vs `L.L.C.`) is allowed. Different legal names are not merged.

## Resolution rules

Consumer publication uses only **VERIFIED** relationships created from authoritative CMS organization identifiers.

| State                 | Consumer use                                             |
| --------------------- | -------------------------------------------------------- |
| VERIFIED              | Eligible for portfolio membership and pages              |
| PROBABLE              | Not published                                            |
| REVIEW_REQUIRED       | Not published (generic, person-like, or ambiguous names) |
| REJECTED / UNRESOLVED | Not published                                            |

Fuzzy-name-only matching never creates portfolio membership.

## Current vs historical

- **Current:** the facility appears in the latest successful CMS ownership release for that organization.
- **Historical:** older successful releases only. Shown separately. Not counted in portfolio metrics.
- **Uncertain:** no latest or older successful-release evidence.

Sequential file appearance is not treated as an acquisition.

## Organization publication

A consumer page exists only when:

- the organization has a CMS `organization_id`
- resolution is VERIFIED
- the display name is not generic or person-like
- at least **3 current** connected facilities exist

Those pages are indexable. Thin or ambiguous organizations stay unpublished (404), not noindexed thin URLs.

Route: `/ownership/[organization-id]/[slug]`

## Portfolio metrics

Precomputed in `ownership_portfolio` / `ownership_portfolio_member` (migration 0019).

National comparisons use CMS evidence only:

- rating averages and 1–5 distribution from valid ratings
- RN / total nurse HPRD when at least 3 observations exist
- facilities with any recorded CMS monetary penalty, plus total fines
- facilities with a CMS penalty, high-value CMS enforcement ($10,000+ or payment denial), or CMS complaint inspection in the last 18 months

Missing ratings are omitted, never treated as 0. CA/NY state enforcement counts may appear as labeled state evidence and are not mixed into national CMS averages.

## State corroboration

If a CMS organization name is exactly compatible with a VERIFIED CA/NY/TX operator or licensee, the facility page may show **Supported by multiple government sources**. Google is not used.

State licensee/operator text does not overwrite CMS ownership.

## UX

Facility **Ownership & Operation** is a compact summary: ownership type, operator, licensee, chain, related-facility count, recorded ownership changes, and a link to the organization page when published. The existing Ownership section keeps the full CMS party list.

Organization pages include a snapshot, searchable/sortable current facilities, historical members or CHOW events when supported, and sources/methodology. No relationship graph.

Facility History ownership-change events continue to link to `#ownership`.

## QA

Audit after backfill:

- organization resolution for representative multi-facility orgs
- facility-to-organization current membership
- portfolio metrics versus underlying facility rows

A facility attached to the wrong organization is a critical error.

## National coverage

Backfill command: `care-ingest derive-ownership-portfolios`

Uses existing database rows only. No external API requests. Upserts by fingerprint. Second unchanged run inserts 0.

National result after the first production backfill:

- 104,634 VERIFIED organization entities
- 4,472 organizations with ≥2 current facilities
- 3,149 organizations with ≥3 current facilities
- 3,130 published / indexable organization pages
- 9,355 facilities linked to a published ownership organization
- 10,116 facilities with a CMS chain
- average 12.1 / median 6 current facilities per published organization
- 667 REVIEW_REQUIRED organizations kept off consumer pages
- 14,693 canonical facilities and unique CMS CCNs unchanged

## Performance

Page reads use the derived tables, not a scan of raw ownership rows. Indexes cover organization id, publication, and current membership.

## Deployment

Flag: `CARE_ENABLE_OWNERSHIP_INTELLIGENCE_V2` (fail-closed; also requires real-provider and ownership flags). Disabling V2 leaves the original facility Ownership section in place.

Apply migration `0019_ownership_portfolio.sql`, run the backfill, then deploy.

## Limitations

- No Secretary of State or beneficial-owner graph.
- Historical membership is file-recency, not a reconstructed transaction history.
- TX state licensee/operator remains unpublished from the unsafe Excel mapping.
- Generic or person-like organization names stay off consumer pages even if they have many facilities.
