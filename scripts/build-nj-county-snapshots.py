"""Build NJ-SEN-COUNTY-001 public county snapshots from NJ-SEN-005 + local fixtures."""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "apps" / "web" / "src" / "data" / "nj-county-local"
INVENTORY = ROOT / "apps" / "web" / "src" / "data" / "nj-facility-inventory.json"
STATE_ARTIFACT = ROOT / "artifacts" / "nj-sen-005-public-snapshot.json"
OUT_DIR = ROOT / "packages" / "domain" / "src" / "nj-county-public-snapshots"
ARTIFACT_DIR = ROOT / "artifacts" / "nj-sen-county-001"
TS_OUT = ROOT / "packages" / "domain" / "src" / "nj-county-public-snapshots.ts"

VERSION = "nj-sen-county-001-public-v1"
STATE_FINGERPRINT = "92e0742f77f2f55a5ccd6217c5caa779f3281fd26b1d91c14e2df11ae144011a"

COUNTIES = [
    {
        "slug": "monmouth-county",
        "name": "Monmouth",
        "fips": "34025",
    },
    {
        "slug": "middlesex-county",
        "name": "Middlesex",
        "fips": "34023",
    },
    {
        "slug": "somerset-county",
        "name": "Somerset",
        "fips": "34035",
    },
    {
        "slug": "union-county",
        "name": "Union",
        "fips": "34039",
    },
]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def fingerprint(obj: dict) -> str:
    payload = {k: v for k, v in obj.items() if k != "fingerprint"}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def count_types(rows: list[dict]) -> list[dict]:
    c = Counter((row["type"], row["typeKey"]) for row in rows)
    return [
        {"label": label, "typeKey": key, "count": n}
        for (label, key), n in sorted(c.items(), key=lambda item: (-item[1], item[0][0]))
    ]


def site(row: dict, extra: dict | None = None) -> dict:
    out = {
        "name": row.get("name"),
        "streetAddress": row.get("street_address") or row.get("address"),
        "municipality": row.get("municipality"),
        "zip": row.get("zip"),
        "phone": row.get("phone") or row.get("telephone"),
    }
    if extra:
        out.update(extra)
    return out


def pace_for(state: dict, county: str) -> dict:
    centers = [c for c in state["pace"]["centers"] if c.get("county") == county]
    operating = [c for c in centers if c.get("status") == "OPERATING"]
    awarded = [c for c in centers if c.get("status") in ("AWARDED", "IN_DEVELOPMENT")]
    return {
        "treatment": "CENTER_ADDRESS_COUNTY_ONLY",
        "centersInCounty": centers,
        "operatingCentersInCounty": len(operating),
        "awardedOrInDevelopmentCentersInCounty": len(awarded),
        "statewideOrganizations": state["pace"]["organizations"],
        "statewideOperatingOrganizations": state["pace"]["operatingOrganizations"],
        "statewideAwardedOrganizations": state["pace"]["awardedOrganizations"],
        "statewideOperatingCenters": state["pace"]["operatingCenters"],
        "caveat": (
            "Center address county is not a service area. Organization is not a center. "
            "Operating is not awarded. A county PACE listing is not guaranteed eligibility."
        ),
    }


def local_monmouth() -> dict:
    src = load_json(LOCAL / "monmouth-senior-centers.json")
    return {
        "kind": "COUNTY_RESOURCE",
        "notALicensedFacility": True,
        "sourceAsOf": src["source_as_of"],
        "adrc": {
            "agency": src["adrc"]["agency"],
            "phone": src["adrc"]["phone"],
            "tollFree": src["adrc"]["toll_free"],
            "email": src["adrc"]["email"],
            "address": src["adrc"]["address"],
            "url": src.get("adrc_url"),
        },
        "seniorCenters": {
            "sourceUrl": src["source_url"],
            "coverage": "ACQUIRED_PUBLIC_HTML",
            "count": len(src["senior_centers"]),
            "rows": [
                site(row, {"nutritionSite": bool(row.get("nutrition_site"))})
                for row in src["senior_centers"]
            ],
        },
        "otherServiceCenters": [site(row) for row in src.get("other_service_centers", [])],
        "congregateMealSites": None,
        "congregateMealSitesCoverage": None,
        "homeDeliveredMeals": src.get("home_delivered_meals", []),
        "seniorCentersNotExtracted": None,
        "housingInventory": None,
        "nursingHomeGeocode": None,
        "seniorGrant": None,
        "homeImprovementProgram": None,
        "notes": src.get("notes", []),
    }


def local_middlesex() -> dict:
    src = load_json(LOCAL / "middlesex-senior-centers-and-nutrition.json")
    return {
        "kind": "COUNTY_RESOURCE",
        "notALicensedFacility": True,
        "sourceAsOf": src["source_as_of"],
        "adrc": {
            "agency": src["adrc"]["agency"],
            "phone": src["adrc"]["phone"],
            "tollFree": src["adrc"]["toll_free"],
            "email": src["adrc"]["email"],
            "address": src["adrc"]["address"],
            "url": src.get("senior_centers_url"),
        },
        "seniorCenters": {
            "sourceUrl": src["senior_centers_url"],
            "coverage": "ACQUIRED_PUBLIC_HTML_PARTIAL",
            "count": len(src["senior_centers_acquired"]),
            "rows": [site(row) for row in src["senior_centers_acquired"]],
        },
        "otherServiceCenters": [],
        "congregateMealSites": [
            site(row, {"hours": row.get("hours")}) for row in src["congregate_meal_sites"]
        ],
        "congregateMealSitesCoverage": "COMPLETE_OFFICIAL_HTML",
        "homeDeliveredMeals": [],
        "seniorCentersNotExtracted": src.get("senior_centers_not_extracted_this_ticket", []),
        "housingInventory": None,
        "nursingHomeGeocode": None,
        "seniorGrant": None,
        "homeImprovementProgram": None,
        "notes": src.get("notes", []) + [src.get("coverage_note")],
    }


def local_somerset() -> dict:
    housing = load_json(LOCAL / "somerset-senior-housing-inventory.json")
    geocode = load_json(LOCAL / "somerset-nursing-homes-geocode.json")
    senior_rows = [
        {
            "projectId": row.get("project_id"),
            "facility": row.get("facility"),
            "municipality": row.get("municipality"),
            "address": row.get("address"),
            "housingCategory": row.get("housing_category"),
            "livingType": row.get("living_type"),
            "housingType": row.get("housing_type"),
            "tenure": row.get("tenure"),
            "ageRestriction": row.get("age_restriction"),
            "incomeRestriction": row.get("income_restriction"),
            "program": row.get("program"),
            "affordableUnits": row.get("affordable_units"),
            "marketRateUnits": row.get("market_rate_units"),
            "phone": row.get("phone"),
        }
        for row in housing["records"]
    ]
    return {
        "kind": "COUNTY_RESOURCE",
        "notALicensedFacility": True,
        "sourceAsOf": "2023-05",
        "adrc": None,
        "seniorCenters": None,
        "otherServiceCenters": [],
        "congregateMealSites": None,
        "congregateMealSitesCoverage": None,
        "homeDeliveredMeals": [],
        "seniorCentersNotExtracted": None,
        "housingInventory": {
            "source": housing["source"],
            "serviceUrl": housing["service_url"],
            "grain": housing["grain"],
            "semantic": housing["semantic"],
            "sourceAsOfNote": housing["source_as_of_note"],
            "retrievedAt": housing["retrieved_at"],
            "totalRecords": housing["total_records"],
            "seniorRelatedRecordCount": housing["senior_related_record_count"],
            "categoryCounts": housing["category_counts"],
            "livingTypeCounts": housing["living_type_counts"],
            "ageRestrictionCounts": housing["age_restriction_counts"],
            "notCurrentNjdohLicensure": True,
            "notCmsDirectory": True,
            "notCertificateOfAuthorityRoster": True,
            "noNameOnlyMergeToNjdoh": True,
            "rows": senior_rows,
        },
        "nursingHomeGeocode": {
            "source": geocode["source"],
            "serviceUrl": geocode["service_url"],
            "grain": geocode["grain"],
            "semantic": geocode["semantic"],
            "retrievedAt": geocode["retrieved_at"],
            "count": len(geocode["records"]),
            "notNjdohLicenseRoster": True,
            "notCmsCareCompare": True,
            "rows": [
                {
                    "name": (row.get("name") or "").strip(),
                    "address": row.get("address"),
                    "municipality": row.get("municipality"),
                    "telephone": row.get("telephone"),
                }
                for row in geocode["records"]
            ],
        },
        "seniorGrant": None,
        "homeImprovementProgram": None,
        "notes": [
            "Somerset County Housing Options FeatureServer/0 is a May 2023 planning inventory, not current NJDOH licensure, CMS identity, or 2026 operating proof.",
            "Planning-inventory CCRC category is not the New Jersey CCRC Certificate of Authority roster.",
            "The 14 nursing-home geocode points are geographic/planning context only. They are not joined to NJDOH FacIDs by name.",
        ],
    }


def local_union() -> dict:
    src = load_json(LOCAL / "union-program-semantics.json")
    programs = {row["program_id"]: row for row in src["programs"]}
    grant = programs["union-senior-home-improvement-grant"]
    hip = programs["union-home-improvement-program"]
    adrc = src["adrc"]
    return {
        "kind": "COUNTY_RESOURCE",
        "notALicensedFacility": True,
        "sourceAsOf": grant["source_as_of"],
        "adrc": {
            "agency": adrc["office"],
            "phone": adrc["phone"],
            "tollFree": adrc["toll_free"],
            "adrcTollFree": adrc.get("adrc_toll_free"),
            "email": None,
            "address": None,
            "url": adrc["url"],
            "resourceDirectoryPdf": adrc.get("resource_directory_pdf"),
            "resourceDirectoryAsOf": adrc.get("resource_directory_as_of"),
            "informationPacketPdf": adrc.get("information_packet_pdf"),
            "informationPacketAsOf": adrc.get("information_packet_as_of"),
            "grain": adrc.get("grain"),
            "notAFacilityLicense": True,
        },
        "seniorCenters": None,
        "otherServiceCenters": [],
        "congregateMealSites": None,
        "congregateMealSitesCoverage": None,
        "homeDeliveredMeals": [],
        "seniorCentersNotExtracted": None,
        "housingInventory": None,
        "nursingHomeGeocode": None,
        "seniorGrant": {
            "programId": grant["program_id"],
            "programName": "Union County Senior Home Improvement Grant",
            "sourceUrl": grant["source_url"],
            "sourceAsOf": grant["source_as_of"],
            "benefitType": grant["benefit_type"],
            "benefitAmountPublished": grant["benefit_amount_published"],
            "ageRule": grant["age_rule"],
            "coverage": grant["coverage"],
            "attribution": (
                "According to the county's dated program information (2026-01-14), eligible Union "
                "County residents ages 62 and over may apply for a Senior Home Improvement Grant "
                "capped at $10,000 that does not have to be repaid, subject to the same "
                "income/property guidelines as the Home Improvement Program."
            ),
            "notGuaranteedEligibilityOrFunding": True,
            "notACountyLicense": True,
        },
        "homeImprovementProgram": {
            "programId": hip["program_id"],
            "programName": hip["program_name"],
            "sourceUrl": hip["source_url"],
            "sourceAsOf": hip["source_as_of"],
            "benefitType": hip["benefit_type"],
            "benefitAmountPublished": hip["benefit_amount_published"],
            "agingInPlaceNote": (
                "The general Home Improvement Program may be relevant for aging-in-place repairs. "
                "Program contractors are not county-licensed contractors."
            ),
            "notACountyLicense": True,
            "preferredEntityClass": hip["preferred_entity_class"],
        },
        "notes": [
            "Union County Senior Home Improvement Grant terms are as published on the county page dated 2026-01-14.",
            "A county aging program is not a licensed facility and not a guarantee of eligibility or current funding.",
        ],
    }


LOCAL_BUILDERS = {
    "Monmouth": local_monmouth,
    "Middlesex": local_middlesex,
    "Somerset": local_somerset,
    "Union": local_union,
}


def findings_for(name: str, njdoh: dict, pace: dict, local: dict) -> list[dict]:
    rows = [
        {
            "id": "njdoh-universes",
            "text": (
                f"NJDOH All_LTC lists {njdoh['ltc']} licensed identities in {name} County as of "
                f"{njdoh['ltcAsOf']}, including {njdoh['nfSnf']} SNF/NF and {njdoh['alr']} ALR. "
                f"All_Acute lists {njdoh['acute']} identities, including {njdoh['hha']} Home Health "
                f"Agency offices, {njdoh['hospiceProgram']} Hospice Programs, "
                f"{njdoh['hospiceBranch']} Hospice Branches, and {njdoh['hospiceInpatient']} "
                f"Hospice Inpatient identities. These universes are not combined into one "
                f"senior-provider total. Office/address county is not a service area."
            ),
        }
    ]
    if name == "Monmouth":
        rows.append(
            {
                "id": "adrc-centers",
                "text": (
                    "Monmouth County Division of Aging, Disabilities and Veterans Services is the "
                    "ADRC (732-431-7450). The county lists 12 senior centers and 3 other service "
                    "centers as of 2026-09-03. A listed center is a county resource, not a "
                    "licensed facility."
                ),
            }
        )
        rows.append(
            {
                "id": "meals",
                "text": (
                    "County meal resources include Interfaith Neighbors and Jewish Family & "
                    "Children's Service of Monmouth County (kosher meals). A listed nutrition "
                    "site is not a finding about any resident."
                ),
            }
        )
    elif name == "Middlesex":
        rows.append(
            {
                "id": "adrc-centers",
                "text": (
                    "Middlesex County Office of Aging and Disabled Services is the ADRC "
                    "(732-745-3295). Eight congregate meal sites from the official nutrition page "
                    "are complete. Twelve municipal senior centers were extracted from the "
                    "official HTML; additional municipalities on the same county page were not "
                    "extracted in this ticket and are labeled as coverage remaining."
                ),
            }
        )
    elif name == "Somerset":
        housing = local["housingInventory"]
        rows.append(
            {
                "id": "housing-options-58",
                "text": (
                    "Somerset County Housing Options FeatureServer/0 (May 2023 planning inventory) "
                    f"has {housing['seniorRelatedRecordCount']} senior-related records of "
                    f"{housing['totalRecords']}: Senior Residence "
                    f"{housing['categoryCounts']['Senior Residence']}, Assisted Living Facility "
                    f"{housing['categoryCounts']['Assisted Living Facility']}, Continuing Care "
                    "Retirement Community "
                    f"{housing['categoryCounts']['Continuing Care Retirement Community']}, and "
                    "Active Adult Community "
                    f"{housing['categoryCounts']['Active Adult Community']}. This is not current "
                    "NJDOH licensure, not a CMS directory, and not the CCRC Certificate of "
                    "Authority roster. Names are not merged to NJDOH identities."
                ),
            }
        )
        rows.append(
            {
                "id": "nursing-home-geocode",
                "text": (
                    f"{local['nursingHomeGeocode']['count']} county nursing-home geocode points "
                    "are geographic/planning context only. They are not an NJDOH license roster "
                    "and are not CMS Care Compare."
                ),
            }
        )
    elif name == "Union":
        rows.append(
            {
                "id": "senior-grant",
                "text": local["seniorGrant"]["attribution"]
                + " This is not a guarantee of eligibility or current funding beyond the source date.",
            }
        )
        rows.append(
            {
                "id": "adrc",
                "text": (
                    "Union County Division on Aging / ADRC (908-527-4870; toll-free 888-280-8226) "
                    "is the county aging resource. The May 2026 resource directory PDF is cited, "
                    "not copied. A county AAA directory is not a facility license."
                ),
            }
        )
    if pace["operatingCentersInCounty"]:
        center = next(c for c in pace["centersInCounty"] if c["status"] == "OPERATING")
        rows.append(
            {
                "id": "pace-operating",
                "text": (
                    f"{center['name']} is listed as OPERATING with a {name} County center address "
                    f"({center['city']}). Center address is not a service area. Operating is not "
                    "awarded."
                ),
            }
        )
    if pace["awardedOrInDevelopmentCentersInCounty"]:
        center = next(
            c
            for c in pace["centersInCounty"]
            if c["status"] in ("AWARDED", "IN_DEVELOPMENT")
        )
        rows.append(
            {
                "id": "pace-awarded",
                "text": (
                    f"{center['name']} is listed as {center['status']} with a {name} County "
                    "center address. Awarded/in-development is not operating. Center address is "
                    "not a service area."
                ),
            }
        )
    return rows


def source_families(name: str, pace: dict, local: dict) -> list[dict]:
    families = [
        {
            "id": "njdoh-all-ltc",
            "label": "NJDOH All_LTC licensed identities",
            "countySpecific": True,
            "grain": "licensed long-term-care facility identity located in the county",
        },
        {
            "id": "njdoh-all-acute",
            "label": "NJDOH All_Acute licensed identities",
            "countySpecific": True,
            "grain": "licensed acute-care facility identity; office county is not a service area",
        },
    ]
    if name in ("Monmouth", "Middlesex"):
        families.append(
            {
                "id": "county-aging-resources",
                "label": f"{name} County ADRC / senior centers / nutrition",
                "countySpecific": True,
                "grain": "county resource directory site, not a licensed facility",
            }
        )
    elif name == "Somerset":
        families.append(
            {
                "id": "somerset-housing-options",
                "label": "Somerset County Housing Options planning inventory",
                "countySpecific": True,
                "grain": "COUNTY_PLANNING_HOUSING_INVENTORY_POINT",
            }
        )
    elif name == "Union":
        families.append(
            {
                "id": "union-aging-grant",
                "label": "Union County ADRC and Senior Home Improvement Grant",
                "countySpecific": True,
                "grain": "county AAA program and dated grant terms, not a licensed facility",
            }
        )
    if pace["centersInCounty"]:
        families.append(
            {
                "id": "doas-pace",
                "label": "NJ DoAS PACE center geography",
                "countySpecific": True,
                "grain": "PACE center address county; not a service area",
            }
        )
    return families


def build_county(meta: dict, state: dict, inventory_rows: list[dict]) -> dict:
    name = meta["name"]
    slug = meta["slug"]
    county_row = next(row for row in state["counties"] if row["county"] == name)
    rows = [row for row in inventory_rows if row.get("county") == name]
    ltc_rows = [row for row in rows if row["source"] == "all_ltc"]
    acute_rows = [row for row in rows if row["source"] == "all_acute"]
    if len(ltc_rows) != county_row["ltc"] or len(acute_rows) != county_row["acute"]:
        raise SystemExit(
            f"{name} inventory/snapshot mismatch: ltc {len(ltc_rows)} vs {county_row['ltc']}, "
            f"acute {len(acute_rows)} vs {county_row['acute']}"
        )
    latest = state["staffing"]["trend"][-1]
    local = LOCAL_BUILDERS[name]()
    pace = pace_for(state, name)
    njdoh = {
        "ltc": county_row["ltc"],
        "acute": county_row["acute"],
        "nfSnf": county_row["nfSnf"],
        "alr": county_row["alr"],
        "cpch": county_row["cpch"],
        "alp": county_row["alp"],
        "hha": county_row["hha"],
        "hospiceProgram": county_row["hospiceProgram"],
        "hospiceBranch": county_row["hospiceBranch"],
        "hospiceInpatient": county_row["hospiceInpatient"],
        "inventoryRows": len(rows),
        "ltcAsOf": state["ltcAsOf"],
        "acuteAsOf": state["acuteAsOf"],
        "ltcByType": count_types(ltc_rows),
        "acuteByType": count_types(acute_rows),
        "caveat": (
            "All_LTC and All_Acute are different licensed universes. They are not added together "
            "and are not added to CMS. FacID is not a license number. Office/address county is "
            "not a service area."
        ),
    }
    finding_rows = findings_for(name, njdoh, pace, local)
    families = source_families(name, pace, local)
    local_family = any(row["countySpecific"] and row["id"] not in {"njdoh-all-ltc", "njdoh-all-acute", "doas-pace"} for row in families)
    indexable = len(families) >= 3 and local_family and len(finding_rows) >= 2
    if not indexable:
        raise SystemExit(f"{name} failed publication gate: families={len(families)} findings={len(finding_rows)}")
    snap = {
        "version": VERSION,
        "ticket": "NJ-SEN-COUNTY-001",
        "slug": slug,
        "path": f"/new-jersey/{slug}",
        "county": name,
        "countyFips": meta["fips"],
        "asOf": "2026-09-03",
        "stateSnapshotVersion": state["version"],
        "stateSnapshotFingerprint": STATE_FINGERPRINT,
        "stateAsOf": state["asOf"],
        "njdoh": njdoh,
        "cms": {
            "treatment": "STATEWIDE_OVERLAY_ONLY",
            "nursingHomesStatewide": state["cmsOverlay"]["nursingHomes"],
            "homeHealthStatewide": state["cmsOverlay"]["homeHealth"],
            "hospiceStatewide": state["cmsOverlay"]["hospice"],
            "asOf": state["cmsOverlay"]["asOf"],
            "source": state["cmsOverlay"]["source"],
            "countyCountPublished": None,
            "identityLinkage": "unavailable",
            "caveat": (
                "CMS overlay is statewide New Jersey geography. Exact NJDOH↔CMS CCN joins are not "
                "in this snapshot. County CMS counts are unknown, not zero. CMS directory is not "
                "an NJDOH identity join."
            ),
        },
        "enforcement": {
            "treatment": "STATEWIDE_EXACT_CONTEXT_ONLY",
            "indexedStatewide": state["enforcement"]["indexed"],
            "downloadedStatewide": state["enforcement"]["downloaded"],
            "uniqueHashesStatewide": state["enforcement"]["uniqueHashes"],
            "exactStatewide": state["enforcement"]["matchBuckets"]["EXACT"],
            "highConfidenceStatewide": state["enforcement"]["matchBuckets"]["HIGH_CONFIDENCE"],
            "reviewRequiredStatewide": state["enforcement"]["matchBuckets"]["REVIEW_REQUIRED"],
            "unsafeRejectedStatewide": state["enforcement"]["matchBuckets"]["UNSAFE_REJECTED"],
            "unresolvedStatewide": state["enforcement"]["matchBuckets"]["UNRESOLVED"],
            "exactFacilitiesStatewide": state["enforcement"]["exactFacilities"],
            "countyExactPublished": None,
            "identityLinkage": "partial",
            "caveat": (
                "Exact FacID/license county assignment is not in this snapshot. Unresolved, "
                "unsafe-rejected, and name-only matches are not county-assigned. Missing county "
                "enforcement is unknown, not a clean county. NOTICE/PENALTY/DPOC retain official "
                "action semantics."
            ),
        },
        "staffing": {
            "treatment": "STATEWIDE_CONTEXT_ONLY_NH",
            "latest": state["staffing"]["latest"],
            "first": state["staffing"]["first"],
            "populatedQuarters": state["staffing"]["populatedQuarters"],
            "statewideDayRn": latest["dayRn"],
            "statewideDayLpn": latest["dayLpn"],
            "statewideDayCna": latest["dayCna"],
            "statewideReportingFacilities": latest["facilities"],
            "countyAggregatePublished": None,
            "semantics": state["staffing"]["semantics"],
            "notAttachedTo": list(state["staffing"]["notAttachedTo"]),
            "caveat": (
                "Official values are 1RN:#Res / 1LPN:#Res / 1CNA:#Res (residents per one staff "
                "member). A higher ratio means more residents per staff. Staffing is nursing-home "
                "/ relevant facility only and is not copied to AL, HHA, Hospice, PACE, or CCRC. "
                "County aggregate is omitted because source-native county numerators and "
                "denominators are not in the public snapshot. Missing is not zero. No staffing score."
            ),
        },
        "medicaid": {
            "treatment": "STATEWIDE_SCHEDULE_ONLY",
            "listedRowsStatewide": state["medicaid"]["listedRows"],
            "minRate": state["medicaid"]["minRate"],
            "maxRate": state["medicaid"]["maxRate"],
            "fiscalYear": state["medicaid"]["fiscalYear"],
            "effectiveOn": state["medicaid"]["effectiveOn"],
            "source": state["medicaid"]["source"],
            "countyListedRowsPublished": None,
            "caveat": (
                "Schedule rows are name/subtype/rate only. County identity coverage is incomplete, "
                "not zero. A listed rate is not Medicaid participation and is not a quality score. "
                "Name-only rows are not assigned to a county."
            ),
        },
        "pace": pace,
        "ccrc": {
            "coverage": state["ccrc"]["coverage"],
            "countPublished": None,
            "caveat": (
                "Missing CCRC Certificate of Authority roster is unknown, not zero CCRCs. "
                "Somerset planning-inventory CCRC points are not that roster."
            ),
        },
        "localResources": local,
        "sourceFamilies": families,
        "findings": finding_rows,
        "gaps": [
            "County CMS CCN counts are not published without an exact NJDOH join.",
            "County exact enforcement counts are not published without FacID county assignment in this snapshot.",
            "County staffing averages are omitted without source-native county numerators and denominators.",
            "Medicaid listed rates are not county-assigned from name-only rows.",
            "Home Health and Hospice office county is not a service area.",
            "CCRC Certificate of Authority roster remains SOURCE_AVAILABLE_BY_REQUEST.",
        ],
        "sourceClocks": {
            "njdohLtc": state["ltcAsOf"],
            "njdohAcute": state["acuteAsOf"],
            "stateSnapshot": state["asOf"],
            "cmsOverlay": state["cmsOverlay"]["asOf"],
            "medicaid": state["medicaid"]["effectiveOn"],
            "staffingLatest": state["staffing"]["latest"],
            "localResources": local["sourceAsOf"],
            "countyResearch": "2026-09-03",
        },
        "publicationGate": {
            "indexable": True,
            "sourceFamilyCount": len(families),
            "countySpecificLocalSource": True,
            "findingCount": len(finding_rows),
            "deterministicSnapshot": True,
            "thinStateCopy": False,
        },
        "disclaimers": [
            "SeniorTrustHub does not rank facilities and does not publish a Trust Score.",
            "There is no Verified by New Jersey badge.",
            "COUNTY RESOURCE is not a LICENSED FACILITY.",
            "PLANNING HOUSING INVENTORY is not an NJDOH LICENSE.",
            "CMS DIRECTORY is not an NJDOH identity join.",
        ],
    }
    snap["fingerprint"] = fingerprint(snap)
    return snap


def write_ts(snapshots: dict[str, dict]) -> None:
    body = json.dumps(snapshots, indent=2, ensure_ascii=True)
    TS_OUT.write_text(
        "/** Generated by scripts/build-nj-county-snapshots.py. Do not edit by hand. */\n"
        "export const NJ_COUNTY_PUBLIC_SNAPSHOTS = "
        + body
        + " as const;\n",
        encoding="utf-8",
    )


def main() -> None:
    state = load_json(STATE_ARTIFACT)
    if state["fingerprint"] != STATE_FINGERPRINT:
        raise SystemExit("NJ-SEN-005 fingerprint drifted; refuse to build county snapshots")
    inventory = load_json(INVENTORY)
    snapshots = {}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    for meta in COUNTIES:
        snap = build_county(meta, state, inventory["rows"])
        snapshots[meta["slug"]] = snap
        rendered = json.dumps(snap, indent=2, ensure_ascii=True) + "\n"
        (OUT_DIR / f"{meta['slug']}.json").write_text(rendered, encoding="utf-8")
        (ARTIFACT_DIR / f"{meta['slug']}.json").write_text(rendered, encoding="utf-8")
        print(f"{meta['slug']} fingerprint {snap['fingerprint']}")
        print(
            f"  ltc={snap['njdoh']['ltc']} acute={snap['njdoh']['acute']} "
            f"families={snap['publicationGate']['sourceFamilyCount']} "
            f"findings={snap['publicationGate']['findingCount']}"
        )
    write_ts(snapshots)
    print(f"wrote {TS_OUT}")


if __name__ == "__main__":
    main()
