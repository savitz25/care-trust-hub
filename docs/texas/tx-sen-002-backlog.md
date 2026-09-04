# TX-SEN-002 backlog

Parked after TX-SEN-001. Do not scrape TULIP. Do not use child-care CCL SODA. No Texas county routes.

## State inspection / SOD / penalties

- Immediate Jeopardy PDF and ALF violations PDF were stopped (PDF-by-PDF).
- data.texas.gov had no easy NF/ALF/HCSSA statement-of-deficiencies or sanctions table in the bounded pass.
- Closure Excel is historical license actions, not inspection findings.
- HCSSA `ENFORCEMENT ACTION PEND` is a directory status field, not attached adverse evidence.

## Identity / crosswalk

- HHSC NF exact CCN join is 1,149 of 1,153 native Medicare numbers vs 1,177 CMS Nursing Homes. Unmatched rows stay unmatched.
- HCSSA Medicare Number ∩ CMS Home Health / Hospice is research-only. Licensed Home Health != Licensed and Certified Home Health != CMS Home Health.
- Do not name-only attach ALF or HCSSA to CMS.

## HCSSA semantics

- Personal Assistance, Licensed Home Health, Licensed and Certified Home Health, and Hospice overlap on the same rows.
- Branch / Alternate Delivery Site identities vs parent agencies.
- Administrator email is present on the HCSSA file and must stay unpublished.

## Completeness

- No complete Texas LTC roster (NF + ALF + HCSSA + DAHS + ICF).
- DAHS and ICF/IID were not acquired as bulk.
- Hospital-based NF.xlsx (6 rows) remains a sibling file.
- TULIP remains search-only.

## Product

- Do not mint thousands of new state-only profiles without exact ingest.
- Do not create `/texas/[county]` routes.
- Existing `/assisted-living/texas` landing remains the ALF class surface.
