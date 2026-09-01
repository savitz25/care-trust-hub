"""SEN-NAT-005W check-only + production snapshot. Does not write CMS evidence."""

from __future__ import annotations

import json
import os
import platform
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env() -> None:
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    os.environ.pop("CARE_CMS_REFRESH_WRITES", None)


def snapshot(conn) -> dict:
    def q(sql: str, params=None):
        row = conn.execute(sql, params or ()).fetchone()
        return row

    def all_rows(sql: str, params=None):
        return conn.execute(sql, params or ()).fetchall()

    releases = [
        dict(
            zip(
                (
                    "dataset_key",
                    "release_key",
                    "source_modified_at",
                    "source_version_identifier",
                    "content_sha256",
                    "retrieved_at",
                    "rows_read",
                ),
                row,
                strict=True,
            )
        )
        for row in all_rows(
            """
            SELECT DISTINCT ON (d.dataset_key)
              d.dataset_key, r.release_key, r.source_modified_at::text,
              r.source_version_identifier, r.content_sha256, r.retrieved_at::text, ir.rows_read
            FROM source_dataset d
            JOIN source_release r ON r.source_dataset_id = d.id
            JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
            ORDER BY d.dataset_key, r.source_modified_at DESC NULLS LAST, r.release_key DESC
            """
        )
    ]
    pi = q(
        """
        SELECT r.id::text, r.release_key
        FROM source_dataset d
        JOIN source_release r ON r.source_dataset_id = d.id
        JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
        WHERE d.dataset_key = 'nursing-home-provider-information'
        ORDER BY r.source_modified_at DESC NULLS LAST, r.release_key DESC
        LIMIT 1
        """
    )
    pi_id, pi_release = pi
    current_ccns = q(
        """
        SELECT count(DISTINCT pi.identifier_value)::bigint
        FROM facility_snapshot fs
        JOIN provider_identifier pi ON pi.provider_id = fs.provider_id
          AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_from IS NULL
        WHERE fs.source_release_id = %s
        """,
        (pi_id,),
    )[0]
    known_ccns = q(
        """
        SELECT count(*)::bigint FROM provider_identifier
        WHERE issuer = 'CMS' AND identifier_type = 'CCN' AND valid_from IS NULL
        """
    )[0]
    directory = dict(
        all_rows(
            """
            SELECT directory_status, count(*)::bigint
            FROM provider_directory_status
            WHERE pi_source_release_id = %s
            GROUP BY 1
            """,
            (pi_id,),
        )
    )
    designations = dict(
        all_rows(
            """
            SELECT designation_kind || ':' || official_status, count(*)::bigint
            FROM cms_facility_designation
            WHERE is_current
            GROUP BY 1
            """
        )
    )
    historical_designations = q("SELECT count(*)::bigint FROM cms_facility_designation")[0]
    inspections = q(
        """
        SELECT count(*)::bigint, count(DISTINCT provider_id)::bigint,
               min(survey_date)::text, max(survey_date)::text
        FROM inspection_event
        """
    )
    deficiencies = q(
        """
        SELECT count(*)::bigint,
               count(*) FILTER (WHERE complaint_deficiency)::bigint,
               count(*) FILTER (WHERE inspection_event_id IS NULL)::bigint,
               count(DISTINCT provider_id)::bigint
        FROM deficiency_finding
        """
    )
    penalties = q(
        """
        SELECT
          count(*) FILTER (WHERE penalty_type = 'Fine')::bigint,
          count(DISTINCT provider_id) FILTER (WHERE penalty_type = 'Fine')::bigint,
          coalesce(sum(fine_amount) FILTER (WHERE penalty_type = 'Fine'), 0),
          count(*) FILTER (WHERE penalty_type = 'Payment Denial')::bigint,
          count(DISTINCT provider_id) FILTER (WHERE penalty_type = 'Payment Denial')::bigint
        FROM penalty_enforcement
        """
    )
    ownership = q(
        """
        SELECT count(*)::bigint,
               count(DISTINCT provider_id)::bigint
        FROM provider_ownership_relationship
        """
    )
    parties = q("SELECT count(*)::bigint FROM ownership_party")[0]
    orgs = q("SELECT count(*)::bigint FROM organization")[0]
    npi = q(
        """
        SELECT count(*)::bigint,
               count(*) FILTER (WHERE confidence = 'CONFIRMED')::bigint,
               count(DISTINCT npi)::bigint,
               count(DISTINCT ccn)::bigint
        FROM provider_npi_relationship
        """
    )
    npi_multi = q(
        """
        SELECT count(*)::bigint FROM (
          SELECT npi FROM provider_npi_relationship
          WHERE confidence = 'CONFIRMED'
          GROUP BY npi HAVING count(DISTINCT ccn) >= 2
        ) t
        """
    )[0]
    chains = q(
        """
        SELECT (SELECT count(*) FROM cms_chain)::bigint,
               (SELECT count(*) FROM cms_chain_provider)::bigint
        """
    )
    mds = q("SELECT count(*)::bigint FROM facility_quality_measure_observation")[0]
    fire = q("SELECT count(*)::bigint FROM fire_safety_citation")[0]
    pbj = q("SELECT count(*)::bigint FROM pbj_staffing_day")[0]
    db_size = q("SELECT pg_database_size(current_database())")[0]
    return {
        "pi_release": pi_release,
        "current_directory_ccns": int(current_ccns),
        "known_ccns": int(known_ccns),
        "directory_status": {k: int(v) for k, v in directory.items()},
        "current_designations": {k: int(v) for k, v in designations.items()},
        "designation_rows_total": int(historical_designations),
        "inspections": {
            "rows": int(inspections[0]),
            "providers": int(inspections[1]),
            "earliest": inspections[2],
            "latest": inspections[3],
        },
        "deficiencies": {
            "rows": int(deficiencies[0]),
            "complaint_flagged": int(deficiencies[1]),
            "unlinked": int(deficiencies[2]),
            "providers": int(deficiencies[3]),
        },
        "penalties": {
            "fines": int(penalties[0]),
            "fine_ccns": int(penalties[1]),
            "fine_amount_sum": str(penalties[2]),
            "payment_denials": int(penalties[3]),
            "payment_denial_ccns": int(penalties[4]),
        },
        "ownership_relationships": int(ownership[0]),
        "ownership_facilities": int(ownership[1]),
        "ownership_parties": int(parties),
        "organizations": int(orgs),
        "npi_relationships": int(npi[0]),
        "npi_confirmed": int(npi[1]),
        "npi_distinct": int(npi[2]),
        "npi_ccns": int(npi[3]),
        "npi_reused_across_2plus_ccns": int(npi_multi),
        "chains": int(chains[0]),
        "chain_memberships": int(chains[1]),
        "mds_observations": int(mds),
        "fire_citations": int(fire),
        "pbj_days": int(pbj),
        "database_size_bytes": int(db_size),
        "current_releases": releases,
    }


def main() -> int:
    load_env()
    sys.path.insert(0, str(ROOT / "services" / "ingest" / "src"))
    from care_ingest.refresh import inspect_capacity, query_source_freshness, run_refresh

    url = os.environ["CARE_DATABASE_URL"]
    import psycopg

    env_report = {
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "machine": platform.node(),
        "cwd": str(ROOT),
        "writes_env_set": os.environ.get("CARE_CMS_REFRESH_WRITES"),
        "captured_at": datetime.now(UTC).isoformat(),
    }
    with psycopg.connect(url) as conn:
        conn.execute("SET statement_timeout = 0")
        conn.execute("SELECT 1")
        governance = conn.execute("SELECT to_regclass('public.cms_source_freshness')").fetchone()[0]
        migration_ok = governance is not None
        pre = snapshot(conn)
    capacity = inspect_capacity(url)
    report = run_refresh(
        mode="check",
        database_url=url,
        data_root=ROOT / "data",
        trigger="manual",
    )
    freshness = query_source_freshness(url)
    payload = {
        "environment": env_report,
        "governance_view_present": bool(migration_ok),
        "capacity": capacity,
        "check": json.loads(report.to_json()),
        "freshness": freshness,
        "snapshot": pre,
    }
    dest = ROOT / "docs" / "sen-nat-005w-prewrite.json"
    dest.write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")
    print(json.dumps(
        {
            "health": report.health,
            "writes_enabled": report.writes_enabled,
            "directory": report.directory,
            "sources": [
                {
                    "dataset_key": s.get("dataset_key"),
                    "status": s.get("status"),
                    "changed": s.get("changed"),
                    "source_modified_at": s.get("source_modified_at"),
                    "version_identifier": s.get("version_identifier"),
                }
                for s in report.sources
            ],
            "snapshot_ccns": pre["current_directory_ccns"],
            "artifact": str(dest),
        },
        indent=2,
        default=str,
    ))
    return 0 if report.health != "FAILED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
