#!/usr/bin/env python3
"""MN-SEN-001 — Minnesota senior-care state layer over the accepted CMS spine.

Stage 1 (--parse; needs gitignored raw files in data/minnesota/mn-sen-001/raw/):
  Minnesota Department of Health, Health Regulation Division.
  * Health Care Provider Directory ("Data is updated daily"): the lookup page's own CSV export
    (provider-profile-api.web.health.state.mn.us/csv), one statewide call per provider group
    (county blank = all counties, providerType blank = all types in the group). Six care groups:
    Nursing Homes, Assisted Living Facilities, Board & Care Home, Home Care and Home Health Agencies,
    Hospices, Supervised Living Facility.
  * Health Care Provider Evaluation and Investigation Results (providerdata-api.../search), one
    statewide query per provider type, exactly as the MDH results page posts it.
  Kept: facility name, HFID, license number (hospice: MDH record number), provider type, MN and federal
  classifications exactly as printed, license effective / expiration dates, conditional-license flag,
  city, county, ZIP, licensed beds as printed, Medicare number exactly as printed; evaluation and
  investigation number, dates, investigation finding, and MDH's public PDF link.
  Dropped: administrator / authorized-agent names, phone, fax, facility and administrator email,
  street and mailing addresses, geocode, ownership form.
  -> data/minnesota/mn-sen-001/mdh-providers.json, mdh-findings.json (committed)
  The printed Medicare numbers were checked once against SeniorTrustHub's accepted CMS data through
  its public class profile routes (no CMS download): -> data/minnesota/mn-sen-001/cms-profile-check.json
Stage 2 (default): stage JSON + accepted CMS national partition -> public snapshot, TS module, and the
  server-side list used by /minnesota. --check compares the committed files.

Every MDH provider type stays its own class. Assisted Living Facility with Dementia Care is a separate
MDH license type (not inferred from names). A state license is not CMS certification; a state row
bridges to CMS only through its printed Medicare number, six digits, that is a CMS provider of the same
class. Evaluations and investigations attach only by exact HFID inside the same provider group. No
name joins, no combined total.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/minnesota/mn-sen-001/raw"
STAGE = ROOT / "data/minnesota/mn-sen-001"
ART = ROOT / "artifacts/mn-sen-001-public-snapshot.json"
TS = ROOT / "packages/domain/src/mn-public-snapshot.ts"
WEB_LIST = ROOT / "apps/web/src/data/minnesota-facility-lists.json"
NATIONAL = json.loads((ROOT / "apps/web/src/data/senior-national-intelligence.json").read_text(encoding="utf-8"))
GENERATED_AT = "2026-09-26T15:00:00Z"
DIRECTORY_PAGE = "https://www.health.state.mn.us/facilities/regulation/directory/index.html"
LOOKUP = "https://www.health.state.mn.us/facilities/regulation/directory/providersearch.html"
FINDINGS_PAGE = "https://www.health.state.mn.us/facilities/regulation/directory/providerfindings.html"
ANNUAL_PDF = "https://www.health.state.mn.us/facilities/regulation/directory/2026mdhdirectory.pdf"
OHFC = "https://www.health.state.mn.us/facilities/regulation/ohfc/index.html"
FILE_COMPLAINT = "https://www.health.state.mn.us/facilities/regulation/ohfc/filecomp.html"
GROUPS = {
    "nursing-homes": "Nursing Homes",
    "assisted-living": "Assisted Living Facilities",
    "board-care": "Board & Care Home",
    "home-care-home-health": "Home Care and Home Health Agencies",
    "hospices": "Hospices",
    "supervised-living": "Supervised Living Facility",
}
# MDH provider_type exactly as exported -> snapshot class key.
TYPE_CLASS = {
    "SKILLED NURSING FACILITY/NURSING FACILIT": "nursingHome",
    "SKILLED NURSING FACILITY": "nursingHome",
    "NURSING HOME": "nursingHome",
    "ASSISTED LIVING FACILITY": "assistedLiving",
    "ASSISTED LIVING FACILITY DEMENTIA CARE": "assistedLivingDementiaCare",
    "PROVISIONAL ASSISTED LIVING FACILITY": "provisionalAssistedLiving",
    "PROVISIONAL ASSISTED LIVING W DEMENTIA C": "provisionalAssistedLivingDementiaCare",
    "BOARD & CARE HOME": "boardingCare",
    "NURSING FACILITY": "boardingCare",
    "COMPREHENSIVE HOME CARE": "comprehensiveHomeCare",
    "TEMPORARY COMPREHENSIVE HOME CARE": "temporaryComprehensiveHomeCare",
    "BASIC HOME CARE": "basicHomeCare",
    "TEMPORARY BASIC HOME CARE": "temporaryBasicHomeCare",
    "Certificate of Registration for Home Managment": "homeManagementRegistration",
    "Home Care Branch": "homeCareBranch",
    "HOME HEALTH AGENCY": "homeHealthAgency",
    "Hospice Provider License": "hospiceProvider",
    "Hospice Provider Branches": "hospiceBranch",
    "Residential Hospice License": "residentialHospice",
    "SUPERVISED LIVING FACILITY CLASS A/B": "supervisedLiving",
    "ICF INTELLECTUALLY DISABLED": "icfIid",
    "PSYCHIATRIC RESIDENTIAL TREATMENT FACIL": "prtf",
}
CLASS_LABEL = {
    "nursingHome": "Nursing Home",
    "assistedLiving": "Assisted Living Facility",
    "assistedLivingDementiaCare": "Assisted Living Facility with Dementia Care",
    "provisionalAssistedLiving": "Provisional Assisted Living Facility",
    "provisionalAssistedLivingDementiaCare": "Provisional Assisted Living Facility with Dementia Care",
    "boardingCare": "Boarding Care Home",
    "comprehensiveHomeCare": "Comprehensive Home Care provider",
    "temporaryComprehensiveHomeCare": "Temporary Comprehensive Home Care provider",
    "basicHomeCare": "Basic Home Care provider",
    "temporaryBasicHomeCare": "Temporary Basic Home Care provider",
    "homeManagementRegistration": "Home Management registration",
    "homeCareBranch": "Home Care branch",
    "homeHealthAgency": "Home Health Agency",
    "hospiceProvider": "Hospice Provider license",
    "hospiceBranch": "Hospice Provider branch",
    "residentialHospice": "Residential Hospice license",
    "supervisedLiving": "Supervised Living Facility (Class A/B)",
    "icfIid": "ICF for individuals with intellectual disabilities",
    "prtf": "Psychiatric residential treatment facility",
}
CMS_CLASS = {
    "nursingHome": "nursing_home",
    "homeHealthAgency": "home_health",
    "homeCareBranch": "home_health",
    "comprehensiveHomeCare": "home_health",
    "hospiceProvider": "hospice",
    "hospiceBranch": "hospice",
}
FINDINGS_GROUP = {  # findings API provider type -> directory group
    "NH_": "nursing-homes",
    "BCH_NH_": "nursing-homes",
    "SNSA_NH_": "nursing-homes",
    "ALL_": "assisted-living",
    "BCH_": "board-care",
    "HCP_": "home-care-home-health",
    "HSPICE_": "hospices",
    "SLF_": "supervised-living",
    "ICFMR_SLF_": "supervised-living",
}
CITIES = ["MINNEAPOLIS", "ST. PAUL", "DULUTH"]
SAINT_PAUL = {"ST PAUL", "ST. PAUL", "SAINT PAUL"}


def dumps(obj, indent: int = 2) -> str:
    return json.dumps(obj, indent=indent, ensure_ascii=False) + "\n"


def sha(obj) -> str:
    body = {k: v for k, v in obj.items() if k not in ("generatedAt", "fingerprint")}
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def iso(mdy: str | None) -> str | None:
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", (mdy or "").strip())
    return f"{m.group(3)}-{m.group(1)}-{m.group(2)}" if m else None


def clean(v: str | None) -> str | None:
    v = (v or "").strip()
    return v or None


def city(v: str | None) -> str | None:
    v = clean(v)
    if not v:
        return None
    v = re.sub(r"\s+", " ", v.upper())
    return "ST. PAUL" if v in SAINT_PAUL else v


def county(v: str | None) -> str | None:
    """A county name only. Some MDH hospice rows print a phone number in this column; those are dropped."""
    v = clean(v)
    if not v or not re.fullmatch(r"[A-Za-z][A-Za-z .'-]*", v):
        return None
    return v.upper()


# ---------------------------------------------------------------------------------------------- stage 1
def parse() -> None:
    meta = json.loads((RAW / "csv-meta.json").read_text(encoding="utf-8"))
    rows = []
    for slug in GROUPS:
        raw = (RAW / f"csv-{slug}.csv").read_bytes()
        if hashlib.sha256(raw).hexdigest() != meta["pulls"][slug]["sha256"]:
            raise SystemExit(f"{slug} export changed since acquisition")
        for r in csv.DictReader(io.StringIO(raw.decode("utf-8-sig", errors="replace"))):
            ptype = (r["provider_type"] or "").strip()
            if ptype not in TYPE_CLASS:
                raise SystemExit(f"unmapped MDH provider type {ptype!r} in {slug}")
            beds = clean(r.get("alf"))
            rows.append(
                {
                    "group": slug,
                    "cls": TYPE_CLASS[ptype],
                    "providerType": ptype,
                    "providerTypeCode": clean(r.get("provider_type_code")),
                    "mnClassification": clean(r.get("mn_classification")),
                    "federalClassification": clean(r.get("federal_classification")),
                    "name": re.sub(r"\s+", " ", (r.get("provider_name") or "").strip()),
                    "hfid": clean(r.get("hfid")),
                    "licenseNumber": clean(r.get("license_number")),
                    "recordNumber": clean(r.get("og_record_number")),
                    "effective": iso(r.get("effective_date")),
                    "expires": iso(r.get("expiration_date")),
                    "conditionalLicense": (r.get("conditional_flag") or "").strip() == "Y",
                    "hcbsDesignation": (r.get("hcbs_designation") or "").strip() == "Y",
                    "deemedStatus": clean(r.get("deemed_status")),
                    "city": city(r.get("physical_city")),
                    "county": county(r.get("county_name")),
                    "zip": clean(r.get("physical_zip")),
                    "licensedBedsAsPrinted": int(beds) if beds and beds.isdigit() else None,
                    "medicareNumberAsPrinted": clean(r.get("medicare_number")),
                }
            )
    rows.sort(key=lambda x: (list(GROUPS).index(x["group"]), x["cls"], x["name"], x["hfid"] or "", x["licenseNumber"] or x["recordNumber"] or ""))
    (STAGE / "mdh-providers.json").write_text(
        dumps(
            indent=1,
            obj=            {
                "source": LOOKUP,
                "exportEndpoint": meta["endpoint"],
                "method": meta["parameters"],
                "pulls": {k: {kk: v[kk] for kk in ("providerGroup", "retrievedAt", "bytes", "sha256", "rows")} for k, v in meta["pulls"].items()},
                "countyValuesRejected": sum(1 for slug in GROUPS for r in csv.DictReader(io.StringIO((RAW / f"csv-{slug}.csv").read_bytes().decode("utf-8-sig", errors="replace"))) if clean(r.get("county_name")) and not county(r.get("county_name"))),
                "fieldsDropped": ["adminstrator/authorized_agent", "administrator_email", "facility_email", "telephone", "physical_address", "mailing address", "geocode / latitude / longitude", "license_type (ownership form)"],
                "providers": rows,
            }
        ),
        encoding="utf-8",
    )
    fmeta = json.loads((RAW / "findings-meta.json").read_text(encoding="utf-8"))
    findings = []
    for slug in GROUPS:
        raw = (RAW / f"findings-{slug}.json").read_bytes()
        if hashlib.sha256(raw).hexdigest() != fmeta["pulls"][slug]["sha256"]:
            raise SystemExit(f"{slug} findings changed since acquisition")
        for p in json.loads(raw):
            findings.append(
                {
                    "group": slug,
                    "findingsType": p.get("providerType"),
                    "hfid": p["id"],
                    "name": re.sub(r"\s+", " ", (p.get("providerName") or "").strip()),
                    "evaluations": sorted(
                        ({"nbr": i.get("nbr"), "concluded": iso(i.get("resolvedDate")), "posted": iso(i.get("insertDate")), "link": i.get("link")} for i in p.get("inspections") or []),
                        key=lambda x: (x["concluded"] or "", x["nbr"] or ""),
                        reverse=True,
                    ),
                    "investigations": sorted(
                        ({"nbr": c.get("nbr"), "concluded": iso(c.get("resolvedDate")), "posted": iso(c.get("insertDate")), "finding": c.get("status"), "link": c.get("link")} for c in p.get("complaints") or []),
                        key=lambda x: (x["concluded"] or "", x["nbr"] or ""),
                        reverse=True,
                    ),
                }
            )
    findings.sort(key=lambda x: (list(GROUPS).index(x["group"]), x["hfid"]))
    (STAGE / "mdh-findings.json").write_text(
        dumps(
            indent=1,
            obj=            {
                "source": FINDINGS_PAGE,
                "endpoint": fmeta["endpoint"],
                "method": fmeta["method"],
                "pulls": {k: {kk: v[kk] for kk in ("providerType", "retrievedAt", "bytes", "sha256", "providers")} for k, v in fmeta["pulls"].items()},
                "retention": "MDH keeps investigation information seven years when substantiated, four when inconclusive, and three when unsubstantiated; results for closed facilities are not on the search page.",
                "fieldsDropped": ["administrator", "phoneNumber", "fax", "address"],
                "providers": findings,
            }
        ),
        encoding="utf-8",
    )
    cms = json.loads((RAW / "cms-existence-check.json").read_text(encoding="utf-8"))
    (STAGE / "cms-profile-check.json").write_text(
        dumps(
            {
                "checkedAt": cms["checkedAt"],
                "method": cms["method"],
                "source": "SeniorTrustHub accepted CMS provider data, read through its public class profile routes (/facility/cms, /home-health/cms, /hospice/cms); no CMS download",
                "results": {k: v["http"] for k, v in sorted(cms["results"].items())},
            }
        ),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------------------------- stage 2
def clock(sources: dict, key: str) -> dict:
    s = sources[key]
    return {"datasetKey": key, "officialUrl": s.get("officialUrl"), "sourceModifiedAt": s.get("sourceModifiedAt"), "retrievedAt": s.get("retrievedAt"), "sourcePeriod": s.get("sourcePeriod")}


def build():
    st = json.loads((STAGE / "mdh-providers.json").read_text(encoding="utf-8"))
    fd = json.loads((STAGE / "mdh-findings.json").read_text(encoding="utf-8"))
    cms = json.loads((STAGE / "cms-profile-check.json").read_text(encoding="utf-8"))
    P = st["providers"]
    by = defaultdict(list)
    for p in P:
        by[p["cls"]].append(p)
    geo = next(r for r in NATIONAL["geography"] if r["state"] == "MN")
    if (geo["nursingHomes"], geo["homeHealth"], geo["hospice"]) != (338, 138, 81):
        raise SystemExit(f"Minnesota CMS partition drifted: {geo}")
    sources = {s["datasetKey"]: s for s in NATIONAL["sources"]} if isinstance(NATIONAL.get("sources"), list) else NATIONAL["sources"]

    def bridge(p: dict) -> str | None:
        m = p["medicareNumberAsPrinted"]
        k = CMS_CLASS.get(p["cls"])
        if not m or not k or not re.fullmatch(r"\d{6}", m):
            return None
        return m if cms["results"].get(f"{k}|{m}") == "308" else None

    def printed_state(p: dict) -> str:
        m = p["medicareNumberAsPrinted"]
        if not m:
            return "none_printed"
        if not re.fullmatch(r"\d{6}", m):
            return "printed_not_a_ccn"
        if p["cls"] not in CMS_CLASS:
            return "class_not_in_cms_scope"
        return "exact_same_class" if bridge(p) else "printed_ccn_not_a_cms_profile_of_this_class"

    # findings attach by exact HFID inside the same directory group
    group_hfids = defaultdict(set)
    for p in P:
        if p["hfid"]:
            group_hfids[p["group"]].add(p["hfid"])
    attached = {}
    unattached = []
    for f in fd["providers"]:
        if f["hfid"] in group_hfids[f["group"]]:
            attached[(f["group"], f["hfid"])] = f
        else:
            unattached.append(f)

    def fx(p: dict):
        return attached.get((p["group"], p["hfid"])) if p["hfid"] else None

    def key(p: dict) -> str:
        return p["licenseNumber"] or p["recordNumber"] or f"HFID {p['hfid']}"

    def cls_block(c: str, **extra) -> dict:
        rows = by[c]
        d = {
            "providerType": sorted({p["providerType"] for p in rows}),
            "label": CLASS_LABEL[c],
            "rows": len(rows),
            "distinctLicenses": len({key(p) for p in rows}),
            "distinctHfids": len({p["hfid"] for p in rows if p["hfid"]}),
            "mnClassificationAsPrinted": dict(Counter(p["mnClassification"] or "(blank)" for p in rows)),
            "federalClassificationAsPrinted": dict(Counter(p["federalClassification"] or "(none printed)" for p in rows)),
            "conditionalLicenses": sum(1 for p in rows if p["conditionalLicense"]),
            "licensedBedsAsPrinted": sum(p["licensedBedsAsPrinted"] or 0 for p in rows) if any(p["licensedBedsAsPrinted"] is not None for p in rows) and c not in ("comprehensiveHomeCare", "temporaryComprehensiveHomeCare", "basicHomeCare", "temporaryBasicHomeCare", "homeManagementRegistration", "homeCareBranch", "homeHealthAgency", "hospiceProvider", "hospiceBranch") else None,
            "bedsAreCapacityNotResidents": True,
            "withEvaluations": sum(1 for p in rows if fx(p) and fx(p)["evaluations"]),
            "withInvestigations": sum(1 for p in rows if fx(p) and fx(p)["investigations"]),
            "sourceAsOf": None,
            "retrievedAt": st["pulls"][rows[0]["group"]]["retrievedAt"] if rows else None,
            "source": LOOKUP,
        }
        if c in CMS_CLASS:
            states = Counter(printed_state(p) for p in rows)
            d["medicareNumberPrinted"] = sum(1 for p in rows if p["medicareNumberAsPrinted"])
            d["medicareNumberStates"] = dict(sorted(states.items()))
            d["exactCmsBridges"] = sum(1 for p in rows if bridge(p))
            d["distinctBridgedCcns"] = len({bridge(p) for p in rows if bridge(p)})
        d.update(extra)
        return d

    def cms_linked(classes: tuple[str, ...]) -> tuple[int, int]:
        ccns = {bridge(p) for c in classes for p in by[c] if bridge(p)}
        return len({x for x in ccns if x.startswith("24")}), len({x for x in ccns if not x.startswith("24")})

    nh_mn, _ = cms_linked(("nursingHome",))
    hh_mn, hh_out = cms_linked(("homeHealthAgency", "homeCareBranch", "comprehensiveHomeCare"))
    hs_mn, hs_out = cms_linked(("hospiceProvider", "hospiceBranch"))
    inv = [i for f in attached.values() for i in f["investigations"]]
    ev = [e for f in attached.values() for e in f["evaluations"]]
    cutoff = max(v["retrievedAt"] for v in fd["pulls"].values())[:10]
    dates = sorted(x["concluded"] for x in inv + ev if x["concluded"] and x["concluded"] <= cutoff)
    after_retrieval = sorted({x["concluded"] for x in inv + ev if x["concluded"] and x["concluded"] > cutoff})
    findings_by_group = {
        g: {
            "providersInResults": sum(1 for f in fd["providers"] if f["group"] == g),
            "attachedByExactHfid": sum(1 for (gg, _h) in attached if gg == g),
            "notInDirectory": sum(1 for f in unattached if f["group"] == g),
            "evaluationRows": sum(len(f["evaluations"]) for f in fd["providers"] if f["group"] == g),
            "investigationRows": sum(len(f["investigations"]) for f in fd["providers"] if f["group"] == g),
            "investigationFindings": dict(sorted(Counter(i["finding"] or "(none printed)" for f in fd["providers"] if f["group"] == g for i in f["investigations"]).items())),
            "retrievedAt": fd["pulls"][g]["retrievedAt"],
        }
        for g in GROUPS
    }

    def city_count(classes: tuple[str, ...], c: str) -> int:
        return sum(1 for k in classes for p in by[k] if p["city"] == c)

    snapshot = {
        "version": "senior-mn-state-intel-v1",
        "ticket": "MN-SEN-001",
        "publicationPath": "/minnesota",
        "asOf": "2026-09-26",
        "snapshotAsOf": "2026-09-26",
        "retrievedAt": max(v["retrievedAt"] for v in st["pulls"].values()),
        "generatedAt": GENERATED_AT,
        "localWorkNeededNow": "NO",
        "claimEligibilityBroadened": False,
        "no_trust_score": True,
        "no_aggregate_rating": True,
        "no_rankings": True,
        "no_city_pages": True,
        "clocks": {
            "mdh_directory_retrievedAt": {g: v["retrievedAt"] for g, v in st["pulls"].items()},
            "mdh_directory_updated": "daily (MDH states the data is updated daily; the export prints no as-of date)",
            "mdh_findings_retrievedAt": {g: v["retrievedAt"] for g, v in fd["pulls"].items()},
            "annual_directory_as_of": "2026-03-13",
            "annual_directory_published": "2026-03-15 (published yearly on March 15)",
            "cms_profile_check_at": cms["checkedAt"],
            "license_dates_are_per_row": True,
            "finding_dates_are_per_row": True,
            "finding_concluded_dates_after_retrieval_as_printed": after_retrieval,
            "earliest_finding_concluded": dates[0] if dates else None,
            "latest_finding_concluded": dates[-1] if dates else None,
            "cms_date_is_not_minnesota_license_date": True,
            "retrievedAt_is_not_sourceAsOf": True,
        },
        "regulatorMap": {
            "current": {
                "authority": "Minnesota Department of Health",
                "division": "Health Regulation Division",
                "directory": DIRECTORY_PAGE,
                "lookup": LOOKUP,
                "findings": FINDINGS_PAGE,
                "complaintOffice": "Office of Health Facility Complaints (OHFC)",
                "complaints": OHFC,
                "fileComplaint": FILE_COMPLAINT,
            },
            "cmsCareCompare": "https://www.medicare.gov/care-compare/",
            "dhsCaseMixIsSeparate": "Nursing home Medicaid case-mix payment rates are published by the Minnesota Department of Human Services, not MDH.",
        },
        "annualDirectory": {
            "title": "2026 Directory of Registered, Licensed, and Certified Health Care Facilities and Services",
            "url": ANNUAL_PDF,
            "asOf": "2026-03-13",
            "usedFor": "Cross-check only. The daily directory is the current state source.",
            "table3": {"nursingHomesAndUnits": {"facilities": 336, "beds": 23665}, "boardingCareHomes": {"facilities": 17, "beds": 1166, "note": "includes BCH units of other facilities"}, "supervisedLivingFacilities": {"facilities": 183, "beds": 4088}},
        },
        "cmsOverlay": {
            "nursingHomes": geo["nursingHomes"],
            "homeHealth": geo["homeHealth"],
            "hospice": geo["hospice"],
            "source": "senior-national-intelligence.json geography MN (CMS class directories)",
            "asOf": NATIONAL["generatedAt"][:10],
            "nationalFingerprint": NATIONAL["sourceFingerprint"],
            "addedToNationalTotals": False,
            "clocks": {
                "nursingHomes": clock(sources, "nursing-home-provider-information"),
                "homeHealth": clock(sources, "home-health-care-agencies"),
                "hospice": clock(sources, "hospice-general-information"),
            },
        },
        "nursingHome": cls_block("nursingHome", distinctFromCmsNursingHome=True),
        "assistedLiving": cls_block("assistedLiving"),
        "assistedLivingDementiaCare": cls_block(
            "assistedLivingDementiaCare",
            separateLicenseType=True,
            inferredFromNameOrMarketing=False,
        ),
        "provisionalAssistedLiving": cls_block("provisionalAssistedLiving", provisionalOneYearLicense=True),
        "provisionalAssistedLivingDementiaCare": cls_block("provisionalAssistedLivingDementiaCare", provisionalOneYearLicense=True),
        "boardingCare": cls_block(
            "boardingCare",
            distinctFromNursingHome=True,
            withFederalNursingFacilityClassification=sum(1 for p in by["boardingCare"] if p["federalClassification"] == "NURSING FACILITY"),
            medicareNumberStates=dict(Counter(printed_state(p) for p in by["boardingCare"])),
        ),
        "comprehensiveHomeCare": cls_block("comprehensiveHomeCare"),
        "temporaryComprehensiveHomeCare": cls_block("temporaryComprehensiveHomeCare"),
        "basicHomeCare": cls_block("basicHomeCare"),
        "temporaryBasicHomeCare": cls_block("temporaryBasicHomeCare"),
        "homeManagementRegistration": cls_block("homeManagementRegistration", registrationNotLicense=True),
        "homeCareBranch": cls_block("homeCareBranch", branchesAreNotProviders=True),
        "homeHealthAgency": cls_block(
            "homeHealthAgency",
            mnLicenseIsHomeCare=True,
            distinctFromCmsHomeHealth=True,
        ),
        "hospiceProvider": cls_block("hospiceProvider", distinctFromCmsHospice=True),
        "hospiceBranch": cls_block("hospiceBranch", branchesAreNotProviders=True),
        "residentialHospice": cls_block("residentialHospice", distinctFromHospiceProvider=True),
        "supervisedLiving": cls_block("supervisedLiving", notSeniorSpecific=True),
        "icfIid": cls_block("icfIid", notSeniorCare=True),
        "prtf": cls_block("prtf", notSeniorCare=True),
        "findings": {
            "capability": "PARTIAL",
            "source": FINDINGS_PAGE,
            "grain": "MDH evaluation (survey) or OHFC investigation result row with its number, dates, finding, and public PDF link",
            "retention": fd["retention"],
            "byGroup": findings_by_group,
            "attachedProviders": len(attached),
            "unattachedProviders": len(unattached),
            "evaluationRowsAttached": len(ev),
            "investigationRowsAttached": len(inv),
            "investigationFindingsAttached": dict(sorted(Counter(i["finding"] or "(none printed)" for i in inv).items())),
            "attachedByExactHfidInSameGroup": True,
            "nameOnlyJoins": 0,
            "findingTextCopied": False,
            "evaluationIsNotInvestigation": True,
            "stateEvaluationIsNotCmsInspection": True,
            "closedFacilitiesExcludedBySource": True,
        },
        "sanctions": {
            "capability": "NOT_ACQUIRED",
            "note": "Fines, conditional licenses, and license actions appear inside evaluation and investigation documents; they were not parsed. The directory's conditional-license flag is kept as printed.",
            "conditionalLicenseFlagRows": sum(1 for p in P if p["conditionalLicense"]),
        },
        "complaints": {
            "capability": "KNOWN_INTAKE",
            "intake": FILE_COMPLAINT,
            "office": OHFC,
            "providerLevelInvestigationRows": len(inv),
            "records": "PARTIAL",
            "note": "Investigation results are public on MDH's results search within the retention window. Complaints that were not investigated and the allegation text are not published here.",
            "complaintIsNotDeficiency": True,
            "complaintIsNotSanction": True,
        },
        "crosswalk": {
            "method": "Medicare number printed on the MDH directory row, exactly six digits, that is a CMS provider of the same class in SeniorTrustHub's accepted CMS data",
            "ccnInMdhSource": True,
            "exactStateToCmsBridges": sum(1 for p in P if bridge(p)),
            "cmsNursingHomesBridged": nh_mn,
            "cmsNursingHomesNotBridged": geo["nursingHomes"] - nh_mn,
            "cmsHomeHealthBridged": hh_mn,
            "cmsHomeHealthNotBridged": geo["homeHealth"] - hh_mn,
            "outOfStateHomeHealthCcnsBridged": hh_out,
            "cmsHospiceBridged": hs_mn,
            "cmsHospiceNotBridged": geo["hospice"] - hs_mn,
            "outOfStateHospiceCcnsBridged": hs_out,
            "boardingCareNursingFacilityNumbersAreNotCcns": True,
            "zeroBridgesIsNotZeroOverlap": True,
            "nameOnly": "UNSAFE",
        },
        "cityContext": {
            "cities": {
                ("St. Paul" if c == "ST. PAUL" else c.title()): {
                    "nursingHome": city_count(("nursingHome",), c),
                    "assistedLiving": city_count(("assistedLiving",), c),
                    "assistedLivingDementiaCare": city_count(("assistedLivingDementiaCare",), c),
                    "boardingCare": city_count(("boardingCare",), c),
                    "homeHealthAgency": city_count(("homeHealthAgency",), c),
                    "hospiceProvider": city_count(("hospiceProvider",), c),
                }
                for c in CITIES
            },
            "addressIsNotServiceArea": True,
        },
        "expansionLedger": {"GRAPH_WRITES": 0, "NET_NEW_CANONICAL_FACILITIES": 0, "STATE_DIRECTORY_ROWS": len(P), "DATABASE_WRITES": 0},
        "capabilities": [
            {"id": "mdh-daily-directory", "label": "MDH Health Care Provider Directory (daily)", "state": "KNOWN"},
            {"id": "nursing-home-roster", "label": "MDH Nursing Home licenses", "state": "KNOWN"},
            {"id": "assisted-living-roster", "label": "Assisted Living Facility licenses", "state": "KNOWN"},
            {"id": "assisted-living-dementia-roster", "label": "Assisted Living Facility with Dementia Care licenses", "state": "KNOWN"},
            {"id": "boarding-care-roster", "label": "Boarding Care Home licenses", "state": "KNOWN"},
            {"id": "home-care-roster", "label": "Home Care licenses, registrations, and branches", "state": "KNOWN"},
            {"id": "home-health-roster", "label": "Home Health Agencies in the MDH directory", "state": "KNOWN"},
            {"id": "hospice-roster", "label": "Hospice provider licenses, branches, and residential hospices", "state": "KNOWN"},
            {"id": "supervised-living-roster", "label": "Supervised Living Facilities", "state": "KNOWN"},
            {"id": "inactive-licenses", "label": "Closed or expired licenses", "state": "NOT_ACQUIRED"},
            {"id": "mdh-evaluations", "label": "MDH evaluation (survey) results index", "state": "PARTIAL"},
            {"id": "ohfc-investigations", "label": "OHFC investigation results and findings", "state": "PARTIAL"},
            {"id": "finding-document-text", "label": "Evaluation and investigation document text", "state": "NOT_ACQUIRED"},
            {"id": "state-sanctions", "label": "Fines and license actions", "state": "NOT_ACQUIRED"},
            {"id": "complaint-intake", "label": "OHFC complaint intake", "state": "KNOWN"},
            {"id": "exact-ccn-bridge", "label": "State row to CMS by printed Medicare number", "state": "PARTIAL"},
            {"id": "name-only-bridge", "label": "State to CMS by name", "state": "UNSUPPORTED"},
            {"id": "combined-minnesota-senior-facilities", "label": "Combined Minnesota senior-facility total", "state": "UNSUPPORTED"},
            {"id": "combined-minnesota-senior-beds", "label": "Combined Minnesota senior bed total", "state": "UNSUPPORTED"},
        ],
        "fingerprint": "",
    }
    snapshot["fingerprint"] = sha(snapshot)

    def row(p: dict) -> dict:
        f = fx(p)
        invs = f["investigations"] if f else []
        evs = f["evaluations"] if f else []
        return {
            "cls": p["cls"],
            "name": p["name"],
            "hfid": p["hfid"],
            "licenseNumber": p["licenseNumber"],
            "recordNumber": p["recordNumber"],
            "expires": p["expires"],
            "conditionalLicense": p["conditionalLicense"],
            "city": p["city"],
            "county": p["county"],
            "zip": p["zip"],
            "licensedBeds": p["licensedBedsAsPrinted"],
            "medicareNumberAsPrinted": p["medicareNumberAsPrinted"],
            "cmsBridge": bridge(p),
            "medicareNumberState": printed_state(p) if p["cls"] in CMS_CLASS else None,
            "evaluationCount": len(evs),
            "latestEvaluation": evs[0]["concluded"] if evs else None,
            "investigationCount": len(invs),
            "investigationFindings": dict(sorted(Counter(i["finding"] or "(none printed)" for i in invs).items())),
            "latestSubstantiated": next((i["concluded"] for i in invs if i["finding"] == "SUBSTANTIATED"), None),
        }

    web = {"fingerprint": snapshot["fingerprint"], "facilities": [row(p) for p in P]}
    return snapshot, web


def ts_module(body: dict) -> str:
    return "/** Generated by scripts/build-mn-public-snapshot.py. Do not edit by hand. */\nexport const MN_PUBLIC_SNAPSHOT = " + json.dumps(body, indent=2, ensure_ascii=False) + " as const;\nexport type MnPublicSnapshot = typeof MN_PUBLIC_SNAPSHOT;\n"


def main() -> None:
    if "--parse" in sys.argv:
        parse()
    body, web_rows = build()
    art = dumps(body)
    web = json.dumps(web_rows, separators=(",", ":"), ensure_ascii=False) + "\n"
    if "--check" in sys.argv:
        for path, want in ((ART, art), (WEB_LIST, web)):
            if path.read_text(encoding="utf-8").replace("\r\n", "\n") != want:
                raise SystemExit(f"{path.relative_to(ROOT)} drifted from the builder")
        if f'"fingerprint": "{body["fingerprint"]}"' not in TS.read_text(encoding="utf-8"):
            raise SystemExit("mn-public-snapshot.ts fingerprint drifted")
        print("MN-SEN-001 snapshot check OK", body["fingerprint"])
        return
    ART.write_text(art, encoding="utf-8")
    WEB_LIST.write_text(web, encoding="utf-8")
    TS.write_text(ts_module(body), encoding="utf-8")
    classes = [k for k in body if isinstance(body[k], dict) and "distinctLicenses" in body[k]]
    print(json.dumps({
        "fingerprint": body["fingerprint"],
        "classes": {k: [body[k]["rows"], body[k]["distinctLicenses"], body[k].get("exactCmsBridges"), body[k]["licensedBedsAsPrinted"]] for k in classes},
        "crosswalk": body["crosswalk"],
        "findings": {k: body["findings"][k] for k in ("attachedProviders", "unattachedProviders", "evaluationRowsAttached", "investigationRowsAttached", "investigationFindingsAttached")},
        "cities": body["cityContext"]["cities"],
        "clocks": {k: body["clocks"][k] for k in ("earliest_finding_concluded", "latest_finding_concluded")},
    }, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
