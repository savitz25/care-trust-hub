#!/usr/bin/env python3
"""NV-SEN-001 — Nevada senior-care state layer over the accepted CMS spine.

Stage 1 (--parse; needs gitignored raw files in data/nevada/nv-sen-001/raw/):
  Nevada Health Authority, Health Care Purchasing and Compliance Division, Bureau of Health Care
  Quality and Compliance (HCQC) public licensee search (nvdpbh.aithent.com LicenseeSearch,
  Business Unit = Health Facilities, Entity = Agency). One class-level search per credential type
  (SNF, SFD, AGC, HIC, ADC, HHA, HBR, HSB, HPC, HFS; County = All), paged through the search's own
  result set, then each returned row's public "View Detail" page (SODPublicView) once. The search
  lists active licenses only.
  Kept: facility name, credential type and number, status, expiration and first-issue dates, city /
  ZIP, bed count, Federal Provider # exactly as printed, endorsements, bed categories, the state
  inspection index (date, inspection number, event ID, grade), and State Sanctions rows.
  Dropped: administrator / primary-contact names, phone numbers, street addresses, inspection
  document bodies.
  -> data/nevada/nv-sen-001/hcqc-facilities.json (committed)
  The NV CMS CCN class list comes from the accepted CMS directory already loaded for SeniorTrustHub
  (read-only), -> data/nevada/nv-sen-001/cms-nv-ccn-classes.json (committed). No CMS download.
Stage 2 (default): stage JSON + accepted CMS national partition -> public snapshot, TS module, and
  the server-side list used by /nevada. --check compares the committed files.

A Residential Facility for Groups is the base state class. Assisted living is an endorsement on an
RFG, and so is Alzheimer's disease; neither is assumed. State license != CMS certification. A state
row bridges to CMS only through a Federal Provider # printed on that row that is a current CMS CCN of
the same class. No name joins.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/nevada/nv-sen-001/raw"
STAGE = ROOT / "data/nevada/nv-sen-001"
ART = ROOT / "artifacts/nv-sen-001-public-snapshot.json"
TS = ROOT / "packages/domain/src/nv-public-snapshot.ts"
WEB_LIST = ROOT / "apps/web/src/data/nevada-facility-lists.json"
NATIONAL = json.loads((ROOT / "apps/web/src/data/senior-national-intelligence.json").read_text(encoding="utf-8"))
GENERATED_AT = "2026-09-25T21:00:00Z"
SEARCH = "https://nvdpbh.aithent.com/Protected/LIC/LicenseeSearch.aspx?Program=HF&PubliSearch=Y"
FIND = "https://www.hcqc.nv.gov/find-a-health-facility/"
HCQC = "https://www.hcqc.nv.gov/"
NVHA = "https://www.nvha.nv.gov/"
COMPLAINTS = "https://www.hcqc.nv.gov/regulatory/health-facility-licensing-and-information/health-facilities-complaints/"
RFG_PAGE = "https://www.hcqc.nv.gov/regulatory/health-facility-licensing-and-information/non-medical-facilities/residential-facility-for-groups-adult-group-care-assisted-living/"
RFG_ENDORSEMENT_PDF = "https://www.hcqc.nv.gov/contentassets/da1fedeba3da4e3fab643ff77bdb71bf/rfg-endorsement.pdf"
CLASSES = ["SNF", "SFD", "AGC", "HIC", "ADC", "HHA", "HBR", "HSB", "HPC", "HFS"]
CMS_CLASS = {"SNF": "nursing_home", "SFD": "nursing_home", "HHA": "home_health", "HBR": "home_health", "HSB": "home_health", "HPC": "hospice", "HFS": "hospice"}
CITIES = ["LAS VEGAS", "HENDERSON", "RENO"]
AL = "ASSISTED LIVING SERVICES"
ALZ = "ALZHEIMER DISEASE"


def dumps(obj) -> str:
    return json.dumps(obj, indent=2, ensure_ascii=False) + "\n"


def sha(obj) -> str:
    body = {k: v for k, v in obj.items() if k not in ("generatedAt", "fingerprint")}
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def txt(x: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", x or ""))).strip()


def iso(mdy: str) -> str | None:
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", mdy or "")
    return f"{m.group(3)}-{m.group(1)}-{m.group(2)}" if m else None


def col(row: dict, prefix: str) -> str:
    return next((v for k, v in row.items() if k.startswith(prefix)), "")


# ---------------------------------------------------------------------------------------------- stage 1
SECTION = r"(Credential Information|Facility Bed Information|Additional Statement of Deficiency and Plan of Correction|Statement of Deficiency and Plan of Correction|State Sanctions \(Disciplinary Action\) (?:&amp;|&) Federal Termination Notices)"


def sections(s: str) -> dict:
    out = {}
    parts = re.split(SECTION, s)
    for i in range(1, len(parts) - 1, 2):
        name = parts[i].replace("&amp;", "&")
        if name in out:
            continue
        rows = []
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", parts[i + 1], re.S):
            cells = [txt(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
            if cells and any(cells):
                rows.append(cells)
        out[name] = rows
    return out


def parse_detail(path: Path) -> dict:
    s = path.read_text(encoding="utf-8", errors="ignore")
    t = sections(s)
    place = re.search(r'id="ctl00_ContentPlaceHolder1_EducatorProfile1_lblState">([^<]*)<', s)
    m = re.match(r"^(.*?),\s*([A-Z]{2})\s+(\d{5})", txt(place.group(1)) if place else "")
    cred = [r for r in t.get("Credential Information", []) if len(r) >= 5 and r[0] != "Credential Type" and not re.match(r"^\d+-\d+ of", r[0])]
    beds = {}
    gm = re.search(r'<table[^>]*id="ctl00_ContentPlaceHolder1_ucBedInformation_ucBedInformation_ucGridUserControl_ResultsGrid"[^>]*>(.*?)</table>', s, re.S)
    grid = gm.group(1) if gm else ""
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", grid, re.S):
        kind = re.search(r'_lblBed"[^>]*>([^<]*)<', tr)
        count = re.search(r'<input[^>]*id="[^"]*_txtCount"[^>]*>', tr)
        value = re.search(r'value="([^"]*)"', count.group(0)) if count else None
        if kind and value and value.group(1).strip().isdigit():
            label = re.sub(r"[^ -~]", "'", txt(kind.group(1)))
            beds[label] = int(value.group(1).strip())
    total = re.search(r"Total Count\s*:\s*Count=(\d+)\s*Low Income Bed Count=(\d+)", txt(s))
    inspections = []
    for r in t.get("Statement of Deficiency and Plan of Correction", []):
        if r and re.match(r"\d{2}/\d{2}/\d{4}", r[0]):
            inspections.append({"date": iso(r[0]), "inspectionNumber": r[1] or None, "eventId": None if r[2] in ("", "N/A") else r[2], "grade": (r[3] or None) if len(r) > 5 else None})
    sanctions = []
    for r in t.get("State Sanctions (Disciplinary Action) & Federal Termination Notices", []):
        if len(r) >= 4 and r[0] not in ("Type",) and not re.match(r"^\d+-\d+ of", r[0]) and not r[0].startswith("Federal Termination") and re.match(r"\d{2}/\d{2}/\d{4}", r[1] or ""):
            sanctions.append({"type": r[0], "date": iso(r[1]), "status": r[2] or None, "statusReason": (r[3] or None) if len(r) > 3 else None, "closedDate": iso(r[4]) if len(r) > 4 else None})
    return {
        "city": m.group(1).strip().upper() if m else None,
        "state": m.group(2) if m else None,
        "zip": m.group(3) if m else None,
        "credentialRows": [{"type": r[0], "number": r[1], "endorsement": None if r[2] in ("", "N/A") else r[2], "status": r[3], "expires": iso(r[4])} for r in cred],
        "bedCategories": beds,
        "totalBeds": int(total.group(1)) if total else None,
        "lowIncomeBeds": int(total.group(2)) if total else None,
        "inspections": sorted(inspections, key=lambda x: (x["date"] or "", x["inspectionNumber"] or ""), reverse=True),
        "sanctions": sorted(sanctions, key=lambda x: (x["date"] or "", x["type"]), reverse=True),
    }


def parse() -> None:
    grid = json.loads((RAW / "all.json").read_text(encoding="utf-8"))
    out, dup_rows = [], 0
    seen = set()
    for cls in CLASSES:
        for r in grid.get(cls, {"rows": []})["rows"]:
            key = (cls, r["_licenseId"])
            if key in seen:
                dup_rows += 1
                continue
            seen.add(key)
            dpath = RAW / "detail" / f"{cls}_{r['_licenseId']}.html"
            d = parse_detail(dpath) if dpath.exists() else None
            cred = next((c for c in (d or {}).get("credentialRows", []) if c["number"] == r["Credential Number"]), None)
            endorsement = cred["endorsement"] if cred else None
            out.append(
                {
                    "cls": cls,
                    "credentialType": r["Credential Type"],
                    "credentialNumber": r["Credential Number"],
                    "licenseNumber": r["_hfLicenseNumber"],
                    "name": r["Name"],
                    "status": r["Status"],
                    "expires": iso(r["Expiration Date"]),
                    "firstIssued": iso(r["First Issue Date"]),
                    "city": d["city"] if d else None,
                    "zip": d["zip"] if d else None,
                    "bedCount": int(r["Bed Count"]) if r["Bed Count"].isdigit() else None,
                    "federalProviderAsPrinted": r["Federal Provider #"].strip() or None,
                    "gridDisciplinaryFlag": col(r, "Disciplinary"),
                    "detailFetched": d is not None,
                    "endorsementsAsPrinted": endorsement,
                    "endorsements": [e.strip() for e in endorsement.split(",")] if endorsement else [],
                    "bedCategories": d["bedCategories"] if d else {},
                    "detailTotalBeds": d["totalBeds"] if d else None,
                    "inspections": d["inspections"] if d else [],
                    "sanctions": d["sanctions"] if d else [],
                }
            )
    out.sort(key=lambda x: (CLASSES.index(x["cls"]), int(x["licenseNumber"]), x["credentialNumber"]))
    body = {
        "source": SEARCH,
        "method": "One class-level public licensee search per credential type (County = All), paged through the search result set, then each returned row's public View Detail page once",
        "retrievedAt": {cls: grid[cls]["retrievedAt"] for cls in CLASSES if cls in grid},
        "detailRetrievedWindow": json.loads((RAW / "detail-window.json").read_text(encoding="utf-8")),
        "searchTotals": {cls: grid[cls]["total"] for cls in CLASSES if cls in grid},
        "duplicateGridRowsRemoved": dup_rows,
        "fieldsDropped": ["Primary Contact Name", "Primary Contact Role", "Phone#", "street address", "inspection document bodies"],
        "facilities": out,
    }
    (STAGE / "hcqc-facilities.json").write_text(dumps(body), encoding="utf-8")
    cms = {}
    for ln in (RAW / "cms_ccn_class.txt").read_text(encoding="utf-8").splitlines():
        if ln.strip():
            ccn, klass = ln.strip().split("|")
            cms[ccn] = klass
    (STAGE / "cms-nv-ccn-classes.json").write_text(
        dumps({"source": "Accepted SeniorTrustHub CMS current directories (provider_directory_status CURRENT_ACTIVE, CCN prefix 29), read-only", "ccns": dict(sorted(cms.items()))}),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------------------------- stage 2
def clock(sources: dict, key: str) -> dict:
    s = sources[key]
    return {"datasetKey": key, "officialUrl": s.get("officialUrl"), "sourceModifiedAt": s.get("sourceModifiedAt"), "retrievedAt": s.get("retrievedAt"), "sourcePeriod": s.get("sourcePeriod")}


def build():
    st = json.loads((STAGE / "hcqc-facilities.json").read_text(encoding="utf-8"))
    cms = json.loads((STAGE / "cms-nv-ccn-classes.json").read_text(encoding="utf-8"))["ccns"]
    F = st["facilities"]
    by = defaultdict(list)
    for f in F:
        by[f["cls"]].append(f)
    geo = next(r for r in NATIONAL["geography"] if r["state"] == "NV")
    if (geo["nursingHomes"], geo["homeHealth"], geo["hospice"]) != (66, 228, 183):
        raise SystemExit(f"Nevada CMS partition drifted: {geo}")
    cms_counts = Counter(cms.values())
    if (cms_counts["nursing_home"], cms_counts["home_health"], cms_counts["hospice"]) != (66, 228, 183):
        raise SystemExit(f"Nevada CMS CCN list drifted: {cms_counts}")
    sources = {s["datasetKey"]: s for s in NATIONAL["sources"]} if isinstance(NATIONAL.get("sources"), list) else NATIONAL["sources"]

    def bridge(f: dict) -> str | None:
        p = f["federalProviderAsPrinted"]
        if not p or not re.fullmatch(r"\d{6}", p):
            return None
        return p if cms.get(p) == CMS_CLASS.get(f["cls"]) else None

    def printed_state(f: dict) -> str:
        p = f["federalProviderAsPrinted"]
        if not p:
            return "none_printed"
        if not re.fullmatch(r"\d{6}", p):
            return "printed_not_a_ccn"
        if p not in cms:
            return "printed_ccn_not_in_cms_current_directory"
        return "exact_same_class" if cms[p] == CMS_CLASS.get(f["cls"]) else "printed_ccn_other_cms_class"

    def cls_block(code: str, label: str, **extra) -> dict:
        rows = by[code]
        d = {
            "credentialType": rows[0]["credentialType"] if rows else None,
            "code": code,
            "label": label,
            "distinctCredentialNumbers": len({f["credentialNumber"] for f in rows}),
            "searchTotal": st["searchTotals"].get(code),
            "statusCounts": dict(Counter(f["status"] for f in rows)),
            "bedsAsPrinted": sum(f["bedCount"] or 0 for f in rows),
            "bedsAreCapacityNotResidents": True,
            "detailPagesParsed": sum(1 for f in rows if f["detailFetched"]),
            "withInspectionIndex": sum(1 for f in rows if f["inspections"]),
            "inspectionIndexRows": sum(len(f["inspections"]) for f in rows),
            "withStateSanction": sum(1 for f in rows if f["sanctions"]),
            "stateSanctionRows": sum(len(f["sanctions"]) for f in rows),
            "sourceAsOf": None,
            "retrievedAt": st["retrievedAt"].get(code),
            "source": SEARCH,
        }
        if code in CMS_CLASS:
            states = Counter(printed_state(f) for f in rows)
            d["federalProviderPrinted"] = sum(1 for f in rows if f["federalProviderAsPrinted"])
            d["federalProviderStates"] = dict(sorted(states.items()))
            d["exactCmsBridges"] = sum(1 for f in rows if bridge(f))
            d["distinctBridgedCcns"] = len({bridge(f) for f in rows if bridge(f)})
        d.update(extra)
        return d

    rfg = by["AGC"]
    endorse = Counter(e for f in rfg for e in f["endorsements"])
    al = [f for f in rfg if AL in f["endorsements"]]
    alz = [f for f in rfg if ALZ in f["endorsements"]]
    al_alz = [f for f in rfg if AL in f["endorsements"] and ALZ in f["endorsements"]]
    alz_beds = sum(f["bedCategories"].get("Category-II (Alzheimer's)", 0) for f in rfg)
    snf_all = by["SNF"] + by["SFD"]
    bridged_nh = {bridge(f) for f in snf_all if bridge(f)}
    cms_nh = {c for c, k in cms.items() if k == "nursing_home"}
    sanctions = [dict(s, cls=f["cls"], credentialNumber=f["credentialNumber"], name=f["name"]) for f in F for s in f["sanctions"]]
    senior_classes = ["SNF", "SFD", "AGC", "HIC", "ADC", "HHA", "HBR", "HSB", "HPC", "HFS"]
    insp_dates = sorted(i["date"] for f in F for i in f["inspections"] if i["date"])

    def city_count(code: str, c: str) -> int:
        return sum(1 for f in by[code] if f["city"] == c)

    snapshot = {
        "version": "senior-nv-state-intel-v1",
        "ticket": "NV-SEN-001",
        "publicationPath": "/nevada",
        "asOf": "2026-09-25",
        "snapshotAsOf": "2026-09-25",
        "retrievedAt": max(st["retrievedAt"].values()),
        "generatedAt": GENERATED_AT,
        "localWorkNeededNow": "NO",
        "claimEligibilityBroadened": False,
        "no_trust_score": True,
        "no_aggregate_rating": True,
        "no_rankings": True,
        "no_city_pages": True,
        "clocks": {
            "hcqc_search_retrievedAt": st["retrievedAt"],
            "hcqc_detail_retrieved_window": st["detailRetrievedWindow"],
            "hcqc_search_prints_no_as_of_date": True,
            "license_expiration_dates_are_per_row": True,
            "inspection_dates_are_per_row": True,
            "earliest_inspection_date": insp_dates[0] if insp_dates else None,
            "latest_inspection_date": insp_dates[-1] if insp_dates else None,
            "cms_date_is_not_nevada_license_date": True,
            "retrievedAt_is_not_sourceAsOf": True,
        },
        "regulatorMap": {
            "current": {
                "authority": "Nevada Health Authority",
                "division": "Health Care Purchasing and Compliance Division",
                "bureau": "Bureau of Health Care Quality and Compliance (HCQC)",
                "site": HCQC,
                "authoritySite": NVHA,
                "facilitySearch": FIND,
                "complaints": COMPLAINTS,
            },
            "historicalNames": [
                "Nevada Division of Public and Behavioral Health (DPBH), Bureau of Health Care Quality and Compliance",
                "Nevada State Health Division",
            ],
            "historicalNamesStillInSourceUrls": "The facility search still runs on nvdpbh.aithent.com and older HCQC pages sit under /Reg/HealthFacilities/; the name in the URL is not the current regulator.",
            "cmsCareCompare": "https://www.medicare.gov/care-compare/",
            "administratorLicensingIsSeparate": "Nursing facility administrators, residential facility administrators, and health services executives are licensed separately; an administrator is a person, not a facility.",
        },
        "cmsOverlay": {
            "nursingHomes": geo["nursingHomes"],
            "homeHealth": geo["homeHealth"],
            "hospice": geo["hospice"],
            "source": "senior-national-intelligence.json geography NV (CMS class directories)",
            "asOf": NATIONAL["generatedAt"][:10],
            "nationalFingerprint": NATIONAL["sourceFingerprint"],
            "addedToNationalTotals": False,
            "clocks": {
                "nursingHomes": clock(sources, "nursing-home-provider-information"),
                "homeHealth": clock(sources, "home-health-care-agencies"),
                "hospice": clock(sources, "hospice-general-information"),
            },
        },
        "skilledNursing": cls_block("SNF", "Facility for Skilled Nursing (SNF)", distinctFromCmsNursingHome=True),
        "skilledNursingDistinctPart": cls_block("SFD", "Skilled Nursing Facility Distinct Part of Hospital (SFD)", distinctFromCmsNursingHome=True),
        "rfg": cls_block(
            "AGC",
            "Residential Facility for Groups (RFG; credential code AGC)",
            endorsementCountsAsPrinted=dict(sorted(endorse.items(), key=lambda kv: (-kv[1], kv[0]))),
            withAnyEndorsementPrinted=sum(1 for f in rfg if f["endorsements"]),
            withNoEndorsementPrinted=sum(1 for f in rfg if f["detailFetched"] and not f["endorsements"]),
            assistedLivingEndorsed=len(al),
            assistedLivingEndorsedBeds=sum(f["bedCount"] or 0 for f in al),
            alzheimerEndorsed=len(alz),
            assistedLivingAndAlzheimerEndorsed=len(al_alz),
            categoryIIAlzheimerBedsPrinted=alz_beds,
            categoryIBedsPrinted=sum(f["bedCategories"].get("Category-I", 0) for f in rfg),
            categoryIINonAlzheimerBedsPrinted=sum(f["bedCategories"].get("Category-II", 0) for f in rfg),
            alzheimerBedsWithoutEndorsement=sum(1 for f in rfg if f["bedCategories"].get("Category-II (Alzheimer's)", 0) > 0 and ALZ not in f["endorsements"]),
            alzheimerEndorsedWithZeroAlzheimerBeds=sum(1 for f in rfg if f["bedCategories"].get("Category-II (Alzheimer's)", 0) == 0 and ALZ in f["endorsements"]),
            bedCategoriesShownAsPrinted=True,
            everyRfgIsAssistedLiving=False,
            assistedLivingIsAnEndorsedSubset=True,
            endorsementGuide=RFG_ENDORSEMENT_PDF,
            classPage=RFG_PAGE,
        ),
        "hirc": cls_block("HIC", "Home for Individual Residential Care (HIRC; credential code HIC)", distinctFromRfg=True),
        "adultDay": cls_block("ADC", "Facility for the Care of Adults During the Day (Adult Day Care)", distinctFromRfg=True),
        "homeHealth": cls_block("HHA", "Agency to Provide Nursing in the Home (Home Health Agency; HHA)", distinctFromCmsHomeHealth=True, duplicateGridRowsRemoved=st["duplicateGridRowsRemoved"]),
        "homeHealthBranch": cls_block("HBR", "Agency to Provide Nursing in the Home — Branch Office (HBR)", branchesAreNotAgencies=True),
        "homeHealthSubUnit": {"code": "HSB", "label": "Agency to Provide Nursing in the Home — Sub Unit (HSB)", "distinctCredentialNumbers": len(by["HSB"]), "searchTotal": st["searchTotals"].get("HSB")},
        "hospiceProgram": cls_block("HPC", "Hospice Care — Program of Care (HPC)", distinctFromCmsHospice=True),
        "hospiceFacility": cls_block("HFS", "Facility for Hospice Care (HFS)", distinctFromHospiceProgram=True),
        "inspections": {
            "capability": "PARTIAL",
            "grain": "Statement of Deficiency / Plan of Correction index row on the HCQC facility detail page (date, inspection number, event ID, grade)",
            "facilitiesWithIndex": sum(1 for f in F if f["inspections"]),
            "indexRows": sum(len(f["inspections"]) for f in F),
            "rowsByClass": {c: sum(len(f["inspections"]) for f in by[c]) for c in senior_classes},
            "findingsCopied": False,
            "stateInspectionIsNotCmsInspection": True,
            "attachedByStateLicenseRow": True,
        },
        "stateSanctions": {
            "capability": "PARTIAL",
            "grain": "State Sanctions (Disciplinary Action) row on the HCQC facility detail page",
            "rows": len(sanctions),
            "facilities": len({(s["cls"], s["credentialNumber"]) for s in sanctions}),
            "byType": dict(sorted(Counter(s["type"] for s in sanctions).items(), key=lambda kv: (-kv[1], kv[0]))),
            "byClass": {c: sum(1 for s in sanctions if s["cls"] == c) for c in senior_classes},
            "byStatus": dict(Counter(s["status"] or "(none)" for s in sanctions)),
            "gridDisciplinaryFlagYes": sum(1 for f in F if f["gridDisciplinaryFlag"].startswith("Y")),
            "gridFlagUnderstatesDetail": True,
            "attachedByStateLicenseRow": True,
            "nameOnlyJoins": 0,
            "activeLicensesOnly": True,
        },
        "complaints": {
            "capability": "KNOWN_INTAKE",
            "intake": COMPLAINTS,
            "providerLevelRows": None,
            "records": "REQUEST_ONLY",
            "complaintIsNotDeficiency": True,
            "complaintIsNotEnforcement": True,
        },
        "crosswalk": {
            "method": "Federal Provider # printed on the HCQC row, exactly six digits, present in the accepted CMS current directory for the same class",
            "ccnInHcqcSource": True,
            "exactStateToCmsBridges": sum(1 for f in F if bridge(f)),
            "cmsNursingHomesBridged": len(bridged_nh & cms_nh),
            "cmsNursingHomesNotBridged": len(cms_nh - bridged_nh),
            "zeroBridgesIsNotZeroOverlap": True,
            "nameOnly": "UNSAFE",
        },
        "cityContext": {
            "cities": {c.title(): {"snf": city_count("SNF", c), "rfg": city_count("AGC", c), "rfgAssistedLiving": sum(1 for f in al if f["city"] == c), "hirc": city_count("HIC", c), "homeHealth": city_count("HHA", c), "hospiceProgram": city_count("HPC", c)} for c in CITIES},
            "addressIsNotServiceArea": True,
        },
        "expansionLedger": {"GRAPH_WRITES": 0, "NET_NEW_CANONICAL_FACILITIES": 0, "STATE_LICENSE_ROWS": len(F), "DATABASE_WRITES": 0},
        "capabilities": [
            {"id": "hcqc-facility-search", "label": "HCQC facility search (active licenses)", "state": "KNOWN"},
            {"id": "snf-roster", "label": "State SNF and SFD licenses", "state": "KNOWN"},
            {"id": "rfg-roster", "label": "Residential Facility for Groups licenses", "state": "KNOWN"},
            {"id": "rfg-assisted-living-endorsement", "label": "RFG Assisted Living endorsement", "state": "KNOWN"},
            {"id": "rfg-alzheimer-endorsement", "label": "RFG Alzheimer's disease endorsement", "state": "KNOWN"},
            {"id": "hirc-roster", "label": "Homes for Individual Residential Care", "state": "KNOWN"},
            {"id": "adult-day-roster", "label": "Adult Day Care facilities", "state": "KNOWN"},
            {"id": "home-health-roster", "label": "State Home Health agencies and branches", "state": "KNOWN"},
            {"id": "hospice-roster", "label": "Hospice programs and hospice facilities", "state": "KNOWN"},
            {"id": "inactive-licenses", "label": "Expired, closed, or revoked licenses", "state": "NOT_ACQUIRED"},
            {"id": "state-inspection-index", "label": "HCQC inspection index (date, number, grade)", "state": "PARTIAL"},
            {"id": "state-inspection-findings", "label": "HCQC inspection findings text", "state": "NOT_ACQUIRED"},
            {"id": "state-sanctions", "label": "State sanctions on active licenses", "state": "PARTIAL"},
            {"id": "complaint-intake", "label": "HCQC complaint intake", "state": "KNOWN"},
            {"id": "complaint-records", "label": "Complaint records and outcomes", "state": "REQUEST_ONLY"},
            {"id": "exact-ccn-bridge", "label": "State row to CMS by printed CCN", "state": "PARTIAL"},
            {"id": "name-only-bridge", "label": "State to CMS by name", "state": "UNSUPPORTED"},
            {"id": "combined-nevada-senior-facilities", "label": "Combined Nevada senior-facility total", "state": "UNSUPPORTED"},
            {"id": "combined-nevada-senior-beds", "label": "Combined Nevada senior bed total", "state": "UNSUPPORTED"},
        ],
        "fingerprint": "",
    }
    snapshot["fingerprint"] = sha(snapshot)

    def row(f: dict) -> dict:
        return {
            "cls": f["cls"],
            "credentialNumber": f["credentialNumber"],
            "licenseNumber": f["licenseNumber"],
            "name": f["name"],
            "status": f["status"],
            "expires": f["expires"],
            "firstIssued": f["firstIssued"],
            "city": f["city"],
            "zip": f["zip"],
            "bedCount": f["bedCount"],
            "endorsements": f["endorsements"],
            "federalProviderAsPrinted": f["federalProviderAsPrinted"],
            "cmsBridge": bridge(f),
            "federalProviderState": printed_state(f) if f["cls"] in CMS_CLASS else None,
            "latestInspection": f["inspections"][0]["date"] if f["inspections"] else None,
            "inspectionCount": len(f["inspections"]),
            "sanctions": f["sanctions"],
        }

    web = {"fingerprint": snapshot["fingerprint"], "facilities": [row(f) for f in F]}
    return snapshot, web


def ts_module(body: dict) -> str:
    return "/** Generated by scripts/build-nv-public-snapshot.py. Do not edit by hand. */\nexport const NV_PUBLIC_SNAPSHOT = " + json.dumps(body, indent=2, ensure_ascii=False) + " as const;\nexport type NvPublicSnapshot = typeof NV_PUBLIC_SNAPSHOT;\n"


def main() -> None:
    if "--parse" in sys.argv:
        parse()
    body, web_rows = build()
    art = dumps(body)
    web = json.dumps(web_rows, indent=1, ensure_ascii=False) + "\n"
    if "--check" in sys.argv:
        for path, want in ((ART, art), (WEB_LIST, web)):
            if path.read_text(encoding="utf-8").replace("\r\n", "\n") != want:
                raise SystemExit(f"{path.relative_to(ROOT)} drifted from the builder")
        if f'"fingerprint": "{body["fingerprint"]}"' not in TS.read_text(encoding="utf-8"):
            raise SystemExit("nv-public-snapshot.ts fingerprint drifted")
        print("NV-SEN-001 snapshot check OK", body["fingerprint"])
        return
    ART.write_text(art, encoding="utf-8")
    WEB_LIST.write_text(web, encoding="utf-8")
    TS.write_text(ts_module(body), encoding="utf-8")
    r = body["rfg"]
    print(json.dumps({
        "fingerprint": body["fingerprint"],
        "counts": {k: body[k]["distinctCredentialNumbers"] for k in ("skilledNursing", "skilledNursingDistinctPart", "rfg", "hirc", "adultDay", "homeHealth", "homeHealthBranch", "hospiceProgram", "hospiceFacility")},
        "rfg": {k: r[k] for k in ("assistedLivingEndorsed", "alzheimerEndorsed", "assistedLivingAndAlzheimerEndorsed", "withAnyEndorsementPrinted", "withNoEndorsementPrinted", "detailPagesParsed", "endorsementCountsAsPrinted")},
        "crosswalk": body["crosswalk"],
        "inspections": {k: body["inspections"][k] for k in ("facilitiesWithIndex", "indexRows")},
        "sanctions": {k: body["stateSanctions"][k] for k in ("rows", "facilities", "byType", "gridDisciplinaryFlagYes")},
        "cities": body["cityContext"]["cities"],
    }, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
