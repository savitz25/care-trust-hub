# ASK-SEARCH-SENIOR-001 — SeniorTrustHub Nursing Facility Discovery Pilot

**Status:** PILOT / NOT YET CONSUMED BY ASK PRODUCTION  
**Export:** `data/network-discovery/senior-discovery-pilot.v1.json`  
**Schema:** `ask-network-discovery-v1`  
**Hub:** `senior`

## Authoritative source

| Layer | Role |
|-------|------|
| CMS Nursing Home Provider Information (`4pq5-n9py`) | Authoritative SNF / nursing facility universe |
| `provider_identifier` (issuer=`CMS`, type=`CCN`) | Canonical facility identity |
| `facility_snapshot` | Display name, physical address, city, state, ZIP, county |
| Production sitemap `/sitemaps/facilities-*.xml` | Public/indexable research cohort |
| `/facility/cms/{ccn}/{slug}` | Consumer Trust Report / research profile |

**Primary export mode:** `CARE_DATABASE_URL` when available.  
**Fallback:** read-only HTTPS to own Hub sitemap + facility pages (no Google Places / LLM / geocoding).

## CCN identity

```text
network_entity_id = senior:ccn-{CCN}
canonical URL     = https://www.seniortrusthub.com/facility/cms/{CCN}/{slug}
```

- CCN is the only canonical network key (6 alphanumeric)
- Duplicate CCNs fail closed
- Name / address / phone / Place ID are never identity

## Facility type model

| Type | Maturity for Ask discovery v1 |
|------|-------------------------------|
| `nursing_facility` (nursing home / SNF / skilled nursing) | **READY** |
| Assisted living (state license IDs, not CCN) | **SOFT / unsupported for this pilot** — do not substitute SNFs |
| Memory care | **UNSUPPORTED** — never inferred from name/CMS fields |

Synonyms (`nursing home`, `skilled nursing facility`, `SNF`) map to the same `nursing_facility` row — not duplicate entities.

## Physical geography

A nursing facility is a **physical destination**.

Exported: principal-office / CMS-reported city, state, ZIP, county when present.  
Not exported: service city/county/radius or coverage inventiones.

Exact city queries (e.g. Austin TX) require physical city evidence — county alone is not exact city.

## Profile maturity

`trust_report_available = true` only for facilities that are public/indexable with a resolvable CMS research profile (sitemap membership or DB snapshot + Trust Report path).

## Discovery eligibility (fail-closed)

1. Valid CMS CCN  
2. Display name  
3. Entity class = nursing/SNF (CMS provider information universe)  
4. Public/indexable  
5. Research-capable profile  
6. Usable US physical state  
7. Usable physical city and/or ZIP  
8. Canonical HTTPS Senior profile URL  
9. No duplicate CCN  

**Not used:** CMS Five-Star, staffing/inspection/quality ratings, reviews, Trust Score, Premium, payment, popularity, complaint/enforcement counts.

## Cohort algorithm

1. Load eligible nursing facilities  
2. Sort by `network_entity_id` within each state  
3. Deterministic state round-robin to ~200  
4. Final sort by `network_entity_id`  

Query-independent. Not biased by ratings, QA cities, or Premium.

## Fail-closed care types

These must **not** return nursing facilities:

- memory care Austin TX  
- assisted living Austin TX  
- home care agency Austin TX  

## Ranking independence

Cohort order ignores Five-Star, inspection/staffing/quality ratings, reviews, Trust Score, Premium, payment, and popularity.

## Data minimization

No resident/patient/PHI, complaint or deficiency narratives, enforcement narratives, ownership PII, phones, credentials, Premium/payment, or rating fields used for ranking.

## Counts (this pilot export)

| Metric | Count |
|--------|------:|
| Sitemap / considered | 14,693 |
| Unique CCNs | 14,693 |
| Duplicate CCNs skipped | 0 |
| Eligible (geo + profile) | 14,683 |
| Ineligible (`missing_usable_us_state`) | 10 |
| Pilot selected | 200 |

**Fingerprint:** `23e837a09f541460c688a47b3fa460cffe3b591675ed3861ba79ca2787bf70b6`

### Source-mode note

Fallback `production_sitemap_pages` hydrates city/state from published facility page meta. ZIP and county are present in `facility_snapshot` (DB mode) but are often absent from the public HTML head — pilot ZIP/county counts may be 0 in sitemap mode. Re-export with `CARE_DATABASE_URL` for full postal/county fields.

## Query readiness (pilot / full eligible)

| Query | Pilot | Full eligible |
|-------|------:|-------------:|
| nursing homes Austin TX | 0 | 25 |
| skilled nursing facilities Miami FL | 1 | 25 |
| nursing facilities New York NY | 0 | 13 |
| nursing homes Los Angeles CA | 0 | 78 |
| nursing facilities New Jersey | 4 | 348 |
| SNF Dallas TX | 0 | 33 |

Zero in pilot is acceptable (state round-robin cohort is query-independent).

## Ask compatibility

Ready for future Ask ingestion after other Hub paths are proven. **Ask adapter not changed in this task.**
