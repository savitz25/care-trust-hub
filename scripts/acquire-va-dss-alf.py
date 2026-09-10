#!/usr/bin/env python3
"""VA-SEN-001 — acquire Virginia DSS Assisted Living (and optional ADC) JSON from the official search pages.

Uses the public Terminalfour search module:
  GET /licensed-care/search-licensing-programs/{path}/?endpoint={alf|adc}&perPage=500&page=N
  GET /...?licenseId={id}&endpoint={alf|adc}

Parses the official JSON embedded as the page's "Raw Search API Response".
Does not brute-force IDs. Does not scrape inspector contact datasets.
"""

from __future__ import annotations

import html as htmlmod
import json
import re
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
ART.mkdir(exist_ok=True)

UA = "SeniorTrustHub/VA-SEN-001 (research; +https://www.seniortrusthub.com)"
CTX = ssl.create_default_context()
LIST_URL = (
    "https://www.dss.virginia.gov/licensed-care/search-licensing-programs/"
    "{path}/?endpoint={endpoint}&perPage=500&page={page}&sort=asc"
)
DETAIL_URL = (
    "https://www.dss.virginia.gov/licensed-care/search-licensing-programs/"
    "{path}/?licenseId={license_id}&endpoint={endpoint}"
)
PRE_RE = re.compile(r"<pre[^>]*>(.*?)</pre>", re.S)


def fetch(url: str, retries: int = 4) -> str:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
            with urllib.request.urlopen(req, context=CTX, timeout=45) as response:
                return response.read().decode("utf-8", "replace")
        except (urllib.error.URLError, TimeoutError) as exc:
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"fetch failed {url}: {last}")


def parse_api_json(html: str) -> dict:
    match = PRE_RE.search(html)
    if not match:
        raise ValueError("no Raw Search API Response JSON found")
    return json.loads(htmlmod.unescape(match.group(1)))


def acquire_list(path: str, endpoint: str) -> list[dict]:
    page = 1
    rows: list[dict] = []
    total = None
    while True:
        url = LIST_URL.format(path=path, endpoint=endpoint, page=page)
        print(f"LIST {endpoint} page {page} {url}")
        payload = parse_api_json(fetch(url))
        batch = payload.get("licensedFacilities") or []
        pagination = payload.get("pagination") or {}
        total = pagination.get("total")
        total_pages = int(pagination.get("totalPages") or 1)
        rows.extend(batch)
        print(f"  got {len(batch)} running={len(rows)} total={total} pages={total_pages}")
        if page >= total_pages:
            break
        page += 1
        time.sleep(0.25)
    if total is not None and len(rows) != int(total):
        raise SystemExit(f"{endpoint} list incomplete: {len(rows)} != {total}")
    return rows


def strip_people(detail: dict) -> dict:
    license_block = dict(detail.get("facilityLicense") or {})
    license_block.pop("administrator", None)
    license_block.pop("inspector", None)
    return {
        "facility": detail.get("facility") or {},
        "facilityLicense": license_block,
        "inspectionsList": detail.get("inspectionsList") or [],
    }


def acquire_details(path: str, endpoint: str, license_ids: list[int]) -> dict[int, dict]:
    out: dict[int, dict] = {}
    for i, license_id in enumerate(license_ids, start=1):
        url = DETAIL_URL.format(path=path, endpoint=endpoint, license_id=license_id)
        if i == 1 or i % 50 == 0 or i == len(license_ids):
            print(f"DETAIL {endpoint} {i}/{len(license_ids)} licenseId={license_id}")
        payload = parse_api_json(fetch(url))
        out[int(license_id)] = strip_people(payload)
        time.sleep(0.12)
    return out


def main() -> int:
    retrieved_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    alf_list = acquire_list("assisted-living-facility-search", "alf")
    alf_ids = [int(row["licenseId"]) for row in alf_list]
    if len(set(alf_ids)) != len(alf_ids):
        raise SystemExit("duplicate ALF licenseId in list")
    alf_details = acquire_details("assisted-living-facility-search", "alf", alf_ids)

    adc_status = "ATTEMPTED"
    adc_list: list[dict] = []
    adc_details: dict[int, dict] = {}
    try:
        adc_list = acquire_list("adult-day-center-search", "adc")
        adc_ids = [int(row["licenseId"]) for row in adc_list]
        if adc_ids and len(adc_ids) <= 250:
            adc_details = acquire_details("adult-day-center-search", "adc", adc_ids)
            adc_status = "ACQUIRED"
        else:
            adc_status = "LIST_ONLY" if adc_ids else "EMPTY"
    except Exception as exc:
        adc_status = f"FAILED:{exc}"
        print("ADC skipped:", exc)

    bundle = {
        "ticket": "VA-SEN-001",
        "retrievedAt": retrieved_at,
        "sourceAsOf": None,
        "access": {
            "method": "Official DSS Terminalfour search module JSON (Raw Search API Response)",
            "list": "GET ?endpoint=alf&perPage=500&page=N",
            "detail": "GET ?licenseId={licenseId}&endpoint=alf",
            "officialSearch": "https://www.dss.virginia.gov/licensed-care/search-licensing-programs/assisted-living-facility-search/",
        },
        "alf": {
            "listCount": len(alf_list),
            "detailCount": len(alf_details),
            "list": alf_list,
            "details": {str(k): v for k, v in sorted(alf_details.items())},
        },
        "adc": {
            "status": adc_status,
            "listCount": len(adc_list),
            "detailCount": len(adc_details),
            "list": adc_list,
            "details": {str(k): v for k, v in sorted(adc_details.items())},
        },
        "droppedFromPublication": [
            "administrator first/last name",
            "inspector person name",
            "inspector phone",
        ],
    }
    out = ART / "va-sen-001-dss-raw.json"
    out.write_text(json.dumps(bundle, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("wrote", out, "alf", len(alf_list), "adc", adc_status, len(adc_list))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
