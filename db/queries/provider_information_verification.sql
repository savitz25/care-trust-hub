-- Usage: psql "$CARE_DATABASE_URL" -v ccn=015001 -f db/queries/provider_information_verification.sql
-- Supply a CCN you are authorized to inspect. These are evidence queries, not rankings.

SELECT p.id, pi.identifier_value AS ccn
FROM provider p
JOIN provider_identifier pi ON pi.provider_id = p.id
WHERE pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.identifier_value = :'ccn';

SELECT fs.*
FROM facility_snapshot fs
JOIN provider_identifier pi ON pi.provider_id = fs.provider_id
WHERE pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.identifier_value = :'ccn'
ORDER BY fs.retrieved_at DESC LIMIT 1;

SELECT sr.release_key, fs.source_record_locator, fs.retrieved_at
FROM facility_snapshot fs
JOIN provider_identifier pi ON pi.provider_id = fs.provider_id
JOIN source_release sr ON sr.id = fs.source_release_id
WHERE pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.identifier_value = :'ccn'
ORDER BY sr.release_key;

SELECT sd.dataset_key, sr.release_key, sr.content_sha256, ro.storage_key,
       fs.source_record_locator, fs.raw_record, ir.transformation_version, ir.status
FROM facility_snapshot fs
JOIN provider_identifier pi ON pi.provider_id = fs.provider_id
JOIN ingest_run ir ON ir.id = fs.ingest_run_id AND ir.source_release_id = fs.source_release_id
JOIN raw_object ro ON ro.id = fs.raw_object_id AND ro.source_release_id = fs.source_release_id
JOIN source_release sr ON sr.id = fs.source_release_id
JOIN source_dataset sd ON sd.id = sr.source_dataset_id
WHERE pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.identifier_value = :'ccn'
ORDER BY sr.release_key DESC;

SELECT state_code, count(*) AS providers FROM facility_snapshot GROUP BY state_code ORDER BY state_code;
SELECT count(*) AS providers_with_coordinates FROM facility_snapshot WHERE location IS NOT NULL;
