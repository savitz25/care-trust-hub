"""Build NJ-SEN-005 public snapshot from official NJDOH/NJMMIS files + committed artifacts."""
from __future__ import annotations

import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(r"C:\Users\Michael.Savitsky\care-trust-hub-nj-sen-001\data\raw")
sys.path.insert(0, str(ROOT / "services" / "ingest" / "src"))

from care_ingest.nj_doh_acute import parse_acute_rows, parse_acute_xlsx  # noqa: E402
from care_ingest.nj_doh_ltc import parse_facility_rows, parse_xlsx  # noqa: E402
from care_ingest.nj_doh_staffing import parse_staffing_html  # noqa: E402
from care_ingest.nj_medicaid_al_rates import extract_pdf_text, parse_rate_text  # noqa: E402
from care_ingest.nj_pace import build_pace_report, parse_doas_page  # noqa: E402


def count_map(items, keyfn) -> list[dict]:
    c = Counter(keyfn(item) or "UNKNOWN" for item in items)
    return [{"label": k, "count": v} for k, v in sorted(c.items(), key=lambda x: (-x[1], x[0]))]


def main() -> None:
    ltc_bytes = (RAW / "nj-doh-ltc" / "All_LTC.xlsx").read_bytes()
    acute_bytes = (RAW / "nj-doh-acute" / "All_Acute.xlsx").read_bytes()
    _sheets, ltc_rows, _ = parse_xlsx(ltc_bytes)
    ltc, ltc_q = parse_facility_rows(ltc_rows)
    _sheets_a, acute_rows, _ = parse_acute_xlsx(acute_bytes)
    acute, acute_q = parse_acute_rows(acute_rows)

    ltc_types = {row.facility_type_canonical for row in ltc}
    acute_types = {row.facility_type_canonical for row in acute}
    ltc_counties = { (row.county or "").title() for row in ltc if row.county }
    acute_counties = { (row.county or "").title() for row in acute if row.county }

    inventory = []
    for row in ltc:
        inventory.append(
            {
                "source": "all_ltc",
                "name": row.official_name,
                "type": row.facility_type_raw,
                "typeKey": row.facility_type_canonical,
                "city": row.city,
                "county": (row.county or "").title() or None,
                "license": row.license_number,
                "facId": row.source_facility_id,
                "address": row.street,
                "zip": row.zip_code,
            }
        )
    for row in acute:
        inventory.append(
            {
                "source": "all_acute",
                "name": row.official_name,
                "type": row.facility_type_raw,
                "typeKey": row.facility_type_canonical,
                "city": row.city,
                "county": (row.county or "").title() or None,
                "license": row.license_number,
                "facId": row.source_facility_id,
                "address": row.street,
                "zip": row.zip_code,
            }
        )

    staffing_trend = []
    staff_dir = RAW / "nj-doh-staffing"
    for year in range(2019, 2027):
        for q in ("Q1", "Q2", "Q3", "Q4"):
            path = staff_dir / f"report_{year}_{q}.html"
            if not path.exists() or path.stat().st_size < 50_000:
                continue
            rows = parse_staffing_html(path.read_text(encoding="utf-8", errors="replace"))
            statewide = next((r for r in rows if r.is_statewide), None)
            if not statewide:
                continue
            staffing_trend.append(
                {
                    "year": statewide.year,
                    "quarter": statewide.quarter,
                    "label": f"{statewide.year} {statewide.quarter}",
                    "dayRn": statewide.ratios[("day", "RN")].numeric,
                    "dayLpn": statewide.ratios[("day", "LPN")].numeric,
                    "dayCna": statewide.ratios[("day", "CNA")].numeric,
                    "facilities": sum(1 for r in rows if not r.is_statewide),
                }
            )

    pdf = (RAW / "nj-medicaid-al" / "SFY_2026_Assisted_Living_Rates.pdf").read_bytes()
    text, pages = extract_pdf_text(pdf)
    schedule = parse_rate_text(
        text,
        official_url="https://www.njmmis.com/downloadDocuments/SFY_2026_Assisted_Living_Rates.pdf",
        sha256=hashlib.sha256(pdf).hexdigest(),
        page_count=pages,
    )
    rates = [
        {"name": r.provider_name, "subtype": r.subtype, "rate": r.daily_rate}
        for r in schedule.rows
    ]
    rate_values = [r.daily_rate for r in schedule.rows]

    pace_html = (RAW / "nj-pace" / "doas_pace.html").read_text(encoding="utf-8", errors="replace")
    pace = parse_doas_page(pace_html, retrieved="2026-09-02T00:00:00Z", sha256=hashlib.sha256(pace_html.encode()).hexdigest())
    pace_report = build_pace_report(pace, dry_run=True)

    enforcement = json.loads((ROOT / "docs/data/nj-sen-002-acquisition-summary.json").read_text(encoding="utf-8"))
    audited = json.loads((ROOT / "artifacts/nj-sen-004-audited-state-snapshot.json").read_text(encoding="utf-8"))
    national = json.loads((ROOT / "apps/web/src/data/senior-national-intelligence.json").read_text(encoding="utf-8"))
    nj_cms = next(row for row in national["geography"] if row["state"] == "NJ")

    counties = sorted(ltc_counties | acute_counties)
    county_rows = []
    for county in [
        "Atlantic","Bergen","Burlington","Camden","Cape May","Cumberland","Essex","Gloucester",
        "Hudson","Hunterdon","Mercer","Middlesex","Monmouth","Morris","Ocean","Passaic","Salem",
        "Somerset","Sussex","Union","Warren",
    ]:
        ltc_c = [r for r in ltc if (r.county or "").title() == county]
        acute_c = [r for r in acute if (r.county or "").title() == county]
        county_rows.append(
            {
                "county": county,
                "ltc": len(ltc_c),
                "acute": len(acute_c),
                "nfSnf": sum(1 for r in ltc_c if r.facility_type_canonical and "NJ_NF_SNF" == r.facility_type_canonical),
                "alr": sum(1 for r in ltc_c if r.facility_type_canonical == "NJ_ALR"),
                "cpch": sum(1 for r in ltc_c if r.facility_type_canonical == "NJ_CPCH"),
                "alp": sum(1 for r in ltc_c if r.facility_type_canonical == "NJ_ALP"),
                "hha": sum(1 for r in acute_c if r.facility_type_canonical == "NJ_HHA"),
                "hospiceProgram": sum(1 for r in acute_c if r.facility_type_canonical == "NJ_HOSPICE_PROGRAM"),
                "hospiceBranch": sum(1 for r in acute_c if r.facility_type_canonical == "NJ_HOSPICE_BRANCH"),
                "hospiceInpatient": sum(1 for r in acute_c if r.facility_type_canonical == "NJ_HOSPICE_INPATIENT"),
            }
        )

    payload = {
        "version": "nj-sen-005-public-v1",
        "asOf": "2026-09-02",
        "ltcAsOf": audited["all_acute"]["source_as_of"] if False else str(ltc[0].run_date) if ltc and ltc[0].run_date else audited["all_acute"]["source_as_of"],
        "acuteAsOf": audited["all_acute"]["source_as_of"],
        "ltc": {
            "rows": len(ltc),
            "uniqueFacIds": len({r.source_facility_id for r in ltc}),
            "uniqueLicenses": len({r.license_number for r in ltc}),
            "types": len(ltc_types),
            "counties": len(ltc_counties),
            "quarantined": len(ltc_q),
            "byType": count_map(ltc, lambda r: r.facility_type_raw),
            "source": "https://healthapps.nj.gov/facilities/documents2/All_LTC.xlsx",
            "sha256": hashlib.sha256(ltc_bytes).hexdigest(),
        },
        "acute": {
            "rows": len(acute),
            "types": len(acute_types),
            "counties": len([c for c in acute_counties if c.upper() in {
                "ATLANTIC","BERGEN","BURLINGTON","CAMDEN","CAPE MAY","CUMBERLAND","ESSEX","GLOUCESTER",
                "HUDSON","HUNTERDON","MERCER","MIDDLESEX","MONMOUTH","MORRIS","OCEAN","PASSAIC","SALEM",
                "SOMERSET","SUSSEX","UNION","WARREN",
            }]),
            "hha": sum(1 for r in acute if r.facility_type_canonical == "NJ_HHA"),
            "hospiceProgram": sum(1 for r in acute if r.facility_type_canonical == "NJ_HOSPICE_PROGRAM"),
            "hospiceBranch": sum(1 for r in acute if r.facility_type_canonical == "NJ_HOSPICE_BRANCH"),
            "hospiceInpatient": sum(1 for r in acute if r.facility_type_canonical == "NJ_HOSPICE_INPATIENT"),
            "other": sum(1 for r in acute if r.facility_type_canonical not in {
                "NJ_HHA","NJ_HOSPICE_PROGRAM","NJ_HOSPICE_BRANCH","NJ_HOSPICE_INPATIENT"
            }),
            "quarantined": len(acute_q),
            "invalidCountyRows": audited["all_acute"]["invalid_county_rows"],
            "byType": count_map(acute, lambda r: r.facility_type_raw),
            "source": "https://healthapps.nj.gov/facilities/documents2/All_Acute.xlsx",
            "sha256": hashlib.sha256(acute_bytes).hexdigest(),
        },
        "counties": county_rows,
        "staffing": {
            "populatedQuarters": len(staffing_trend),
            "first": staffing_trend[0]["label"] if staffing_trend else None,
            "latest": staffing_trend[-1]["label"] if staffing_trend else None,
            "trend": staffing_trend,
            "semantics": "Official values are residents per one staff member (1RN:#Res). Missing codes are not zero.",
            "notAttachedTo": ["ALR", "CPCH", "ALP", "Home Health", "Hospice", "PACE", "CCRC"],
        },
        "enforcement": {
            "indexed": enforcement["corpus"]["unique_index_urls"],
            "downloaded": enforcement["dedupe"]["downloaded_url_occurrences"],
            "uniqueHashes": enforcement["dedupe"]["unique_hashes"],
            "unavailable": 2,
            "byClass": enforcement["corpus"]["document_class"],
            "byYear": {year: row["indexed_urls"] for year, row in enforcement["corpus"]["by_year"].items()},
            "matchBuckets": enforcement["corpus"]["match_buckets"],
            "exactFacilities": enforcement["corpus"]["unique_ltc_facilities_with_evidence"],
            "coverage": "ACQUIRED_PARTIAL_HISTORY",
        },
        "medicaid": {
            "listedRows": len(rates),
            "minRate": min(rate_values) if rate_values else None,
            "maxRate": max(rate_values) if rate_values else None,
            "bySubtype": count_map(schedule.rows, lambda r: r.subtype),
            "defaults": {
                "ALP": schedule.default_alp,
                "ALR": schedule.default_alr,
                "CPCH": schedule.default_cpch,
            },
            "effectiveOn": schedule.effective_on.isoformat() if schedule.effective_on else None,
            "fiscalYear": schedule.fiscal_year,
            "source": schedule.official_url,
            "rows": rates,
        },
        "pace": {
            "organizations": pace_report.organizations,
            "operatingOrganizations": sum(1 for o in pace.organizations if o.current_status == "OPERATING"),
            "awardedOrganizations": sum(1 for o in pace.organizations if o.current_status == "AWARDED"),
            "operatingCenters": pace_report.centers,
            "operatingCounties": pace_report.operating_counties,
            "partialCounties": pace_report.partial_counties,
            "zipRecords": pace_report.zip_records,
            "awardedFutureCounties": pace_report.awarded_future_counties,
            "organizationsList": [{"name": o.name, "status": o.current_status} for o in pace.organizations],
            "centers": [
                {"org": c.organization_name, "name": c.center_name, "city": c.city, "county": c.county, "status": c.current_status}
                for c in pace.centers
            ],
            "notes": pace.notes,
        },
        "cmsOverlay": {
            "nursingHomes": nj_cms["nursingHomes"],
            "homeHealth": nj_cms["homeHealth"],
            "hospice": nj_cms["hospice"],
            "source": "senior-national-intelligence.json geography NJ",
            "asOf": national["generatedAt"][:10],
        },
        "ccrc": {
            "coverage": "SOURCE_AVAILABLE_BY_REQUEST",
            "countPublished": None,
        },
        "profileAttachments": [],
        "gaps": [
            "A complete CCRC Certificate of Authority roster was not acquired from public files.",
            "The Medicaid assisted-living schedule lacks stable identifiers for many listed rows; name-only matching is withheld from profiles.",
            "NJDOH Home Health and Hospice physical office counties are not service areas.",
            "CMS Home Health/Hospice crosswalks for NJDOH rows remain incomplete without production CMS joins.",
            "Some NJDOH enforcement documents remain unresolved to a specific facility.",
            "Home Health/Hospice counties-served listings are behind an ASP.NET search POST (SOURCE_ACCESS_BLOCKED).",
        ],
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    payload["fingerprint"] = hashlib.sha256(canonical.encode()).hexdigest()

    out_snap = ROOT / "artifacts" / "nj-sen-005-public-snapshot.json"
    out_inv = ROOT / "apps" / "web" / "src" / "data" / "nj-facility-inventory.json"
    out_ts = ROOT / "packages" / "domain" / "src" / "nj-public-snapshot.ts"
    out_snap.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    out_inv.write_text(json.dumps({"asOf": payload["ltcAsOf"], "rows": inventory}, separators=(",", ":")) + "\n", encoding="utf-8")
    slim = {k: v for k, v in payload.items() if k != "medicaid"}
    slim["medicaid"] = {k: v for k, v in payload["medicaid"].items() if k != "rows"}
    slim["medicaid"]["rowCount"] = len(payload["medicaid"]["rows"])
    out_ts.write_text(
        "/** Generated by scripts/build-nj-public-snapshot.py. Do not edit by hand. */\n"
        f"export const NJ_PUBLIC_SNAPSHOT = {json.dumps(slim, indent=2)} as const;\n",
        encoding="utf-8",
    )
    (ROOT / "apps" / "web" / "src" / "data" / "nj-medicaid-rate-rows.json").write_text(
        json.dumps(payload["medicaid"]["rows"]) + "\n", encoding="utf-8"
    )
    print(
        "ltc", len(ltc), "types", len(ltc_types),
        "acute", len(acute), "types", len(acute_types),
        "inventory", len(inventory),
        "staffing", len(staffing_trend),
        "rates", len(rates),
        "pace orgs", pace_report.organizations,
        "fp", payload["fingerprint"][:16],
    )


if __name__ == "__main__":
    main()
