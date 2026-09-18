#!/usr/bin/env python3
from __future__ import annotations

import re
import urllib.parse
import urllib.request
from pathlib import Path

RAW = Path("data/ohio/oh-sen-001/raw")
html = (RAW / "odh-eid.html").read_text(encoding="utf-8", errors="replace")
vs = re.search(r'id="__VIEWSTATE" value="([^"]*)"', html).group(1)
vg = re.search(r'id="__VIEWSTATEGENERATOR" value="([^"]*)"', html).group(1)
ev = re.search(r'id="__EVENTVALIDATION" value="([^"]*)"', html).group(1)
body = urllib.parse.urlencode(
    {
        "__EVENTTARGET": "_ctl0$EidContentPlaceHolder$lbtn_Provider_Reports",
        "__EVENTARGUMENT": "",
        "__VIEWSTATE": vs,
        "__VIEWSTATEGENERATOR": vg,
        "__EVENTVALIDATION": ev,
    }
).encode()
req = urllib.request.Request(
    "https://publicapps.odh.ohio.gov/eid/Default.aspx",
    data=body,
    headers={
        "User-Agent": "SeniorTrustHub-research/1.0",
        "Content-Type": "application/x-www-form-urlencoded",
    },
    method="POST",
)
with urllib.request.urlopen(req, timeout=40) as resp:
    data = resp.read()
    print("status", resp.status, "url", resp.geturl(), "len", len(data))
(RAW / "odh-reports.html").write_bytes(data)
text = data.decode("utf-8", "replace")
print("title", re.search(r"<title>([^<]+)", text).group(1) if re.search(r"<title>", text) else None)
print("selects", re.findall(r"<select[^>]*name=\"([^\"]+)\"", text)[:20])
print("options sample", re.findall(r"<option[^>]*>([^<]{1,80})", text)[:40])
