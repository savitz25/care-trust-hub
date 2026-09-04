#!/usr/bin/env python3
"""AZ-SEN-001 — ADHS GIS + CMS Arizona overlays; deterministic snapshot.

Allowed: ArcGIS REST, CMS Provider Data Catalog, official HTML.
Forbidden: AZ Care Check scrape, legacy provider-search crawl, PDF-by-PDF, city/county pages.
"""

from __future__ import annotations

import hashlib
import json
import ssl
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

UA = "SeniorTrustHub-AZ-SEN-001/1.0 (research; official bulk only; no AZ Care Check scrape)"
CTX = ssl.create_default_context()
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "arizona"
ART = ROOT / "artifacts"
DOMAIN = ROOT / "packages" / "domain" / "src"
GIS_JSON = RAW / "adhs-gis-licensed-facilities.json"
NATIONAL = ROOT / "apps" / "web" / "src" / "data" / "senior-national-intelligence.json"
CMS_Q = "https://data.cms.gov/provider-data/api/1/datastore/query/{id}/0"
CMS_META = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/{id}?show-reference-ids=true"
CMS_DATASETS = {"nh": "4pq5-n9py", "hha": "6jpm-sxkc", "hospice": "yc9t-dgbk"}
GIS_LAYER = (
    "https://services1.arcgis.com/mpVYz37anSdrK4d8/ArcGIS/rest/services/"
    "All_State_Licensed_Facilities_in_Arizona/FeatureServer/18"
)
CORE_TYPES = {
    "ASSISTED LIVING HOME": "al_home",
    "ASSISTED LIVING CENTER": "al_center",
    "ADULT FOSTER CARE": "afc",
    "ADULT DAY HEALTH CARE": "adhc",
    "NURSING HOME (NH)": "nh",
    "HOME HEALTH AGENCY": "hha",
    "HOSPICE": "hospice",
}


def fetch(url: str, data: bytes | None = None, timeout: int = 180) -> tuple[int, bytes]:
    req = urllib.request.Request(
        url, data=data, headers={"User-Agent": UA, "Accept": "application/json,*/*"}
    )
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            return resp.status, resp.read()
    except Exception as e:  # noqa: BLE001
        return 0, str(e).encode()


def get_json(url: str, payload: dict | None = None, timeout: int = 180) -> object:
    data = json.dumps(payload).encode() if payload is not None else None
    st, body = fetch(url, data=data, timeout=timeout)
    if st != 200:
        return {"_http": st, "_snippet": body[:400].decode("utf-8", "replace")}
    try:
        return json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        return {"_http": st, "_snippet": body[:400].decode("utf-8", "replace")}


def sha256_obj(obj: object) -> str:
    blob = json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(blob).hexdigest()


def nonempty(v: object) -> bool:
    if v is None:
        return False
    s = str(v).strip()
    return bool(s) and s.upper() not in {"NULL", "NONE", "NA", "N/A"}


def pad_ccn(raw: object) -> str | None:
    if not nonempty(raw):
        return None
    s = str(raw).strip().removesuffix(".0")
    if s.replace(".", "", 1).isdigit():
        s = str(int(float(s)))
        return s.zfill(6)
    return s


def epoch_ms_to_date(v: object) -> str | None:
    if v is None or v == "":
        return None
    try:
        ms = int(v)
        if ms > 10_000_000_000:
            ms = ms // 1000
        return datetime.fromtimestamp(ms, tz=timezone.utc).strftime("%Y-%m-%d")
    except (TypeError, ValueError, OSError):
        return str(v)[:10]


def load_gis() -> list[dict]:
    payload = json.loads(GIS_JSON.read_text(encoding="utf-8"))
    return payload.get("rows") or []


def profile_class(rows: list[dict]) -> dict:
    licenses: set[str] = set()
    facids: set[str] = set()
    names: set[str] = set()
    status = Counter()
    counties = Counter()
    cities = Counter()
    subtypes = Counter()
    phone = address = capacity_n = 0
    capacity_sum = 0
    medicare = 0
    for r in rows:
        lic = str(r.get("LICENSE_NUMBER") or "").strip()
        fac = str(r.get("FACID") or "").strip()
        name = str(r.get("FACILITY_NAME") or "").strip().upper()
        if lic:
            licenses.add(lic)
        if fac:
            facids.add(fac)
        if name:
            names.add(name)
        status[str(r.get("OPERATION_STATUS") or "").strip() or "UNKNOWN"] += 1
        counties[str(r.get("COUNTY") or "").strip() or "UNKNOWN"] += 1
        cities[str(r.get("CITY") or "").strip() or "UNKNOWN"] += 1
        subtypes[str(r.get("SUBTYPE") or "").strip() or "UNKNOWN"] += 1
        if nonempty(r.get("Telephone")):
            phone += 1
        if nonempty(r.get("ADDRESS")):
            address += 1
        if pad_ccn(r.get("MEDICARE_ID")):
            medicare += 1
        cap = r.get("CAPACITY_INT")
        if cap not in (None, "", 0):
            try:
                capacity_n += 1
                capacity_sum += int(cap)
            except (TypeError, ValueError):
                pass
    return {
        "rows": len(rows),
        "unique_license": len(licenses),
        "unique_facid": len(facids),
        "unique_names": len(names),
        "status": dict(status.most_common()),
        "subtypes": dict(subtypes.most_common()),
        "phone_nonempty": phone,
        "address_nonempty": address,
        "capacity_nonempty": capacity_n,
        "capacity_sum": capacity_sum,
        "medicare_id_nonempty": medicare,
        "distinct_counties": len([k for k in counties if k and k != "UNKNOWN"]),
        "county": dict(counties.most_common()),
        "licenses": sorted(licenses),
        "medicare_ids": sorted(
            {m for r in rows if (m := pad_ccn(r.get("MEDICARE_ID")))}
        ),
    }


def cms_query_az(dataset_id: str, limit: int = 1500) -> tuple[list[dict], dict]:
    meta = get_json(CMS_META.format(id=dataset_id), timeout=60)
    title = meta.get("title") if isinstance(meta, dict) else None
    modified = meta.get("modified") if isinstance(meta, dict) else None
    schema_probe = get_json(
        CMS_Q.format(id=dataset_id),
        {"limit": 1, "offset": 0, "results": True, "count": True},
        timeout=90,
    )
    properties: list[str] = []
    if isinstance(schema_probe, dict) and schema_probe.get("results"):
        properties = list(schema_probe["results"][0].keys())
    state_field = None
    lower = {p.lower(): p for p in properties}
    for k in ("state", "provider_state", "providerstate"):
        if k in lower:
            state_field = lower[k]
            break
    info: dict = {
        "dataset_id": dataset_id,
        "title": title,
        "modified": modified,
        "state_field": state_field,
        "properties_sample": properties[:40],
    }
    rows: list[dict] = []
    if not state_field:
        info["error"] = "state field not found"
        return rows, info
    offset = 0
    while True:
        print(f"cms {dataset_id} offset={offset}", flush=True)
        data = get_json(
            CMS_Q.format(id=dataset_id),
            {
                "conditions": [
                    {"property": state_field, "operator": "=", "value": "AZ"}
                ],
                "limit": limit,
                "offset": offset,
                "results": True,
                "count": True,
            },
            timeout=180,
        )
        if not isinstance(data, dict) or data.get("_http"):
            info["error"] = data
            break
        batch = data.get("results") or []
        if offset == 0:
            info["az_count_reported"] = data.get("count")
        rows.extend(batch)
        if not batch:
            break
        offset += len(batch)
        reported = data.get("count")
        if reported is not None and offset >= int(reported):
            break
        if len(batch) < limit:
            break
    info["az_rows"] = len(rows)
    return rows, info


def cms_unique(rows: list[dict]) -> tuple[set[str], str | None]:
    if not rows:
        return set(), None
    keys = list(rows[0].keys())
    ccn_field = None
    for cand in (
        "cms_certification_number_ccn",
        "ccn",
        "provider_id",
        "cms_certification_number",
        "CMS Certification Number (CCN)",
        "federal_provider_number",
    ):
        if cand in keys:
            ccn_field = cand
            break
    if ccn_field is None:
        for k in keys:
            lk = k.lower()
            if "ccn" in lk or lk in {"provider_id", "federal_provider_number"}:
                ccn_field = k
                break
    out: set[str] = set()
    if not ccn_field:
        return out, None
    for r in rows:
        v = pad_ccn(r.get(ccn_field))
        if v:
            out.add(v)
    return out, ccn_field


def json_to_ts(obj: object) -> str:
    return (
        "/** Generated from artifacts/az-sen-001-public-snapshot.json. Do not edit by hand. */\n"
        "export const AZ_PUBLIC_SNAPSHOT = "
        + json.dumps(obj, indent=2)
        + " as const;\n"
    )


def main() -> int:
    retrieved = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = load_gis()
    print("gis rows", len(rows), flush=True)
    run_dates = Counter(epoch_ms_to_date(r.get("RUN_DATE")) for r in rows)
    gis_run = run_dates.most_common(1)[0][0] if run_dates else None
    by_type: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_type[str(r.get("TYPE") or "").strip() or "UNKNOWN"].append(r)

    classes = {
        key: profile_class(by_type.get(label, [])) for label, key in CORE_TYPES.items()
    }
    # drop bulky license lists from published class objects; keep counts
    class_pub = {}
    for key, prof in classes.items():
        class_pub[key] = {
            k: v for k, v in prof.items() if k not in {"licenses", "medicare_ids"}
        }

    al_home = classes["al_home"]
    al_center = classes["al_center"]
    afc = classes["afc"]
    adhc = classes["adhc"]
    state_nh = classes["nh"]
    state_hha = classes["hha"]
    state_hospice = classes["hospice"]

    county_table = []
    counties = sorted(
        {
            str(r.get("COUNTY") or "").strip()
            for r in rows
            if str(r.get("TYPE") or "").strip() in CORE_TYPES
        }
    )
    for county in counties:
        if not county:
            continue
        rec = {"county": county}
        for label, key in CORE_TYPES.items():
            rec[key] = sum(
                1
                for r in by_type.get(label, [])
                if str(r.get("COUNTY") or "").strip() == county
            )
        county_table.append(rec)
    county_table.sort(
        key=lambda r: -(r["al_home"] + r["al_center"] + r["afc"] + r["nh"])
    )

    national = json.loads(NATIONAL.read_text(encoding="utf-8"))
    az_geo = next(
        (g for g in national.get("geography") or [] if g.get("state") == "AZ"), {}
    )
    sources = {s.get("datasetKey"): s for s in national.get("sources") or []}

    def clock(key: str) -> dict:
        s = sources.get(key) or {}
        return {
            "datasetKey": key,
            "officialUrl": s.get("officialUrl"),
            "sourceModifiedAt": s.get("sourceModifiedAt"),
            "retrievedAt": s.get("retrievedAt"),
            "sourcePeriod": s.get("sourcePeriod"),
        }

    cms_sets: dict[str, set[str]] = {}
    cms_info: dict[str, dict] = {}
    for name, ds in CMS_DATASETS.items():
        cms_rows, info = cms_query_az(ds)
        ids, field = cms_unique(cms_rows)
        info["ccn_field"] = field
        info["unique_ccn"] = len(ids)
        cms_sets[name] = ids
        cms_info[name] = {k: v for k, v in info.items() if k != "error" or v}
        print(name, "unique", len(ids), flush=True)

    nh_state_ccn = set(state_nh["medicare_ids"])
    hha_state_ccn = set(state_hha["medicare_ids"])
    hosp_state_ccn = set(state_hospice["medicare_ids"])

    def xwalk(state_ids: set[str], cms_ids: set[str]) -> dict:
        return {
            "attempted": True,
            "method": "exact padded MEDICARE_ID ∩ CMS CCN; name and city are not used",
            "state_native_ccns": len(state_ids),
            "cms_az_ccns": len(cms_ids),
            "exact_matches": len(state_ids & cms_ids),
            "unmatched_state": len(state_ids - cms_ids),
            "unmatched_cms": len(cms_ids - state_ids),
            "note": "No name/city join. ADHS != CMS. Unmatched remain unmatched.",
        }

    core_state_ids = set()
    for key in ("al_home", "al_center", "afc", "adhc", "nh", "hha", "hospice"):
        core_state_ids.update(classes[key]["licenses"])

    phone_all = sum(1 for r in rows if nonempty(r.get("Telephone")))
    addr_all = sum(1 for r in rows if nonempty(r.get("ADDRESS")))
    email_all = 0
    web_all = 0

    snapshot = {
        "version": "senior-az-state-intel-v1",
        "asOf": retrieved[:10],
        "retrievedAt": retrieved,
        "ticket": "AZ-SEN-001",
        "regulatorMap": {
            "agency": "Arizona Department of Health Services",
            "division": "Division of Licensing Services / Public Health Licensing",
            "bureaus": {
                "assistedLiving": {
                    "name": "Bureau of Assisted Living Facilities Licensing (BALF)",
                    "classes": [
                        "Assisted Living Home",
                        "Assisted Living Center",
                        "Adult Foster Care",
                        "Adult Day Health Care",
                    ],
                    "url": "https://www.azdhs.gov/licensing/residential-facilities/index.php",
                },
                "longTermCare": {
                    "name": "Bureau of Long-Term Care Facilities Licensing",
                    "classes": [
                        "Nursing Home (NH)",
                        "Nursing-supported group homes",
                        "ICF/IID",
                    ],
                    "url": "https://www.azdhs.gov/licensing/long-term-care/index.php",
                },
                "medicalFacilities": {
                    "name": "Bureau of Medical Facilities Licensing",
                    "classes": [
                        "Home Health Agency",
                        "Hospice service agency",
                        "Hospice inpatient facility",
                    ],
                    "url": "https://www.azdhs.gov/licensing/medical-facilities/index.php",
                },
            },
            "officialHub": "https://www.azdhs.gov/licensing/",
            "monthlyTables": "https://www.azdhs.gov/licensing/index.php#databases",
            "verifyAzCareCheck": "https://azcarecheck.azdhs.gov/",
            "gisHub": "https://geodata-adhsgis.hub.arcgis.com/",
            "scrape": "FORBIDDEN",
            "classes": [
                {
                    "code": "ALH",
                    "officialName": "Assisted Living Home",
                    "publication_class": "CORE_SENIOR",
                    "directory": "PUBLIC_CORE",
                    "profile_publication": "STATE_DIRECTORY_ONLY",
                    "count": al_home["rows"],
                    "note": "Ten or fewer residents (A.R.S. § 36-401). AL Home != AL Center != Nursing Home.",
                },
                {
                    "code": "ALC",
                    "officialName": "Assisted Living Center",
                    "publication_class": "CORE_SENIOR",
                    "directory": "PUBLIC_CORE",
                    "profile_publication": "STATE_DIRECTORY_ONLY",
                    "count": al_center["rows"],
                    "note": "Eleven or more residents. Not collapsed into Assisted Living Home.",
                },
                {
                    "code": "AFC",
                    "officialName": "Adult Foster Care",
                    "publication_class": "CORE_SENIOR",
                    "directory": "PUBLIC_CORE",
                    "profile_publication": "STATE_DIRECTORY_ONLY",
                    "count": afc["rows"],
                    "note": "Separate BALF class. AFC != AL Home != Nursing Home.",
                },
                {
                    "code": "ADHC",
                    "officialName": "Adult Day Health Care",
                    "publication_class": "ADJACENT_RELEVANT",
                    "directory": "PUBLIC_CORE",
                    "profile_publication": "MARKET_INTELLIGENCE_ONLY",
                    "count": adhc["rows"],
                    "note": "Non-residential adult day health. Not added to residential facility counts.",
                },
                {
                    "code": "NH",
                    "officialName": "Nursing Home (NH)",
                    "publication_class": "CORE_SENIOR",
                    "directory": "PUBLIC_CORE",
                    "profile_publication": "STATE_DIRECTORY_ONLY",
                    "count": state_nh["rows"],
                    "note": "ADHS state license. CMS certification is a separate identity.",
                },
                {
                    "code": "HHA",
                    "officialName": "Home Health Agency",
                    "publication_class": "CORE_SENIOR",
                    "directory": "PUBLIC_CORE",
                    "profile_publication": "STATE_DIRECTORY_ONLY",
                    "count": state_hha["rows"],
                    "note": "State license != CMS Home Health certification. Office address != service area.",
                },
                {
                    "code": "HOSPICE",
                    "officialName": "Hospice",
                    "publication_class": "CORE_SENIOR",
                    "directory": "PUBLIC_CORE",
                    "profile_publication": "STATE_DIRECTORY_ONLY",
                    "count": state_hospice["rows"],
                    "note": "Includes hospice service agencies and inpatient facilities in TYPE=HOSPICE. Hospice != Home Health.",
                },
                {
                    "code": "NSGH",
                    "officialName": "Nursing-supported group homes",
                    "publication_class": "ADJACENT_RELEVANT",
                    "directory": "INTERNAL_ONLY",
                    "profile_publication": "MARKET_INTELLIGENCE_ONLY",
                    "count": len(by_type.get("NURSING SUPPORTED GROUP HOMES", [])),
                    "note": "Not a consumer Assisted Living / Nursing Home tile.",
                },
                {
                    "code": "ICF_IID",
                    "officialName": "Intermediate Care Facility for Intellectually Disabled",
                    "publication_class": "ADJACENT_RELEVANT",
                    "directory": "INTERNAL_ONLY",
                    "profile_publication": "MARKET_INTELLIGENCE_ONLY",
                    "count": len(
                        by_type.get(
                            "INTERMEDIATE CARE FACILITY FOR INTELLECTUALLY DISABLED", []
                        )
                    ),
                    "note": "Not merged into Nursing Home counts.",
                },
                {
                    "code": "DD_GROUP_HOME",
                    "officialName": "Developmentally Disabled Group Home",
                    "publication_class": "EXCLUDED",
                    "directory": "INTERNAL_ONLY",
                    "profile_publication": "INTERNAL_ONLY",
                    "count": len(
                        by_type.get("DEVELOPMENTALLY DISABLED GROUP HOME", [])
                    ),
                    "note": "Not a SeniorTrustHub core senior-care class.",
                },
                {
                    "code": "BH_RESIDENTIAL",
                    "officialName": "Behavioral Health Residential Facility",
                    "publication_class": "EXCLUDED",
                    "directory": "INTERNAL_ONLY",
                    "profile_publication": "INTERNAL_ONLY",
                    "count": len(
                        by_type.get("BEHAVIORAL HEALTH RESIDENTIAL FACILITY", [])
                    ),
                    "note": "Behavioral-health residential is excluded from senior-care core.",
                },
                {
                    "code": "CHILD_CARE",
                    "officialName": "Child Care Center / Group Home",
                    "publication_class": "EXCLUDED",
                    "directory": "INTERNAL_ONLY",
                    "profile_publication": "INTERNAL_ONLY",
                    "count": len(by_type.get("Child Care Center", []))
                    + len(by_type.get("Child Care Group Home", [])),
                    "note": "Child care is not senior care.",
                },
            ],
        },
        "adhsMonthlyTables": {
            "declaredUrl": "https://www.azdhs.gov/licensing/index.php#databases",
            "refreshRule": "ADHS states tables update on the first business day of the month; run date is inside each file.",
            "access": "SOURCE_NOT_ACQUIRED",
            "reason": "Current HTML has no CSV/XLSX/ZIP download links after LMS migration. Legacy provider search is not scraped.",
            "lmsNote": "ADHS warns some active facilities may be omitted from reports due to licensing-management-system migration.",
        },
        "adhsGis": {
            "source_url": GIS_LAYER,
            "service_description_clock": "February 2025",
            "run_date": gis_run,
            "run_date_distribution": dict(run_dates),
            "rows": len(rows),
            "identity": "AZ-ADHS:{LICENSE_NUMBER}",
            "secondary_id": "FACID",
            "grain": "one GIS feature = one licensed facility location on the extract",
            "types": {
                k: len(v)
                for k, v in sorted(by_type.items(), key=lambda kv: -len(kv[1]))
            },
            "status": dict(
                Counter(
                    str(r.get("OPERATION_STATUS") or "").strip() for r in rows
                ).most_common()
            ),
            "contacts": {
                "phone_field": "Telephone",
                "phone_nonempty": phone_all,
                "address_field": "ADDRESS",
                "address_nonempty": addr_all,
                "email_field": None,
                "email_nonempty": email_all,
                "website_field": None,
                "website_nonempty": web_all,
                "provenance": {
                    "phone": "AZ_ADHS_FACILITY_PHONE",
                    "address": "AZ_ADHS_FACILITY_ADDRESS",
                },
                "note": "No internet enrichment. Administrator/person fields are not on this GIS layer.",
            },
            "limitation": "GIS extract RUN_DATE is 2025-02-03. It is official ADHS bulk, not the September 2026 monthly Excel table.",
        },
        "assistedLivingHomes": {
            **class_pub["al_home"],
            "identity": "AZ-ADHS:{LICENSE_NUMBER}",
            "profile_publication": "STATE_DIRECTORY_ONLY",
            "note": "Assisted Living Home != Assisted Living Center. License row != unique organization unless proven.",
        },
        "assistedLivingCenters": {
            **class_pub["al_center"],
            "identity": "AZ-ADHS:{LICENSE_NUMBER}",
            "profile_publication": "STATE_DIRECTORY_ONLY",
            "note": "Eleven or more residents. Not added to Homes.",
        },
        "adultFosterCare": {
            **class_pub["afc"],
            "identity": "AZ-ADHS:{LICENSE_NUMBER}",
            "profile_publication": "STATE_DIRECTORY_ONLY",
            "note": "Meaningful small state-only senior-care universe. AFC != Nursing Home.",
        },
        "adultDayHealth": {
            **class_pub["adhc"],
            "identity": "AZ-ADHS:{LICENSE_NUMBER}",
            "profile_publication": "MARKET_INTELLIGENCE_ONLY",
            "publication_class": "ADJACENT_RELEVANT",
            "note": "Non-residential. Not combined with AL Home/Center.",
        },
        "stateNursingHomes": {
            **class_pub["nh"],
            "identity": "AZ-ADHS:{LICENSE_NUMBER}",
            "federal_id_field": "MEDICARE_ID",
            "profile_publication": "STATE_DIRECTORY_ONLY",
            "note": "State license != CMS CCN. Exact MEDICARE_ID join only.",
        },
        "stateHomeHealth": {
            **class_pub["hha"],
            "identity": "AZ-ADHS:{LICENSE_NUMBER}",
            "federal_id_field": "MEDICARE_ID",
            "note": "HOME HEALTH OFFICE ADDRESS != SERVICE AREA.",
        },
        "stateHospice": {
            **class_pub["hospice"],
            "identity": "AZ-ADHS:{LICENSE_NUMBER}",
            "federal_id_field": "MEDICARE_ID",
            "subtypes": class_pub["hospice"]["subtypes"],
            "note": "HOSPICE != HOME HEALTH. Service agency and inpatient remain under TYPE=HOSPICE with native SUBTYPE.",
        },
        "cmsOverlay": {
            "nursingHomes": az_geo.get("nursingHomes"),
            "homeHealth": az_geo.get("homeHealth"),
            "hospice": az_geo.get("hospice"),
            "source": "senior-national-intelligence.json geography AZ (CMS class directories)",
            "asOf": str(national.get("generatedAt") or "")[:10],
            "nationalFingerprint": national.get("sourceFingerprint"),
            "clocks": {
                "nursingHomes": clock("nursing-home-provider-information"),
                "homeHealth": clock("home-health-care-agencies"),
                "hospice": clock("hospice-general-information"),
                "ownership": clock("skilled-nursing-facility-all-owners"),
                "penalties": clock("nursing-home-penalties"),
                "staffing": clock("payroll-based-journal-daily-nurse-staffing")
                or clock("nursing-home-staffing"),
            },
            "liveDirectoryAzUniqueCcn": {
                "nursingHomes": len(cms_sets.get("nh", set())),
                "homeHealth": len(cms_sets.get("hha", set())),
                "hospice": len(cms_sets.get("hospice", set())),
            },
            "query": {
                k: {ik: iv for ik, iv in v.items() if ik != "properties_sample"}
                for k, v in cms_info.items()
            },
            "nationalCoverage": national.get("nursingHome", {}).get("coverage"),
            "note": "CMS class overlays are independent of ADHS GIS row counts and are not summed. CMS CERTIFIED != STATE LICENSED.",
        },
        "preIngestBaseline": {
            "cmsNursingHomeCcns": az_geo.get("nursingHomes"),
            "cmsHomeHealthCcns": az_geo.get("homeHealth"),
            "cmsHospiceCcns": az_geo.get("hospice"),
            "stateAssistedLivingHome": 0,
            "stateAssistedLivingCenter": 0,
            "stateAdultFosterCare": 0,
            "stateAdultDayHealth": 0,
            "stateNursingHomeIdentities": 0,
            "note": "CMS Arizona CCNs already live in the national graph (senior-network-metrics-v1 / senior-hub-intel). No Arizona ADHS state-license identities existed in SeniorTrustHub before this ticket. CA/NY/TX assisted-living pilots do not include Arizona.",
        },
        "crosswalk": {
            "alHomeToCmsNh": {
                "attempted": False,
                "reason": "Assisted Living Home is not a CMS Nursing Home class. Name/address join is forbidden.",
            },
            "alCenterToCmsNh": {
                "attempted": False,
                "reason": "Assisted Living Center is not a CMS Nursing Home class.",
            },
            "afcToCmsNh": {
                "attempted": False,
                "reason": "Adult Foster Care is not a CMS Nursing Home class.",
            },
            "stateNhToCmsNh": xwalk(nh_state_ccn, cms_sets.get("nh", set())),
            "stateHhaToCmsHha": xwalk(hha_state_ccn, cms_sets.get("hha", set())),
            "stateHospiceToCmsHospice": xwalk(
                hosp_state_ccn, cms_sets.get("hospice", set())
            ),
        },
        "azCareCheck": {
            "AZ_CARE_CHECK": "OPEN_SEARCH_ONLY",
            "url": "https://azcarecheck.azdhs.gov/",
            "result": "Interactive search (facility/provider name, address, license type, status). No CSV/API/JSON bulk found this ticket.",
            "scrape": "FORBIDDEN",
            "note": "Licensing history, deficiencies, and enforcement may appear on a facility detail page. Missing bulk != zero enforcement.",
        },
        "enforcement": {
            "state": {
                "result": "NO_BULK_ACQUIRED",
                "access": "AZ Care Check SEARCH_ONLY; ADHS metadata describes applicant/licensee/complaint/survey data inside LMS, not a public bulk file",
                "note": "Complaint != violation. Survey != quality score. Deficiency != quality rank. Name-only attach is UNSAFE. No action found != clean record.",
            },
            "cms": {
                "result": "REUSED_NATIONAL_EXACT_CCN",
                "note": "Nursing Home inspection, deficiency, penalty, staffing, and ownership stay on existing exact-CCN national architecture.",
            },
        },
        "ownership": {
            "cmsNursingHome": "Reuse existing SeniorTrustHub CMS ownership graph on exact CCN.",
            "adhs": "GIS layer has facility name, not a licensee/operator/owner entity field. AZ Care Check shows Owner/Licensee on interactive detail pages (not bulk). Do not infer ownership across facilities by name. ADHS licensee != CMS owner unless exact source establishes it.",
        },
        "geography": {
            "grain": "COUNTY on the GIS record is a facility address county, not a service area.",
            "county_table": county_table,
            "no_county_routes": True,
        },
        "publicationDecisions": {
            "ASSISTED_LIVING_HOME": "STATE_DIRECTORY_ONLY",
            "ASSISTED_LIVING_CENTER": "STATE_DIRECTORY_ONLY",
            "ADULT_FOSTER_CARE": "STATE_DIRECTORY_ONLY",
            "ADULT_DAY_HEALTH": "MARKET_INTELLIGENCE_ONLY",
            "rationale": "Exact LICENSE_NUMBER, public facility identity, phone/address, and GIS refreshability exist, but minting thousands of Arizona profile routes is not required. State page tables plus AZ Care Check and CMS CCN routes are enough.",
        },
        "expansionLedger": {
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_STATE_IDENTITIES": len(core_state_ids),
            "EXISTING_ORGANIZATIONS_ENRICHED": xwalk(
                nh_state_ccn, cms_sets.get("nh", set())
            )["exact_matches"]
            + xwalk(hha_state_ccn, cms_sets.get("hha", set()))["exact_matches"]
            + xwalk(hosp_state_ccn, cms_sets.get("hospice", set()))["exact_matches"],
            "NEW_EVIDENCE_ROWS": al_home["rows"]
            + al_center["rows"]
            + afc["rows"]
            + adhc["rows"]
            + state_nh["rows"]
            + state_hha["rows"]
            + state_hospice["rows"],
            "note": "CMS Arizona CCNs already in the national graph are not net-new organizations. Exact state↔CMS crosswalk is not a new organization. STATE_DIRECTORY_ONLY means AL/AFC identities are measured as state identities, not minted as thousands of canonical profile routes.",
            "byClass": {
                "assistedLivingHome": {
                    "existingBefore": 0,
                    "sourceIdentitiesNow": al_home["unique_license"],
                    "netNewStateIdentities": al_home["unique_license"],
                    "promotedCanonicalOrganizations": 0,
                    "enrichedExistingOrganizations": 0,
                },
                "assistedLivingCenter": {
                    "existingBefore": 0,
                    "sourceIdentitiesNow": al_center["unique_license"],
                    "netNewStateIdentities": al_center["unique_license"],
                    "promotedCanonicalOrganizations": 0,
                    "enrichedExistingOrganizations": 0,
                },
                "adultFosterCare": {
                    "existingBefore": 0,
                    "sourceIdentitiesNow": afc["unique_license"],
                    "netNewStateIdentities": afc["unique_license"],
                    "promotedCanonicalOrganizations": 0,
                    "enrichedExistingOrganizations": 0,
                },
                "adultDayHealth": {
                    "existingBefore": 0,
                    "sourceIdentitiesNow": adhc["unique_license"],
                    "netNewStateIdentities": adhc["unique_license"],
                    "promotedCanonicalOrganizations": 0,
                    "enrichedExistingOrganizations": 0,
                },
                "stateNursingHome": {
                    "existingBefore": 0,
                    "sourceIdentitiesNow": state_nh["unique_license"],
                    "netNewStateIdentities": state_nh["unique_license"],
                    "promotedCanonicalOrganizations": 0,
                    "enrichedExistingOrganizations": xwalk(
                        nh_state_ccn, cms_sets.get("nh", set())
                    )["exact_matches"],
                },
                "cmsNursingHome": {
                    "existingBefore": az_geo.get("nursingHomes"),
                    "sourceIdentitiesNow": len(cms_sets.get("nh", set())),
                    "netNewStateIdentities": 0,
                    "promotedCanonicalOrganizations": 0,
                    "enrichedExistingOrganizations": xwalk(
                        nh_state_ccn, cms_sets.get("nh", set())
                    )["exact_matches"],
                },
                "cmsHomeHealth": {
                    "existingBefore": az_geo.get("homeHealth"),
                    "sourceIdentitiesNow": len(cms_sets.get("hha", set())),
                    "netNewStateIdentities": 0,
                    "promotedCanonicalOrganizations": 0,
                    "enrichedExistingOrganizations": xwalk(
                        hha_state_ccn, cms_sets.get("hha", set())
                    )["exact_matches"],
                },
                "cmsHospice": {
                    "existingBefore": az_geo.get("hospice"),
                    "sourceIdentitiesNow": len(cms_sets.get("hospice", set())),
                    "netNewStateIdentities": 0,
                    "promotedCanonicalOrganizations": 0,
                    "enrichedExistingOrganizations": xwalk(
                        hosp_state_ccn, cms_sets.get("hospice", set())
                    )["exact_matches"],
                },
            },
        },
        "findings": [
            {
                "id": "al-home-scale",
                "title": "Assisted Living Homes are Arizona’s large state-only residential class",
                "summary": f"The ADHS GIS extract has {al_home['rows']:,} Assisted Living Homes versus {al_center['rows']:,} Assisted Living Centers. Homes are the small licensed setting (≤10 residents). They are not in the national CMS Nursing Home directory.",
                "doesNotMean": ["best care", "quality rank", "safer than centers"],
            },
            {
                "id": "home-vs-center",
                "title": "Assisted Living Home and Assisted Living Center stay separate",
                "summary": "Arizona statute splits assisted living by size. This snapshot keeps the source-native TYPE values. They are not one assisted-living total and are not Nursing Homes.",
                "doesNotMean": ["one combined Arizona senior-provider number"],
            },
            {
                "id": "state-vs-cms-nh",
                "title": "State Nursing Home licenses and CMS Nursing Home CCNs are different identities",
                "summary": "ADHS Nursing Home rows use LICENSE_NUMBER. CMS uses CCN. Exact MEDICARE_ID matching is the only join. Assisted Living is not joined to CMS NH.",
                "doesNotMean": [
                    "every assisted living home is a nursing home",
                    "CMS certified equals state licensed",
                ],
            },
            {
                "id": "afc-state-only",
                "title": "Adult Foster Care is a small distinct state-only class",
                "summary": f"ADHS lists {afc['rows']} Adult Foster Care facilities on the GIS extract. That class is not Assisted Living Home, not Assisted Living Center, and not a Nursing Home.",
                "doesNotMean": ["Adult Foster Care is a CMS class"],
            },
            {
                "id": "gis-clock",
                "title": "The acquired ADHS bulk clock is the GIS run date, not a September 2026 Excel table",
                "summary": f"Monthly Excel/CSV tables were not on the current databases page. The GIS FeatureServer harvest used for class counts has RUN_DATE {gis_run}. CMS Arizona overlays reuse the current national directories.",
                "doesNotMean": ["missing monthly Excel means zero licensed facilities"],
            },
        ],
        "coverageGaps": [
            "Current first-business-day monthly Excel/CSV tables (post-LMS page has no downloadable files)",
            "AZ Care Check licensing-history / deficiency / enforcement bulk",
            "Licensee / operator / administrator bulk (interactive AZ Care Check only)",
            "Email and website (not on GIS)",
            "Independent license-in-good-standing flag beyond OPERATION_STATUS on the Feb 2025 GIS extract",
            "Service-area geography (address county is not a service area)",
        ],
        "verification": {
            "snapshot": "TrustHub ADHS GIS extract plus CMS Arizona class overlays",
            "live": "AZ Care Check and CMS Care Compare remain live verification paths. TrustHub does not scrape AZ Care Check.",
        },
        "guardrails": [
            "ADHS != CMS",
            "STATE LICENSE != CMS CERTIFICATION",
            "ASSISTED LIVING HOME != ASSISTED LIVING CENTER",
            "ASSISTED LIVING != NURSING HOME",
            "ADULT FOSTER CARE != NURSING HOME",
            "HOME HEALTH != RESIDENTIAL CARE",
            "HOSPICE != HOME HEALTH",
            "FACILITY ADDRESS != SERVICE AREA",
            "LICENSE ROW != UNIQUE ORGANIZATION unless proven",
            "CROSSWALK != NEW ORGANIZATION",
            "COMPLAINT != VIOLATION",
            "DEFICIENCY != QUALITY RANK",
            "MISSING != ZERO",
            "NO TRUST SCORE",
            "NO PAID RANKING",
        ],
        "noCombinedDenominator": True,
        "publicationPath": "/arizona",
        "noCountyRoutes": True,
        "noCityRoutes": True,
    }
    snapshot["fingerprint"] = sha256_obj(
        {k: v for k, v in snapshot.items() if k != "fingerprint"}
    )
    ART.mkdir(parents=True, exist_ok=True)
    (ART / "az-sen-001-public-snapshot.json").write_text(
        json.dumps(snapshot, indent=2) + "\n", encoding="utf-8"
    )
    (DOMAIN / "az-public-snapshot.ts").write_text(
        json_to_ts(snapshot), encoding="utf-8"
    )
    print("fingerprint", snapshot["fingerprint"])
    print("AL home", al_home["rows"], "center", al_center["rows"], "afc", afc["rows"])
    print("state NH", state_nh["rows"], "cms NH live", len(cms_sets.get("nh", set())))
    print(
        "ledger",
        snapshot["expansionLedger"]["NET_NEW_CANONICAL_ORGANIZATIONS"],
        snapshot["expansionLedger"]["NET_NEW_STATE_IDENTITIES"],
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
