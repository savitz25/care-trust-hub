# TH-ENRICH-B2 independent release packets

**Texas supersession (IDR2):** The earlier packet A used 744 in-home rows and is rejected by Evidence. Its SQL now stops before execution. Use [the Texas IDR2 Evidence handoff](tx-idr2-evidence-handoff.md) for the fresh 708/389/743 location snapshot, namespaced location grain, and unexecuted replacement load/rollback proposal. The older Texas counts below are historical and must not be used for a gate.

These are proposed, **unexecuted** internal loads. Founder approval is the production gate. The source and release hashes, row counts, and class boundaries are pinned in `data/enrichment/th-enrich-b2/release/release-receipt.json`; verify those files before any execution. No public roster or denominator changes are part of either load.

## A — Texas Senior: ready for Founder production gate

The authoritative HHSC `Facility ID` is unique within each file and across all three files: 708 ICF/IID, 389 DAHS, and 744 ISS-only, or **1,841 proposed new class-specific providers**. Exact comparison with owned Texas ALF facility IDs, ALF and nursing-facility licenses, and `STATE_TX` external IDs found **zero matches**. The source class is part of the external key and the table uniqueness constraint. The files have 1,787 distinct license-number **observations**: 1,785 rows claim `Facility Licensed=YES`, two have a number but claim `NO`, and 54 providers lack a license number. No license-number observations are promoted into active claims when the source says `NO`.

The proposed load is `tx-senior-load.psql`, using `release/tx/providers.csv` and `release/tx/credentials.csv`. It creates private source-specific tables, checks source SHA-256, counts, Facility ID uniqueness, license uniqueness, and current exact ownership again inside one transaction. The rows are `public_eligible=false`, with RLS enabled and client grants revoked. The matching `tx-senior-rollback.psql` removes only these source releases after checking the exact provider and credential counts. Neither script has run. The SQL requires a production migration review and a final read-only drift check at the Founder gate.

## B — California penalty evidence: ready for Founder production gate

`release/ca/exact_penalties.csv` contains **13,149 penalty events** tied by FACID to **1,117 unique already-owned providers**. It excludes all **1,593 unmatched FACIDs** and their **7,401 penalty rows**. The proposed `ca-penalty-load.psql` verifies every FACID and provider UUID against the owned `ca-cdph-healthcare-facility-locations` observation in the transaction, rejects collisions, and inserts evidence only. It creates no facility/provider records and changes the facility denominator by **zero**. Evidence remains private (`public_eligible=false`, RLS enabled, client grants revoked).

Rollback is deterministic: `ca-penalty-rollback.psql` requires exactly 13,149 evidence rows with the immutable source hash and batch key `TH-ENRICH-B2-CA-20240730`, then deletes only those rows in one transaction. Existing facility and source-observation records are never modified. Both SQL scripts remain unexecuted and need Founder approval.

## C — Illinois Move: resolved as unattached historical evidence

The staged official ICC legacy page contains 257 historical order cards, 55 household-goods tagged, and 256 unique docket strings. Two cards share docket `222748 MC Sub 0`; both source cards remain, with no presumed entity merge. The cards expose no USDOT, federal MC, or ILCC carrier number. `MC` in a docket is a proceeding label, not a federal carrier ID. The local Illinois Move authority snapshot has no row-level native-ID crosswalk. The connected Move database read-only SQL path times out even on `SELECT 1`, so query narrowing cannot recover a missing ID from these cards. The official docket detail endpoint returned a robot gate; no bypass or name-only matching was attempted.

Disposition: **HISTORICAL_EVIDENCE UNATTACHABLE — NO AUTHORITATIVE ID**. Authoritative exact bridges: **0 demonstrated**; all 257 cards remain unattached historical evidence. This is not a claim that none of those businesses exist in Move. No current mover roster or status is inferred.

## D — NY, FL, PA source access: partially resolved

- **NY storage warehouses:** the locally owned DCWP file is Home Improvement only; the official DCWP open-data API allows a category-bounded export. The branch contains just 55 Storage Warehouse licenses, 35 active, 8 expired, and 12 surrendered. It did not reload Home Improvement or the full DCWP master. This is a storage class, not a mover class.
- **FL adult day care:** official FloridaHealthFinder `Download as CSV` yielded 473 rows with 473 unique AHCA file numbers: 359 LICENSED, 111 IN REVIEW, 3 IN LITIGATION. Staged only.
- **FL nurse registry:** the same official export yielded 1,356 rows with 1,356 unique AHCA file numbers: 1,291 LICENSED, 65 IN REVIEW. Staged only, never residential facilities.
- **PA personal care, assisted living, assisted-living special care:** the DHS provider directory exposes search, with no authorized bulk identity export found. The monthly PCH report is aggregate; `pqf4-d4xn` lacks the license number needed for the identity spine. All three remain `SOURCE-ACCESS BLOCKED`; Scout counts are research estimates only.

NY and FL raw files, normalized subset CSVs, audits, and source-manifest entries are branch-local. They are not in packets A or B and have no proposed production load. The combined source-access disposition remains **BLOCKED by PA DHS bulk identity access**.

## Review and execution boundary

`python -m unittest scripts/test_th_enrich_b2.py -v` checks release counts, class separation, exact CA subset, and new official source subsets. The SQL was reviewed as proposed code but **not executed against a disposable PostgreSQL clone or production**. A Founder-approved operator should review the schema, verify release hashes from the receipt, perform final ownership and source-drift checks, and then run each packet independently with `psql -v ON_ERROR_STOP=1` from the repository root. Production mutations to date: **NO**.
