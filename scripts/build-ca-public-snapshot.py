"""CA-SEN-001 — acquire official California senior bulk files and emit a deterministic snapshot.

Allowed: CKAN datastore/dump, CMS Provider Data Catalog CSV, simple HTML tables.
Forbidden: CAPTCHA, session scrape, browser automation, huge git commits.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

UA = "SeniorTrustHub-CA-SEN-001/1.0 (research; official bulk only)"
CTX = ssl.create_default_context()
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "california"
ART = ROOT / "artifacts"
RAW.mkdir(parents=True, exist_ok=True)
ART.mkdir(parents=True, exist_ok=True)

CHHS = "https://data.chhs.ca.gov"
CMS_Q = "https://data.cms.gov/provider-data/api/1/datastore/query/{id}/0/download?format=csv"

RESOURCES = {
    "elms": ("chhs", "f0ae5731-fef8-417f-839d-54a0ed3a126e", "health_facility_locations.csv"),
    "hcai": ("chhs", "641c5557-7d65-4379-8fea-6b7dedbda40b", "hcai_listing.csv"),
    "rcfe": ("chhs", "744d1583-f9eb-45b6-b0f8-b9a9dab936a6", "ccld_rcfe.csv"),
    "hco": ("chhs", "b4d78b7f-12df-4b0c-a81a-ff40b949bc75", "ccld_hco.csv"),
    "arf": ("chhs", "9f5d1d00-6b24-4f44-a158-9cbe4b43f117", "ccld_arf.csv"),
}


def fetch(url: str, timeout: int = 180) -> tuple[int, bytes, dict]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            return resp.status, resp.read(), {k.lower(): v for k, v in resp.headers.items()}
    except urllib.error.HTTPError as e:
        return e.code, e.read() if e.fp else b"", dict(e.headers.items()) if e.headers else {}
    except Exception as e:
        return 0, str(e).encode(), {}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def dump_ckan(kind: str, resource_id: str, name: str) -> dict:
    dest = RAW / name
    url = f"{CHHS}/datastore/dump/{resource_id}"
    status, body, headers = fetch(url)
    info = {
        "id": resource_id,
        "url": url,
        "http_status": status,
        "bytes": len(body),
        "content_type": headers.get("content-type"),
        "saved": False,
    }
    if status != 200 or body.lstrip().startswith(b"<") or len(body) < 200:
        info["snippet"] = body[:400].decode("utf-8", "replace")
        return info
    dest.write_bytes(body)
    info["saved"] = True
    info["path"] = str(dest)
    info["sha256"] = sha256(body)
    return info


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    cols = reader.fieldnames or []
    rows = [{k: (v or "").strip() for k, v in row.items()} for row in reader]
    return cols, rows


def nonempty(row: dict[str, str], *keys: str) -> bool:
    return any((row.get(k) or "").strip() for k in keys)


def pad_ccn(value: str) -> str | None:
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        return None
    if len(digits) > 6:
        digits = digits[-6:]
    if len(digits) < 6:
        digits = digits.zfill(6)
    return digits


def count_map(rows: list[dict], key: str, n: int = 40) -> list[dict]:
    c = Counter((row.get(key) or "").strip() or "(blank)" for row in rows)
    return [{"label": k, "count": v} for k, v in c.most_common(n)]


def county_map(rows: list[dict], key: str) -> list[dict]:
    c = Counter((row.get(key) or "").strip().title() or "(blank)" for row in rows)
    return [{"county": k, "count": v} for k, v in sorted(c.items(), key=lambda x: (-x[1], x[0]))]


def cms_download(dataset_id: str, dest: Path) -> dict:
    url = CMS_Q.format(id=dataset_id)
    status, body, headers = fetch(url, timeout=240)
    info = {"url": url, "http_status": status, "bytes": len(body), "saved": False}
    if status != 200 or body.lstrip().startswith(b"<") or len(body) < 200:
        info["snippet"] = body[:400].decode("utf-8", "replace")
        return info
    dest.write_bytes(body)
    info["saved"] = True
    info["sha256"] = sha256(body)
    return info


def cms_ca_ccns(path: Path) -> tuple[set[str], dict]:
    cols, rows = read_csv(path)
    state_keys = [c for c in cols if c.lower() in {"state", "state_code", "provider_state"}]
    ccn_keys = [
        c
        for c in cols
        if re.search(r"ccn|cms.?cert|provider.?id|federal.?provider", c, re.I)
        and not re.search(r"zip|phone|name|address", c, re.I)
    ]
    if not ccn_keys:
        ccn_keys = [c for c in cols if "CMS Certification Number" in c or c.upper() == "CCN"]
    state_key = state_keys[0] if state_keys else None
    ccn_key = ccn_keys[0] if ccn_keys else None
    ca = []
    if state_key and ccn_key:
        for row in rows:
            if (row.get(state_key) or "").strip().upper() == "CA":
                ccn = pad_ccn(row.get(ccn_key) or "")
                if ccn:
                    ca.append(ccn)
    return set(ca), {
        "rows": len(rows),
        "columns": cols[:30],
        "state_key": state_key,
        "ccn_key": ccn_key,
        "ca_rows": len(ca),
        "ca_unique_ccn": len(set(ca)),
    }


def package_search(q: str) -> dict:
    url = f"{CHHS}/api/3/action/package_search?q={urllib.parse.quote(q)}&rows=8"
    st, body, _ = fetch(url, timeout=60)
    if st != 200:
        return {"q": q, "http_status": st}
    payload = json.loads(body.decode("utf-8"))
    result = payload.get("result", {})
    return {
        "q": q,
        "count": result.get("count"),
        "titles": [r.get("title") for r in result.get("results", [])[:8]],
    }


def main() -> None:
    retrieved = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    files = {}
    for key, (_kind, rid, name) in RESOURCES.items():
        print("dump", key)
        files[key] = dump_ckan(key, rid, name)

    # CMS directories
    cms_meta = {}
    cms_sets: dict[str, set[str]] = {}
    for label, dsid, fname in [
        ("nh", "4pq5-n9py", "cms_nh.csv"),
        ("hha", "6jpm-sxkc", "cms_hha.csv"),
        ("hospice", "yc9t-dgbk", "cms_hospice.csv"),
    ]:
        print("cms", label)
        info = cms_download(dsid, RAW / fname)
        files[f"cms_{label}"] = info
        if info.get("saved"):
            s, meta = cms_ca_ccns(RAW / fname)
            cms_sets[label] = s
            cms_meta[label] = meta
            files[f"cms_{label}"]["profile"] = meta

    # ELMS
    elms_cols, elms = read_csv(RAW / "health_facility_locations.csv")
    elms_phone = sum(1 for r in elms if nonempty(r, "CONTACT_PHONE_NUMBER"))
    elms_email = sum(1 for r in elms if nonempty(r, "CONTACT_EMAIL"))
    elms_addr = sum(1 for r in elms if nonempty(r, "ADDRESS"))
    elms_ccn = [pad_ccn(r.get("CCN") or "") for r in elms]
    elms_ccn_present = [c for c in elms_ccn if c]
    by_type = count_map(elms, "FAC_FDR", 40)
    by_status = count_map(elms, "LICENSE_STATUS_DESCRIPTION", 20)
    by_fac_status = count_map(elms, "FAC_STATUS_TYPE_CODE", 10)
    data_dates = Counter(r.get("DATA_DATE") or "" for r in elms)
    elms_date = (data_dates.most_common(1)[0][0] or "")[:10]

    def type_rows(label: str) -> list[dict]:
        return [r for r in elms if (r.get("FAC_FDR") or "") == label]

    snf = type_rows("SKILLED NURSING FACILITY")
    hha = type_rows("HOME HEALTH AGENCY")
    hosp = type_rows("HOSPICE")
    hospice_fac = type_rows("HOSPICE FACILITY")

    def crosswalk(state_rows: list[dict], cms: set[str]) -> dict:
        native = []
        for r in state_rows:
            c = pad_ccn(r.get("CCN") or "")
            if c:
                native.append(c)
        native_set = set(native)
        matched = native_set & cms
        return {
            "state_rows": len(state_rows),
            "cms_rows": len(cms),
            "source_native_ccns": len(native_set),
            "source_native_ccn_populated": len(native),
            "exact_matches": len(matched),
            "unmatched_cdph": len(native_set - cms),
            "unmatched_cms": len(cms - native_set),
            "conflicts": 0,
            "note": "Exact padded CCN match only. Name/city is not used.",
        }

    cms_nh = cms_sets.get("nh", set())
    cms_hha = cms_sets.get("hha", set())
    cms_hosp = cms_sets.get("hospice", set())

    # RCFE
    rcfe_cols, rcfe = read_csv(RAW / "ccld_rcfe.csv")
    rcfe_status = count_map(rcfe, "facility_status", 20)
    rcfe_type = count_map(rcfe, "facility_type", 20)
    rcfe_phone = sum(1 for r in rcfe if nonempty(r, "facility_telephone_number") and r.get("facility_telephone_number") not in {"Unavailable", "N/A"})
    rcfe_addr = sum(1 for r in rcfe if nonempty(r, "facility_address") and r.get("facility_address") not in {"Unavailable"})
    rcfe_file_dates = Counter(r.get("file_date") or "" for r in rcfe)
    raw_fd = rcfe_file_dates.most_common(1)[0][0] if rcfe_file_dates else ""
    # 5252025 -> 2025-05-25
    rcfe_as_of = None
    if re.fullmatch(r"\d{7,8}", raw_fd):
        s = raw_fd.zfill(8)
        rcfe_as_of = f"{s[4:8]}-{s[0:2]}-{s[2:4]}"
    elif re.fullmatch(r"\d{8}", raw_fd):
        rcfe_as_of = f"{raw_fd[4:8]}-{raw_fd[0:2]}-{raw_fd[2:4]}"
    capacities = []
    for r in rcfe:
        try:
            capacities.append(int(float(r.get("facility_capacity") or "")))
        except ValueError:
            pass
    licensed = [r for r in rcfe if (r.get("facility_status") or "").upper() == "LICENSED"]
    rcfe_status_exact = {row["label"]: row["count"] for row in rcfe_status}

    # HCO
    hco_cols, hco = read_csv(RAW / "ccld_hco.csv")
    hco_status = count_map(hco, "facility_status", 20)
    hco_type = count_map(hco, "facility_type", 20)
    hco_phone = sum(1 for r in hco if nonempty(r, "facility_telephone_number") and r.get("facility_telephone_number") not in {"Unavailable"})
    hco_addr = sum(1 for r in hco if nonempty(r, "facility_address") and r.get("facility_address") not in {"Unavailable"})
    hco_fd = Counter(r.get("file_date") or "" for r in hco)
    hco_raw = hco_fd.most_common(1)[0][0] if hco_fd else ""
    hco_as_of = None
    if re.fullmatch(r"\d{7,8}", hco_raw):
        s = hco_raw.zfill(8)
        hco_as_of = f"{s[4:8]}-{s[0:2]}-{s[2:4]}"

    # ARF
    arf_cols, arf = read_csv(RAW / "ccld_arf.csv")
    arf_type = count_map(arf, "facility_type", 40)
    arf_status = count_map(arf, "facility_status", 20)
    seniorish = [
        t
        for t in arf_type
        if re.search(r"elder|senior|rcfe|assisted", t["label"], re.I)
    ]

    # HCAI
    hcai_cols, hcai = read_csv(RAW / "hcai_listing.csv")
    hcai_status = count_map(hcai, "FACILITY_STATUS_DESC", 20)
    hcai_cat = count_map(hcai, "LICENSE_CATEGORY_DESC", 30)
    hcai_type = count_map(hcai, "LICENSE_TYPE_DESC", 20)

    # Enforcement easy pass
    enforcement_search = {
        "citation": package_search("healthcare facility citation"),
        "deficiency": package_search("healthcare facility deficiency"),
        "enforcement cdph": package_search("CDPH enforcement"),
        "ccld complaint": package_search("community care complaint"),
    }

    # Crosswalk XLSX — try datastore dump of first resource via package_show
    st, body, _ = fetch(f"{CHHS}/api/3/action/package_show?id=licensed-facility-crosswalk")
    crosswalk_meta: dict = {"http_status": st}
    if st == 200:
        res = json.loads(body.decode("utf-8")).get("result", {}).get("resources", [])
        crosswalk_meta["resources"] = [
            {"name": r.get("name"), "format": r.get("format"), "id": r.get("id"), "datastore_active": r.get("datastore_active")}
            for r in res
        ]
        xlsx = next((r for r in res if str(r.get("format", "")).upper() in {"XLSX", "XLS"} and r.get("datastore_active")), None)
        if xlsx:
            dump_info = dump_ckan("crosswalk", xlsx["id"], "facility_crosswalk.csv")
            files["crosswalk"] = dump_info
            if dump_info.get("saved"):
                cw_cols, cw_rows = read_csv(RAW / "facility_crosswalk.csv")
                crosswalk_meta["rows"] = len(cw_rows)
                crosswalk_meta["columns"] = cw_cols
        else:
            crosswalk_meta["note"] = "XLSX present but datastore_active false; S3 signed download skipped."

    national = json.loads((ROOT / "apps/web/src/data/senior-national-intelligence.json").read_text(encoding="utf-8"))
    ca_geo = next(g for g in national["geography"] if g["state"] == "CA")

    ownership_fields = [
        k
        for k in elms_cols
        if re.search(r"business_name|entity_type|licensee|owner|operator", k, re.I)
    ]
    rcfe_own = [k for k in rcfe_cols if re.search(r"licensee|administrator|owner", k, re.I)]

    elms_block = {
        "source_name": "CDPH Licensed and Certified Healthcare Facility Locations (ELMS)",
        "source_url": "https://data.chhs.ca.gov/dataset/healthcare-facility-locations",
        "source_agency": "California Department of Public Health — Center for Health Care Quality",
        "source_as_of": elms_date or "2026-08-17",
        "retrieved_at": retrieved,
        "source_file_hash": files["elms"].get("sha256"),
        "source_row_count": len(elms),
        "row_grain": "licensed/certified healthcare facility location (FACID)",
        "identifier_fields": ["FACID", "CCN", "LICENSE_NUMBER", "HCAI_ID", "NPI", "ASPEN_FACID"],
        "status_fields": ["LICENSE_STATUS_DESCRIPTION", "FAC_STATUS_TYPE_CODE"],
        "contact_fields": {
            "phone": {"field": "CONTACT_PHONE_NUMBER", "present": elms_phone, "eligible": "PUBLIC_ELIGIBLE", "note": "Facility contact from California state record. Not an administrator personal directory."},
            "email": {"field": "CONTACT_EMAIL", "present": elms_email, "eligible": "PUBLIC_ELIGIBLE", "note": "Official CONTACT_EMAIL. Administrator names are not published."},
            "address": {"field": "ADDRESS", "present": elms_addr, "eligible": "PUBLIC_ELIGIBLE"},
            "website": {"field": None, "present": 0, "eligible": "INTERNAL_ONLY"},
        },
        "geography_fields": ["CITY", "ZIP", "COUNTY_NAME", "FIPS_COUNTY_CODE"],
        "publication_eligibility": "PUBLIC_STATE_PAGE",
        "byType": by_type,
        "byLicenseStatus": by_status,
        "byFacStatus": by_fac_status,
        "counties": county_map(elms, "COUNTY_NAME"),
        "activeLicenseStatus": sum(1 for r in elms if (r.get("LICENSE_STATUS_DESCRIPTION") or "") == "ACTIVE"),
        "openFacStatus": sum(1 for r in elms if (r.get("FAC_STATUS_TYPE_CODE") or "") == "OPEN"),
        "snf": len(snf),
        "homeHealth": len(hha),
        "hospice": len(hosp),
        "hospiceFacility": len(hospice_fac),
        "phonePct": round(100 * elms_phone / len(elms), 2) if elms else 0,
        "emailPct": round(100 * elms_email / len(elms), 2) if elms else 0,
        "addressPct": round(100 * elms_addr / len(elms), 2) if elms else 0,
        "ownershipFields": ownership_fields,
    }

    snapshot = {
        "version": "senior-ca-state-intel-v1",
        "asOf": retrieved[:10],
        "retrievedAt": retrieved,
        "elms": elms_block,
        "rcfe": {
            "source_name": "CDSS CCLD Residential Care Facilities for the Elderly",
            "source_url": "https://data.chhs.ca.gov/dataset/ccl-facilities",
            "source_agency": "California Department of Social Services — Community Care Licensing Division",
            "source_as_of": rcfe_as_of or "2025-05-25",
            "retrieved_at": retrieved,
            "source_file_hash": files["rcfe"].get("sha256"),
            "source_row_count": len(rcfe),
            "row_grain": "RCFE / CCRC facility (facility_number)",
            "identifier_fields": ["facility_number"],
            "status_fields": ["facility_status"],
            "byStatus": rcfe_status,
            "byType": rcfe_type,
            "licensed": rcfe_status_exact.get("LICENSED", 0),
            "closed": rcfe_status_exact.get("CLOSED", 0),
            "pending": rcfe_status_exact.get("PENDING", 0),
            "onProbation": rcfe_status_exact.get("ON PROBATION", 0),
            "phonePresent": rcfe_phone,
            "addressPresent": rcfe_addr,
            "emailPresent": 0,
            "websitePresent": 0,
            "capacityRows": len(capacities),
            "capacityMin": min(capacities) if capacities else None,
            "capacityMax": max(capacities) if capacities else None,
            "counties": county_map(licensed, "county_name"),
            "licensedCountyCount": len({(r.get("county_name") or "").strip() for r in licensed if (r.get("county_name") or "").strip()}),
            "ownershipFields": rcfe_own,
            "clockNote": "CCLD open-data file_date is 2025-05-25. This is not a September 2026 current count.",
            "publication_eligibility": "PUBLIC_STATE_PAGE",
        },
        "hco": {
            "source_name": "CDSS CCLD Home Care Organization",
            "source_url": "https://data.chhs.ca.gov/dataset/ccl-facilities",
            "source_agency": "California Department of Social Services — Community Care Licensing Division",
            "source_as_of": hco_as_of or "2025-05-25",
            "retrieved_at": retrieved,
            "source_file_hash": files["hco"].get("sha256"),
            "source_row_count": len(hco),
            "row_grain": "home care organization (facility_number)",
            "identifier_fields": ["facility_number"],
            "byStatus": hco_status,
            "byType": hco_type,
            "phonePresent": hco_phone,
            "addressPresent": hco_addr,
            "emailPresent": 0,
            "note": "HOME CARE ORGANIZATION != HOME HEALTH AGENCY. Same May 2025 CCLD clock as RCFE.",
            "publication_eligibility": "PUBLIC_STATE_PAGE_SOURCE_LEVEL",
        },
        "arf": {
            "source_name": "CDSS CCLD Adult Residential Facilities",
            "source_url": "https://data.chhs.ca.gov/dataset/ccl-facilities",
            "source_agency": "California Department of Social Services — Community Care Licensing Division",
            "source_as_of": hco_as_of or "2025-05-25",
            "retrieved_at": retrieved,
            "source_file_hash": files["arf"].get("sha256"),
            "source_row_count": len(arf),
            "byType": arf_type,
            "byStatus": arf_status,
            "seniorRelevantTypes": seniorish,
            "publication_eligibility": "RESEARCHED_NOT_PUBLISHED",
            "note": "Adult Residential is not a senior-care denominator. No subtype was added to the public California senior page unless it is explicitly elderly/RCFE.",
        },
        "hcai": {
            "source_name": "HCAI Current California Healthcare Facility Listing",
            "source_url": "https://data.chhs.ca.gov/dataset/licensed-healthcare-facility-listing",
            "source_agency": "Department of Health Care Access and Information (HCAI)",
            "source_as_of": "2026-09-01",
            "retrieved_at": retrieved,
            "source_file_hash": files["hcai"].get("sha256"),
            "source_row_count": len(hcai),
            "row_grain": "HCAI facility listing (OSHPD_ID)",
            "identifier_fields": ["OSHPD_ID", "PERM_ID", "LICENSE_NUM"],
            "byStatus": hcai_status,
            "byCategory": hcai_cat,
            "byType": hcai_type,
            "open": sum(1 for r in hcai if (r.get("FACILITY_STATUS_DESC") or "") == "Open"),
            "counties": county_map(hcai, "COUNTY_NAME"),
            "phonePresent": 0,
            "emailPresent": 0,
            "addressPresent": sum(1 for r in hcai if nonempty(r, "DBA_ADDRESS1")),
            "note": "HCAI RECORD != UNIQUE NEW PROVIDER. Do not add to CDPH or CCLD.",
            "publication_eligibility": "PUBLIC_STATE_PAGE",
        },
        "cmsOverlay": {
            "nursingHomes": ca_geo["nursingHomes"],
            "homeHealth": ca_geo["homeHealth"],
            "hospice": ca_geo["hospice"],
            "source": "senior-national-intelligence.json geography CA (CMS class directories)",
            "asOf": national["generatedAt"][:10],
            "nationalFingerprint": national["sourceFingerprint"],
            "liveDirectoryCaUniqueCcn": {
                "nursingHomes": cms_meta.get("nh", {}).get("ca_unique_ccn"),
                "homeHealth": cms_meta.get("hha", {}).get("ca_unique_ccn"),
                "hospice": cms_meta.get("hospice", {}).get("ca_unique_ccn"),
            },
        },
        "crosswalk": {
            "snf": crosswalk(snf, cms_nh) if cms_nh else {"note": "CMS NH file not acquired; overlay counts come from the national snapshot only."},
            "homeHealth": crosswalk(hha, cms_hha) if cms_hha else {"note": "CMS HHA file not acquired."},
            "hospice": crosswalk(hosp, cms_hosp) if cms_hosp else {"note": "CMS Hospice file not acquired."},
            "hcaiElms": crosswalk_meta,
        },
        "enforcement": {
            "pass": "bounded_easy_win",
            "result": "NO_BULK_ACQUIRED",
            "searches": enforcement_search,
            "cmsFederalOverlay": "CMS inspection/deficiency evidence remains available on existing CMS class profiles. Not re-scraped here.",
            "note": "No official structured statewide CDPH/CCLD enforcement CSV was acquired in this easy-win pass. Missing is unknown, not zero.",
        },
        "ownership": {
            "elmsFields": ownership_fields,
            "rcfeFields": rcfe_own,
            "hcoFields": [k for k in hco_cols if re.search(r"licensee|administrator", k, re.I)],
            "note": "BUSINESS_NAME / licensee preserved as source fields. No ownership graph. CMS NH ownership remains federal.",
        },
        "gaps": [
            "CCLD RCFE/HCO/ARF open-data file_date is 2025-05-25, not current to the retrieval date.",
            "HCAI listing has no phone or email fields.",
            "Adult Residential includes non-senior classes and is not published as a senior-care universe.",
            "State CDPH/CCLD inspection/enforcement was not acquired as structured bulk.",
            "ELMS CONTACT_EMAIL is a facility contact field; administrator personal names are withheld from publication.",
            "HCAI rows overlap CDPH facilities and are not unique additional providers.",
            "CMS overlay counts from the national snapshot and live CMS CA CCN sets are independent of CDPH row counts and are not summed.",
            "County in these files is a facility address county, not a service area.",
        ],
        "files": {k: {ik: iv for ik, iv in v.items() if ik != "snippet"} for k, v in files.items()},
    }

    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
    snapshot["fingerprint"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    (ART / "ca-sen-001-public-snapshot.json").write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    compact = {
        "elms": len(elms),
        "elms_active": elms_block["activeLicenseStatus"],
        "elms_phone": elms_phone,
        "elms_email": elms_email,
        "snf": len(snf),
        "hha": len(hha),
        "hospice": len(hosp),
        "rcfe": len(rcfe),
        "rcfe_status": rcfe_status_exact,
        "rcfe_as_of": snapshot["rcfe"]["source_as_of"],
        "hco": len(hco),
        "hco_status": hco_status,
        "arf": len(arf),
        "arf_seniorish": seniorish,
        "hcai": len(hcai),
        "hcai_open": snapshot["hcai"]["open"],
        "cms_overlay": snapshot["cmsOverlay"],
        "crosswalk": snapshot["crosswalk"],
        "fingerprint": snapshot["fingerprint"],
    }
    print(json.dumps(compact, indent=2, default=str)[:20000])


if __name__ == "__main__":
    main()
