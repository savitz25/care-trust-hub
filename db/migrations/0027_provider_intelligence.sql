BEGIN;

-- SEN-NAT-009: provider-scoped read indexes for Profile Intelligence.
-- Does not duplicate MDS/PBJ/graph rows and does not create public routes.

CREATE INDEX IF NOT EXISTS cms_agency_quality_provider_idx
  ON cms_agency_quality_observation (provider_id, measure_family)
  WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cms_agency_service_zip_provider_idx
  ON cms_agency_service_zip (provider_id)
  WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cms_agency_service_offering_provider_idx
  ON cms_agency_service_offering (provider_id)
  WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS home_health_snapshot_provider_idx
  ON home_health_snapshot (provider_id);
CREATE INDEX IF NOT EXISTS hospice_snapshot_provider_idx
  ON hospice_snapshot (provider_id);
CREATE INDEX IF NOT EXISTS provider_identifier_type_value_idx
  ON provider_identifier (identifier_type, identifier_value);

COMMENT ON INDEX cms_agency_quality_provider_idx IS
  'SEN-NAT-009 provider-scoped quality family lookups. Not a materialization of measures.';

COMMIT;
