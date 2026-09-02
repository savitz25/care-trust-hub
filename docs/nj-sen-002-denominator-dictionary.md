# NJ-SEN-002 denominator dictionary

Documents discovered from the NJDOH public enforcement indexes, with source availability varying by year.

All figures below use one of two grains. They are not interchangeable.

## Grains

**Indexed occurrence.** One public index URL after duplicate-href collapsing. NJ-SEN-002 has **1,146**.

**Downloaded occurrence.** An indexed occurrence whose PDF bytes were retrieved and SHA-256 hashed. **1,144**.

**Source-unavailable occurrence.** An indexed occurrence that returned HTTP 404/410 after the controlled retry. **2**.

**Canonical document / unique hash.** Distinct SHA-256 of downloaded PDF bytes. **1,131**.

**Duplicate-content occurrence.** A downloaded occurrence whose hash already appears on another URL. Count = downloaded − unique hashes = **13**. There are **10** duplicate-content groups (one group of 5 and nine groups of 2: 4 + 9 = 13 extras).

**Parsed document.** An indexed occurrence passed through the document assembler, including the two unavailable rows (those have extraction status `not_downloaded`). **1,146**.

**Classified document.** An occurrence assigned a `document_class` from the index action text (`INDEX_METADATA`). Every parsed occurrence is classified, including `unclassified_regulatory_document`. **1,146**.

**Index-only classified.** Classification uses the index “Enforcement Action” column. Image-only PDFs are still index-classified.

**Text-classified.** Additional fields (FacID, amount, address) extracted from a PDF text layer. Does not replace index classification.

**Image-only document.** Downloaded PDF with no usable text layer. OCR backlog; not OCR’d in this ticket.

## Equations

1. **Index level (occurrence grain)**  
   1,146 indexed = 1,144 downloaded + 2 source-unavailable.

2. **Content level (occurrence grain)**  
   1,144 downloaded = 1,131 unique hashes + 13 duplicate-content occurrences.

3. **Extraction level (occurrence grain, including unavailable)**  
   1,146 parsed = 511 TEXT_EXTRACTED + 1 PARTIAL_TEXT + 632 IMAGE_ONLY_OCR_REQUIRED + 2 SOURCE_UNAVAILABLE.  
   Canonical-hash extraction is not a separate stored grain; duplicate URLs share bytes.

4. **Classification level (occurrence grain)**  
   1,146 = index-classified named classes + unclassified.  
   Named classes in the corpus summary: penalty_letter 660 + directed_plan_of_correction 100 + admission_curtailment 221 + license_revocation 4 + other 113 + unclassified 30 + license_suspension 12 + civil_monetary_penalty 5 + corrective_action 1 = **1,146**.  
   A prior report table that summed to **1,046** omitted the 100 directed-plan-of-correction rows. That was a presentation omission, not missing documents.

5. **Scope level (occurrence grain)**  
   1,146 = 376 LTC matched + 294 LTC review-required + 119 acute/other + 9 non-facility + 346 unresolved + 2 source-unavailable.

6. **Facility identity (occurrence grain)**  
   - 376 LTC matched scope = 300 EXACT + 76 HIGH_CONFIDENCE.  
   - 294 LTC review-required scope = 3 REVIEW_REQUIRED match-bucket + 291 UNSAFE_REJECTED (name-only against the 893-row spine).  
   - 476 unresolved match-bucket = 346 unresolved-scope + 119 acute/other + 9 non-facility + 2 unavailable.  
   Non-LTC rows are not unresolved LTC identity failures.

Public eligibility remains false. First corpus is baseline-only.
