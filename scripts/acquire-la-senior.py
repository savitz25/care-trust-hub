"""LA-SEN-001: count LDH Health Standards directory rows by class (stdlib only).

Pages https://ldh.la.gov/directory/category/{id}?pn=N and counts <li> source rows
inside ul.results. Facility names, addresses, phones, and raw HTML are not stored.
A repeated printed name is still a source row. Detail ids are not licensed-campus ids.

  python -X utf8 scripts/acquire-la-senior.py fetch
  python -X utf8 scripts/acquire-la-senior.py check
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/web/src/data/louisiana-public-snapshot.json"
RETRIEVED_AT = "2026-10-05"
PAGE_SIZE = 20
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

# Official HSS directory categories for senior facility classes. Not a combined census.
CLASSES = [
    ("nursing-home", 173, "HSS - Nursing Homes"),
    ("adult-residential-care", 161, "HSS - Adult Residential Care"),
    ("home-health", 167, "HSS - Home Health Agencies"),
    ("hospice", 168, "HSS - Hospice"),
    ("adult-day-health-care", 238, "HSS - Adult Day Health Care"),
    ("icf-iid", 170, "HSS - Intermediate Care for Dev. Disabled"),
]


def fetch_page(category_id: int, page: int) -> str:
    url = f"https://ldh.la.gov/directory/category/{category_id}"
    if page > 1:
        url += f"?pn={page}"
    last_error: Exception | None = None
    for attempt in range(4):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                if resp.status != 200:
                    raise RuntimeError(f"{url} status {resp.status}")
                return resp.read().decode("utf-8", "replace")
        except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"fetch failed {url}: {last_error}")


def text_of(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def parse_results(page_html: str) -> tuple[str, list[tuple[str, str | None]]]:
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", page_html, re.S)
    title = text_of(h1.group(1)) if h1 else ""
    block = re.search(r'<ul class="results">(.*?)</ul>', page_html, re.S)
    if not block:
        raise RuntimeError("results list missing")
    rows = []
    for item in re.findall(r"<li\b(.*?)</li>", block.group(1), re.S):
        name_match = re.search(r"<h2[^>]*>(.*?)</h2>", item, re.S)
        # Numeric detail ids are the usual record key. A few state centers use a slug URL instead.
        detail = re.search(r'href="(/directory/(?:detail/\d+|[^"]+))"', item)
        rows.append((text_of(name_match.group(1)) if name_match else "", detail.group(1) if detail else None))
    ccn_printed = bool(re.search(r"\bCCN\b|CMS Certification Number|Medicare Provider Number", block.group(1)))
    if ccn_printed:
        raise RuntimeError("results HTML printed a CMS identifier; do not silently drop it")
    return title, rows


def count_class(source_class: str, category_id: int, expected_label: str) -> dict:
    seen_ids: set[str] = set()
    names: list[str] = []
    page = 1
    while page <= 80:
        title, rows = parse_results(fetch_page(category_id, page))
        if title != expected_label:
            raise RuntimeError(f"{source_class}: h1 {title!r} != {expected_label!r}")
        if not rows:
            if page == 1:
                raise RuntimeError(f"{source_class}: empty first page")
            break
        if page > 1 and len(rows) > PAGE_SIZE:
            raise RuntimeError(f"{source_class}: page {page} has {len(rows)} rows")
        if len(rows) > PAGE_SIZE:
            raise RuntimeError(f"{source_class}: page {page} has {len(rows)} rows")
        page_ids = [detail_id for _, detail_id in rows if detail_id]
        if len(page_ids) != len(rows):
            raise RuntimeError(f"{source_class}: page {page} row without a directory link")
        overlap = seen_ids.intersection(page_ids)
        if overlap:
            raise RuntimeError(f"{source_class}: page {page} repeats detail ids {sorted(overlap)[:5]}")
        seen_ids.update(page_ids)
        names.extend(name.casefold() for name, _ in rows)
        full = len(rows) == PAGE_SIZE
        page += 1
        if not full:
            # Confirm the next page is empty so a short page is really the last page.
            next_title, next_rows = parse_results(fetch_page(category_id, page))
            if next_title != expected_label:
                raise RuntimeError(f"{source_class}: trailing h1 {next_title!r}")
            if next_rows:
                raise RuntimeError(f"{source_class}: page {page - 1} was short but page {page} still has rows")
            break
        time.sleep(0.15)
    else:
        raise RuntimeError(f"{source_class}: page limit hit")
    page_count = page - 1
    row_count = len(names)
    if row_count != len(seen_ids):
        raise RuntimeError(f"{source_class}: row count {row_count} != detail ids {len(seen_ids)}")
    if row_count <= (page_count - 1) * PAGE_SIZE or row_count > page_count * PAGE_SIZE:
        raise RuntimeError(f"{source_class}: {row_count} rows over {page_count} pages is inconsistent")
    distinct_names = len(set(names))
    return {
        "class": source_class,
        "label": expected_label,
        "rowCount": row_count,
        "pageCount": page_count,
        "sourceUrl": f"https://ldh.la.gov/directory/category/{category_id}",
        "retrievedAt": RETRIEVED_AT,
        "distinctDirectoryLinks": len(seen_ids),
        "distinctPrintedNames": distinct_names,
        "rowsAreDeduplicatedLicensedCampuses": False,
    }


def snapshot_from_counts(sources: list[dict]) -> dict:
    return {
        "regulator": "Louisiana Department of Health, Health Standards Section",
        "retrievedAt": RETRIEVED_AT,
        "retrievedAtNote": "Directory pages were read on 2026-10-05. Counts are source rows, not a deduplicated campus census and not a summed senior denominator.",
        "sources": sources,
        "combinedSeniorDenominator": None,
        "cmsExactBridges": 0,
        "cmsBridgeReason": "CMS Care Compare is a federal overlay and was not bridged. Directory cards did not print a CCN.",
        "surveyProgram": "KNOWN",
        "surveyProgramUrl": "https://ldh.la.gov/health-standards-section",
        "inspectionEventRows": "NOT_ACQUIRED",
        "complaintIntake": "KNOWN",
        "complaintIntakeUrl": "https://ldh.la.gov/page/file-a-complaint",
        "complaintProviderRows": "NOT_ACQUIRED",
        "enforcementRows": "NOT_ACQUIRED",
        "nameOnlyAdverseJoins": 0,
        "newCanonicalFacilities": 0,
        "graphWrites": 0,
        "claimEligibilityChanges": 0,
        "parishRoutes": 0,
    }


def serialize(snapshot: dict) -> str:
    return json.dumps(snapshot, indent=1, ensure_ascii=False) + "\n"


def fetch() -> None:
    today = datetime.now().astimezone().date().isoformat()
    if today != RETRIEVED_AT:
        raise SystemExit(f"local date {today} is not {RETRIEVED_AT}")
    sources = []
    for source_class, category_id, label in CLASSES:
        sources.append(count_class(source_class, category_id, label))
        print(
            source_class,
            sources[-1]["rowCount"],
            "pages",
            sources[-1]["pageCount"],
            "names",
            sources[-1]["distinctPrintedNames"],
            flush=True,
        )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(serialize(snapshot_from_counts(sources)), encoding="utf-8")
    print("wrote", OUT)


def check() -> None:
    committed = json.loads(OUT.read_text(encoding="utf-8"))
    if committed.get("combinedSeniorDenominator") is not None:
        raise SystemExit("combined senior denominator must stay null")
    if committed.get("cmsExactBridges") != 0 or committed.get("graphWrites") != 0:
        raise SystemExit("bridges or graph writes are not zero")
    if committed.get("inspectionEventRows") != "NOT_ACQUIRED":
        raise SystemExit("inspection event rows were not acquired")
    if committed.get("complaintProviderRows") != "NOT_ACQUIRED":
        raise SystemExit("complaint provider rows were not acquired")
    if committed.get("retrievedAt") != RETRIEVED_AT:
        raise SystemExit("retrievedAt is not 2026-10-05")
    expected = [(c, u, label) for c, u, label in ((a, f"https://ldh.la.gov/directory/category/{b}", d) for a, b, d in CLASSES)]
    sources = committed["sources"]
    if [s["class"] for s in sources] != [c for c, _, _ in expected]:
        raise SystemExit("class list changed")
    for source, (source_class, url, label) in zip(sources, expected):
        if source["sourceUrl"] != url or source["label"] != label:
            raise SystemExit(f"{source_class} source identity changed")
        if source["retrievedAt"] != RETRIEVED_AT:
            raise SystemExit(f"{source_class} retrievedAt")
        if source["rowsAreDeduplicatedLicensedCampuses"] is not False:
            raise SystemExit(f"{source_class} must not claim deduplicated campuses")
        rows = source["rowCount"]
        pages = source["pageCount"]
        if rows is None or pages is None:
            if source.get("status") != "NOT_ACQUIRED":
                raise SystemExit(f"{source_class} null count without NOT_ACQUIRED")
            continue
        if type(rows) is not int or rows < 1 or type(pages) is not int or pages < 1:
            raise SystemExit(f"{source_class} count is not a positive acquisition")
        if rows <= (pages - 1) * PAGE_SIZE or rows > pages * PAGE_SIZE:
            raise SystemExit(f"{source_class} row/page consistency")
        if source["distinctDirectoryLinks"] != rows:
            raise SystemExit(f"{source_class} directory links")
        if not 1 <= source["distinctPrintedNames"] <= rows:
            raise SystemExit(f"{source_class} printed names")
    if any(key in committed for key in ("rows", "total", "seniorTotal", "combinedRows")):
        raise SystemExit("snapshot must not store a facility dump or a summed total")
    print("LA-SEN-001 snapshot invariants PASS")
    for source in sources:
        print(source["class"], source["rowCount"], source["pageCount"], source["sourceUrl"])


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    if mode == "fetch":
        fetch()
    elif mode == "check":
        check()
    else:
        raise SystemExit("use fetch or check")
