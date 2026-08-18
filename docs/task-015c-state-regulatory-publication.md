# Task 015C — Publish Verified CA / NY / TX State Regulatory Intelligence

Safely expose field-level `VERIFIED` California, New York, and Texas license facts on existing facility pages. CMS remains the canonical federal record. Resolver V2.2 is unchanged. No additional Google requests or state ingestions were made.

## Publication rule

Only field-level `VERIFIED` CA/NY/TX state claims may appear on consumer pages.

A VERIFIED state facility identity does not publish every attached field. The consumer query layer (`published_state_claim` + `selectPublishedStateIntelligence`) enforces this. UI code cannot publish `PROBABLE`, `REVIEW_REQUIRED`, `UNRESOLVED`, or `REJECTED` claims.

A VERIFIED `STATE_LICENSE_ID` is required before any State License & Oversight section is shown.

`facility_claim` is append-only. Migration `0015_publish_verified_state_intelligence.sql` adds read-only view `published_state_claim`. Historical `publication_eligible=false` rows are not rewritten.

## Published fields

Where VERIFIED and present:

| Field                                 | CA             | NY                 | TX                        |
| ------------------------------------- | -------------- | ------------------ | ------------------------- |
| State license / operating certificate | yes            | yes                | yes                       |
| License status                        | yes, from CDPH | never manufactured | never manufactured        |
| License type                          | yes            | yes                | yes                       |
| State licensed capacity               | yes            | yes                | yes                       |
| Licensee                              | yes            | when present       | yes                       |
| Operator                              | —              | yes                | —                         |
| Administrator                         | yes, secondary | —                  | when present              |
| Management company                    | —              | —                  | when present and distinct |

## Semantic separation

CMS facility name, CMS certified beds, ownership, and chain stay federal evidence. State licensee, operator, management company, and licensed capacity stay state evidence. Those labels are never collapsed into owner, chain, or a generic verified status.

## UX

Eligible facility pages add **State License & Oversight** under the CMS facts strip. The section names the official regulator, stacks key/value facts, shows `State regulatory data · checked Mon YYYY`, and links to Sources plus the official state dataset.

Sources list the regulator, dataset name, retrieved date, state license identifier, and which published facts came from that source. Parser internals, resolver confidence, candidate tables, and run IDs stay hidden.

## Kill switch

`CARE_ENABLE_STATE_REGULATORY_INTELLIGENCE=true` is required in addition to the real-provider UI flag. Missing or any other value fail-closes. Disabling state publication does not affect CMS pages or Google verified enrichment.

## Excluded

- PROBABLE / REVIEW_REQUIRED / UNRESOLVED / REJECTED state identities
- New states, assisted living, inspection PDFs, and enforcement archives
- Ranking, sitemap, and canonical URL changes
- Automatic promotion of Google REVIEW_REQUIRED cases that now have VERIFIED state identity

## QA

Targeted automated coverage: CA VERIFIED fields appear; NY/TX status is not manufactured; operator and management company stay distinct; CMS name and certified beds stay labeled separately; unsupported states and unpublished identities return nothing; search ranking SQL does not join `facility_claim`.

`npm run check` passed after implementation.

Readily available publication counts from `published_state_claim` after applying migration 0015:

|                                               |    CA |  NY |    TX |
| --------------------------------------------- | ----: | --: | ----: |
| Unique facilities with a published license ID | 1,158 | 515 | 1,134 |
| License status                                | 1,158 |   0 |     0 |
| License type                                  | 1,158 | 525 | 1,134 |
| State licensed capacity                       | 1,158 | 525 | 1,134 |
| Licensee                                      | 1,157 |  51 | 1,133 |
| Operator                                      |     0 | 525 |     0 |
| Administrator                                 | 1,100 |   0 |    44 |
| Management company                            |     0 |   0 |    14 |

NY has 525 VERIFIED license-id claim rows on 515 unique CMS facilities. Ten providers have more than one append-only VERIFIED license-id claim; the read path publishes the latest field only. REVIEW_REQUIRED CA/NY identities are not provider-linked and therefore have no facility-page section.

Canonical facilities / unique CCNs remain 14,693 / 14,693.
