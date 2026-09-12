#!/usr/bin/env python3
"""IL-SEN-001 — Illinois senior state intelligence from committed artifacts.

CMS Illinois overlays are reused from senior-national-intelligence.json.
IDPH directories are frozen CSVs. HFS SLP uses the official operational PDF total.
No national CMS redownload. generatedAt is excluded from the semantic fingerprint.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/illinois/il-sen-001/raw"
NATIONAL = ROOT / "apps/web/src/data/senior-national-intelligence.json"
ART = ROOT / "artifacts/il-sen-001-public-snapshot.json"
TS = ROOT / "packages/domain/src/il-public-snapshot.ts"

EXPECTED = {
    "cms_nh": 666,
    "cms_hha": 530,
    "cms_hospice": 149,
    "idph_hha": 595,
    "idph_hospice": 178,
    "idph_home_nursing": 258,
    "idph_home_services": 1029,
    "idph_hospice_residence": 10,
    "slp_sites": 169,
    "slp_units": 13939,
}

GENERATION_KEYS = frozenset({"generatedAt", "fingerprint"})
IDPH_RETRIEVED = "2026-09-12T15:47:12Z"


def dumps(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(obj: object) -> str:
    return hashlib.sha256(dumps(obj).encode("utf-8")).hexdigest()


def semantic(obj: dict) -> dict:
    return {k: v for k, v in obj.items() if k not in GENERATION_KEYS}


def csv_rows(name: str) -> list[dict[str, str]]:
    return list(csv.DictReader((RAW / name).open(encoding="utf-8")))


def unique_licenses(rows: list[dict[str, str]]) -> int:
    vals = [(r.get("license_number") or "").strip() for r in rows]
    nonempty = [v for v in vals if v]
    if len(nonempty) != len(set(nonempty)):
        raise SystemExit("duplicate license numbers")
    return len(nonempty)


def file_sha(name: str) -> str:
    return hashlib.sha256((RAW / name).read_bytes()).hexdigest()


def clock(sources: list[dict], key: str) -> dict:
    row = next((item for item in sources if item.get("datasetKey") == key), {})
    return {
        "datasetKey": key,
        "officialUrl": row.get("officialUrl"),
        "sourceModifiedAt": row.get("sourceModifiedAt"),
        "retrievedAt": row.get("retrievedAt"),
        "sourcePeriod": row.get("sourcePeriod"),
    }


def slp_totals() -> tuple[int, int]:
    text = RAW.joinpath("hfs-slp-operational.txt").read_text(encoding="utf-8")
    match = re.search(r"Totals-\s*(\d+)\s*sites/([\d,]+)\s*units", text)
    if not match:
        raise SystemExit("HFS SLP official totals line missing")
    return int(match.group(1)), int(match.group(2).replace(",", ""))


def build_body(generated_at: str) -> dict:
    national = json.loads(NATIONAL.read_text(encoding="utf-8"))
    geo = next((row for row in national.get("geography") or [] if row.get("state") == "IL"), None)
    if not geo:
        raise SystemExit("Illinois geography partition missing")
    nh, hha, hospice = int(geo["nursingHomes"]), int(geo["homeHealth"]), int(geo["hospice"])
    if (nh, hha, hospice) != (EXPECTED["cms_nh"], EXPECTED["cms_hha"], EXPECTED["cms_hospice"]):
        raise SystemExit(f"CMS IL overlay drifted {nh}/{hha}/{hospice}")
    sources = national.get("sources") or []
    hha_rows = csv_rows("idph-home-health.csv")
    hospice_rows = csv_rows("idph-hospice.csv")
    hn_rows = csv_rows("idph-home-nursing.csv")
    hs_rows = csv_rows("idph-home-services.csv")
    hr_rows = csv_rows("idph-hospice-residence.csv")
    counts = {
        "idph_hha": unique_licenses(hha_rows),
        "idph_hospice": unique_licenses(hospice_rows),
        "idph_home_nursing": unique_licenses(hn_rows),
        "idph_home_services": unique_licenses(hs_rows),
        "idph_hospice_residence": unique_licenses(hr_rows),
    }
    for key, expected in counts.items():
        if expected != EXPECTED[key]:
            raise SystemExit(f"{key} drifted {expected}")
    slp_sites, slp_units = slp_totals()
    if slp_sites != EXPECTED["slp_sites"] or slp_units != EXPECTED["slp_units"]:
        raise SystemExit(f"SLP totals drifted {slp_sites}/{slp_units}")

    return {
        "version": "senior-il-state-intel-v1",
        "ticket": "IL-SEN-001",
        "publicationPath": "/illinois",
        "asOf": None,
        "snapshotAsOf": "2026-09-12",
        "retrievedAt": IDPH_RETRIEVED,
        "generatedAt": generated_at,
        "regulatorMap": {
            "agency": "Illinois Department of Public Health",
            "nursingHomes": "https://dph.illinois.gov/topics-services/health-care-regulation/nursing-homes.html",
            "facilityLookup": "https://llcs.dph.illinois.gov/",
            "complaints": "https://dph.illinois.gov/topics-services/health-care-regulation/complaints.html",
            "hotline": "800-252-4343",
            "hfsSlp": "https://hfs.illinois.gov/medicalclients/hcbs/slf.html",
            "hfsSlpLocate": "https://hfs.illinois.gov/medicalprograms/slf/locate.html",
            "hfsSlpPdf": "https://hfs.illinois.gov/content/dam/soi/en/web/hfs/medicalprograms/slf/OperationalSites.pdf",
            "openDataHha": "https://data.illinois.gov/Health-and-Human-Services/IDPH-Home-Health-Agency-Directory/p7mg-cnpx",
            "openDataHospice": "https://data.illinois.gov/Health-and-Human-Services/IDPH-Hospice-Agency-Directory/havn-xxw6",
            "cmsCareCompare": "https://www.medicare.gov/care-compare/",
            "workerRegistry": "https://dph.illinois.gov/topics-services/health-care-regulation/health-care-worker-registry.html",
        },
        "cmsOverlay": {
            "nursingHomes": nh,
            "homeHealth": hha,
            "hospice": hospice,
            "source": "senior-national-intelligence.json geography IL (CMS class directories)",
            "asOf": "2026-08-27",
            "nationalFingerprint": national["sourceFingerprint"],
            "addedToNationalTotals": False,
            "clocks": {
                "nursingHomes": clock(sources, "nursing-home-provider-information"),
                "homeHealth": clock(sources, "home-health-care-agencies"),
                "hospice": clock(sources, "hospice-general-information"),
            },
        },
        "stateNursingHomes": {
            "coverage": "OPEN_SEARCH_ONLY",
            "currentRosterCount": None,
            "staleGisRows": 898,
            "staleGisClock": "2024-02-28 metadata; facility records include 2013 survey/expiration dates",
            "staleGisCannotPromote": True,
            "searchOnlyIsNotZero": True,
            "identityNamespace": None,
            "exactStateToCmsBridges": 0,
        },
        "idphHomeHealth": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceId": "p7mg-cnpx",
            "sourceAsOf": "2026-04-28",
            "retrievedAt": IDPH_RETRIEVED,
            "rows": counts["idph_hha"],
            "distinctLicenseNumbers": counts["idph_hha"],
            "identityNamespace": "IL-IDPH-HHA:{license_number}",
            "sha256": file_sha("idph-home-health.csv"),
            "notCmsHomeHealth": True,
            "noCcnOnRoster": True,
        },
        "idphHospice": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceId": "havn-xxw6",
            "sourceAsOf": "2026-04-28",
            "retrievedAt": IDPH_RETRIEVED,
            "rows": counts["idph_hospice"],
            "distinctLicenseNumbers": counts["idph_hospice"],
            "identityNamespace": "IL-IDPH-HOSPICE:{license_number}",
            "sha256": file_sha("idph-hospice.csv"),
            "notCmsHospice": True,
            "notHospiceResidence": True,
        },
        "idphHomeNursing": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceId": "bcew-kt67",
            "sourceAsOf": "2026-04-28",
            "retrievedAt": IDPH_RETRIEVED,
            "rows": counts["idph_home_nursing"],
            "distinctLicenseNumbers": counts["idph_home_nursing"],
            "identityNamespace": "IL-IDPH-HN:{license_number}",
            "sha256": file_sha("idph-home-nursing.csv"),
            "notHomeHealth": True,
        },
        "idphHomeServices": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceId": "9miz-pbzm",
            "sourceAsOf": "2026-04-28",
            "retrievedAt": IDPH_RETRIEVED,
            "rows": counts["idph_home_services"],
            "distinctLicenseNumbers": counts["idph_home_services"],
            "identityNamespace": "IL-IDPH-HS:{license_number}",
            "sha256": file_sha("idph-home-services.csv"),
            "notHomeHealth": True,
            "notSkilledNursing": True,
        },
        "idphHospiceResidence": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceId": "iigv-ktef",
            "sourceAsOf": "2026-04-28",
            "retrievedAt": IDPH_RETRIEVED,
            "rows": counts["idph_hospice_residence"],
            "distinctLicenseNumbers": counts["idph_hospice_residence"],
            "identityNamespace": "IL-IDPH-HOSPICE-RES:{license_number}",
            "sha256": file_sha("idph-hospice-residence.csv"),
            "notHospiceProgram": True,
        },
        "assistedLiving": {
            "coverage": "OPEN_SEARCH_ONLY",
            "currentRosterCount": None,
            "staleListingRows": 495,
            "staleListingClock": "2024-02-16 metadata; licenses expire 2019-2020",
            "staleCannotPromote": True,
            "sharedHousingSeparate": True,
            "searchOnlyIsNotZero": True,
        },
        "supportiveLiving": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceAsOf": "2026-02-06",
            "retrievedAt": IDPH_RETRIEVED,
            "operationalSites": slp_sites,
            "units": slp_units,
            "identityNamespace": None,
            "notNursingHome": True,
            "notAssistedLiving": True,
            "notCmsSnf": True,
            "participationIsNotLicense": True,
            "sha256": file_sha("hfs-slp-operational.pdf"),
        },
        "complaints": {
            "coverage": "OPEN_SEARCH_ONLY",
            "hotline": "800-252-4343",
            "searchOnlyIsNotZero": True,
            "complaintIsNotDeficiency": True,
        },
        "inspections": {
            "stateCoverage": "OPEN_SEARCH_ONLY",
            "cmsSurveyEvidence": "REUSED_NATIONAL_CMS_FOR_CERTIFIED_CCNS",
            "inspectionIsNotDeficiency": True,
        },
        "personFirewall": {
            "administratorIsNotFacility": True,
            "workerRegistryIsNotFacility": True,
            "noPersonPages": True,
        },
        "claimEligibility": {"broadened": False},
        "noLocalIllinoisRoutes": True,
        "noTrustScore": True,
        "noRanking": True,
        "expansionLedger": {
            "IL_STATE_NURSING_HOME_ROWS": None,
            "IL_STATE_DISTINCT_FACILITY_IDS": None,
            "IL_STATE_ROWS_WITH_CCN": None,
            "IL_STATE_DISTINCT_CCNS": None,
            "IL_CMS_NURSING_HOME_ROWS": nh,
            "IL_CMS_HOME_HEALTH_ROWS": hha,
            "IL_CMS_HOSPICE_ROWS": hospice,
            "EXACT_IL_STATE_TO_CMS_BRIDGES": 0,
            "IL_STATE_ASSISTED_LIVING_ROWS": None,
            "IL_STATE_SHARED_HOUSING_ROWS": None,
            "IL_SUPPORTIVE_LIVING_ROWS": slp_sites,
            "IL_STATE_HOME_HEALTH_ROWS": counts["idph_hha"],
            "IL_STATE_HOME_NURSING_ROWS": counts["idph_home_nursing"],
            "IL_STATE_HOME_SERVICES_ROWS": counts["idph_home_services"],
            "IL_STATE_HOSPICE_ROWS": counts["idph_hospice"],
            "IL_STATE_HOSPICE_RESIDENCE_ROWS": counts["idph_hospice_residence"],
            "IL_INSPECTION_OBSERVATIONS": None,
            "IL_DEFICIENCY_OBSERVATIONS": None,
            "IL_ENFORCEMENT_OBSERVATIONS": None,
            "IL_COMPLAINT_OBSERVATIONS": None,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "NET_NEW_STATE_RESEARCH_IDENTITIES": 0,
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_PUBLIC_PROVIDER_PROFILES": 0,
            "GRAPH_WRITES": 0,
        },
        "fingerprint": "",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--generated-at", default=None)
    args = parser.parse_args()
    fp_a = sha(semantic(build_body("2020-01-01T00:00:00Z")))
    fp_b = sha(semantic(build_body("2099-12-31T23:59:59Z")))
    if fp_a != fp_b:
        raise SystemExit("generatedAt leaked into fingerprint")
    if args.check:
        current = json.loads(ART.read_text(encoding="utf-8"))
        if sha(semantic(current)) != fp_a or current.get("fingerprint") != fp_a:
            raise SystemExit("fingerprint drifted")
        print(json.dumps({"check": "ok", "fingerprint": fp_a}, indent=2))
        return
    generated_at = args.generated_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if generated_at in {"2020-01-01T00:00:00Z", "2099-12-31T23:59:59Z"}:
        raise SystemExit("refusing synthetic clocks")
    body = build_body(generated_at)
    body["fingerprint"] = fp_a
    ART.parent.mkdir(parents=True, exist_ok=True)
    ART.write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    TS.write_text(
        "/** Generated from artifacts/il-sen-001-public-snapshot.json. Do not edit by hand. */\n"
        "export const IL_PUBLIC_SNAPSHOT = "
        + json.dumps(body, indent=2)
        + " as const;\n",
        encoding="utf-8",
    )
    print(json.dumps({"fingerprint": fp_a, "generatedAt": generated_at, **{k: EXPECTED[k] for k in EXPECTED}}, indent=2))


if __name__ == "__main__":
    main()
