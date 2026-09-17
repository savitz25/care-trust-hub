#!/usr/bin/env python3
"""NC-SEN-001 — freeze senior-nc-state-intel-v1 from committed artifacts."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from acquire_nc_senior import (  # noqa: E402
    RAW,
    file_sha,
    money,
    parse_ccah,
    parse_ccrc_handbook,
    parse_ccrc_map,
    parse_nh_sod,
    parse_penalties,
    scrape_star_counties,
    xlsx_records,
)

ART = ROOT / "artifacts/nc-sen-001-public-snapshot.json"
TS = ROOT / "packages/domain/src/nc-public-snapshot.ts"
NATIONAL = ROOT / "apps/web/src/data/senior-national-intelligence.json"
GENERATION_KEYS = frozenset({"generatedAt", "fingerprint"})
RETRIEVED = "2026-09-17T19:39:21Z"
SNAPSHOT_AS_OF = "2026-09-17"


def dumps(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(obj: dict) -> str:
    return hashlib.sha256(
        dumps({k: v for k, v in obj.items() if k not in GENERATION_KEYS}).encode("utf-8")
    ).hexdigest()


def listing(path: Path, header_idx: int) -> list[dict[str, str]]:
    rows, _footer = xlsx_records(path, header_idx)
    return [r for r in rows if (r.get("License #") or "").strip()]


def star_numeric(value: str) -> bool:
    return (value or "").strip() in {"0", "1", "2", "3", "4"}


def build_body(generated_at: str) -> dict:
    ach = listing(RAW / "Ahlist.xlsx", 2)
    fch = listing(RAW / "Fchlist.xlsx", 2)
    nh = listing(RAW / "Nhlist_a.xlsx", 4)
    hh = listing(RAW / "hhlist.xlsx", 4)
    hos = listing(RAW / "hoslist.xlsx", 4)
    hc = listing(RAW / "hclist.xlsx", 2)
    npool = listing(RAW / "nursingpool.xlsx", 4)
    hchos = listing(RAW / "hchos.xlsx", 4)
    hhhos = listing(RAW / "hhhos.xlsx", 4)
    scu = listing(RAW / "sculist.xlsx", 2) if (RAW / "sculist.xlsx").exists() else []

    star_rows = scrape_star_counties()
    penalty_rows = parse_penalties(
        (RAW / "adultcarepenalties.html").read_text(encoding="utf-8", errors="replace")
    )
    sod_rows = parse_nh_sod((RAW / "nh-sod-all.html").read_text(encoding="utf-8", errors="replace"))
    ccrc_rows = parse_ccrc_map(RAW / "ccrc-map-export.csv")
    ccah_rows = parse_ccah((RAW / "ccah.html").read_text(encoding="utf-8", errors="replace"))
    handbook = parse_ccrc_handbook(RAW / "ccrc-disclosure-handbook.pdf")
    national = json.loads(NATIONAL.read_text(encoding="utf-8"))
    cms_nc = next(row for row in national["geography"] if row["state"] == "NC")

    ach_lic = {r["License #"].strip() for r in ach}
    fch_lic = {r["License #"].strip() for r in fch}
    hh_lic = {r["License #"].strip() for r in hh}
    hos_lic = {r["License #"].strip() for r in hos}
    hc_lic = {r["License #"].strip() for r in hc}
    np_lic = {r["License #"].strip() for r in npool}
    star_lic = {r["license"] for r in star_rows if r.get("license")}
    star_fid = {r["fid"] for r in star_rows if r.get("fid")}

    ach_star = {r.get("Star Rating", "") for r in ach}
    fch_star = {r.get("Star Rating", "") for r in fch}
    ach_numeric = sum(1 for r in ach if star_numeric(r.get("Star Rating", "")))
    fch_numeric = sum(1 for r in fch if star_numeric(r.get("Star Rating", "")))
    ach_na = sum(1 for r in ach if (r.get("Star Rating") or "").upper() in {"N/A", ""})
    fch_na = sum(1 for r in fch if (r.get("Star Rating") or "").upper() in {"N/A", ""})

    penalty_events = {(r["license"], r["imposed_date"], r["rules"], r["amount"]) for r in penalty_rows}
    penalty_total = round(sum(filter(None, (money(r["amount"]) for r in penalty_rows))), 2)

    exact_fid_license = sum(1 for r in star_rows if r.get("fid") and r.get("license"))
    expansion = (
        len(ach_lic)
        + len(fch_lic)
        + len({r["License #"].strip() for r in nh})
        + len(hh_lic)
        + len(hos_lic)
        + len(np_lic)
        + 13  # PACE NPIs in official PDF
        + handbook["id_row_hits"]
        + len(ccah_rows)
        + 1  # overnight respite ORL-092-001
    )

    return {
        "version": "senior-nc-state-intel-v1",
        "ticket": "NC-SEN-001",
        "publicationPath": "/north-carolina",
        "asOf": None,
        "snapshotAsOf": SNAPSHOT_AS_OF,
        "retrievedAt": RETRIEVED,
        "generatedAt": generated_at,
        "regulatorMap": {
            "dhsrListings": "https://info.ncdhhs.gov/dhsr/reports.htm",
            "aclsListings": "https://info.ncdhhs.gov/dhsr/acls/faclistings.html",
            "starSearch": "https://info.ncdhhs.gov/dhsr/acls/star/search.asp",
            "starScale": "https://info.ncdhhs.gov/dhsr/acls/star/scale.html",
            "penalties": "https://info.ncdhhs.gov/dhsr/acls/adultcarepenalties.asp",
            "nhlcsSearch": "https://info.ncdhhs.gov/dhsr/facilities/search.asp",
            "adultDayDirectory": "https://www.ncdhhs.gov/4-17-26-adc-provider-list/download?attachment",
            "pace": "https://medicaid.ncdhhs.gov/providers/programs-and-services/long-term-care/program-all-inclusive-care-elderly-pace",
            "ccrc": "https://www.ncdoi.gov/licensees/continuing-care-retirement-communities-ccrc/licensed-ccrcs",
            "ccah": "https://www.ncdoi.gov/licensees/continuing-care-retirement-communities-ccrc/continuing-care-home",
            "cmsCareCompare": "https://www.medicare.gov/care-compare/",
        },
        "clocks": {
            "ach_list_update_date": "2026-07-30",
            "fch_list_update_date": "2026-07-30",
            "home_care_update_date": "2026-08-20",
            "home_health_update_date": "2026-08-20",
            "hospice_update_date": "2026-08-20",
            "nursing_home_update_date": "2026-09-09",
            "nursing_pool_update_date": "2026-08-20",
            "star_listing_as_of": "2026-07-30",
            "star_issue_date": None,
            "penalty_source": "previous 36 months listing",
            "adult_day_directory_date": "2026-04-21",
            "pace_page_date": "2026-02-18",
            "pace_retrievedAt": RETRIEVED,
            "ccrc_source_retrievedAt": RETRIEVED,
            "cms_sourceAsOf": "2026-08-27",
            "retrievedAt": RETRIEVED,
            "snapshotAsOf": SNAPSHOT_AS_OF,
            "generatedAt": generated_at,
            "retrievedAt_is_not_sourceAsOf": True,
        },
        "adultCareHomes": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceUpdated": "2026-07-30",
            "sourceAsOf": "2026-07-30",
            "NC_ADULT_CARE_HOME_ROWS": len(ach),
            "NC_ADULT_CARE_HOME_DISTINCT_LICENSE_IDS": len(ach_lic),
            "NC_ADULT_CARE_HOME_CURRENT_ROWS": len(ach),
            "officialFooter": 568,
            "identityNamespace": "NC-DHSR-ACH:{HAL license}",
            "ach_ne_fch": True,
            "ach_ne_nursing_home": True,
            "sha256": file_sha(RAW / "Ahlist.xlsx"),
        },
        "familyCareHomes": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceUpdated": "2026-07-30",
            "sourceAsOf": "2026-07-30",
            "NC_FAMILY_CARE_HOME_ROWS": len(fch),
            "NC_FAMILY_CARE_HOME_DISTINCT_LICENSE_IDS": len(fch_lic),
            "NC_FAMILY_CARE_HOME_CURRENT_ROWS": len(fch),
            "officialFooter": 515,
            "identityNamespace": "NC-DHSR-FCH:{FCL license}",
            "fch_ne_ach": True,
            "fch_ne_nursing_home": True,
            "sha256": file_sha(RAW / "Fchlist.xlsx"),
        },
        "multiUnitHousing": {
            "coverage": "OPEN_SEARCH_ONLY",
            "NC_MULTI_UNIT_HOUSING_ROWS": None,
            "note": "ACLS registers Multi-Unit Assisted Housing with Services. No bounded statewide structured registry was acquired. Registration is not a licensed Adult Care Home.",
            "registration_ne_licensed_ach": True,
        },
        "overnightRespite": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "NC_OVERNIGHT_RESPITE_ROWS": 1,
            "identityNamespace": "NC-DHSR-ORL:{ORL license}",
            "sampleLicense": "ORL-092-001",
            "not_ach_or_fch": True,
        },
        "specialCareUnits": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "NC_SPECIAL_CARE_UNIT_ROWS": len(scu),
            "subset_of_adult_care_not_a_new_class": True,
        },
        "starRatings": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "label": "NC DHSR Star Rating",
            "not_trusthub_score": True,
            "not_ranking": True,
            "no_aggregate_rating": True,
            "no_statewide_average": True,
            "listingSourceUpdated": "2026-07-30",
            "sourceAsOf": "2026-07-30",
            "NC_STAR_LISTING_ROWS": len(ach) + len(fch),
            "NC_LATEST_STAR_OBSERVATIONS": ach_numeric + fch_numeric,
            "ACH_NUMERIC_STAR_OBSERVATIONS": ach_numeric,
            "FCH_NUMERIC_STAR_OBSERVATIONS": fch_numeric,
            "ACH_STAR_NA_OR_BLANK": ach_na,
            "FCH_STAR_NA_OR_BLANK": fch_na,
            "missing_ne_zero": True,
            "issue_date_in_listing": False,
            "historyCoverage": "OPEN_SEARCH_ONLY",
            "NC_STAR_HISTORY_ROWS": None,
            "FACILITIES_WITH_STAR_HISTORY": None,
            "fidIndex": {
                "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
                "NC_STAR_FID_INDEX_ROWS": len(star_rows),
                "NC_STAR_DISTINCT_FIDS": len(star_fid),
                "NC_STAR_DISTINCT_LICENSES": len(star_lic),
                "EXACT_LICENSE_FID_ATTACHMENTS": exact_fid_license,
                "retrievedAt": RETRIEVED,
                "countiesWithResults": len({r["county"] for r in star_rows}),
                "identityNamespace": "NC-DHSR-FID:{fid}",
            },
            "officialSearch": "https://info.ncdhhs.gov/dhsr/acls/star/search.asp",
        },
        "adultCareInspections": {
            "coverage": "OPEN_SEARCH_ONLY",
            "NC_ADULT_CARE_INSPECTION_ROWS": None,
            "note": "ACLS posts facility-level Statements of Deficiencies from November 1, 2014 on facility.asp?fid=. No statewide bounded inspection-event table was acquired. Inspection is not a complaint. SOD is not a penalty. Plan of correction is not an admission.",
            "inspection_ne_complaint": True,
            "inspection_ne_penalty": True,
        },
        "adultCarePenalties": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "source": "DHSR ACLS penalties imposed previous 36 months",
            "sourceAsOf": None,
            "NC_ADULT_CARE_PENALTY_ROWS": len(penalty_rows),
            "NC_ADULT_CARE_PENALTY_DISTINCT_EVENTS": len(penalty_events),
            "NC_ADULT_CARE_PENALTY_DISTINCT_LICENSES": len({r["license"] for r in penalty_rows if r["license"]}),
            "NC_ADULT_CARE_PENALTY_AMOUNT_TOTAL": penalty_total,
            "amount_ne_quality_score": True,
            "penalty_ne_complaint": True,
            "penalty_ne_conviction": True,
            "penalty_ne_inspection": True,
            "identityNamespace": "NC-DHSR-ACH/FCH:{license} + imposed date + rule",
        },
        "nursingHomes": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceUpdated": "2026-09-09",
            "sourceAsOf": "2026-09-09",
            "NC_NURSING_HOME_ROWS": len(nh),
            "NC_NURSING_HOME_DISTINCT_STATE_IDS": len({r["License #"].strip() for r in nh}),
            "NC_NURSING_HOME_DISTINCT_CCNS": 0,
            "ccn_in_state_listing": False,
            "officialFooter": 423,
            "identityNamespace": "NC-DHSR-NH:{NH license}",
            "row_ne_cms_overlay": True,
            "state_license_ne_cms": True,
            "sha256": file_sha(RAW / "Nhlist_a.xlsx"),
        },
        "nursingHomeSodIndex": {
            "coverage": "ACQUIRED_INDEX",
            "NC_NURSING_HOME_SOD_INDEX_ROWS": len(sod_rows),
            "NC_NURSING_HOME_SOD_DISTINCT_FIDS": len({r["fid"] for r in sod_rows if r["fid"]}),
            "index_ne_license_census": True,
            "index_ne_complete_sod_universe": True,
            "sod_content": "OPEN_SEARCH_ONLY",
            "officialUrl": "https://info.ncdhhs.gov/dhsr/facilities/results.asp",
            "surveys_from": "2011-03-01",
        },
        "nursingHomeComplaints": {
            "coverage": "OPEN_SEARCH_ONLY",
            "NC_NURSING_HOME_COMPLAINT_ROWS": None,
            "note": "NHLCS receives about 3,000 nursing-home complaints per year as process context. No structured complaint-event universe was acquired. Complaint process is not a census. Missing is not zero.",
        },
        "homeCareAllMixed": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceUpdated": "2026-08-20",
            "sourceAsOf": "2026-08-20",
            "NC_HOME_CARE_ALL_MIXED_ROWS": len(hc),
            "not_home_care_agency_count": True,
            "includes_home_health_listing": len(hh_lic & hc_lic),
            "includes_home_care_with_hospice_subset": len({r["License #"].strip() for r in hchos} & hc_lic),
            "includes_home_health_with_hospice_subset": len({r["License #"].strip() for r in hhhos} & hc_lic),
            "includes_hospice_listing": len(hos_lic & hc_lic),
            "includes_nursing_pool_listing": len(np_lic & hc_lic),
            "remainder_after_home_health_listing": len(hc_lic - hh_lic),
            "remainder_is_not_pure_home_care": True,
            "identityNamespace": "NC-DHSR-HC:{HC license} in mixed file",
            "sha256": file_sha(RAW / "hclist.xlsx"),
        },
        "homeHealth": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceUpdated": "2026-08-20",
            "sourceAsOf": "2026-08-20",
            "NC_HOME_HEALTH_ROWS": len(hh),
            "NC_HOME_HEALTH_STATE_IDS": len(hh_lic),
            "NC_HOME_HEALTH_CCNS": 0,
            "home_health_ne_home_care": True,
            "identityNamespace": "NC-DHSR-HH:{HC license in Home Health listing}",
            "sha256": file_sha(RAW / "hhlist.xlsx"),
        },
        "hospice": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceUpdated": "2026-08-20",
            "sourceAsOf": "2026-08-20",
            "NC_HOSPICE_ROWS": len(hos),
            "NC_HOSPICE_STATE_IDS": len(hos_lic),
            "NC_HOSPICE_CCNS": 0,
            "hospice_ne_home_health": True,
            "hospice_ne_home_care": True,
            "identityNamespace": "NC-DHSR-HOS:{HOS license}",
            "sha256": file_sha(RAW / "hoslist.xlsx"),
        },
        "nursingPool": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceUpdated": "2026-08-20",
            "NC_NURSING_POOL_ROWS": len(npool),
            "NC_NURSING_POOL_STATE_IDS": len(np_lic),
            "nursing_pool_ne_home_care": True,
            "identityNamespace": "NC-DHSR-NP:{NP license}",
            "sha256": file_sha(RAW / "nursingpool.xlsx"),
        },
        "adultDay": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "directoryDate": "2026-04-21",
            "sourceAsOf": "2026-04-21",
            "NC_ADULT_DAY_CENTER_ROWS": 93,
            "NC_ADULT_DAY_CERTIFIED_SLOTS": 5850,
            "adult_day_ne_residential": True,
            "do_not_double_count_combined_adc_adh": True,
            "identityNamespace": "NC-DAAS-ADC:{center name+address in certified directory}",
            "sha256": file_sha(RAW / "adc-provider-list-2026-04-21.pdf"),
        },
        "pace": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourcePageDate": "2026-02-18",
            "sourceAsOf": "2026-02-18",
            "NC_PACE_ORGANIZATIONS": 11,
            "NC_PACE_LOCATIONS": 14,
            "NC_PACE_NPIS": 13,
            "pace_org_ne_location": True,
            "pace_ne_facility_license": True,
            "identityNamespace": "NC-PACE:{NPI}",
            "sha256": file_sha(RAW / "pace-service-area.pdf"),
        },
        "ccrc": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "sourceAsOf": None,
            "NC_CCRC_MAP_COMMUNITIES": len(ccrc_rows),
            "NC_CCRC_HANDBOOK_ID_ROWS": handbook["id_row_hits"],
            "identityNamespace": "NC-DOI-CCRC:{providerId}-{communityId}",
            "ccrc_ne_dhsr_component": True,
            "name_only_merge_to_dhsr": False,
            "sha256": file_sha(RAW / "ccrc-map-export.csv"),
        },
        "continuingCareAtHome": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "NC_CCAH_ROWS": len(ccah_rows),
            "ccah_ne_ccrc_count": True,
            "identityNamespace": "NC-DOI-CCAH:{facility name in licensed CCaH table}",
        },
        "cmsOverlay": {
            "nursingHomes": cms_nc["nursingHomes"],
            "homeHealth": cms_nc["homeHealth"],
            "hospice": cms_nc["hospice"],
            "addedToNationalTotals": False,
            "stateLicense_ne_cms": True,
            "sourceAsOf": "2026-08-27",
        },
        "crosswalk": {
            "EXACT_NC_STATE_TO_CMS_BRIDGES": {
                "nursing_home": 0,
                "home_health": 0,
                "hospice": 0,
                "home_care": 0,
            },
            "EXACT_NC_STATE_TO_CMS_BRIDGES_TOTAL": 0,
            "EXACT_ACH_FCH_LICENSE_FID_BRIDGES": exact_fid_license,
            "matching_counts_are_not_a_bridge": True,
            "ccn_not_in_dhsr_listings": True,
            "NAME_ONLY_UNSAFE": 0,
        },
        "identity": {
            "priority": [
                "exact state facility/license identifier",
                "exact DHSR FID",
                "exact CMS CCN",
                "exact state-published state↔CMS bridge",
                "exact inspection/penalty/survey identifier",
                "review_required",
                "name-only unsafe",
            ],
            "NAME_ONLY_UNSAFE": 0,
            "facility_ne_legal_entity": True,
        },
        "expansion_ledger": {
            "NET_NEW_STATE_RESEARCH_IDENTITIES": expansion,
            "NET_NEW_CANONICAL_FACILITIES": 0,
            "NET_NEW_PUBLIC_PROFILES": 0,
            "EXISTING_FACILITIES_ENRICHED": 0,
            "GRAPH_WRITES": 0,
            "CLAIM_ELIGIBILITY_BROADENED": False,
            "EXACT_PROFILE_ATTACHMENTS": 0,
        },
        "adverse_publication": {
            "ADVERSE_SOURCES_FOUND": [
                "DHSR ACLS Star Rating search / facility.asp",
                "DHSR ACLS penalties previous 36 months",
                "DHSR ACLS facility SOD PDFs from Nov 2014",
                "DHSR NHLCS SOD index from Mar 2011",
                "County DSS Corrective Action Reports",
            ],
            "ADVERSE_SOURCES_ACQUIRED": [
                "DHSR ACH/FCH listing Star Rating column 2026-07-30",
                "DHSR ACLS county Star Rating/FID index",
                "DHSR ACLS penalties previous 36 months HTML",
                "DHSR NHLCS SOD facility index",
            ],
            "ADVERSE_ROWS_ACQUIRED": len(penalty_rows) + len(star_rows) + len(sod_rows),
            "UNIQUE_REGULATORY_MATTERS": len(penalty_events),
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "REVIEW_REQUIRED": 0,
            "UNRESOLVED": 0,
            "INTERNAL_ONLY": 0,
            "PUBLICATION_PENDING": 0,
            "PUBLIC_READY_PROFILES": 0,
            "PUBLICLY_RENDERED_PROFILES": 0,
            "BUSINESS_RESPONSE_READY": 0,
            "SEARCH_SUPPORTED": True,
            "REMAINING_ADVERSE_GAPS": [
                "facility-level Adult Care SOD PDF corpus",
                "Star Rating issue-date history tables",
                "nursing-home complaint-event universe",
                "county CAR bulk table",
                "nursing-home SOD document corpus",
            ],
            "WITHHELD_REASON_COUNTS": {
                "NAME_ONLY_UNSAFE": 0,
                "NO_EXACT_ID": 0,
                "SEARCH_ONLY_SOURCE": 4,
            },
            "do_not_sum_inspection_violation_sanction_complaint": True,
        },
        "claimEligibilityBroadened": False,
        "localWorkNeededNow": "NO",
        "semanticGuardrails": [
            "ACH != FCH != Nursing Home",
            "Home Care != Home Health != Hospice",
            "Adult Day != residential facility",
            "PACE != facility license",
            "CCRC != licensed DHSR component",
            "state license != CMS",
            "state Star Rating != TrustHub rating",
            "inspection != complaint",
            "penalty != conviction",
            "missing != zero",
            "Home Care All mixed file != Home Care agency count",
            "Nursing Pool != Home Care",
            "NO TRUST SCORE",
            "NO RANKING",
            "NO AggregateRating",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if args.check:
        existing = json.loads(ART.read_text(encoding="utf-8"))
        rebuilt = build_body(existing["generatedAt"])
        rebuilt["fingerprint"] = sha(rebuilt)
        if rebuilt["fingerprint"] != existing["fingerprint"]:
            raise SystemExit(
                f"fingerprint drift {existing['fingerprint']} -> {rebuilt['fingerprint']}"
            )
        print(json.dumps({"ok": True, "fingerprint": existing["fingerprint"]}))
        return
    body = build_body(generated)
    body["fingerprint"] = sha(body)
    ART.write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    ts = (
        "/** Generated from artifacts/nc-sen-001-public-snapshot.json. Do not edit by hand. */\n"
        f"export const NC_PUBLIC_SNAPSHOT = {json.dumps(body, indent=2)} as const;\n"
        "export type NcPublicSnapshot = typeof NC_PUBLIC_SNAPSHOT;\n"
    )
    TS.write_text(ts, encoding="utf-8")
    print(json.dumps({"fingerprint": body["fingerprint"], "generatedAt": generated}, indent=2))


if __name__ == "__main__":
    main()
