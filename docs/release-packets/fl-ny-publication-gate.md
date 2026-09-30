# TH-ENRICH-2026-09-30-PUB-GATE-PREP

**Unexecuted execution and rollback packets only.** No Texas, California, adult day care, Illinois, Pennsylvania, Contractor, or Investor data is in these two packets. Founder execution GO is required before running either load. Execute them independently against the named production project, from the repository root, using `psql -v ON_ERROR_STOP=1 -f <packet>`. The source and derived CSV SHA-256 values are in `data/enrichment/th-enrich-b2/publication-gate/receipt.json`.

Before either execution, run `python scripts/prepare_pub_gate_fl_ny.py --verify-fresh`. It re-downloads the official FloridaHealthFinder Nurse Registry CSV through its public export control and the NYC DCWP `business_category='Storage Warehouse'` subset through the official dataset API. It requires byte-identical source hashes; any file, row-count, native-ID, status, or category drift stops the gate for reconciliation. A fresh verification on 2026-09-30 passed for both sources. The SQL then computes the exact insert set against production under a table lock and aborts on ownership drift.

## Gate A — Florida Nurse Registry

Target: Care project `wiuiwgbablgyssuxrjho`, existing `public.state_licensed_provider` identity table. The official AHCA file number is the identity key; the license number and HealthFinder LID remain separate source fields. Existing exact class ownership and cross-class file-number matches were **0** on the 2026-09-30 read-only check. Proposed inserts at that check: **1,356**. SQL rechecks this count just before inserting and never creates a CMS, residential, assisted-living, nursing-home, or home-health identity.

| Raw status / condition | Rows | Exact display label | Existing publication state |
| --- | ---: | --- | --- |
| `LICENSED`, no closed date | 1,289 | `Licensed` | `PUBLISHABLE_CURRENT` |
| `LICENSED`, closed date present | 2 | `Licensed — closed date reported` plus the source closed date | `PUBLISHABLE_WITH_STATUS` |
| `IN REVIEW` | 65 | `In review` | `PUBLISHABLE_WITH_STATUS` |

The two licensed rows have reported closed dates **2026-03-19** and **2026-11-19**. The label reports the source fact and does not imply either row is simply active or already closed. The load adds nullable `closed_on`, `source_batch_id`, and `publication_status_label` fields to the existing table, preserves raw status, sets normalized status only for unqualified licensed rows, and inserts all 1,356 records from `fl_nurse_registry_load.csv`. The source export does not provide a distinct as-of date, so `source_as_of` is the recorded retrieval time **2026-09-30 14:40:36 UTC**. The [load](fl-nurse-registry-load.psql) and [rollback](fl-nurse-registry-rollback.psql) are transactional. Rollback requires exactly 1,356 matching class/hash/batch rows and aborts if downstream Florida attachments exist. Schema columns remain available after rollback; no other class rows are changed.

Gate A receipt: `SOURCE_ROWS=1356`, `ALREADY_OWNED_NOW=0`, `PROPOSED_INSERTS=1356`, `LICENSED=1291`, `IN_REVIEW=65`, `LICENSED_WITH_CLOSED_DATE=2`, `DUPLICATE_NATIVE_IDS=0`, `AMBIGUOUS=0`, `ROLLBACK_READY=YES`.

## Gate B — NYC storage warehouse licenses

Target: Move project `arepfylnilkjmyduhwbz`, new dedicated `public.nyc_dcwp_storage_warehouse_license` table. The table explicitly fixes jurisdiction to **NYC** and category to **Storage Warehouse**; it has no mover foreign key or USDOT/MC interpretation. All **55** distinct DCWP license numbers are retained: 35 Active, 12 Surrendered, 8 Expired. Public labels include the status; only `Active` may be counted as an active NYC warehouse license. Official source date is **2026-08-20**.

The [load](nyc-storage-warehouse-load.psql) creates a separate RLS-protected license table, allows read-only public access to the 55 status-qualified license rows, and aborts if that table already contains any rows. It never writes to Move company or authority tables. The [rollback](nyc-storage-warehouse-rollback.psql) requires exactly 55 rows with the pinned source hash and batch ID before deleting only that batch. `MOVER_BRIDGES_CREATED=0`; `MOVER_DENOMINATOR_CHANGE=0`.

The connected Move production SQL endpoint timed out on a read-only `SELECT 1` on 2026-09-30, so live target schema/ownership and SQL execution could not be verified. **Gate B remains blocked for execution** until the connection is working and its transaction preflight succeeds. No database timeout, index, or configuration was changed.

## Verification and boundary

The fresh official export hash check passed. `python -m unittest scripts/test_th_enrich_pub_gate.py -v` verifies the pinned CSVs, native IDs, status labels, exception dates, and class separation. Both SQL packets are proposed code and have not been executed on production or a disposable PostgreSQL clone. **PRODUCTION_MUTATIONS=NO**.
