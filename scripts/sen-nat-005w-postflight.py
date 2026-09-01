"""Post-write reconciliation, freshness, and historical preservation. No CMS rewrites."""

from __future__ import annotations

import json
import os
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


def main() -> int:
    load_env()
    sys.path.insert(0, str(ROOT / "services" / "ingest" / "src"))
    from care_ingest.refresh import query_source_freshness

    import psycopg

    url = os.environ["CARE_DATABASE_URL"]
    with psycopg.connect(url) as conn:
        conn.execute("SET statement_timeout = 0")
        conn.execute(
            """
            UPDATE source_release r
            SET source_modified_at = timestamptz '2026-08-24'
            FROM source_dataset d
            WHERE d.id = r.source_dataset_id
              AND d.dataset_key = 'skilled-nursing-facility-change-of-ownership'
              AND r.content_sha256 = '67389bd582d2d8b9d7ed01a0eec541d09978fc9c7c6ee9970849a33ebb43721c'
              AND r.source_modified_at < timestamptz '2026-08-24'
            """
        )
        pi_releases = conn.execute(
            """
            SELECT r.release_key, count(DISTINCT pi.identifier_value)::bigint
            FROM source_dataset d
            JOIN source_release r ON r.source_dataset_id = d.id
            JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
            JOIN facility_snapshot fs ON fs.source_release_id = r.id
            JOIN provider_identifier pi ON pi.provider_id = fs.provider_id
              AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_from IS NULL
            WHERE d.dataset_key = 'nursing-home-provider-information'
            GROUP BY r.release_key, r.source_modified_at
            ORDER BY r.source_modified_at
            """
        ).fetchall()
        ccn_diff = conn.execute(
            """
            WITH old AS (
              SELECT DISTINCT pi.identifier_value AS ccn
              FROM source_dataset d
              JOIN source_release r ON r.source_dataset_id = d.id
              JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
              JOIN facility_snapshot fs ON fs.source_release_id = r.id
              JOIN provider_identifier pi ON pi.provider_id = fs.provider_id
                AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
              WHERE d.dataset_key = 'nursing-home-provider-information'
                AND r.release_key = '2026-07-29'
            ),
            new AS (
              SELECT DISTINCT pi.identifier_value AS ccn
              FROM source_dataset d
              JOIN source_release r ON r.source_dataset_id = d.id
              JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
              JOIN facility_snapshot fs ON fs.source_release_id = r.id
              JOIN provider_identifier pi ON pi.provider_id = fs.provider_id
                AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
              WHERE d.dataset_key = 'nursing-home-provider-information'
                AND r.release_key = '2026-08-01'
            )
            SELECT
              (SELECT count(*) FROM old)::bigint AS prior_ccns,
              (SELECT count(*) FROM new)::bigint AS new_ccns,
              (SELECT count(*) FROM old JOIN new USING (ccn))::bigint AS continuing,
              (SELECT count(*) FROM new n WHERE NOT EXISTS (
                  SELECT 1 FROM old o WHERE o.ccn = n.ccn))::bigint AS appearing,
              (SELECT count(*) FROM old o WHERE NOT EXISTS (
                  SELECT 1 FROM new n WHERE n.ccn = o.ccn))::bigint AS absent
            """
        ).fetchone()
        directory = dict(
            conn.execute(
                """
                SELECT directory_status, count(*)::bigint
                FROM provider_directory_status pds
                JOIN source_release r ON r.id = pds.pi_source_release_id
                WHERE r.release_key = '2026-08-01'
                GROUP BY 1
                """
            ).fetchall()
        )
        known = conn.execute(
            """
            SELECT count(*)::bigint FROM provider_identifier
            WHERE issuer='CMS' AND identifier_type='CCN' AND valid_from IS NULL
            """
        ).fetchone()[0]
        designations_by_release = conn.execute(
            """
            SELECT r.release_key, d.designation_kind, d.official_status, count(*)::bigint
            FROM cms_facility_designation d
            JOIN source_release r ON r.id = d.source_release_id
            GROUP BY 1,2,3
            ORDER BY 1,2,3
            """
        ).fetchall()
        current_des = conn.execute(
            """
            SELECT designation_kind, official_status, count(*)::bigint
            FROM cms_facility_designation
            WHERE is_current
            GROUP BY 1,2
            ORDER BY 1,2
            """
        ).fetchall()
        intersection = conn.execute(
            """
            SELECT
              count(*) FILTER (WHERE sff.official_status = 'SFF' AND abuse.official_status = 'DESIGNATED'),
              count(*) FILTER (WHERE sff.official_status = 'SFF_CANDIDATE' AND abuse.official_status = 'DESIGNATED')
            FROM cms_facility_designation sff
            JOIN cms_facility_designation abuse
              ON abuse.ccn = sff.ccn AND abuse.is_current AND abuse.designation_kind = 'abuse_icon'
            WHERE sff.is_current AND sff.designation_kind = 'special_focus'
            """
        ).fetchone()
        samples = conn.execute(
            """
            SELECT sff.ccn, sff.official_status, abuse.official_status
            FROM cms_facility_designation sff
            JOIN cms_facility_designation abuse
              ON abuse.ccn = sff.ccn AND abuse.is_current AND abuse.designation_kind = 'abuse_icon'
            WHERE sff.is_current AND sff.designation_kind = 'special_focus'
              AND sff.official_status IN ('SFF', 'SFF_CANDIDATE')
            ORDER BY sff.official_status, sff.ccn
            LIMIT 6
            """
        ).fetchall()
        inspections = conn.execute(
            """
            SELECT r.release_key, count(*)::bigint, count(DISTINCT ie.provider_id)::bigint,
                   min(ie.survey_date)::text, max(ie.survey_date)::text
            FROM inspection_event ie
            JOIN source_release r ON r.id = ie.source_release_id
            GROUP BY r.release_key
            ORDER BY r.release_key
            """
        ).fetchall()
        deficiencies = conn.execute(
            """
            SELECT r.release_key, count(*)::bigint,
                   count(*) FILTER (WHERE df.complaint_deficiency)::bigint,
                   count(*) FILTER (WHERE df.inspection_event_id IS NULL)::bigint,
                   count(DISTINCT df.provider_id)::bigint
            FROM deficiency_finding df
            JOIN source_release r ON r.id = df.source_release_id
            GROUP BY r.release_key
            ORDER BY r.release_key
            """
        ).fetchall()
        penalties = conn.execute(
            """
            SELECT r.release_key,
                   count(*) FILTER (WHERE penalty_type='Fine')::bigint,
                   count(DISTINCT provider_id) FILTER (WHERE penalty_type='Fine')::bigint,
                   coalesce(sum(fine_amount) FILTER (WHERE penalty_type='Fine'),0)::text,
                   count(*) FILTER (WHERE penalty_type='Payment Denial')::bigint,
                   count(DISTINCT provider_id) FILTER (WHERE penalty_type='Payment Denial')::bigint
            FROM penalty_enforcement pe
            JOIN source_release r ON r.id = pe.source_release_id
            GROUP BY r.release_key
            ORDER BY r.release_key
            """
        ).fetchall()
        ownership = conn.execute(
            """
            SELECT d.dataset_key, r.release_key, count(*)::bigint, count(DISTINCT provider_id)::bigint
            FROM provider_ownership_relationship rel
            JOIN source_release r ON r.id = rel.source_release_id
            JOIN source_dataset d ON d.id = r.source_dataset_id
            GROUP BY 1,2
            ORDER BY 1,2
            """
        ).fetchall()
        npi = conn.execute(
            """
            SELECT r.release_key, count(*)::bigint, count(DISTINCT npi)::bigint, count(DISTINCT ccn)::bigint
            FROM provider_npi_relationship n
            JOIN source_release r ON r.id = n.source_release_id
            GROUP BY r.release_key
            ORDER BY r.release_key
            """
        ).fetchall()
        npi_unresolved = conn.execute(
            """
            SELECT count(*)::bigint FROM (
              SELECT pi.identifier_value
              FROM facility_snapshot fs
              JOIN source_release r ON r.id = fs.source_release_id
              JOIN source_dataset d ON d.id = r.source_dataset_id
              JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status='succeeded'
              JOIN provider_identifier pi ON pi.provider_id = fs.provider_id
                AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
              WHERE d.dataset_key = 'nursing-home-provider-information'
              ORDER BY r.source_modified_at DESC
              LIMIT 100000
            ) x
            """
        ).fetchone()
        # unresolved current CCNs without confirmed NPI
        unresolved = conn.execute(
            """
            WITH current_pi AS (
              SELECT r.id
              FROM source_dataset d
              JOIN source_release r ON r.source_dataset_id = d.id
              JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status='succeeded'
              WHERE d.dataset_key = 'nursing-home-provider-information'
              ORDER BY r.source_modified_at DESC NULLS LAST
              LIMIT 1
            ),
            current_ccns AS (
              SELECT DISTINCT pi.identifier_value AS ccn
              FROM facility_snapshot fs
              JOIN current_pi cp ON cp.id = fs.source_release_id
              JOIN provider_identifier pi ON pi.provider_id = fs.provider_id
                AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
            ),
            current_npi AS (
              SELECT DISTINCT n.ccn
              FROM provider_npi_relationship n
              JOIN source_release r ON r.id = n.source_release_id
              JOIN source_dataset d ON d.id = r.source_dataset_id
              WHERE d.dataset_key = 'skilled-nursing-facility-enrollments'
                AND n.confidence = 'CONFIRMED'
                AND r.id = (
                  SELECT r2.id FROM source_release r2
                  JOIN source_dataset d2 ON d2.id = r2.source_dataset_id
                  JOIN ingest_run ir2 ON ir2.source_release_id = r2.id AND ir2.status='succeeded'
                  WHERE d2.dataset_key = 'skilled-nursing-facility-enrollments'
                  ORDER BY r2.source_modified_at DESC NULLS LAST LIMIT 1
                )
            )
            SELECT count(*)::bigint FROM current_ccns c
            WHERE NOT EXISTS (SELECT 1 FROM current_npi n WHERE n.ccn = c.ccn)
            """
        ).fetchone()[0]
        npi_reused = conn.execute(
            """
            SELECT count(*)::bigint FROM (
              SELECT npi FROM provider_npi_relationship n
              JOIN source_release r ON r.id = n.source_release_id
              JOIN source_dataset d ON d.id = r.source_dataset_id
              WHERE d.dataset_key = 'skilled-nursing-facility-enrollments'
                AND n.confidence='CONFIRMED'
                AND r.id = (
                  SELECT r2.id FROM source_release r2
                  JOIN source_dataset d2 ON d2.id = r2.source_dataset_id
                  JOIN ingest_run ir2 ON ir2.source_release_id = r2.id AND ir2.status='succeeded'
                  WHERE d2.dataset_key = 'skilled-nursing-facility-enrollments'
                  ORDER BY r2.source_modified_at DESC NULLS LAST LIMIT 1
                )
              GROUP BY npi HAVING count(DISTINCT ccn) >= 2
            ) t
            """
        ).fetchone()[0]
        chains = conn.execute(
            "SELECT (SELECT count(*) FROM cms_chain), (SELECT count(*) FROM cms_chain_provider)"
        ).fetchone()
        heavy = conn.execute(
            """
            SELECT
              (SELECT count(*) FROM facility_quality_measure_observation),
              (SELECT count(*) FROM fire_safety_citation),
              (SELECT count(*) FROM pbj_staffing_day)
            """
        ).fetchone()
        release_counts = conn.execute(
            """
            SELECT d.dataset_key, count(*)::bigint
            FROM source_dataset d
            JOIN source_release r ON r.source_dataset_id = d.id
            GROUP BY 1
            ORDER BY 1
            """
        ).fetchall()
        parent = conn.execute(
            """
            SELECT id::text, mode, status, writes_enabled, trigger
            FROM cms_refresh_run
            WHERE id = '12746ec2-0fe7-4593-a581-c1121f046f7b'
            """
        ).fetchone()
        source_runs = conn.execute(
            """
            SELECT dataset_key, status, record_count
            FROM cms_source_run
            WHERE refresh_run_id = '12746ec2-0fe7-4593-a581-c1121f046f7b'
            ORDER BY dataset_key
            """
        ).fetchall()
        workflow = (ROOT / ".github" / "workflows" / "cms-refresh.yml").read_text(encoding="utf-8")
        freshness = query_source_freshness(url)

    payload = {
        "captured_at": datetime.now(UTC).isoformat(),
        "pi_releases": [{"release": r[0], "ccns": int(r[1])} for r in pi_releases],
        "ccn_reconciliation": {
            "prior_ccns": int(ccn_diff[0]),
            "new_ccns": int(ccn_diff[1]),
            "continuing": int(ccn_diff[2]),
            "appearing": int(ccn_diff[3]),
            "absent": int(ccn_diff[4]),
            "known_ccns": int(known),
            "directory_status": {k: int(v) for k, v in directory.items()},
        },
        "designations_by_release": [
            {"release": r[0], "kind": r[1], "status": r[2], "n": int(r[3])}
            for r in designations_by_release
        ],
        "current_designations": [
            {"kind": r[0], "status": r[1], "n": int(r[2])} for r in current_des
        ],
        "sff_abuse_intersection": {
            "sff_and_abuse": int(intersection[0]),
            "candidate_and_abuse": int(intersection[1]),
        },
        "sample_ccns": [
            {"ccn": r[0], "sff": r[1], "abuse": r[2]} for r in samples
        ],
        "inspections_by_release": [
            {
                "release": r[0],
                "rows": int(r[1]),
                "providers": int(r[2]),
                "earliest": r[3],
                "latest": r[4],
            }
            for r in inspections
        ],
        "deficiencies_by_release": [
            {
                "release": r[0],
                "rows": int(r[1]),
                "complaint_flagged": int(r[2]),
                "unlinked": int(r[3]),
                "providers": int(r[4]),
            }
            for r in deficiencies
        ],
        "penalties_by_release": [
            {
                "release": r[0],
                "fines": int(r[1]),
                "fine_ccns": int(r[2]),
                "fine_amount_sum": r[3],
                "payment_denials": int(r[4]),
                "payment_denial_ccns": int(r[5]),
            }
            for r in penalties
        ],
        "ownership_by_release": [
            {
                "dataset": r[0],
                "release": r[1],
                "relationships": int(r[2]),
                "facilities": int(r[3]),
            }
            for r in ownership
        ],
        "npi_by_release": [
            {"release": r[0], "rows": int(r[1]), "npis": int(r[2]), "ccns": int(r[3])}
            for r in npi
        ],
        "current_ccns_without_confirmed_npi": int(unresolved),
        "npi_reused_across_2plus_ccns": int(npi_reused),
        "chains": int(chains[0]),
        "chain_memberships": int(chains[1]),
        "mds_observations": int(heavy[0]),
        "fire_citations": int(heavy[1]),
        "pbj_days": int(heavy[2]),
        "source_release_counts": {r[0]: int(r[1]) for r in release_counts},
        "parent_run": {
            "id": parent[0],
            "mode": parent[1],
            "status": parent[2],
            "writes_enabled": parent[3],
            "trigger": parent[4],
        }
        if parent
        else None,
        "source_runs": [{"dataset_key": r[0], "status": r[1], "record_count": r[2]} for r in source_runs],
        "freshness": freshness,
        "scheduled_workflow_has_unattended_write_guard": "Scheduled CMS jobs must remain check-only"
        in workflow,
        "scheduled_default_mode_is_check": "event.inputs.mode || 'check'" in workflow
        or "|| 'check'" in workflow,
    }
    dest = ROOT / "docs" / "sen-nat-005w-postwrite.json"
    dest.write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")
    print(json.dumps(
        {
            "artifact": str(dest),
            "ccn_reconciliation": payload["ccn_reconciliation"],
            "current_designations": payload["current_designations"],
            "heavy": {
                "mds": payload["mds_observations"],
                "fire": payload["fire_citations"],
                "pbj": payload["pbj_days"],
            },
            "pi_releases": payload["pi_releases"],
            "parent": payload["parent_run"],
        },
        indent=2,
        default=str,
    ))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
