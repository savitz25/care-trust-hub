#!/usr/bin/env python3
"""OH-SEN-001 — freeze senior-oh-state-intel-v1."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts/oh-sen-001-public-snapshot.json"
TS = ROOT / "packages/domain/src/oh-public-snapshot.ts"
SUMMARY = json.loads((ROOT / "data/ohio/oh-sen-001/odh-onesource-summary.json").read_text(encoding="utf-8"))
NH_IDS = json.loads((ROOT / "data/ohio/oh-sen-001/odh-nh-license-ids.json").read_text(encoding="utf-8"))
RCF_IDS = json.loads((ROOT / "data/ohio/oh-sen-001/odh-rcf-license-ids.json").read_text(encoding="utf-8"))
NATIONAL = json.loads((ROOT / "apps/web/src/data/senior-national-intelligence.json").read_text(encoding="utf-8"))
GENERATION_KEYS = frozenset({"generatedAt", "fingerprint"})


def dumps(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def strip_generation(obj: object) -> object:
    if isinstance(obj, dict):
        return {k: strip_generation(v) for k, v in obj.items() if k not in GENERATION_KEYS}
    if isinstance(obj, list):
        return [strip_generation(v) for v in obj]
    return obj


def sha(obj: dict) -> str:
    return hashlib.sha256(dumps(strip_generation(obj)).encode("utf-8")).hexdigest()


def build(generated_at: str) -> dict:
    cms = next(row for row in NATIONAL["geography"] if row["state"] == "OH")
    nh_n = len(NH_IDS)
    rcf_n = len(RCF_IDS)
    return {
        "version": "senior-oh-state-intel-v1",
        "ticket": "OH-SEN-001",
        "publicationPath": "/ohio",
        "asOf": "2026-09-18",
        "snapshotAsOf": "2026-09-18",
        "retrievedAt": SUMMARY["retrievedAt"],
        "generatedAt": generated_at,
        "localWorkNeededNow": "NO",
        "claimEligibilityBroadened": False,
        "no_trust_score": True,
        "no_aggregate_rating": True,
        "no_rankings": True,
        "no_cleveland_page": True,
        "no_columbus_page": True,
        "clocks": {
            "generatedAt": generated_at,
            "snapshotAsOf": "2026-09-18",
            "retrievedAt": SUMMARY["retrievedAt"],
            "nh_onesource_sourceAsOf": SUMMARY["nh_sourceAsOf"],
            "rcf_onesource_sourceAsOf": SUMMARY["rcf_sourceAsOf"],
            "cms_sourceAsOf": NATIONAL.get("sourceAsOf") or NATIONAL.get("asOf") or "national-intelligence-overlay",
            "navigator_sourceAsOf": None,
            "odh_license_source_date_nh": SUMMARY["nh_sourceAsOf"],
            "odh_license_source_date_rcf": SUMMARY["rcf_sourceAsOf"],
            "inspection_date": None,
            "satisfaction_survey_period": None,
            "quality_measure_period": None,
            "home_health_license_date": None,
            "hospice_license_date": None,
            "pace_source_date": None,
            "retrievedAt_is_not_sourceAsOf": True,
        },
        "regulatorMap": {
            "odh": "Ohio Department of Health",
            "age": "Ohio Department of Aging",
            "navigator": "https://aging.ohio.gov/care-and-living/ohio-aging-compass/ohio-aging-compass-home",
            "odhExtract": "https://publicapps.odh.ohio.gov/eid/Default.aspx",
            "cmsCareCompare": "https://www.medicare.gov/care-compare/",
        },
        "nursingHomes": {
            "OH_NURSING_FACILITY_ROSTER_STATUS": "ACQUIRED_CURRENT_SNAPSHOT",
            "OH_NURSING_FACILITY_ROWS": nh_n,
            "OH_NURSING_FACILITY_DISTINCT_STATE_IDS": nh_n,
            "OH_NURSING_FACILITY_DISTINCT_CCNS": None,
            "source": "ODH OneSource ArcGIS Nursing Homes Licensed and Certified in Ohio",
            "sourceAsOf": SUMMARY["nh_sourceAsOf"],
            "licensePrefix": "OH",
            "all_active": True,
            "caveat": "ODH license is not a CMS CCN. 923 ODH rows vs 922 CMS Ohio nursing homes is not an identity bridge.",
        },
        "rcf": {
            "OH_RCF_ROSTER_STATUS": "ACQUIRED_CURRENT_SNAPSHOT",
            "OH_RCF_ROWS": rcf_n,
            "OH_RCF_DISTINCT_STATE_LICENSE_IDS": rcf_n,
            "OH_HOME_FOR_AGING_COMPONENT_ROWS": None,
            "consumerLanguage": "assisted living",
            "stateNativeClass": "Residential Care Facility",
            "source": "ODH OneSource ArcGIS Assisted Living / Residential Care Facilities in Ohio",
            "sourceAsOf": SUMMARY["rcf_sourceAsOf"],
            "licensePrefix": "OHL",
            "all_active": True,
            "caveat": "RCF is Ohio's formal assisted-living license class. It is not a Nursing Home and not a Medicaid waiver universe.",
        },
        "navigator": {
            "OH_NAVIGATOR_NURSING_ROWS": None,
            "OH_NAVIGATOR_RCF_ROWS": None,
            "coverage": "OPEN_SEARCH_ONLY",
            "reason": "The public Long-Term Care Quality Navigator is a dashboard (Aging Compass). aging.ohio.gov/Navigator currently 404s. Structured Navigator JSON/API was not acquired. Official ODH OneSource license layers are the freeze for facility identity.",
            "not_trusthub_rating": True,
            "quality_measure_ne_trusthub": True,
            "satisfaction_ne_aggregaterating": True,
        },
        "inspections": {
            "OH_NURSING_INSPECTION_ROWS": None,
            "OH_RCF_INSPECTION_ROWS": None,
            "OH_NURSING_DEFICIENCY_ROWS": None,
            "OH_RCF_VIOLATION_ROWS": None,
            "coverage": "OPEN_SEARCH_ONLY",
            "inspection_ne_complaint": True,
        },
        "complaints": {
            "OH_NURSING_HOME_COMPLAINT_ROWS": None,
            "OH_RCF_COMPLAINT_ROWS": None,
            "coverage": "INTAKE_AVAILABLE / BULK_NOT_PUBLIC",
        },
        "quality": {
            "OH_NURSING_QUALITY_MEASURE_OBSERVATIONS": None,
            "OH_RCF_SATISFACTION_OBSERVATIONS": None,
            "coverage": "OPEN_SEARCH_ONLY",
        },
        "homeHealth": {
            "OH_SKILLED_HOME_HEALTH_AGENCY_ROWS": None,
            "OH_NONMEDICAL_HOME_HEALTH_AGENCY_ROWS": None,
            "OH_SKILLED_NONAGENCY_PROVIDER_ROWS": None,
            "OH_NONMEDICAL_NONAGENCY_PROVIDER_ROWS": None,
            "OH_HOME_HEALTH_DISTINCT_STATE_LICENSE_IDS": None,
            "coverage": "OPEN_SEARCH_ONLY",
            "path": "ODH Health Care Provider Report and Information Extract (FACILITY LISTING) is interactive; statewide bulk extract was not frozen in this ticket.",
            "skilled_ne_nonmedical": True,
            "agency_ne_nonagency": True,
            "state_license_ne_cms": True,
        },
        "hospice": {
            "OH_HOSPICE_ROWS": None,
            "OH_HOSPICE_DISTINCT_STATE_LICENSE_IDS": None,
            "OH_HOSPICE_LOCATION_ROWS": None,
            "coverage": "OPEN_SEARCH_ONLY",
            "license_ne_location": True,
        },
        "cmsOverlay": {
            "nursingHomes": cms["nursingHomes"],
            "homeHealth": cms["homeHealth"],
            "hospice": cms["hospice"],
            "CMS_OH_NURSING_HOME_ROWS": cms["nursingHomes"],
            "CMS_OH_HOME_HEALTH_ROWS": cms["homeHealth"],
            "CMS_OH_HOSPICE_ROWS": cms["hospice"],
            "do_not_add_to_state": True,
            "addedToNationalTotals": False,
            "stateLicense_ne_cms": True,
        },
        "crosswalk": {
            "EXACT_OH_STATE_TO_CMS_NURSING_HOME_BRIDGES": 0,
            "EXACT_OH_STATE_TO_CMS_HOME_HEALTH_BRIDGES": 0,
            "EXACT_OH_STATE_TO_CMS_HOSPICE_BRIDGES": 0,
            "EXACT_OH_NAVIGATOR_TO_ODH_FACILITY_BRIDGES": 0,
            "OH_HOSPICE_DISTINCT_CCNS": None,
            "name_only": "UNSAFE",
            "reason": "OneSource license layers do not publish CCN. 923 vs 922 is not a bridge.",
        },
        "programs": {
            "OH_PACE_ROSTER_STATUS": "OPEN_SEARCH_ONLY",
            "OH_PACE_ORGANIZATION_ROWS": None,
            "OH_PACE_LOCATION_ROWS": None,
            "OH_ASSISTED_LIVING_WAIVER_PROVIDER_ROWS": None,
            "OH_ADULT_DAY_ROSTER_STATUS": "OPEN_SEARCH_ONLY",
            "OH_ADULT_DAY_ROWS": None,
            "waiver_ne_rcf_license": True,
            "pace_ne_facility_license": True,
        },
        "ownership": {
            "structured_owner_field_on_onesource": False,
            "ownership_ne_facility_identity": True,
        },
        "expansion_ledger": {
            "NET_NEW_STATE_RESEARCH_IDENTITIES": nh_n + rcf_n,
            "NET_NEW_CANONICAL_FACILITIES": 0,
            "NET_NEW_PUBLIC_PROFILES": 0,
            "EXISTING_FACILITIES_ENRICHED": 0,
            "GRAPH_WRITES": 0,
            "CLAIM_ELIGIBILITY_BROADENED": False,
        },
        "adverse_publication": {
            "ADVERSE_SOURCES_FOUND": 2,
            "ADVERSE_SOURCES_ACQUIRED": 0,
            "ADVERSE_ROWS_ACQUIRED": None,
            "UNIQUE_REGULATORY_MATTERS": None,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "REVIEW_REQUIRED": 0,
            "UNRESOLVED": None,
            "INTERNAL_ONLY": 0,
            "PUBLICATION_PENDING": 0,
            "PUBLIC_READY_PROFILES": 0,
            "PUBLICLY_RENDERED_PROFILES": 0,
            "BUSINESS_RESPONSE_READY": False,
            "SEARCH_SUPPORTED": True,
            "REMAINING_ADVERSE_GAPS": [
                "Navigator quality-measure grains",
                "Navigator consumer-satisfaction grains",
                "ODH nursing inspection events",
                "ODH RCF inspection events",
                "nursing deficiency / SOD bulk",
                "RCF violation bulk",
                "complaint bulk",
            ],
            "WITHHELD_REASON_COUNTS": {
                "OPEN_SEARCH_ONLY": 7,
                "INTAKE_AVAILABLE / BULK_NOT_PUBLIC": 1,
                "do_not_sum_inspection_complaint_deficiency_enforcement": True,
            },
        },
        "licenseIdentityNote": "Nursing Home licenses use OH#####. RCF licenses use OHL#####. Zero license-number overlap. Shared business names (48) are not identity bridges.",
        "fingerprint": "",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if args.check:
        existing = json.loads(ART.read_text(encoding="utf-8"))
        generated = existing["generatedAt"]
    body = build(generated)
    body["fingerprint"] = sha(body)
    if args.check:
        current = json.loads(ART.read_text(encoding="utf-8"))
        if current["fingerprint"] != body["fingerprint"]:
            raise SystemExit(f"fingerprint drift {current['fingerprint']} != {body['fingerprint']}")
        print("OH-SEN-001 snapshot check: PASS", body["fingerprint"])
        return
    ART.write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    TS.write_text(
        "/** Generated by scripts/build-oh-public-snapshot.py. Do not edit by hand. */\nexport const OH_PUBLIC_SNAPSHOT = "
        + json.dumps(body, indent=2)
        + " as const;\nexport type OhPublicSnapshot = typeof OH_PUBLIC_SNAPSHOT;\n",
        encoding="utf-8",
    )
    print(json.dumps({"fingerprint": body["fingerprint"], "nh": body["nursingHomes"]["OH_NURSING_FACILITY_ROWS"], "rcf": body["rcf"]["OH_RCF_ROWS"]}, indent=2))


if __name__ == "__main__":
    main()
