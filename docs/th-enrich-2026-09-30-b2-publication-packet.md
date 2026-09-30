# TH-ENRICH-2026-09-30-B2 — local publication packet

Status: **BLOCKED for publication**. Production changed: **NO**. This packet is an isolated, unpublished staging result; no database migration, canonical merge, or public roster was made.

## Phase 0 ownership and identity inventory

| System | Existing ownership evidence | Identity key and class | Publication state before B2 |
| --- | --- | --- | --- |
| Florida AHCA | `db/migrations/0028_florida_state_licensed_provider.sql`, `0029_florida_license_status_and_external_key.sql`; no row-level release present in this worktree | `FL|AHCA|{provider_class}|{ahca_file_number}`; ALF, AFCH, adult day care, nurse registry are distinct allowed classes | Database design exists; class counts and row ownership cannot be proved locally |
| Pennsylvania DHS | `artifacts/pa-sen-001-public-snapshot.json` and `data/pennsylvania/pa-sen-001/raw/pch-monthly-august-2026.json` | PCH license number when present; AL and special care require separate source classes | PCH/AL directory coverage is `OPEN_SEARCH_ONLY`, rows and facility IDs null |
| Texas HHSC | `artifacts/tx-sen-001-public-snapshot.json` and existing nursing facility/ALF adapters; no owned ICF/IID or DAHS release found | New source-specific `Facility ID`; preserve `License No` separately | Existing TX nursing facility and ALF classes are separate |
| California CDPH | `artifacts/ca-sen-001-public-snapshot.json` describes owned ELMS 15,097-row FACID source, SHA-256 `60b2268223a60fd0fc7a55dd86cced0bced5010593c2f76f0cc9767f02026e6b`; row-level raw source absent here | ELMS `FACID`; penalty `PENALTY_NUMBER` is event identity | ELMS facilities already counted; Adult Residential 10,498 explicitly researched, not published |
| NYC DCWP | Existing acquisition is in Contractor repository `scripts/new-york-city/acquire_nyc_dcwp.py`, dataset `w7w3-xahh`; local artifact inspected was HIC-only and no full owned DCWP license row set was available | DCWP license ID, with Storage Warehouse distinct from Home Improvement and mover | 55 / ~35 Scout figures unverified here |
| Illinois ICC | No owned legacy MCIS order release found; new official HTML release acquired | Docket/order URL plus source card position; repeated docket needs event review | Historical evidence only |

The source manifest is `data/enrichment/th-enrich-b2/source-manifest.json`. It records official URLs, retrieval times, filenames, SHA-256 hashes, source grain and target class for all five acquired releases. Raw files are immutable. The acquisition script reuses a present file rather than downloading it again.

## Dataset QA (A–S)

Each row gives official source/file (A–C), raw/parsed/native IDs/duplicates (D–G), owned/new/bridges/unresolved/collisions (H–L), class/status/evidence/denominator (M–O), test/exception/stage/production (P–S). `?` means not measurable from the owned row-level evidence in this worktree; it never means zero.

| Dataset | Source and checksum | Rows / native IDs / duplicates | Ownership, bridge, unresolved, collision | Class, evidence, denominator, stage |
| --- | --- | --- | --- | --- |
| FL Assisted Living | AHCA FloridaHealthFinder locator; no local release/checksum | Scout ~3,022; parsed ?, IDs ?, duplicates ? | Owned schema exists; owned rows ?, new ?, exact bridges ?, unresolved ? | `FL_ALF`; no staging; denominator unchanged; search-only source is not bulk authority |
| FL Adult Family Care | Same locator; no local release/checksum | Scout ~228; parsed ?, IDs ?, duplicates ? | Same identity evidence gap | `FL_AFCH`; no staging; denominator unchanged |
| FL Adult Day Care | Same locator; no local release/checksum | Scout ~471; parsed ?, IDs ?, duplicates ? | Same identity evidence gap | `FL_ADULT_DAY_CARE`; no staging; denominator unchanged |
| FL Nurse Registry | Same locator; no local release/checksum | Scout ~1,350; parsed ?, IDs ?, duplicates ? | Same identity evidence gap | `FL_NURSE_REGISTRY`; business/provider class, not residential facility; denominator unchanged |
| PA Personal Care | DHS provider search; existing PCH monthly report is aggregate; no directory release/checksum | Scout 994; parsed ?, IDs ?, duplicates ? | Existing `OPEN_SEARCH_ONLY`; `pqf4-d4xn` has no license number and is not an identity spine; exact bridge ? | PCH only; no staging; denominator unchanged |
| PA Assisted Living | DHS provider search; no directory release/checksum | Scout 29; parsed ?, IDs ?, duplicates ? | Existing `OPEN_SEARCH_ONLY`; exact bridge ? | AL only; no staging; denominator unchanged |
| PA Assisted Living Special Care | DHS provider search; no directory release/checksum | Scout 35; parsed ?, IDs ?, duplicates ? | Exact bridge ? | Special Care only; no staging; denominator unchanged |
| TX ICF/IID | HHSC `ICFIID.xlsx`; `dddf847544af07c80cfa3c25e4b7d8f9dedc28696e6c14f5dd307636ea67f450` | 708/708; 708 Facility IDs; 0 duplicate IDs; 654 nonblank distinct license numbers | No owned ICF row-level spine found; 708 candidate keys; exact existing bridges ?; no in-file ID collision | ICF/IID only; 652 `Facility Licensed=YES`, 56 `NO`; 705 certified `YES`, 3 `NO`; staged unpublished |
| TX DAHS | HHSC `DAHS.xlsx`; `fd2ff2772ac2144bc6d363e4d1b2333d59cf4b15879ec357328ca37258423bc7` | 389/389; 389 Facility IDs; 0 duplicate IDs | No owned DAHS row-level spine found; 389 candidate keys; exact bridges ? | 341 DAHS, 48 DAHS-ISS; all licensed `YES`, certified `NO`; staged unpublished |
| TX ISS only | HHSC `dahs_issonly.xlsx`; `f9bdf6d39a118b4a4ff293674bab46416237cdfe51ad81a55f862aa7c94d1860` | 744/744; 744 Facility IDs; 0 duplicate IDs | No owned ISS-only row-level spine found; 744 candidate keys; exact bridges ? | 744 DAHS-ISSONLY; all licensed `YES`, 743 certified `NO`, 1 `YES`; staged unpublished |
| CA penalties | CDPH `sea_final_20240730.xlsx`; `95f7fc0eab84032497250e9a69fdf7902c594f0cbcff6abc159b86b526812536` | 20,550/20,550; 2,710 FACIDs; 20,550 unique penalty numbers; no duplicate penalty numbers | ELMS source already owned, but raw FACID list unavailable; exact FACID bridges and unmatched FACIDs ? | 16,411 Citation, 1,955 Failure to Report Penalty, 2,184 Administrative Penalty; issue dates 1998-05-27 to 2024-06-28; evidence only, 0 new facilities; staged unpublished |
| NY storage warehouse | Already owned NYC DCWP dataset `w7w3-xahh`; no usable local full source/checksum | Scout 55/~35 active; parsed ?, native IDs ?, duplicates ? | HIC-only local artifact cannot prove warehouse subset; no re-ingest; exact bridges ? | Storage Warehouse business class, never mover; no stage or denominator change |
| IL legacy MCIS orders | ICC `mcis-legacy` HTML; `769ab7461029ba52b4643465bfe49ceea1f95733b5c073133bb49ea372fa6aa3` | 257/257 cards; 256 unique docket strings; 1 duplicate docket string | Existing carrier row-level ID not supplied; exact carrier bridges ?, unmatched ?; duplicated `222748 MC Sub 0` card preserved twice | 55 household-goods-tagged; historical evidence only, 0 current movers; staged unpublished |

The three Texas titles state **active license directory as of 2026-09-28**. Scout's 709 ICF/IID and 740 ISS-only were estimates; the downloaded workbook has 708 and 744 nonblank data rows respectively. ICF/IID contains 56 rows with `Facility Licensed=NO`, so the source title alone must not override each row's license field. Texas identity uses `Facility ID`; license number is a separate attribute. The ICF/IID and day-program files are never combined.

California categories, facility type distributions, event semantics, and Texas status distributions are in `data/enrichment/th-enrich-b2/audit.json`. The California file's coverage ends 2024-06-30 per the official dataset description; the latest **penalty issue date** in the file is 2024-06-28. `PENALTY_NUMBER` is unique in this release. A penalty is an event, never a facility.

Illinois source cards include the docket URL, filed date, business identity text, description, authority labels, and household-goods flag. `222748 MC Sub 0` appears twice with the same URL/date and slightly different party wording; retain both source cards until an event-level deduplication decision is reviewed. Historical orders do not establish current authority.

## Totals and publication gate

- **Confirmed genuinely new identities:** unknown until exact reconciliation. **Staged Texas candidate keys:** 1,841 (708 + 389 + 744), each unique within its source class. **Promoted identities:** 0.
- **Staged evidence rows:** 20,807 (20,550 California penalties + 257 Illinois order cards). This is 20,806 distinct `PENALTY_NUMBER`/docket strings only if the two unrelated namespaces are counted together, which is not a provider count.
- **Exact bridge count:** unknown. No name-only bridges were made. Unresolved queue: all 2,710 California FACIDs, 1,841 Texas candidate keys against ownership, 257 Illinois cards, and the four FL/three PA/NY source classes requiring row-level proof. These are work queues, not assertions of nonmatch.
- **Denominators before / potential after:** existing class counts are not all locally available. Production denominators remain unchanged. Potential new Texas class counts are 708 ICF/IID, 389 DAHS and 744 ISS-only, subject to source ownership reconciliation and publication review. California penalty and Illinois order denominator delta is exactly 0. Florida, Pennsylvania and NYC potential changes are unmeasured.
- **Tests:** `python -m unittest scripts/test_th_enrich_b2.py -v` passed 2/2; checks manifest hashes, staged row/class integrity, unique Texas Facility IDs, and evidence denominator boundaries.
- **Excluded:** NJ/NY/IL request-only current mover rosters, all unfiled records requests, already acquired data, Move TX–MA without complete Source Cards, insurance, Contractor/Investor scope, and My TrustHub V2.

Founder publication approval would need a reviewed row-level owned-source comparison for Texas and California, a verified NYC DCWP warehouse subset from the owned license file, approved bulk/source cards or a bounded lawful extract for Florida and Pennsylvania, and a Move owner review of Illinois carrier bridges. The proposed publish operation is **none** until these checks resolve; no production SQL or deployment is included here.
