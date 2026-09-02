-- NJ-SEN-002 reconciliation. Read-only. Does not publish rows.

-- Source snapshots
SELECT dataset_key, content_sha256, row_count, baseline_only, retrieved_at, source_as_of
FROM state_source_snapshot
WHERE dataset_key IN ('nj-doh-penalty-letters', 'nj-doh-inspection-index')
ORDER BY retrieved_at DESC;

-- Document corpus
SELECT document_kind, remedy_type_canonical, text_extraction_status, COUNT(*)
FROM state_facility_document
WHERE regulator_code = 'NJ_DOH'
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- Match buckets
SELECT match_bucket, match_method, COUNT(*)
FROM state_facility_document_match_ledger
GROUP BY 1, 2
ORDER BY 1, 2;

-- Duplicate guards
SELECT source_document_id, COUNT(*)
FROM state_facility_document
WHERE regulator_code = 'NJ_DOH'
GROUP BY 1
HAVING COUNT(*) > 1;

SELECT event_identity, COUNT(*)
FROM state_facility_action
WHERE regulator_code = 'NJ_DOH'
GROUP BY 1
HAVING COUNT(*) > 1;

-- Unmatched official documents are retained
SELECT COUNT(*) AS unmatched_documents
FROM state_facility_document
WHERE regulator_code = 'NJ_DOH' AND facility_id IS NULL;

-- Publication gate
SELECT COUNT(*) AS accidentally_public
FROM state_facility_document
WHERE regulator_code = 'NJ_DOH' AND public_eligible = true;

-- Second-run monitor events (should be zero on the first snapshot)
SELECT event_kind, baseline_only, COUNT(*)
FROM state_facility_monitor_event
GROUP BY 1, 2
ORDER BY 1, 2;

-- Occurrences versus canonical documents
SELECT COUNT(*) AS occurrences FROM state_facility_document_occurrence;
SELECT COUNT(DISTINCT content_sha256) AS unique_hashes
FROM state_facility_document
WHERE regulator_code = 'NJ_DOH' AND content_sha256 IS NOT NULL;

-- Corpus scope
SELECT corpus_scope, COUNT(*)
FROM state_facility_document
WHERE regulator_code = 'NJ_DOH'
GROUP BY 1
ORDER BY 2 DESC;
