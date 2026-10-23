/** Presentation-only collapse. Does not delete provider_organization_edge rows. */
export const COLLAPSED_PARTY_SQL = `
SELECT relationship_type, temporal_status, party_kind, raw_role_text,
       ownership_percentage::text, effective_from::text, display_name, party_id,
       organization_id::text, confidence, observation_count, observed_from, observed_through
FROM (
  SELECT DISTINCT ON (e.ownership_party_id, e.relationship_type)
    e.relationship_type,
    e.temporal_status,
    e.party_kind,
    e.raw_role_text,
    e.ownership_percentage,
    e.effective_from,
    op.display_name,
    op.id AS party_id,
    e.organization_id,
    e.confidence,
    count(*) OVER (PARTITION BY e.ownership_party_id, e.relationship_type)::int AS observation_count,
    min(e.effective_from) OVER (PARTITION BY e.ownership_party_id, e.relationship_type)::text AS observed_from,
    max(e.effective_from) OVER (PARTITION BY e.ownership_party_id, e.relationship_type)::text AS observed_through
  FROM provider_organization_edge e
  JOIN ownership_party op ON op.id = e.ownership_party_id
  WHERE e.provider_id = $1::uuid
    AND e.relationship_type IN ('OWNED_BY','OPERATED_BY','MANAGED_BY','ENROLLED_UNDER')
  ORDER BY e.ownership_party_id, e.relationship_type,
    CASE e.temporal_status WHEN 'CURRENT' THEN 0 WHEN 'HISTORICAL' THEN 1 ELSE 2 END,
    e.effective_from DESC NULLS LAST
) collapsed
ORDER BY relationship_type, temporal_status, display_name
`;

export const PUBLIC_AGENCY_CHOW_SQL = `
SELECT e.id::text, e.effective_date::text, e.change_type_code, e.change_type_text,
       e.normalized_event_type, e.confidence, e.source_dataset_key,
       e.raw_record->>'ORGANIZATION NAME - BUYER' AS buyer,
       e.raw_record->>'ORGANIZATION NAME - SELLER' AS seller,
       sr.source_modified_at::text AS file_dated
FROM ownership_change_event e
LEFT JOIN source_release sr ON sr.id = e.source_release_id
WHERE e.provider_id = $1::uuid
  AND e.source_dataset_key = ANY($2::text[])
  AND e.event_status = 'VERIFIED'
  AND e.confidence = 'EXACT'
  AND e.public_eligible IS TRUE
  AND e.not_seen IS NOT TRUE
ORDER BY e.effective_date, e.id
`;
