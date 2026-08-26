# SEN-NAT-001 — Current-state audit + national opportunity gap map

**Status:** COMPLETE (audit only). **PILOT / NOT a Florida expansion.**

Census date: **2026-08-26**. Production SHA of code inspected: `origin/main` `b8204392deb42074cdb4beffcea50c94f7880270`.

Live counts are in `docs/sen-nat-001-production-census.json` and `docs/sen-nat-001-production-followup.json`. This document does **not** copy historical working baselines as current truth; it reconciles them.

## 1. System baseline

| Item | Current fact |
| --- | --- |
| Repository | `https://github.com/savitz25/care-trust-hub` (historical name **care-trust-hub**; public brand SeniorTrustHub) |
| Production domain | `https://www.seniortrusthub.com` |
| Framework | Next.js 16 App Router (`apps/web`), npm workspaces, `packages/domain` + `packages/ui` |
| Ingest | Independent Python service `services/ingest` (`care_ingest` CLI). Web never parses bulk CMS files |
| Database | Supabase-managed PostgreSQL + PostGIS. Web uses `pg` pool + `CARE_DATABASE_URL` (session pooler). No Supabase Auth/Realtime/browser SDK |
| ORM | None. Parameterized SQL in `apps/web/src/server/care/*` |
| Deployment | Vercel Production = `main`. Feature flags are server-only `CARE_ENABLE_*` |
| Scheduled refresh | **None.** GitHub Actions CI only. Ingest is manual CLI |
| Canonical NH identity | CMS CCN on `provider_identifier` (`issuer=CMS`, `identifier_type=CCN`) |
| Public NH profile | `/facility/cms/[ccn]/[slug]` — CCN is identity; slug is presentation |
| AL profiles | `/assisted-living/[state]/[providerId]/[slug]` — **not** CCN |
| Ownership / chain pages | `/ownership/[organizationId]/[slug]`, `/chain/[chainId]/[slug]` |

### Public routes (index gated by `CARE_ENABLE_PUBLIC_LAUNCH`)

Search, compare, shortlist, research, development, trust forms: `noindex`. Sitemap: `/sitemap.xml` + `/sitemaps/[file]`.

### Tables (production, live)

Foundation: `source_dataset`, `source_release`, `raw_object`, `ingest_run`, `provider`, `provider_identifier`, `facility_snapshot`, `evidence_assertion` (empty).

Regulatory: `inspection_event`, `deficiency_finding`, `penalty_enforcement`.

Staffing: `pbj_staffing_day`, `pbj_staffing_quarter_summary`.

Ownership/chain: `organization`, `organization_identifier`, `ownership_party`, `provider_ownership_relationship`, `organization_relationship` (**0 rows**), `ownership_change_event`, `ownership_source_notice`, `ownership_portfolio`, `ownership_portfolio_member`, `cms_chain`, `cms_chain_*`.

Intelligence: `facility_*` observation/claim/review/history tables.

Assisted living (standalone, not merged to CCN): `assisted_living_provider`, `assisted_living_organization_party`.

## 2. Reconciliation of prior baselines

| Prior working number | What it actually was | Production 2026-08-26 |
| --- | --- | ---: |
| 14,693 CMS CCNs | Unique **currently active** CMS nursing homes in Provider Information, 1:1 with `provider` | **14,693** providers / **14,693** CCNs / **14,693** current snapshots. Match |
| VERIFIED 10,103 / REVIEW_REQUIRED 4,216 / PROBABLE 36 / UNRESOLVED 13 | Google Places **facility identity** (name/phone/address/place), Task 014D, **not** ownership and **not** CMS identity | Latest `google_place_identity` per provider: VERIFIED **10,312**, REVIEW_REQUIRED **4,307**, PROBABLE **36**, REJECTED **25**, no claim **13** (= UNRESOLVED). Drift from extra intelligence runs; PROBABLE and UNRESOLVED match |
| ~147,396 CMS/state event observations | Mixed working total (not a single table) | `facility_history_event` **156,797**; `inspection_event` **149,705**; `facility_source_observation` **53,903**. Do not treat 147k as current |

Denominator for 14,693: **nursing homes only**, **current Care Compare Provider Information**, not all CMS CCN types, not owners, not historical terminated providers.

## 3. Current national entity counts

Do not sum these into one “providers” number.

| Concept | Count | Notes |
| --- | ---: | --- |
| `provider` rows | 14,693 | All `provider_type=nursing_home` |
| Current facility snapshots | 14,693 | One current PI release; **no prior PI snapshots retained** |
| Distinct CMS CCNs | 14,693 | Unique, 1:1, `valid_to` all NULL |
| Facility-level NPI on `provider_identifier` | **0** | NPI lives on **organizations** |
| Org NPIs (`organization_identifier` NPPES/NPI) | 14,401 rows / 12,220 orgs | From SNF Enrollments, not a facility key |
| State license claims (VERIFIED `STATE_LICENSE_ID`) | 2,817 claims / 2,807 facilities | CA/NY/TX nursing homes only |
| Operators as a first-class entity table | **ABSENT** | Operator is a **role** on ownership/state claims |
| Ownership parties | 356,879 | 246,020 individual + 110,859 organization |
| Organizations | 115,253 | |
| Facilities with ≥1 ownership relationship | 14,380 | |
| CMS chains | 671 | Membership 10,231 rows / 10,116 linked facilities |
| Assisted living canonical (CA/NY/TX) | 15,047 | Separate identity namespace |
| Home health agencies | **0** | No tables / no ingest |
| Hospice providers | **0** | No tables / no ingest |
| PACE / IRF / LTCH | **0** | Not in product |
| Memory care as national class | **0** | State designation only (see §13–14) |

## 4. Care-type counts

| Category | National entities in production | Source |
| --- | ---: | --- |
| Skilled Nursing / Nursing Home | 14,693 | CMS Provider Information `4pq5-n9py` |
| Home Health | 0 | CMS file exists (`6jpm-sxkc`); **not ingested** |
| Hospice | 0 | CMS files exist (`yc9t-dgbk`, `252m-zfp9`); **not ingested** |
| Assisted Living / residential care | 15,047 (CA 12,522 / NY 529 / TX 1,996) | State directories only |
| Memory care (explicit regulator evidence) | NY 212 SNALR/dementia; TX 732 Alzheimer certificate; CA 0 | Not a national class |
| PACE | 0 | No Care Compare-equivalent national listing in this product |
| IRF / LTCH | 0 | CMS datasets exist; **out of current mission spine** |

CMS participation on current NH snapshots: Medicare+Medicaid 13,905; Medicare only 541; Medicaid only 247.

## 5. Evidence counts

| Evidence | Raw records | Distinct facilities |
| --- | ---: | ---: |
| Inspection events (`inspection_event`) | 149,705 | 14,693 |
| Health deficiencies (`deficiency_finding`) | 418,344 | 14,629 |
| … of which `complaint_deficiency=true` | 130,534 | (flag on finding, not a complaint case file) |
| … unlinked to an inspection event | 30,374 | preserved, not forced |
| Fines | 13,687 | 6,576 |
| Payment denials | 2,479 | 1,913 |
| PBJ daily rows | 5,280,805 | 14,665 CCNs |
| PBJ quarter summaries | 57,873 | 4 quarters (2025Q2–2026Q1) |
| Ownership relationships | 674,063 | 14,380 |
| CHOW / ownership-change events | 5,227 | 5,172 |
| Facility history events (derived) | 156,797 | mixed families |
| Google Places observations | 16,299 identity candidates | 14,652 |
| MDS quality measure **rows** | **0** | dataset registered, `implemented=false` |
| Fire-safety **citations** | **0** as findings | Fire **inspection dates** are present (43,913 standard + 791 complaint) |
| Special Focus first-class rows | **0** | Values exist on PI `raw_record` only |

Inspection survey types (do not count deficiencies as inspections):

| Survey type | Events | Facilities |
| --- | ---: | ---: |
| Health Complaint | 58,951 | 12,385 |
| Health Standard | 43,922 | 14,693 |
| Fire Safety Standard | 43,913 | 14,689 |
| Infection Control | 2,128 | 1,694 |
| Fire Safety Complaint | 791 | 693 |

## 6. Canonical identity

**Nursing homes:** CMS CCN is actually canonical in production. One CCN ↔ one `provider`. No CCN duplicates across providers. Identifiers are six-character uppercase. `valid_from`/`valid_to` exist but current CCNs are open-ended.

**NPI:** Not a facility primary key. PECOS NPI is stored on `organization` via enrollments (14,401). Multiple NPIs per org possible; 14,401 NPIs / 12,220 orgs. **Do not equate CCN = NPI = state license.**

**State license:** CA/NY/TX nursing-home licenses are `facility_claim` / `facility_external_identifier` with resolver `state-regulator-v1`. CA/TX mostly CCN-joined (CONFIRMED). NY is address/name/phone match (HIGH_CONFIDENCE / REVIEW_REQUIRED when ambiguous). Assisted living uses `STATE:REGULATOR:SOURCE_FACILITY_ID` and **must never merge to CCN by name**.

**Historical CCN reuse / termination:** Current PI is **active facilities only**. Terminated/closed CMS nursing homes are not in `provider`. CHOW events cover ownership changes from 2016+, not a full terminated-provider spine. This is an architecture gap for “is this still operating?” beyond the current PI universe.

## 7. Facility / operator / owner / chain

| Layer | Status | Evidence |
| --- | --- | --- |
| Facility / location | **PRESENT** | `provider` + `facility_snapshot` + CCN |
| Owner / ownership entity | **PARTIAL** | Parties + percentages + official CMS role text. 5%+ direct/indirect, officers, directors, ADP, mortgage/security, etc. preserved. Not every listed person is “the owner” |
| Operator | **PARTIAL** | CMS `OPERATIONAL/MANAGERIAL CONTROL` (142,736 rels) and NY `STATE_OPERATOR` (525 VERIFIED). No dedicated operator table |
| Chain | **PRESENT** | Official CMS Chain ID (671). Not inferred from similar names |
| Org→org graph | **ABSENT** | `organization_relationship` = 0 |
| Time-aware edges | **PARTIAL** | `association_date` on 659,637 / 674,063 ownership rels; CHOW `effective_date` required; PI snapshots are **current-only** so rating/name history is not a PI time series |

Consumers can often see *current* CMS ownership/control roles and chain membership. They cannot reliably reconstruct “Operator X in 2022 → Y in 2024 → Z in 2026” from PI snapshots. CHOW events support dated **change of ownership**, not a complete operator tenure graph.

## 8–9. Ownership graph + change intelligence

Ingested:

- Care Compare Ownership `y2hd-n93e` (247,632 rows)
- SNF All Owners `afe44b85-…` (293,253)
- SNF Enrollments (14,405) + chain membership transform (10,231)
- SNF CHOW (5,227) + CHOW owner information (119,419)

Official role text is preserved (examples: `5% OR GREATER DIRECT OWNERSHIP INTEREST`, `OPERATIONAL/MANAGERIAL CONTROL`, `W-2 MANAGING EMPLOYEE`). Domain layer maps some of these to coarser `OwnershipRole` for UI; CMS wording remains on the relationship.

Historical: CHOW is cumulative from 2016-01-01. A 2022 relationship that ended is **not** automatically expired on `provider_ownership_relationship` (no `valid_to` column on that table). Portfolios distinguish `current` vs `historical` membership at the portfolio layer (`ownership_portfolio_member`). **Snapshot-only PI** is the main gap for facility attribute history.

## 10–11. CMS source inventory + gap map

Registry: `services/ingest/src/care_ingest/resources/cms_sources.json`. Verification of official CMS metadata: 2026-08-14/15 in-repo; live Care Compare metadata rechecked 2026-08-26 for HH/Hospice/MDS/fire.

### Ingested (PRESENT + COMPLETE ENOUGH for NH spine, with noted holes)

| Dataset | CMS ID | Cadence | Last ingest (retrieved) | Rows loaded | Contributes |
| --- | --- | --- | --- | ---: | --- |
| Provider Information | `4pq5-n9py` | Monthly | 2026-08-14 (source modified 2026-07-29) | 14,693 | Identity, geo, beds, participation, 4 star dimensions, phone, ownership *type* text, **raw** SFF/abuse/turnover/HPRD |
| Inspection Dates | `svdt-c123` | Monthly | 2026-08-14 (pub 2026-07-29) | 149,705 | Health/fire/complaint/infection survey dates |
| Health Deficiencies | `r5ix-sfxw` | Monthly | same | 418,344 | Citations, scope/severity A–L, complaint flag |
| Penalties | `g6vv-u9sr` | Monthly | same | 16,166 | Fine vs payment denial |
| PBJ Daily Nurse Staffing | `7e0d53ba-…` | Quarterly | 2026Q1 retrieved 2026-08-15 | 5.28M days | RN/LPN/CNA hours, employee vs contract, HPRD |
| Ownership | `y2hd-n93e` | Monthly | 2026-08-15 | 247,632 | Care Compare ownership rows |
| SNF All Owners | `afe44b85-…` | Monthly | 2026-08-15 | 293,253 | PECOS 855A owners |
| SNF Enrollments | `5f2c306f-…` | Monthly | 2026-08-15 | 14,405 | Enrollment ID, PAC, NPI, CCN bridge |
| SNF CHOW | `f557a6ed-…` | Quarterly | 2026-08-15 | 5,227 | Dated ownership change events |
| CHOW owner information | `a4358712-…` | Quarterly | 2026-08-15 | 119,419 | Buyer/seller parties |
| Chain Performance | `97ecfad1-…` | Monthly | 6 months loaded (through 2026-08-12) | ~634/month | Official chain aggregates |

If nobody runs importers for six months: **all of the above go stale**. There is no cron. Next CMS PI/regulatory monthly drop is on CMS’s cadence (MDS `nextUpdateDate` 2026-09-30 as of 2026-08-26).

### PRESENT BUT PARTIAL

| Item | Why partial |
| --- | --- |
| Special Focus Status | In PI `raw_record` (SFF 88, Candidate 440, blank 14,165). **Not** a first-class claim or profile field |
| Abuse Icon | Raw Y=1,435 / N=13,258. Not first-class |
| Staffing hours / turnover / weekend HPRD on PI | In raw; consumer staffing uses **PBJ**, not these PI summary columns |
| Chain ID on PI | Raw `Chain ID`/`Chain Name`; product chain pages use official chain dataset + enrollments |
| Fire safety | Inspection **dates** yes; fire **citations** dataset `ifjz-ge4w` **not ingested** |
| Deficiency↔inspection link | 30,374 findings unlinked (CMS has no shared survey ID) |
| NPI | On orgs, not facilities |
| `evidence_assertion` | Schema exists, **0 rows** (later intelligence uses `facility_claim` / typed tables instead) |
| MDS Quality Measures | Registry entry `djen-97ju` **enabled=false, implemented=false**. Live CMS file exists (Aug 2026 CSV) |
| Historical PI snapshots | Only current 14,693 rows. Ratings are not a time series from PI |
| Org→org relationships | Table empty |

### ABSENT — P0 (required before “NH national complete” / before Florida multiplies gaps)

1. **First-class currentness + SFF/abuse** — Promote `Special Focus Status` and `Abuse Icon` from already-loaded PI with observation dates. Do not leave 88 SFF facilities unlabeled on profiles.
2. **MDS Quality Measures (`djen-97ju`)** — QM star exists; **individual measures and quarterly history do not**. National complete NH quality is blocked.
3. **Facility NPI crosswalk** from already-ingested SNF Enrollments onto `provider_identifier` (issuer NPPES, type NPI, dated). Needed before any CCN↔NPI merge with HH/hospice/state files.
4. **Refresh architecture** — Documented monthly/quarterly runbook + at least a scheduled job or ops alarm. Manual-only is not national-complete.
5. **Terminated/historical CCN policy** — Decide whether archived PI / POS file is in scope. Today “not in directory” ≠ “closed.”

### ABSENT — P1 (high-value national enrichment)

- Fire Safety Deficiencies `ifjz-ge4w`
- Home Health Care Agencies `6jpm-sxkc` (+ quality, patient survey, HH All Owners)
- Hospice General Information `yc9t-dgbk` + Provider Data `252m-zfp9` (+ CAHPS when separate)
- Additional PBJ quarters (2017Q1+ available; only 4 quarters loaded)
- Historical monthly PI snapshots for rating trends
- Fill `organization_relationship` from PECOS parent/ADP structure **only where the source supports it**
- PBJ Employee Detail — **P1 or REJECT**; privacy/complexity vs daily nurse file already present

### ABSENT — P2 (after Florida starts)

- Additional state NH license adapters (NC, PA, OH, NJ already discovered, `implemented=false`)
- Florida AHCA (HTML/session; HIGH automation difficulty) — **explicitly not this task**
- IRF / LTCH Care Compare (post-acute hospital; weak fit vs family senior-care research)
- Dialysis — **REJECT / LOW VALUE** for this hub’s mission

### REJECT / LOW VALUE

- Inferring assisted living from nursing-home CMS files
- Name-similarity chains
- “Worst nursing homes” rankings
- Treating Google business status as CMS operating status
- Treating complaint-triggered surveys as proven complaints
- PACE as if it had a NH-equivalent national Care Compare listing (Medicare.gov locator only; not a substitute for state PACE program files)

## 12. Nursing home national completion

**Strongest vertical. Not complete.**

| Capability | Status |
| --- | --- |
| Facility identity (CCN) | Complete for *current active* universe |
| Location / beds / participation | Complete on current snapshot |
| CMS 4-dimension stars | Complete as current values; **not historical PI** |
| Inspections vs deficiencies | Distinguished; 30,374 unlinked findings |
| Complaint surveys | Dates + deficiency `complaint_deficiency` flag. **Not** a complaint docket |
| Fire safety | Dates yes; citation text/tags **no** |
| Penalties | Fine vs payment denial distinguished; amounts numeric |
| Staffing | PBJ daily + quarter HPRD, weekend, contract share; 4 quarters history |
| Turnover / admin turnover | In PI raw only |
| Ownership / CHOW | Present; operator vs owner via role text |
| Chain | Official CMS chain IDs |
| SFF / candidate | Raw only (88 / 440) |
| Individual QMs | Absent (MDS file not loaded) |
| Closures / termination | Not in current PI; Google closure is corroboration only and unpublished as status |
| Freshness | Per `source_release`; consumer formatter exists; ingest is manual |

## 13–14. Assisted living + memory care

**CMS does not provide a national AL licensing dataset.** Architecture already encodes this: `assisted_living_provider` is a **separate** table and identity. CMS 14,693 is unused by the AL adapter. Google Places: 0 for AL ingest.

CA CDSS RCFE / NY HFIS Adult Home & Enriched Housing / TX HHSC ALF directory. Discovery-eligible: CA 7,962 (licensed/probation; closed 3,821 historical-only; pending 739 not publishable), NY 529, TX 1,996.

**Memory care is not a national license class.** Model as `memory_designation` on a state-licensed facility:

- `explicit_memory_or_dementia_license` (NY SNALR/Dementia: 212)
- `specialty_endorsement` (TX Alzheimer certificate: 732)
- `not_reported` (CA 12,522 — no official dementia column; **do not infer from names**)

Never publish a national “memory care count.”

### Federal/National Senior Spine vs State Senior Expansion

```text
FEDERAL/NATIONAL SPINE
  CMS-certified NH/SNF (CCN)
  CMS Home Health (CCN)     — not ingested
  CMS Hospice (CCN)         — not ingested
  PECOS ownership/NPI/PAC   — NH only today
  PBJ, inspections, penalties, MDS, SFF

STATE SENIOR EXPANSION
  Assisted living / RCFE / ALF / adult care home licenses
  Memory/dementia endorsements
  State NH license IDs, licensee, operator, licensed capacity
  State inspections/enforcement (CA/NY/TX NH enforcement already partial)
  Florida AHCA — future, not started
```

## 15. Home health + hospice

Distinct national CMS provider classes. **Architecture does not support them yet** (`provider_type` is exclusively `nursing_home`). Do not reuse NH inspection/PBJ/star schema.

| | Home Health | Hospice |
| --- | --- | --- |
| National CMS listing | `6jpm-sxkc` Home Health Care Agencies (modified 2026-05-27, released 2026-07-15, next 2026-10-21) | `yc9t-dgbk` General Information (modified 2026-08-19, released 2026-08-26) |
| Quality | HH quality/ratings on the agencies file + additional HH measure files | `252m-zfp9` Hospice Provider Data |
| Identifier | CMS CCN (HH series) + NPI | CMS CCN + NPI |
| Ownership | HH All Owners (PECOS) exists federally | Hospice ownership files exist in PECOS family; not ingested |
| Geography | **Service area** more than office county | Service geography ≠ office |
| Inspections | Not the NH health-deficiency model | Not the NH model |
| State license | HYBRID — Medicare certification ≠ state HHA/hospice license | HYBRID |

## 16. Facility status / currentness

Distinguish, do not conflate:

| Clock | What exists |
| --- | --- |
| CMS current-active membership | In current PI (14,693). Absence = not in this release, not proof of closure |
| SFF / Candidate | Raw PI values; unpublished as typed status |
| Google business_status | Mostly PROBABLE; **must not** override CMS |
| State license status | CA yes; NY not in HFIS; TX directory = active listing |
| AL closed/pending | CA CLOSED historical-only; PENDING not discovery |
| Trust Hub retrieved_at / ingest completed | Provenance only |
| CHOW effective_date | Ownership change, not facility closure |

## 17–18. Inspection / deficiency / enforcement

Inspection ≠ deficiency. One survey, many findings. Survey identity is derived (CCN + date + type + cycle) because CMS does not publish a shared survey ID.

Enforcement: Fine vs Payment Denial. No proposed vs final distinction in the Care Compare penalties file as loaded. Not a “worst homes” ranking. State enforcement history exists as `facility_history_event` family `state` (CA/NY/TX): complaint inspections 4,239 / fines 4,030 / inspections 1,053 / other actions 79.

## 19. Staffing

PBJ daily nurse file only (not employee detail). Hours: RN (incl. DON/admin split), LPN, CNA, aide-in-training, med aide; employee vs contract. Quarter summaries: total/RN/LPN/CNA HPRD, weekend vs weekday, contract share. Four quarters retained (not “latest only”). Do not compare across quarters without labeling `source_quarter`. CMS staffing **stars** remain a separate PI field, not computed from PBJ.

## 20. Quality + ratings

Current PI stores overall / health inspection / staffing / QM stars (1–5 or null) with footnotes in raw. Long-stay/short-stay QM stars in raw only. **No MDS measure time series.** Ratings are not timeless; without historical PI snapshots, trend is **NOT COMPUTABLE** from PI. Staffing HPRD trends **are** computable across the four PBJ quarters. Derived history has `STAFFING_*_CHANGED` events.

## 21. Special Focus

CMS values on current PI: **SFF 88**, **SFF Candidate 440**, blank 14,165. Graduate/termination history **not** modeled. Product code does not query these keys. **Do not label former SFF as current** — first promote with dated claims before any UI.

## 22. Complaints

Available: `Health Complaint` / `Fire Safety Complaint` survey types; deficiency `complaint_deficiency` boolean. **Not** available: complaint count as violations, substantiated-vs-unsubstantiated docket, complainant identity. Preserve regulator terminology only.

## 23–24. Contacts + verification

CMS facility phone is on every current snapshot (14,693). Published Google corroboration (014D.1): VERIFIED websites 271 facilities, phones 12,433, public names 11,102 (shown only if distinct from CMS). Place IDs / business status / Google address stay internal.

Verification was **commercial corroboration of identity/contact** (Google Places field masks: name, address, phone, website, location, business status). Matching is Resolver V2.2 with VERIFIED / PROBABLE / REVIEW_REQUIRED / REJECTED / UNRESOLVED. **Probabilistic matches are not CMS identity.** CMS CCN remains deterministic.

Contacts should remain provenance-backed observations (already the `facility_claim` model). Do not overwrite CMS phone because Google is newer; UI shows CMS first.

## 25. Existing state data (audit only — no expansion)

**Nursing home licensing (015B/C):** CA CDPH, NY HFIS, TX HHSC NF directory. VERIFIED license IDs ~2,807 facilities. Published only if VERIFIED `STATE_LICENSE_ID`.

**NH state enforcement (017):** history events as above; not a full AHCA-style packet.

**Assisted living (021–022):** CA/NY/TX as §13. FL AHCA `implemented=false`.

NC/PA/OH/NJ discovered, not ingested.

## 26. National vs state responsibility matrix

| Category | National authoritative source? | State data needed? | Completeness potential | Class |
| --- | --- | --- | --- | --- |
| Skilled Nursing | Yes — CMS Care Compare + PECOS + PBJ | License ID, licensee, some inspections | High nationally | **NATIONAL-FIRST** (HYBRID for license text) |
| Home Health | Yes — CMS HH files + PECOS owners | State HHA license | High nationally once ingested | **NATIONAL-FIRST** / HYBRID license |
| Hospice | Yes — CMS hospice files | State hospice license | High nationally once ingested | **NATIONAL-FIRST** / HYBRID |
| Assisted Living | **No** | Yes — every state | State-by-state only | **STATE-FIRST / STATE-DEPENDENT** |
| Memory Care | No national definition | Yes — license/endorsement | Never a national census | **STATE-DEPENDENT** |
| PACE | Weak (locator, not NH-like Care Compare) | Yes | Low as “national complete” | **STATE-DEPENDENT** / P1 later |
| IRF / LTCH | CMS datasets exist | CMS-heavy | Medium, weak consumer fit | **REJECT for spine** until mission expands |

## 27. Geography

| Type | Meaningful geography |
| --- | --- |
| SNF | Physical facility, county, state, ZIP; national ownership |
| Assisted living | Physical facility + state license jurisdiction |
| Home health | **Service area** primary; office address secondary |
| Hospice | Service geography ≠ office |
| Chain / owner | National / multi-state portfolios |

PostGIS exists for NH points. Service-area polygons are **not** modeled.

## 28. Profile intelligence readiness

A current NH profile **can** show: CCN, CMS name, address, phone, beds, participation, four stars, inspections/deficiencies/penalties, PBJ staffing, ownership roles, chain, CA/NY/TX license facts when VERIFIED, derived history, verified Google website/phone/alias.

**Not ready:** SFF badge, abuse icon, individual QMs, fire citations, facility NPI, terminated status, HH/hospice profiles, national AL, memory-care national pages.

Do not redesign profiles in this task.

## 29. Hub Intelligence readiness

| Metric | Computable? |
| --- | --- |
| CMS-certified nursing homes | **COMPUTABLE TODAY** (14,693 current PI) |
| NH by state | COMPUTABLE |
| Home health / hospice counts | **NOT COMPUTABLE** (zero entities) |
| Owners / operators / chains | **PARTIAL** (parties and chains exist; “operator” is a role) |
| Inspections / deficiencies / penalties | COMPUTABLE (current loaded releases) |
| Staffing evidence | COMPUTABLE (4 PBJ quarters) |
| Ownership relationships | COMPUTABLE |
| States with enhanced licensing | **PARTIAL** (CA/NY/TX NH + AL) |
| Categories nationally complete | **NOT COMPUTABLE** as a boolean without the definition in §35 |
| Source freshness | **PARTIAL** (per `source_release`; not on homepage) |

No hard-coded homepage census. `CARE_ENABLE_PUBLIC_LAUNCH` still required for indexability.

## 30–31. Freshness / refresh

Per-source dates already exist (`source_modified_at`, `source_published_at`, `retrieved_at`, ingest `completed_at`, record `observed_at`/`effective_at`). Policy: `docs/DATA_FRESHNESS.md`.

**No scheduler.** Six months idle → July 2026 Care Compare vintage in production while CMS continues monthly drops. Recommend scheduled download+validate+load for PI, inspections, deficiencies, penalties, ownership, enrollments (monthly) and PBJ (quarterly). Do not implement the full scheduler in SEN-NAT-001.

## 32–33. Dedup + attribution

One CCN = one current facility. Name/operator/phone change must not mint a second `provider`. One chain ≠ one facility. One owner ≠ 200 owners.

Attribution already used: VERIFIED / PROBABLE / REVIEW_REQUIRED / UNRESOLVED / REJECTED. Exact CCN joins are CONFIRMED. Fuzzy NY NH matches are not CCN-equivalent. Unpublished unresolved evidence is already fail-closed on consumer views.

## 34. Rankings

None built. Guardrails in `docs/EDITORIAL_GUARDRAILS.md` / commercial policy. Do not add “worst homes” lists.

## 35. Definition of Senior National Complete

A testable gate, **not** “we have CMS files.”

**MUST COMPLETE BEFORE FLORIDA AHCA expansion**

1. CCN 1:1 current NH universe remains unique (regression test).
2. SFF / SFF Candidate / Abuse Icon are first-class dated claims from PI (no UI ranking).
3. Facility NPI attached from enrollments where CCN matches (no silent NPI merge).
4. MDS QM ingested with measure × facility × period, distinct from stars.
5. Inspection ≠ deficiency metrics stay distinct; unlinked findings remain visible as unlinked.
6. Ownership roles keep CMS wording; operator ≠ owner.
7. AL remains a separate identity namespace; no CCN merge by name.
8. Monthly/quarterly CMS refresh runbook exists and has been executed at least once after a new CMS drop **or** a scheduler is live.
9. Terminated-vs-not-in-file language is documented on profiles/sources.
10. Homepage/hub metrics, if any, are queried — never hard-coded.

**MAY CONTINUE AFTER FLORIDA STARTS**

- Home health + hospice national ingest
- Fire-safety citation file
- Deeper PBJ history (2017+)
- Additional state NH/AL adapters (NC, OH, …)
- Org→org PECOS graph
- Historical PI snapshot retention
- PACE / IRF / LTCH (mission review first)

Florida may start **after** the MUST list, even if HH/hospice are still zero — because FL AHCA is state expansion on top of the NH+AL identity rules, not a substitute for MDS/SFF/NPI/refresh.

## 36. Recommended execution plan

| Task | Objective | Depends on | Risk | Value | Type | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| **SEN-NAT-002** | NH evidence completion: SFF/abuse claims, facility NPI from enrollments, MDS QM ingest, fire-safety citations, CMS refresh runbook | This audit | Medium (MDS volume; SFF semantics) | Unblocks “NH nationally complete” and Florida | Ingest + first-class claims; **no** FL AHCA | MDS rows > 0; SFF 88 current claims; NPI on providers; documented refresh |
| **SEN-NAT-003** | Home health + hospice national spine (new `provider_type`, CCN series, no NH schema reuse) | 002 NPI/CCN discipline | High (new identity class) | Makes SeniorTrustHub more than NH pages | Architecture + ingest | HH and hospice counts from CMS files; separate profiles |
| **SEN-NAT-004** | Time-aware ownership/operator: `valid_to` or snapshot policy; org relationships only with source support; retain PI history | 002 | High (mis-expiring owners) | True “who operated this in 2022?” | Model + ingest | Dated operator/owner tenure without collapsing roles |
| **SEN-NAT-005** | Scheduled CMS refresh (monthly PI/regulatory/ownership; quarterly PBJ) | 002 runbook | Ops/credentials | Prevents silent staleness | Ops | Job runs; freshness visible per dataset |

Do not pad. Do not start Florida as SEN-NAT-002.

## 37. Risks / blockers

- Duplicate facilities if AL or HH is merged by name/address
- CCN/NPI confusion (NPI is org-level today)
- Calling every PECOS individual “owner”
- Stale owners if relationships never terminate
- Complaint survey ≠ violation
- AL coverage looks “national” if CA/NY/TX are summed with CMS NH
- Current PI ≠ historical operating status
- Hard-coded 14,693 on a homepage
- Manual ingest only
- 30,374 unlinked deficiencies if counted as inspections
- SFF sitting in JSON while consumers never see it
- `DATA_SOURCES.md` still says ownership is “PLANNED” — docs drift (not production drift)

## 38. Changes made

Diagnostic only: census scripts + this document + JSON snapshots. **No production data writes, no CCN rewrites, no Florida ingest, no profile redesign.**
