-- Read-only bounded oracle. This is not a CI production query or a data update.
-- Exact canonical identifier presence (000000 and 105502 were absent in this window).
SELECT identifier_value AS ccn, count(*) AS canonical_identifier_rows
FROM provider_identifier
WHERE issuer='CMS' AND identifier_type='CCN' AND valid_from IS NULL
  AND identifier_value IN ('000000','105502','455799')
GROUP BY identifier_value ORDER BY 1;

-- Independently count source-native observations for the verified public CCN.
WITH target AS (
 SELECT provider_id FROM provider_identifier WHERE issuer='CMS' AND identifier_type='CCN'
 AND valid_from IS NULL AND identifier_value='455799'
), latest AS (
 SELECT DISTINCT ON(sr.source_dataset_id) sr.id
 FROM source_release sr JOIN ingest_run ir ON ir.source_release_id=sr.id AND ir.status='succeeded'
 JOIN source_dataset sd ON sd.id=sr.source_dataset_id
 WHERE sd.dataset_key IN ('nursing-home-ownership','skilled-nursing-facility-all-owners',
 'skilled-nursing-facility-enrollments','nursing-home-penalties')
 ORDER BY sr.source_dataset_id,sr.source_modified_at DESC NULLS LAST,
 sr.source_release_date DESC NULLS LAST,sr.release_key DESC
)
SELECT 'ownership_relationship' AS grain,sd.dataset_key,sr.release_key,sr.content_sha256,
 sr.source_modified_at,sr.retrieved_at,count(*) AS observations
FROM provider_ownership_relationship r JOIN target t ON t.provider_id=r.provider_id
JOIN latest l ON l.id=r.source_release_id JOIN source_release sr ON sr.id=l.id
JOIN source_dataset sd ON sd.id=sr.source_dataset_id GROUP BY 1,2,3,4,5,6
UNION ALL
SELECT 'penalty',sd.dataset_key,sr.release_key,sr.content_sha256,
 sr.source_modified_at,sr.retrieved_at,count(*)
FROM penalty_enforcement r JOIN target t ON t.provider_id=r.provider_id
JOIN latest l ON l.id=r.source_release_id JOIN source_release sr ON sr.id=l.id
JOIN source_dataset sd ON sd.id=sr.source_dataset_id GROUP BY 1,2,3,4,5,6;
