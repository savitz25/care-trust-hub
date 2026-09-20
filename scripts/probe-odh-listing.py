#!/usr/bin/env python3
from __future__ import annotations

import http.cookiejar
import re
import urllib.parse
import urllib.request
from pathlib import Path

RAW = Path("data/ohio/oh-sen-001/raw")
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
UA = {"User-Agent": "SeniorTrustHub-research/1.0"}


def fields(html: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for name, value in re.findall(r'<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"', html):
        out[name] = value
    return out


def post(url: str, data: dict) -> str:
    req = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(data).encode(),
        headers={**UA, "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with opener.open(req, timeout=60) as resp:
        print("POST", url, "->", resp.geturl(), resp.status)
        body = resp.read().decode("utf-8", "replace")
        return body


def main() -> None:
    with opener.open(urllib.request.Request("https://publicapps.odh.ohio.gov/eid/Default.aspx", headers=UA), timeout=40) as resp:
        home = resp.read().decode("utf-8", "replace")
    f = fields(home)
    f["__EVENTTARGET"] = "_ctl0$EidContentPlaceHolder$lbtn_Provider_Reports"
    f["__EVENTARGUMENT"] = ""
    reports = post("https://publicapps.odh.ohio.gov/eid/Default.aspx", f)
    (RAW / "odh-reports.html").write_text(reports, encoding="utf-8")
    f2 = fields(reports)
    f2["__EVENTTARGET"] = "_ctl0$EidContentPlaceHolder$ddlReports"
    f2["__EVENTARGUMENT"] = ""
    f2["_ctl0:EidContentPlaceHolder:ddlReports"] = "facility_listing"
    listing = post("https://publicapps.odh.ohio.gov/eid/reports/EID_Report_Criteria.aspx", f2)
    (RAW / "odh-listing-criteria.html").write_text(listing, encoding="utf-8")
    print("selects", re.findall(r"<select[^>]*name=\"([^\"]+)\"", listing))
    print("options", re.findall(r"<option[^>]*value=\"([^\"]*)\"[^>]*>([^<]{0,80})", listing)[:80])


if __name__ == "__main__":
    main()
