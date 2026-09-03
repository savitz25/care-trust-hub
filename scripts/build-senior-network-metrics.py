"""Build senior-network-metrics-v1 from canonical production state.

Does not print secrets. generatedAt is the manifest clock; sourceAsOf is CMS/source date.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "web" / "src" / "data" / "senior-network-metrics-v1.json"
HUB_INTEL = ROOT / "apps" / "web" / "src" / "data" / "senior-national-intelligence.json"
SCHEMA = "senior-network-metrics-v1"

NEWEST_SEMANTICS = (
    "Newest official CMS source-modified date among PUBLIC metrics. "
    "Not a single network clock and not a deployment date."
)


def load_env() -> None:
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        raise SystemExit(".env.local missing")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def as_date(value: Any) -> str | None:
    if value is None:
        return None
    text = value.isoformat() if hasattr(value, "isoformat") else str(value)
    return text[:10]


def freshness_map(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {row["datasetKey"]: row for row in rows}


def metric(
    *,
    key: str,
    label: str,
    value: int | None,
    grain: str,
    denominator: str,
    provider_class: str,
    description: str,
    coverage_num: int | None,
    coverage_den: int | None,
    coverage_display: str,
    sources: list[str],
    source_as_of: str | None,
    generated_at: str,
    method: str,
    payload_key: str,
    components: list[dict[str, str]],
    limitations: list[str],
    publication: str,
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "value": value,
        "unit": "count",
        "grain": grain,
        "denominator": denominator,
        "providerClass": provider_class,
        "description": description,
        "coverage": {
            "numerator": coverage_num,
            "denominator": coverage_den,
            "display": coverage_display,
        },
        "contributingSourceSystems": sources,
        "sourceAsOf": source_as_of,
        "generatedAt": generated_at,
        "trace": {
            "method": method,
            "payloadKey": payload_key,
            "components": components,
            "limitations": limitations,
        },
        "publicationStatus": publication,
    }


def fingerprint(payload: dict[str, Any]) -> str:
    canonical = {key: value for key, value in payload.items() if key not in {"generatedAt", "sourceFingerprint"}}
    encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


SQL = """
WITH current_nh AS (
  SELECT latest.provider_id, latest.ccn
  FROM (
    SELECT DISTINCT ON (pds.ccn) pds.provider_id, pds.ccn, pds.directory_status
    FROM provider_directory_status pds
    JOIN provider p ON p.id = pds.provider_id
    WHERE p.provider_type='nursing_home'
    ORDER BY pds.ccn, pds.observed_at DESC, pds.ingested_at DESC
  ) latest
  WHERE latest.directory_status='CURRENT_ACTIVE'
),
nh_status AS (
  SELECT latest.directory_status, count(*) AS n
  FROM (
    SELECT DISTINCT ON (pds.ccn) pds.directory_status
    FROM provider_directory_status pds
    JOIN provider p ON p.id = pds.provider_id
    WHERE p.provider_type='nursing_home'
    ORDER BY pds.ccn, pds.observed_at DESC, pds.ingested_at DESC
  ) latest
  GROUP BY 1
),
latest AS (
  SELECT f.dataset_key, sr.id AS source_release_id
  FROM cms_source_freshness f
  JOIN source_dataset sd ON sd.dataset_key = f.dataset_key
  JOIN source_release sr ON sr.source_dataset_id = sd.id AND sr.release_key = f.current_release
)
SELECT jsonb_build_object(
  'nh_current', (SELECT count(*) FROM current_nh),
  'nh_known', (SELECT count(*) FROM provider WHERE provider_type='nursing_home'),
  'nh_status', (SELECT coalesce(jsonb_object_agg(directory_status, n), '{}'::jsonb) FROM nh_status),
  'hh_current', (SELECT count(DISTINCT provider_id) FROM home_health_snapshot),
  'hh_typed', (SELECT count(*) FROM provider WHERE provider_type='home_health'),
  'hospice_current', (SELECT count(DISTINCT provider_id) FROM hospice_snapshot),
  'hospice_typed', (SELECT count(*) FROM provider WHERE provider_type='hospice'),
  'mds_all', (SELECT count(*) FROM facility_quality_measure_observation),
  'mds_latest', (
    SELECT count(*) FROM facility_quality_measure_observation o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='nursing-home-mds-quality-measures'
  ),
  'fire_all', (SELECT count(*) FROM fire_safety_citation),
  'fire_latest', (
    SELECT count(*) FROM fire_safety_citation o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='nursing-home-fire-safety-deficiencies'
  ),
  'inspection_all', (SELECT count(*) FROM inspection_event),
  'inspection_latest', (
    SELECT count(*) FROM inspection_event o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='nursing-home-inspection-dates'
  ),
  'deficiency_all', (SELECT count(*) FROM deficiency_finding),
  'deficiency_latest', (
    SELECT count(*) FROM deficiency_finding o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='nursing-home-health-deficiencies'
  ),
  'penalty_all', (SELECT count(*) FROM penalty_enforcement),
  'penalty_latest', (
    SELECT count(*) FROM penalty_enforcement o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='nursing-home-penalties'
  ),
  'fines_latest', (
    SELECT count(*) FROM penalty_enforcement o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='nursing-home-penalties' AND o.penalty_type='Fine'
  ),
  'denials_latest', (
    SELECT count(*) FROM penalty_enforcement o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='nursing-home-penalties' AND o.penalty_type='Payment Denial'
  ),
  'pbj_days_all', (SELECT count(*) FROM pbj_staffing_day),
  'pbj_days_latest', (
    SELECT count(*) FROM pbj_staffing_day o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='payroll-based-journal-daily-nurse-staffing'
  ),
  'pbj_quarters_all', (SELECT count(*) FROM pbj_staffing_quarter_summary),
  'pbj_quarters_latest', (
    SELECT count(*) FROM pbj_staffing_quarter_summary o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='payroll-based-journal-daily-nurse-staffing'
  ),
  'chow_events', (SELECT count(*) FROM ownership_change_event),
  'chow_providers', (
    SELECT count(DISTINCT provider_id) FROM ownership_change_event WHERE provider_id IS NOT NULL
  ),
  'orgs', (SELECT count(*) FROM organization),
  'ownership_edges', (SELECT count(*) FROM provider_organization_edge),
  'hh_quality', (
    SELECT count(*) FROM cms_agency_quality_observation WHERE measure_family='hh_quality'
  ),
  'hh_hhcahps', (
    SELECT count(*) FROM cms_agency_quality_observation WHERE measure_family='hh_hhcahps'
  ),
  'hospice_quality', (
    SELECT count(*) FROM cms_agency_quality_observation WHERE measure_family='hospice_quality'
  ),
  'hospice_cahps', (
    SELECT count(*) FROM cms_agency_quality_observation WHERE measure_family='hospice_cahps'
  ),
  'agency_zips', (SELECT count(*) FROM cms_agency_service_zip),
  'nh_by_state', (
    SELECT coalesce(jsonb_object_agg(state_code, n), '{}'::jsonb)
    FROM (
      SELECT s.state_code, count(DISTINCT s.provider_id) AS n
      FROM facility_snapshot s JOIN current_nh c ON c.provider_id=s.provider_id
      GROUP BY 1
    ) t
  ),
  'hh_by_state', (
    SELECT coalesce(jsonb_object_agg(state_code, n), '{}'::jsonb)
    FROM (
      SELECT state_code, count(DISTINCT provider_id) AS n
      FROM home_health_snapshot GROUP BY 1
    ) t
  ),
  'hospice_by_state', (
    SELECT coalesce(jsonb_object_agg(state_code, n), '{}'::jsonb)
    FROM (
      SELECT state_code, count(DISTINCT provider_id) AS n
      FROM hospice_snapshot GROUP BY 1
    ) t
  )
)
"""

FRESHNESS_SQL = """
SELECT dataset_key, source_modified_at, retrieved_at, source_period, freshness_band
FROM cms_source_freshness
ORDER BY dataset_key
"""


def main() -> int:
    load_env()
    url = os.environ.get("CARE_DATABASE_URL")
    if not url:
        raise SystemExit("CARE_DATABASE_URL missing")
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    hub = json.loads(HUB_INTEL.read_text(encoding="utf-8"))
    print("querying canonical database...", flush=True)
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute("SET statement_timeout = '300s'")
        counts = conn.execute(SQL).fetchone()[0]
        freshness_rows = conn.execute(FRESHNESS_SQL).fetchall()

    sources = [
        {
            "datasetKey": row[0],
            "sourceAsOf": as_date(row[1]),
            "retrievedAt": row[2].isoformat() if row[2] else None,
            "sourcePeriod": row[3],
            "freshnessBand": row[4],
        }
        for row in freshness_rows
    ]
    by_source = freshness_map(sources)

    def src(*keys: str) -> str | None:
        dates = [by_source[key]["sourceAsOf"] for key in keys if key in by_source and by_source[key]["sourceAsOf"]]
        return max(dates) if dates else None

    nh_current = int(counts["nh_current"])
    nh_known = int(counts["nh_known"])
    nh_absent = int((counts["nh_status"] or {}).get("ABSENT_FROM_CURRENT_DIRECTORY") or 0)
    hh_current = int(counts["hh_current"])
    hospice_current = int(counts["hospice_current"])
    hospice_typed = int(counts["hospice_typed"])
    hospice_evidence_only = hospice_typed - hospice_current
    if nh_absent != nh_known - nh_current:
        raise SystemExit(f"NH exclusion mismatch {nh_absent} != {nh_known}-{nh_current}")
    if hospice_evidence_only < 0:
        raise SystemExit("Hospice typed below GI current")

    nh_by_state = {k: int(v) for k, v in (counts["nh_by_state"] or {}).items()}
    hh_by_state = {k: int(v) for k, v in (counts["hh_by_state"] or {}).items()}
    hospice_by_state = {k: int(v) for k, v in (counts["hospice_by_state"] or {}).items()}
    if sum(nh_by_state.values()) != nh_current:
        raise SystemExit(f"NH geography {sum(nh_by_state.values())} != {nh_current}")
    if sum(hh_by_state.values()) != hh_current:
        raise SystemExit(f"HH geography {sum(hh_by_state.values())} != {hh_current}")
    if sum(hospice_by_state.values()) != hospice_current:
        raise SystemExit(f"Hospice geography {sum(hospice_by_state.values())} != {hospice_current}")

    mds = int(counts["mds_latest"])
    fire = int(counts["fire_latest"])
    inspections = int(counts["inspection_latest"])
    deficiencies = int(counts["deficiency_latest"])
    penalties = int(counts["penalty_latest"])
    fines = int(counts["fines_latest"])
    denials = int(counts["denials_latest"])
    pbj_quarters = int(counts["pbj_quarters_latest"])
    chow = int(counts["chow_events"])
    candidate_sum = mds + fire + inspections + deficiencies + penalties + pbj_quarters + chow

    states = sorted(set(nh_by_state) | set(hh_by_state) | set(hospice_by_state))
    geography = [
        {
            "state": code,
            "nursingHomes": nh_by_state.get(code, 0),
            "homeHealth": hh_by_state.get(code, 0),
            "hospice": hospice_by_state.get(code, 0),
        }
        for code in states
    ]

    metrics = [
        metric(
            key="current_nursing_homes",
            label="Current nursing homes",
            value=nh_current,
            grain="current_directory_provider",
            denominator="Current CMS Nursing Home Provider Information directory",
            provider_class="nursing_home",
            description="Current CMS Nursing Home directory identities. Identity is CMS CCN.",
            coverage_num=nh_current,
            coverage_den=nh_current,
            coverage_display=f"{nh_current:,} current of {nh_current:,} current directory",
            sources=["nursing-home-provider-information"],
            source_as_of=src("nursing-home-provider-information"),
            generated_at=generated_at,
            method="Latest provider_directory_status per CCN where directory_status='CURRENT_ACTIVE' and provider_type='nursing_home'.",
            payload_key="providerUniverses.nursingHome.current",
            components=[
                {"label": "Current directory", "value": f"{nh_current:,}", "payloadKey": "providerUniverses.nursingHome.current"},
                {"label": "Known CCNs", "value": f"{nh_known:,}", "payloadKey": "providerUniverses.nursingHome.known"},
            ],
            limitations=[
                "Known CCNs are not added into current.",
                "Absence from the current directory is not proof of closure.",
            ],
            publication="PUBLIC",
        ),
        metric(
            key="current_home_health_agencies",
            label="Current home health agencies",
            value=hh_current,
            grain="current_directory_provider",
            denominator="Current CMS Home Health Care Agencies directory",
            provider_class="home_health",
            description="Current CMS Home Health Care Agencies directory identities. Identity is CMS Home Health CCN.",
            coverage_num=hh_current,
            coverage_den=hh_current,
            coverage_display=f"{hh_current:,} current of {hh_current:,} current directory",
            sources=["home-health-care-agencies"],
            source_as_of=src("home-health-care-agencies"),
            generated_at=generated_at,
            method="Distinct provider_id rows in home_health_snapshot (current CMS agency directory).",
            payload_key="providerUniverses.homeHealth.current",
            components=[
                {"label": "Current directory", "value": f"{hh_current:,}", "payloadKey": "providerUniverses.homeHealth.current"},
            ],
            limitations=["An office address is not a verified service area."],
            publication="PUBLIC",
        ),
        metric(
            key="current_hospice_providers",
            label="Current hospice providers",
            value=hospice_current,
            grain="current_directory_provider",
            denominator="Current CMS Hospice General Information directory",
            provider_class="hospice",
            description="Current CMS Hospice General Information directory identities. Identity is CMS Hospice CCN.",
            coverage_num=hospice_current,
            coverage_den=hospice_current,
            coverage_display=f"{hospice_current:,} GI current of {hospice_typed:,} typed identities",
            sources=["hospice-general-information"],
            source_as_of=src("hospice-general-information"),
            generated_at=generated_at,
            method="Distinct provider_id rows in hospice_snapshot (GI directory). Quality-file-only CCNs are excluded.",
            payload_key="providerUniverses.hospice.current",
            components=[
                {"label": "Current GI directory", "value": f"{hospice_current:,}", "payloadKey": "providerUniverses.hospice.current"},
                {"label": "Typed identities", "value": f"{hospice_typed:,}", "payloadKey": "providerUniverses.hospice.typed"},
                {"label": "Evidence-only identities", "value": f"{hospice_evidence_only:,}", "payloadKey": "providerUniverses.hospice.evidenceOnly"},
            ],
            limitations=[
                "Evidence-only identities are not current GI providers and are not proof of closure.",
            ],
            publication="PUBLIC",
        ),
        metric(
            key="known_nursing_home_ccns",
            label="Known nursing-home CCNs",
            value=nh_known,
            grain="known_ccn_identity",
            denominator="Typed nursing_home providers in the research graph",
            provider_class="nursing_home",
            description="Typed nursing-home CCNs regardless of current-directory status.",
            coverage_num=nh_known,
            coverage_den=nh_known,
            coverage_display=f"{nh_known:,} known CCNs",
            sources=["nursing-home-provider-information"],
            source_as_of=src("nursing-home-provider-information"),
            generated_at=generated_at,
            method="count(*) FROM provider WHERE provider_type='nursing_home'.",
            payload_key="providerUniverses.nursingHome.known",
            components=[
                {"label": "Known CCNs", "value": f"{nh_known:,}", "payloadKey": "providerUniverses.nursingHome.known"},
                {"label": "Current directory", "value": f"{nh_current:,}", "payloadKey": "providerUniverses.nursingHome.current"},
            ],
            limitations=["Known CCNs are not current providers."],
            publication="INTERNAL",
        ),
        metric(
            key="nursing_homes_absent_from_current_directory",
            label="Nursing homes absent from the current directory",
            value=nh_absent,
            grain="directory_exclusion",
            denominator="Typed nursing_home providers minus CURRENT_ACTIVE",
            provider_class="nursing_home",
            description="Latest directory status ABSENT_FROM_CURRENT_DIRECTORY. Not a closure finding.",
            coverage_num=nh_absent,
            coverage_den=nh_known,
            coverage_display=f"{nh_absent:,} of {nh_known:,} known CCNs",
            sources=["nursing-home-provider-information"],
            source_as_of=src("nursing-home-provider-information"),
            generated_at=generated_at,
            method="Latest provider_directory_status per CCN where directory_status='ABSENT_FROM_CURRENT_DIRECTORY'.",
            payload_key="providerUniverses.nursingHome.absentFromCurrentDirectory",
            components=[
                {"label": "Absent from current directory", "value": f"{nh_absent:,}", "payloadKey": "providerUniverses.nursingHome.absentFromCurrentDirectory"},
            ],
            limitations=["Absence is not termination and is not a current-provider total."],
            publication="INTERNAL",
        ),
        metric(
            key="hospice_typed_identities",
            label="Typed hospice identities",
            value=hospice_typed,
            grain="known_ccn_identity",
            denominator="All providers typed hospice",
            provider_class="hospice",
            description="All typed hospice identities, including quality-file-only CCNs.",
            coverage_num=hospice_typed,
            coverage_den=hospice_typed,
            coverage_display=f"{hospice_typed:,} typed hospice identities",
            sources=["hospice-general-information", "hospice-provider-data"],
            source_as_of=src("hospice-general-information", "hospice-provider-data"),
            generated_at=generated_at,
            method="count(*) FROM provider WHERE provider_type='hospice'.",
            payload_key="providerUniverses.hospice.typed",
            components=[
                {"label": "Typed identities", "value": f"{hospice_typed:,}", "payloadKey": "providerUniverses.hospice.typed"},
            ],
            limitations=["Typed identities are not the current GI directory."],
            publication="INTERNAL",
        ),
        metric(
            key="hospice_evidence_only",
            label="Hospice evidence-only identities",
            value=hospice_evidence_only,
            grain="evidence_only_identity",
            denominator="Typed hospice minus GI directory",
            provider_class="hospice",
            description="Typed hospice CCNs that appear in quality files but not the current GI directory.",
            coverage_num=hospice_evidence_only,
            coverage_den=hospice_typed,
            coverage_display=f"{hospice_evidence_only:,} of {hospice_typed:,} typed identities",
            sources=["hospice-general-information", "hospice-provider-data"],
            source_as_of=src("hospice-general-information", "hospice-provider-data"),
            generated_at=generated_at,
            method="Typed hospice providers minus distinct hospice_snapshot providers.",
            payload_key="providerUniverses.hospice.evidenceOnly",
            components=[
                {"label": "Evidence-only identities", "value": f"{hospice_evidence_only:,}", "payloadKey": "providerUniverses.hospice.evidenceOnly"},
            ],
            limitations=["Do not promote these CCNs into the current hospice provider count."],
            publication="INTERNAL",
        ),
        metric(
            key="mds_observations",
            label="MDS observations",
            value=mds,
            grain="mds_observation",
            denominator="Current CMS MDS Quality Measures release",
            provider_class="nursing_home",
            description="Facility-measure-period MDS quality-measure observations in the current CMS release.",
            coverage_num=mds,
            coverage_den=None,
            coverage_display=f"{mds:,} MDS observations",
            sources=["nursing-home-mds-quality-measures"],
            source_as_of=src("nursing-home-mds-quality-measures"),
            generated_at=generated_at,
            method="count(*) FROM facility_quality_measure_observation in the current cms_source_freshness release.",
            payload_key="evidenceFamilies.mds_observations.currentReleaseCount",
            components=[
                {"label": "Current-release MDS observations", "value": f"{mds:,}", "payloadKey": "evidenceFamilies.mds_observations.currentReleaseCount"},
            ],
            limitations=[
                "An MDS observation is not an inspection and is not a provider.",
                "Measure-period rows are not star ratings.",
            ],
            publication="PUBLIC",
        ),
        metric(
            key="fire_citations",
            label="Fire citations",
            value=fire,
            grain="fire_citation",
            denominator="Current CMS Fire Safety Deficiencies release",
            provider_class="nursing_home",
            description="Fire-safety citation rows in the current CMS Fire Safety Deficiencies release.",
            coverage_num=fire,
            coverage_den=None,
            coverage_display=f"{fire:,} fire citations",
            sources=["nursing-home-fire-safety-deficiencies"],
            source_as_of=src("nursing-home-fire-safety-deficiencies"),
            generated_at=generated_at,
            method="count(*) FROM fire_safety_citation in the current cms_source_freshness release.",
            payload_key="evidenceFamilies.fire_citations.currentReleaseCount",
            components=[
                {"label": "Current-release fire citations", "value": f"{fire:,}", "payloadKey": "evidenceFamilies.fire_citations.currentReleaseCount"},
            ],
            limitations=["A fire citation is not a provider and is not a health deficiency."],
            publication="PUBLIC",
        ),
        metric(
            key="inspection_events",
            label="Inspections",
            value=inspections,
            grain="inspection_event",
            denominator="Current CMS Inspection Dates release",
            provider_class="nursing_home",
            description="Inspection events in the current CMS Inspection Dates release. Not stacked historical ingest copies.",
            coverage_num=inspections,
            coverage_den=None,
            coverage_display=f"{inspections:,} inspection events",
            sources=["nursing-home-inspection-dates"],
            source_as_of=src("nursing-home-inspection-dates"),
            generated_at=generated_at,
            method="count(*) FROM inspection_event constrained to the current cms_source_freshness release.",
            payload_key="evidenceFamilies.inspection_events.currentReleaseCount",
            components=[
                {"label": "Current-release inspection events", "value": f"{inspections:,}", "payloadKey": "evidenceFamilies.inspection_events.currentReleaseCount"},
                {"label": "All ingested releases (internal)", "value": f"{int(counts['inspection_all']):,}", "payloadKey": "evidenceFamilies.inspection_events.allIngestedReleasesCount"},
            ],
            limitations=[
                "An inspection is not a deficiency and is not an enforcement action.",
                "Stacked historical ingest copies are not added into this public count.",
            ],
            publication="PUBLIC",
        ),
        metric(
            key="health_deficiencies",
            label="Health deficiencies",
            value=deficiencies,
            grain="health_deficiency",
            denominator="Current CMS Health Deficiencies release",
            provider_class="nursing_home",
            description="Health deficiency findings in the current CMS Health Deficiencies release.",
            coverage_num=deficiencies,
            coverage_den=None,
            coverage_display=f"{deficiencies:,} health deficiencies",
            sources=["nursing-home-health-deficiencies"],
            source_as_of=src("nursing-home-health-deficiencies"),
            generated_at=generated_at,
            method="count(*) FROM deficiency_finding constrained to the current cms_source_freshness release.",
            payload_key="evidenceFamilies.health_deficiencies.currentReleaseCount",
            components=[
                {"label": "Current-release health deficiencies", "value": f"{deficiencies:,}", "payloadKey": "evidenceFamilies.health_deficiencies.currentReleaseCount"},
            ],
            limitations=["A deficiency is not automatically an enforcement action."],
            publication="PUBLIC",
        ),
        metric(
            key="enforcement_records",
            label="Enforcement records",
            value=penalties,
            grain="enforcement_record",
            denominator="Current CMS Penalties release",
            provider_class="nursing_home",
            description="CMS penalty_enforcement rows in the current Penalties release, including fines and payment denials.",
            coverage_num=penalties,
            coverage_den=None,
            coverage_display=f"{penalties:,} enforcement records",
            sources=["nursing-home-penalties"],
            source_as_of=src("nursing-home-penalties"),
            generated_at=generated_at,
            method="count(*) FROM penalty_enforcement constrained to the current cms_source_freshness release.",
            payload_key="evidenceFamilies.enforcement_records.currentReleaseCount",
            components=[
                {"label": "Current-release enforcement records", "value": f"{penalties:,}", "payloadKey": "evidenceFamilies.enforcement_records.currentReleaseCount"},
                {"label": "Civil monetary penalties", "value": f"{fines:,}", "payloadKey": "metrics.civil_monetary_penalties.value"},
                {"label": "Payment denials", "value": f"{denials:,}", "payloadKey": "metrics.payment_denials.value"},
            ],
            limitations=["Every CMS row is not a regulatory action of the same kind. Fines and payment denials stay separate grains."],
            publication="PUBLIC",
        ),
        metric(
            key="civil_monetary_penalties",
            label="Civil monetary penalties",
            value=fines,
            grain="civil_monetary_penalty",
            denominator="Current CMS Penalties release, penalty_type='Fine'",
            provider_class="nursing_home",
            description="Fine rows in the current CMS Penalties release.",
            coverage_num=fines,
            coverage_den=penalties,
            coverage_display=f"{fines:,} of {penalties:,} current-release enforcement records",
            sources=["nursing-home-penalties"],
            source_as_of=src("nursing-home-penalties"),
            generated_at=generated_at,
            method="count(*) FROM penalty_enforcement WHERE penalty_type='Fine' in the current release.",
            payload_key="metrics.civil_monetary_penalties.value",
            components=[
                {"label": "Fines", "value": f"{fines:,}", "payloadKey": "metrics.civil_monetary_penalties.value"},
            ],
            limitations=["A fine is not a payment denial."],
            publication="PUBLIC",
        ),
        metric(
            key="payment_denials",
            label="Payment denials",
            value=denials,
            grain="payment_denial",
            denominator="Current CMS Penalties release, penalty_type='Payment Denial'",
            provider_class="nursing_home",
            description="Payment-denial rows in the current CMS Penalties release.",
            coverage_num=denials,
            coverage_den=penalties,
            coverage_display=f"{denials:,} of {penalties:,} current-release enforcement records",
            sources=["nursing-home-penalties"],
            source_as_of=src("nursing-home-penalties"),
            generated_at=generated_at,
            method="count(*) FROM penalty_enforcement WHERE penalty_type='Payment Denial' in the current release.",
            payload_key="metrics.payment_denials.value",
            components=[
                {"label": "Payment denials", "value": f"{denials:,}", "payloadKey": "metrics.payment_denials.value"},
            ],
            limitations=["A payment denial is not a civil monetary penalty."],
            publication="PUBLIC",
        ),
        metric(
            key="pbj_quarter_summaries",
            label="Staffing records",
            value=pbj_quarters,
            grain="pbj_quarter_summary",
            denominator="Current PBJ Daily Nurse Staffing release, quarterly summaries",
            provider_class="nursing_home",
            description="PBJ quarterly staffing summaries in the current CMS staffing release. Not daily hour rows and not facilities.",
            coverage_num=pbj_quarters,
            coverage_den=None,
            coverage_display=f"{pbj_quarters:,} PBJ quarterly summaries",
            sources=["payroll-based-journal-daily-nurse-staffing"],
            source_as_of=src("payroll-based-journal-daily-nurse-staffing"),
            generated_at=generated_at,
            method="count(*) FROM pbj_staffing_quarter_summary in the current cms_source_freshness release.",
            payload_key="evidenceFamilies.pbj_quarter_summaries.currentReleaseCount",
            components=[
                {"label": "Current-release quarterly summaries", "value": f"{pbj_quarters:,}", "payloadKey": "evidenceFamilies.pbj_quarter_summaries.currentReleaseCount"},
                {"label": "Current-release daily rows (internal)", "value": f"{int(counts['pbj_days_latest']):,}", "payloadKey": "evidenceFamilies.pbj_staffing_days.currentReleaseCount"},
            ],
            limitations=[
                "A staffing observation is not a facility.",
                "Daily PBJ hour rows are a different grain and are not the public staffing count.",
            ],
            publication="PUBLIC",
        ),
        metric(
            key="chow_events",
            label="Nursing Home CHOW events",
            value=chow,
            grain="chow_event",
            denominator="CMS Skilled Nursing Facility Change of Ownership events",
            provider_class="nursing_home",
            description="SNF change-of-ownership events in the research graph.",
            coverage_num=chow,
            coverage_den=None,
            coverage_display=f"{chow:,} CHOW events",
            sources=["skilled-nursing-facility-change-of-ownership"],
            source_as_of=src("skilled-nursing-facility-change-of-ownership"),
            generated_at=generated_at,
            method="count(*) FROM ownership_change_event.",
            payload_key="evidenceFamilies.chow_events.currentReleaseCount",
            components=[
                {"label": "CHOW events", "value": f"{chow:,}", "payloadKey": "evidenceFamilies.chow_events.currentReleaseCount"},
                {"label": "Providers with CHOW history", "value": f"{int(counts['chow_providers']):,}", "payloadKey": "nursingHome.chow.providersWithHistory"},
            ],
            limitations=[
                "A CHOW record is not a sale and is not a quality finding.",
                "CMS does not publish Home Health or Hospice CHOW event files.",
            ],
            publication="PUBLIC",
        ),
        metric(
            key="hh_quality_observations",
            label="Home Health quality observations",
            value=int(counts["hh_quality"]),
            grain="quality_observation",
            denominator="CMS Home Health quality-of-patient-care observations",
            provider_class="home_health",
            description="Home Health QRP quality observations. Not a Nursing Home MDS observation.",
            coverage_num=int(counts["hh_quality"]),
            coverage_den=None,
            coverage_display=f"{int(counts['hh_quality']):,} Home Health quality observations",
            sources=["home-health-care-agencies"],
            source_as_of=src("home-health-care-agencies"),
            generated_at=generated_at,
            method="count(*) FROM cms_agency_quality_observation WHERE measure_family='hh_quality'.",
            payload_key="evidenceFamilies.hh_quality_observations.currentReleaseCount",
            components=[
                {"label": "HH quality observations", "value": f"{int(counts['hh_quality']):,}", "payloadKey": "evidenceFamilies.hh_quality_observations.currentReleaseCount"},
            ],
            limitations=["Home Health quality observations are not Nursing Home MDS observations."],
            publication="PUBLIC",
        ),
        metric(
            key="hh_hhcahps_observations",
            label="Home Health HHCAHPS observations",
            value=int(counts["hh_hhcahps"]),
            grain="quality_observation",
            denominator="CMS Home Health HHCAHPS observations",
            provider_class="home_health",
            description="HHCAHPS survey observations for Home Health agencies.",
            coverage_num=int(counts["hh_hhcahps"]),
            coverage_den=None,
            coverage_display=f"{int(counts['hh_hhcahps']):,} HHCAHPS observations",
            sources=["home-health-patient-survey-hhcahps"],
            source_as_of=src("home-health-patient-survey-hhcahps"),
            generated_at=generated_at,
            method="count(*) FROM cms_agency_quality_observation WHERE measure_family='hh_hhcahps'.",
            payload_key="evidenceFamilies.hh_hhcahps_observations.currentReleaseCount",
            components=[
                {"label": "HHCAHPS observations", "value": f"{int(counts['hh_hhcahps']):,}", "payloadKey": "evidenceFamilies.hh_hhcahps_observations.currentReleaseCount"},
            ],
            limitations=["HHCAHPS is a survey family, not a CMS Quality of Patient Care star."],
            publication="PUBLIC",
        ),
        metric(
            key="hospice_quality_observations",
            label="Hospice quality observations",
            value=int(counts["hospice_quality"]),
            grain="quality_observation",
            denominator="CMS Hospice quality observations",
            provider_class="hospice",
            description="Hospice quality-measure observations. Hospice has no overall CMS star in this directory.",
            coverage_num=int(counts["hospice_quality"]),
            coverage_den=None,
            coverage_display=f"{int(counts['hospice_quality']):,} Hospice quality observations",
            sources=["hospice-provider-data"],
            source_as_of=src("hospice-provider-data"),
            generated_at=generated_at,
            method="count(*) FROM cms_agency_quality_observation WHERE measure_family='hospice_quality'.",
            payload_key="evidenceFamilies.hospice_quality_observations.currentReleaseCount",
            components=[
                {"label": "Hospice quality observations", "value": f"{int(counts['hospice_quality']):,}", "payloadKey": "evidenceFamilies.hospice_quality_observations.currentReleaseCount"},
            ],
            limitations=["Hospice quality observations are not an overall CMS star."],
            publication="PUBLIC",
        ),
        metric(
            key="hospice_cahps_observations",
            label="Hospice CAHPS observations",
            value=int(counts["hospice_cahps"]),
            grain="quality_observation",
            denominator="CMS CAHPS Hospice Survey observations",
            provider_class="hospice",
            description="CAHPS Hospice Survey observations.",
            coverage_num=int(counts["hospice_cahps"]),
            coverage_den=None,
            coverage_display=f"{int(counts['hospice_cahps']):,} CAHPS Hospice observations",
            sources=["hospice-provider-cahps"],
            source_as_of=src("hospice-provider-cahps"),
            generated_at=generated_at,
            method="count(*) FROM cms_agency_quality_observation WHERE measure_family='hospice_cahps'.",
            payload_key="evidenceFamilies.hospice_cahps_observations.currentReleaseCount",
            components=[
                {"label": "CAHPS Hospice observations", "value": f"{int(counts['hospice_cahps']):,}", "payloadKey": "evidenceFamilies.hospice_cahps_observations.currentReleaseCount"},
            ],
            limitations=["CAHPS Hospice Survey evidence is not an overall CMS star."],
            publication="PUBLIC",
        ),
        metric(
            key="inspection_events_all_ingested_releases",
            label="Inspection events across ingested releases",
            value=int(counts["inspection_all"]),
            grain="inspection_event",
            denominator="All ingested CMS Inspection Dates releases retained in canonical storage",
            provider_class="nursing_home",
            description="Internal stacked ingest count. Not the public inspection metric.",
            coverage_num=int(counts["inspection_all"]),
            coverage_den=None,
            coverage_display=f"{int(counts['inspection_all']):,} ingested inspection rows",
            sources=["nursing-home-inspection-dates"],
            source_as_of=src("nursing-home-inspection-dates"),
            generated_at=generated_at,
            method="count(*) FROM inspection_event with no current-release constraint.",
            payload_key="evidenceFamilies.inspection_events.allIngestedReleasesCount",
            components=[
                {"label": "All ingested inspection rows", "value": f"{int(counts['inspection_all']):,}", "payloadKey": "evidenceFamilies.inspection_events.allIngestedReleasesCount"},
            ],
            limitations=["Stacked historical copies are not a current CMS file count."],
            publication="INTERNAL",
        ),
        metric(
            key="health_deficiencies_all_ingested_releases",
            label="Health deficiencies across ingested releases",
            value=int(counts["deficiency_all"]),
            grain="health_deficiency",
            denominator="All ingested CMS Health Deficiencies releases retained in canonical storage",
            provider_class="nursing_home",
            description="Internal stacked ingest count. Not the public deficiency metric.",
            coverage_num=int(counts["deficiency_all"]),
            coverage_den=None,
            coverage_display=f"{int(counts['deficiency_all']):,} ingested deficiency rows",
            sources=["nursing-home-health-deficiencies"],
            source_as_of=src("nursing-home-health-deficiencies"),
            generated_at=generated_at,
            method="count(*) FROM deficiency_finding with no current-release constraint.",
            payload_key="evidenceFamilies.health_deficiencies.allIngestedReleasesCount",
            components=[
                {"label": "All ingested deficiency rows", "value": f"{int(counts['deficiency_all']):,}", "payloadKey": "evidenceFamilies.health_deficiencies.allIngestedReleasesCount"},
            ],
            limitations=["Stacked historical copies are not a current CMS file count."],
            publication="INTERNAL",
        ),
        metric(
            key="enforcement_records_all_ingested_releases",
            label="Enforcement records across ingested releases",
            value=int(counts["penalty_all"]),
            grain="enforcement_record",
            denominator="All ingested CMS Penalties releases retained in canonical storage",
            provider_class="nursing_home",
            description="Internal stacked ingest count. Not the public enforcement metric.",
            coverage_num=int(counts["penalty_all"]),
            coverage_den=None,
            coverage_display=f"{int(counts['penalty_all']):,} ingested enforcement rows",
            sources=["nursing-home-penalties"],
            source_as_of=src("nursing-home-penalties"),
            generated_at=generated_at,
            method="count(*) FROM penalty_enforcement with no current-release constraint.",
            payload_key="evidenceFamilies.enforcement_records.allIngestedReleasesCount",
            components=[
                {"label": "All ingested enforcement rows", "value": f"{int(counts['penalty_all']):,}", "payloadKey": "evidenceFamilies.enforcement_records.allIngestedReleasesCount"},
            ],
            limitations=["Stacked historical copies are not a current CMS file count."],
            publication="INTERNAL",
        ),
        metric(
            key="pbj_staffing_days_current_release",
            label="PBJ daily staffing rows",
            value=int(counts["pbj_days_latest"]),
            grain="pbj_staffing_day",
            denominator="Current PBJ Daily Nurse Staffing release, daily rows",
            provider_class="nursing_home",
            description="Daily PBJ hour rows in the current staffing release. Internal because this grain is not a staffing-record count for families.",
            coverage_num=int(counts["pbj_days_latest"]),
            coverage_den=None,
            coverage_display=f"{int(counts['pbj_days_latest']):,} daily PBJ rows",
            sources=["payroll-based-journal-daily-nurse-staffing"],
            source_as_of=src("payroll-based-journal-daily-nurse-staffing"),
            generated_at=generated_at,
            method="count(*) FROM pbj_staffing_day in the current cms_source_freshness release.",
            payload_key="evidenceFamilies.pbj_staffing_days.currentReleaseCount",
            components=[
                {"label": "Current-release daily rows", "value": f"{int(counts['pbj_days_latest']):,}", "payloadKey": "evidenceFamilies.pbj_staffing_days.currentReleaseCount"},
            ],
            limitations=["Daily hour rows are not facilities and are not the public staffing-record count."],
            publication="INTERNAL",
        ),
        metric(
            key="canonical_organizations",
            label="Canonical organizations",
            value=int(counts["orgs"]),
            grain="organization",
            denominator="Ownership graph organization nodes",
            provider_class="ownership_graph",
            description="Distinct organizations in the CMS/PECOS ownership graph.",
            coverage_num=int(counts["orgs"]),
            coverage_den=None,
            coverage_display=f"{int(counts['orgs']):,} organizations",
            sources=["nursing-home-ownership", "skilled-nursing-facility-all-owners"],
            source_as_of=src("nursing-home-ownership", "skilled-nursing-facility-all-owners"),
            generated_at=generated_at,
            method="count(*) FROM organization.",
            payload_key="evidenceFamilies.canonical_organizations.currentReleaseCount",
            components=[
                {"label": "Organizations", "value": f"{int(counts['orgs']):,}", "payloadKey": "evidenceFamilies.canonical_organizations.currentReleaseCount"},
            ],
            limitations=["Organization count is not a provider-class universe."],
            publication="INTERNAL",
        ),
        metric(
            key="ownership_graph_edges",
            label="Ownership graph edges",
            value=int(counts["ownership_edges"]),
            grain="ownership_edge",
            denominator="provider_organization_edge rows",
            provider_class="ownership_graph",
            description="Ownership-graph relationship edges. Not current providers and not CHOW events.",
            coverage_num=int(counts["ownership_edges"]),
            coverage_den=None,
            coverage_display=f"{int(counts['ownership_edges']):,} ownership edges",
            sources=["nursing-home-ownership", "skilled-nursing-facility-all-owners"],
            source_as_of=src("nursing-home-ownership", "skilled-nursing-facility-all-owners"),
            generated_at=generated_at,
            method="count(*) FROM provider_organization_edge.",
            payload_key="evidenceFamilies.ownership_graph_edges.currentReleaseCount",
            components=[
                {"label": "Ownership edges", "value": f"{int(counts['ownership_edges']):,}", "payloadKey": "evidenceFamilies.ownership_graph_edges.currentReleaseCount"},
            ],
            limitations=["An ownership edge is not a facility and is not a CHOW event."],
            publication="INTERNAL",
        ),
        metric(
            key="combined_cms_senior_providers",
            label="Combined CMS senior providers",
            value=None,
            grain="combined_provider_classes",
            denominator="Not a published denominator",
            provider_class="cross_class",
            description="Intentionally not computed. Nursing Home, Home Health, and Hospice remain separate universes.",
            coverage_num=None,
            coverage_den=None,
            coverage_display="Unsupported",
            sources=[],
            source_as_of=None,
            generated_at=generated_at,
            method="Not computed. Classes stay separate.",
            payload_key="combinedProviderDenominator",
            components=[
                {"label": "Unsupported class-record sum", "value": f"{nh_current + hh_current + hospice_current:,}", "payloadKey": "combinedProviderDenominator.classRecordSum"},
            ],
            limitations=["Do not publish NH + Home Health + Hospice as one senior-provider total."],
            publication="UNSUPPORTED",
        ),
        metric(
            key="combined_indexed_evidence_records",
            label="Combined indexed senior-care evidence records",
            value=None,
            grain="combined_incompatible_evidence_grains",
            denominator="Not a published denominator",
            provider_class="cross_class",
            description="Rejected. Component grains are not additive for a public combined evidence headline.",
            coverage_num=None,
            coverage_den=None,
            coverage_display="Rejected",
            sources=[],
            source_as_of=None,
            generated_at=generated_at,
            method="Candidate current-release sum is retained only to prove the rejection is reconstructable.",
            payload_key="combinedEvidenceDepth",
            components=[
                {"label": "Candidate current-release sum", "value": f"{candidate_sum:,}", "payloadKey": "combinedEvidenceDepth.candidateCurrentReleaseSum"},
            ],
            limitations=[
                "MDS observations, fire citations, inspections, deficiencies, enforcement, staffing summaries, and CHOW events are different grains.",
                "Deficiencies overlap conceptually with inspections. The sum is not a stable public metric.",
            ],
            publication="REJECTED",
        ),
    ]

    public_as_of = sorted(
        metric["sourceAsOf"] for metric in metrics if metric["publicationStatus"] == "PUBLIC" and metric["sourceAsOf"]
    )
    newest = public_as_of[-1] if public_as_of else None

    payload: dict[str, Any] = {
        "schemaVersion": SCHEMA,
        "generatedAt": generated_at,
        "canonicalSnapshotFingerprint": hub["sourceFingerprint"],
        "newestSourceAsOf": {
            "value": newest,
            "semantics": NEWEST_SEMANTICS,
        },
        "combinedProviderDenominator": {
            "status": "UNSUPPORTED",
            "classRecordSum": nh_current + hh_current + hospice_current,
            "publishAsHeadline": False,
            "semantics": (
                "Sum of three distinct CMS class directories. Not unique organizations or unique companies. "
                "Not published as a headline total."
            ),
        },
        "combinedEvidenceDepth": {
            "status": "REJECTED",
            "publishAsHeadline": False,
            "candidateCurrentReleaseSum": candidate_sum,
            "enumeratedGrains": [
                "mds_observation",
                "fire_citation",
                "inspection_event",
                "health_deficiency",
                "enforcement_record",
                "pbj_quarter_summary",
                "chow_event",
            ],
            "reason": (
                "A combined 'indexed senior-care evidence records' headline would mix incompatible CMS grains, "
                "including observations, citations, inspections, deficiencies, enforcement rows, staffing summaries, "
                "and CHOW events. Deficiencies are not independent of inspections. The candidate sum is reconstructable "
                "from enumerated current-release components but is not stable enough, or clear enough, to publish."
            ),
        },
        "providerUniverses": {
            "nursingHome": {
                "current": nh_current,
                "known": nh_known,
                "absentFromCurrentDirectory": nh_absent,
                "identity": "CMS CCN",
                "directory": "Nursing Home Provider Information",
                "publicationGate": "Latest provider_directory_status CURRENT_ACTIVE",
            },
            "homeHealth": {
                "current": hh_current,
                "known": hh_current,
                "identity": "CMS Home Health CCN",
                "directory": "Home Health Care Agencies",
                "publicationGate": "home_health_snapshot current directory row with office identity",
            },
            "hospice": {
                "current": hospice_current,
                "typed": hospice_typed,
                "evidenceOnly": hospice_evidence_only,
                "identity": "CMS Hospice CCN",
                "directory": "Hospice General Information",
                "publicationGate": "hospice_snapshot GI directory; quality-only CCNs excluded",
            },
        },
        "evidenceFamilies": {
            "mds_observations": {
                "key": "mds_observations",
                "grain": "mds_observation",
                "currentReleaseCount": mds,
                "allIngestedReleasesCount": int(counts["mds_all"]),
                "publicationStatus": "PUBLIC",
            },
            "fire_citations": {
                "key": "fire_citations",
                "grain": "fire_citation",
                "currentReleaseCount": fire,
                "allIngestedReleasesCount": int(counts["fire_all"]),
                "publicationStatus": "PUBLIC",
            },
            "inspection_events": {
                "key": "inspection_events",
                "grain": "inspection_event",
                "currentReleaseCount": inspections,
                "allIngestedReleasesCount": int(counts["inspection_all"]),
                "publicationStatus": "PUBLIC",
            },
            "health_deficiencies": {
                "key": "health_deficiencies",
                "grain": "health_deficiency",
                "currentReleaseCount": deficiencies,
                "allIngestedReleasesCount": int(counts["deficiency_all"]),
                "publicationStatus": "PUBLIC",
            },
            "enforcement_records": {
                "key": "enforcement_records",
                "grain": "enforcement_record",
                "currentReleaseCount": penalties,
                "allIngestedReleasesCount": int(counts["penalty_all"]),
                "publicationStatus": "PUBLIC",
            },
            "pbj_quarter_summaries": {
                "key": "pbj_quarter_summaries",
                "grain": "pbj_quarter_summary",
                "currentReleaseCount": pbj_quarters,
                "allIngestedReleasesCount": int(counts["pbj_quarters_all"]),
                "publicationStatus": "PUBLIC",
            },
            "pbj_staffing_days": {
                "key": "pbj_staffing_days_current_release",
                "grain": "pbj_staffing_day",
                "currentReleaseCount": int(counts["pbj_days_latest"]),
                "allIngestedReleasesCount": int(counts["pbj_days_all"]),
                "publicationStatus": "INTERNAL",
            },
            "chow_events": {
                "key": "chow_events",
                "grain": "chow_event",
                "currentReleaseCount": chow,
                "allIngestedReleasesCount": chow,
                "publicationStatus": "PUBLIC",
            },
            "hh_quality_observations": {
                "key": "hh_quality_observations",
                "grain": "quality_observation",
                "currentReleaseCount": int(counts["hh_quality"]),
                "allIngestedReleasesCount": int(counts["hh_quality"]),
                "publicationStatus": "PUBLIC",
            },
            "hh_hhcahps_observations": {
                "key": "hh_hhcahps_observations",
                "grain": "quality_observation",
                "currentReleaseCount": int(counts["hh_hhcahps"]),
                "allIngestedReleasesCount": int(counts["hh_hhcahps"]),
                "publicationStatus": "PUBLIC",
            },
            "hospice_quality_observations": {
                "key": "hospice_quality_observations",
                "grain": "quality_observation",
                "currentReleaseCount": int(counts["hospice_quality"]),
                "allIngestedReleasesCount": int(counts["hospice_quality"]),
                "publicationStatus": "PUBLIC",
            },
            "hospice_cahps_observations": {
                "key": "hospice_cahps_observations",
                "grain": "quality_observation",
                "currentReleaseCount": int(counts["hospice_cahps"]),
                "allIngestedReleasesCount": int(counts["hospice_cahps"]),
                "publicationStatus": "PUBLIC",
            },
            "canonical_organizations": {
                "key": "canonical_organizations",
                "grain": "organization",
                "currentReleaseCount": int(counts["orgs"]),
                "allIngestedReleasesCount": int(counts["orgs"]),
                "publicationStatus": "INTERNAL",
            },
            "ownership_graph_edges": {
                "key": "ownership_graph_edges",
                "grain": "ownership_edge",
                "currentReleaseCount": int(counts["ownership_edges"]),
                "allIngestedReleasesCount": int(counts["ownership_edges"]),
                "publicationStatus": "INTERNAL",
            },
        },
        "geography": {
            "states": geography,
            "note": "State counts are office/facility geography from each class directory. They are not one senior-provider map and are not service-area counts.",
        },
        "freshness": {
            "sources": sources,
            "note": "sourceAsOf is the official CMS/source-modified date. generatedAt is when this manifest was recomputed. Ingest success is operational, not a substitute for source freshness.",
        },
        "metrics": metrics,
    }
    payload["sourceFingerprint"] = fingerprint(payload)

    if payload["canonicalSnapshotFingerprint"] != hub["sourceFingerprint"]:
        raise SystemExit("Hub intel fingerprint mismatch")
    if hub["nursingHome"]["current"] != nh_current:
        raise SystemExit(f"NH current {nh_current} != hub intel {hub['nursingHome']['current']}")
    if hub["homeHealth"]["current"] != hh_current:
        raise SystemExit(f"HH current {hh_current} != hub intel {hub['homeHealth']['current']}")
    if hub["hospice"]["current"] != hospice_current:
        raise SystemExit(
            f"Hospice current {hospice_current} != hub intel {hub['hospice']['current']}"
        )

    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(f"wrote {OUT}", flush=True)
    print(f"fingerprint {payload['sourceFingerprint']}", flush=True)
    print(
        f"NH {nh_current} HH {hh_current} Hospice {hospice_current} MDS {mds} fire {fire} inspections {inspections}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
