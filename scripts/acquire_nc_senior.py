#!/usr/bin/env python3
"""NC-SEN-001 — acquire DHSR listings, star/FID index, penalties, SOD index, programs."""
from __future__ import annotations

import csv
import gzip
import hashlib
import io
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

from openpyxl import load_workbook
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/north-carolina/nc-sen-001/raw"
DERIVED = ROOT / "data/north-carolina/nc-sen-001/derived"
UA = "SeniorTrustHub/nc-sen-001 research (official public records)"
STAR_URL = "https://info.ncdhhs.gov/dhsr/acls/star/results.asp"
COUNTIES = [
    "Alamance", "Alexander", "Alleghany", "Anson", "Ashe", "Avery", "Beaufort", "Bertie",
    "Bladen", "Brunswick", "Buncombe", "Burke", "Cabarrus", "Caldwell", "Camden", "Carteret",
    "Caswell", "Catawba", "Chatham", "Cherokee", "Chowan", "Clay", "Cleveland", "Columbus",
    "Craven", "Cumberland", "Currituck", "Dare", "Davidson", "Davie", "Duplin", "Durham",
    "Edgecombe", "Forsyth", "Franklin", "Gaston", "Gates", "Granville", "Greene", "Guilford",
    "Halifax", "Harnett", "Haywood", "Henderson", "Hertford", "Hoke", "Iredell", "Jackson",
    "Johnston", "Jones", "Lee", "Lenoir", "Lincoln", "Macon", "Madison", "Martin", "Mcdowell",
    "Mecklenburg", "Mitchell", "Montgomery", "Moore", "Nash", "New Hanover", "Northampton",
    "Onslow", "Orange", "Pamlico", "Pasquotank", "Pender", "Perquimans", "Person", "Pitt",
    "Polk", "Randolph", "Richmond", "Robeson", "Rockingham", "Rowan", "Rutherford", "Sampson",
    "Scotland", "Stanly", "Stokes", "Surry", "Swain", "Transylvania", "Tyrrell", "Union",
    "Vance", "Wake", "Warren", "Washington", "Watauga", "Wayne", "Wilkes", "Wilson", "Yadkin",
    "Yancey",
]


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_sha(path: Path) -> str:
    return sha_bytes(path.read_bytes())


def write_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_csv_gz(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    raw = buf.getvalue().encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(gzip.compress(raw, mtime=0))
    return hashlib.sha256(raw).hexdigest()


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tables: list[list[list[str]]] = []
        self.hrefs: list[tuple[str, str]] = []
        self._table: list[list[str]] | None = None
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self._href: str | None = None
        self._in_cell = False

    def handle_starttag(self, tag, attrs):
        ad = dict(attrs)
        if tag == "table":
            self._table = []
        elif tag == "tr" and self._table is not None:
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = []
            self._in_cell = True
        elif tag == "a" and self._in_cell:
            href = ad.get("href") or ""
            self._href = href

    def handle_endtag(self, tag):
        if tag in {"td", "th"} and self._in_cell and self._row is not None:
            text = re.sub(r"\s+", " ", "".join(self._cell)).strip()
            self._row.append(text)
            if self._href:
                self.hrefs.append((text, self._href))
            self._cell = None
            self._in_cell = False
            self._href = None
        elif tag == "tr" and self._row is not None and self._table is not None:
            if any(self._row):
                self._table.append(self._row)
            self._row = None
        elif tag == "table" and self._table is not None:
            if self._table:
                self.tables.append(self._table)
            self._table = None

    def handle_data(self, data):
        if self._in_cell and self._cell is not None:
            self._cell.append(data)


def parse_html_tables(html: str) -> TableParser:
    parser = TableParser()
    parser.feed(html)
    return parser


def xlsx_records(path: Path, header_idx: int) -> tuple[list[dict[str, str]], str | None]:
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    data = list(ws.iter_rows(values_only=True))
    wb.close()
    headers = [str(c).strip() if c else f"COL{i}" for i, c in enumerate(data[header_idx])]
    recs: list[dict[str, str]] = []
    footer = None
    for row in data[header_idx + 1 :]:
        joined = " ".join(str(c) for c in row if c is not None)
        if "Total number of facilities" in joined:
            footer = joined
            continue
        if not any(x is not None and str(x).strip() for x in row):
            continue
        rec = {}
        for i, h in enumerate(headers):
            val = row[i] if i < len(row) else None
            rec[h] = "" if val is None else str(val).strip()
        recs.append(rec)
    return recs, footer


def fetch(url: str, data: dict[str, str] | None = None, retries: int = 4) -> bytes:
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(
        url,
        data=body,
        headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"} if data else {"User-Agent": UA},
        method="POST" if data else "GET",
    )
    last: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return resp.read()
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"fetch failed {url}: {last}")


def scrape_star_counties() -> list[dict[str, str]]:
    out_dir = RAW / "star-counties"
    out_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str]] = []
    for county in COUNTIES:
        dest = out_dir / f"{county.lower().replace(' ', '-')}.html"
        if dest.exists() and dest.stat().st_size > 500:
            html = dest.read_text(encoding="utf-8", errors="replace")
        else:
            raw = fetch(STAR_URL, {"type": "County", "county": county, "submit": "Search by County"})
            dest.write_bytes(raw)
            html = raw.decode("utf-8", "replace")
            time.sleep(0.15)
        parser = parse_html_tables(html)
        fid_by_name: dict[str, str] = {}
        for text, href in parser.hrefs:
            m = re.search(r"fid=(\d+)", href, re.I)
            if m:
                fid_by_name[text] = m.group(1)
        for table in parser.tables:
            if not table or len(table[0]) < 5:
                continue
            header = [c.lower() for c in table[0]]
            if "license" not in " ".join(header) or "name" not in " ".join(header):
                continue
            # Stars | (n) | Score | Name | License | Address | City | Zip
            for rec in table[1:]:
                if len(rec) < 5:
                    continue
                name = rec[3] if len(rec) > 3 else ""
                license_id = rec[4] if len(rec) > 4 else ""
                if not re.match(r"^(HAL|FCL)-", license_id, re.I):
                    # some tables may shift if star image cell missing
                    continue
                stars_raw = rec[1] if len(rec) > 1 else ""
                stars_m = re.search(r"(\d+)", stars_raw)
                rows.append(
                    {
                        "county": county,
                        "fid": fid_by_name.get(name, ""),
                        "name": name,
                        "license": license_id.upper(),
                        "stars": stars_m.group(1) if stars_m else "",
                        "score": rec[2] if len(rec) > 2 else "",
                        "address": rec[5] if len(rec) > 5 else "",
                        "city": rec[6] if len(rec) > 6 else "",
                        "zip": rec[7] if len(rec) > 7 else "",
                    }
                )
    return rows


def parse_penalties(html: str) -> list[dict[str, str]]:
    parser = parse_html_tables(html)
    rows: list[dict[str, str]] = []
    current_county = ""
    # county headings are outside tables; recover county from nearby h3 via regex
    county_blocks = re.findall(
        r"<h3>([^<]+ County)</h3>.*?<table class=\"penalty\">(.*?)</table>",
        html,
        flags=re.I | re.S,
    )
    if not county_blocks:
        # fallback: all penalty tables
        for table in parser.tables:
            header = [c.lower() for c in table[0]] if table else []
            if "facility license" not in " ".join(header):
                continue
            for rec in table[1:]:
                if len(rec) < 8:
                    continue
                rows.append(
                    {
                        "county": current_county,
                        "facility": rec[0],
                        "license": rec[1].upper(),
                        "inspection_date": rec[2],
                        "rules": rec[3],
                        "level": rec[4],
                        "amount": rec[5],
                        "imposed_date": rec[6],
                        "status": rec[7],
                    }
                )
        return rows
    for county, body in county_blocks:
        inner = parse_html_tables(f"<table>{body}</table>")
        for table in inner.tables:
            for rec in table:
                if rec and rec[0].lower() == "facility":
                    continue
                if len(rec) < 8:
                    continue
                rows.append(
                    {
                        "county": county.replace(" County", ""),
                        "facility": rec[0],
                        "license": rec[1].upper(),
                        "inspection_date": rec[2],
                        "rules": rec[3],
                        "level": rec[4],
                        "amount": rec[5],
                        "imposed_date": rec[6],
                        "status": rec[7],
                    }
                )
    return rows


def parse_nh_sod(html: str) -> list[dict[str, str]]:
    parser = parse_html_tables(html)
    rows = []
    fid_by_name = {}
    for text, href in parser.hrefs:
        m = re.search(r"fid=(\d+)", href, re.I)
        if m:
            fid_by_name[text] = m.group(1)
    county = ""
    for m in re.finditer(r"<h3>([^<]+)</h3>(.*?)</table>", html, flags=re.I | re.S):
        county = m.group(1).replace(" County", "").strip()
        inner = parse_html_tables("<table>" + m.group(2) + "</table>")
        for table in inner.tables:
            for rec in table:
                if not rec or rec[0].lower() == "name":
                    continue
                name = rec[0]
                rows.append(
                    {
                        "county": county,
                        "name": name,
                        "fid": fid_by_name.get(name, ""),
                        "address": rec[1] if len(rec) > 1 else "",
                        "city": rec[2] if len(rec) > 2 else "",
                        "zip": rec[3] if len(rec) > 3 else "",
                    }
                )
    return rows


def parse_ccrc_map(path: Path) -> list[dict[str, str]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    rows = []
    reader = csv.DictReader(io.StringIO(text))
    for rec in reader:
        title = rec.get("title") or ""
        county = (rec.get("county") or "").strip()
        if not title.strip():
            continue
        parts = re.split(r"<br\s*/?>", title, flags=re.I)
        for part in parts:
            item = re.sub(r"^[\s\-]+", "", re.sub(r"<[^>]+>", "", part)).strip(" -")
            if not item:
                continue
            if " - " in item:
                city, name = item.split(" - ", 1)
            else:
                city, name = "", item
            rows.append({"county": county, "city": city.strip(), "name": name.strip()})
    return rows


def parse_ccah(html: str) -> list[dict[str, str]]:
    parser = parse_html_tables(html)
    rows = []
    for table in parser.tables:
        header = [c.lower() for c in table[0]] if table else []
        if "facility name" not in " ".join(header):
            continue
        for rec in table[1:]:
            if len(rec) < 3:
                continue
            rows.append({"name": rec[0], "city": rec[1], "date_licensed": rec[2]})
    return rows


def parse_adc_pdf(path: Path) -> dict:
    reader = PdfReader(str(path))
    text = "\n".join((p.extract_text() or "") for p in reader.pages)
    types = Counter()
    # TYPE column values appear as standalone tokens
    for m in re.finditer(r"\b(ADC/ADH|ADC/ALZ|ADC,\s*DD|ADH|ADC)\b", text):
        token = re.sub(r"\s+", "", m.group(1).replace(",", "/"))
        if token == "ADC/DD":
            token = "ADC_DD"
        types[token] += 1
    rec_nums = [int(n) for n in re.findall(r"(?m)^\s*(\d{1,3})\s+\n?[A-Z][a-z]+", text)]
    # fallback: numbered records "1 Alamance"
    rec_nums2 = [int(n) for n in re.findall(r"(?m)^\s*(\d{1,3})\s+[A-Z][a-z]+", text)]
    return {
        "pages": len(reader.pages),
        "sha256": file_sha(path),
        "type_token_counts": dict(types),
        "max_rec_num": max(rec_nums2) if rec_nums2 else None,
        "date_in_text": "4/21/2026" if "4/21/2026" in text or "4/21/2026" in text.replace(" ", "") else None,
        "has_adc_label": "ADC:" in text,
        "excerpt_head": text[:800],
    }


def parse_pace_pdf(path: Path) -> dict:
    reader = PdfReader(str(path))
    text = "\n".join((p.extract_text() or "") for p in reader.pages)
    npis = sorted(set(re.findall(r"NPI\s+(\d{10})", text)))
    orgs = re.findall(r"(?m)^([A-Z][A-Za-z@ /&'\-]+)\s*\n\s*\(NPI", text)
    if not orgs:
        orgs = re.findall(r"PACE ORGANIZATION[^\n]*\n([^\n]+)", text)
    return {
        "pages": len(reader.pages),
        "sha256": file_sha(path),
        "npi_count": len(npis),
        "npis": npis,
        "org_name_hits": orgs,
        "mentions_11": "11 PACE organizations" in text or "There are 11 PACE" in text,
        "excerpt_head": text[:1200],
    }


def parse_ccrc_handbook(path: Path) -> dict:
    reader = PdfReader(str(path))
    text = "\n".join((p.extract_text() or "") for p in reader.pages)
    # Provider ID 0001 Community ID 01
    pairs = re.findall(r"(?m)^\s*(\d{4})\s+(\d{2})\s+(.+)$", text)
    return {
        "pages": len(reader.pages),
        "sha256": file_sha(path),
        "id_row_hits": len(pairs),
        "sample": pairs[:8],
        "has_appendix_c": "Provider and Community ID Directory" in text,
    }


def money(value: str) -> float | None:
    m = re.search(r"\$?\s*([\d,]+(?:\.\d{1,2})?)", value or "")
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    DERIVED.mkdir(parents=True, exist_ok=True)
    retrieved = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    ach, ach_footer = xlsx_records(RAW / "Ahlist.xlsx", 2)
    fch, fch_footer = xlsx_records(RAW / "Fchlist.xlsx", 2)
    nh, nh_footer = xlsx_records(RAW / "Nhlist_a.xlsx", 4)
    hh, hh_footer = xlsx_records(RAW / "hhlist.xlsx", 4)
    hos, hos_footer = xlsx_records(RAW / "hoslist.xlsx", 4)
    hc, hc_footer = xlsx_records(RAW / "hclist.xlsx", 2)
    npool, np_footer = xlsx_records(RAW / "nursingpool.xlsx", 4)
    hchos, _ = xlsx_records(RAW / "hchos.xlsx", 4)
    hhhos, _ = xlsx_records(RAW / "hhhos.xlsx", 4)
    scu, _ = xlsx_records(RAW / "sculist.xlsx", 2) if (RAW / "sculist.xlsx").exists() else ([], None)

    def licenses(rows: list[dict[str, str]]) -> list[str]:
        return [r.get("License #", "").strip() for r in rows if r.get("License #", "").strip()]

    ach = [r for r in ach if r.get("License #")]
    fch = [r for r in fch if r.get("License #")]
    nh = [r for r in nh if r.get("License #")]
    hh = [r for r in hh if r.get("License #")]
    hos = [r for r in hos if r.get("License #")]
    hc = [r for r in hc if r.get("License #")]
    npool = [r for r in npool if r.get("License #")]
    hchos = [r for r in hchos if r.get("License #")]
    hhhos = [r for r in hhhos if r.get("License #")]

    print("scraping star counties...", flush=True)
    star_rows = scrape_star_counties()
    print(f"star rows {len(star_rows)}", flush=True)

    penalties_html = (RAW / "adultcarepenalties.html").read_text(encoding="utf-8", errors="replace")
    penalty_rows = parse_penalties(penalties_html)
    print(f"penalty rows {len(penalty_rows)}", flush=True)

    sod_html = (RAW / "nh-sod-all.html").read_text(encoding="utf-8", errors="replace")
    sod_rows = parse_nh_sod(sod_html)
    print(f"sod index rows {len(sod_rows)}", flush=True)

    ccrc_rows = parse_ccrc_map(RAW / "ccrc-map-export.csv")
    ccah_rows = parse_ccah((RAW / "ccah.html").read_text(encoding="utf-8", errors="replace"))
    adc = parse_adc_pdf(RAW / "adc-provider-list-2026-04-21.pdf")
    pace = parse_pace_pdf(RAW / "pace-service-area.pdf")
    handbook = parse_ccrc_handbook(RAW / "ccrc-disclosure-handbook.pdf")

    ach_keep = ["License #", "Name of Licensee Legal Name", "DBA Name", "Site Address", "Site City", "Site Zip", "County", "Bed Count", "Star Rating", "Expiry Date"]
    fch_keep = ach_keep
    nh_keep = ["County", "License #", "DBA Name", "Name of Licensee Legal Name", "Site Address", "Site City", "Site Zip", "NH Total Beds"]
    hh_keep = ["License #", "DBA Name", "Name of Licensee Legal Name", "Site Address", "Site City", "Site Zip", "County", "Expiry Date"]

    census = {
        "retrievedAt": retrieved,
        "listings": {
            "ach": {
                "rows": len(ach),
                "distinct_licenses": len(set(licenses(ach))),
                "star_dist": dict(Counter(r.get("Star Rating") or "BLANK" for r in ach)),
                "footer": ach_footer,
                "sha256": file_sha(RAW / "Ahlist.xlsx"),
                "sourceUpdated": "2026-07-30",
            },
            "fch": {
                "rows": len(fch),
                "distinct_licenses": len(set(licenses(fch))),
                "star_dist": dict(Counter(r.get("Star Rating") or "BLANK" for r in fch)),
                "footer": fch_footer,
                "sha256": file_sha(RAW / "Fchlist.xlsx"),
                "sourceUpdated": "2026-07-30",
            },
            "nursing_home": {
                "rows": len(nh),
                "distinct_licenses": len(set(licenses(nh))),
                "footer": nh_footer,
                "sha256": file_sha(RAW / "Nhlist_a.xlsx"),
                "sourceUpdated": "2026-09-09",
            },
            "home_health": {
                "rows": len(hh),
                "distinct_licenses": len(set(licenses(hh))),
                "sha256": file_sha(RAW / "hhlist.xlsx"),
                "sourceUpdated": "2026-08-20",
            },
            "hospice": {
                "rows": len(hos),
                "distinct_licenses": len(set(licenses(hos))),
                "sha256": file_sha(RAW / "hoslist.xlsx"),
                "sourceUpdated": "2026-08-20",
            },
            "home_care_all_mixed": {
                "rows": len(hc),
                "distinct_licenses": len(set(licenses(hc))),
                "hh_licenses_inside": len(set(licenses(hh)) & set(licenses(hc))),
                "hchos_inside": len(set(licenses(hchos)) & set(licenses(hc))),
                "hhhos_inside": len(set(licenses(hhhos)) & set(licenses(hc))),
                "np_inside": len(set(licenses(npool)) & set(licenses(hc))),
                "hos_inside": len(set(licenses(hos)) & set(licenses(hc))),
                "sha256": file_sha(RAW / "hclist.xlsx"),
                "sourceUpdated": "2026-08-20",
                "not_home_care_agency_count": True,
            },
            "home_care_with_hospice_subset": {"rows": len(hchos), "distinct_licenses": len(set(licenses(hchos)))},
            "home_health_with_hospice_subset": {"rows": len(hhhos), "distinct_licenses": len(set(licenses(hhhos)))},
            "nursing_pool": {
                "rows": len(npool),
                "distinct_licenses": len(set(licenses(npool))),
                "sha256": file_sha(RAW / "nursingpool.xlsx"),
                "sourceUpdated": "2026-08-20",
            },
            "special_care_units": {"rows": len(scu)},
        },
        "star_index": {
            "rows": len(star_rows),
            "distinct_licenses": len({r["license"] for r in star_rows if r["license"]}),
            "distinct_fids": len({r["fid"] for r in star_rows if r["fid"]}),
            "missing_fid": sum(1 for r in star_rows if not r["fid"]),
            "star_dist": dict(Counter(r["stars"] or "BLANK" for r in star_rows)),
            "counties": len({r["county"] for r in star_rows}),
        },
        "penalties": {
            "rows": len(penalty_rows),
            "distinct_licenses": len({r["license"] for r in penalty_rows if r["license"]}),
            "distinct_events": len({(r["license"], r["imposed_date"], r["rules"], r["amount"]) for r in penalty_rows}),
            "amount_total": round(sum(filter(None, (money(r["amount"]) for r in penalty_rows))), 2),
            "level_dist": dict(Counter(r["level"] for r in penalty_rows)),
        },
        "nh_sod_index": {
            "rows": len(sod_rows),
            "distinct_fids": len({r["fid"] for r in sod_rows if r["fid"]}),
            "missing_fid": sum(1 for r in sod_rows if not r["fid"]),
        },
        "ccrc": {"map_communities": len(ccrc_rows), "names": [r["name"] for r in ccrc_rows], "handbook": handbook},
        "ccah": {"rows": len(ccah_rows), "names": [r["name"] for r in ccah_rows]},
        "adult_day": adc,
        "pace": pace,
    }

    write_csv_gz(DERIVED / "ach.csv.gz", ach, ach_keep)
    write_csv_gz(DERIVED / "fch.csv.gz", fch, fch_keep)
    write_csv_gz(DERIVED / "nh.csv.gz", nh, nh_keep)
    write_csv_gz(DERIVED / "hh.csv.gz", hh, hh_keep)
    write_csv_gz(DERIVED / "star-index.csv.gz", star_rows, ["county", "fid", "name", "license", "stars", "score", "address", "city", "zip"])
    write_csv_gz(
        DERIVED / "penalties.csv.gz",
        penalty_rows,
        ["county", "facility", "license", "inspection_date", "rules", "level", "amount", "imposed_date", "status"],
    )
    write_csv_gz(DERIVED / "nh-sod-index.csv.gz", sod_rows, ["county", "name", "fid", "address", "city", "zip"])
    write_csv_gz(DERIVED / "ccrc-map.csv.gz", ccrc_rows, ["county", "city", "name"])
    write_json(DERIVED / "census.json", census)
    print(json.dumps({k: census[k] if k != "ccrc" else {"map_communities": census["ccrc"]["map_communities"], "handbook": census["ccrc"]["handbook"]} for k in census}, indent=2)[:8000])


if __name__ == "__main__":
    main()
