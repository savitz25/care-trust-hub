from __future__ import annotations

import json
import os
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

with psycopg.connect(os.environ["CARE_DATABASE_URL"], autocommit=True) as conn:
    conn.execute("SET statement_timeout = '30s'")
    hh = conn.execute(
        """
        SELECT s.cms_ccn, s.provider_name, s.state_code, s.quality_of_patient_care_star,
               (SELECT count(*) FROM provider_organization_edge e WHERE e.provider_id=s.provider_id) owners,
               (SELECT count(*) FROM cms_agency_quality_observation q WHERE q.provider_id=s.provider_id) measures
        FROM home_health_snapshot s
        ORDER BY measures DESC NULLS LAST
        LIMIT 8
        """
    ).fetchall()
    hh_sparse = conn.execute(
        """
        SELECT s.cms_ccn, s.provider_name, s.state_code, s.quality_of_patient_care_star
        FROM home_health_snapshot s
        WHERE s.quality_of_patient_care_star IS NULL
        ORDER BY s.provider_name
        LIMIT 3
        """
    ).fetchall()
    hospice = conn.execute(
        """
        SELECT s.cms_ccn, s.provider_name, s.state_code,
               (SELECT count(*) FROM cms_agency_quality_observation q WHERE q.provider_id=s.provider_id) measures,
               (SELECT count(*) FROM provider_organization_edge e WHERE e.provider_id=s.provider_id) owners
        FROM hospice_snapshot s
        ORDER BY measures DESC NULLS LAST
        LIMIT 8
        """
    ).fetchall()
    print(json.dumps({"hh_rich": hh, "hh_sparse": hh_sparse, "hospice": hospice}, default=str, indent=2))
