# Task 014B — Facility Intelligence V2 Evidence & Identity Architecture

## Executive Summary

Task 014B adds the forward-only schema, deterministic resolver, source-adapter contract, Google Places request controls, review queue, audit history, and test foundation required for a deliberately adversarial Task 014C pilot. It does not perform enrichment, crawl websites, ingest state data, or create a consumer score.

CMS CCN remains the canonical identity for CMS-certified nursing homes. External identifiers and source statements are evidence linked to that identity; they cannot replace it. Observations are immutable statements from sources. Claims are separate, versioned resolution outputs supported or contradicted by observations. Only `VERIFIED` claims may be publication-eligible.

Migration `0012_facility_intelligence_evidence_identity.sql` is committed and validated in isolated PostGIS. It has not been applied to production in this task. Its production impact is inspected below. It performs a deterministic CMS-only identity backfill and resolves only source-lost leading-zero CCNs. No Google or website backfill is included.

## Existing Architecture Reviewed

- `provider` is the durable canonical entity. `provider_identifier` links issuer-scoped CMS CCNs and validity intervals; public facility routes use CCN, never slug, as identity.
- `source_dataset`, immutable `source_release`, `raw_object`, and `ingest_run` preserve source organization, release identifiers, checksums, retrieval/publication times, raw bytes, and transformation versions.
- `facility_snapshot` is an effective-dated CMS provider observation with source record locator, raw record, coordinates, and release/run foreign keys.
- `evidence_assertion` already distinguishes official, facility-reported, and derived assertions. Task 014B reuses that philosophy while adding typed identity observations and explicit claim resolution rather than replacing it.
- Inspections, deficiencies, penalties, PBJ staffing days/summaries, ownership facts, ownership changes/notices, chain snapshots/memberships, and provider context each preserve their source release and raw lineage.
- Ownership already separates `organization`, official `organization_identifier`, `ownership_party` person/organization, provider relationships, organization relationships, and changes. A party role is not a chain.
- CMS chain entities and memberships are source-defined and distinct from ownership organizations.
- Trust requests, provider context, overrides, status history, and audit events provide an existing append-only moderation precedent.
- Next.js reads bounded projections through server-only repositories. Python owns acquisition, validation, normalization, quarantine, and transactional promotion.
- Freshness selection is release-driven in existing repositories; Facility Intelligence adds centralized source/claim freshness policy rather than scattered constants.

## Final Evidence Architecture

The implemented flow is:

`CMS CCN → provider → source observation → identity candidate → resolution decision → canonical claim → superseding claim history`

The schema adds:

- bounded and resumable `facility_intelligence_run` plus an explicit requested-provider set;
- immutable `facility_source_observation` with typed name/address/phone/URL/location columns and flexible source-specific provenance;
- `facility_external_identifier` for provider, organization, or chain namespaces;
- immutable `facility_claim` and supporting/conflicting observation links;
- persistent `facility_identity_candidate`, including rejected candidates;
- persistent external request cache;
- review queue, append-only review actions, and append-only resolution audit events.

The schema is additive. It does not replace `evidence_assertion`, source releases, provider identifiers, ownership evidence, or chain evidence.

## Observation Model

`facility_source_observation` records source type and authority, source/record identifiers, observation type, structured value, normalized searchable value, typed name/address/phone/URL/location, observation/publication/retrieval times, source URL, release/run/raw lineage, provenance metadata, fingerprint, adapter version, status, and optional supersession link.

Rows are append-only by trigger. A correction or later retrieval inserts a new observation and may reference its predecessor; it never updates or deletes the prior statement. The uniqueness key combines source, record, observation type, release, and fingerprint for idempotency.

The Python `FacilitySourceObservation` and `FacilitySourceAdapter` contracts provide the extension point for CMS, state regulators, government entities, official websites, and commercial corroboration. Fingerprints are deterministic and adapter-version-sensitive.

## Claim Model

`facility_claim` stores claim type, structured and normalized values, optional resolved organization/external identifier, resolution state, internal confidence, method, reason, matching features, conflicts, threshold version, effective interval, resolver/version, review state, publication eligibility, and superseded claim.

Claims are append-only historical decisions. `facility_claim_observation` labels each linked observation as supporting or conflicting. An observation is evidence; it is not automatically a SeniorTrustHub claim. Database constraints permit publication only for `VERIFIED` claims.

The model supports names, license facts, website and phone roles, Google identity/status, address/geographic corroboration, operator/legal/management/parent identities, ownership and chain relationships, closure, and rename claims without forcing every claim type through one threshold.

## Identity Model

- CMS CCN stays in `provider_identifier` and is backfilled into `facility_external_identifier` as namespace `CMS`, type `CCN`, linked to the provider and a CMS observation.
- Google Place ID, state license, corporate registry ID, official domain, organization identifiers, and chain IDs use their own namespaces and validity intervals.
- Exactly one canonical target—provider, organization, or chain—is permitted per external identifier row.
- Identifier verification uses the same five explicit resolution states. `VERIFIED` requires a verification timestamp.
- Uniqueness includes namespace, type, normalized value, and validity start. It deliberately does not assume every identifier is timeless.

## Resolution States

- `VERIFIED`: deterministic or extremely high-confidence, conflict-free evidence; potentially publishable.
- `PROBABLE`: strong candidate below verified publication requirements.
- `REVIEW_REQUIRED`: ambiguity, missing decisive evidence, or an authority conflict.
- `REJECTED`: evaluated candidate that does not represent the canonical facility; retained to prevent repeated false matches.
- `UNRESOLVED`: no acceptable candidate.

The database enum, TypeScript domain type, candidate model, claims, external identifiers, reviews, and audit events use the same states. `PROBABLE` is never promoted to `VERIFIED` merely because it is the best available candidate.

## Matching Features

The transparent resolver accepts reconstructable features for CMS CCN, state license, full address, street number/name, city/state/ZIP, phone, facility/public/legal names, coordinate proximity, operator, and official domain. Each feature records match/conflict/missing, weight, and a human-readable reason.

Internal confidence is the bounded matched-minus-conflicting evidence weight divided by considered evidence weight. Missing features do not count as matches. A CMS CCN, state-license, or state conflict forces `REVIEW_REQUIRED` regardless of the numeric result. Every decision returns its features, conflicts, threshold version, and reason.

## Confidence / Threshold Policy

Initial resolver version `facility-identity-v1` uses:

- verified threshold `0.92`, at least three positive features, and no conflicts;
- probable threshold `0.72` with no conflicts;
- rejected threshold `0.25` only when conflicts outnumber matches;
- otherwise `REVIEW_REQUIRED`.

These are pilot hypotheses, not consumer scores and not nationally tuned thresholds. Task 014C must measure them on difficult cases and version any changes. Claim-specific resolvers may impose stricter rules—for example a state license can verify deterministically, while a Place ID requires corroborating location/contact evidence.

## Source Authority Matrix

| Authority                  | Initial rank | Appropriate use                                                           |
| -------------------------- | -----------: | ------------------------------------------------------------------------- |
| Federal healthcare         |            1 | CMS identity, federal participation, federal regulatory evidence          |
| State healthcare regulator |            2 | State license/status, state operator, state enforcement                   |
| Government/legal           |            3 | Legal/corporate entity facts and filings                                  |
| Official organization      |            4 | Facility/operator/chain self-published phone, website, names              |
| Commercial corroboration   |            5 | Google business identity/status, address, public phone/website candidates |
| Consumer/reputation        |            6 | Future corroboration only; not regulatory truth                           |

Rank is evaluated by claim type, date, and corroboration—not a blind last-write-wins order.

## Conflict Resolution Matrix

| Claim                               | Primary authority               | Lower-source conflict treatment                                             |
| ----------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| CMS participation/regulatory status | CMS                             | Preserve; do not override; review material conflicts                        |
| State license/status                | State regulator                 | Federal context may support; commercial closure cannot override             |
| Closure                             | CMS/state regulator             | Google `CLOSED_*` creates a conflict/review item only                       |
| Ownership/operator/legal entity     | CMS, state, government/legal    | Official-site statement corroborates but does not replace official evidence |
| Official website                    | State/official organization     | Google supplies a candidate; directory/lead-gen domains are rejected        |
| Public phone                        | CMS/state/official organization | Multiple role-labelled phones may coexist; recency alone does not overwrite |
| Address/geography                   | CMS/state                       | Google can corroborate; campus/unit ambiguity requires review               |
| Chain membership                    | CMS chain source                | Owner/parent similarity cannot manufacture a chain membership               |

## Ownership Relationship Classification

Task 014A's approximately 111,977 figure was a PostgreSQL planner estimate. The exact read-only Task 014B count is **109,612** unresolved rows out of 674,063 total.

### Source/reason classification

| Category                                                                                                         |  Count | Percent | Interpretation and treatment                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------- | -----: | ------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change-of-ownership owner-information records keyed by an enrollment identifier without a proven facility bridge | 71,387 |  65.13% | Expected unresolved source evidence. Retain by party, role, enrollment, release, and locator; resolve only when an authoritative enrollment-to-CCN bridge exists. |
| All-owners records keyed by an enrollment identifier without a proven facility bridge                            | 36,380 |  33.19% | Expected unresolved source evidence. Same treatment; name similarity is insufficient.                                                                             |
| Enrollment rows with source-lost five-digit numeric CCN and a unique canonical padded match                      |  1,653 |   1.51% | Deterministic normalization defect. Migration 0012 resolves provider links; future normalization restores the leading zero.                                       |
| Enrollment rows with no deterministic canonical match                                                            |    192 |   0.18% | Preserve unresolved. They may be historical, non-current, or carry non-CCN-shaped source values.                                                                  |

No owner record had a safe enrollment-identifier bridge after considering the enrollment organization graph. No row was resolved by name.

### Party and role classification

| Party/role family                          |  Count | Percent | Example shape and meaning                                                                                  |
| ------------------------------------------ | -----: | ------: | ---------------------------------------------------------------------------------------------------------- |
| Individual management/governance/control   | 58,074 |  52.98% | Officer, director, managing employee, operational control, ADP, trustee; not necessarily equity ownership. |
| Organization ownership/financial interest  | 24,568 |  22.41% | Direct/indirect ownership, partnership, mortgage, or security interest.                                    |
| Individual ownership/financial interest    | 13,084 |  11.94% | Direct/indirect or partnership interest; person remains separate from organization.                        |
| Organization management/governance/control |  9,618 |   8.77% | Managing/control organization; not automatically a chain.                                                  |
| Organization other/legal enrollment role   |  2,539 |   2.32% | Includes enrolled legal organization or other CMS role.                                                    |
| Individual other role                      |  1,729 |   1.58% | CMS `OTHER`; preserve without inference.                                                                   |

CMS source flags overlap role categories and are preserved, not inferred from names: holding company 2,958; owned by another party 2,408; management services company 1,799; parent company 506; chain home office 453; investment firm 279; REIT 108; private equity company 14.

The model correctly keeps person, organization, legal entity, operator/manager, owner, parent, and chain distinct. The same facility may have multiple simultaneous or historical relationships.

### Reconciliation result

- Original exact unresolved: **109,612**.
- Deterministically resolvable by Migration 0012: **1,653**.
- Projected remaining after production migration: **107,959**.
- Evidence deleted or overwritten: **0**.

The migration has not been applied to production in Task 014B, so the live unresolved count remains 109,612 until reviewed deployment.

## Chain Membership Classification

The exact original count is **1,361** unresolved memberships from one CMS membership release, spanning 1,361 distinct source identifiers and 201 chains.

| Category                                                        | Count | Percent | Treatment                                                                                                                        |
| --------------------------------------------------------------- | ----: | ------: | -------------------------------------------------------------------------------------------------------------------------------- |
| Five-digit numeric CCN with unique canonical leading-zero match | 1,246 |  91.55% | Deterministic source normalization defect; Migration 0012 restores the provider link and future loads normalize before matching. |
| Other malformed/non-CCN-shaped identifier                       |   111 |   8.16% | Preserve unresolved and review source semantics; do not manufacture a facility.                                                  |
| Valid six-character CCN absent from canonical universe          |     4 |   0.29% | Expected source/universe timing mismatch; preserve.                                                                              |

- Deterministically resolvable: **1,246**.
- Projected remaining after migration: **115**.
- Manufactured memberships: **0**.

## Staffing Unresolved Classification

There are **136** unresolved PBJ quarter summaries across **64** valid six-character CCNs. None has a canonical provider in the current Provider Information universe; none is malformed and none is an ingestion lookup defect.

| Quarter | Rows | Distinct CCNs |
| ------- | ---: | ------------: |
| 2025Q2  |   63 |            63 |
| 2025Q3  |   39 |            39 |
| 2025Q4  |   25 |            25 |
| 2026Q1  |    9 |             9 |

The declining sequence is consistent with historical/closure/release-timing cases, but that is not asserted as fact without additional authoritative observations. Twelve rows share identifiers with unresolved ownership evidence and four with unresolved chain evidence; neither establishes canonical identity.

- Deterministically resolved in Task 014B: **0**.
- Remaining: **136**.
- Treatment: retain immutable PBJ evidence and resolve only when an authoritative historical/current CCN identity is introduced.

## External Identifier Registry

`facility_external_identifier` supports CMS CCN, Google Place ID, state license, CMS PECOS/PAC, chain, corporate registry, official domain, and future namespaces. It records canonical target, namespace/type/value, normalized value, source observation, resolution state, validity interval, and verification time. The constraint permits exactly one provider/organization/chain target.

CMS CCNs are backfilled as verified external identifiers but remain canonical in `provider_identifier`; this registry does not replace that authoritative identity.

## Google Places Architecture

The server-only adapter now separates bounded Text Search candidate discovery from Place Details. Discovery requests only ID, name, formatted address, and location, with a configurable maximum capped at 10 (default 5). Details are requested only by a selected Place ID and use an explicit field mask for phone, website, and business status.

Errors are classified as missing credential, dry run, budget exceeded, timeout, authorization, rate limit, upstream, or invalid response. Retryable status/timeout retries are bounded to at most two. Error messages omit response bodies and credentials.

Candidates persist separately from claims with name/address/phone/website/location/status, features, conflicts, confidence, state, threshold, source observation, and discovery/review timestamps. Rejected candidates remain queryable.

**Real Google requests made in Task 014B: 0.**

## Google API Cost Controls

- server-only credential passed in a header, never URL/query/cache;
- dry-run budget is the default and throws before network access;
- explicit per-run maximum and hard stop;
- run/provider request counters and resume cursor;
- candidate count capped at 10;
- persistent cache keyed by opaque request fingerprint, operation, field mask, and adapter version;
- cache hits do not consume budget;
- separate 30-day discovery and 90-day details defaults;
- field masks reject wildcard storage in the database;
- request and response fingerprints support idempotency/audit;
- no deploy-triggered job or broad default facility selection exists.

## Website Resolution Design

Website observations carry source authority, retrieval time, typed HTTPS URL, and source record. Claims must classify facility-specific, chain, operator, corporate, directory, social, or lead-generation roles. Google and facility submissions create candidates; they do not automatically establish an official site. Domain ownership, page identity, address/contact corroboration, redirects, and facility/operator context become explainable matching features.

## Phone Resolution Design

Phone observations remain source- and time-qualified. Claim payloads distinguish facility main, admissions, corporate, operator, chain, fax, and unknown roles. Multiple valid numbers may coexist. A newer commercial number does not overwrite a government number solely due to recency; role and corroboration govern resolution.

## State Regulator Adapter Contract

The Python adapter contract can emit state, regulator/source, license ID/type/status, issue/expiration dates, operator/legal entity, capacity, address, source URL/reference, publication/observation/retrieval dates, release ID, adapter version, and provenance. Adapters must validate and archive source releases before promotion. No state adapter or state data was implemented in this task.

## Review Queue

`facility_review_item` supports multiple candidates, address/phone/website conflicts, rename, closure, ownership mismatch, chain ambiguity, authority conflict, and state/CMS disagreement. It stores provider, claim/candidate, priority, status, assignment, and a self-contained evidence summary.

Append-only actions support verify, reject, leave unresolved, mark probable, defer, and note. Decisions record previous/new state, reviewer/system identity, reason, rule version, and supporting observation IDs. There is no public review route or consumer UI.

## Audit Trail

`facility_resolution_audit_event` records facility, claim/candidate, previous/new state, resolver kind/reference, method, reason, rule version, supporting observations, and time. Automated resolvers use a versioned system reference; manual decisions retain reviewer reference. Observation, claim, review-action, and resolution-audit tables are append-only.

## Freshness

Freshness is centralized in `FACILITY_INTELLIGENCE_FRESHNESS`:

- nearly static: CMS CCN (release/identity driven), verified Place ID and state license ID (365-day confirmation);
- moderate: phone/business status (90 days), website/operator (180 days);
- release-driven: ownership, staffing, inspections, penalties/ratings through their source release cadence.

Task 014C should validate these defaults. A new observation never erases an older one.

## Release / Run Versioning

Every enrichment run records source, adapter/resolver versions, mode, requested facility fingerprint/count, request maximum/usage, cache hits, outcome counters, start/end, release fingerprint, and resume cursor. The requested provider set has stable ordinal, attempt count, status, error code, and completion time.

`dry_run` requires a zero network budget. Pilot/backfill modes require an explicit facility set and budget. There is no command that implicitly selects all 14,693 facilities.

## Migration / Backfill Results

Migration 0012 is forward-only and additive. In isolated validation it creates all Facility Intelligence tables, enums, triggers, constraints, and indexes. Its CMS-only backfill inserts one facility identity observation per existing facility snapshot, verified CMS CCN external identifiers, canonical-name claims supported by those observations, and no external data.

The only relationship reconciliation restores leading zeros for exact unique CMS CCN matches:

- ownership enrollment relationships: projected 1,653 provider links;
- chain memberships: projected 1,246 provider links;
- staffing: no update.

Original source identifier, raw record, release, locator, and relationship row remain unchanged. No production migration was applied during Task 014B; deployment remains a separately reviewed operation before 014C.

## Test Results

Local final validation results:

- `npm run check`: PASS — formatting, lint, TypeScript, 72 web tests passed (5 live-database tests skipped by the normal no-database run), 11 domain tests passed, and the Next.js production build completed.
- `python -m ruff format --check services/ingest`: PASS.
- `python -m ruff check services/ingest`: PASS.
- `python -m pytest`: PASS — 42 tests passed and 8 isolated-database tests skipped by the normal no-database run.
- The migration and all 8 database integration tests are also exercised by the isolated PostGIS CI job; they are never pointed at production.

Coverage includes:

- all five resolution states and authority-conflict behavior;
- observation fingerprint/version behavior;
- dry-run/request budget hard stops;
- Google field masks, candidate/details parsing, caching, rate-limit classification, and key non-exposure;
- five-digit CMS CCN normalization;
- migration object/guard assertions;
- isolated PostGIS observation/claim/candidate/review/audit constraints and append-only behavior;
- existing provider, staffing, regulatory, ownership, chain, trust, search, and consumer regressions.

## Production Data Integrity

Read-only pre-migration production baseline:

| Measure                    |   Count |
| -------------------------- | ------: |
| Canonical providers        |  14,693 |
| Unique CMS CCNs            |  14,693 |
| Facility snapshots         |  14,693 |
| Ownership relationships    | 674,063 |
| Chain memberships          |  10,231 |
| Staffing quarter summaries |  57,873 |

Migration 0012 never inserts providers or `provider_identifier` rows and never deletes source evidence. Therefore canonical facility/CCN counts remain 14,693/14,693. Projected derived-link changes are documented above. Production post-migration counts are intentionally not claimed because the migration was not applied in this task.

## Task 014C Pilot Recommendation

Generate a deterministic, versioned cohort of **200 unique CCNs** using CMS and existing evidence only—no Google calls during selection. Use a fixed seed and retain category membership so overlaps do not silently change composition.

Recommended target strata (allow controlled overlap, then fill to 200 with deterministic diverse sampling):

- 20 large national-chain facilities across at least 10 states;
- 20 regional-chain facilities;
- 20 independents;
- 15 common-name/same-market collisions;
- 15 renamed or recent ownership-change facilities;
- 15 chain-transition/ambiguous-chain cases;
- 15 urban, 15 suburban, and 15 rural facilities balanced across Census regions;
- 10 hospital-affiliated or multi-building campus SNFs where existing official evidence supports that shape;
- 10 sparse-identity/missing-phone-or-coordinate cases;
- 10 address-format/unit/ZIP boundary variations;
- 10 existing phone/ownership/contact conflict candidates from source comparisons.

Website-present/absent and Google candidate/closure categories cannot be truthfully known before the pilot. Tag them after bounded discovery and use reserve slots to maintain difficulty rather than pre-asserting commercial facts.

### Pilot success metrics and authorization thresholds

- report `VERIFIED`, `PROBABLE`, `REVIEW_REQUIRED`, `UNRESOLVED`, and rejected-candidate rates by stratum;
- manually adjudicate every auto-verified case plus a stratified sample of all other states;
- auto-verified measured precision at least 99%, with no authoritative-identity conflict auto-published;
- false-positive rate at most 1%; false-negative rate reported and investigated, not optimized away;
- official website and facility-main-phone precision at least 98% among published claims;
- report ambiguous-candidate and closure-conflict frequency explicitly;
- target no more than 2 external requests per facility at p95;
- report cold/warm cache hit rates separately and project national request volume from observed strata;
- API error rate below 2% excluding deliberate budget stops, with all retry behavior bounded;
- national rollout requires precision review, cost projection, conflict analysis, and approved threshold version—not merely a high match rate.

Task 014C should start in dry-run cohort mode, then receive an explicit reviewed request budget. It must not expand beyond the 200-CCN manifest without separate authorization.
