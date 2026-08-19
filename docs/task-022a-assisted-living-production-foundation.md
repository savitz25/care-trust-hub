# Task 022A — Assisted living production foundation

Durable persistence and fail-closed publication gates for the CA / NY / TX assisted-living pilot. No public pages, search, sitemap, or homepage counts.

`CARE_ENABLE_ASSISTED_LIVING_INTELLIGENCE` remains **off**.

Google Places API requests: **0**

## Migration / schema

`db/migrations/0020_assisted_living_pilot.sql` adds standalone tables. They do not join or merge into CMS `provider` / CCN identity.

- `assisted_living_provider` — internal UUID, `external_key` = `STATE:REGULATOR:SOURCE_FACILITY_ID`, official name/address/type, consumer category, raw license status, `license_status_reported`, `source_directory_context`, licensed capacity (never CMS certified beds), memory designation, identity state, publication state, `discovery_eligible`, provenance (locator, retrieval date, source fingerprint, adapter version), record fingerprint.
- `assisted_living_organization_party` — licensee / operator / management_company / administrator / owner / parent_organization. Unique on `(provider_id, role, name)`.

Indexes: internal id (PK), external key, state + source facility ID, license ID, identity/publication, discovery (`state`, `publication_state`, `consumer_category`) where eligible.

## Production counts

Retrieved 2026-08-19. Official source files matched the 021B baseline.

| State | Canonical | VERIFIED | Discovery-eligible |
| ----- | --------: | -------: | -----------------: |
| CA    |    12,522 |   12,522 |              7,962 |
| NY    |       529 |      529 |                529 |
| TX    |     1,996 |    1,996 |              1,996 |
| Total |    15,047 |   15,047 |             10,487 |

Organization roles persisted: 12,522 CA licensees, 12,522 CA administrators (plus TX/NY admins → 14,518 administrator rows), 529 NY operators, 1,995 TX owners (one directory row has no owner name), 770 TX management companies.

## Publication-state logic

Identity `VERIFIED` is not the same as currently operating.

| State | `PUBLISHABLE_CURRENT` | `PUBLISHABLE_WITH_STATUS` | `HISTORICAL_ONLY` | `NOT_CURRENTLY_PUBLISHABLE` | `REVIEW_REQUIRED` |
| ----- | --------------------: | ------------------------: | ----------------: | --------------------------: | ----------------: |
| CA    |                 7,939 |                        23 |             3,821 |                         739 |                 0 |
| NY    |                   529 |                         0 |                 0 |                           0 |                 0 |
| TX    |                 1,996 |                         0 |                 0 |                           0 |                 0 |

Discovery requires `VERIFIED` + usable official name/address + category + provenance + an appropriate operating/status condition (`PUBLISHABLE_CURRENT` or `PUBLISHABLE_WITH_STATUS`). Closed and pending CA records stay stored and are excluded from default discovery.

## State-status semantics

- **CA LICENSED** — future normal discovery when other gates pass.
- **CA CLOSED** — stored as `HISTORICAL_ONLY`; not default discovery.
- **CA PENDING** — `NOT_CURRENTLY_PUBLISHABLE`; not treated as operating.
- **CA ON PROBATION** — `PUBLISHABLE_WITH_STATUS`; official status preserved; never labeled good standing.
- **NY** — HFIS has no license status. `license_status_reported=false`, `consumer_status=null`, `source_directory_context=current_hfis_listing`. No invented Active / Licensed / good standing.
- **TX** — active HHSC ALF directory. `source_directory_context=active_alf_directory`. `Facility Licensed=YES` is stored as the directory flag `LICENSED`; no separate invented regulatory status.

## Memory-care semantics

Explicit regulator evidence only. Facility names are never used.

- CA: `not_reported` (12,522). No official dementia column.
- NY: SNALR / Dementia attributes → `explicit_memory_or_dementia_license` (212).
- TX: Alzheimer Certificate Number → `specialty_endorsement` (732). Name-only “memory care” remains `not_reported`.

## Read selector

`selectPublishedAssistedLivingProvider` / `getPublishedAssistedLivingProvider` / `listPublishedAssistedLivingProviders` in `apps/web/src/server/care/assisted-living-publication.ts`.

Fail-closed:

- Flag off → empty / null, no query.
- SQL requires `VERIFIED` + `discovery_eligible` + `PUBLISHABLE_CURRENT|PUBLISHABLE_WITH_STATUS`.
- Hides review/unresolved/rejected, pending CA, closed CA default discovery, and non-current publication states.
- Returns consumer-safe fields only (name, place, regulator, official type, category, license, licensed capacity, explicit memory designation, consumer-safe status, organization roles, provenance). No raw ingest rows, fingerprints, or Google tables.

## QA

Database sample: 30 CA + 30 NY + 30 TX, including licensed / closed / pending / probation, NY memory + no-status, TX Alzheimer endorsement + management company, and duplicate-looking names with distinct official IDs.

Critical wrong-facility identities: **0**. Identity is `state + regulator + official source facility ID` only.

## Idempotency

Second unchanged persist: inserted 0, updated 0, unchanged 15,047. Provider rows 15,047. Organization-party rows 30,334. No unexplained publication-state changes.

## Google safeguard

No Places Text Search, Place Details, geocoding, Place ID resolution, or refresh of prior Google enrichment ran during migration, ingest, QA, or this task.

**Google Places API requests: 0**

## Existing CMS safety

After migration and backfill:

- CMS facilities: **14,693**
- Unique CMS CCNs: **14,693**

No changes to CMS identity, Facility History, Ownership V2, SNF state evidence, Family Workspace, Navigator, Cost Planner, Interview Builder, search ranking, or cached Google evidence.

## Next

Ready for Task 022B public assisted-living pages. Do not begin them here.
