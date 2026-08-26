"""SEN-NAT-001 follow-up read-only queries."""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env(path: Path) -> None:
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        if os.environ.get(k.strip()) in (None, ""):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def main() -> None:
    load_env(ROOT / ".env.local")
    import psycopg

    conn = psycopg.connect(os.environ["CARE_DATABASE_URL"], connect_timeout=20)
    cur = conn.cursor()

    def q(sql: str):
        cur.execute(sql)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

    out = {
        "org_identifier_types": q(
            """
            SELECT issuer, identifier_type, count(*)::bigint AS n,
                   count(DISTINCT identifier_value)::bigint AS distinct_values
            FROM organization_identifier
            GROUP BY 1,2 ORDER BY n DESC
            """
        ),
        "sff_values": q(
            """
            SELECT coalesce(fs.raw_record->>'Special Focus Status','(null)') AS sff,
                   count(*)::bigint AS n
            FROM facility_snapshot fs
            GROUP BY 1 ORDER BY n DESC
            """
        ),
        "abuse_icon": q(
            """
            SELECT coalesce(fs.raw_record->>'Abuse Icon','(null)') AS abuse_icon,
                   count(*)::bigint AS n
            FROM facility_snapshot fs
            GROUP BY 1 ORDER BY n DESC
            """
        ),
        "ownership_changed_12mo": q(
            """
            SELECT coalesce(fs.raw_record->>'Provider Changed Ownership in Last 12 Months','(null)') AS v,
                   count(*)::bigint AS n
            FROM facility_snapshot fs
            GROUP BY 1 ORDER BY n DESC
            """
        ),
        "ownership_association_dates": q(
            """
            SELECT count(*)::bigint AS n,
                   count(*) FILTER (WHERE association_date IS NOT NULL)::bigint AS with_association_date
            FROM provider_ownership_relationship
            """
        ),
        "npi_orgs": q(
            """
            SELECT count(*)::bigint AS n,
                   count(DISTINCT organization_id)::bigint AS orgs
            FROM organization_identifier
            WHERE identifier_type = 'NPI'
            """
        ),
        "place_identity_latest": q(
            """
            WITH latest AS (
              SELECT DISTINCT ON (provider_id) provider_id, resolution_state
              FROM facility_claim
              WHERE claim_type = 'google_place_identity'
              ORDER BY provider_id, resolved_at DESC
            )
            SELECT resolution_state, count(*)::bigint AS n FROM latest GROUP BY 1 ORDER BY n DESC
            """
        ),
        "providers_without_place_claim": q(
            """
            SELECT count(*)::bigint AS n
            FROM provider p
            WHERE NOT EXISTS (
              SELECT 1 FROM facility_claim c
              WHERE c.provider_id = p.id AND c.claim_type = 'google_place_identity'
            )
            """
        ),
    }
    dest = ROOT / "docs" / "sen-nat-001-production-followup.json"
    dest.write_text(json.dumps(out, default=str, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"wrote": str(dest)}))
    conn.close()


if __name__ == "__main__":
    main()
