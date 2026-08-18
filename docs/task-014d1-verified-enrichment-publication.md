# Task 014D.1 — Publish Verified Facility Enrichment

Safely expose field-level `VERIFIED` public contact facts on facility pages. CMS remains the canonical federal record. Resolver V2.2 is unchanged. No additional Google requests were made.

## Publication rule

Only publication-eligible, field-level `VERIFIED` claims may appear on consumer pages.

The consumer query layer (`getPublishedFacilityEnrichment` + `selectPublishedFacilityEnrichment`) enforces this. UI code cannot publish a `PROBABLE`, `REVIEW_REQUIRED`, `UNRESOLVED`, or `REJECTED` claim. A VERIFIED Place identity never promotes an unpublished field.

Migration `0014_publish_verified_consumer_enrichment.sql` adds read-only view `published_facility_claim`. `facility_claim` is append-only, so 014D.1 does not rewrite historical rows. The view and consumer selector expose only current `VERIFIED` website, phone, and public-name claims. Identity, address, and business-status claims stay internal.

## Published fields

- Official website (`google_official_website`) when the URL is HTTPS and not a directory, lead-gen, social, or unknown host
- Public phone (`google_public_phone`) when independently VERIFIED
- Public alias (`google_public_name`) only when identity is VERIFIED and the name is meaningfully different from the CMS name

## Excluded

- Google Place IDs
- Google business status / open-closed
- Google address (CMS address remains primary)
- Ranking, Trust Scores, and search sort changes
- REVIEW_REQUIRED (~4,216), PROBABLE (36), and UNRESOLVED (13) identities

## UX

Facility page Contact section: CMS phone first; a distinct verified public phone if present; “Visit facility website”; “Also known publicly as” when useful. Provenance line: `Verified public information · checked Mon YYYY`. Sources register lists the commercial corroboration without exposing Place IDs or making Google branding dominate.

## Provenance

Sources remain the detailed destination. Published fields carry source class (commercial corroboration), retrieval/resolution time, claim type, and VERIFIED status. Internal confidence algorithms are not shown.

## QA

Targeted automated coverage: VERIFIED website/phone appear; REVIEW/PROBABLE/unpublished do not; Place IDs and business status stay hidden; CMS name/CCN unchanged; search ranking SQL does not join enrichment.

`npm run check` passed after implementation.

Readily available publication counts from `published_facility_claim`:

- facilities with a VERIFIED website: 271
- facilities with a VERIFIED phone: 12,433
- facilities with a VERIFIED public name: 11,102 (shown only when the name differs from CMS)
- internal Place ID / business-status / address claims on the view: 0
- canonical facilities / unique CCNs: 14,693 / 14,693

## Deployment

Migration 0014 applied as a read-only view. Kill switch: `CARE_ENABLE_VERIFIED_ENRICHMENT=false`.

## Known review queue

About 4,216 REVIEW_REQUIRED facilities continue to show CMS-only information. Later state-regulatory work may resolve many of them.
