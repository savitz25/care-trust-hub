#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

RAW = Path("data/ohio/oh-sen-001/raw")
RAW.mkdir(parents=True, exist_ok=True)
UA = "SeniorTrustHub-research/1.0"


def fetch(url: str, dest: str, timeout: int = 40) -> Path:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    out = RAW / dest
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        out.write_bytes(resp.read())
    return out


def main() -> None:
    html = (RAW / "odh-eid.html").read_text(encoding="utf-8", errors="replace")
    print("EID hrefs", re.findall(r'href="([^"]+)"', html)[:30])
    print("postbacks", sorted(set(re.findall(r"doPostBack\(([^)]+)\)", html))))
    for name, url in [
        ("arcgis-hh.json", "https://www.arcgis.com/sharing/rest/search?q=Ohio%20home%20health%20OneSource&f=json&num=20"),
        ("arcgis-hos.json", "https://www.arcgis.com/sharing/rest/search?q=Ohio%20hospice%20licensed&f=json&num=20"),
        ("arcgis-all-odh.json", "https://www.arcgis.com/sharing/rest/search?q=owner:ldslattery_OEMA%20Ohio&f=json&num=50"),
    ]:
        path = fetch(url, name)
        data = json.loads(path.read_text(encoding="utf-8"))
        print(name, [(r.get("title"), (r.get("url") or "")[:90]) for r in data.get("results", [])[:12]])


if __name__ == "__main__":
    main()
