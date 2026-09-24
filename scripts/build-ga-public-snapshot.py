#!/usr/bin/env python3
"""GA-SEN-001 — freeze the Georgia public snapshot from the accepted CMS spine.

Does not download CMS. Does not read GaMap2Care as a roster. State license counts stay null.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts/ga-sen-001-public-snapshot.json"
TS = ROOT / "packages/domain/src/ga-public-snapshot.ts"
NATIONAL = json.loads(
    (ROOT / "apps/web/src/data/senior-national-intelligence.json").read_text(encoding="utf-8")
)
GENERATION_KEYS = frozenset({"generatedAt", "fingerprint"})
RETRIEVED_AT = "2026-09-23T20:30:00Z"
GENERATED_AT = "2026-09-23T20:30:00Z"
SNAPSHOT_AS_OF = "2026-09-23"


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


def clock(sources: dict, key: str) -> dict:
    row = sources[key]
    return {
        "datasetKey": row["datasetKey"],
        "officialUrl": row["officialUrl"],
        "sourceModifiedAt": row["sourceModifiedAt"],
        "retrievedAt": row["retrievedAt"],
        "sourcePeriod": row["sourcePeriod"],
    }


def build() -> dict:
    cms = next(row for row in NATIONAL["geography"] if row["state"] == "GA")
    sources = {row["datasetKey"]: row for row in NATIONAL["sources"]}
    if cms["nursingHomes"] != 356 or cms["homeHealth"] != 105 or cms["hospice"] != 261:
        raise SystemExit(f"Georgia CMS partition drifted: {cms}")
    return {
        "version": "senior-ga-state-intel-v1",
        "ticket": "GA-SEN-001",
        "publicationPath": "/georgia",
        "asOf": SNAPSHOT_AS_OF,
        "snapshotAsOf": SNAPSHOT_AS_OF,
        "retrievedAt": RETRIEVED_AT,
        "generatedAt": GENERATED_AT,
        "localWorkNeededNow": "NO",
        "claimEligibilityBroadened": False,
        "no_trust_score": True,
        "no_aggregate_rating": True,
        "no_rankings": True,
        "no_atlanta_page": True,
        "clocks": {
            "generatedAt": GENERATED_AT,
            "snapshotAsOf": SNAPSHOT_AS_OF,
            "retrievedAt": RETRIEVED_AT,
            "cms_nursing_home_sourceAsOf": sources["nursing-home-provider-information"]["sourceModifiedAt"],
            "cms_home_health_sourceAsOf": sources["home-health-care-agencies"]["sourceModifiedAt"],
            "cms_hospice_sourceAsOf": sources["hospice-general-information"]["sourceModifiedAt"],
            "georgia_license_effective_date": None,
            "georgia_license_expiration_date": None,
            "hfrd_inspection_date": None,
            "hfrd_report_date": None,
            "retrievedAt_is_not_inspection_date": True,
            "cms_date_is_not_georgia_license_date": True,
        },
        "regulatorMap": {
            "agency": "Georgia Department of Community Health",
            "division": "Healthcare Facility Regulation Division (HFRD)",
            "officialHub": "https://dch.georgia.gov/divisionsoffices/hfrd/about-hfrd",
            "finderHub": "https://forms.dch.georgia.gov/HFRD/",
            "gaMap2Care": "https://dch.georgia.gov/gamap2carer-find-facility",
            "gaMap2CareApp": "https://forms.dch.georgia.gov/HFRD/GaMap2Care.html",
            "inspectionSearch": "https://weblink.dch.georgia.gov/WebLink/CustomSearch.aspx?SearchName=InspectionReportSearch&repo=WEB",
            "personalCareHomes": "https://dch.georgia.gov/divisionsoffices/hfrd/facilities-provider-information/personal-care-homes",
            "privateHomeCare": "https://dch.georgia.gov/divisionsoffices/hfrd/facilities-provider-information/private-home-care-program",
            "longTermCare": "https://dch.georgia.gov/divisionsoffices/hfrd/facilities-provider-information/ltc",
            "complaintIntake": "https://dch.georgia.gov/hfrd-file-complaint",
            "cmsCareCompare": "https://www.medicare.gov/care-compare/",
        },
        "cmsOverlay": {
            "nursingHomes": cms["nursingHomes"],
            "homeHealth": cms["homeHealth"],
            "hospice": cms["hospice"],
            "source": "senior-national-intelligence.json geography GA (CMS class directories)",
            "asOf": "2026-08-27",
            "nationalFingerprint": NATIONAL["sourceFingerprint"],
            "addedToNationalTotals": False,
            "censusConfirmation": {
                "artifact": "artifacts/senior-metric-census-r2-03.json",
                "retrievedAt": "2026-09-12T22:30:09.580804+00:00",
                "sourceAsOf": None,
                "nursingHomes": 356,
                "homeHealth": 105,
                "hospice": 261,
            },
            "clocks": {
                "nursingHomes": clock(sources, "nursing-home-provider-information"),
                "homeHealth": clock(sources, "home-health-care-agencies"),
                "hospice": clock(sources, "hospice-general-information"),
                "inspections": clock(sources, "nursing-home-inspection-dates"),
                "ownership": clock(sources, "skilled-nursing-facility-all-owners"),
                "penalties": clock(sources, "nursing-home-penalties"),
            },
        },
        "programContext": {
            "statement": "The Personal Care Home Program team provides oversight to a total of 2,910 facilities that consists of Personal Care Homes, Assisted Living Communities, Community Living Arrangements, and Adult Day Care/Adult Day Health Centers that serve approximately 55,000 residents.",
            "sourceUrl": "https://dch.georgia.gov/divisionsoffices/hfrd/facilities-provider-information/personal-care-homes",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
            "value": None,
            "usedAsTrustHubCount": False,
            "capability": "UNKNOWN",
        },
        "ltcStatement": {
            "statement": "The State of Georgia has 357 Long Term Care Facilities that includes both Nursing Homes and Skilled Nursing Homes that serve over 40,000 residents.",
            "sourceUrl": "https://dch.georgia.gov/divisionsoffices/hfrd/facilities-provider-information/ltc",
            "pageListedAt": "2022-08-08",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
            "value": None,
            "usedAsTrustHubCount": False,
            "capability": "UNKNOWN",
            "notCmsNursingHomeCount": True,
        },
        "hfrdWideStatement": {
            "statement": "HFRD describes regulatory oversight of more than 30,000 healthcare facilities, provider types, and services, including hospitals, laboratories, and end-stage renal disease facilities.",
            "sourceUrl": "https://dch.georgia.gov/divisionsoffices/hfrd/about-hfrd",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
            "value": None,
            "usedAsTrustHubCount": False,
            "capability": "UNKNOWN",
        },
        "personalCareHomes": {
            "rows": None,
            "regulation": "Chapter 111-8-62",
            "regulator": "Georgia DCH HFRD",
            "jurisdiction": "state",
            "capability": "NOT_ACQUIRED",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
            "distinctFromAssistedLivingCommunity": True,
        },
        "assistedLivingCommunities": {
            "rows": None,
            "regulation": "Chapter 111-8-63",
            "regulator": "Georgia DCH HFRD",
            "jurisdiction": "state",
            "minimumResidents": 25,
            "capability": "NOT_ACQUIRED",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
            "distinctFromPersonalCareHome": True,
            "distinctFromCmsNursingHome": True,
        },
        "communityLivingArrangements": {
            "rows": None,
            "regulation": "Chapter 290-9-37",
            "regulator": "Georgia DCH HFRD; residential services financially supported by DBHDD",
            "jurisdiction": "state",
            "capability": "NOT_ACQUIRED",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
        },
        "adultDay": {
            "rows": None,
            "regulation": "Chapter 111-8-1",
            "regulator": "Georgia DCH HFRD",
            "jurisdiction": "state",
            "capability": "NOT_ACQUIRED",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
            "adultDayCareDistinctFromAdultDayHealth": True,
        },
        "privateHomeCare": {
            "rows": None,
            "regulation": "Chapter 111-8-65",
            "regulator": "Georgia DCH HFRD",
            "jurisdiction": "state",
            "capability": "NOT_ACQUIRED",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
            "distinctFromCmsHomeHealth": True,
        },
        "stateNursingHomeLicenses": {
            "rows": None,
            "regulation": "Chapter 111-8-56",
            "regulator": "Georgia DCH HFRD",
            "jurisdiction": "state",
            "capability": "NOT_ACQUIRED",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
            "distinctFromCmsNursingHome": True,
        },
        "stateHomeHealthLicenses": {
            "rows": None,
            "regulator": "Georgia DCH HFRD",
            "jurisdiction": "state",
            "capability": "NOT_ACQUIRED",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
            "distinctFromCmsHomeHealth": True,
        },
        "stateHospiceLicenses": {
            "rows": None,
            "regulator": "Georgia DCH HFRD",
            "jurisdiction": "state",
            "capability": "NOT_ACQUIRED",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
            "distinctFromCmsHospice": True,
        },
        "gaMap2Care": {
            "rows": None,
            "access": "Interactive finder. The public HTML table is client-populated. No public CSV, JSON, or ArcGIS FeatureServer was confirmed.",
            "capability": "NOT_ACQUIRED",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
            "blocksClosure": False,
        },
        "inspections": {
            "indexedReports": None,
            "parsedPdfCount": 0,
            "capability": "NOT_ACQUIRED",
            "sourceAsOf": None,
            "inspectionDate": None,
            "reportDate": None,
            "retrievedAt": RETRIEVED_AT,
            "searchUrl": "https://weblink.dch.georgia.gov/WebLink/CustomSearch.aspx?SearchName=InspectionReportSearch&repo=WEB",
            "parsedPdfCountIsNotZeroInspections": True,
        },
        "complaints": {
            "providerLevelRows": None,
            "capability": "REQUEST_ONLY",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
            "intakeUrl": "https://dch.georgia.gov/hfrd-file-complaint",
            "doNotInferFromInspections": True,
        },
        "enforcement": {
            "rows": None,
            "capability": "NOT_ACQUIRED",
            "sourceAsOf": None,
            "retrievedAt": RETRIEVED_AT,
        },
        "crosswalk": {
            "exactStateToCmsBridges": None,
            "attempted": False,
            "nameOnly": "UNSAFE",
            "capability": "UNKNOWN",
            "reason": "No Georgia license identifiers were acquired, so no CMS join was attempted. Null is not zero matches and not zero state-only facilities.",
        },
        "expansionLedger": {
            "NET_NEW_STATE_RESEARCH_IDENTITIES": 0,
            "NET_NEW_CANONICAL_FACILITIES": 0,
            "NET_NEW_PUBLIC_PROFILES": 0,
            "EXISTING_FACILITIES_ENRICHED": 0,
            "GRAPH_WRITES": 0,
            "CLAIM_ELIGIBILITY_BROADENED": False,
        },
        "capabilities": [
            {"id": "cms-nursing-home-ga", "state": "KNOWN"},
            {"id": "cms-home-health-ga", "state": "KNOWN"},
            {"id": "cms-hospice-ga", "state": "KNOWN"},
            {"id": "cms-nursing-home-inspection-on-ccn", "state": "KNOWN"},
            {"id": "cms-nursing-home-ownership-on-ccn", "state": "KNOWN"},
            {"id": "cms-nursing-home-penalty-on-ccn", "state": "KNOWN"},
            {"id": "dch-personal-care-home-roster", "state": "NOT_ACQUIRED"},
            {"id": "dch-assisted-living-community-roster", "state": "NOT_ACQUIRED"},
            {"id": "dbhdd-community-living-arrangement-roster", "state": "NOT_ACQUIRED"},
            {"id": "dch-adult-day-roster", "state": "NOT_ACQUIRED"},
            {"id": "dch-private-home-care-roster", "state": "NOT_ACQUIRED"},
            {"id": "dch-state-nursing-home-license-roster", "state": "NOT_ACQUIRED"},
            {"id": "dch-state-home-health-license-roster", "state": "NOT_ACQUIRED"},
            {"id": "dch-state-hospice-license-roster", "state": "NOT_ACQUIRED"},
            {"id": "gamap2care-bulk", "state": "NOT_ACQUIRED"},
            {"id": "hfrd-inspection-index", "state": "NOT_ACQUIRED"},
            {"id": "hfrd-enforcement", "state": "NOT_ACQUIRED"},
            {"id": "hfrd-provider-complaints", "state": "REQUEST_ONLY"},
            {"id": "exact-state-to-cms-join", "state": "UNKNOWN"},
            {"id": "pch-program-2910-statement", "state": "UNKNOWN"},
            {"id": "ltc-357-statement", "state": "UNKNOWN"},
            {"id": "atlanta-license-system", "state": "UNSUPPORTED"},
            {"id": "combined-georgia-senior-facilities", "state": "UNSUPPORTED"},
        ],
        "fingerprint": "",
    }


def main() -> None:
    body = build()
    body["fingerprint"] = sha(body)
    ART.write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    TS.write_text(
        "/** Generated by scripts/build-ga-public-snapshot.py. Do not edit by hand. */\n"
        "export const GA_PUBLIC_SNAPSHOT = "
        + json.dumps(body, indent=2)
        + " as const;\nexport type GaPublicSnapshot = typeof GA_PUBLIC_SNAPSHOT;\n",
        encoding="utf-8",
    )
    print(json.dumps({"fingerprint": body["fingerprint"], "cms": body["cmsOverlay"]}, indent=2))


if __name__ == "__main__":
    main()
