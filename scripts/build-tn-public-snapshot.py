#!/usr/bin/env python3
"""TN-SEN-001 — Tennessee senior-care state layer over the accepted CMS spine.

Stage 1 (--parse; needs gitignored raw files in data/tennessee/tn-sen-001/raw/):
  HFC Health Facility Reports, July 2026 (XLSX): Nursing Home, Assisted Care Living Facility (ACLF),
    and Residential Home for the Aged (RHA) full bed reports -> facility rows.
  HFC County Licensed Home Health & Hospice lists (PDF) -> agency x licensed-county rows.
  HFC Facility Action and Abuse Reports, Jan 2024 - Aug 2026 (PDF) -> facility action rows.
    Abuse Registry entries name individual people; only monthly counts are kept.
  Writes data/tennessee/tn-sen-001/*.json (committed).
Stage 2 (default): derived JSON + accepted CMS national partition -> public snapshot, TS module,
  and the server-side list file used by /tennessee. --check compares the committed files.

Does not download CMS. No name-only state-to-CMS joins. A facility action attaches to a state
report row only by exact license class + license number, and only when the printed name agrees.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/tennessee/tn-sen-001/raw"
STAGE = ROOT / "data/tennessee/tn-sen-001"
ART = ROOT / "artifacts/tn-sen-001-public-snapshot.json"
TS = ROOT / "packages/domain/src/tn-public-snapshot.ts"
WEB_LIST = ROOT / "apps/web/src/data/tennessee-facility-lists.json"
NATIONAL = json.loads(
    (ROOT / "apps/web/src/data/senior-national-intelligence.json").read_text(
        encoding="utf-8"
    )
)
GENERATION_KEYS = frozenset({"generatedAt", "fingerprint"})
GENERATED_AT = "2026-09-24T22:30:00Z"
SNAPSHOT_AS_OF = "2026-09-24"
HFC = "https://www.tn.gov/hfc.html"
REPORTS_PAGE = "https://www.tn.gov/hfc/publication-and-reports/licensure-reports.html"
COUNTY_PAGE = "https://www.tn.gov/hfc/certificate-of-need-information/hfc-toolbox/county-licensed-home-health-and-hospice-agencies-.html"
FAAR_PAGE = "https://www.tn.gov/hfc/publication-and-reports/facility-action-and-abuse-reports.html"
ENFORCEMENT_PAGE = "https://www.tn.gov/hfc/publication-and-reports/nursing-home-inspection-and-enforcement.html"
COMPLAINT_PAGE = "https://www.tn.gov/hfc/division-of-licensure-and-regulation/filing-a-complaint.html"
FACILITY_LISTINGS = "https://internet.health.tn.gov/FacilityListings"
ARCHIVE_BOARD = "https://www.tn.gov/hfc/division-of-licensure-and-regulation/archives--board-for-licensing-health-care-facilities.html"
MORATORIUM = "https://www.cms.gov/files/document/qso-26-11-hha-hospice-original-release-2026-05-20.pdf"
REPORT_MONTH = "2026-07"
CITIES = ["Nashville", "Memphis", "Knoxville", "Chattanooga"]
CITY_COUNTY = {
    "Nashville": "Davidson",
    "Memphis": "Shelby",
    "Knoxville": "Knox",
    "Chattanooga": "Hamilton",
}
BED_REPORTS = {
    "nursingHomes": (
        "nh_july2026.xlsx",
        "Nursing Home",
        "Nursing Home Full Bed Report - July 2026",
    ),
    "aclf": (
        "aclf_july2026.xlsx",
        "Assisted Care Living Facility",
        "Assisted Care Living Facilities Full Bed Report - July 2026",
    ),
    "rha": (
        "rha_july2026.xlsx",
        "Home for the Aged",
        "Residential Home for the Aged Full Bed Report - July 2026",
    ),
}
BASE_COLUMNS = [
    "fac_type",
    "lic_no",
    "fac_name",
    "lic_status",
    "street",
    "city",
    "state",
    "zip",
    "county",
    "region",
    "Total_Beds",
]
EXTRA_COLUMNS = {
    "Does facility have dialysis services?": "dialysisServices",
    "Does the facility provide bedside dialysis?": "bedsideDialysis",
    "Does the facility have a dialysis den?": "dialysisDen",
    "How many beds for bedside dialysis?": "bedsideDialysisBeds",
    "Number of stations in a den:": "dialysisDenStations",
    "Vent Beds:": "ventBeds",
    "Adult Day Care Services beds:": "adultDayCareBeds",
    "Number of Adult Day Care Services beds:": "adultDayCareBeds",
    "Number of Adult Day Care Services Beds:": "adultDayCareBeds",
    "Secured Beds:": "securedBeds",
    "Number of Secured Beds:": "securedBeds",
    "Alzheimer Beds:": "alzheimerBeds",
}
COUNTY_LISTS = {
    "homeHealth": ("hh_counties.pdf", "Home Health Agencies In:"),
    "homeHealthEeoicpaExempt": (
        "hh_counties_eeoicpa.pdf",
        "Home Health Agencies Exempt For EEOICPA In:",
    ),
    "homeHealthPediatricExempt": (
        "hh_counties_pediatric.pdf",
        "Home Health Agencies Exempt For Pediatric In:",
    ),
    "hospice": ("hospice_counties.pdf", "Hospice Agencies In:"),
}
# License class abbreviations as printed in the Facility Action and Abuse Reports.
ACTION_CLASS = {
    "N.H.": ("nursingHomes", "Nursing Home"),
    "S.N.F.": ("nursingHomes", "Nursing Home (printed S.N.F.)"),
    "A.C.L.F.": ("aclf", "Assisted Care Living Facility"),
    "R.H.A.": ("rha", "Residential Home for the Aged"),
    "H.H.A.": ("homeHealth", "Home Health Agency"),
    "A.C.H.": ("adultCareHome", "Adult Care Home"),
}
MONTHS = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
]
WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
}


def dumps(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def strip_generation(obj: object) -> object:
    if isinstance(obj, dict):
        return {
            k: strip_generation(v) for k, v in obj.items() if k not in GENERATION_KEYS
        }
    if isinstance(obj, list):
        return [strip_generation(v) for v in obj]
    return obj


def sha(obj: dict) -> str:
    return hashlib.sha256(dumps(strip_generation(obj)).encode("utf-8")).hexdigest()


def clean(v: object) -> str:
    s = str(v if v is not None else "")
    s = s.replace("’", "'").replace("–", "-").replace("�", "'")
    return re.sub(r"\s+", " ", s).strip()


def as_int(v: object) -> int | None:
    s = clean(v)
    return int(float(s)) if re.fullmatch(r"\d+(\.0+)?", s) else None


def manifest() -> dict:
    return json.loads((RAW / "manifest.json").read_text(encoding="utf-8"))


def write_stage(name: str, body: dict) -> None:
    (STAGE / name).write_text(
        json.dumps(body, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def parse_bed_reports(man: dict) -> None:
    import openpyxl

    out = {}
    for key, (fname, fac_type, title) in BED_REPORTS.items():
        rows = list(
            openpyxl.load_workbook(RAW / fname, read_only=True, data_only=True)
            .worksheets[0]
            .iter_rows(values_only=True)
        )
        header = [clean(h) for h in rows[0]]
        if header[: len(BASE_COLUMNS)] != BASE_COLUMNS:
            raise SystemExit(f"{fname} header drifted: {header}")
        extras = header[len(BASE_COLUMNS) :]
        if any(e not in EXTRA_COLUMNS for e in extras):
            raise SystemExit(f"{fname} has unknown columns: {extras}")
        facilities = []
        for r in rows[1:]:
            if r[1] is None:
                continue
            if clean(r[0]) != fac_type:
                raise SystemExit(f"{fname} mixed facility type {r[0]}")
            row = {
                "licenseNumber": as_int(r[1]),
                "name": clean(r[2]),
                "licenseStatus": clean(r[3]),
                "street": clean(r[4]),
                "city": clean(r[5]),
                "state": clean(r[6]),
                "zip": clean(r[7])[:5],
                "county": clean(r[8]).title(),
                "region": clean(r[9]),
                "totalBeds": as_int(r[10]),
            }
            for i, col in enumerate(extras):
                v = r[len(BASE_COLUMNS) + i]
                row[EXTRA_COLUMNS[col]] = (
                    clean(v) if col.startswith("Does") else as_int(v)
                )
            row["satelliteOfLicense"] = (
                int(sat.group(1))
                if (
                    sat := re.search(r"SATELLITE of #(\d+)", row["name"], re.IGNORECASE)
                )
                else None
            )
            facilities.append(row)
        nums = Counter(
            f["licenseNumber"] for f in facilities if f["satelliteOfLicense"] is None
        )
        if any(v > 1 for v in nums.values()) or None in nums:
            raise SystemExit(f"{fname} license numbers are not unique")
        if any(
            f["satelliteOfLicense"] not in (None, f["licenseNumber"])
            for f in facilities
        ):
            raise SystemExit(f"{fname} satellite row points at another license")
        facilities.sort(
            key=lambda f: (f["licenseNumber"], f["satelliteOfLicense"] is not None)
        )
        out[key] = {
            "sourceTitle": title,
            "source": man[fname]["url"],
            "sourcePage": REPORTS_PAGE,
            "reportMonth": REPORT_MONTH,
            "retrievedAt": man[fname]["retrievedAt"],
            "sha256": man[fname]["sha256"],
            "facilityTypeAsPublished": fac_type,
            "columns": header,
            "facilities": facilities,
        }
    write_stage("hfc-bed-reports.json", out)


def parse_county_lists(man: dict) -> None:
    import pdfplumber

    out = {}
    for key, (fname, title) in COUNTY_LISTS.items():
        with pdfplumber.open(RAW / fname) as pdf:
            text = "\n".join(p.extract_text() or "" for p in pdf.pages)
        dates = set(
            re.findall(
                r"Source: Department of Health Licensure - (\d+/\d+/\d{4})", text
            )
        )
        if len(dates) != 1:
            raise SystemExit(f"{fname} source dates: {dates}")
        m, d, y = next(iter(dates)).split("/")
        source_date = f"{y}-{int(m):02d}-{int(d):02d}"
        lines = [
            ln.strip()
            for ln in text.split("\n")
            if ln.strip()
            and ln.strip() != title
            and not ln.startswith("Source: Department of Health Licensure")
        ]
        counties: list[dict] = []
        pending = ""
        i = 0
        while i < len(lines):
            ln = lines[i]
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            if re.fullmatch(r"[A-Z][A-Za-z .]+ County", ln) and nxt.startswith(
                "Number of Agencies Licensed for County"
            ):
                counties.append(
                    {
                        "county": ln[: -len(" County")],
                        "statedCount": int(re.sub(r"\D", "", nxt)),
                        "agencies": [],
                    }
                )
                i += 2
                continue
            entry = (pending + " " + ln).strip() if pending else ln
            if re.search(r"\([A-Za-z .]+\)$", entry):
                counties[-1]["agencies"].append(entry)
                pending = ""
            else:
                pending = entry
            i += 1
        if pending:
            raise SystemExit(f"{fname} dangling text: {pending}")
        # Stated per-county counts are kept; a mismatch is recorded, not repaired.
        mismatches = [
            {
                "county": c["county"],
                "statedCount": c["statedCount"],
                "rowsPrinted": len(c["agencies"]),
            }
            for c in counties
            if c["statedCount"] != len(c["agencies"])
        ]
        print(fname, "stated-count mismatches:", mismatches)
        if len(counties) != 95:
            raise SystemExit(f"{fname} has {len(counties)} counties, expected 95")
        out[key] = {
            "sourceTitle": title.rstrip(":"),
            "source": man[fname]["url"],
            "sourcePage": COUNTY_PAGE,
            "sourceAsOf": source_date,
            "sourceDateLabel": "Source: Department of Health Licensure - "
            + next(iter(dates)),
            "retrievedAt": man[fname]["retrievedAt"],
            "sha256": man[fname]["sha256"],
            "grain": "agency (name and home county as printed) x licensed service county",
            "agencyIdInSource": False,
            "statedCountMismatches": mismatches,
            "counties": counties,
        }
    write_stage("hfc-home-health-hospice-counties.json", out)


def cmp_amounts(pen: str) -> tuple[int | None, int | None]:
    """(total as printed, sum of itemized penalties). Either may be None."""
    money = lambda s: int(float(s.replace(",", "")))
    total = None
    t = re.findall(r"total[^$]*?\(?\$([\d,]+(?:\.\d\d)?)", pen, re.IGNORECASE)
    if t:
        total = money(t[-1])
    # Itemized: "<count> [Type X] [Assessed] Civil Monetary|Money Penalt(y|ies) | CMP(s) of ... ($N)".
    items = re.findall(
        r"\b(one|two|three|four|five|six|seven|eight|\d+)\s*(?:\((\d+)\))?\s*(?:Type [A-Z] )?(?:Assessed )?"
        r"(?:civil\s+mone(?:tary|y)\s+penalt(?:y|ies)|CMPs?)\s+of\s+[^$()]*?\(?\$?\s?([\d,]{3,}(?:\.\d\d)?)\)?",
        pen,
        re.IGNORECASE,
    )
    summed = (
        sum(int(p or WORDS.get(w.lower(), w)) * money(a) for w, p, a in items)
        if items
        else None
    )
    return total, summed


def parse_actions(man: dict) -> None:
    import pdfplumber

    actions = []
    months = []
    other_classes: Counter = Counter()
    for fname in sorted(k for k in man if k.startswith("faar/")):
        with pdfplumber.open(RAW / fname) as pdf:
            text = "\n".join(p.extract_text() or "" for p in pdf.pages)
        text = re.sub(r"Facility Action and Abuse Report Page \d+ of \d+\n", "", text)
        period = re.search(r"actions taken in\s+([A-Z]+)\s+(\d{4})", text)
        if not period:
            raise SystemExit(f"{fname} has no report period")
        report_month = f"{period.group(2)}-{MONTHS.index(period.group(1)) + 1:02d}"
        if report_month != fname[5:12]:
            raise SystemExit(f"{fname} prints period {report_month}")
        body, _, abuse = text.partition("ABUSE REGISTRY")
        abuse_entries = len(re.findall(r"(?m)^Name:", abuse))
        section = None
        month_actions = 0
        marks = list(
            re.finditer(r"(?m)^([A-Z][A-Z /&]{3,}ORDERS)\s*$|^Licensee:\s*", body)
        )
        for j, mk in enumerate(marks):
            if mk.group(1):
                section = mk.group(1).strip()
                continue
            if section is None:
                raise SystemExit(f"{fname} licensee before any order section")
            chunk = body[
                mk.end() : marks[j + 1].start() if j + 1 < len(marks) else len(body)
            ]
            head, _, pen = chunk.partition("\nPenalty:")
            head = clean(head)
            pen = clean(pen)
            if not head or head.lower().startswith("none"):
                continue
            m = re.match(
                r"(.*?),?\s+([A-Z][A-Za-z. ]{1,12}?)\s*(Lic\.?|Applicant File)\s*No\.?\s*([\d,]+)\s*,?\s*(.*)$",
                head,
            )
            if not m:
                raise SystemExit(f"{fname} unparsed licensee: {head}")
            cls = re.sub(r"\s", "", m.group(2))
            number = int(m.group(4).replace(",", ""))
            month_actions += 1
            if cls not in ACTION_CLASS:
                other_classes[cls] += 1
                continue
            total, summed = cmp_amounts(pen)
            actions.append(
                {
                    "reportMonth": report_month,
                    "orderSection": section,
                    "nameAsPrinted": m.group(1).strip(),
                    "licenseClassAsPrinted": cls,
                    "careSetting": ACTION_CLASS[cls][0],
                    "licenseNumber": number if m.group(3).startswith("Lic") else None,
                    "applicantFileNumber": None
                    if m.group(3).startswith("Lic")
                    else number,
                    "cityAsPrinted": m.group(5).strip(),
                    "actionAsPrinted": pen,
                    "civilMonetaryPenalty": bool(
                        re.search(
                            r"civil mone(?:tary|y) penalt|\bCMPs?\b",
                            re.sub(
                                r"in lieu of civil monetary penalties",
                                "",
                                pen,
                                flags=re.IGNORECASE,
                            ),
                            re.IGNORECASE,
                        )
                    ),
                    "probation": bool(re.search(r"probation", pen, re.IGNORECASE)),
                    "suspensionOrRevocation": bool(
                        re.search(r"suspen|revok|revocation", pen, re.IGNORECASE)
                    ),
                    "admissionsSuspended": bool(
                        re.search(r"admission", pen, re.IGNORECASE)
                    ),
                    "cmpTotalAsPrinted": total,
                    "cmpItemizedSum": summed,
                }
            )
        months.append(
            {
                "reportMonth": report_month,
                "source": man[fname]["url"],
                "sha256": man[fname]["sha256"],
                "retrievedAt": man[fname]["retrievedAt"],
                "licenseeActionsAllClasses": month_actions,
                "abuseRegistryEntries": abuse_entries,
            }
        )
    write_stage(
        "hfc-facility-actions.json",
        {
            "sourcePage": FAAR_PAGE,
            "sourceTitle": "Facility Action and Abuse Report (monthly)",
            "window": f"{months[0]['reportMonth']}/{months[-1]['reportMonth']}",
            "monthsMissingFromArchive": ["2026-01"],
            "months": months,
            "otherClassActions": dict(sorted(other_classes.items())),
            "abuseRegistryNamesWithheld": True,
            "actions": actions,
        },
    )


def parse() -> None:
    man = manifest()
    parse_bed_reports(man)
    parse_county_lists(man)
    parse_actions(man)


def norm_name(s: str) -> str:
    s = s.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    drop = {
        "llc",
        "inc",
        "the",
        "of",
        "at",
        "and",
        "center",
        "centre",
        "assisted",
        "living",
        "a",
    }
    return " ".join(w for w in s.split() if w not in drop)


def name_variants(s: str) -> list[str]:
    parts = re.split(
        r"\b(?:f\.?\s?k\.?\s?a\.?|f/k/a|a\.?k\.?a\.?|d\.?b\.?a\.?)\b",
        s,
        flags=re.IGNORECASE,
    )
    return [v for v in (norm_name(p) for p in parts) if v]


def names_agree(printed: str, current: str) -> bool:
    cur = norm_name(current)
    for v in name_variants(printed):
        if v == cur or (len(v) >= 12 and (cur.startswith(v) or v.startswith(cur))):
            return True
    return False


def clock(sources: dict, key: str) -> dict:
    row = sources[key]
    return {
        "datasetKey": row["datasetKey"],
        "officialUrl": row["officialUrl"],
        "sourceModifiedAt": row["sourceModifiedAt"],
        "retrievedAt": row["retrievedAt"],
        "sourcePeriod": row["sourcePeriod"],
    }


def bed_class(rep: dict, **extra: object) -> dict:
    f = rep["facilities"]
    beds = [x["totalBeds"] for x in f if x["totalBeds"] is not None]
    main = [x for x in f if x["satelliteOfLicense"] is None]
    sats = [x for x in f if x["satelliteOfLicense"] is not None]
    out = {
        "reportRows": len(f),
        "distinctLicenseNumbers": len({x["licenseNumber"] for x in f}),
        "satelliteRows": len(sats),
        "satelliteRowsShareLicenseNumber": [x["licenseNumber"] for x in sats],
        # A satellite row repeats its parent license's bed figure; beds are summed once per license.
        "licensedBeds": sum(x["totalBeds"] or 0 for x in main),
        "bedsSumAllRowsAsListed": sum(beds),
        "rowsWithBeds": len(beds),
        "licenseStatusCounts": dict(Counter(x["licenseStatus"] for x in f)),
        "securedBeds": sum(x.get("securedBeds") or 0 for x in f),
        "adultDayCareBeds": sum(x.get("adultDayCareBeds") or 0 for x in f),
        "facilitiesWithSecuredBeds": sum(
            1 for x in f if (x.get("securedBeds") or 0) > 0
        ),
        "outOfStateAddressRows": sum(1 for x in f if x["state"] != "TN"),
        "counties": len({x["county"] for x in f}),
        "facilityTypeAsPublished": rep["facilityTypeAsPublished"],
        "source": rep["source"],
        "sourceTitle": rep["sourceTitle"],
        "reportMonth": rep["reportMonth"],
        "sourceAsOf": rep["reportMonth"],
        "sourceAsOfPrecision": "month (the report is titled by month; no day is printed)",
        "retrievedAt": rep["retrievedAt"],
        "sha256": rep["sha256"],
        "columns": rep["columns"],
        "bedGrain": "licensed beds on the HFC report; not residents, not occupancy, not facilities",
        "ccnInSource": False,
        "capability": "KNOWN",
        **extra,
    }
    return out


def county_class(lst: dict, **extra: object) -> dict:
    rows = [(c["county"], a) for c in lst["counties"] for a in c["agencies"]]
    agencies = sorted({a for _, a in rows})
    home = Counter(re.search(r"\(([A-Za-z .]+)\)$", a).group(1) for a in agencies)
    return {
        "countyServiceRows": len(rows),
        "distinctAgenciesAsPrinted": len(agencies),
        "distinctStateAgencyIds": None,
        "countiesListed": len(lst["counties"]),
        "countiesWithZeroAgencies": sum(
            1 for c in lst["counties"] if not c["agencies"]
        ),
        "statedCountMismatches": lst["statedCountMismatches"],
        "agenciesWithHomeCountyOther": home.get("Other", 0),
        "maxCountiesForOneAgency": max(Counter(a for _, a in rows).values()),
        "source": lst["source"],
        "sourceTitle": lst["sourceTitle"],
        "sourceAsOf": lst["sourceAsOf"],
        "sourceDateLabel": lst["sourceDateLabel"],
        "retrievedAt": lst["retrievedAt"],
        "sha256": lst["sha256"],
        "grain": lst["grain"],
        "agencyKey": "name and home county exactly as printed (no license number in the list)",
        "agencyIdInSource": False,
        "ccnInSource": False,
        "countyRowsAreNotAgencies": True,
        **extra,
    }


def build() -> tuple[dict, dict]:
    beds = json.loads((STAGE / "hfc-bed-reports.json").read_text(encoding="utf-8"))
    lists = json.loads(
        (STAGE / "hfc-home-health-hospice-counties.json").read_text(encoding="utf-8")
    )
    acts = json.loads((STAGE / "hfc-facility-actions.json").read_text(encoding="utf-8"))
    cms = next(row for row in NATIONAL["geography"] if row["state"] == "TN")
    sources = {row["datasetKey"]: row for row in NATIONAL["sources"]}
    if cms["nursingHomes"] != 303 or cms["homeHealth"] != 128 or cms["hospice"] != 61:
        raise SystemExit(f"Tennessee CMS partition drifted: {cms}")

    roster = {
        k: {
            f["licenseNumber"]: f
            for f in beds[k]["facilities"]
            if f["satelliteOfLicense"] is None
        }
        for k in ("nursingHomes", "aclf", "rha")
    }
    events = []
    for i, a in enumerate(acts["actions"]):
        cur = (
            roster.get(a["careSetting"], {}).get(a["licenseNumber"])
            if a["licenseNumber"]
            else None
        )
        if cur and names_agree(a["nameAsPrinted"], cur["name"]):
            attribution = "attached_exact_license_number_and_name_agrees"
        elif cur:
            attribution = "standalone_license_number_found_but_name_differs"
        elif a["careSetting"] in roster:
            attribution = "standalone_license_number_not_on_july_2026_report"
        else:
            attribution = "standalone_no_state_roster_for_class"
        cmp_value = (
            a["cmpTotalAsPrinted"]
            if a["cmpTotalAsPrinted"] is not None
            else a["cmpItemizedSum"]
        )
        events.append(
            {
                "id": f"tn-hfc-action-{a['reportMonth']}-{i:03d}",
                **{
                    k: v
                    for k, v in a.items()
                    if k not in ("cmpTotalAsPrinted", "cmpItemizedSum")
                },
                "cmpAmount": cmp_value if a["civilMonetaryPenalty"] else None,
                "attribution": attribution,
                "attachedLicenseNumber": a["licenseNumber"]
                if attribution.startswith("attached")
                else None,
                "currentReportName": cur["name"] if cur else None,
            }
        )
    by_setting = Counter(e["careSetting"] for e in events)
    by_attr = Counter(e["attribution"] for e in events)
    months = acts["months"]

    def city_count(key: str, city: str) -> int:
        return sum(
            1 for f in beds[key]["facilities"] if f["city"].lower() == city.lower()
        )

    def county_agencies(key: str, county: str) -> int:
        return next(
            len(c["agencies"]) for c in lists[key]["counties"] if c["county"] == county
        )

    city_counts = {
        city: {
            "nursingHomes": city_count("nursingHomes", city),
            "aclf": city_count("aclf", city),
            "rha": city_count("rha", city),
            "county": CITY_COUNTY[city],
            "homeHealthAgenciesLicensedForCounty": county_agencies(
                "homeHealth", CITY_COUNTY[city]
            ),
            "hospiceAgenciesLicensedForCounty": county_agencies(
                "hospice", CITY_COUNTY[city]
            ),
        }
        for city in CITIES
    }
    nh = beds["nursingHomes"]
    snapshot = {
        "version": "senior-tn-state-intel-v1",
        "ticket": "TN-SEN-001",
        "publicationPath": "/tennessee",
        "asOf": SNAPSHOT_AS_OF,
        "snapshotAsOf": SNAPSHOT_AS_OF,
        "retrievedAt": nh["retrievedAt"],
        "generatedAt": GENERATED_AT,
        "localWorkNeededNow": "NO",
        "claimEligibilityBroadened": False,
        "no_trust_score": True,
        "no_aggregate_rating": True,
        "no_rankings": True,
        "no_city_pages": True,
        "clocks": {
            "generatedAt": GENERATED_AT,
            "snapshotAsOf": SNAPSHOT_AS_OF,
            "hfc_bed_reports_reportMonth": REPORT_MONTH,
            "hfc_bed_reports_retrievedAt": nh["retrievedAt"],
            "hfc_home_health_list_sourceAsOf": lists["homeHealth"]["sourceAsOf"],
            "hfc_hospice_list_sourceAsOf": lists["hospice"]["sourceAsOf"],
            "hfc_county_lists_retrievedAt": lists["homeHealth"]["retrievedAt"],
            "hfc_actions_window": acts["window"],
            "hfc_actions_retrievedAt": max(m["retrievedAt"] for m in months),
            "cms_nursing_home_sourceAsOf": sources["nursing-home-provider-information"][
                "sourceModifiedAt"
            ],
            "cms_home_health_sourceAsOf": sources["home-health-care-agencies"][
                "sourceModifiedAt"
            ],
            "cms_hospice_sourceAsOf": sources["hospice-general-information"][
                "sourceModifiedAt"
            ],
            "license_effective_date": None,
            "license_expiration_date": None,
            "retrievedAt_is_not_sourceAsOf": True,
            "report_month_is_not_license_date": True,
            "cms_date_is_not_tennessee_license_date": True,
        },
        "regulatorMap": {
            "hfc": "Tennessee Health Facilities Commission (HFC)",
            "consolidation": "The Board for Licensing Health Care Facilities was sunset and its licensing role consolidated into HFC effective July 1, 2024. The archived Board is not a current regulator.",
            "hfcHome": HFC,
            "healthFacilityReports": REPORTS_PAGE,
            "countyHomeHealthHospice": COUNTY_PAGE,
            "facilityActions": FAAR_PAGE,
            "nursingHomeEnforcement": ENFORCEMENT_PAGE,
            "complaints": COMPLAINT_PAGE,
            "facilityListings": FACILITY_LISTINGS,
            "archivedBoard": ARCHIVE_BOARD,
            "cmsCareCompare": "https://www.medicare.gov/care-compare/",
        },
        "cmsOverlay": {
            "nursingHomes": cms["nursingHomes"],
            "homeHealth": cms["homeHealth"],
            "hospice": cms["hospice"],
            "source": "senior-national-intelligence.json geography TN (CMS class directories)",
            "asOf": "2026-08-27",
            "nationalFingerprint": NATIONAL["sourceFingerprint"],
            "addedToNationalTotals": False,
            "censusConfirmation": {
                "artifact": "artifacts/senior-metric-census-r2-03.json",
                "nursingHomes": 303,
                "homeHealth": 128,
                "hospice": 61,
            },
            "clocks": {
                "nursingHomes": clock(sources, "nursing-home-provider-information"),
                "homeHealth": clock(sources, "home-health-care-agencies"),
                "hospice": clock(sources, "hospice-general-information"),
                "inspections": clock(sources, "nursing-home-inspection-dates"),
                "ownership": clock(sources, "skilled-nursing-facility-all-owners"),
                "penalties": clock(sources, "nursing-home-penalties"),
            },
        },
        "nursingHomes": bed_class(
            nh,
            distinctFromCmsNursingHome=True,
            alzheimerBeds=sum(x.get("alzheimerBeds") or 0 for x in nh["facilities"]),
            ventBeds=sum(x.get("ventBeds") or 0 for x in nh["facilities"]),
            facilitiesWithDialysisServices=sum(
                1 for x in nh["facilities"] if x.get("dialysisServices") == "Y"
            ),
        ),
        "aclf": bed_class(
            beds["aclf"],
            credentialName="Assisted Care Living Facility (ACLF)",
            consumerExplanation="Tennessee's licensed assisted-care-living category",
            distinctFromNursingHome=True,
            distinctFromRha=True,
        ),
        "rha": bed_class(
            beds["rha"],
            credentialName="Residential Home for the Aged (RHA)",
            reportTitleUses="Home for the Aged",
            distinctFromNursingHome=True,
            distinctFromAclf=True,
            distinctFromAdultCareHome=True,
        ),
        "homeHealth": county_class(
            lists["homeHealth"],
            distinctFromCmsHomeHealth=True,
            exemptionLists={
                "eeoicpa": county_class(lists["homeHealthEeoicpaExempt"]),
                "pediatric": county_class(lists["homeHealthPediatricExempt"]),
            },
            exemptionListsAddedToMainList=False,
            capability="PARTIAL",
            capabilityReason="Official HFC list, but its printed source date is early 2024 (Department of Health licensure data), and it has no agency license number.",
        ),
        "hospice": county_class(
            lists["hospice"],
            distinctFromCmsHospice=True,
            capability="PARTIAL",
            capabilityReason="Official HFC list, but its printed source date is early 2024 (Department of Health licensure data), and it has no agency license number.",
        ),
        "adultCareHome": {
            "rosterRows": None,
            "capability": "NOT_ACQUIRED",
            "reason": "HFC publishes no Adult Care Home report on the Health Facility Reports page. Adult Care Home is not mapped into RHA or ACLF.",
            "actionRows": by_setting.get("adultCareHome", 0),
        },
        "facilityActions": {
            "source": FAAR_PAGE,
            "window": acts["window"],
            "sourceAsOf": months[-1]["reportMonth"],
            "retrievedAt": max(m["retrievedAt"] for m in months),
            "monthsAcquired": len(months),
            "monthsMissingFromArchive": acts["monthsMissingFromArchive"],
            "seniorClassActionRows": len(events),
            "byCareSetting": dict(sorted(by_setting.items())),
            "byLicenseClassAsPrinted": dict(
                sorted(Counter(e["licenseClassAsPrinted"] for e in events).items())
            ),
            "byOrderSection": dict(
                sorted(Counter(e["orderSection"] for e in events).items())
            ),
            "byAttribution": dict(sorted(by_attr.items())),
            "attachedToStateReportRow": by_attr.get(
                "attached_exact_license_number_and_name_agrees", 0
            ),
            "withCivilMonetaryPenalty": sum(
                1 for e in events if e["civilMonetaryPenalty"]
            ),
            "withProbation": sum(1 for e in events if e["probation"]),
            "withSuspensionOrRevocationLanguage": sum(
                1 for e in events if e["suspensionOrRevocation"]
            ),
            "cmpAmountParsedRows": sum(1 for e in events if e["cmpAmount"] is not None),
            "otherClassActionsNotPublished": acts["otherClassActions"],
            "abuseRegistryEntries": sum(m["abuseRegistryEntries"] for m in months),
            "abuseRegistryNamesPublished": False,
            "abuseRegistryIsPersonLevel": True,
            "attachmentRule": "exact license class + license number on the July 2026 HFC report, and the printed name agrees after normalization; otherwise standalone",
            "attachedToCmsProfile": 0,
            "nameOnlyJoins": 0,
            "capability": "PARTIAL",
        },
        "nursingHomeEnforcementReport": {
            "source": "https://www.tn.gov/content/dam/tn/hfc/documents/Annual%20Nursing%20Home%20Inspection%20and%20Enforcement%20Report-2025.pdf",
            "title": "Annual Nursing Home Inspection and Enforcement Report 2025 (Report to the 114th General Assembly, February 2025)",
            "pages": 15,
            "statedNursingHomesOperating2024": 308,
            "statedCmsCertified2024": 304,
            "facilityLevelRowsTaken": 0,
            "usedAsIdentitySource": False,
            "capability": "KNOWN",
            "note": "Narrative and aggregate tables; context only. Facility-level inspection evidence stays on CMS profiles.",
        },
        "complaints": {
            "intake": "KNOWN",
            "portal": "HFC Public Records and Complaints portal (GovQA)",
            "providerLevelRows": None,
            "outcomeBulk": "NOT_ACQUIRED",
            "capability": "REQUEST_ONLY",
            "complaintIsNotDeficiency": True,
            "complaintIsNotEnforcement": True,
        },
        "facilityListings": {
            "url": FACILITY_LISTINGS,
            "capability": "KNOWN",
            "bulkCapability": "NOT_ACQUIRED",
            "reason": "Interactive search; it refused automated access (HTTP 403) and was not scraped. Use it to verify a facility.",
        },
        "closures": {
            "rows": None,
            "capability": "NOT_ACQUIRED",
            "reason": "Closed-facility lists appear only inside Commission meeting materials; deferred.",
        },
        "certificateOfNeed": {
            "usedAsIdentity": False,
            "note": "CON applications are not licensed operating facilities.",
        },
        "cmsMoratorium": {
            "source": MORATORIUM,
            "note": "CMS set a six-month nationwide moratorium starting May 20, 2026 on initial Medicare enrollment of new Home Health Agencies and hospices. It is a federal enrollment rule, not a Tennessee license suspension.",
        },
        "crosswalk": {
            "exactStateToCmsBridges": 0,
            "attempted": True,
            "method": "exact CCN in state source",
            "ccnInHfcReports": False,
            "ccnInCountyLists": False,
            "nameOnly": "UNSAFE",
            "hfcNursingHomeRowsUnresolved": len(nh["facilities"]),
            "cmsNursingHomeRowsUnresolved": cms["nursingHomes"],
            "capability": "UNKNOWN",
            "reason": "The HFC reports have no CCN, so no exact bridge exists. Zero proven exact bridges does not mean zero overlap: HFC's own 2025 report says most licensed nursing homes are CMS-certified, but which row is which is not established here.",
        },
        "cityContext": {
            "grain": "HFC report rows with that city in the source address; Home Health and Hospice use the county list for the city's county. Not a local page.",
            "cities": city_counts,
        },
        "expansionLedger": {
            "NET_NEW_STATE_RESEARCH_IDENTITIES": sum(
                len(beds[k]["facilities"]) for k in ("nursingHomes", "aclf", "rha")
            ),
            "NET_NEW_CANONICAL_FACILITIES": 0,
            "NET_NEW_PUBLIC_PROFILES": 0,
            "EXISTING_FACILITIES_ENRICHED": 0,
            "GRAPH_WRITES": 0,
            "CLAIM_ELIGIBILITY_BROADENED": False,
        },
        "capabilities": [
            {"id": "cms-nursing-home-tn", "state": "KNOWN"},
            {"id": "cms-home-health-tn", "state": "KNOWN"},
            {"id": "cms-hospice-tn", "state": "KNOWN"},
            {"id": "hfc-nursing-home-report-july-2026", "state": "KNOWN"},
            {"id": "hfc-aclf-report-july-2026", "state": "KNOWN"},
            {"id": "hfc-rha-report-july-2026", "state": "KNOWN"},
            {"id": "hfc-home-health-county-list", "state": "PARTIAL"},
            {"id": "hfc-hospice-county-list", "state": "PARTIAL"},
            {"id": "hfc-home-health-hospice-license-numbers", "state": "UNKNOWN"},
            {"id": "adult-care-home-roster", "state": "NOT_ACQUIRED"},
            {"id": "hfc-facility-actions-2024-2026", "state": "PARTIAL"},
            {"id": "hfc-nursing-home-enforcement-report-2025", "state": "KNOWN"},
            {"id": "hfc-complaint-intake", "state": "KNOWN"},
            {"id": "hfc-provider-complaints", "state": "REQUEST_ONLY"},
            {"id": "hfc-facility-listings-bulk", "state": "NOT_ACQUIRED"},
            {"id": "closed-facility-list", "state": "NOT_ACQUIRED"},
            {"id": "exact-state-to-cms-join", "state": "UNKNOWN"},
            {"id": "name-only-state-to-cms-join", "state": "UNSUPPORTED"},
            {"id": "combined-tennessee-senior-facilities", "state": "UNSUPPORTED"},
            {"id": "combined-tennessee-senior-beds", "state": "UNSUPPORTED"},
        ],
        "fingerprint": "",
    }
    snapshot["fingerprint"] = sha(snapshot)

    def agencies(key: str) -> list[dict]:
        rows = [(c["county"], a) for c in lists[key]["counties"] for a in c["agencies"]]
        per = Counter(a for _, a in rows)
        return [{"agency": a, "licensedCounties": n} for a, n in sorted(per.items())]

    web = {
        "fingerprint": snapshot["fingerprint"],
        "reportMonth": REPORT_MONTH,
        "nursingHomes": [
            {
                k: f[k]
                for k in (
                    "licenseNumber",
                    "name",
                    "licenseStatus",
                    "street",
                    "city",
                    "zip",
                    "county",
                    "totalBeds",
                )
            }
            for f in nh["facilities"]
        ],
        "aclf": [
            {
                k: f[k]
                for k in (
                    "licenseNumber",
                    "name",
                    "licenseStatus",
                    "street",
                    "city",
                    "zip",
                    "county",
                    "totalBeds",
                    "securedBeds",
                )
            }
            for f in beds["aclf"]["facilities"]
        ],
        "rha": [
            {
                k: f[k]
                for k in (
                    "licenseNumber",
                    "name",
                    "licenseStatus",
                    "street",
                    "city",
                    "zip",
                    "county",
                    "totalBeds",
                )
            }
            for f in beds["rha"]["facilities"]
        ],
        "homeHealthAgencies": agencies("homeHealth"),
        "hospiceAgencies": agencies("hospice"),
        "actions": sorted(
            events, key=lambda e: (e["reportMonth"], e["id"]), reverse=True
        ),
    }
    return snapshot, web


def ts_module(body: dict) -> str:
    return (
        "/** Generated by scripts/build-tn-public-snapshot.py. Do not edit by hand. */\n"
        "export const TN_PUBLIC_SNAPSHOT = "
        + json.dumps(body, indent=2, ensure_ascii=False)
        + " as const;\nexport type TnPublicSnapshot = typeof TN_PUBLIC_SNAPSHOT;\n"
    )


def main() -> None:
    if "--parse" in sys.argv:
        parse()
    body, web_rows = build()
    art = json.dumps(body, indent=2, ensure_ascii=False) + "\n"
    web = json.dumps(web_rows, indent=1, ensure_ascii=False) + "\n"
    if "--check" in sys.argv:
        for path, want in ((ART, art), (WEB_LIST, web)):
            if path.read_text(encoding="utf-8").replace("\r\n", "\n") != want:
                raise SystemExit(f"{path.relative_to(ROOT)} drifted from the builder")
        committed_ts = TS.read_text(encoding="utf-8").replace("\r\n", "\n")
        if f'"fingerprint": "{body["fingerprint"]}"' not in committed_ts:
            raise SystemExit("tn-public-snapshot.ts fingerprint drifted")
        print("TN-SEN-001 snapshot check OK", body["fingerprint"])
        return
    ART.write_text(art, encoding="utf-8")
    WEB_LIST.write_text(web, encoding="utf-8")
    TS.write_text(ts_module(body), encoding="utf-8")
    fa = body["facilityActions"]
    print(
        json.dumps(
            {
                "fingerprint": body["fingerprint"],
                "nh": [
                    body["nursingHomes"]["reportRows"],
                    body["nursingHomes"]["licensedBeds"],
                    body["nursingHomes"]["licenseStatusCounts"],
                ],
                "aclf": [
                    body["aclf"]["reportRows"],
                    body["aclf"]["licensedBeds"],
                    body["aclf"]["licenseStatusCounts"],
                ],
                "rha": [
                    body["rha"]["reportRows"],
                    body["rha"]["licensedBeds"],
                    body["rha"]["licenseStatusCounts"],
                ],
                "hh": {
                    k: body["homeHealth"][k]
                    for k in (
                        "countyServiceRows",
                        "distinctAgenciesAsPrinted",
                        "sourceAsOf",
                        "maxCountiesForOneAgency",
                    )
                },
                "hhEx": {
                    k: [v["countyServiceRows"], v["distinctAgenciesAsPrinted"]]
                    for k, v in body["homeHealth"]["exemptionLists"].items()
                },
                "hospice": {
                    k: body["hospice"][k]
                    for k in (
                        "countyServiceRows",
                        "distinctAgenciesAsPrinted",
                        "sourceAsOf",
                    )
                },
                "actions": {
                    k: fa[k]
                    for k in (
                        "seniorClassActionRows",
                        "byCareSetting",
                        "byAttribution",
                        "withCivilMonetaryPenalty",
                        "cmpAmountParsedRows",
                        "otherClassActionsNotPublished",
                        "abuseRegistryEntries",
                        "monthsAcquired",
                    )
                },
                "cities": body["cityContext"]["cities"],
            },
            indent=1,
        )
    )


if __name__ == "__main__":
    main()
