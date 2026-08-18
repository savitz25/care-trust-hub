BEGIN;

CREATE OR REPLACE VIEW published_facility_history_event AS
SELECT e.*
FROM facility_history_event e
WHERE e.publication_eligible = true;

COMMENT ON VIEW published_facility_history_event IS
  '016/017/018 consumer-readable facility-history events, including state enforcement columns.';

COMMIT;
