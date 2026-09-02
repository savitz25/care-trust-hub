# NJ-SEN-002 — NJDOH penalty letters and state enforcement corpus

Official index: https://www.nj.gov/health/healthfacilities/surveys-insp/enforcement_actions.shtml

Overview: https://www.nj.gov/health/healthfacilities/enforcement_actions.shtml

Identity spine: NJ-SEN-001 All_LTC.xlsx (893 licensed facilities).

Do not commit PDFs or the index HTML. Store them under the ignored `data/raw/nj-doh-enforcement/` tree.

```text
python -m care_ingest ingest-nj-doh-enforcement --download-index --inspect-only
python -m care_ingest ingest-nj-doh-enforcement --index-html data/raw/nj-doh-enforcement/penalty_letters.html --identity-xlsx data/raw/nj-doh-ltc/All_LTC.xlsx --pdf-dir data/raw/nj-doh-enforcement/pdfs --dry-run
python -m care_ingest ingest-nj-doh-enforcement --input-index data/raw/nj-doh-enforcement/penalty_letters.html --identity-xlsx data/raw/nj-doh-ltc/All_LTC.xlsx --pdf-dir data/raw/nj-doh-enforcement/pdfs --download-pdfs --write-reports docs/data --dry-run
python -m care_ingest ingest-nj-doh-enforcement --sample-inspections --dry-run
python -m care_ingest apply-migration 0033_state_facility_documents.sql --database-url "$CARE_DATABASE_URL"
python -m care_ingest ingest-nj-doh-enforcement --index-html data/raw/nj-doh-enforcement/penalty_letters.html --execute --database-url "$CARE_DATABASE_URL"
python -m care_ingest ingest-nj-doh-enforcement --index-html data/raw/nj-doh-enforcement/penalty_letters.html --execute --database-url "$CARE_DATABASE_URL"
```

First snapshot is baseline-only. `public_eligible` stays false. No `/new-jersey` page.

Penalty dollars are stored as cents and are not a rating. A posted letter is not inferred to be a final order, CMS event, resident-harm finding, active sanction, or closure.

Index rows are name-only. Auto-attachment requires an exact license/FacID from the PDF, unique name+address, unique name+city, or a documented alias. Name-only is never auto-attached. Owner-company names are not attached to every owned facility.

Inspection/SOD pages are public GET URLs keyed by FacID (`fsCertDetails.aspx`, `fsCompDetails.aspx`, `fssurvey.aspx`). CMS-form SOD content is not copied into national `deficiency_finding`.

Documents discovered from the NJDOH public enforcement indexes, with source availability varying by year. First snapshot is baseline-only.

Acquisition ledger: `docs/data/nj-sen-002-acquisition-ledger.jsonl`  
Summary: `docs/data/nj-sen-002-acquisition-summary.json`  
Missing-document request: `docs/nj-sen-002-missing-documents.md`
