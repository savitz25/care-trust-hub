#!/usr/bin/env python3
"""NY-SEN-001A — acquire official NYSDOH bulk layers. No CMS redownload. No FOIL."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import ssl
import time
import urllib.request
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "new-york" / "ny-sen-001"
RAW = OUT / "raw"
CTX = ssl.create_default_context()
UA = "SeniorTrustHub NY-SEN-001 (+https://www.seniortrusthub.com)"
RETRIEVED = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

NH_VIEW = "dypu-nabu"
CERT_VIEW = "2g9y-7kqm"
GI_VIEW = "vn5v-hh5r"
DNR_URL = "https://www.health.ny.gov/facilities/adult_care/docs/acf_do_not_refer_list.pdf"

ACF_SHORT = {
    "AH",
    "EHP",
    "RA",
    "ALP",
    "ALR",
    "EALR",
    "SNALR",
}
ACF_DESC_HINTS = (
    "adult home",
    "enriched housing",
    "residence for adults",
    "assisted living program",
    "assisted living residence",
    "adult care facility",
)


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, context=CTX, timeout=180) as resp:
        return resp.read()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def soda_all(view: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    limit = 50000
    while True:
        url = f"https://health.data.ny.gov/resource/{view}.json?$limit={limit}&$offset={offset}"
        chunk = json.loads(get(url).decode("utf-8"))
        if not isinstance(chunk, list):
            raise SystemExit(f"unexpected SODA payload for {view}")
        rows.extend(chunk)
        print(f"  {view} +{len(chunk)} total={len(rows)}", flush=True)
        if len(chunk) < limit:
            break
        offset += limit
        time.sleep(0.2)
    return rows


def view_meta(view: str) -> dict:
    return json.loads(get(f"https://health.data.ny.gov/api/views/{view}.json").decode("utf-8"))


def unix_iso(value: object) -> str | None:
    try:
        n = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if n > 10_000_000_000:
        n = n // 1000
    return datetime.fromtimestamp(n, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def is_acf_row(row: dict) -> bool:
    short = str(row.get("fac_desc_short") or "").strip().upper()
    desc = str(row.get("description") or "").strip().lower()
    if short in ACF_SHORT:
        return True
    return any(h in desc for h in ACF_DESC_HINTS)


def parse_nh_zip(data: bytes) -> dict:
    zf = zipfile.ZipFile(io.BytesIO(data))
    names = zf.namelist()
    tables: dict[str, list[dict]] = {}
    for name in names:
        if not name.lower().endswith((".csv", ".txt", ".xlsx")):
            continue
        raw = zf.read(name)
        if name.lower().endswith(".csv") or name.lower().endswith(".txt"):
            text = raw.decode("utf-8-sig", "replace")
            reader = csv.DictReader(io.StringIO(text))
            tables[name] = list(reader)
    return {"files": names, "tables": tables}


def census_nh(tables: dict[str, list[dict]]) -> dict:
    summary = {}
    for name, rows in tables.items():
        cols = list(rows[0].keys()) if rows else []
        summary[name] = {
            "rows": len(rows),
            "columns": cols,
            "sampleKeys": cols[:30],
        }
    return summary


def parse_dnr_pdf(data: bytes) -> dict:
    text = ""
    try:
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:
        try:
            import subprocess

            tmp = RAW / "acf_do_not_refer_list.pdf"
            tmp.write_bytes(data)
            proc = subprocess.run(
                ["pdftotext", "-layout", str(tmp), "-"],
                capture_output=True,
                text=True,
                timeout=60,
            )
            text = proc.stdout or ""
        except Exception as exc:
            return {"parser": "FAILED", "error": str(exc), "observations": []}

    blocks = []
    current: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("Facility Name:"):
            if current:
                blocks.append(current)
            current = {"facilityName": line.split(":", 1)[1].strip()}
            continue
        for key, prefix in [
            ("operator", "Facility Operator:"),
            ("address", "Facility Address:"),
            ("facilityType", "Facility Type:"),
            ("dohRegion", "DOH Region:"),
            ("county", "County:"),
            ("reason", "Reason:"),
            ("status", "Status:"),
            ("operatingCertificate", "Operating Certificate:"),
            ("facilityId", "Facility ID:"),
            ("certificateNumber", "Certificate Number:"),
        ]:
            if line.startswith(prefix):
                current[key] = line.split(":", 1)[1].strip()
                break
    if current:
        blocks.append(current)
    reasons = Counter(b.get("reason") or "UNKNOWN" for b in blocks)
    types = Counter(b.get("facilityType") or "UNKNOWN" for b in blocks)
    with_cert = sum(1 for b in blocks if b.get("operatingCertificate") or b.get("certificateNumber"))
    with_fid = sum(1 for b in blocks if b.get("facilityId"))
    return {
        "parser": "pypdf_or_pdftotext",
        "pageTextChars": len(text),
        "observations": blocks,
        "observationCount": len(blocks),
        "reasonDistribution": reasons.most_common(),
        "typeDistribution": types.most_common(),
        "rowsWithOperatingCertificate": with_cert,
        "rowsWithFacilityId": with_fid,
        "headerSnippet": text[:800],
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)

    print("NH PROFILE ZIP", flush=True)
    nh_meta = view_meta(NH_VIEW)
    blob_id = nh_meta["blobId"]
    zip_url = f"https://health.data.ny.gov/api/views/{NH_VIEW}/files/{blob_id}?download=true&filename=NH%20Profiles.zip"
    zip_path = RAW / "nh-profiles.zip"
    if zip_path.exists() and zip_path.stat().st_size > 1000:
        nh_zip = zip_path.read_bytes()
        print("  using cached zip", zip_path.stat().st_size, flush=True)
    else:
        nh_zip = get(zip_url)
        zip_path.write_bytes(nh_zip)
    parsed = parse_nh_zip(nh_zip)
    print("NH files", parsed["files"], flush=True)
    for name, rows in parsed["tables"].items():
        print(" ", name, len(rows), list(rows[0].keys())[:12] if rows else [], flush=True)
        out_csv = RAW / Path(name).name
        if rows:
            with out_csv.open("w", encoding="utf-8", newline="") as fh:
                w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
                w.writeheader()
                w.writerows(rows)

    print("CERT", flush=True)
    cert_meta = view_meta(CERT_VIEW)
    cert_rows = soda_all(CERT_VIEW)
    (RAW / "health-facility-certification.json").write_text(
        json.dumps(cert_rows), encoding="utf-8"
    )

    print("GI", flush=True)
    gi_meta = view_meta(GI_VIEW)
    gi_rows = soda_all(GI_VIEW)
    (RAW / "health-facility-general-information.json").write_text(
        json.dumps(gi_rows), encoding="utf-8"
    )

    print("DNR PDF", flush=True)
    dnr = get(DNR_URL)
    (RAW / "acf_do_not_refer_list.pdf").write_bytes(dnr)
    dnr_parsed = parse_dnr_pdf(dnr)
    (RAW / "acf_do_not_refer_parsed.json").write_text(
        json.dumps(dnr_parsed, indent=2), encoding="utf-8"
    )
    print("DNR observations", dnr_parsed.get("observationCount"), flush=True)

    census = {
        "retrievedAt": RETRIEVED,
        "nursingHomeProfile": {
            "viewId": NH_VIEW,
            "officialUrl": "https://health.data.ny.gov/Health/Nursing-Home-Profile/dypu-nabu",
            "blobFilename": nh_meta.get("blobFilename"),
            "blobFileSize": nh_meta.get("blobFileSize"),
            "sha256": sha256_bytes(nh_zip),
            "viewLastModified": unix_iso(nh_meta.get("viewLastModified")),
            "files": parsed["files"],
            "tables": census_nh(parsed["tables"]),
        },
        "certification": {
            "viewId": CERT_VIEW,
            "officialUrl": "https://health.data.ny.gov/Health/Health-Facility-Certification-Information/2g9y-7kqm",
            "rowCount": len(cert_rows),
            "viewLastModified": unix_iso(cert_meta.get("viewLastModified")),
            "rowsUpdatedAt": unix_iso(cert_meta.get("rowsUpdatedAt")),
        },
        "generalInformation": {
            "viewId": GI_VIEW,
            "officialUrl": "https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r",
            "rowCount": len(gi_rows),
            "viewLastModified": unix_iso(gi_meta.get("viewLastModified")),
            "rowsUpdatedAt": unix_iso(gi_meta.get("rowsUpdatedAt")),
        },
        "doNotRefer": {
            "officialUrl": DNR_URL,
            "bytes": len(dnr),
            "sha256": sha256_bytes(dnr),
            "observationCount": dnr_parsed.get("observationCount"),
            "rowsWithOperatingCertificate": dnr_parsed.get("rowsWithOperatingCertificate"),
            "rowsWithFacilityId": dnr_parsed.get("rowsWithFacilityId"),
            "reasonDistribution": dnr_parsed.get("reasonDistribution"),
        },
    }
    (OUT / "acquisition-meta.json").write_text(json.dumps(census, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: (v if k != "nursingHomeProfile" else {**v, "tables": list(v.get("tables", {}))}) for k, v in census.items()}, indent=2)[:3000])


if __name__ == "__main__":
    main()
