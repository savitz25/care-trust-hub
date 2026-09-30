# Texas HHSC regulated locations — IDR2 Evidence handoff

Branch-only packet, prepared 2026-09-30. **No production SQL was executed.** The prior 1,841-location / 744 in-home packet is rejected and its proposed load/rollback scripts now stop before execution.

## Official source reconciliation

Fresh downloads from the [Texas HHSC provider directory](https://apps.hhs.texas.gov/providers/directories/) were saved separately under `data/enrichment/th-enrich-b2/idr2/raw/`. The three workbook titles each say **as of 2026-09-29**. The prior workbooks remain immutable.

| Class | Official file | Fresh SHA-256 | Worksheet rows × columns | Data locations | License observations |
| --- | --- | --- | ---: | ---: | ---: |
| ICF/IID | [ICFIID.xlsx](https://apps.hhs.texas.gov/providers/directories/ICFIID.xlsx) | `20548d8398104d2a882cd018fff31786ccc77c4412b6874d5e1fada31ca02ab1` | 710 × 40 | 708 | 654 |
| DAHS | [DAHS.xlsx](https://apps.hhs.texas.gov/providers/directories/DAHS.xlsx) | `ec962e57112d6600b4deec292eaee5e0620e70b5413eea71d52078a3c4dcba8f` | 391 × 40 | 389 | 389 |
| In-home-only | [dahs_issonly.xlsx](https://apps.hhs.texas.gov/providers/directories/dahs_issonly.xlsx) | `1de6e81addd37ea016be4c2cdbd50a08648f2348c694ef0e4d9eee0eee1bd381` | 745 × 40 | 743 | 743 |

Each workbook has one title row and one header row. Totals: **1,840 locations, 1,786 license-number observations**. All native Facility IDs are unique within class; all 1,840 namespaced keys are unique. No bare Facility ID occurs in two of these three current files. The workbook row's `Facility Licensed` and `Facility Certified` fields are preserved independently of the directory title.

Prior `dahs_issonly.xlsx` (744 data rows) contained Facility ID `112184`, `WE ROCK THE SPECTRUM WEST HOUSTON`, License No `313235`; the current 743-row official workbook does not. The source gives **no removal reason**. It may reflect a source change, but no closure, revocation, or entity event is inferred. This key and its license observation are excluded from IDR2. A future reappearance stops the builder for drift review.

## Native identity and model audit

Proposed key: **`TX|HHSC|<provider_class>|<Facility ID>`**, with the class one of `TX_ICF_IID`, `TX_DAHS`, `TX_DAHS_ISS_ONLY` and the Facility ID retained exactly as sourced, including leading zeros. The key derives only from authority, jurisdiction, class, and native Facility ID. It cannot equal a bare CMS CCN or another issuer's key; different Texas classes remain distinct even if a number is reused. The key is stable across source refreshes. License No is a separate observation, never the location identity.

Read-only live model inspection found no `tx_hhsc_provider`/`tx_hhsc_location` table. `provider`/`facility_snapshot` are the generic CMS-oriented facility spine and carry publication-sensitive provider semantics. `assisted_living_provider` is class-specific and would misclassify ICF/DAHS. `state_program_location` requires an organization ID and is for community programs; `state_facility_identity` is not deployed and requires a license number, which 54 ICF locations lack. A **small private `tx_hhsc_location` table plus license-observation table is therefore required**. The proposed location table has a nullable `organization_id` referencing the existing organization table; no organization row is inserted. Multiple location rows may later point to one independently certified organization without changing their native keys.

Read-only production query at **2026-09-30 19:20 UTC** found no `TX_HHSC` `provider_identifier` rows, no `TX|HHSC|...` identifier values, no `TX_%` provider types, and no source-specific Texas location table. The existing 1,996 TX assisted-living rows all use `TX_HHSC_ALF`; none has an IDR2 namespaced external key. Because the entire target keyspace is empty, the exact membership comparison for all 1,840 proposed keys yields **0 existing location matches** and **1,840 new location candidates**. The load packet repeats ownership and fingerprint checks inside its transaction. A future run must recompute live ownership; these figures are preparation-time evidence, not a perpetual assertion.

Recheck query (read only):

```sql
SELECT to_regclass('public.tx_hhsc_location') AS location_table;
SELECT count(*) FROM public.provider_identifier
WHERE issuer='TX_HHSC' OR identifier_value LIKE 'TX|HHSC|%';
SELECT count(*) FROM public.assisted_living_provider
WHERE state_code='TX' AND external_key LIKE 'TX|HHSC|%';
```

| Class | Source rows | Exact existing location matches | New candidates | Duplicate namespaced keys | Ambiguous | Cross-class key collisions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ICF/IID | 708 | 0 | 708 | 0 | 0 | 0 |
| DAHS | 389 | 0 | 389 | 0 | 0 | 0 |
| In-home-only | 743 | 0 | 743 | 0 | 0 | 0 |

## Status and license observations

| Class | Program type | Facility Licensed | Facility Certified | Numbered license observations | No license number |
| --- | --- | --- | --- | ---: | ---: |
| ICF/IID | 708 ICF/IID | 652 YES; 56 NO | 705 YES; 3 NO | 654 (652 YES, 2 NO) | 54 |
| DAHS | 341 DAHS; 48 DAHS-ISS | 389 YES | 389 NO | 389 | 0 |
| In-home-only | 743 DAHS-ISSONLY | 743 YES | 742 NO; 1 YES | 743 | 0 |

The two ICF/IID rows with a license number and `Facility Licensed=NO` remain raw license-number observations, not active-license claims. No number is invented for the other 54.

## Unexecuted publication packet

- Transformation: `scripts/th-enrich-tx-idr2.py` reads only the fresh official files, checks the 2026-09-29 workbook titles and exact 708/389/743 counts, rejects `112184`, builds namespaced keys and record hashes, and emits `idr2/release/locations.csv`, `license_observations.csv`, and `receipt.json`.
- Proposed load: `tx-idr2-load.psql` stages the two CSVs, checks pinned class/source hashes and counts, verifies exact ownership, then proposes private location and license-observation tables with row-level class/key constraints. `organization_id` remains NULL and `public_eligible=false`. `ON CONFLICT DO NOTHING` makes an identical rerun add zero duplicates; differing records abort.
- Proposed rollback: `tx-idr2-rollback.psql` requires precisely 1,840 batch locations and 1,786 batch license observations, matching source hashes, no organization bridges, and no public rows; it deletes only that batch's observations and locations. It never touches CMS, ALF, organizations, or other batches.
- Future gate: re-fetch all three official files, compare byte hashes and workbook counts, recompute exact live ownership, review the new schema/SQL and CSV hashes, then seek Founder execution authorization. Evidence Activation should independently reparse, recalculate keys and statuses, confirm `112184` exclusion, and inspect live ownership before certifying.

```text
CANONICAL_ORGANIZATIONS_CREATED = 0
SCHEMA_CHANGE_REQUIRED = YES (two private Texas location/observation tables)
ROLLBACK_READY = YES (proposed and bounded; unexecuted)
PRODUCTION_MUTATIONS = NO
```
