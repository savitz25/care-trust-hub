#!/usr/bin/env python3
"""WA-SEN-001 — acquire DSHS GIS + CMS WA overlays; emit deterministic snapshot.

Allowed: ArcGIS REST, CMS Provider Data Catalog query, Socrata catalog, official HTML docs.
Forbidden: DSHS locator scrape, PDF-by-PDF, county pages, Trust Scores.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

UA = "SeniorTrustHub-WA-SEN-001/1.0 (research; official bulk only; no DSHS locator scrape)"
CTX = ssl.create_default_context()
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "washington"
ART = ROOT / "artifacts"
DOMAIN = ROOT / "packages" / "domain" / "src"
RAW.mkdir(parents=True, exist_ok=True)
ART.mkdir(parents=True, exist_ok=True)

GIS_LAYER = (
    "https://services2.arcgis.com/WW3T8U6q5EkZ9U3n/arcgis/rest/services/"
    "Long_Term_Care_Residential_Care_view/FeatureServer/1"
)
CURRENT_WHERE = "GDLArchiveDate IS NULL"
CMS_Q = "https://data.cms.gov/provider-data/api/1/datastore/query/{id}/0"
CMS_META = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/{id}?show-reference-ids=true"
CMS_DATASETS = {
    "nh": "4pq5-n9py",
    "hha": "6jpm-sxkc",
    "hospice": "yc9t-dgbk",
    "penalties": "g6vv-2vws",
    "ownership": "y2hd-n93e",
}


def fetch(url: str, data: bytes | None = None, timeout: int = 180) -> tuple[int, bytes, dict]:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": "application/json,text/csv,*/*"})
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            return resp.status, resp.read(), {k.lower(): v for k, v in resp.headers.items()}
    except urllib.error.HTTPError as e:
        return e.code, e.read() if e.fp else b"", dict(e.headers.items()) if e.headers else {}
    except Exception as e:  # noqa: BLE001
        return 0, str(e).encode(), {}


def get_json(url: str, payload: dict | None = None, timeout: int = 180) -> object:
    data = json.dumps(payload).encode() if payload is not None else None
    st, body, _ = fetch(url, data=data, timeout=timeout)
    if st != 200:
        return {"_http": st, "_snippet": body[:400].decode("utf-8", "replace")}
    try:
        return json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        return {"_http": st, "_snippet": body[:400].decode("utf-8", "replace")}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_obj(obj: object) -> str:
    blob = json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(blob).hexdigest()


def nonempty(v: object) -> bool:
    if v is None:
        return False
    s = str(v).strip()
    return bool(s) and s.upper() not in {"NULL", "NONE", "NA", "N/A"}


def arcgis_count(where: str) -> int | None:
    url = GIS_LAYER + "/query?" + urllib.parse.urlencode(
        {"where": where, "returnCountOnly": "true", "f": "json"}
    )
    payload = get_json(url)
    if isinstance(payload, dict) and "count" in payload:
        return int(payload["count"])
    return None


def arcgis_page(where: str, offset: int, page: int = 2000) -> list[dict]:
    url = GIS_LAYER + "/query?" + urllib.parse.urlencode(
        {
            "where": where,
            "outFields": "*",
            "returnGeometry": "false",
            "resultOffset": str(offset),
            "resultRecordCount": str(page),
            "f": "json",
        }
    )
    payload = get_json(url, timeout=180)
    if not isinstance(payload, dict):
        return []
    feats = payload.get("features") or []
    return [f.get("attributes") or {} for f in feats]


def harvest_gis() -> tuple[list[dict], dict]:
    layer = get_json(GIS_LAYER + "?f=pjson")
    meta = {
        "url": GIS_LAYER,
        "name": layer.get("name") if isinstance(layer, dict) else None,
        "maxRecordCount": layer.get("maxRecordCount") if isinstance(layer, dict) else None,
        "editingInfo": (layer.get("editingInfo") if isinstance(layer, dict) else None),
        "fields": [
            {"name": f.get("name"), "alias": f.get("alias"), "type": f.get("type")}
            for f in ((layer.get("fields") if isinstance(layer, dict) else None) or [])
        ],
        "current_rule": CURRENT_WHERE,
        "current_rule_meaning": (
            "GDLArchiveDate IS NULL selects records still current in the nightly HCLA extract. "
            "This is a current GIS record rule, not a proof of license in good standing."
        ),
    }
    all_count = arcgis_count("1=1")
    current_count = arcgis_count(CURRENT_WHERE)
    meta["count_all"] = all_count
    meta["count_current"] = current_count
    rows: list[dict] = []
    offset = 0
    while True:
        print(f"gis offset={offset}", flush=True)
        batch = arcgis_page(CURRENT_WHERE, offset)
        if not batch:
            break
        rows.extend(batch)
        offset += len(batch)
        if len(batch) < 2000:
            break
        if current_count is not None and offset >= current_count:
            break
    return rows, meta


def profile_gis(rows: list[dict]) -> dict:
    types = Counter()
    status = Counter()
    counties = Counter()
    phone = 0
    address = 0
    email = 0
    website = 0
    beds = 0
    license_ids: set[str] = set()
    fac_ids: set[str] = set()
    by_type: dict[str, dict] = defaultdict(lambda: {
        "rows": 0,
        "unique_license": set(),
        "unique_fac": set(),
        "phone": 0,
        "address": 0,
        "beds_nonempty": 0,
        "bed_sum": 0,
        "status": Counter(),
        "counties": Counter(),
    })
    ccn_like = 0
    medicare_fields = [k for r in rows[:1] for k in r if "ccn" in k.lower() or "medicare" in k.lower()]
    for r in rows:
        t = str(r.get("FacilityType") or "").strip()
        types[t] += 1
        st = str(r.get("FacilityStatus") or "").strip()
        status[st] += 1
        lic = str(r.get("LicenseNumber") or "").strip()
        fac = str(r.get("FacInstanceId") or "").strip()
        if lic:
            license_ids.add(lic)
        if fac:
            fac_ids.add(fac)
        if nonempty(r.get("TelephoneNmbr")):
            phone += 1
        if nonempty(r.get("LocationAddress")):
            address += 1
        if nonempty(r.get("LicensedBedCount")):
            beds += 1
        # no email/website columns observed
        county = str(r.get("LocationCounty") or "").strip()
        if county:
            counties[county] += 1
        bucket = by_type[t or "UNKNOWN"]
        bucket["rows"] += 1
        if lic:
            bucket["unique_license"].add(lic)
        if fac:
            bucket["unique_fac"].add(fac)
        if nonempty(r.get("TelephoneNmbr")):
            bucket["phone"] += 1
        if nonempty(r.get("LocationAddress")):
            bucket["address"] += 1
        if nonempty(r.get("LicensedBedCount")):
            bucket["beds_nonempty"] += 1
            try:
                bucket["bed_sum"] += int(float(r.get("LicensedBedCount")))
            except (TypeError, ValueError):
                pass
        bucket["status"][st] += 1
        if county:
            bucket["counties"][county] += 1
        for k in medicare_fields:
            if nonempty(r.get(k)):
                ccn_like += 1
    typed = {}
    for code, b in by_type.items():
        typed[code] = {
            "rows": b["rows"],
            "unique_license": len(b["unique_license"]),
            "unique_fac_instance": len(b["unique_fac"]),
            "phone_nonempty": b["phone"],
            "address_nonempty": b["address"],
            "licensed_bed_nonempty": b["beds_nonempty"],
            "licensed_bed_sum": b["bed_sum"],
            "status": dict(b["status"].most_common()),
            "counties": dict(b["counties"].most_common()),
        }
    county_table = []
    # per-county AF/BH/EF
    county_class: dict[str, Counter] = defaultdict(Counter)
    for r in rows:
        county = str(r.get("LocationCounty") or "").strip() or "UNKNOWN"
        t = str(r.get("FacilityType") or "").strip() or "UNKNOWN"
        county_class[county][t] += 1
    for county, c in sorted(county_class.items(), key=lambda kv: (-sum(kv[1].values()), kv[0])):
        county_table.append(
            {
                "county": county,
                "AF": int(c.get("AF", 0)),
                "BH": int(c.get("BH", 0)),
                "EF": int(c.get("EF", 0)),
                "SL": int(c.get("SL", 0)),
                "GT": int(c.get("GT", 0)),
            }
        )
    return {
        "rows": len(rows),
        "unique_license": len(license_ids),
        "unique_fac_instance": len(fac_ids),
        "types": dict(types.most_common()),
        "status": dict(status.most_common()),
        "phone_nonempty": phone,
        "address_nonempty": address,
        "email_nonempty": email,
        "website_nonempty": website,
        "licensed_bed_nonempty": beds,
        "counties_nonempty": sum(counties.values()),
        "distinct_counties": len([k for k in counties if k]),
        "by_type": typed,
        "county_table": county_table,
        "medicare_or_ccn_fields": medicare_fields,
        "medicare_or_ccn_nonempty": ccn_like,
        "sample_field_names": sorted({k for r in rows[:1] for k in r}),
    }


def cms_query_wa(dataset_id: str, limit: int = 1500) -> tuple[list[dict], dict]:
    meta = get_json(CMS_META.format(id=dataset_id), timeout=60)
    title = meta.get("title") if isinstance(meta, dict) else None
    modified = None
    if isinstance(meta, dict):
        modified = meta.get("modified") or (meta.get("temporal") or None)
        iden = meta.get("identifier")
    rows: list[dict] = []
    offset = 0
    schema_probe = get_json(
        CMS_Q.format(id=dataset_id),
        {"limit": 1, "offset": 0, "results": True, "count": True},
        timeout=90,
    )
    properties = []
    if isinstance(schema_probe, dict):
        qmeta = schema_probe.get("query") or schema_probe.get("meta") or {}
        properties = list((schema_probe.get("results") or [{}])[0].keys()) if schema_probe.get("results") else []
    state_field = None
    for cand in ("state", "provider_state", "State", "STATE"):
        if cand in properties:
            state_field = cand
            break
    if state_field is None:
        # common CMS NH field
        for p in properties:
            if p.lower() in {"state", "providerstate", "provider_state"}:
                state_field = p
                break
    if state_field is None and properties:
        # fallback scan first page keys
        lower = {p.lower(): p for p in properties}
        for k in ("state", "provider_state"):
            if k in lower:
                state_field = lower[k]
    info = {
        "dataset_id": dataset_id,
        "title": title,
        "modified": modified,
        "identifier": iden if isinstance(meta, dict) else None,
        "state_field": state_field,
        "properties_sample": properties[:40],
        "count_all": (schema_probe.get("count") if isinstance(schema_probe, dict) else None),
    }
    if not state_field:
        info["error"] = "state field not found"
        return rows, info
    while True:
        print(f"cms {dataset_id} offset={offset}", flush=True)
        payload = {
            "conditions": [{"property": state_field, "operator": "=", "value": "WA"}],
            "limit": limit,
            "offset": offset,
            "results": True,
            "count": True,
        }
        data = get_json(CMS_Q.format(id=dataset_id), payload, timeout=180)
        if not isinstance(data, dict) or data.get("_http"):
            info["error"] = data
            break
        batch = data.get("results") or []
        if offset == 0:
            info["wa_count_reported"] = data.get("count")
        rows.extend(batch)
        if not batch:
            break
        offset += len(batch)
        reported = data.get("count")
        if reported is not None and offset >= int(reported):
            break
        if len(batch) < limit:
            break
    info["wa_rows"] = len(rows)
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
        v = str(r.get(ccn_field) or "").strip()
        if v:
            out.add(v.zfill(6) if v.isdigit() else v)
    return out, ccn_field


def socrata_search(q: str) -> dict:
    url = "https://api.us.socrata.com/api/catalog/v1?" + urllib.parse.urlencode(
        {"domains": "data.wa.gov", "search_context": "data.wa.gov", "q": q, "limit": "12"}
    )
    payload = get_json(url, timeout=60)
    results = []
    if isinstance(payload, dict):
        for item in payload.get("results") or []:
            res = item.get("resource") or {}
            results.append(
                {
                    "id": res.get("id"),
                    "name": res.get("name"),
                    "attribution": res.get("attribution"),
                    "type": res.get("type"),
                    "permalink": item.get("permalink"),
                }
            )
    return {"query": q, "hits": results}


def find_nh_gis() -> dict:
    service = (
        "https://services2.arcgis.com/WW3T8U6q5EkZ9U3n/arcgis/rest/services/"
        "Long_Term_Care_Nursing_Homes_view/FeatureServer"
    )
    out: dict = {
        "source_name": "Long Term Care - Nursing Homes (DSHS Geospatial Data Library)",
        "service_url": service,
        "locator": "https://fortress.wa.gov/dshs/adsaapps/lookup/NHPubLookup.aspx",
        "scrape": "FORBIDDEN",
    }
    svc = get_json(service + "?f=pjson", timeout=60)
    layers = []
    if isinstance(svc, dict):
        layers = svc.get("layers") or []
        out["service_layers"] = [{"id": ly.get("id"), "name": ly.get("name")} for ly in layers]
    for ly in layers or [{"id": 0}, {"id": 1}]:
        lid = ly.get("id")
        rest = f"{service}/{lid}"
        print("nh layer", rest, flush=True)
        layer = get_json(rest + "?f=pjson", timeout=60)
        if not isinstance(layer, dict) or layer.get("error"):
            continue
        fields = [f.get("name") for f in (layer.get("fields") or [])]
        current_count = None
        all_count = None
        where_used = CURRENT_WHERE if "GDLArchiveDate" in fields else "1=1"
        for label, where in (("current", where_used), ("all", "1=1")):
            payload = get_json(
                rest
                + "/query?"
                + urllib.parse.urlencode({"where": where, "returnCountOnly": "true", "f": "json"}),
                timeout=60,
            )
            if isinstance(payload, dict) and "count" in payload:
                if label == "current":
                    current_count = int(payload["count"])
                else:
                    all_count = int(payload["count"])
        sample = get_json(
            rest
            + "/query?"
            + urllib.parse.urlencode(
                {"where": where_used, "outFields": "*", "resultRecordCount": "1", "returnGeometry": "false", "f": "json"}
            ),
            timeout=60,
        )
        sample_attrs = {}
        if isinstance(sample, dict) and sample.get("features"):
            sample_attrs = sample["features"][0].get("attributes") or {}
        sample_keys = sorted(sample_attrs.keys())
        has_ccn = any("ccn" in k.lower() or "medicare" in k.lower() for k in sample_keys)
        # page current rows for identity/contact profile if small
        nh_rows: list[dict] = []
        offset = 0
        target = current_count or 0
        while target and offset < target:
            batch_payload = get_json(
                rest
                + "/query?"
                + urllib.parse.urlencode(
                    {
                        "where": where_used,
                        "outFields": "*",
                        "returnGeometry": "false",
                        "resultOffset": str(offset),
                        "resultRecordCount": "2000",
                        "f": "json",
                    }
                ),
                timeout=180,
            )
            feats = (batch_payload.get("features") or []) if isinstance(batch_payload, dict) else []
            batch = [f.get("attributes") or {} for f in feats]
            if not batch:
                break
            nh_rows.extend(batch)
            offset += len(batch)
            if len(batch) < 2000:
                break
        loc_types = Counter(str(r.get("nf_Loc_Type") or r.get("FacilityStatus") or "").strip() for r in nh_rows)
        license_field = "nf_license_num" if "nf_license_num" in sample_keys else "LicenseNumber"
        phone_field = "nf_loc_phone_num" if "nf_loc_phone_num" in sample_keys else "TelephoneNmbr"
        address_field = "nf_loc_street_address" if "nf_loc_street_address" in sample_keys else "LocationAddress"
        licenses = {
            str(r.get(license_field) or "").strip() for r in nh_rows if nonempty(r.get(license_field))
        }
        ccns = set()
        ccn_field = None
        for k in sample_keys:
            lk = k.lower()
            if "ccn" in lk or "medicare" in lk or lk in {"nf_fed_provider_num", "fed_provider_num"}:
                ccn_field = k
                break
        has_ccn = ccn_field is not None
        if ccn_field:
            for r in nh_rows:
                v = str(r.get(ccn_field) or "").strip()
                if v:
                    ccns.add(v.zfill(6) if v.isdigit() else v)
        out["acquired"] = {
            "rest": rest,
            "layer_id": lid,
            "layer_name": layer.get("name"),
            "current_rule": where_used,
            "current_count": current_count,
            "all_count": all_count,
            "harvested_rows": len(nh_rows),
            "license_field": license_field,
            "unique_license": len(licenses),
            "fields": fields,
            "sample_keys": sample_keys,
            "has_ccn": has_ccn,
            "ccn_field": ccn_field,
            "unique_ccn": len(ccns) if ccn_field else 0,
            "loc_type": dict(loc_types.most_common()),
            "phone_field": phone_field,
            "phone_nonempty": sum(1 for r in nh_rows if nonempty(r.get(phone_field))),
            "address_field": address_field,
            "address_nonempty": sum(1 for r in nh_rows if nonempty(r.get(address_field))),
            "person_fields_unpublished": [
                k for k in ("nf_staff_last_name", "nf_staff_first_name", "nf_staff_mid_name") if k in sample_keys
            ],
            "access": "OPEN_GIS_FEATURE_SERVICE",
            "note": "nf_fed_provider_num is treated as a federal provider number / CCN candidate. Staff name fields are unpublished. Licensee name is facility-level only, not a person dossier.",
        }
        out["ccn_set"] = sorted(ccns)
        break
    if "acquired" not in out:
        out["access"] = "OPEN_SEARCH_ONLY"
        out["note"] = "Structured NH GIS not harvested. Locator remains SEARCH_ONLY. Do not scrape."
    return out


def json_to_ts(obj: object) -> str:
    return "/** Generated from artifacts/wa-sen-001-public-snapshot.json. Do not edit by hand. */\nexport const WA_PUBLIC_SNAPSHOT = " + json.dumps(obj, indent=2) + " as const;\n"


def main() -> int:
    retrieved = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print("gis harvest", flush=True)
    rows, gis_meta = harvest_gis()
    gis_profile = profile_gis(rows)
    raw_path = RAW / "dshs_residential_care_current.json"
    # keep raw gitignored; do not need full dump if huge — write compact
    compact_rows = [
        {
            "LicenseNumber": r.get("LicenseNumber"),
            "FacInstanceId": r.get("FacInstanceId"),
            "FacilityType": r.get("FacilityType"),
            "FacilityName": r.get("FacilityName"),
            "FacilityStatus": r.get("FacilityStatus"),
            "LocationCity": r.get("LocationCity"),
            "LocationCounty": r.get("LocationCounty"),
            "LocationZipCode": r.get("LocationZipCode"),
            "TelephoneNmbr": r.get("TelephoneNmbr"),
            "LicensedBedCount": r.get("LicensedBedCount"),
        }
        for r in rows
    ]
    raw_path.write_text(json.dumps({"retrieved": retrieved, "rows": compact_rows}, indent=2), encoding="utf-8")

    print("cms overlays", flush=True)
    cms_info = {}
    cms_sets: dict[str, set[str]] = {}
    for label, dsid in list(CMS_DATASETS.items())[:3]:
        cms_rows, info = cms_query_wa(dsid)
        ccn_set, ccn_field = cms_unique(cms_rows)
        info["ccn_field"] = ccn_field
        info["unique_ccn"] = len(ccn_set)
        cms_info[label] = info
        cms_sets[label] = ccn_set

    print("nh gis", flush=True)
    nh_gis_full = find_nh_gis()
    nh_ccn_set = set(nh_gis_full.pop("ccn_set", []) or [])
    nh_gis = {k: v for k, v in nh_gis_full.items() if k != "ccn_set"}

    print("socrata", flush=True)
    catalog = {}
    for q in [
        "adult family home inspection",
        "assisted living citation",
        "nursing home enforcement",
        "residential care services",
        "DSHS stop placement",
        "AFH complaint",
    ]:
        catalog[q] = socrata_search(q)

    national_path = ROOT / "apps" / "web" / "src" / "data" / "senior-national-intelligence.json"
    national = json.loads(national_path.read_text(encoding="utf-8"))
    wa_geo = next(row for row in national["geography"] if row["state"] == "WA")
    sources = {row["datasetKey"]: row for row in national["sources"]}

    def clock(key: str) -> dict:
        row = sources.get(key) or {}
        return {
            "sourceModifiedAt": row.get("sourceModifiedAt"),
            "retrievedAt": row.get("retrievedAt"),
            "officialUrl": row.get("officialUrl"),
            "cmsIdentifier": row.get("cmsIdentifier"),
        }

    af = gis_profile["by_type"].get("AF") or {}
    bh = gis_profile["by_type"].get("BH") or {}
    ef = gis_profile["by_type"].get("EF") or {}
    sl = gis_profile["by_type"].get("SL") or {}
    gt = gis_profile["by_type"].get("GT") or {}

    class_map = [
        {
            "code": "AF",
            "officialName": "Adult Family Home",
            "publication_class": "CORE_SENIOR",
            "directory": "PUBLIC_CORE",
            "profile_publication": "STATE_DIRECTORY_ONLY",
            "cmsAnalog": None,
            "count": af.get("rows"),
            "note": "RCW 70.128 residential home for 2–8 adults. CORE senior-care class. AFH != ALF != Nursing Home.",
        },
        {
            "code": "BH",
            "officialName": "Assisted Living Facility",
            "publication_class": "CORE_SENIOR",
            "directory": "PUBLIC_CORE",
            "profile_publication": "STATE_DIRECTORY_ONLY",
            "cmsAnalog": None,
            "count": bh.get("rows"),
            "note": "Community assisted living (source code BH). ALF != SNF. ALF != CMS Nursing Home. Do not infer CMS from this class.",
        },
        {
            "code": "EF",
            "officialName": "Enhanced Services Facility",
            "publication_class": "CORE_SENIOR",
            "directory": "PUBLIC_CORE",
            "profile_publication": "STATE_DIRECTORY_ONLY",
            "cmsAnalog": None,
            "count": ef.get("rows"),
            "note": "Distinct DSHS residential class for people with behavioral support needs. Not merged into ALF.",
        },
        {
            "code": "SL",
            "officialName": "Certified Residential Service and Supports Provider",
            "publication_class": "ADJACENT_RELEVANT",
            "directory": "INTERNAL_ONLY",
            "profile_publication": "MARKET_INTELLIGENCE_ONLY",
            "cmsAnalog": None,
            "count": sl.get("rows"),
            "note": "Supported living / certified RSS. Adjacent DDA/residential supports, not a consumer AFH/ALF/NH universe. Counted because it is in the same GIS layer; not published as senior-care core.",
        },
        {
            "code": "GT",
            "officialName": "Group Training Home",
            "publication_class": "OTHER / NOT_PUBLIC",
            "directory": "INTERNAL_ONLY",
            "profile_publication": "MARKET_INTELLIGENCE_ONLY",
            "cmsAnalog": None,
            "count": gt.get("rows"),
            "note": "Group training homes are not a consumer senior-care product class. Excluded from public core tiles.",
        },
    ]

    nh_live = len(cms_sets.get("nh") or [])
    hha_live = len(cms_sets.get("hha") or [])
    hosp_live = len(cms_sets.get("hospice") or [])

    snapshot = {
        "version": "senior-wa-state-intel-v1",
        "asOf": retrieved[:10],
        "retrievedAt": retrieved,
        "ticket": "WA-SEN-001",
        "regulatorMap": {
            "agency": "Washington State Department of Social and Health Services",
            "administration": "Home and Community Living Administration (HCLA) / Residential Care Services (RCS)",
            "officialHub": "https://www.dshs.wa.gov/altsa/residential-care-services",
            "verifyAfh": "https://fortress.wa.gov/dshs/adsaapps/lookup/AFHAdvLookup.aspx",
            "verifyAlf": "https://fortress.wa.gov/dshs/adsaapps/lookup/BHPubLookup.aspx",
            "verifyNh": "https://fortress.wa.gov/dshs/adsaapps/lookup/NHPubLookup.aspx",
            "scrape": "FORBIDDEN",
            "classes": class_map,
            "nursingHomes": {
                "regulator": "DSHS RCS licenses nursing homes; CMS certifies Medicare/Medicaid SNFs",
                "stateBulk": nh_gis.get("acquired") or {"access": "SEARCH_ONLY", "locator": "https://fortress.wa.gov/dshs/adsaapps/lookup/NHPubLookup.aspx"},
                "cmsAnalog": "CMS Nursing Home / SNF",
                "note": "DSHS != CMS. State license != CMS certification.",
            },
        },
        "dshsGis": {
            "source_name": "Long Term Care — Residential Care (DSHS Geospatial Data Library)",
            "source_url": GIS_LAYER,
            "source_agency": "Washington State Department of Social and Health Services",
            "current_rule": CURRENT_WHERE,
            "current_rule_meaning": gis_meta["current_rule_meaning"],
            "grain": "one geocoded location row per current (or archived) licensed/certified setting",
            "identity": ["LicenseNumber", "FacInstanceId"],
            "preferred_identity": "WA-DSHS:{LicenseNumber}",
            "secondary_identity": "FacInstanceId",
            "layer_meta": {
                "name": gis_meta.get("name"),
                "maxRecordCount": gis_meta.get("maxRecordCount"),
                "editingInfo": gis_meta.get("editingInfo"),
                "count_all_including_archive": gis_meta.get("count_all"),
                "count_current_query": gis_meta.get("count_current"),
            },
            "profile": gis_profile,
            "contacts": {
                "phone_field": "TelephoneNmbr",
                "phone_nonempty": gis_profile["phone_nonempty"],
                "address_field": "LocationAddress",
                "address_nonempty": gis_profile["address_nonempty"],
                "email_field": None,
                "email_nonempty": 0,
                "website_field": None,
                "website_nonempty": 0,
                "provenance": {
                    "phone": "WA_DSHS_FACILITY_PHONE",
                    "address": "WA_DSHS_FACILITY_ADDRESS",
                },
                "note": "FacilityPOC is a person field and is not published. No internet enrichment.",
            },
            "status_note": (
                "FacilityStatus values are source-native (e.g. OP). A current GIS record "
                "(GDLArchiveDate IS NULL) is not independently proven as license-in-good-standing."
            ),
        },
        "adultFamilyHomes": {
            "code": "AF",
            "count": af.get("rows"),
            "unique_license": af.get("unique_license"),
            "unique_fac_instance": af.get("unique_fac_instance"),
            "phone_nonempty": af.get("phone_nonempty"),
            "address_nonempty": af.get("address_nonempty"),
            "licensed_bed_nonempty": af.get("licensed_bed_nonempty"),
            "licensed_bed_sum": af.get("licensed_bed_sum"),
            "status": af.get("status"),
            "identity": "WA-DSHS:{LicenseNumber}",
            "profile_publication": "STATE_DIRECTORY_ONLY",
            "note": "AFH != ALF. AFH != Nursing Home. Facility record != endorsement. Owner/licensee is not a person profile.",
        },
        "assistedLiving": {
            "code": "BH",
            "count": bh.get("rows"),
            "unique_license": bh.get("unique_license"),
            "unique_fac_instance": bh.get("unique_fac_instance"),
            "phone_nonempty": bh.get("phone_nonempty"),
            "address_nonempty": bh.get("address_nonempty"),
            "licensed_bed_nonempty": bh.get("licensed_bed_nonempty"),
            "licensed_bed_sum": bh.get("licensed_bed_sum"),
            "status": bh.get("status"),
            "identity": "WA-DSHS:{LicenseNumber}",
            "profile_publication": "STATE_DIRECTORY_ONLY",
            "note": "ALF != AFH. ALF != SNF. ALF != CMS Nursing Home. No CMS join by name/address.",
        },
        "enhancedServices": {
            "code": "EF",
            "count": ef.get("rows"),
            "unique_license": ef.get("unique_license"),
            "phone_nonempty": ef.get("phone_nonempty"),
            "address_nonempty": ef.get("address_nonempty"),
            "licensed_bed_nonempty": ef.get("licensed_bed_nonempty"),
            "licensed_bed_sum": ef.get("licensed_bed_sum"),
            "status": ef.get("status"),
            "identity": "WA-DSHS:{LicenseNumber}",
            "profile_publication": "STATE_DIRECTORY_ONLY",
            "note": "Kept separate from Assisted Living.",
        },
        "adjacentExcluded": {
            "SL": {
                "count": sl.get("rows"),
                "publication_class": "ADJACENT_RELEVANT",
                "directory": "INTERNAL_ONLY",
                "note": "Certified RSS / supported living. Not a public AFH/ALF/NH tile.",
            },
            "GT": {
                "count": gt.get("rows"),
                "publication_class": "OTHER / NOT_PUBLIC",
                "directory": "INTERNAL_ONLY",
                "note": "Group Training Home. Excluded from consumer senior-care core.",
            },
        },
        "cmsOverlay": {
            "nursingHomes": wa_geo["nursingHomes"],
            "homeHealth": wa_geo["homeHealth"],
            "hospice": wa_geo["hospice"],
            "source": "senior-national-intelligence.json geography WA (CMS class directories)",
            "asOf": national["generatedAt"][:10],
            "nationalFingerprint": national["sourceFingerprint"],
            "clocks": {
                "nursingHomes": clock("nursing-home-provider-information"),
                "homeHealth": clock("home-health-care-agencies"),
                "hospice": clock("hospice-general-information"),
                "ownership": clock("skilled-nursing-facility-all-owners"),
                "penalties": clock("nursing-home-penalties"),
                "staffing": clock("payroll-based-journal-daily-nurse-staffing") or clock("nursing-home-staffing"),
            },
            "liveDirectoryWaUniqueCcn": {
                "nursingHomes": nh_live,
                "homeHealth": hha_live,
                "hospice": hosp_live,
            },
            "query": cms_info,
            "nationalCoverage": national.get("nursingHome", {}).get("coverage"),
            "note": "CMS class overlays are independent of DSHS GIS row counts and are not summed. CMS CERTIFIED != STATE LICENSED. HOME HEALTH != RESIDENTIAL CARE. HOSPICE != HOME HEALTH.",
        },
        "stateNursingHomeSource": nh_gis,
        "crosswalk": {
            "afhToCmsNh": {
                "attempted": False,
                "reason": "AFH is not a CMS Nursing Home class. No CCN field on the residential-care GIS layer.",
            },
            "alfToCmsNh": {
                "attempted": False,
                "reason": "ALF is not a CMS Nursing Home class. Name/address join is forbidden.",
            },
            "esfToCmsNh": {"attempted": False, "reason": "ESF is not a CMS Nursing Home class."},
            "stateNhToCmsNh": {
                "attempted": bool((nh_gis.get("acquired") or {}).get("has_ccn")),
                "method": "exact padded CCN only; name and city are not used",
                "state_native_ccns": (nh_gis.get("acquired") or {}).get("unique_ccn"),
                "cms_wa_ccns": nh_live,
                "exact_matches": len(nh_ccn_set & cms_sets.get("nh", set())) if nh_ccn_set else None,
                "unmatched_state": len(nh_ccn_set - cms_sets.get("nh", set())) if nh_ccn_set else None,
                "unmatched_cms": len(cms_sets.get("nh", set()) - nh_ccn_set) if nh_ccn_set else None,
                "note": "No name/city join. DSHS != CMS. Unmatched remain unmatched.",
            },
            "gisMedicareFields": gis_profile["medicare_or_ccn_fields"],
        },
        "enforcement": {
            "state": {
                "result": "NO_BULK_ACQUIRED",
                "access": "SEARCH_ONLY / locator inspection pages; no structured statewide inspection CSV found this ticket",
                "catalog": catalog,
                "note": "Complaint != violation. Investigation != finding. Citation != quality score. Name-only attach is UNSAFE. Missing bulk != zero enforcement.",
            },
            "cms": {
                "result": "REUSED_NATIONAL_EXACT_CCN",
                "note": "Nursing Home inspection, deficiency, penalty, staffing, and ownership stay on existing exact-CCN national architecture. No Washington-specific score.",
            },
        },
        "ownership": {
            "cmsNursingHome": "Reuse existing SeniorTrustHub CMS ownership graph on exact CCN.",
            "dshs": "Do not infer cross-facility ownership by matching names. FacilityPOC / licensee person fields are unpublished.",
        },
        "geography": {
            "grain": "LocationCounty on the current GIS record is a facility address county, not a service area.",
            "county_table": gis_profile["county_table"],
            "cmsNhCounties": "CMS NH county coverage is not a service area and is not published as a ranked county list.",
            "no_county_routes": True,
        },
        "publicationDecisions": {
            "AFH_PROFILE_PUBLICATION": "STATE_DIRECTORY_ONLY",
            "ALF_PROFILE_PUBLICATION": "STATE_DIRECTORY_ONLY",
            "ESF_PROFILE_PUBLICATION": "STATE_DIRECTORY_ONLY",
            "rationale": (
                "Exact LicenseNumber, stable GIS, public facility identity, phone/address, and nightly refresh exist, "
                "but minting thousands of weak state-only profile routes is not required for consumer research. "
                "State page tables plus official locators are enough. CMS classes keep existing CCN routes."
            ),
        },
        "findings": [
            {
                "id": "afh-scale",
                "title": "Adult Family Homes are Washington’s large state-licensed residential class",
                "summary": "The current DSHS GIS layer has thousands of Adult Family Homes — far more settings than Assisted Living Facilities — because AFHs are small licensed homes, not campus buildings.",
                "doesNotMean": ["best care", "quality rank", "safer than ALF"],
            },
            {
                "id": "afh-vs-alf",
                "title": "AFH and ALF are different DSHS licenses",
                "summary": "Adult Family Home (AF) and Assisted Living Facility (BH) stay separate in the official type code. Capacity, setting, and rules differ. They are not one ‘residential care’ total.",
                "doesNotMean": ["one combined Washington senior-provider number"],
            },
            {
                "id": "state-vs-cms",
                "title": "State residential care is not CMS certification",
                "summary": "DSHS GIS AFH/ALF/ESF identities are LicenseNumber. CMS Nursing Home, Home Health, and Hospice identities are CCN. This snapshot does not add those universes together.",
                "doesNotMean": ["every AFH is a nursing home", "CMS certified equals state licensed"],
            },
            {
                "id": "contacts",
                "title": "Facility phone and address are source-native on the GIS layer",
                "summary": "Current GIS rows carry TelephoneNmbr and LocationAddress at high occupancy. Email and website columns are not in this layer.",
                "doesNotMean": ["missing email means the facility has no email"],
            },
            {
                "id": "cms-depth",
                "title": "CMS Nursing Homes keep federal inspection and ownership depth",
                "summary": "Washington CMS Nursing Homes reuse the national exact-CCN inspection, penalty, staffing, and ownership products. AFH/ALF do not inherit those federal files.",
                "doesNotMean": ["no deficiencies means a clean record", "a deficiency is a quality rank"],
            },
        ],
        "coverageGaps": [
            "Complete structured DSHS nursing-home bulk if GIS/CSV is not pinned",
            "Statewide AFH/ALF/ESF inspection, citation, stop-placement, and fine bulk",
            "Exact DSHS↔CMS CCN crosswalk (no CCN on residential-care GIS)",
            "Facility service areas (address county is not a service area)",
            "Email/website on DSHS GIS",
            "License-in-good-standing independent of current GIS archive flag",
        ],
        "verification": {
            "snapshot": "TrustHub current GIS snapshot (GDLArchiveDate IS NULL) as of retrievedAt",
            "live": "DSHS locators remain the live verification path. TrustHub does not scrape them.",
        },
        "guardrails": [
            "DSHS != CMS",
            "AFH != ALF",
            "ALF != SNF",
            "AFH != NURSING HOME",
            "HOME HEALTH != RESIDENTIAL CARE",
            "HOSPICE != HOME HEALTH",
            "CURRENT GIS RECORD != QUALITY",
            "CMS CERTIFIED != STATE LICENSED",
            "FACILITY ADDRESS != SERVICE AREA",
            "COMPLAINT != VIOLATION",
            "DEFICIENCY != QUALITY RANK",
            "NO DEFICIENCY FOUND != CLEAN RECORD",
            "MISSING != ZERO",
            "NO TRUST SCORE",
            "NO PAID RANKING",
        ],
        "noCombinedDenominator": True,
        "publicationPath": "/washington",
        "noCountyRoutes": True,
    }

    # fingerprint excludes retrievedAt noise? TX included full snapshot. Include everything except maybe raw rows.
    snapshot["fingerprint"] = sha256_obj({k: v for k, v in snapshot.items() if k != "fingerprint"})

    art_path = ART / "wa-sen-001-public-snapshot.json"
    art_path.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    (DOMAIN / "wa-public-snapshot.ts").write_text(json_to_ts(snapshot), encoding="utf-8")
    print("wrote", art_path)
    print("fingerprint", snapshot["fingerprint"])
    print("gis current", gis_profile["rows"], "AF", af.get("rows"), "BH", bh.get("rows"), "EF", ef.get("rows"))
    print("cms live", nh_live, hha_live, hosp_live, "national overlay", wa_geo)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
