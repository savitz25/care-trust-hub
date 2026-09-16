#!/usr/bin/env python3
"""Acquire ODHS LTC CSV exports and OHA HHA/Hospice PDFs. Network only."""
from __future__ import annotations

import gzip
import hashlib
import json
import re
import ssl
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.cookiejar import CookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/oregon/or-sen-001/raw"
UA = "SeniorTrustHub/or-sen-001 (research; +https://www.seniortrusthub.com)"
CTX = ssl.create_default_context()

PAGES = {
    "providers": "https://ltclicensing.oregon.gov/Providers",
    "inspections": "https://ltclicensing.oregon.gov/Inspections",
    "violations": "https://ltclicensing.oregon.gov/Violations",
    "actions": "https://ltclicensing.oregon.gov/RegulatoryActions",
}
PDFS = {
    "oha-hha.pdf": "https://www.oregon.gov/oha/PH/PROVIDERPARTNERRESOURCES/HEALTHCAREPROVIDERSFACILITIES/HEALTHCAREHEALTHCAREREGULATIONQUALITYIMPROVEMENT/Documents/HHAList.pdf",
    "oha-hospice.pdf": "https://www.oregon.gov/oha/PH/PROVIDERPARTNERRESOURCES/HEALTHCAREPROVIDERSFACILITIES/HEALTHCAREHEALTHCAREREGULATIONQUALITYIMPROVEMENT/Documents/HOSPICEList.pdf",
}


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def opener():
    jar = CookieJar()
    return urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=CTX),
        urllib.request.HTTPCookieProcessor(jar),
    )


def fetch(op, url: str, data: bytes | None = None) -> tuple[bytes, str]:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    if data is not None:
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        req.add_header("Referer", url.rsplit("/", 1)[0] + "/")
    with op.open(req, timeout=180) as resp:
        return resp.read(), resp.headers.get("Content-Type", "")


def token_and_pagesize(html: str) -> tuple[str, str]:
    tok = re.search(r'name="__RequestVerificationToken"[^>]*value="([^"]+)"', html)
    if not tok:
        raise SystemExit("antiforgery token missing")
    size = re.search(r'id="PageSize"[^>]*value="([^"]+)"', html)
    return tok.group(1), size.group(1) if size else "50000"


def export_csv(op, page_url: str, dest: Path) -> dict:
    html, _ = fetch(op, page_url)
    text = html.decode("utf-8", errors="replace")
    token, page_size = token_and_pagesize(text)
    export = page_url.split("?")[0].rstrip("/") + "/Export"
    body = urllib.parse.urlencode(
        {"PageSize": max(int(page_size), 50000), "type": "csv", "__RequestVerificationToken": token}
    ).encode()
    raw, ctype = fetch(op, export, body)
    dest.write_bytes(raw)
    gz = dest.with_suffix(dest.suffix + ".gz")
    gz.write_bytes(gzip.compress(raw, compresslevel=9))
    return {
        "path": str(dest.relative_to(ROOT)).replace("\\", "/"),
        "bytes": len(raw),
        "gz_bytes": gz.stat().st_size,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "content_type": ctype,
        "page_size": page_size,
        "export_url": export,
    }


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    retrieved = now()
    op = opener()
    report = {"retrievedAt": retrieved, "files": {}}
    for key, url in PAGES.items():
        dest = RAW / f"odhs-{key}.csv"
        print("export", key)
        report["files"][key] = export_csv(op, url, dest)
        print(key, report["files"][key]["bytes"])
    for name, url in PDFS.items():
        print("pdf", name)
        raw, ctype = fetch(op, url)
        dest = RAW / name
        dest.write_bytes(raw)
        report["files"][name] = {
            "path": str(dest.relative_to(ROOT)).replace("\\", "/"),
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "content_type": ctype,
            "url": url,
        }
    (RAW / "acquire-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v.get("bytes") for k, v in report["files"].items()}, indent=2))


if __name__ == "__main__":
    main()
