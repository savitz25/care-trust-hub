BEGIN;

-- Additive hospice measure fields. Not applied by the HH/Hospice CHOW pilot.
-- Existing rows keep NULL statistic metadata. No backfill.

ALTER TABLE cms_agency_quality_observation
  ADD COLUMN IF NOT EXISTS statistic_type text,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS denominator text,
  ADD COLUMN IF NOT EXISTS suppression_state text;

ALTER TABLE cms_agency_quality_observation
  DROP CONSTRAINT IF EXISTS cms_agency_quality_observation_availability_check;
ALTER TABLE cms_agency_quality_observation
  ADD CONSTRAINT cms_agency_quality_observation_availability_check CHECK (
    availability IN (
      'REPORTED', 'SUPPRESSED', 'NOT_AVAILABLE', 'INSUFFICIENT_DATA', 'NOT_APPLICABLE'
    )
  );

ALTER TABLE cms_agency_quality_observation
  DROP CONSTRAINT IF EXISTS cms_agency_quality_statistic_type_check;
ALTER TABLE cms_agency_quality_observation
  ADD CONSTRAINT cms_agency_quality_statistic_type_check CHECK (
    statistic_type IS NULL OR statistic_type IN (
      'DENOMINATOR', 'STAR_RATING', 'TOP_BOX', 'MIDDLE_BOX', 'BOTTOM_BOX',
      'OBSERVED', 'LINEAR', 'NATIONAL', 'OTHER'
    )
  );

ALTER TABLE cms_agency_quality_observation
  DROP CONSTRAINT IF EXISTS cms_agency_quality_unit_check;
ALTER TABLE cms_agency_quality_observation
  ADD CONSTRAINT cms_agency_quality_unit_check CHECK (
    unit IS NULL OR unit IN ('percent', 'star', 'count', 'rate')
  );

-- Existing rows may have a star with a NULL statistic_type. New hospice loads
-- set statistic_type and only store star_rating for a reported star statistic.
ALTER TABLE cms_agency_quality_observation
  DROP CONSTRAINT IF EXISTS cms_agency_quality_star_statistic_check;
ALTER TABLE cms_agency_quality_observation
  ADD CONSTRAINT cms_agency_quality_star_statistic_check CHECK (
    star_rating IS NULL
    OR statistic_type IS NULL
    OR (statistic_type = 'STAR_RATING' AND availability = 'REPORTED')
  );

COMMENT ON COLUMN cms_agency_quality_observation.statistic_type IS
  'Hospice measure statistic derived from the measure-code suffix. NULL on earlier rows.';
COMMENT ON COLUMN cms_agency_quality_observation.suppression_state IS
  'NONE when availability is REPORTED; otherwise the availability state.';

COMMIT;
