"""TX-SEN-001 — acquire official Texas senior bulk files and emit a deterministic snapshot.

Allowed: HHSC Excel directories, CMS Provider Data Catalog CSV, Socrata catalog/API.
Forbidden: TULIP scrape, PDF-by-PDF, child-care CCL SODA as senior care, huge git commits.
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
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

UA = "SeniorTrustHub-TX-SEN-001/1.0 (research; official bulk only; no TULIP scrape)"
CTX = ssl.create_default_context()
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "texas"
ART = ROOT / "artifacts"
DOMAIN = ROOT / "packages" / "domain" / "src"
RAW.mkdir(parents=True, exist_ok=True)
ART.mkdir(parents=True, exist_ok=True)

CMS_Q = "https://data.cms.gov/provider-data/api/1/datastore/query/{id}/0/download?format=csv"
HHSC = {
    "nf": "https://apps.hhs.texas.gov/providers/directories/NF.xlsx",
    "hosp_nf": "https://apps.hhs.texas.gov/providers/directories/HospNF.xlsx",
    "alf": "https://apps.hhs.texas.gov/providers/directories/al.xlsx",
    "hcssa": "https://apps.hhs.texas.gov/providers/directories/HHA.xlsx",
    "nf_closures": "https://apps.hhs.texas.gov/providers/directories/Closures/nf_closures.xlsx",
    "alf_closures": "https://apps.hhs.texas.gov/providers/directories/Closures/alf_closures.xlsx",
    "hcssa_closures": "https://apps.hhs.texas.gov/providers/directories/Closures/hcssa_closures.xlsx",
}
CHILD_CARE = {
    "bc5r-88dy": "HHSC CCL Daycare and Residential Operations Data",
    "m5q4-3y3d": "HHSC CCL Inspection Investigation Assessment Data",
}
TULIP = {
    "search": "https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-search",
    "how_to": "https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-information",
    "licensing": "https://tulip.hhs.texas.gov/TULIP/s/long-term-care-facility-agency-licensing",
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


def save_fetch(url: str, dest: Path, timeout: int = 180) -> dict:
    status, body, headers = fetch(url, timeout=timeout)
    info = {
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


def xlsx_rows(payload: bytes) -> list[list[str | None]]:
    archive = zipfile.ZipFile(io.BytesIO(payload))
    strings: list[str] = []
    if "xl/sharedStrings.xml" in archive.namelist():
        root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
        for item in root:
            strings.append(
                "".join(
                    node.text or ""
                    for node in item.iter(
                        "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"
                    )
                )
            )
    sheet_name = next(
        (n for n in archive.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")),
        None,
    )
    if not sheet_name:
        return []
    sheet = ElementTree.fromstring(archive.read(sheet_name))
    rows: list[list[str | None]] = []
    for row in sheet.findall("m:sheetData/m:row", NS):
        cells: dict[int, str | None] = {}
        for cell in row.findall("m:c", NS):
            ref = cell.get("r") or "A"
            col = 0
            for char in ref:
                if char.isalpha():
                    col = col * 26 + (ord(char.upper()) - 64)
            value_node = cell.find("m:v", NS)
            if value_node is None or value_node.text is None:
                cells[col - 1] = None
                continue
            if cell.get("t") == "s":
                idx = int(value_node.text)
                cells[col - 1] = strings[idx] if 0 <= idx < len(strings) else value_node.text
            else:
                cells[col - 1] = value_node.text
        width = max(cells) + 1 if cells else 0
        rows.append([cells.get(index) for index in range(width)])
    return rows


def norm_header(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("_x000D_", " ")).strip()


def parse_as_of(title: str | None) -> str | None:
    if not title:
        return None
    match = re.search(r"as of\s+(\d{1,2})/(\d{1,2})/(\d{4})", title, re.I)
    if not match:
        return None
    month, day, year = match.group(1).zfill(2), match.group(2).zfill(2), match.group(3)
    return f"{year}-{month}-{day}"


def load_hhsc(path: Path, required_tokens: tuple[str, ...]) -> tuple[str | None, list[str], list[dict[str, str]]]:
    payload = path.read_bytes()
    grid = xlsx_rows(payload)
    title = norm_header(grid[0][0] if grid and grid[0] else None)
    header_index = None
    header_cells: list[str] = []
    for i, row in enumerate(grid):
        cells = [norm_header(c) for c in row]
        joined = " | ".join(cells).lower()
        if all(token.lower() in joined for token in required_tokens):
            header_index = i
            header_cells = [cell or f"column_{n}" for n, cell in enumerate(cells)]
            break
    if header_index is None:
        return title, [], []
    mapped: list[dict[str, str]] = []
    for values in grid[header_index + 1 :]:
        if not any((v or "").strip() for v in values if v is not None):
            continue
        mapped.append(
            {
                header_cells[i]: (values[i] if i < len(values) and values[i] is not None else "").strip()
                for i in range(len(header_cells))
            }
        )
    return title, header_cells, mapped


def field(row: dict[str, str], *names: str) -> str:
    lowered = {k.lower(): v for k, v in row.items()}
    for name in names:
        if name.lower() in lowered:
            return lowered[name.lower()]
    return ""


def get(row: dict[str, str], *needles: str) -> str:
    lowered = {k.lower(): v for k, v in row.items()}
    for needle in needles:
        needle = needle.lower()
        for key, value in lowered.items():
            if key == needle or needle in key:
                return value
    return ""


def pad_ccn(value: str) -> str | None:
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        return None
    if len(digits) > 6:
        digits = digits[-6:]
    if len(digits) < 6:
        digits = digits.zfill(6)
    return digits


def exact_count(rows: list[dict[str, str]], *names: str, n: int = 40) -> list[dict]:
    values = [field(row, *names) or "(blank)" for row in rows]
    if all(v == "(blank)" for v in values):
        return []
    c = Counter(values)
    return [{"label": k, "count": v} for k, v in c.most_common(n)]


def county_map(rows: list[dict[str, str]], *names: str) -> list[dict]:
    values = []
    for row in rows:
        value = field(row, *names)
        if not value:
            value = get(row, "county/parish", "county")
        values.append((value or "(blank)").title() if value != "(blank)" else "(blank)")
    if not values or all(v == "(blank)" for v in values):
        return []
    c = Counter(values)
    return [{"county": k, "count": v} for k, v in sorted(c.items(), key=lambda x: (-x[1], x[0]))]


def present_exact(rows: list[dict[str, str]], *names: str) -> int:
    return sum(1 for row in rows if field(row, *names))


def split_services(value: str) -> list[str]:
    parts = [re.sub(r"\s+", " ", part).strip() for part in re.split(r"[;,]", value or "")]
    return [part for part in parts if part]


def service_counts(rows: list[dict[str, str]]) -> list[dict]:
    c = Counter()
    for row in rows:
        for part in split_services(field(row, "Services Provided", "Services")):
            c[part] += 1
    return [{"label": k, "count": v} for k, v in c.most_common(40)]


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    cols = reader.fieldnames or []
    rows = [{k: (v or "").strip() for k, v in row.items()} for row in reader]
    return cols, rows


def cms_tx(path: Path) -> tuple[set[str], list[dict[str, str]], dict]:
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
    tx_rows = []
    ccns = []
    if state_key:
        for row in rows:
            if (row.get(state_key) or "").strip().upper() == "TX":
                tx_rows.append(row)
                if ccn_key:
                    ccn = pad_ccn(row.get(ccn_key) or "")
                    if ccn:
                        ccns.append(ccn)
    return set(ccns), tx_rows, {
        "rows": len(rows),
        "columns": cols[:40],
        "state_key": state_key,
        "ccn_key": ccn_key,
        "tx_rows": len(tx_rows),
        "tx_unique_ccn": len(set(ccns)),
    }


def socrata_search(q: str) -> dict:
    url = "https://api.us.socrata.com/api/catalog/v1?" + urllib.parse.urlencode(
        {"q": q, "domains": "data.texas.gov", "limit": "8"}
    )
    st, body, _ = fetch(url, timeout=60)
    if st != 200:
        alt = "https://data.texas.gov/api/catalog/v1?" + urllib.parse.urlencode({"q": q, "limit": "8"})
        st2, body2, _ = fetch(alt, timeout=60)
        if st2 != 200:
            return {"q": q, "http_status": st, "alt_http_status": st2}
        body, st = body2, st2
    try:
        payload = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        return {"q": q, "http_status": st, "parse": "failed"}
    results = payload.get("results") or []
    titles = []
    ids = []
    for item in results[:8]:
        resource = item.get("resource") or {}
        titles.append(resource.get("name") or item.get("name"))
        ids.append(resource.get("id"))
    return {
        "q": q,
        "http_status": st,
        "count": payload.get("resultSetSize"),
        "titles": titles,
        "ids": ids,
    }


def classify_child_care(titles: list, ids: list) -> list[str]:
    excluded = []
    for title, rid in zip(titles, ids):
        blob = f"{title} {rid}".lower()
        if rid in CHILD_CARE or "ccl" in blob or "child care" in blob or "daycare" in blob or "day care" in blob:
            excluded.append(f"{rid}:{title}")
    return excluded


def profile_directory(
    path: Path,
    tokens: tuple[str, ...],
    *,
    id_fields: tuple[str, ...],
    ccn_fields: tuple[str, ...],
    phone_fields: tuple[str, ...],
    email_fields: tuple[str, ...],
    type_fields: tuple[str, ...],
    status_fields: tuple[str, ...],
    public_email: bool,
) -> dict:
    title, header, rows = load_hhsc(path, tokens)
    native = []
    for row in rows:
        ccn = pad_ccn(field(row, *ccn_fields))
        if ccn:
            native.append(ccn)
    ids = [field(row, *id_fields) for row in rows]
    id_set = {v for v in ids if v}
    alzheimer_cert = sum(1 for row in rows if field(row, "Alzheimer Certificate No"))
    return {
        "title": title,
        "source_as_of": parse_as_of(title),
        "columns": header,
        "source_row_count": len(rows),
        "identifier_populated": sum(1 for v in ids if v),
        "unique_identifiers": len(id_set),
        "native_ccn_populated": len(native),
        "unique_native_ccn": len(set(native)),
        "native_ccns": sorted(set(native)),
        "phone_present": present_exact(rows, *phone_fields),
        "email_present": present_exact(rows, *email_fields) if public_email else 0,
        "administrator_email_present": present_exact(rows, "Administrator Email"),
        "address_present": present_exact(rows, "Physical Address", "Agency Address", "Address"),
        "county_present": present_exact(rows, "County"),
        "by_type": exact_count(rows, *type_fields),
        "by_status": exact_count(rows, *status_fields),
        "by_service": service_counts(rows),
        "counties": county_map(rows, "County"),
        "alzheimer_certificate": alzheimer_cert,
        "owner_present": present_exact(rows, "Owner_"),
        "administrator_present": present_exact(rows, "Administrator"),
        "management_present": present_exact(rows, "Management Company_"),
        "certified_yes": sum(1 for row in rows if (field(row, "Facility Certified") or "").upper() == "YES"),
        "licensed_yes": sum(1 for row in rows if (field(row, "Facility Licensed") or "").upper() == "YES"),
        "rows": rows,
    }


def exact_crosswalk(native: set[str], cms: set[str]) -> dict:
    matched = native & cms
    return {
        "source_native_ccns": len(native),
        "cms_rows": len(cms),
        "exact_matches": len(matched),
        "unmatched_state": len(native - cms),
        "unmatched_cms": len(cms - native),
        "note": "Exact padded CCN / Medicare Provider Number only. Name and city are not used.",
    }


def main() -> None:
    retrieved = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    files: dict[str, dict] = {}

    for key, url in HHSC.items():
        print("hhsc", key, flush=True)
        files[key] = save_fetch(url, RAW / f"{key}.xlsx", timeout=180)

    cms_meta: dict[str, dict] = {}
    cms_sets: dict[str, set[str]] = {}
    cms_rows: dict[str, list[dict[str, str]]] = {}
    for label, dsid, fname in [
        ("nh", "4pq5-n9py", "cms_nh.csv"),
        ("hha", "6jpm-sxkc", "cms_hha.csv"),
        ("hospice", "yc9t-dgbk", "cms_hospice.csv"),
    ]:
        print("cms", label, flush=True)
        info = save_fetch(CMS_Q.format(id=dsid), RAW / fname, timeout=240)
        files[f"cms_{label}"] = info
        if info.get("saved"):
            s, rows, meta = cms_tx(RAW / fname)
            cms_sets[label] = s
            cms_rows[label] = rows
            cms_meta[label] = meta
            files[f"cms_{label}"]["profile"] = {k: v for k, v in meta.items()}

    print("socrata", flush=True)
    enforcement_search = {}
    child_care_hits: list[str] = []
    for q in [
        "nursing facility",
        "assisted living",
        "hospice HHSC",
        "HCSSA",
        "home health HHSC",
        "HHSC enforcement",
        "statement of deficiencies",
        "nursing facility sanctions",
        "CCL inspection",
        "child care licensing",
    ]:
        result = socrata_search(q)
        enforcement_search[q] = {k: v for k, v in result.items() if k != "ids"}
        child_care_hits.extend(classify_child_care(result.get("titles") or [], result.get("ids") or []))
        enforcement_search[q]["child_care_hits"] = classify_child_care(
            result.get("titles") or [], result.get("ids") or []
        )

    # Confirm the known child-care datasets exist and stay excluded.
    child_care_meta = {}
    for rid, name in CHILD_CARE.items():
        url = f"https://data.texas.gov/resource/{rid}.json?$select=count(*)"
        st, body, _ = fetch(url, timeout=60)
        count = None
        try:
            payload = json.loads(body.decode("utf-8")) if st == 200 else None
            if payload:
                count = int(next(iter(payload[0].values())))
        except Exception:
            count = None
        child_care_meta[rid] = {
            "name": name,
            "url": f"https://data.texas.gov/dataset/{rid}",
            "http_status": st,
            "row_count": count,
            "publication": "DELIBERATELY_EXCLUDED_CHILD_CARE_SOURCE",
            "reason": "Child Care Licensing operations/inspections are not senior-care LTC. CHILD CARE DATA != SENIOR CARE.",
        }

    nf = None
    if files["nf"].get("saved"):
        nf = profile_directory(
            RAW / "nf.xlsx",
            ("Facility Name", "Facility ID", "Medicare Provider Number"),
            id_fields=("Facility ID",),
            ccn_fields=("Medicare Provider Number",),
            phone_fields=("Facility Phone Number",),
            email_fields=("Provider Email",),
            type_fields=("Service Type",),
            status_fields=("Facility Licensed",),
            public_email=True,
        )
    alf = None
    if files["alf"].get("saved"):
        alf = profile_directory(
            RAW / "alf.xlsx",
            ("Facility Name", "Facility ID", "Alzheimer Certificate No"),
            id_fields=("Facility ID",),
            ccn_fields=("Medicare Provider Number",),
            phone_fields=("Facility Phone Number",),
            email_fields=("Provider Email",),
            type_fields=("Service Type",),
            status_fields=("Facility Licensed",),
            public_email=True,
        )
    hcssa = None
    if files["hcssa"].get("saved"):
        hcssa = profile_directory(
            RAW / "hcssa.xlsx",
            ("Agency", "License No", "Services Provided"),
            id_fields=("License No",),
            ccn_fields=("Medicare Number",),
            phone_fields=("Agency Phone",),
            email_fields=("Administrator Email",),
            type_fields=("Agency Type",),
            status_fields=("License Status",),
            public_email=False,
        )
    hosp_nf = None
    if files["hosp_nf"].get("saved"):
        hosp_nf = profile_directory(
            RAW / "hosp_nf.xlsx",
            ("Facility Name", "Facility ID"),
            id_fields=("Facility ID",),
            ccn_fields=("Medicare Provider Number",),
            phone_fields=("Facility Phone Number",),
            email_fields=("Provider Email",),
            type_fields=("Service Type",),
            status_fields=("Facility Licensed",),
            public_email=True,
        )

    def closures_profile(key: str, tokens: tuple[str, ...]) -> dict | None:
        if not files[key].get("saved"):
            return None
        title, header, rows = load_hhsc(RAW / f"{key}.xlsx", tokens)
        return {
            "title": title,
            "source_as_of": parse_as_of(title),
            "columns": header,
            "source_row_count": len(rows),
            "identifier_populated": present_exact(rows, "Facility ID", "License No"),
            "by_program": exact_count(rows, "Program", "Agency Type"),
            "by_service": exact_count(rows, "Service Type", "Services"),
            "note": "Closure workbook is a historical license-action listing as of the title date. It is not an inspection/SOD file, not a current roster, and not a quality rank.",
        }

    nf_closures = closures_profile("nf_closures", ("Facility ID", "Date of Closure"))
    alf_closures = closures_profile("alf_closures", ("Facility ID", "Date of Closure"))
    hcssa_closures = closures_profile("hcssa_closures", ("License No", "Date of Closure"))

    national = json.loads(
        (ROOT / "apps" / "web" / "src" / "data" / "senior-national-intelligence.json").read_text(
            encoding="utf-8"
        )
    )
    tx_geo = next(row for row in national["geography"] if row["state"] == "TX")
    sources = {row["datasetKey"]: row for row in national["sources"]}

    def clock(key: str) -> dict:
        row = sources.get(key) or {}
        return {
            "sourceModifiedAt": row.get("sourceModifiedAt"),
            "retrievedAt": row.get("retrievedAt"),
            "officialUrl": row.get("officialUrl"),
            "cmsIdentifier": row.get("cmsIdentifier"),
        }

    cms_nh_set = cms_sets.get("nh", set())
    cms_hha_set = cms_sets.get("hha", set())
    cms_hospice_set = cms_sets.get("hospice", set())
    nf_crosswalk = (
        exact_crosswalk(set(nf["native_ccns"]), cms_nh_set) if nf and cms_nh_set else None
    )

    hcssa_crosswalk = {
        "attempted": True,
        "method": "exact padded Medicare Number only; service label is source text, not a CMS class",
        "uniqueMedicareNumbers": (hcssa or {}).get("unique_native_ccn"),
        "licensedAndCertifiedHomeHealth": None,
        "hospiceLabeled": None,
        "personalAssistanceRows": None,
        "note": "HOME HEALTH != PERSONAL ASSISTANCE. Licensed Home Health is not Licensed and Certified Home Health and is not CMS Home Health. Exact CCN matches are research metrics on this page, not new profile attachments.",
    }
    if hcssa and hcssa.get("rows"):
        cert_hh: set[str] = set()
        hosp: set[str] = set()
        pas_rows = 0
        for row in hcssa["rows"]:
            services = split_services(field(row, "Services Provided"))
            ccn = pad_ccn(field(row, "Medicare Number"))
            if any("Licensed and Certified Home Health" in item for item in services) and ccn:
                cert_hh.add(ccn)
            if any("Hospice" in item for item in services) and ccn:
                hosp.add(ccn)
            if any("Personal Assistance" in item for item in services):
                pas_rows += 1
        hcssa_crosswalk["licensedAndCertifiedHomeHealth"] = exact_crosswalk(cert_hh, cms_hha_set)
        hcssa_crosswalk["hospiceLabeled"] = exact_crosswalk(hosp, cms_hospice_set)
        hcssa_crosswalk["personalAssistanceRows"] = pas_rows

    def strip_rows(block: dict | None) -> dict | None:
        if not block:
            return None
        out = {k: v for k, v in block.items() if k not in {"rows", "native_ccns"}}
        return out

    hcssa_types = (hcssa or {}).get("by_type") or []
    hcssa_services = (hcssa or {}).get("by_service") or []
    hcssa_type_labels = [row["label"] for row in hcssa_types]

    snapshot = {
        "version": "senior-tx-state-intel-v1",
        "asOf": retrieved[:10],
        "retrievedAt": retrieved,
        "regulatorMap": {
            "agency": "Texas Health and Human Services Commission",
            "program": "Long-term Care Regulation (LTCR)",
            "officialHub": "https://www.hhs.texas.gov/providers/long-term-care-providers",
            "classes": [
                {
                    "id": "nf",
                    "officialName": "Nursing Facilities",
                    "cmsAnalog": "CMS Nursing Home / SNF",
                    "bulk": "NF.xlsx",
                    "note": "ALF != SNF. HHSC NF license is not the CMS CCN.",
                },
                {
                    "id": "alf",
                    "officialName": "Assisted Living Facilities (Type A / Type B / Type C as published)",
                    "cmsAnalog": None,
                    "bulk": "al.xlsx",
                    "note": "ALF is state-licensed. Not a CMS national class.",
                },
                {
                    "id": "hcssa",
                    "officialName": "Home and Community Support Services Agencies",
                    "cmsAnalog": "May overlap CMS Home Health or Hospice when certified; Personal Assistance is not CMS Home Health.",
                    "bulk": "HHA.xlsx",
                    "note": "HOME HEALTH != PERSONAL ASSISTANCE. HOSPICE != HOME HEALTH. HCSSA is the Texas license class.",
                },
                {
                    "id": "hospice_state",
                    "officialName": "Hospice (state HCSSA / hospice program)",
                    "cmsAnalog": "CMS Hospice",
                    "bulk": "inside HHA.xlsx when typed; otherwise TULIP",
                    "note": "HOSPICE != HOME HEALTH.",
                },
                {
                    "id": "dahs",
                    "officialName": "Day Activity and Health Services",
                    "cmsAnalog": None,
                    "bulk": None,
                    "note": "Adult daytime program. Not acquired as a bulk roster in this snapshot.",
                },
                {
                    "id": "icf",
                    "officialName": "Intermediate Care Facilities (ICF/IID)",
                    "cmsAnalog": None,
                    "bulk": None,
                    "note": "Not a senior-care CMS Nursing Home class. Not acquired as bulk here.",
                },
                {
                    "id": "ppecc",
                    "officialName": "Prescribed Pediatric Extended Care Center",
                    "cmsAnalog": None,
                    "bulk": None,
                    "note": "Pediatric. Excluded from the senior-care universe.",
                },
            ],
            "tulip": {
                **TULIP,
                "access": "OPEN_SEARCH_NO_LOGIN",
                "scrape": "FORBIDDEN",
                "note": "TULIP search result != complete bulk universe. Hospice and Home Health may serve counties other than the registered county. TULIP is licensing lookup, not an HHSC contract.",
            },
        },
        "cmsOverlay": {
            "nursingHomes": tx_geo["nursingHomes"],
            "homeHealth": tx_geo["homeHealth"],
            "hospice": tx_geo["hospice"],
            "source": "senior-national-intelligence.json geography TX (CMS class directories)",
            "asOf": national["generatedAt"][:10],
            "nationalFingerprint": national["sourceFingerprint"],
            "clocks": {
                "nursingHomes": clock("nursing-home-provider-information"),
                "homeHealth": clock("home-health-care-agencies"),
                "hospice": clock("hospice-general-information"),
                "ownership": clock("skilled-nursing-facility-all-owners"),
                "penalties": clock("nursing-home-penalties"),
            },
            "liveDirectoryTxUniqueCcn": {
                "nursingHomes": cms_meta.get("nh", {}).get("tx_unique_ccn"),
                "homeHealth": cms_meta.get("hha", {}).get("tx_unique_ccn"),
                "hospice": cms_meta.get("hospice", {}).get("tx_unique_ccn"),
            },
            "note": "CMS class overlays are independent of HHSC Excel row counts and are not summed. CMS CERTIFIED != STATE LICENSED.",
        },
        "hhscNursingFacilities": {
            "source_name": "Directory of all Texas nursing facilities",
            "source_url": HHSC["nf"],
            "source_agency": "Texas Health and Human Services Commission",
            "source_as_of": (nf or {}).get("source_as_of") or retrieved[:10],
            "retrieved_at": retrieved,
            "source_file_hash": files["nf"].get("sha256"),
            "row_grain": "HHSC nursing facility directory row (Facility ID / License Number)",
            "identifier_fields": ["Facility ID", "License No", "Medicare Provider Number"],
            "publication_eligibility": "PUBLIC_STATE_PAGE_SOURCE_LEVEL",
            "note": "HHSC NF directory is not the CMS Nursing Home overlay. Medicare Provider Number is used for exact CCN matching only.",
            **(strip_rows(nf) or {"source_row_count": None, "coverage": "SOURCE_NOT_ACQUIRED"}),
        },
        "hhscHospitalBasedNf": {
            "source_name": "Directory of all Hospital-based Texas nursing facilities",
            "source_url": HHSC["hosp_nf"],
            "source_file_hash": files["hosp_nf"].get("sha256"),
            "publication_eligibility": "PUBLIC_STATE_PAGE_SOURCE_LEVEL",
            "note": "Sibling directory. Not added to NF.xlsx. Not a combined nursing-facility total.",
            **(strip_rows(hosp_nf) or {"source_row_count": None, "coverage": "SOURCE_NOT_ACQUIRED"}),
        },
        "hhscAssistedLiving": {
            "source_name": "Directory of all ALFs",
            "source_url": HHSC["alf"],
            "source_agency": "Texas Health and Human Services Commission",
            "source_as_of": (alf or {}).get("source_as_of") or retrieved[:10],
            "retrieved_at": retrieved,
            "source_file_hash": files["alf"].get("sha256"),
            "row_grain": "HHSC Assisted Living Facility (Facility ID / License Number)",
            "identifier_fields": ["Facility ID", "License No"],
            "publication_eligibility": "PUBLIC_STATE_PAGE_SOURCE_LEVEL",
            "note": "ALF != SNF. Alzheimer's Certified is an official directory field when present. Never infer from a facility name. Existing /assisted-living/texas landing uses this directory family; this page does not mint thousands of new profiles.",
            **(strip_rows(alf) or {"source_row_count": None, "coverage": "SOURCE_NOT_ACQUIRED"}),
        },
        "hhscHcssa": {
            "source_name": "HCSSA providers directory",
            "source_url": HHSC["hcssa"],
            "source_agency": "Texas Health and Human Services Commission",
            "source_as_of": (hcssa or {}).get("source_as_of") or retrieved[:10],
            "retrieved_at": retrieved,
            "source_file_hash": files["hcssa"].get("sha256"),
            "row_grain": "HHSC Home and Community Support Services Agency directory row (License No)",
            "identifier_fields": ["License No", "Medicare Number"],
            "publication_eligibility": "PUBLIC_STATE_PAGE_SOURCE_LEVEL",
            "service_type_labels": hcssa_type_labels,
            "service_labels": [row["label"] for row in hcssa_services],
            "note": "HHA.xlsx is the HCSSA directory filename, not a CMS Home Health extract. HOME HEALTH != PERSONAL ASSISTANCE. HOSPICE != HOME HEALTH. Office/registered county is not a service area.",
            **(strip_rows(hcssa) or {"source_row_count": None, "coverage": "SOURCE_NOT_ACQUIRED"}),
        },
        "tulip": {
            "access": "OPEN_SEARCH_NO_LOGIN",
            "scrape": "FORBIDDEN",
            "coverage": "OPEN_SEARCH_ONLY",
            "license_count_published": None,
            **TULIP,
            "note": "TULIP SEARCH RESULT != COMPLETE BULK UNIVERSE. Consumers verify a current Texas license in TULIP. This page does not scrape TULIP and does not invent a TULIP roster count.",
        },
        "crosswalk": {
            "nfToCmsNh": nf_crosswalk
            or {
                "note": "CMS NH file or NF Medicare numbers not acquired; overlay counts come from the national snapshot only."
            },
            "alfToCmsNh": {
                "attempted": False,
                "reason": "ALF != SNF. No name-only or address-only attachment of ALF rows to CMS Nursing Homes.",
            },
            "hcssaToCms": hcssa_crosswalk,
        },
        "cmsCounties": {
            "nursingHomes": county_map(cms_rows.get("nh") or [], "county/parish", "county"),
            "homeHealth": county_map(cms_rows.get("hha") or [], "county/parish", "county"),
            "hospice": county_map(cms_rows.get("hospice") or [], "county/parish", "county"),
            "homeHealthCountyField": "CMS Home Health Care Agencies extract has City/Town and State, not a county field.",
            "texasCountyCount": 254,
            "note": "Facility address county, not a service area. No /texas/[county] routes. CMS Home Health county is unknown in this extract.",
        },
        "enforcement": {
            "pass": "bounded_easy_win",
            "result": "PARTIAL_SOURCE_COVERAGE",
            "nfClosures": nf_closures,
            "alfClosures": alf_closures,
            "hcssaClosures": hcssa_closures,
            "inspectionFindings": "SOURCE_NOT_ACQUIRED",
            "statementOfDeficiencies": "SOURCE_NOT_ACQUIRED",
            "administrativePenalties": "SOURCE_NOT_ACQUIRED",
            "pdfStopped": [
                "https://apps.hhs.texas.gov/providers/directories/Closures/nf_closures.pdf",
                "https://apps.hhs.texas.gov/providers/directories/Closures/alf_closures.pdf",
                "https://apps.hhs.texas.gov/providers/directories/Closures/hcssa_closures.pdf",
                "https://www.hhs.texas.gov/sites/default/files/documents/nf-ij-data.pdf",
                "https://www.hhs.texas.gov/sites/default/files/documents/alf-violations-data.pdf",
            ],
            "searches": enforcement_search,
            "childCareExcluded": child_care_meta,
            "cmsFederalOverlay": "CMS inspection/deficiency/penalty/staffing evidence remains available on existing CMS Nursing Home class profiles using national definitions. Not re-scraped here. No facility ranking.",
            "identityRule": "Exact adverse attach requires HHSC facility/license ID or exact CMS CCN. Name-only is UNSAFE. Name+address is HIGH_CONFIDENCE for non-adverse descriptive matching only.",
            "note": "Closure Excel rows are license actions, not inspection findings and not a quality rank. Missing SOD/penalty bulk is unknown, not zero. Child-care CCL SODA is deliberately excluded.",
        },
        "ownership": {
            "cmsNursingHome": "Reuse existing SeniorTrustHub CMS Nursing Home ownership graph on exact CCN profiles.",
            "stateOnly": "Do not infer ownership for state-only facilities by name. TULIP licensee/operator, if present on a looked-up record, is source semantics — no roster scrape.",
            "excelFields": {
                "nfOwnerPresent": (nf or {}).get("owner_present"),
                "nfAdministratorPresent": (nf or {}).get("administrator_present"),
                "alfOwnerPresent": (alf or {}).get("owner_present"),
                "alfAdministratorPresent": (alf or {}).get("administrator_present"),
            },
            "note": "TX NF Excel entity/capacity fields are unsafe for consumer entity publication. Administrator personal contacts are not published.",
        },
        "contacts": {
            "cms": "Use source-native CMS business/facility contact fields on existing class profiles.",
            "tulip": "Do not harvest TULIP contacts one-by-one.",
            "administratorPersonal": "Do not publish.",
            "nfPhonePresent": (nf or {}).get("phone_present"),
            "alfPhonePresent": (alf or {}).get("phone_present"),
            "hcssaPhonePresent": (hcssa or {}).get("phone_present"),
        },
        "childCareExclusion": {
            "status": "DELIBERATELY_EXCLUDED_CHILD_CARE_SOURCE",
            "datasets": child_care_meta,
            "note": "CHILD CARE DATA != SENIOR CARE. bc5r-88dy and m5q4-3y3d must never appear as Texas senior-care denominators.",
        },
        "gaps": [
            "No complete Texas state LTC roster covering NF + ALF + HCSSA + DAHS + ICF as one universe. Missing is not zero.",
            "TULIP remains search-only. A TULIP search result is not a complete bulk universe.",
            "HCSSA Personal Assistance is not CMS Home Health. HCSSA Hospice is not CMS Home Health.",
            "Exact state↔CMS crosswalk is available only where a source-native Medicare Provider Number / CCN exists. Name-only is unsafe.",
            "State inspection findings, statement-of-deficiencies, and administrative-penalty bulk were not acquired as structured open data in this pass.",
            "Immediate Jeopardy and ALF violations PDFs were not parsed (PDF-by-PDF STOP).",
            "Facility address county is not a Home Health or Hospice service area.",
            "Hospital-based NF.xlsx is a sibling directory and is not added to NF.xlsx.",
            "PPECC is pediatric and is excluded from the senior-care universe.",
            "CMS inspection/ownership evidence stays on existing national CCN architecture; this snapshot does not invent Texas-only inspection ranks.",
        ],
        "files": {
            k: {ik: iv for ik, iv in v.items() if ik not in {"snippet"}}
            for k, v in files.items()
        },
    }

    # Drop native CCN lists from published snapshot (identity-safe counts only).
    for block_name in ("hhscNursingFacilities", "hhscAssistedLiving", "hhscHcssa", "hhscHospitalBasedNf"):
        block = snapshot.get(block_name) or {}
        block.pop("native_ccns", None)
        block.pop("rows", None)

    canonical_obj = {k: v for k, v in snapshot.items() if k not in {"fingerprint"}}
    canonical = json.dumps(canonical_obj, sort_keys=True, separators=(",", ":"))
    snapshot["fingerprint"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    (ART / "tx-sen-001-public-snapshot.json").write_text(
        json.dumps(snapshot, indent=2) + "\n", encoding="utf-8"
    )
    ts = (
        "/** Generated from artifacts/tx-sen-001-public-snapshot.json. Do not edit by hand. */\n"
        "export const TX_PUBLIC_SNAPSHOT = "
        + json.dumps(snapshot, indent=2)
        + " as const;\n"
    )
    (DOMAIN / "tx-public-snapshot.ts").write_text(ts, encoding="utf-8")

    compact = {
        "nf": (nf or {}).get("source_row_count"),
        "alf": (alf or {}).get("source_row_count"),
        "alf_alz_cert": (alf or {}).get("alzheimer_certificate"),
        "hcssa": (hcssa or {}).get("source_row_count"),
        "hcssa_types": hcssa_types[:12],
        "hcssa_services": hcssa_services[:12],
        "hcssa_status": (hcssa or {}).get("by_status"),
        "nf_as_of": (nf or {}).get("source_as_of"),
        "alf_as_of": (alf or {}).get("source_as_of"),
        "hcssa_as_of": (hcssa or {}).get("source_as_of"),
        "hosp_nf": (hosp_nf or {}).get("source_row_count"),
        "nf_closures": (nf_closures or {}).get("source_row_count"),
        "alf_closures": (alf_closures or {}).get("source_row_count"),
        "hcssa_closures": (hcssa_closures or {}).get("source_row_count"),
        "cms_overlay": snapshot["cmsOverlay"],
        "crosswalk": snapshot["crosswalk"]["nfToCmsNh"],
        "child_care": {k: v.get("row_count") for k, v in child_care_meta.items()},
        "fingerprint": snapshot["fingerprint"],
        "files_saved": {k: bool(v.get("saved")) for k, v in files.items()},
    }
    print(json.dumps(compact, indent=2, default=str)[:20000])


if __name__ == "__main__":
    main()
