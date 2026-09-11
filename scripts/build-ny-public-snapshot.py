#!/usr/bin/env python3
"""NY-SEN-001 — public snapshot. Does not sum provider classes. Does not mint profiles."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
DOMAIN = ROOT / "packages" / "domain" / "src"
NATIONAL = ROOT / "apps" / "web" / "src" / "data" / "senior-national-intelligence.json"
CENSUS = ROOT / "data" / "new-york" / "ny-sen-001" / "ny-sen-census.json"

TICKET = "NY-SEN-001"
VERSION = "senior-ny-state-intel-v1"
RETRIEVED = "2026-09-11T16:00:00Z"


def sha256_obj(obj: object) -> str:
    blob = json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(blob).hexdigest()


def clock(sources: list[dict], key: str) -> dict:
    row = next((item for item in sources if item.get("datasetKey") == key), {})
    return {
        "datasetKey": key,
        "officialUrl": row.get("officialUrl"),
        "sourceModifiedAt": row.get("sourceModifiedAt"),
        "retrievedAt": row.get("retrievedAt"),
        "sourcePeriod": row.get("sourcePeriod"),
    }


def main() -> int:
    national = json.loads(NATIONAL.read_text(encoding="utf-8"))
    census = json.loads(CENSUS.read_text(encoding="utf-8"))
    geo = next((row for row in national.get("geography") or [] if row.get("state") == "NY"), None)
    if not geo:
        raise SystemExit("New York geography partition missing")
    nh_cms = int(geo["nursingHomes"])
    hha_cms = int(geo["homeHealth"])
    hospice_cms = int(geo["hospice"])
    sources = national.get("sources") or []
    nh = census["nursingHomeProfile"]
    acf = census["acf"]
    al = census["assistedLivingDesignations"]
    hc = census["homeCare"]
    dnr = census["doNotRefer"]

    if nh["sourceRows"] != 597:
        raise SystemExit("NH facility count drifted")
    if acf["giAcfFacilities"] != 527:
        raise SystemExit("ACF facility count drifted")

    snapshot = {
        "version": VERSION,
        "ticket": TICKET,
        "asOf": None,
        "retrievedAt": RETRIEVED,
        "snapshotAsOf": "2026-09-11",
        "generatedAt": RETRIEVED,
        "regulatorMap": {
            "agency": "New York State Department of Health",
            "nursingHomeProfile": "https://health.data.ny.gov/Health/Nursing-Home-Profile/dypu-nabu",
            "nursingHomeProfilesSite": "https://profiles.health.ny.gov/nursing_home/",
            "certification": "https://health.data.ny.gov/Health/Health-Facility-Certification-Information/2g9y-7kqm",
            "generalInformation": "https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r",
            "doNotRefer": "https://www.health.ny.gov/facilities/adult_care/docs/acf_do_not_refer_list.pdf",
            "acfHome": "https://www.health.ny.gov/facilities/adult_care/",
            "healthProfilesAcf": "https://profiles.health.ny.gov/acf/",
            "cmsCareCompare": "https://www.medicare.gov/care-compare/",
        },
        "uiGrains": {
            "acfFacilities": "VISIBLE_PUBLIC_METRIC",
            "nursingHomeFacilities": "VISIBLE_PUBLIC_METRIC",
            "nursingHomeSurveys": "VISIBLE_PUBLIC_METRIC",
            "doNotReferObservations": "VISIBLE_PUBLIC_METRIC",
            "cmsHomeHealth": "VISIBLE_PUBLIC_METRIC",
            "cmsHospice": "VISIBLE_PUBLIC_METRIC",
            "nursingHomeCitations": "VISIBLE_SUPPORTING_CONTEXT",
            "nursingHomeEnforcement": "VISIBLE_SUPPORTING_CONTEXT",
            "nursingHomeComplaintSummary": "VISIBLE_SUPPORTING_CONTEXT",
            "assistedLivingDesignations": "VISIBLE_SUPPORTING_CONTEXT",
            "lhcsa": "VISIBLE_SUPPORTING_CONTEXT",
            "chhaState": "VISIBLE_SUPPORTING_CONTEXT",
            "adultDay": "VISIBLE_SUPPORTING_CONTEXT",
            "exactCcnBridge": "VISIBLE_SUPPORTING_CONTEXT",
            "operatorMembers": "INTERNAL_DIAGNOSTIC_ONLY",
        },
        "nursingHomeProfile": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "source": "NYSDOH Nursing Home Profile zip (Health Data NY dypu-nabu)",
            "officialUrl": "https://health.data.ny.gov/Health/Nursing-Home-Profile/dypu-nabu",
            "sourceAsOf": "2026-08-19",
            "retrievedAt": RETRIEVED,
            "grain": nh["grain"],
            "sourceRows": 597,
            "distinctFacilityIds": 597,
            "duplicateFacilityIds": 0,
            "rowsWithCcn": 595,
            "rowsWithoutCcn": 2,
            "distinctCcn": 594,
            "duplicateCcnValues": 1,
            "surveyRows": 6036,
            "surveyFacilityCoverage": 597,
            "surveyDateMin": "2024-01-02",
            "surveyDateMax": "2025-12-31",
            "surveyTypes": dict(nh["surveyTypes"]),
            "citationRows": 19032,
            "citationRowsIsComplaint1": 4244,
            "enforcementRows": 2036,
            "enforcementFacilityCoverage": 583,
            "inspectionIsNotDeficiencyCount": True,
            "complaintSurveyIsNotSubstantiatedComplaint": True,
            "isComplaintFlagIsNotComplaintCount": True,
            "fineIsNotCriminalConviction": True,
            "enforcementRowIsNotUniqueFacility": True,
            "occupancyIsNotCapacityHeadline": True,
            "notCombinedWithAcf": True,
        },
        "acf": {
            "coverage": "PARTIAL_SOURCE_COVERAGE",
            "source": "Health Facility General Information joined conceptually with Certification Information on Facility ID",
            "sourceAsOf": "2026-09-01",
            "retrievedAt": RETRIEVED,
            "adultHomeFacilities": 381,
            "enrichedHousingFacilities": 146,
            "acfFacilities": 527,
            "distinctOperatingCertificates": 527,
            "ahBedCertificationRows": 1146,
            "ehpBedCertificationRows": 466,
            "ahEhpOverlapFacilityIds": 0,
            "currentness": "PARTIAL — GI prints opening date and operating certificate; source does not print ACTIVE/EXPIRED. Not guessed as ACTIVE.",
            "capacityNote": "Certification Bed rows are program-specific certified-bed observations, not occupancy and not a unique-facility bed total.",
            "adultHomeIsNotEnrichedHousing": True,
            "notNursingHome": True,
            "credentialRowIsNotFacility": True,
            "capacityIsNotOccupancy": True,
        },
        "assistedLivingDesignations": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "alrFacilities": 271,
            "ealrFacilities": 220,
            "snalrFacilities": 203,
            "alpResidentialFacilities": 162,
            "alpLhCsaSpecialtyFacilities": 155,
            "alpIsNotAlr": True,
            "alrIsNotEalr": True,
            "alrIsNotSnalr": True,
            "doNotSumAsAssistedLivingFacilities": True,
            "note": "These are source-native bed/program designations hosted at Adult Homes or Enriched Housing (except LHCSA specialty ALP). One site may carry multiple designations.",
        },
        "doNotRefer": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "source": "NYSDOH Adult Care Facility Do Not Refer List PDF",
            "officialUrl": "https://www.health.ny.gov/facilities/adult_care/docs/acf_do_not_refer_list.pdf",
            "sourceAsOf": "2026-09-10",
            "retrievedAt": RETRIEVED,
            "observationCount": 117,
            "exactOpcertMatchesToCurrentGiAcf": 6,
            "nameOnlyRemainder": 111,
            "exactProfileAttachments": 0,
            "nameOnlyJoins": "UNSAFE",
            "namePlusCity": "REVIEW_REQUIRED",
            "notCriminalConviction": True,
            "notPermanentClosureUnlessSourceSaysClosed": True,
            "notEveryEnforcementAction": True,
            "notTrustHubBlacklist": True,
            "noScore": True,
        },
        "homeCare": {
            "chhaDistinctFacilityIds": 97,
            "lhcsaDistinctFacilityIds": 1258,
            "lthhcpDistinctFacilityIds": 30,
            "chhaCertificationRows": 1388,
            "lhcsaCertificationRows": 15279,
            "lhcsaIsNotCmsHha": True,
            "chhaIsNotLhcsa": True,
            "stateLicenseIsNotCmsCcn": True,
            "rowIsNotFacility": True,
        },
        "adultDay": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "adhcpDistinctFacilityIds": 34,
            "notAlf": True,
            "notNursingHome": True,
        },
        "acfInspections": {
            "coverage": "PUBLIC_RESEARCH_PATH",
            "reason": "Health Profiles per-facility ACF inspections. No cheap bulk/API harvested in this ticket.",
        },
        "alrQualityTable": {
            "coverage": "SOURCE_NOT_ACQUIRED",
            "reason": "No deterministic statewide ALR quality bulk table found in this pass.",
        },
        "cmsOverlay": {
            "nursingHomes": nh_cms,
            "homeHealth": hha_cms,
            "hospice": hospice_cms,
            "source": "senior-national-intelligence.json geography NY (CMS class directories)",
            "asOf": "2026-08-27",
            "nationalFingerprint": national["sourceFingerprint"],
            "addedToNationalTotals": False,
            "clocks": {
                "nursingHomes": clock(sources, "nursing-home-provider-information"),
                "homeHealth": clock(sources, "home-health-care-agencies"),
                "hospice": clock(sources, "hospice-general-information"),
            },
            "stateNhCountIsNotCmsNhCount": True,
            "stateHospiceDistinctFacilities": 39,
            "stateHospiceExactCmsJoinAttempted": False,
        },
        "crosswalk": {
            "nyNhToCms": {
                "method": "source-native MEDICARE_NUMBER on Nursing Home Profile Facility_Info",
                "rowsWithCcn": 595,
                "rowsWithoutCcn": 2,
                "distinctCcn": 594,
                "duplicateCcnValues": 1,
                "exact": 594,
            },
            "acfToCmsNh": {"attempted": False, "exact": 0, "reviewRequired": 0, "rejectedUnsafe": 0},
            "dnrToGiAcfExactOpcert": 6,
            "nameOnlyJoins": "UNSAFE",
        },
        "publication": {
            "claimableAcfProfiles": False,
            "publicAcfProfileRoutes": False,
            "stateResearchIdentityIsNotPublicProfile": True,
            "noAutomaticNameCmsMatch": True,
            "operatorIsNotFacility": True,
            "operatorMemberIsNotFacility": True,
        },
        "expansionLedger": {
            "NY_NURSING_HOME_SOURCE_ROWS": 597,
            "NY_NURSING_HOME_STATE_IDENTITIES": 597,
            "NY_NURSING_HOME_DISTINCT_CCN": 594,
            "NY_NURSING_HOME_INSPECTION_OBSERVATIONS": 6036,
            "NY_NURSING_HOME_COMPLAINT_SUMMARY_ROWS": None,
            "NY_NURSING_HOME_ENFORCEMENT_FINE_ROWS": 2036,
            "NY_ACF_STATE_IDENTITIES": 527,
            "NY_ACF_OPERATING_CERTIFICATES": 527,
            "NY_ACF_LICENSE_OR_CERTIFICATION_ROWS": 1612,
            "NY_ACF_CERTIFIED_CAPACITY": None,
            "NY_DO_NOT_REFER_OBSERVATIONS": 117,
            "NY_ALR_QUALITY_ROWS": None,
            "NY_STATE_HOME_CARE_ROWS": None,
            "EXACT_NY_NH_TO_CMS_CROSSWALKS": 594,
            "REJECTED_UNSAFE_CROSSWALKS": 0,
            "REVIEW_REQUIRED_CROSSWALKS": 0,
            "NET_NEW_CANONICAL_FACILITIES": 0,
            "NET_NEW_PUBLIC_PROFILES": 0,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "GRAPH_WRITES": 0,
            "notes": {
                "complaintSummary": "Facility_Info COMP_* fields are source-native complaint-summary columns, not a separate complaint-row census. Citation IS_COMPLAINT=1 is 4,244 citation rows, not complaint filings.",
                "acfCapacity": "Program-specific Bed measure_value rows exist; they are not a unique-facility occupancy or a single certified-capacity total.",
                "homeCare": "LHCSA/CHHA/LTHHCP are certification-row classes. Distinct Facility IDs are reported separately and are not CMS HHA.",
            },
        },
        "juiceSqueeze": [
            {"source": "NYSDOH Nursing Home Profile zip", "decision": "GRABBED — HIGH YIELD", "note": "597 facilities, surveys, citations, enforcements, source-native CCN."},
            {"source": "Health Facility General Information + Certification Information", "decision": "GRABBED — HIGH YIELD", "note": "527 ACF Facility IDs with operating certificates; AH/EHP/AL designations kept separate."},
            {"source": "Do Not Refer List PDF", "decision": "GRABBED — HIGH YIELD", "note": "117 observations; 6 exact current OPCERT matches; name-only not attached."},
            {"source": "Existing CMS NY overlays", "decision": "GRABBED — HIGH YIELD", "note": "593 NH / 100 HHA / 39 Hospice. Not added to national totals."},
            {"source": "LHCSA / CHHA / ADHCP certification distinct Facility IDs", "decision": "GRABBED — EASY SECONDARY", "note": "State home-care and adult-day classes. LHCSA != CMS HHA."},
            {"source": "ALR quality table", "decision": "LEFT — SEARCH ONLY", "note": "No deterministic bulk table in this pass."},
            {"source": "Per-facility ACF Health Profiles inspections", "decision": "LEFT — TOO MUCH WORK FOR CURRENT YIELD", "note": "PUBLIC_RESEARCH_PATH."},
            {"source": "Survey/citation PDFs and operator archaeology", "decision": "LEFT — TOO MUCH WORK FOR CURRENT YIELD", "note": "Bulk CSVs were enough."},
            {"source": "FOIL", "decision": "LEFT — REQUEST ONLY", "note": "Not requested."},
            {"source": "NYC / counties / boroughs", "decision": "LEFT — LOCAL / FUTURE", "note": "Statewide only."},
        ],
        "claimEligibility": {"broadened": False},
        "noCombinedDenominator": True,
        "noTrustScore": True,
        "noRanking": True,
        "noAggregateRating": True,
        "publicationPath": "/new-york",
        "noCountyRoutes": True,
        "noCityRoutes": True,
        "statewideOnly": True,
        "unknownIsNotZero": True,
        "missingIsNotZero": True,
        "searchOnlyIsNotZero": True,
    }
    snapshot["fingerprint"] = sha256_obj({k: v for k, v in snapshot.items() if k != "fingerprint"})
    ART.mkdir(parents=True, exist_ok=True)
    (ART / "ny-sen-001-public-snapshot.json").write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    (DOMAIN / "ny-public-snapshot.ts").write_text(
        "/** Generated from artifacts/ny-sen-001-public-snapshot.json. Do not edit by hand. */\n"
        "export const NY_PUBLIC_SNAPSHOT = "
        + json.dumps(snapshot, indent=2)
        + " as const;\n",
        encoding="utf-8",
    )
    print(json.dumps({"fingerprint": snapshot["fingerprint"], "acf": 527, "nh": 597, "cmsNh": nh_cms}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
