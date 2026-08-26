"""SEN-NAT-001 read-only production census. Prints JSON. Does not write."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and os.environ.get(k) in (None, ""):
            os.environ[k] = v


def connect():
    url = (os.environ.get("CARE_DATABASE_URL") or "").strip()
    if not url:
        raise SystemExit("CARE_DATABASE_URL missing")
    try:
        import psycopg

        return psycopg.connect(url, connect_timeout=20)
    except ImportError:
        import psycopg2

        return psycopg2.connect(url, connect_timeout=20)


def q(cur, sql: str, params=None):
    cur.execute(sql, params or ())
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def scalar(cur, sql: str, params=None):
    rows = q(cur, sql, params)
    if not rows:
        return None
    return next(iter(rows[0].values()))


def table_exists(cur, name: str) -> bool:
    return bool(
        scalar(
            cur,
            "SELECT to_regclass(%s) IS NOT NULL",
            (f"public.{name}",),
        )
    )


def main() -> int:
    load_env(ROOT / ".env.local")
    conn = connect()
    cur = conn.cursor()
    out: dict = {"audit": "SEN-NAT-001", "read_only": True}

    tables = q(
        cur,
        """
        SELECT relname AS table_name, n_live_tup::bigint AS est_live_tuples
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY relname
        """,
    )
    out["pg_stat_user_tables"] = tables

    def count_if(name: str) -> int | None:
        if not table_exists(cur, name):
            return None
        return int(scalar(cur, f"SELECT count(*) FROM {name}"))

    out["row_counts"] = {}
    for name in [
        "source_dataset",
        "source_release",
        "raw_object",
        "ingest_run",
        "provider",
        "provider_identifier",
        "facility_snapshot",
        "evidence_assertion",
        "inspection_event",
        "deficiency_finding",
        "penalty_enforcement",
        "pbj_staffing_day",
        "pbj_staffing_quarter_summary",
        "organization",
        "organization_identifier",
        "ownership_party",
        "provider_ownership_relationship",
        "organization_relationship",
        "ownership_change_event",
        "ownership_source_notice",
        "ownership_portfolio",
        "ownership_portfolio_member",
        "cms_chain",
        "cms_chain_performance_snapshot",
        "cms_chain_provider",
        "cms_chain_organization",
        "location_reference",
        "facility_intelligence_run",
        "facility_source_observation",
        "facility_external_identifier",
        "facility_claim",
        "facility_identity_candidate",
        "facility_review_item",
        "facility_history_event",
        "assisted_living_provider",
        "assisted_living_organization_party",
        "trust_request",
    ]:
        out["row_counts"][name] = count_if(name)

    out["provider_types"] = q(
        cur, "SELECT provider_type, count(*)::bigint AS n FROM provider GROUP BY 1 ORDER BY n DESC"
    )
    out["identifier_types"] = q(
        cur,
        """
        SELECT issuer, identifier_type, count(*)::bigint AS n,
               count(DISTINCT identifier_value)::bigint AS distinct_values,
               count(DISTINCT provider_id)::bigint AS distinct_providers
        FROM provider_identifier
        GROUP BY 1,2
        ORDER BY n DESC
        """,
    )
    out["datasets"] = q(
        cur,
        """
        SELECT d.dataset_key, d.source_organization, d.display_name,
               count(r.id)::bigint AS releases
        FROM source_dataset d
        LEFT JOIN source_release r ON r.source_dataset_id = d.id
        GROUP BY d.id
        ORDER BY d.dataset_key
        """,
    )
    out["releases"] = q(
        cur,
        """
        SELECT d.dataset_key, r.release_key, r.source_published_at, r.source_modified_at,
               r.source_period, r.source_version_identifier, r.retrieved_at,
               r.source_release_date, ir.status, ir.transformation_version,
               ir.rows_read, ir.valid_rows, ir.rejected_rows, ir.completed_at
        FROM source_release r
        JOIN source_dataset d ON d.id = r.source_dataset_id
        LEFT JOIN ingest_run ir ON ir.source_release_id = r.id
        ORDER BY d.dataset_key, coalesce(r.source_modified_at, r.retrieved_at) DESC
        """,
    )

    out["current_pi_snapshot"] = q(
        cur,
        """
        WITH current_release AS (
          SELECT r.id
          FROM source_release r
          JOIN source_dataset d ON d.id = r.source_dataset_id
          JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
          WHERE d.dataset_key = 'nursing-home-provider-information'
          ORDER BY r.source_modified_at DESC NULLS LAST,
                   r.source_release_date DESC NULLS LAST,
                   r.release_key,
                   ir.completed_at DESC NULLS LAST
          LIMIT 1
        )
        SELECT
          count(*)::bigint AS snapshots,
          count(DISTINCT fs.provider_id)::bigint AS providers,
          count(*) FILTER (WHERE fs.telephone IS NOT NULL AND btrim(fs.telephone) <> '')::bigint AS with_phone,
          count(*) FILTER (WHERE fs.certified_beds IS NOT NULL)::bigint AS with_beds,
          count(*) FILTER (WHERE fs.overall_rating IS NOT NULL)::bigint AS with_overall_rating,
          count(*) FILTER (WHERE fs.health_inspection_rating IS NOT NULL)::bigint AS with_health_rating,
          count(*) FILTER (WHERE fs.staffing_rating IS NOT NULL)::bigint AS with_staffing_rating,
          count(*) FILTER (WHERE fs.quality_measure_rating IS NOT NULL)::bigint AS with_qm_rating,
          count(*) FILTER (WHERE fs.participates_medicare IS TRUE)::bigint AS medicare,
          count(*) FILTER (WHERE fs.participates_medicaid IS TRUE)::bigint AS medicaid,
          count(*) FILTER (WHERE fs.location IS NOT NULL)::bigint AS with_location,
          count(DISTINCT fs.state_code)::bigint AS states
        FROM facility_snapshot fs
        JOIN current_release cr ON cr.id = fs.source_release_id
        """,
    )
    out["pi_participation_types"] = q(
        cur,
        """
        WITH current_release AS (
          SELECT r.id
          FROM source_release r
          JOIN source_dataset d ON d.id = r.source_dataset_id
          JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
          WHERE d.dataset_key = 'nursing-home-provider-information'
          ORDER BY r.source_modified_at DESC NULLS LAST, r.release_key
          LIMIT 1
        )
        SELECT coalesce(fs.participation_type, '(null)') AS participation_type,
               count(*)::bigint AS n
        FROM facility_snapshot fs
        JOIN current_release cr ON cr.id = fs.source_release_id
        GROUP BY 1
        ORDER BY n DESC
        """,
    )
    out["ccn_uniqueness"] = q(
        cur,
        """
        SELECT count(*)::bigint AS identifier_rows,
               count(DISTINCT identifier_value)::bigint AS distinct_ccns,
               count(DISTINCT provider_id)::bigint AS distinct_providers,
               count(*) FILTER (WHERE valid_to IS NULL)::bigint AS open_ended
        FROM provider_identifier
        WHERE identifier_type IN ('ccn', 'CMS Certification Number (CCN)', 'cms_ccn')
           OR identifier_type ILIKE '%%ccn%%'
           OR identifier_type ILIKE '%%certification%%'
           OR issuer ILIKE '%%cms%%'
        """,
    )
    out["ccn_duplicates"] = q(
        cur,
        """
        SELECT identifier_value, count(DISTINCT provider_id)::bigint AS providers
        FROM provider_identifier
        WHERE identifier_type ILIKE '%%ccn%%' OR identifier_type ILIKE '%%certification%%'
        GROUP BY 1
        HAVING count(DISTINCT provider_id) > 1
        ORDER BY providers DESC
        LIMIT 20
        """,
    )

    if table_exists(cur, "inspection_event"):
        out["inspections"] = q(
            cur,
            """
            SELECT count(*)::bigint AS events,
                   count(DISTINCT provider_id)::bigint AS facilities,
                   count(DISTINCT survey_type)::bigint AS survey_types
            FROM inspection_event
            """,
        )
        out["inspection_survey_types"] = q(
            cur,
            """
            SELECT survey_type, count(*)::bigint AS n,
                   count(DISTINCT provider_id)::bigint AS facilities
            FROM inspection_event
            GROUP BY 1 ORDER BY n DESC
            """,
        )
    if table_exists(cur, "deficiency_finding"):
        out["deficiencies"] = q(
            cur,
            """
            SELECT count(*)::bigint AS findings,
                   count(DISTINCT provider_id)::bigint AS facilities,
                   count(*) FILTER (WHERE complaint_deficiency IS TRUE)::bigint AS complaint_flagged,
                   count(*) FILTER (WHERE infection_control_deficiency IS TRUE)::bigint AS infection_control,
                   count(*) FILTER (WHERE inspection_event_id IS NULL)::bigint AS unlinked_to_inspection
            FROM deficiency_finding
            """,
        )
    if table_exists(cur, "penalty_enforcement"):
        out["penalties"] = q(
            cur,
            """
            SELECT penalty_type, count(*)::bigint AS n,
                   count(DISTINCT provider_id)::bigint AS facilities,
                   sum(fine_amount) AS fine_amount_sum
            FROM penalty_enforcement
            GROUP BY 1 ORDER BY n DESC
            """,
        )
    if table_exists(cur, "pbj_staffing_quarter_summary"):
        out["pbj_quarters"] = q(
            cur,
            """
            SELECT source_quarter, count(*)::bigint AS summaries,
                   count(DISTINCT ccn)::bigint AS ccns
            FROM pbj_staffing_quarter_summary
            GROUP BY 1 ORDER BY 1
            """,
        )
        out["pbj_days"] = q(
            cur,
            "SELECT count(*)::bigint AS days, count(DISTINCT ccn)::bigint AS ccns FROM pbj_staffing_day",
        )
    if table_exists(cur, "ownership_party"):
        out["ownership"] = q(
            cur,
            """
            SELECT
              (SELECT count(*) FROM organization) AS organizations,
              (SELECT count(*) FROM ownership_party) AS parties,
              (SELECT count(*) FROM ownership_party WHERE party_kind='individual') AS individuals,
              (SELECT count(*) FROM ownership_party WHERE party_kind='organization') AS org_parties,
              (SELECT count(*) FROM provider_ownership_relationship) AS relationships,
              (SELECT count(DISTINCT provider_id) FROM provider_ownership_relationship WHERE provider_id IS NOT NULL) AS facilities_with_owner_rel,
              (SELECT count(*) FROM ownership_change_event) AS change_events,
              (SELECT count(DISTINCT provider_id) FROM ownership_change_event WHERE provider_id IS NOT NULL) AS facilities_with_chow,
              (SELECT count(*) FROM organization_relationship) AS org_relationships
            """,
        )
        out["ownership_roles"] = q(
            cur,
            """
            SELECT relationship_role_text, count(*)::bigint AS n
            FROM provider_ownership_relationship
            GROUP BY 1 ORDER BY n DESC
            LIMIT 30
            """,
        )
    if table_exists(cur, "cms_chain"):
        out["chains"] = q(
            cur,
            """
            SELECT
              (SELECT count(*) FROM cms_chain) AS chains,
              (SELECT count(*) FROM cms_chain_provider) AS memberships,
              (SELECT count(DISTINCT provider_id) FROM cms_chain_provider WHERE provider_id IS NOT NULL) AS facilities_linked,
              (SELECT count(*) FROM cms_chain_performance_snapshot) AS performance_snapshots
            """,
        )
    if table_exists(cur, "facility_claim"):
        out["identity_claims"] = q(
            cur,
            """
            SELECT claim_type, resolution_state, count(*)::bigint AS n,
                   count(DISTINCT provider_id)::bigint AS facilities
            FROM facility_claim
            GROUP BY 1,2
            ORDER BY 1,2
            """,
        )
        out["identity_latest_by_provider"] = q(
            cur,
            """
            WITH latest AS (
              SELECT DISTINCT ON (provider_id, claim_type)
                     provider_id, claim_type, resolution_state
              FROM facility_claim
              WHERE claim_type = 'GOOGLE_PLACE_IDENTITY'
              ORDER BY provider_id, claim_type, resolved_at DESC
            )
            SELECT resolution_state, count(*)::bigint AS n
            FROM latest
            GROUP BY 1 ORDER BY n DESC
            """,
        )
    if table_exists(cur, "facility_source_observation"):
        out["observations"] = q(
            cur,
            """
            SELECT source_type, observation_type, count(*)::bigint AS n,
                   count(DISTINCT coalesce(provider_id::text, canonical_ccn))::bigint AS entities
            FROM facility_source_observation
            GROUP BY 1,2
            ORDER BY n DESC
            LIMIT 40
            """,
        )
    if table_exists(cur, "assisted_living_provider"):
        out["assisted_living"] = q(
            cur,
            """
            SELECT state_code, identity_state, publication_state, consumer_category,
                   memory_designation, count(*)::bigint AS n,
                   count(*) FILTER (WHERE discovery_eligible)::bigint AS discovery
            FROM assisted_living_provider
            GROUP BY 1,2,3,4,5
            ORDER BY 1, n DESC
            """,
        )
        out["assisted_living_totals"] = q(
            cur,
            """
            SELECT state_code, count(*)::bigint AS n,
                   count(*) FILTER (WHERE discovery_eligible)::bigint AS discovery,
                   count(*) FILTER (WHERE identity_state='VERIFIED')::bigint AS verified
            FROM assisted_living_provider
            GROUP BY 1 ORDER BY 1
            """,
        )
        out["al_parties"] = q(
            cur,
            """
            SELECT role, count(*)::bigint AS n
            FROM assisted_living_organization_party
            GROUP BY 1 ORDER BY n DESC
            """,
        )
    if table_exists(cur, "facility_history_event"):
        out["history_families"] = q(
            cur,
            """
            SELECT event_family, event_type, count(*)::bigint AS n,
                   count(DISTINCT provider_id)::bigint AS facilities
            FROM facility_history_event
            GROUP BY 1,2 ORDER BY n DESC
            LIMIT 40
            """,
        )
    if table_exists(cur, "ownership_portfolio"):
        out["portfolios"] = q(
            cur,
            "SELECT count(*)::bigint AS n FROM ownership_portfolio",
        )

    # Special Focus / abuse in current PI raw_record keys
    out["pi_raw_keys_sample"] = q(
        cur,
        """
        SELECT jsonb_object_keys(fs.raw_record) AS key
        FROM facility_snapshot fs
        WHERE fs.id = (
          SELECT fs2.id
          FROM facility_snapshot fs2
          JOIN source_release r ON r.id = fs2.source_release_id
          JOIN source_dataset d ON d.id = r.source_dataset_id
          WHERE d.dataset_key = 'nursing-home-provider-information'
          LIMIT 1
        )
        ORDER BY 1
        """,
    )

    out["npi_in_identifiers"] = q(
        cur,
        """
        SELECT issuer, identifier_type, count(*)::bigint AS n
        FROM provider_identifier
        WHERE identifier_type ILIKE '%%npi%%'
           OR (identifier_value ~ '^[0-9]{10}$' AND char_length(identifier_value) = 10)
        GROUP BY 1,2
        """,
    )

    conn.close()
    dest = ROOT / "docs" / "sen-nat-001-production-census.json"
    dest.write_text(json.dumps(out, default=str, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"wrote": str(dest), "tables": len(out.get("row_counts", {}))}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
