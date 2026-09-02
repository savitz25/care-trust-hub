"""NJ-SEN-004 identity bridges, rematch, CCRC discovery, and internal snapshot.

Organizes evidence. Does not rank facilities, score CCRCs, or publish /new-jersey.
"""

# ruff: noqa: E501

from __future__ import annotations

import csv
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

from .nj_doh_acute import DATASET_KEY as ACUTE_DATASET
from .nj_doh_acute import (
    HHA_TYPES,
    HOSPICE_BRANCH_TYPES,
    HOSPICE_INPATIENT_TYPES,
    HOSPICE_PROGRAM_TYPES,
    identity_from_acute,
    parse_acute_rows,
    parse_acute_xlsx,
)
from .nj_doh_enforcement import (
    DocumentMatch,
    IdentityRecord,
    identity_from_ltc,
    match_document,
    normalize_licensed_name,
)
from .nj_doh_ltc import (
    normalize_license_number,
    normalize_name,
    parse_facility_rows,
    parse_xlsx,
)
from .nj_doh_staffing import NURSING_TYPES, parse_staffing_html
from .nj_medicaid_al_rates import RateRow, match_rate_row
from .nj_pace import PaceOrganization

ADAPTER_VERSION = "nj-sen-004-v1"
CCRC_LANDING_URL = "https://www.nj.gov/dca/codes/offices/ccrc.shtml"
CCRC_GUIDE_URL = "https://www.nj.gov/dca/codes/publications/pdf_ccrc/ccrc2011.pdf"
CCRC_RULES_URL = "https://www.nj.gov/dca/codes/codreg/pdf_regs/njac_5_19.pdf"
CMS_PACE_URL = "https://www.cms.gov/medicare/health-drug-plans/pace"
MEDICAID_PACE_URL = "https://www.medicaid.gov/medicaid/long-term-services-supports/program-all-inclusive-care-elderly"
NJMMIS_DOWNLOADS_URL = "https://www.njmmis.com/downloadDocuments/"
COVERAGE_STATES = (
    "ACQUIRED_COMPLETE",
    "ACQUIRED_CURRENT_SNAPSHOT",
    "ACQUIRED_PARTIAL_HISTORY",
    "PARTIAL_SOURCE_COVERAGE",
    "SOURCE_NOT_ACQUIRED",
    "SOURCE_ACCESS_BLOCKED",
    "SOURCE_AVAILABLE_BY_REQUEST",
    "SOURCE_UNVERIFIED",
)
STAFFING_CLASSES = (
    "CURRENT_ALL_LTC_MATCH",
    "HISTORICAL_LTC_FACILITY",
    "RENAMED_LTC_FACILITY",
    "CLOSED_OR_NO_LONGER_IN_CURRENT_WORKBOOK",
    "ALL_ACUTE_MATCH",
    "NON_NURSING_FACILITY",
    "SOURCE_COMPARATOR_OR_NON_FACILITY",
    "INVALID_OR_MALFORMED_FACID",
    "UNRESOLVED",
)
LTC_TYPES = {
    "NJ_NF_SNF",
    "NJ_NF_SNF_HOME_FOR_AGED",
    "NJ_NF_SNF_DP",
    "NJ_NF_SNF_HOSPITAL",
    "NJ_NF_SNF_SUBACUTE_HOSPITAL",
    "NJ_LTC_UNSPECIFIED",
    "NJ_LTC_PRIV",
    "NJ_LTC_PRIV_HOME_FOR_AGED",
    "NJ_ALR",
    "NJ_CPCH",
    "NJ_ALP",
    "NJ_RHCF_IN_LTC",
    "NJ_RDCH",
    "NJ_ADHS",
    "NJ_PDHS",
    "NJ_ADHS_IN_LTC",
    "NJ_ADHS_HOSPITAL",
    "NJ_ADHS_IN_ALR",
    "NJ_AFC",
}


@dataclass(slots=True)
class RematchCounts:
    ltc_matched: int = 0
    acute_matched: int = 0
    home_health_matched: int = 0
    hospice_program_matched: int = 0
    hospice_branch_matched: int = 0
    hospice_inpatient_matched: int = 0
    other_acute_matched: int = 0
    review_required: int = 0
    conflicts: int = 0
    unresolved: int = 0
    non_facility: int = 0
    source_unavailable: int = 0
    exact: int = 0
    high_confidence: int = 0
    unsafe_rejected: int = 0


@dataclass(slots=True)
class RematchReport:
    before: RematchCounts
    after: RematchCounts
    new_exact: int
    new_high_confidence: int
    prior_unresolved: int
    remaining_unresolved: int
    duplicate_documents: int
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(
            {
                "before": asdict(self.before),
                "after": asdict(self.after),
                "new_exact": self.new_exact,
                "new_high_confidence": self.new_high_confidence,
                "prior_unresolved": self.prior_unresolved,
                "remaining_unresolved": self.remaining_unresolved,
                "duplicate_documents": self.duplicate_documents,
                "notes": self.notes,
            },
            indent=2,
        ) + "\n"


@dataclass(slots=True)
class StaffingFacidAudit:
    source_facility_id: str
    source_facility_name: str
    classification: str
    match_method: str
    current_ltc_facid: str | None
    current_ltc_name: str | None
    current_ltc_type: str | None
    acute_facid: str | None
    acute_type: str | None
    last_staffing_quarter: str | None
    attach_staffing: bool
    notes: str


@dataclass(slots=True)
class CmsPaceRow:
    cms_organization_id: str
    legal_name: str
    center_name: str | None = None
    center_address: str | None = None
    approval_date: date | None = None
    operating_status: str | None = None
    source: str = CMS_PACE_URL


def classify_match_identity(match: DocumentMatch, identities: list[IdentityRecord]) -> str:
    if not match.facility_id_key:
        return match.bucket
    hit = next((item for item in identities if item.source_facility_id == match.facility_id_key), None)
    if hit is None:
        return match.bucket
    canonical = hit.canonical_type or ""
    if canonical in HHA_TYPES:
        return "home_health"
    if canonical in HOSPICE_PROGRAM_TYPES:
        return "hospice_program"
    if canonical in HOSPICE_BRANCH_TYPES:
        return "hospice_branch"
    if canonical in HOSPICE_INPATIENT_TYPES:
        return "hospice_inpatient"
    if canonical in LTC_TYPES:
        return "ltc"
    if hit.dataset_key == ACUTE_DATASET:
        return "other_acute"
    return "ltc"


def summarize_matches(
    matches: list[DocumentMatch], identities: list[IdentityRecord]
) -> RematchCounts:
    counts = RematchCounts()
    for match in matches:
        if match.bucket == "EXACT":
            counts.exact += 1
        elif match.bucket == "HIGH_CONFIDENCE":
            counts.high_confidence += 1
        elif match.bucket == "REVIEW_REQUIRED":
            counts.review_required += 1
        elif match.bucket == "CONFLICT":
            counts.conflicts += 1
        elif match.bucket == "UNSAFE_REJECTED":
            counts.unsafe_rejected += 1
        else:
            counts.unresolved += 1
        if match.bucket in {"EXACT", "HIGH_CONFIDENCE"}:
            kind = classify_match_identity(match, identities)
            if kind == "ltc":
                counts.ltc_matched += 1
            elif kind == "home_health":
                counts.home_health_matched += 1
                counts.acute_matched += 1
            elif kind == "hospice_program":
                counts.hospice_program_matched += 1
                counts.acute_matched += 1
            elif kind == "hospice_branch":
                counts.hospice_branch_matched += 1
                counts.acute_matched += 1
            elif kind == "hospice_inpatient":
                counts.hospice_inpatient_matched += 1
                counts.acute_matched += 1
            elif kind == "other_acute":
                counts.other_acute_matched += 1
                counts.acute_matched += 1
    return counts


def rematch_documents(
    documents: list[dict[str, Any]],
    ltc_identities: list[IdentityRecord],
    acute_identities: list[IdentityRecord],
) -> RematchReport:
    combined = ltc_identities + acute_identities
    before_matches = [
        match_document(
            printed_license=item.get("printed_license_number"),
            printed_facid=item.get("printed_source_facility_id"),
            printed_name=item.get("printed_facility_name") or item.get("facility_name"),
            printed_street=item.get("printed_street"),
            printed_city=item.get("printed_city"),
            identities=ltc_identities,
        )
        for item in documents
    ]
    after_matches = [
        match_document(
            printed_license=item.get("printed_license_number"),
            printed_facid=item.get("printed_source_facility_id"),
            printed_name=item.get("printed_facility_name") or item.get("facility_name"),
            printed_street=item.get("printed_street"),
            printed_city=item.get("printed_city"),
            identities=combined,
        )
        for item in documents
    ]
    before = summarize_matches(before_matches, ltc_identities)
    after = summarize_matches(after_matches, combined)
    return RematchReport(
        before=before,
        after=after,
        new_exact=max(0, after.exact - before.exact),
        new_high_confidence=max(0, after.high_confidence - before.high_confidence),
        prior_unresolved=before.unresolved,
        remaining_unresolved=after.unresolved,
        duplicate_documents=0,
        notes=[
            "Prior match history is preserved. New matches are recorded as dated reconciliation results.",
            "Hospital-system or owner-company names are not copied onto every licensed site.",
            "Canonical documents and source occurrences are not duplicated by rematch.",
        ],
    )


def _facid_variants(facid: str) -> set[str]:
    key = normalize_license_number(facid) or ""
    variants = {facid, key}
    match = re.fullmatch(r"(NJ)?0*([0-9]+)", key, re.I)
    if match:
        number = match.group(2)
        prefix = "NJ" if (match.group(1) or facid.upper().startswith("NJ")) else ""
        for width in range(len(number), 8):
            padded = number.zfill(width)
            variants.add(padded)
            variants.add(f"NJ{padded}")
            if prefix:
                variants.add(f"{prefix}{padded}")
    return {item for item in variants if item}


def classify_staffing_facid(
    *,
    facid: str | None,
    name: str,
    ltc_identities: list[IdentityRecord],
    acute_identities: list[IdentityRecord],
    last_quarter: str | None,
    statewide: bool = False,
) -> StaffingFacidAudit:
    if statewide or (name and "statewide" in name.lower()):
        return StaffingFacidAudit(
            facid or "",
            name,
            "SOURCE_COMPARATOR_OR_NON_FACILITY",
            "statewide_label",
            None,
            None,
            None,
            None,
            None,
            last_quarter,
            False,
            "Statewide comparator is not a facility",
        )
    if not facid:
        return StaffingFacidAudit(
            "",
            name,
            "INVALID_OR_MALFORMED_FACID",
            "missing_facid",
            None,
            None,
            None,
            None,
            None,
            last_quarter,
            False,
            "Staffing row has no FacID",
        )
    if re.search(r"[A-Z]{3,}", facid) and not re.fullmatch(r"NJ[A-Z0-9]+", facid):
        malformed = True
    else:
        malformed = bool(re.fullmatch(r"NJ[A-Z]{4,}", facid))
    ltc_by_id = {item.source_facility_id: item for item in ltc_identities}
    acute_by_id = {item.source_facility_id: item for item in acute_identities}
    variants = _facid_variants(facid)
    ltc_hits = [ltc_by_id[item] for item in variants if item in ltc_by_id]
    unique_ltc = {item.source_facility_id: item for item in ltc_hits}
    if len(unique_ltc) == 1:
        hit = next(iter(unique_ltc.values()))
        name_match = normalize_licensed_name(name) == normalize_licensed_name(hit.official_name)
        if hit.canonical_type and hit.canonical_type not in NURSING_TYPES:
            classification = "NON_NURSING_FACILITY" if name_match or hit.source_facility_id == facid else "RENAMED_LTC_FACILITY"
            return StaffingFacidAudit(
                facid,
                name,
                classification,
                "facid_variant_current_all_ltc",
                hit.source_facility_id,
                hit.official_name,
                hit.canonical_type,
                None,
                None,
                last_quarter,
                False,
                "FacID is in current All_LTC but is not a CMS nursing class; staffing is not attached",
            )
        if name_match or hit.source_facility_id == facid:
            return StaffingFacidAudit(
                facid,
                name,
                "CURRENT_ALL_LTC_MATCH",
                "facid_or_zero_pad",
                hit.source_facility_id,
                hit.official_name,
                hit.canonical_type,
                None,
                None,
                last_quarter,
                True,
                "Current All_LTC identity via exact or zero-padded FacID",
            )
        return StaffingFacidAudit(
            facid,
            name,
            "RENAMED_LTC_FACILITY",
            "facid_variant_name_differs",
            hit.source_facility_id,
            hit.official_name,
            hit.canonical_type,
            None,
            None,
            last_quarter,
            False,
            "FacID variant exists in All_LTC under a different licensed name; continuity is review-required",
        )
    successor = ltc_by_id.get(f"{normalize_license_number(facid)}1") or next(
        (
            item
            for item in ltc_identities
            if item.source_facility_id.startswith(normalize_license_number(facid) or "___")
            and normalize_licensed_name(item.official_name) == normalize_licensed_name(name)
        ),
        None,
    )
    if successor:
        return StaffingFacidAudit(
            facid,
            name,
            "RENAMED_LTC_FACILITY",
            "successor_facid_name",
            successor.source_facility_id,
            successor.official_name,
            successor.canonical_type,
            None,
            None,
            last_quarter,
            False,
            "Possible successor FacID in current All_LTC. Official continuity is not confirmed; do not auto-attach.",
        )
    acute_hits = [acute_by_id[item] for item in variants if item in acute_by_id]
    if not acute_hits:
        name_n = normalize_licensed_name(name)
        acute_hits = [
            item
            for item in acute_identities
            if name_n and name_n == normalize_licensed_name(item.official_name)
        ]
        if len(acute_hits) != 1:
            acute_hits = []
        elif acute_hits:
            return StaffingFacidAudit(
                facid,
                name,
                "ALL_ACUTE_MATCH",
                "name_only_rejected_for_staffing",
                None,
                None,
                None,
                acute_hits[0].source_facility_id,
                acute_hits[0].canonical_type,
                last_quarter,
                False,
                "Name matches an All_Acute identity. Nursing staffing is not attached to acute-care licenses.",
            )
    if acute_hits:
        hit = acute_hits[0]
        return StaffingFacidAudit(
            facid,
            name,
            "ALL_ACUTE_MATCH",
            "acute_identity",
            None,
            None,
            None,
            hit.source_facility_id,
            hit.canonical_type,
            last_quarter,
            False,
            "FacID or unique name matches All_Acute. Do not attach nursing staffing to HHA/Hospice/hospital identities.",
        )
    if malformed:
        return StaffingFacidAudit(
            facid,
            name,
            "INVALID_OR_MALFORMED_FACID",
            "malformed_facid",
            None,
            None,
            None,
            None,
            None,
            last_quarter,
            False,
            "FacID does not match the dominant NJDOH FacID pattern",
        )
    return StaffingFacidAudit(
        facid,
        name,
        "CLOSED_OR_NO_LONGER_IN_CURRENT_WORKBOOK",
        "absent_from_current_all_ltc",
        None,
        None,
        None,
        None,
        None,
        last_quarter,
        False,
        "Historical staffing FacID is not in the current All_LTC workbook. Observation is retained, not attached by name.",
    )


def collect_unmatched_staffing_facids(
    staffing_dir: Path, ltc_identities: list[IdentityRecord]
) -> dict[str, dict[str, Any]]:
    ltc_ids = {item.source_facility_id for item in ltc_identities}
    found: dict[str, dict[str, Any]] = {}
    for path in sorted(staffing_dir.glob("report_*.html")):
        try:
            rows = parse_staffing_html(path.read_text(encoding="utf-8", errors="replace"))
        except ValueError:
            continue
        quarter = path.stem.replace("report_", "")
        for row in rows:
            if row.is_statewide or not row.source_facility_id:
                continue
            if row.source_facility_id in ltc_ids:
                continue
            item = found.setdefault(
                row.source_facility_id,
                {"name": row.source_facility_name, "quarters": []},
            )
            item["quarters"].append(quarter)
            item["name"] = row.source_facility_name
    return found


def audit_staffing_facids(
    staffing_dir: Path,
    ltc_identities: list[IdentityRecord],
    acute_identities: list[IdentityRecord],
) -> list[StaffingFacidAudit]:
    unmatched = collect_unmatched_staffing_facids(staffing_dir, ltc_identities)
    audits: list[StaffingFacidAudit] = []
    for facid, info in sorted(unmatched.items()):
        last = info["quarters"][-1] if info["quarters"] else None
        audits.append(
            classify_staffing_facid(
                facid=facid,
                name=info["name"],
                ltc_identities=ltc_identities,
                acute_identities=acute_identities,
                last_quarter=last,
            )
        )
    return audits


def write_staffing_audit_csv(audits: list[StaffingFacidAudit], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=list(asdict(audits[0]).keys()) if audits else [
                "source_facility_id",
                "source_facility_name",
                "classification",
                "match_method",
                "current_ltc_facid",
                "current_ltc_name",
                "current_ltc_type",
                "acute_facid",
                "acute_type",
                "last_staffing_quarter",
                "attach_staffing",
                "notes",
            ],
        )
        writer.writeheader()
        for item in audits:
            writer.writerow(asdict(item))
    return path


def upgrade_medicaid_match(
    row: RateRow,
    identities: list[IdentityRecord],
    *,
    medicaid_provider_id: str | None = None,
    license_number: str | None = None,
    facid: str | None = None,
    street: str | None = None,
) -> DocumentMatch:
    if medicaid_provider_id and license_number:
        hits = [item for item in identities if item.license_number == normalize_license_number(license_number)]
        if len(hits) == 1:
            return DocumentMatch(
                "EXACT",
                "official_medicaid_and_license",
                "Official source supplied Medicaid provider ID and NJDOH license number",
                hits[0].source_facility_id,
                1,
            )
    if facid:
        hits = [item for item in identities if item.source_facility_id == normalize_license_number(facid)]
        if len(hits) == 1:
            return DocumentMatch(
                "EXACT",
                "official_facid",
                "Official source supplied NJDOH FacID",
                hits[0].source_facility_id,
                1,
            )
    if street:
        return match_document(
            printed_license=license_number,
            printed_facid=facid,
            printed_name=row.provider_name,
            printed_street=street,
            printed_city=None,
            identities=identities,
        )
    return match_rate_row(row, identities)


def match_pace_cms(org: PaceOrganization, cms_rows: list[CmsPaceRow]) -> DocumentMatch:
    if org.cms_organization_id:
        hits = [item for item in cms_rows if item.cms_organization_id == org.cms_organization_id]
        if len(hits) == 1:
            return DocumentMatch(
                "EXACT",
                "cms_organization_id",
                "Same official CMS PACE organization identifier",
                hits[0].cms_organization_id,
                1,
            )
    name = normalize_name(org.name)
    exact_name = [item for item in cms_rows if normalize_name(item.legal_name) == name]
    if len(exact_name) == 1 and exact_name[0].center_address:
        return DocumentMatch(
            "HIGH_CONFIDENCE",
            "legal_name",
            "Exact legal organization name on an official CMS PACE source",
            exact_name[0].cms_organization_id,
            1,
        )
    if exact_name:
        return DocumentMatch(
            "REVIEW_REQUIRED",
            "brand_or_legal_alias",
            "Name overlap without a unique official CMS identifier join",
            None,
            len(exact_name),
        )
    aliases = [
        item
        for item in cms_rows
        if name and name.split(" ")[0] in normalize_name(item.legal_name)
    ]
    if aliases:
        return DocumentMatch(
            "REVIEW_REQUIRED",
            "brand_or_legal_alias",
            "Brand/legal alias requires review; not auto-attached",
            None,
            len(aliases),
        )
    return DocumentMatch("UNRESOLVED", "no_cms_identifier", "No official CMS PACE identifier join", None, 0)


def discover_ccrc(html: str, *, retrieved_at: str) -> dict[str, Any]:
    lower = html.lower()
    has_registry = bool(re.search(r"certificate of authority.{0,40}(list|registry|roster|xlsx|csv)", lower))
    has_download = ".xlsx" in lower or "csv" in lower
    return {
        "landing_url": CCRC_LANDING_URL,
        "retrieved_at": retrieved_at,
        "registry_acquired": False,
        "certificates_acquired": 0,
        "providers": 0,
        "communities": 0,
        "disclosure_statements": 0,
        "coverage_state": "SOURCE_AVAILABLE_BY_REQUEST",
        "official_sources": [CCRC_LANDING_URL, CCRC_GUIDE_URL, CCRC_RULES_URL],
        "has_public_registry_table": has_registry,
        "has_bulk_download": has_download,
        "notes": [
            "DCA requires CCRC providers to register and file a Disclosure Statement.",
            "The program page publishes a 2011 consumer guidebook and N.J.A.C. 5:19, not a current Certificate of Authority roster.",
            "A consumer guidebook is not a current registry and is not treated as a filed disclosure.",
            "CCRC is not an NJDOH facility type. Campus nursing/AL/HHA/hospice licenses remain separate.",
            "No financial-strength score, solvency grade, or CCRC ranking is created.",
        ],
    }


def default_coverage() -> list[dict[str, str]]:
    return [
        {
            "source_family": "nj_doh_all_ltc",
            "coverage_state": "ACQUIRED_CURRENT_SNAPSHOT",
            "notes": "Official All_LTC workbook current snapshot.",
        },
        {
            "source_family": "nj_doh_all_acute",
            "coverage_state": "ACQUIRED_CURRENT_SNAPSHOT",
            "notes": "Official All_Acute workbook current snapshot.",
        },
        {
            "source_family": "nj_doh_enforcement",
            "coverage_state": "ACQUIRED_PARTIAL_HISTORY",
            "notes": "Indexed penalty-letter corpus with two source-unavailable URLs.",
        },
        {
            "source_family": "nj_doh_nh_staffing",
            "coverage_state": "ACQUIRED_PARTIAL_HISTORY",
            "notes": "Quarterly HTML reports 2019 Q1 through the latest populated quarter.",
        },
        {
            "source_family": "nj_medicaid_al_rates",
            "coverage_state": "ACQUIRED_CURRENT_SNAPSHOT",
            "notes": "SFY 2026 listed-provider rate PDF. No provider-ID crosswalk.",
        },
        {
            "source_family": "nj_pace",
            "coverage_state": "ACQUIRED_CURRENT_SNAPSHOT",
            "notes": "DoAS PACE page plus 2026-01-08 press status history.",
        },
        {
            "source_family": "nj_hha_hospice_service_area",
            "coverage_state": "SOURCE_ACCESS_BLOCKED",
            "notes": "Counties served are on facility listings behind the ASP.NET search POST. Direct FacID GET URLs are not public.",
        },
        {
            "source_family": "nj_ccrc",
            "coverage_state": "SOURCE_AVAILABLE_BY_REQUEST",
            "notes": "DCA program page has no public Certificate of Authority roster or disclosure index.",
        },
        {
            "source_family": "nj_medicaid_al_identity_bridge",
            "coverage_state": "SOURCE_AVAILABLE_BY_REQUEST",
            "notes": "NJMMIS listed-rate PDF has names and rates only.",
        },
        {
            "source_family": "nj_pace_cms_identifier",
            "coverage_state": "PARTIAL_SOURCE_COVERAGE",
            "notes": "CMS PACE contract identifiers exist nationally; NJ legal-name joins remain review-required without an official dual-identifier file.",
        },
    ]


def metric_contract_row(**kwargs: Any) -> dict[str, Any]:
    required = (
        "metric_id",
        "display_label",
        "definition",
        "numerator",
        "denominator",
        "population",
        "included",
        "excluded",
        "source",
        "source_as_of",
        "retrieval_date",
        "source_hash_or_snapshot",
        "geographic_grain",
        "identity_rule",
        "known_limitations",
        "publication_status",
        "trace",
    )
    missing = [key for key in required if key not in kwargs]
    if missing:
        raise ValueError(f"metric contract missing {missing}")
    kwargs.setdefault("value", None)
    kwargs["publication_status"] = kwargs["publication_status"]
    return kwargs


def build_internal_snapshot(
    *,
    acute_inspect: dict[str, Any],
    ltc_rows: int,
    rematch: RematchReport | None,
    staffing_audits: list[StaffingFacidAudit],
    coverage: list[dict[str, str]],
    retrieved_at: str,
) -> dict[str, Any]:
    return {
        "ticket": "NJ-SEN-004",
        "internal_only": True,
        "public_new_jersey_route": False,
        "retrieved_at": retrieved_at,
        "coverage": coverage,
        "populations": {
            "nj_doh_all_ltc_source_identities": ltc_rows,
            "nj_doh_all_acute_source_identities": acute_inspect.get("source_rows"),
            "home_health_agencies": acute_inspect.get("home_health_agencies"),
            "hospice_programs": acute_inspect.get("hospice_programs"),
            "hospice_branches": acute_inspect.get("hospice_branches"),
            "hospice_inpatient": acute_inspect.get("hospice_inpatient"),
            "cms_classes_not_summed": True,
        },
        "staffing_facid_reconciliation": {
            "records": len(staffing_audits),
            "by_class": dict(Counter(item.classification for item in staffing_audits)),
        },
        "enforcement_rematch": json.loads(rematch.to_json()) if rematch else None,
        "publication_gates": {
            "care_database_url": False,
            "migrations_applied": False,
            "production_derived_metrics": False,
            "public_route_allowed": False,
        },
        "notes": [
            "Do not sum CMS nursing home, Home Health, and Hospice into providers.",
            "Do not show zero CCRCs; the roster is SOURCE_AVAILABLE_BY_REQUEST.",
            "Physical office county is not Home Health or Hospice service area.",
            "This snapshot is internal and not production-derived until NJ-SEN-005 executes against CARE_DATABASE_URL.",
        ],
    }


def fetch_url(url: str, timeout: float = 45) -> tuple[int | None, bytes, str | None]:
    request = Request(url, headers={"User-Agent": "SeniorTrustHub/NJ-SEN-004 (research ingest)"})
    try:
        with urlopen(request, timeout=timeout) as response:  # noqa: S310
            return getattr(response, "status", 200), response.read(), response.headers.get("Content-Type")
    except Exception as exc:  # noqa: BLE001
        return None, str(exc).encode("utf-8"), exc.__class__.__name__


def load_identities_from_paths(ltc_xlsx: Path | None, acute_xlsx: Path | None) -> tuple[list[IdentityRecord], list[IdentityRecord]]:
    ltc: list[IdentityRecord] = []
    acute: list[IdentityRecord] = []
    if ltc_xlsx and ltc_xlsx.is_file():
        _headers, rows, _sheets = parse_xlsx(ltc_xlsx.read_bytes())
        parsed, _ = parse_facility_rows(rows)
        ltc = [identity_from_ltc(row) for row in parsed]
    if acute_xlsx and acute_xlsx.is_file():
        _headers, rows, _sheets = parse_acute_xlsx(acute_xlsx.read_bytes())
        parsed, _ = parse_acute_rows(rows)
        acute = [identity_from_acute(row) for row in parsed]
    return ltc, acute
