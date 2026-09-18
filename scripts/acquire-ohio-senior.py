#!/usr/bin/env python3
"""Acquire Ohio ODH OneSource nursing-home and RCF license layers."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

RAW = Path("data/ohio/oh-sen-001/raw")
OUT = Path("data/ohio/oh-sen-001")
UA = "SeniorTrustHub-research/1.0"
NH_URL = "https://services6.arcgis.com/zxOMWqh0yAD6mMsJ/arcgis/rest/services/Nursing_Homes_Licensed_and_Certified_in_Ohio_NEW/FeatureServer/0/query"
RCF_URL = "https://services6.arcgis.com/zxOMWqh0yAD6mMsJ/arcgis/rest/services/Assisted_Facilities_in_Ohio_NEW/FeatureServer/0/query"


def get(url: str, params: dict) -> dict:
    q = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{url}?{q}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def all_features(url: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        data = get(
            url,
            {
                "where": "1=1",
                "outFields": "*",
                "f": "json",
                "resultOffset": offset,
                "resultRecordCount": 2000,
            },
        )
        feats = data.get("features") or []
        rows.extend(a.get("attributes") or {} for a in feats)
        if not data.get("exceededTransferLimit") and len(feats) < 2000:
            break
        if not feats:
            break
        offset += len(feats)
    return rows


def summarize(rows: list[dict], kind: str) -> dict:
    licenses = [(r.get("f_licenseno") or "").strip() for r in rows]
    names = [(r.get("f_businessname") or "").strip() for r in rows]
    types = Counter((r.get("f_businesstypedescription") or "").strip() for r in rows)
    status = Counter((r.get("f_credentialstatus") or "").strip() for r in rows)
    active = Counter((r.get("f_activestatusflag") or "").strip() for r in rows)
    filled = [x for x in licenses if x]
    return {
        "kind": kind,
        "rows": len(rows),
        "distinct_license": len(set(filled)),
        "missing_license": sum(1 for x in licenses if not x),
        "distinct_names": len(set(names)),
        "types": types.most_common(),
        "credential_status": status.most_common(),
        "active_flag": active.most_common(),
        "sample_license": filled[:8],
        "has_ccn_field": any("ccn" in k.lower() or "medicare" in k.lower() or "cms" in k.lower() for r in rows[:1] for k in r),
        "fields": sorted({k for r in rows[:1] for k in r}),
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    retrieved = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print("NH", flush=True)
    nh = all_features(NH_URL)
    print("RCF", flush=True)
    rcf = all_features(RCF_URL)
    (OUT / "odh-nh-rows.json").write_text(json.dumps(nh), encoding="utf-8")
    (OUT / "odh-rcf-rows.json").write_text(json.dumps(rcf), encoding="utf-8")
    summary = {
        "retrievedAt": retrieved,
        "nh_source": NH_URL,
        "rcf_source": RCF_URL,
        "nh_sourceAsOf": "2026-08-10",
        "rcf_sourceAsOf": "2026-06-17",
        "nh": summarize(nh, "nursing_home"),
        "rcf": summarize(rcf, "residential_care_facility"),
        "cms_overlay_from_national": {"nursingHomes": 922, "homeHealth": 835, "hospice": 169},
    }
    (OUT / "odh-onesource-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps({k: summary[k] for k in ("retrievedAt", "nh", "rcf", "cms_overlay_from_national")}, indent=2))


if __name__ == "__main__":
    main()
