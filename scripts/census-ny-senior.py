#!/usr/bin/env python3
"""NY-SEN-001A census from acquired official files. No name-only CMS joins."""
from __future__ import annotations

import csv
import json
import re
from collections import Counter
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "new-york" / "ny-sen-001" / "raw"
OUT = ROOT / "data" / "new-york" / "ny-sen-001" / "ny-sen-census.json"


def load_csv(name: str) -> list[dict]:
    with (RAW / name).open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def digits(value: object) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def main() -> None:
    nh = load_csv("Facility_Info.csv")
    surveys = load_csv("Surveys.csv")
    citations = load_csv("Citations.csv")
    enforcements = load_csv("ENFORCEMENTS.CSV")
    cert = json.loads((RAW / "health-facility-certification.json").read_text(encoding="utf-8"))
    gi = json.loads((RAW / "health-facility-general-information.json").read_text(encoding="utf-8"))

    fac_ids = [str(r.get("FACILITY_ID") or "").strip() for r in nh]
    fac_id_counts = Counter(fac_ids)
    ccns = []
    without_ccn = 0
    for row in nh:
        ccn = str(row.get("MEDICARE_NUMBER") or "").strip()
        if row.get("MEDICARE_CERTIFIED") == "1" and ccn and ccn not in {"0", "NA"}:
            ccns.append(ccn)
        else:
            without_ccn += 1
    ccn_counts = Counter(ccns)
    duplicate_ccn = {k: v for k, v in ccn_counts.items() if v > 1}
    duplicate_fid = {k: v for k, v in fac_id_counts.items() if v > 1}

    survey_types = Counter(r.get("SURVEY_TYPE") or "UNKNOWN" for r in surveys)
    survey_dates = [r.get("INITIAL_SURVEY_DATE") or "" for r in surveys if r.get("INITIAL_SURVEY_DATE")]
    complaint_cites = sum(1 for r in citations if str(r.get("IS_COMPLAINT") or "") == "1")
    enf_fac = {str(r.get("FACILITY_ID") or "").strip() for r in enforcements if r.get("FACILITY_ID")}

    def cert_class(short: str) -> dict:
        rows = [r for r in cert if str(r.get("fac_desc_short") or "").upper() == short]
        fids = {str(r.get("fac_id")) for r in rows}
        return {"rows": len(rows), "distinctFacilityIds": len(fids), "attributeTypes": Counter(r.get("attribute_type") for r in rows).most_common()}

    def designation(label: str) -> dict:
        rows = [r for r in cert if r.get("attribute_value") == label]
        fids = {str(r.get("fac_id")) for r in rows}
        shorts = Counter(r.get("fac_desc_short") for r in rows)
        cap = int(sum(float(r.get("measure_value") or 0) for r in rows))
        return {
            "label": label,
            "rows": len(rows),
            "distinctFacilityIds": len(fids),
            "certifiedBedMeasureSum": cap,
            "hostClasses": shorts.most_common(),
            "note": "Designation/bed-program rows at Adult Home or Enriched Housing sites. Not unique assisted-living facilities.",
        }

    acf_gi = [r for r in gi if r.get("fac_desc_short") in {"AH", "EHP"}]
    acf_opcerts = [str(r.get("opcert_num") or "").strip() for r in acf_gi]
    ah_beds = [r for r in cert if r.get("fac_desc_short") == "AH" and r.get("attribute_type") == "Bed"]
    ehp_beds = [r for r in cert if r.get("fac_desc_short") == "EHP" and r.get("attribute_type") == "Bed"]

    reader = PdfReader(str(RAW / "acf_do_not_refer_list.pdf"))
    dnr_text = "\n".join((page.extract_text() or "") for page in reader.pages)
    dnr_names = len(re.findall(r"Facility Name:", dnr_text))
    cert_tokens = sorted(set(re.findall(r"\b\d{2,4}-[A-Z]-\d{3}\b", dnr_text)))
    gi_opcert_set = {c.upper() for c in acf_opcerts if c}
    exact_dnr = [c for c in cert_tokens if c.upper() in gi_opcert_set]
    reasons = Counter(re.sub(r"\s+", " ", m).strip() for m in re.findall(r"Reason:\s*(.+)", dnr_text))
    reasons.pop("Pa ge", None)

    census = {
        "nursingHomeProfile": {
            "sourceRows": len(nh),
            "distinctFacilityIds": len(set(fac_ids)),
            "duplicateFacilityIds": len(duplicate_fid),
            "rowsWithCcn": len(ccns),
            "rowsWithoutCcn": without_ccn,
            "distinctCcn": len(set(ccns)),
            "duplicateCcnValues": len(duplicate_ccn),
            "surveyRows": len(surveys),
            "surveyFacilityCoverage": len({str(r.get("FACILITY_ID") or "").strip() for r in surveys}),
            "surveyDateMin": min(survey_dates) if survey_dates else None,
            "surveyDateMax": max(survey_dates) if survey_dates else None,
            "surveyTypes": survey_types.most_common(),
            "citationRows": len(citations),
            "citationRowsIsComplaint1": complaint_cites,
            "enforcementRows": len(enforcements),
            "enforcementFacilityCoverage": len(enf_fac),
            "grain": "Facility_Info.csv row = one NYSDOH nursing-home facility (FACILITY_ID unique in this extract).",
        },
        "acf": {
            "giAdultHomeFacilities": sum(1 for r in acf_gi if r.get("fac_desc_short") == "AH"),
            "giEnrichedHousingFacilities": sum(1 for r in acf_gi if r.get("fac_desc_short") == "EHP"),
            "giAcfFacilities": len(acf_gi),
            "giDistinctOperatingCertificates": len(set(acf_opcerts)),
            "ahBedCertificationRows": len(ah_beds),
            "ehpBedCertificationRows": len(ehp_beds),
            "ahEhpOverlapFacilityIds": 0,
            "status": "GI directory presence with operating certificate; source does not print ACTIVE/EXPIRED. Currentness is PARTIAL (open-date present, no explicit active flag).",
        },
        "assistedLivingDesignations": {
            "alr": designation("Assisted Living Residence (ALR)"),
            "ealr": designation("Enhanced Assisted Living Residence (EALR)"),
            "snalr": designation("Special Needs Assisted Living Residence (SNALR)"),
            "alpResidential": designation("Assisted Living Program (ALP)"),
            "alpLhCsaSpecialty": designation("Specialty - Assisted Living Program(ALP)"),
        },
        "homeCare": {
            "chha": cert_class("CHHA"),
            "lhcsa": cert_class("LHCSA"),
            "lthhcp": cert_class("LTHHCP"),
        },
        "hospiceState": cert_class("HSPC"),
        "adultDay": cert_class("ADHCP"),
        "doNotRefer": {
            "sourceAsOfPrinted": "2026-09-10",
            "facilityNameBlocks": dnr_names,
            "operatingCertificateTokens": cert_tokens,
            "exactOpcertMatchesToGiAcf": exact_dnr,
            "exactOpcertMatchCount": len(exact_dnr),
            "nameOnlyRemainder": dnr_names - len(exact_dnr),
            "reasonDistribution": reasons.most_common(),
        },
    }
    OUT.write_text(json.dumps(census, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "nh": census["nursingHomeProfile"]["sourceRows"],
        "ccn": census["nursingHomeProfile"]["distinctCcn"],
        "acf": census["acf"]["giAcfFacilities"],
        "dnr": census["doNotRefer"]["facilityNameBlocks"],
        "dnrExact": census["doNotRefer"]["exactOpcertMatchCount"],
        "alr": census["assistedLivingDesignations"]["alr"]["distinctFacilityIds"],
        "lhcsa": census["homeCare"]["lhcsa"]["distinctFacilityIds"],
        "chha": census["homeCare"]["chha"]["distinctFacilityIds"],
        "hospice": census["hospiceState"]["distinctFacilityIds"],
    }, indent=2))


if __name__ == "__main__":
    main()
