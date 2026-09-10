#!/usr/bin/env python3
"""VA-SEN-001 — public snapshot from acquired DSS ALF/ADC JSON + accepted CMS VA overlays.

Does not invent a statewide sourceAsOf. Retrieval is not source date.
Does not sum ALF + ADC + CMS classes. Does not emit claimable profiles.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
DOMAIN = ROOT / "packages" / "domain" / "src"
NATIONAL = ROOT / "apps" / "web" / "src" / "data" / "senior-national-intelligence.json"
RAW = ART / "va-sen-001-dss-raw.json"

TICKET = "VA-SEN-001"
VERSION = "senior-va-state-intel-v1"


def sha256_obj(obj: object) -> str:
    blob = json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(blob).hexdigest()


def json_to_ts(obj: object) -> str:
    return (
        "/** Generated from artifacts/va-sen-001-public-snapshot.json. Do not edit by hand. */\n"
        "export const VA_PUBLIC_SNAPSHOT = "
        + json.dumps(obj, indent=2)
        + " as const;\n"
    )


def clock(sources: list[dict], key: str) -> dict:
    row = next((item for item in sources if item.get("datasetKey") == key), {})
    return {
        "datasetKey": key,
        "officialUrl": row.get("officialUrl"),
        "sourceModifiedAt": row.get("sourceModifiedAt"),
        "retrievedAt": row.get("retrievedAt"),
        "sourcePeriod": row.get("sourcePeriod"),
    }


def qualify(text: str | None) -> str:
    if not text:
        return "UNKNOWN"
    return text.strip()


def main() -> int:
    national = json.loads(NATIONAL.read_text(encoding="utf-8"))
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    geo = next((row for row in national.get("geography") or [] if row.get("state") == "VA"), None)
    if not geo:
        raise SystemExit("Virginia geography partition missing from senior-national-intelligence.json")
    nh = int(geo["nursingHomes"])
    hha = int(geo["homeHealth"])
    hospice = int(geo["hospice"])
    sources = national.get("sources") or []

    details = raw["alf"]["details"]
    if len(details) != 573:
        raise SystemExit(f"expected 573 ALF details, got {len(details)}")

    license_types: Counter[str] = Counter()
    quals: Counter[str] = Counter()
    capacities: list[int] = []
    inspections = 0
    facilities_with_inspections = 0
    violation_y = 0
    violation_n = 0
    complaint_related = 0
    expiration_present = 0
    identity_ns = []
    facility_ids = []
    for lid, row in details.items():
        identity_ns.append(f"VA-DSS-ALF:{lid}")
        lic = row.get("facilityLicense") or {}
        fid = lic.get("licenseFacilityId")
        if fid:
            facility_ids.append(str(fid))
        license_types[str(lic.get("licenseType") or "UNKNOWN")] += 1
        if lic.get("expirationDate"):
            expiration_present += 1
        cap = lic.get("capacity")
        if cap is None:
            raise SystemExit(f"missing capacity for {lid}")
        capacities.append(int(cap))
        for item in lic.get("qualificationList") or []:
            quals[qualify(item.get("qualificationHoverText") or item.get("qualificationDispText"))] += 1
        obs_list = row.get("inspectionsList") or []
        if obs_list:
            facilities_with_inspections += 1
        inspections += len(obs_list)
        for obs in obs_list:
            if obs.get("violations") == "Y":
                violation_y += 1
            elif obs.get("violations") == "N":
                violation_n += 1
            cn = obs.get("complaintNumber")
            if cn not in (0, "0", None, ""):
                complaint_related += 1

    if len(set(identity_ns)) != 573:
        raise SystemExit("ALF licenseId identity is not unique")
    if len(set(facility_ids)) != 573:
        raise SystemExit("licenseFacilityId is not unique")

    adc_details = raw["adc"]["details"]
    adc_inspections = sum(len((row or {}).get("inspectionsList") or []) for row in adc_details.values())

    snapshot = {
        "version": VERSION,
        "ticket": TICKET,
        "asOf": None,
        "sourceAsOf": None,
        "sourceAsOfState": "UNKNOWN",
        "retrievedAt": raw["retrievedAt"],
        "snapshotAsOf": raw["retrievedAt"][:10],
        "generatedAt": raw["retrievedAt"],
        "regulatorMap": {
            "alfAgency": "Virginia Department of Social Services",
            "alfDivision": "Division of Licensing Programs (DOLP)",
            "alfSearch": "https://www.dss.virginia.gov/licensed-care/search-licensing-programs/assisted-living-facility-search/",
            "alfHub": "https://www.dss.virginia.gov/licensed-care/assisted-living-facilities-alf/",
            "adcSearch": "https://www.dss.virginia.gov/licensed-care/search-licensing-programs/adult-day-center-search/",
            "complaint": "https://www.dss.virginia.gov/licensed-care/submit-a-complaint/",
            "vdhOlc": "https://www.vdh.virginia.gov/licensure-and-certification/",
            "vdhNursingHomePortal": "https://www.vdh.virginia.gov/licensure-and-certification/",
            "vdhLtcSurveys": "https://www.vdh.virginia.gov/licensure-and-certification/division-of-long-term-care-services/ltc-inspections-surveys/",
            "cmsCareCompare": "https://www.medicare.gov/care-compare/",
        },
        "identity": {
            "namespace": "VA-DSS-ALF:{licenseId}",
            "verified": True,
            "routingField": "licenseId",
            "additionalSourceField": "licenseFacilityId",
            "nameIsNotIdentity": True,
            "nameOnlyJoins": "UNSAFE",
        },
        "dssAlf": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "accessMethod": "Official DSS Terminalfour search JSON via list pagination + licenseId detail",
            "completeness": "LIST_TOTAL_EQUALS_DETAIL_COUNT",
            "licensedFacilityCount": 573,
            "uniqueLicenseIds": 573,
            "uniqueLicenseFacilityIds": 573,
            "licensedCapacitySum": int(sum(capacities)),
            "capacityGrain": "licensed_capacity_not_occupancy",
            "capacityMissing": 0,
            "licenseTypes": dict(license_types),
            "licenseTypeIsNotQuality": True,
            "expirationDatesPresent": expiration_present,
            "qualifications": dict(quals),
            "qualificationsAreNotRatings": True,
            "officialSearch": "https://www.dss.virginia.gov/licensed-care/search-licensing-programs/assisted-living-facility-search/",
            "notNursingHome": True,
            "notCmsCcn": True,
        },
        "dssAlfInspections": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "observationCount": inspections,
            "facilitiesWithAtLeastOneObservation": facilities_with_inspections,
            "facilitiesWithZeroReturnedObservations": 573 - facilities_with_inspections,
            "violationFlagYes": violation_y,
            "violationFlagNo": violation_n,
            "complaintRelatedObservations": complaint_related,
            "complaintRelatedMeans": "inspection.complaintNumber != 0 in the DSS JSON",
            "complaintRelatedIsNotSubstantiatedComplaint": True,
            "violationFlagIsNotViolationCount": True,
            "inspectionIsNotDisciplinaryAction": True,
            "noViolationShownIsNotPerfect": True,
            "didNotChaseViolationPdfs": True,
        },
        "dssAdc": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "licensedFacilityCount": 82,
            "inspectionObservations": adc_inspections,
            "notAlf": True,
            "notNursingHome": True,
            "sameAdapterAsAlf": True,
            "officialSearch": "https://www.dss.virginia.gov/licensed-care/search-licensing-programs/adult-day-center-search/",
        },
        "cmsOverlay": {
            "nursingHomes": nh,
            "homeHealth": hha,
            "hospice": hospice,
            "source": "senior-national-intelligence.json geography VA (CMS class directories)",
            "asOf": "2026-08-27",
            "nationalFingerprint": national["sourceFingerprint"],
            "addedToNationalTotals": False,
            "clocks": {
                "nursingHomes": clock(sources, "nursing-home-provider-information"),
                "homeHealth": clock(sources, "home-health-care-agencies"),
                "hospice": clock(sources, "hospice-general-information"),
            },
        },
        "vdh": {
            "nursingHomeInformationalPortal": {
                "coverage": "OPEN_SEARCH_ONLY",
                "reason": "Interactive VDH OLC / Salesforce portal. No clean bulk download or structured public API found in this ticket.",
                "url": "https://www.vdh.virginia.gov/licensure-and-certification/",
            },
            "ltcInspectionLibrary": {
                "coverage": "OPEN_SEARCH_ONLY",
                "reason": "Per-facility survey/PDF library. Document-heavy; CMS already supplies the nursing-home backbone.",
                "url": "https://www.vdh.virginia.gov/licensure-and-certification/division-of-long-term-care-services/ltc-inspections-surveys/",
            },
            "homeCareHospiceLicensing": {
                "coverage": "OPEN_SEARCH_ONLY",
                "reason": "OLC licensing portal is application/login oriented. No trivial statewide public roster.",
            },
        },
        "publication": {
            "claimableAlfProfiles": False,
            "publicAlfProfileRoutes": False,
            "stateResearchIdentityIsNotPublicProfile": True,
            "stateResearchIdentityIsNotClaimableProfile": True,
            "noEmailNameMatching": True,
            "noAutomaticCmsMatch": True,
        },
        "crosswalk": {
            "alfToCmsNh": {"attempted": False, "exact": 0, "reviewRequired": 0, "rejectedUnsafe": 0},
            "adcToCms": {"attempted": False},
            "cmsCcnPreserved": True,
            "nameOnlyJoins": "UNSAFE",
        },
        "expansionLedger": {
            "NEW_VA_ALF_STATE_IDENTITIES": 573,
            "NEW_VA_ALF_LICENSE_ROWS": 573,
            "NEW_VA_INSPECTION_OBSERVATION_ROWS": inspections,
            "NEW_VA_COMPLAINT_RELATED_INSPECTION_ROWS": complaint_related,
            "NEW_VA_VIOLATION_FLAGGED_INSPECTION_ROWS": violation_y,
            "NEW_VA_ADC_STATE_IDENTITIES": 82,
            "NET_NEW_CANONICAL_FACILITIES": 0,
            "NET_NEW_PUBLIC_PROFILES": 0,
            "EXACT_STATE_TO_CMS_CROSSWALKS": 0,
            "REVIEW_REQUIRED_CROSSWALKS": 0,
            "REJECTED_UNSAFE_CROSSWALKS": 0,
        },
        "juiceSqueeze": [
            {
                "source": "VDSS DOLP Assisted Living Facility Search JSON",
                "decision": "GRABBED — HIGH YIELD",
                "note": "Paginated official JSON, 573/573 licensed ALFs, licenseId identity, capacity, qualifications, license type/expiration, inspection flags.",
            },
            {
                "source": "VDSS ALF facility-detail inspection JSON",
                "decision": "GRABBED — HIGH YIELD",
                "note": "Same adapter. Inspection-level Yes/No violation and complaintNumber. Did not chase violation PDFs.",
            },
            {
                "source": "VDSS Adult Day Center Search JSON",
                "decision": "GRABBED — EASY SECONDARY",
                "note": "Same search architecture, endpoint=adc. 82 licensed centers. Kept as a separate class.",
            },
            {
                "source": "VDH Nursing Home Informational Portal",
                "decision": "LEFT — SEARCH ONLY",
                "note": "Interactive portal / Salesforce. CMS already provides the nursing-home spine.",
            },
            {
                "source": "VDH LTC inspection/survey PDF library",
                "decision": "LEFT — TOO MUCH WORK FOR CURRENT YIELD",
                "note": "Per-facility document crawl. Not required to close statewide Virginia Senior.",
            },
            {
                "source": "VDH home care / hospice licensing portal",
                "decision": "LEFT — SEARCH ONLY",
                "note": "No trivial statewide public roster. CMS HHA/Hospice overlays retained.",
            },
            {
                "source": "DSS ALF violation-detail PDFs",
                "decision": "LEFT — TOO MUCH WORK FOR CURRENT YIELD",
                "note": "Inspection-level flags are sufficient for this ticket.",
            },
            {
                "source": "Inspector and administrator contact fields",
                "decision": "LEFT — SEARCH ONLY",
                "note": "Present on source JSON; stripped from publication. Not facility identity.",
            },
            {
                "source": "Virginia city/county pages",
                "decision": "LEFT — LOCAL / FUTURE",
                "note": "Statewide first. No Fairfax/Richmond/Virginia Beach routes.",
            },
            {
                "source": "FOIA / CORA-style DSS extracts",
                "decision": "LEFT — REQUEST ONLY",
                "note": "Not requested. Public search JSON was enough.",
            },
        ],
        "claimEligibility": {"broadened": False},
        "noCombinedDenominator": True,
        "noTrustScore": True,
        "noRanking": True,
        "noAggregateRating": True,
        "publicationPath": "/virginia",
        "noCountyRoutes": True,
        "noCityRoutes": True,
        "noFairfaxPage": True,
        "noRichmondPage": True,
        "noVirginiaBeachPage": True,
        "statewideOnly": True,
        "unknownIsNotZero": True,
    }
    snapshot["fingerprint"] = sha256_obj({k: v for k, v in snapshot.items() if k != "fingerprint"})
    ART.mkdir(parents=True, exist_ok=True)
    (ART / "va-sen-001-public-snapshot.json").write_text(
        json.dumps(snapshot, indent=2) + "\n", encoding="utf-8"
    )
    (DOMAIN / "va-public-snapshot.ts").write_text(json_to_ts(snapshot), encoding="utf-8")
    print("fingerprint", snapshot["fingerprint"])
    print("alf", 573, "capacity", snapshot["dssAlf"]["licensedCapacitySum"])
    print("inspections", inspections, "complaint-related", complaint_related, "violation Y", violation_y)
    print("adc", 82, "cms", nh, hha, hospice)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
