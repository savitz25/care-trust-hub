"""SEN-NAT-013: build the national hub intelligence JSON from the 008 snapshot plus bounded extras."""

from __future__ import annotations

import json
import os
import time
from collections import Counter
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

EXPECTED = {
    "nh_current": 14690,
    "hh_current": 12460,
    "hospice_current": 6669,
    "nh_known": 14696,
    "hospice_typed_identities": 6911,
    "orgs": 205082,
    "unknown_edges": 554644,
    "chow_events": 5227,
}

def num(value) -> int:
    if value is None:
        return 0
    return int(value)


def pct(part: int, whole: int) -> float | None:
    if whole <= 0:
        return None
    return round(100.0 * part / whole, 2)


def dist_payload(counter: Counter[str], total: int) -> dict[str, object]:
    keys = ["1", "2", "3", "4", "5", "missing"]
    counts = {key: int(counter.get(key, 0)) for key in keys}
    if sum(counts.values()) != total:
        raise SystemExit(
            f"STAR DISTRIBUTION MISMATCH: {sum(counts.values())} != directory {total} {counts}"
        )
    return {
        "counts": counts,
        "percentsOfReported": {
            key: pct(counts[key], total - counts["missing"]) for key in ["1", "2", "3", "4", "5"]
        },
        "reported": total - counts["missing"],
        "missing": counts["missing"],
        "directory": total,
        "label": "CMS star rating among providers with a reported CMS star. Missing is not zero.",
    }


started = time.perf_counter()
with psycopg.connect(os.environ["CARE_DATABASE_URL"], autocommit=True) as conn:
    conn.execute("SET statement_timeout = '180s'")
    snap = conn.execute(
        """
        SELECT id, snapshot_version, fingerprint, generated_at, transformation_version
        FROM senior_intelligence_snapshot
        WHERE snapshot_version='senior-national-intel-v1'
        ORDER BY generated_at DESC
        LIMIT 1
        """
    ).fetchone()
    if not snap:
        raise SystemExit("No senior-national-intel-v1 snapshot")
    snapshot_id, snapshot_version, fingerprint, generated_at, transformation_version = snap
    rows = conn.execute(
        """
        SELECT metric_key, value_numeric, value_jsonb, numerator, denominator, status
        FROM senior_intelligence_metric_value
        WHERE snapshot_id=%s
        """,
        (snapshot_id,),
    ).fetchall()
    metrics = {
        key: {
            "numeric": float(numeric) if numeric is not None else None,
            "json": payload,
            "numerator": float(numerator) if numerator is not None else None,
            "denominator": float(denominator) if denominator is not None else None,
            "status": status,
        }
        for key, numeric, payload, numerator, denominator, status in rows
    }

    def metric_int(key: str) -> int:
        value = metrics[key]["numeric"]
        if value is None:
            raise SystemExit(f"Missing numeric metric {key}")
        return int(value)

    nh = metric_int("nh_current")
    hh = metric_int("hh_current")
    hospice = metric_int("hospice_current")
    typed = metric_int("hospice_typed_identities")
    nh_known = metric_int("nh_known")

    mismatches = {
        key: (actual, expected)
        for key, expected, actual in [
            ("nh_current", EXPECTED["nh_current"], nh),
            ("hh_current", EXPECTED["hh_current"], hh),
            ("hospice_current", EXPECTED["hospice_current"], hospice),
            ("nh_known", EXPECTED["nh_known"], nh_known),
            ("hospice_typed_identities", EXPECTED["hospice_typed_identities"], typed),
        ]
        if actual != expected
    }
    if mismatches:
        raise SystemExit(f"CENSUS MISMATCH — stop. {mismatches}")

    nh_stars = conn.execute(
        """
        WITH current_nh AS (
          SELECT latest.provider_id
          FROM (
            SELECT DISTINCT ON (pds.ccn) pds.provider_id, pds.directory_status
            FROM provider_directory_status pds
            JOIN provider p ON p.id = pds.provider_id
            WHERE p.provider_type='nursing_home'
            ORDER BY pds.ccn, pds.observed_at DESC, pds.ingested_at DESC
          ) latest
          WHERE latest.directory_status='CURRENT_ACTIVE'
        ),
        latest_snap AS (
          SELECT DISTINCT ON (s.provider_id) s.provider_id, s.overall_rating
          FROM facility_snapshot s
          JOIN current_nh c ON c.provider_id=s.provider_id
          ORDER BY s.provider_id, s.observed_at DESC NULLS LAST, s.id DESC
        )
        SELECT overall_rating, count(*) FROM latest_snap GROUP BY 1
        """
    ).fetchall()
    hh_stars = conn.execute(
        """
        WITH latest AS (
          SELECT DISTINCT ON (cms_ccn) quality_of_patient_care_star
          FROM home_health_snapshot
          ORDER BY cms_ccn, id DESC
        )
        SELECT quality_of_patient_care_star, count(*) FROM latest GROUP BY 1
        """
    ).fetchall()

    regulatory = conn.execute(
        """
        WITH current_nh AS (
          SELECT latest.provider_id
          FROM (
            SELECT DISTINCT ON (pds.ccn) pds.provider_id, pds.directory_status
            FROM provider_directory_status pds
            JOIN provider p ON p.id = pds.provider_id
            WHERE p.provider_type='nursing_home'
            ORDER BY pds.ccn, pds.observed_at DESC, pds.ingested_at DESC
          ) latest
          WHERE latest.directory_status='CURRENT_ACTIVE'
        )
        SELECT jsonb_build_object(
          'inspectionEvents', (SELECT count(*) FROM inspection_event),
          'inspectionProvidersCurrent', (
            SELECT count(DISTINCT i.provider_id)
            FROM inspection_event i JOIN current_nh c ON c.provider_id=i.provider_id
          ),
          'inspectionDateMin', (SELECT min(survey_date) FROM inspection_event),
          'inspectionDateMax', (SELECT max(survey_date) FROM inspection_event),
          'deficiencyFindings', (SELECT count(*) FROM deficiency_finding),
          'deficiencyProvidersCurrent', (
            SELECT count(DISTINCT d.provider_id)
            FROM deficiency_finding d JOIN current_nh c ON c.provider_id=d.provider_id
          ),
          'complaintDeficiencyFindings', (
            SELECT count(*) FROM deficiency_finding WHERE complaint_deficiency IS TRUE
          ),
          'penaltyActions', (SELECT count(*) FROM penalty_enforcement),
          'penaltyProvidersCurrent', (
            SELECT count(DISTINCT p.provider_id)
            FROM penalty_enforcement p JOIN current_nh c ON c.provider_id=p.provider_id
          ),
          'penaltyFines', (SELECT count(*) FROM penalty_enforcement WHERE penalty_type='Fine'),
          'penaltyPaymentDenials', (
            SELECT count(*) FROM penalty_enforcement WHERE penalty_type='Payment Denial'
          ),
          'penaltyDateMin', (SELECT min(penalty_date) FROM penalty_enforcement),
          'penaltyDateMax', (SELECT max(penalty_date) FROM penalty_enforcement)
        )
        """
    ).fetchone()[0]

    freshness_rows = conn.execute(
        """
        SELECT dataset_key, display_name, cms_identifier, source_modified_at, source_period,
               retrieved_at, last_success_at, freshness_band, official_url, refresh_cadence
        FROM cms_source_freshness
        ORDER BY dataset_key
        """
    ).fetchall()
    person_equity_owners = conn.execute(
        """
        SELECT count(DISTINCT ownership_party_id)
        FROM provider_organization_edge
        WHERE party_kind='individual' AND relationship_class='OWNERSHIP'
        """
    ).fetchone()[0]

elapsed_ms = round((time.perf_counter() - started) * 1000, 1)

nh_star_counter = Counter()
for rating, count in nh_stars:
    nh_star_counter["missing" if rating is None else str(int(rating))] += int(count)
hh_star_counter = Counter()
for rating, count in hh_stars:
    hh_star_counter["missing" if rating is None else str(int(rating))] += int(count)

geo = metrics["provider_office_states"]["json"] or {}
nh_by_state = {k: int(v) for k, v in (geo.get("nursing_home_by_state") or {}).items()}
hh_by_state = {k: int(v) for k, v in (geo.get("home_health_by_state") or {}).items()}
hos_by_state = {k: int(v) for k, v in (geo.get("hospice_by_state") or {}).items()}
if sum(nh_by_state.values()) != nh:
    raise SystemExit(f"NH state sum {sum(nh_by_state.values())} != {nh}")
if sum(hh_by_state.values()) != hh:
    raise SystemExit(f"HH state sum {sum(hh_by_state.values())} != {hh}")
if sum(hos_by_state.values()) != hospice:
    raise SystemExit(f"Hospice state sum {sum(hos_by_state.values())} != {hospice}")

nh_cov = metrics["nh_evidence_coverage"]["json"]
hh_cov = metrics["hh_evidence_coverage"]["json"]
hos_cov = metrics["hospice_evidence_coverage"]["json"]
owned = metrics["owned_by_providers_by_class"]["json"]

sources = []
for row in freshness_rows:
    key = row[0]
    sources.append(
        {
            "datasetKey": key,
            "displayName": row[1],
            "sourceAgency": "CMS",
            "cmsIdentifier": row[2],
            "sourceModifiedAt": row[3].isoformat() if row[3] else None,
            "sourcePeriod": row[4],
            "retrievedAt": row[5].isoformat() if row[5] else None,
            "lastIngestSuccessAt": row[6].isoformat() if row[6] else None,
            "freshnessBand": row[7],
            "officialUrl": row[8],
            "refreshCadence": row[9],
            "limitation": "Source modified/as-of dates are evidence freshness. Ingest success is operational, not a substitute for source freshness.",
        }
    )

states = sorted(set(nh_by_state) | set(hh_by_state) | set(hos_by_state))
geography = [
    {
        "state": code,
        "nursingHomes": nh_by_state.get(code, 0),
        "homeHealth": hh_by_state.get(code, 0),
        "hospice": hos_by_state.get(code, 0),
    }
    for code in states
]

payload = {
    "contractVersion": "senior-hub-intel-v1",
    "snapshotVersion": snapshot_version,
    "sourceFingerprint": fingerprint,
    "generatedAt": generated_at.isoformat(),
    "generationMs": elapsed_ms,
    "score": None,
    "ranking": None,
    "combinedProviderDenominator": {
        "status": "UNSUPPORTED",
        "classRecordSum": nh + hh + hospice,
        "semantics": "Sum of three distinct CMS class directories. Not unique organizations or unique companies. Not published as a headline total.",
        "publishAsHeadline": False,
    },
    "providerClasses": [
        {
            "id": "nursing_home",
            "label": "Nursing Homes",
            "current": nh,
            "known": nh_known,
            "identity": "CMS CCN",
            "directory": "Nursing Home Provider Information",
        },
        {
            "id": "home_health",
            "label": "Home Health Agencies",
            "current": hh,
            "known": None,
            "identity": "CMS Home Health CCN",
            "directory": "Home Health Care Agencies",
        },
        {
            "id": "hospice",
            "label": "Hospice Providers",
            "current": hospice,
            "known": typed,
            "evidenceOnly": typed - hospice,
            "identity": "CMS Hospice CCN",
            "directory": "Hospice General Information",
        },
    ],
    "nursingHome": {
        "current": nh,
        "known": nh_known,
        "starDistribution": dist_payload(nh_star_counter, nh),
        "coverage": {
            "mdsQualityProviders": int(nh_cov["mds"]),
            "mdsQualityMissing": int(nh_cov["mds_missing"]),
            "staffingPbjProviders": int(nh_cov["pbj"]),
            "inspectionProviders": int(nh_cov["inspection"]),
            "fireSafetyProviders": int(nh_cov["fire"]),
            "ownedByProviders": int(nh_cov["owned_by"]),
            "chowHistoryProviders": int(nh_cov["chow_history"]),
        },
        "chow": {
            "status": "SUPPORTED",
            "events": metric_int("nh_chow_events"),
            "providersWithHistory": metric_int("nh_chow_history_providers"),
            "sourceFamily": "Skilled Nursing Facility Change of Ownership",
        },
    },
    "homeHealth": {
        "current": hh,
        "starDistribution": dist_payload(hh_star_counter, hh),
        "coverage": {
            "qualityOfPatientCareProviders": int(hh_cov["quality"]),
            "hhcahpsProviders": int(hh_cov["hhcahps"]),
            "ownedByProviders": int(hh_cov["owned_by"]),
            "zipCoverageProviders": int(hh_cov["zip_coverage"]),
        },
        "chow": {
            "status": "UNSUPPORTED",
            "reason": "CMS does not publish a Home Health ownership-change event file.",
        },
    },
    "hospice": {
        "current": hospice,
        "typed": typed,
        "evidenceOnly": typed - hospice,
        "coverage": {
            "qualityMeasureProviders": int(hos_cov["qrp"]),
            "cahpsProviders": int(hos_cov["cahps"]),
            "ownedByProviders": int(hos_cov["owned_by"]),
            "zipCoverageProviders": int(hos_cov["zip_coverage"]),
        },
        "chow": {
            "status": "UNSUPPORTED",
            "reason": "CMS does not publish a Hospice ownership-change event file.",
        },
    },
    "ownership": {
        "organizations": metric_int("canonical_organizations"),
        "unknownEdges": metric_int("unknown_ownership_edges"),
        "unresolvedEdges": metric_int("unresolved_provider_org_edges"),
        "currentOwnedByProviders": {
            "nursingHome": int(owned["nursing_home"]),
            "homeHealth": int(owned["home_health"]),
            "hospice": int(owned["hospice"]),
        },
        "networkSize": metrics["owner_network_size"]["json"],
        "multiStateFootprint": metrics["org_multi_state_office_footprint"]["json"],
        "crossClassOrganizations": metrics["cross_class_organizations"]["json"],
        "personEquityOwners": int(person_equity_owners),
    },
    "regulatory": {
        "class": "nursing_home",
        "inspection": {
            "observations": int(regulatory["inspectionEvents"]),
            "currentProvidersWithObservation": int(regulatory["inspectionProvidersCurrent"]),
            "dateMin": str(regulatory["inspectionDateMin"]) if regulatory["inspectionDateMin"] else None,
            "dateMax": str(regulatory["inspectionDateMax"]) if regulatory["inspectionDateMax"] else None,
        },
        "deficiencies": {
            "observations": int(regulatory["deficiencyFindings"]),
            "currentProvidersWithObservation": int(regulatory["deficiencyProvidersCurrent"]),
            "complaintObservations": int(regulatory["complaintDeficiencyFindings"]),
        },
        "enforcement": {
            "observations": int(regulatory["penaltyActions"]),
            "currentProvidersWithObservation": int(regulatory["penaltyProvidersCurrent"]),
            "fines": int(regulatory["penaltyFines"]),
            "paymentDenials": int(regulatory["penaltyPaymentDenials"]),
            "dateMin": str(regulatory["penaltyDateMin"]) if regulatory["penaltyDateMin"] else None,
            "dateMax": str(regulatory["penaltyDateMax"]) if regulatory["penaltyDateMax"] else None,
        },
    },
    "geography": geography,
    "sources": sources,
    "limitations": [
        "Nursing Home, Home Health, and Hospice are different CMS provider classes with different measures.",
        "Missing or suppressed evidence is not a zero quality score.",
        "CMS stars are CMS ratings, not SeniorTrustHub scores.",
        "Ownership evidence is not a quality inference. UNKNOWN is not a former owner. CHOW is not a sale.",
        "CMS ZIP coverage records are not a verified county service area.",
        "EVIDENCE_ONLY hospice identities are not current GI providers and are not proof of closure.",
        "Assisted Living and Memory Care are not CMS national provider classes.",
    ],
}

out = ROOT / "apps" / "web" / "src" / "data" / "senior-national-intelligence.json"
out.write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")
print(
    json.dumps(
        {
            "ok": True,
            "generationMs": elapsed_ms,
            "path": str(out),
            "nh": nh,
            "hh": hh,
            "hospice": hospice,
            "states": len(geography),
            "sources": len(sources),
            "fingerprint": fingerprint,
        },
        indent=2,
    )
)
