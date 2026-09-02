# NJ-SEN-004 production runbook

Database execution is pending until an authorized `CARE_DATABASE_URL` is present.

Do not request credentials. Do not print secrets. Do not run `vercel link` or `vercel deploy`.

## Verify

1. Confirm the database is SeniorTrustHub.
2. Record current `schema_migrations` / applied files.
3. Record pre-execution counts from `docs/sql/nj-sen-004-reconciliation.sql`.

## Apply migrations in order

```text
python -m care_ingest apply-migration 0032_nj_doh_facility_identity.sql --database-url "$CARE_DATABASE_URL"
python -m care_ingest apply-migration 0033_state_facility_documents.sql --database-url "$CARE_DATABASE_URL"
python -m care_ingest apply-migration 0034_state_program_metrics.sql --database-url "$CARE_DATABASE_URL"
python -m care_ingest apply-migration 0035_state_service_area_regulated_org.sql --database-url "$CARE_DATABASE_URL"
```

## Execute prior tickets twice

```text
python -m care_ingest ingest-nj-doh-ltc --input data/raw/nj-doh-ltc/All_LTC.xlsx --execute --database-url "$CARE_DATABASE_URL"
python -m care_ingest ingest-nj-doh-ltc --input data/raw/nj-doh-ltc/All_LTC.xlsx --execute --database-url "$CARE_DATABASE_URL"
python -m care_ingest ingest-nj-doh-enforcement --index-html data/raw/nj-doh-enforcement/penalty_letters.html --execute --database-url "$CARE_DATABASE_URL"
python -m care_ingest ingest-nj-doh-enforcement --index-html data/raw/nj-doh-enforcement/penalty_letters.html --execute --database-url "$CARE_DATABASE_URL"
python -m care_ingest ingest-nj-nh-staffing --input data/raw/nj-doh-staffing/report_2026_Q1.html --execute --database-url "$CARE_DATABASE_URL"
python -m care_ingest ingest-nj-assisted-living-rates --input data/raw/nj-medicaid-al/SFY_2026_Assisted_Living_Rates.pdf --execute --database-url "$CARE_DATABASE_URL"
python -m care_ingest ingest-nj-pace --input data/raw/nj-pace/doas_pace.html --execute --database-url "$CARE_DATABASE_URL"
```

## Execute NJ-SEN-004

```text
python -m care_ingest ingest-nj-doh-acute --input data/raw/nj-doh-acute/All_Acute.xlsx --dry-run
python -m care_ingest ingest-nj-doh-acute --input data/raw/nj-doh-acute/All_Acute.xlsx --execute --database-url "$CARE_DATABASE_URL"
python -m care_ingest ingest-nj-doh-acute --input data/raw/nj-doh-acute/All_Acute.xlsx --execute --database-url "$CARE_DATABASE_URL"
python -m care_ingest rematch-nj-doh-enforcement --index-html data/raw/nj-doh-enforcement/penalty_letters.html --pdf-dir data/raw/nj-doh-enforcement/pdfs --dry-run
```

Confirm:

- Zero duplicate snapshots for the same `(dataset_key, content_sha256)`
- Zero duplicate All_Acute identities
- First observation remains `baseline_only=true`
- `public_eligible=false`
- No `/new-jersey` route
