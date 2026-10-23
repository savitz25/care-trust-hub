"""Stage CMS Home Health and Hospice CHOW files. No database access.

Decode both CSVs as CP1252. The raw-byte SHA-256 is the file identity and is
never recomputed from re-encoded text. Owner rows are associations, not events.
"""

from __future__ import annotations

import csv
import hashlib
import io
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

HH_DATASET = "home-health-chow"
HOSPICE_DATASET = "hospice-chow"
HH_OWNER_DATASET = "home-health-chow-owners"
HOSPICE_OWNER_DATASET = "hospice-chow-owners"
TRANSFORMATION_VERSION = "hh-hospice-chow-v1"
DECODING = "cp1252"

PROGRAMS = {
    "HH": {
        "program": "HH",
        "dataset_key": HH_DATASET,
        "owner_dataset_key": HH_OWNER_DATASET,
        "provider_type": "home_health",
        "buyer_type_code": "00-06",
    },
    "HOSPICE": {
        "program": "HOSPICE",
        "dataset_key": HOSPICE_DATASET,
        "owner_dataset_key": HOSPICE_OWNER_DATASET,
        "provider_type": "hospice",
        "buyer_type_code": "00-08",
    },
}

PROVIDER_TYPE_BY_CODE = {"00-06": "home_health", "00-08": "hospice"}

EVENT_COLUMNS = (
    "ENROLLMENT ID - BUYER",
    "ENROLLMENT ID - SELLER",
    "EFFECTIVE DATE",
    "CHOW TYPE CODE",
    "CHOW TYPE TEXT",
    "CCN - BUYER",
    "CCN - SELLER",
    "NPI - BUYER",
    "NPI - SELLER",
    "PROVIDER TYPE CODE - BUYER",
    "PROVIDER TYPE CODE - SELLER",
    "PROVIDER TYPE TEXT - SELLER",
    "MULTIPLE NPI FLAG - BUYER",
    "MULTIPLE NPI FLAG - SELLER",
    "ORGANIZATION NAME - BUYER",
    "ORGANIZATION NAME - SELLER",
)

OWNER_COLUMNS = (
    "ENROLLMENT ID",
    "ASSOCIATE ID - OWNER",
    "TYPE - OWNER",
    "ROLE CODE - OWNER",
    "ROLE TEXT - OWNER",
    "ORGANIZATION NAME - OWNER",
    "FIRST NAME - OWNER",
    "LAST NAME - OWNER",
    "ASSOCIATION DATE - OWNER",
    "PERCENTAGE OWNERSHIP",
)

# Hold reasons from the reference matcher. Every combination loads as
# review_required and is not publicly eligible.
HOLD_REASONS = (
    "MISSING_SELLER_CCN",
    "CROSS_TYPE_SELLER",
    "BUYER_AMBIGUOUS",
    "BUYER_WEAK_SINGLE_ID",
    "BUYER_NO_PROFILE_MATCH",
    "SELLER_AMBIGUOUS",
    "SELLER_RESOLVES_TO_DIFFERENT_PROFILE",
    "SELLER_ENROLLMENT_ON_BUYER_PROFILE",
    "BUYER_ENROLLMENT_ONLY_NO_CORROBORATION",
)


class ChowQaError(ValueError):
    """Fail closed. A failed gate must not reach a write."""


@dataclass(frozen=True, slots=True)
class ParsedCsv:
    path: Path
    filename: str
    raw_sha256: str
    byte_size: int
    decoding: str
    rows: list[dict[str, str]]


@dataclass(slots=True)
class StagedEvent:
    program: str
    dataset_key: str
    event_natural_key: str
    source_record_locator: str
    effective_date: str
    change_type_code: str
    change_type_text: str
    buyer_enrollment_id: str
    seller_enrollment_id: str
    buyer_ccn: str
    seller_ccn: str
    buyer_npi: str
    seller_npi: str
    buyer_provider_id: str | None
    seller_provider_id: str | None
    buyer_match: str
    seller_match: str
    hold_reasons: list[str]
    event_status: str
    confidence: str
    public_eligible: bool
    provider_identifier: str
    raw_record: dict[str, Any]

    @property
    def in_reference_matches(self) -> bool:
        return not self.hold_reasons


@dataclass(slots=True)
class StagedOwner:
    dataset_key: str
    owner_natural_key: str
    enrollment_id: str
    associate_id: str
    party_kind: str
    party_name: str
    role_code: str
    role_text: str
    association_date: str | None
    ownership_percentage: str | None
    source_record_locator: str
    public_eligible: bool
    raw_record: dict[str, Any]


@dataclass(slots=True)
class ChowPlan:
    events: list[StagedEvent]
    owners: list[StagedOwner]
    files: list[dict[str, Any]]
    qa_errors: list[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not self.qa_errors

    def summary(self) -> dict[str, Any]:
        """Counts only. No enrollment ids, names, or file bytes."""
        holds: Counter[str] = Counter()
        for event in self.events:
            holds.update(event.hold_reasons)
        return {
            "passed": self.passed,
            "qa_errors": list(self.qa_errors),
            "event_rows": len(self.events),
            "owner_rows": len(self.owners),
            "verified_exact": sum(1 for event in self.events if event.public_eligible),
            "review_required": sum(1 for event in self.events if not event.public_eligible),
            "public_eligible_owners": sum(1 for owner in self.owners if owner.public_eligible),
            "hold_reason_counts": dict(sorted(holds.items())),
            "files": [
                {
                    "filename": item["filename"],
                    "raw_sha256": item["raw_sha256"],
                    "byte_size": item["byte_size"],
                    "decoding": item["decoding"],
                    "rows": item["rows"],
                }
                for item in self.files
            ],
            "writes": 0,
            "dry_run": True,
            "deletes": 0,
        }

    def to_json_ready(self) -> dict[str, Any]:
        payload = self.summary()
        payload["events"] = [asdict(event) for event in self.events]
        payload["owners"] = [asdict(owner) for owner in self.owners]
        return payload


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def read_cp1252_csv(path: Path, required: tuple[str, ...]) -> ParsedCsv:
    raw = path.read_bytes()
    digest = sha256_bytes(raw)
    try:
        text = raw.decode(DECODING)
    except UnicodeDecodeError as error:
        raise ChowQaError(f"{path.name} is not {DECODING}: {error}") from error
    reader = csv.DictReader(io.StringIO(text, newline=""))
    columns = {name.strip() for name in (reader.fieldnames or []) if name}
    missing = [name for name in required if name not in columns]
    if missing:
        raise ChowQaError(f"{path.name} missing required column: " + ", ".join(missing))
    rows = []
    for row in reader:
        cleaned = {(key or "").strip(): (value or "") for key, value in row.items() if key}
        rows.append(cleaned)
    return ParsedCsv(
        path=path,
        filename=path.name,
        raw_sha256=digest,
        byte_size=len(raw),
        decoding=DECODING,
        rows=rows,
    )


def _cell(row: dict[str, str], name: str) -> str:
    return (row.get(name) or "").strip()


def parse_effective_date(value: str) -> str:
    text = value.strip()
    if not text:
        raise ChowQaError("CHOW row missing EFFECTIVE DATE")
    if "/" in text:
        month, day, year = text.split("/")
        parsed = date(int(year), int(month), int(day))
        return parsed.isoformat()
    return date.fromisoformat(text[:10]).isoformat()


def pad_ccn(value: str) -> str:
    text = value.strip()
    if not text:
        return ""
    return text.zfill(6)


def event_natural_key(
    *,
    program: str,
    buyer_enrollment: str,
    seller_enrollment: str,
    effective_date: str,
    chow_type_code: str,
) -> str:
    return "|".join((program, buyer_enrollment, seller_enrollment, effective_date, chow_type_code))


def index_identifiers(
    rows: list[dict[str, Any]],
) -> dict[tuple[str, str], set[tuple[str, str]]]:
    """ID-only index. Keys are (kind, value) -> {(provider_id, provider_type)}."""
    index: dict[tuple[str, str], set[tuple[str, str]]] = defaultdict(set)
    for row in rows:
        provider_id = str(row.get("pid") or row.get("provider_id") or "").strip()
        provider_type = str(row.get("t") or row.get("provider_type") or "").strip()
        if not provider_id or not provider_type:
            continue
        enrollment = str(row.get("e") or row.get("enrollment_id") or "").strip()
        ccn = str(row.get("c") or row.get("ccn") or "").strip()
        npi = str(row.get("n") or row.get("npi") or "").strip()
        if enrollment:
            index[("E", enrollment)].add((provider_id, provider_type))
        if ccn:
            index[("C", ccn.zfill(6))].add((provider_id, provider_type))
        if npi:
            index[("N", npi)].add((provider_id, provider_type))
    return index


def match_side(
    row: dict[str, str],
    side: str,
    index: dict[tuple[str, str], set[tuple[str, str]]],
) -> tuple[str, str, str]:
    """Port of the reference matcher. Returns (match, provider_id, via)."""
    enrollment = _cell(row, f"ENROLLMENT ID - {side}")
    ccn = _cell(row, f"CCN - {side}")
    npi = _cell(row, f"NPI - {side}")
    expect_type = PROVIDER_TYPE_BY_CODE.get(_cell(row, f"PROVIDER TYPE CODE - {side}"), "other")
    hits = {
        "E": index.get(("E", enrollment), set()) if enrollment else set(),
        "C": index.get(("C", ccn.zfill(6)), set()) if ccn else set(),
        "N": index.get(("N", npi), set()) if npi else set(),
    }
    pids = {kind: {provider_id for provider_id, _ in values} for kind, values in hits.items()}
    all_ids = set().union(*pids.values())
    types = {provider_type for values in hits.values() for _, provider_type in values}
    if not all_ids:
        return "NO_MATCH", "", ""
    if any(len(values) > 1 for values in pids.values()):
        return "AMBIGUOUS", "|".join(sorted(all_ids)), "one identifier maps to >1 profile"
    if len(all_ids) > 1:
        return "AMBIGUOUS", "|".join(sorted(all_ids)), "identifiers point to different profiles"
    provider_id = next(iter(all_ids))
    via = "".join(kind for kind in "ECN" if pids[kind])
    if types != {expect_type}:
        return "AMBIGUOUS", provider_id, f"profile type {types} != {expect_type}"
    if "E" in via and ("C" in via or "N" in via):
        return "EXACT", provider_id, via
    if "E" in via:
        return "EXACT_ENROLLMENT_ONLY", provider_id, via
    if "C" in via and "N" in via:
        return "STRONG", provider_id, via
    return "WEAK", provider_id, via


def hold_reasons(
    row: dict[str, str],
    buyer_match: str,
    buyer_provider_id: str,
    seller_match: str,
    seller_provider_id: str,
    seller_via: str,
) -> list[str]:
    reasons: list[str] = []
    if not _cell(row, "CCN - SELLER"):
        reasons.append("MISSING_SELLER_CCN")
    if _cell(row, "PROVIDER TYPE CODE - SELLER") != _cell(row, "PROVIDER TYPE CODE - BUYER"):
        reasons.append("CROSS_TYPE_SELLER")
    if buyer_match == "AMBIGUOUS":
        reasons.append("BUYER_AMBIGUOUS")
    if buyer_match == "WEAK":
        reasons.append("BUYER_WEAK_SINGLE_ID")
    if buyer_match == "NO_MATCH":
        reasons.append("BUYER_NO_PROFILE_MATCH")
    if seller_match == "AMBIGUOUS":
        reasons.append("SELLER_AMBIGUOUS")
    if seller_provider_id and buyer_provider_id and seller_provider_id != buyer_provider_id:
        reasons.append("SELLER_RESOLVES_TO_DIFFERENT_PROFILE")
    if "E" in seller_via and seller_provider_id == buyer_provider_id and buyer_provider_id:
        reasons.append("SELLER_ENROLLMENT_ON_BUYER_PROFILE")
    if buyer_match == "EXACT_ENROLLMENT_ONLY":
        reasons.append("BUYER_ENROLLMENT_ONLY_NO_CORROBORATION")
    return reasons


def _publication(buyer_match: str, reasons: list[str]) -> tuple[str, str, bool]:
    """Publish only an unheld EXACT buyer match. Everything else is held."""
    if not reasons and buyer_match == "EXACT":
        return "VERIFIED", "EXACT", True
    if not reasons and buyer_match == "STRONG":
        return "REVIEW_REQUIRED", "STRONG", False
    return "REVIEW_REQUIRED", "REVIEW_REQUIRED", False


def stage_events(
    parsed: ParsedCsv,
    *,
    program: str,
    index: dict[tuple[str, str], set[tuple[str, str]]],
) -> list[StagedEvent]:
    spec = PROGRAMS[program]
    staged: list[StagedEvent] = []
    for offset, row in enumerate(parsed.rows, start=2):
        buyer_enrollment = _cell(row, "ENROLLMENT ID - BUYER")
        seller_enrollment = _cell(row, "ENROLLMENT ID - SELLER")
        type_code = _cell(row, "CHOW TYPE CODE")
        if not buyer_enrollment or not seller_enrollment or not type_code:
            raise ChowQaError(f"{parsed.filename} line {offset} missing enrollment or CHOW type")
        try:
            effective = parse_effective_date(_cell(row, "EFFECTIVE DATE"))
        except ValueError as error:
            raise ChowQaError(
                f"{parsed.filename} line {offset} has an invalid effective date"
            ) from error
        buyer_match, buyer_id, _buyer_via = match_side(row, "BUYER", index)
        seller_match, seller_id, seller_via = match_side(row, "SELLER", index)
        reasons = hold_reasons(row, buyer_match, buyer_id, seller_match, seller_id, seller_via)
        status, confidence, public = _publication(buyer_match, reasons)
        buyer_ccn = pad_ccn(_cell(row, "CCN - BUYER"))
        seller_ccn = pad_ccn(_cell(row, "CCN - SELLER"))
        key = event_natural_key(
            program=program,
            buyer_enrollment=buyer_enrollment,
            seller_enrollment=seller_enrollment,
            effective_date=effective,
            chow_type_code=type_code,
        )
        provider_identifier = buyer_ccn or buyer_enrollment
        staged.append(
            StagedEvent(
                program=program,
                dataset_key=spec["dataset_key"],
                event_natural_key=key,
                source_record_locator=f"{parsed.filename}#line={offset}",
                effective_date=effective,
                change_type_code=type_code,
                change_type_text=_cell(row, "CHOW TYPE TEXT") or type_code,
                buyer_enrollment_id=buyer_enrollment,
                seller_enrollment_id=seller_enrollment,
                buyer_ccn=buyer_ccn,
                seller_ccn=seller_ccn,
                buyer_npi=_cell(row, "NPI - BUYER"),
                seller_npi=_cell(row, "NPI - SELLER"),
                buyer_provider_id=buyer_id or None,
                seller_provider_id=seller_id or None,
                buyer_match=buyer_match,
                seller_match=seller_match,
                hold_reasons=reasons,
                event_status=status,
                confidence=confidence,
                public_eligible=public,
                provider_identifier=provider_identifier,
                raw_record={
                    **row,
                    "decoding": DECODING,
                    "raw_sha256": parsed.raw_sha256,
                    "source_file": parsed.filename,
                    "source_line": offset,
                },
            )
        )
    return staged


def stage_owners(parsed: ParsedCsv, *, program: str) -> list[StagedOwner]:
    spec = PROGRAMS[program]
    staged: list[StagedOwner] = []
    for offset, row in enumerate(parsed.rows, start=2):
        enrollment = _cell(row, "ENROLLMENT ID")
        associate = _cell(row, "ASSOCIATE ID - OWNER")
        if not enrollment or not associate:
            raise ChowQaError(f"{parsed.filename} line {offset} missing enrollment or associate id")
        role_code = _cell(row, "ROLE CODE - OWNER")
        association = _cell(row, "ASSOCIATION DATE - OWNER")
        association_iso = None
        if association:
            try:
                association_iso = parse_effective_date(association)
            except (ChowQaError, ValueError):
                association_iso = None
        party_kind = "organization" if _cell(row, "TYPE - OWNER") == "O" else "individual"
        if party_kind == "organization":
            name = (
                _cell(row, "ORGANIZATION NAME - OWNER") or "Organization name not published by CMS"
            )
        else:
            name = (
                ", ".join(
                    part
                    for part in (_cell(row, "LAST NAME - OWNER"), _cell(row, "FIRST NAME - OWNER"))
                    if part
                )
                or "Individual name not published by CMS"
            )
        percentage = _cell(row, "PERCENTAGE OWNERSHIP") or None
        key = "|".join((program, enrollment, associate, role_code, association_iso or ""))
        staged.append(
            StagedOwner(
                dataset_key=spec["owner_dataset_key"],
                owner_natural_key=key,
                enrollment_id=enrollment,
                associate_id=associate,
                party_kind=party_kind,
                party_name=name,
                role_code=role_code,
                role_text=_cell(row, "ROLE TEXT - OWNER"),
                association_date=association_iso,
                ownership_percentage=percentage,
                source_record_locator=f"{parsed.filename}#line={offset}",
                public_eligible=False,
                raw_record={
                    **row,
                    "decoding": DECODING,
                    "raw_sha256": parsed.raw_sha256,
                    "source_file": parsed.filename,
                    "source_line": offset,
                },
            )
        )
    return staged


def _file_meta(parsed: ParsedCsv) -> dict[str, Any]:
    return {
        "filename": parsed.filename,
        "raw_sha256": parsed.raw_sha256,
        "byte_size": parsed.byte_size,
        "decoding": parsed.decoding,
        "rows": len(parsed.rows),
    }


def audit_plan(
    events: list[StagedEvent],
    owners: list[StagedOwner],
    files: list[ParsedCsv],
    *,
    expected_sha256: dict[str, str] | None = None,
) -> list[str]:
    errors: list[str] = []
    by_file = {parsed.filename: parsed for parsed in files}
    for parsed in files:
        if parsed.decoding != DECODING:
            errors.append(f"{parsed.filename} decoding is not {DECODING}")
        if len(parsed.raw_sha256) != 64:
            errors.append(f"{parsed.filename} sha256 was not recorded")
        expected = (expected_sha256 or {}).get(parsed.filename)
        if expected and expected != parsed.raw_sha256:
            errors.append(f"{parsed.filename} sha256 does not match the expected raw bytes")
        produced = [
            event
            for event in events
            if event.source_record_locator.startswith(f"{parsed.filename}#")
        ]
        produced_owners = [
            owner
            for owner in owners
            if owner.source_record_locator.startswith(f"{parsed.filename}#")
        ]
        if parsed.filename.upper().find("OWNER") >= 0:
            if len(produced_owners) != len(parsed.rows):
                errors.append(
                    f"{parsed.filename} owner row count {len(produced_owners)} "
                    f"!= CSV records {len(parsed.rows)}"
                )
        elif len(produced) != len(parsed.rows):
            errors.append(
                f"{parsed.filename} row count {len(produced)} != CSV records {len(parsed.rows)}"
            )
    keys = [event.event_natural_key for event in events]
    if len(keys) != len(set(keys)):
        errors.append("distinct event keys != event rows")
    owner_keys = [owner.owner_natural_key for owner in owners]
    if len(owner_keys) != len(set(owner_keys)):
        errors.append("distinct owner keys != owner rows")
    for event in events:
        parsed = by_file.get(event.source_record_locator.split("#", 1)[0])
        raw = event.raw_record
        if (
            parsed
            and not _cell(raw, "CCN - SELLER")
            and "MISSING_SELLER_CCN" not in event.hold_reasons
        ):
            errors.append("missing seller CCN row was not held")
        if (
            _cell(raw, "PROVIDER TYPE CODE - SELLER")
            and _cell(raw, "PROVIDER TYPE CODE - BUYER")
            and _cell(raw, "PROVIDER TYPE CODE - SELLER")
            != _cell(raw, "PROVIDER TYPE CODE - BUYER")
            and "CROSS_TYPE_SELLER" not in event.hold_reasons
        ):
            errors.append("cross-type row was not held")
        if event.public_eligible and event.hold_reasons:
            errors.append("a held row was marked publicly eligible")
        if event.public_eligible and not (
            event.event_status == "VERIFIED" and event.confidence == "EXACT"
        ):
            errors.append("public row is not VERIFIED EXACT")
        if event.hold_reasons and (
            event.event_status != "REVIEW_REQUIRED" or event.public_eligible
        ):
            errors.append("held row was not review_required and private")
        if any(owner.public_eligible for owner in owners):
            errors.append("owner association was marked publicly eligible")
    if not files:
        errors.append("sha256 was not recorded")
    return errors


def stage_chow_files(
    *,
    hh_events: Path,
    hh_owners: Path,
    hospice_events: Path,
    hospice_owners: Path,
    identifiers: list[dict[str, Any]],
    expected_sha256: dict[str, str] | None = None,
) -> ChowPlan:
    parsed = [
        read_cp1252_csv(hh_events, EVENT_COLUMNS),
        read_cp1252_csv(hh_owners, OWNER_COLUMNS),
        read_cp1252_csv(hospice_events, EVENT_COLUMNS),
        read_cp1252_csv(hospice_owners, OWNER_COLUMNS),
    ]
    index = index_identifiers(identifiers)
    events = stage_events(parsed[0], program="HH", index=index) + stage_events(
        parsed[2], program="HOSPICE", index=index
    )
    owners = stage_owners(parsed[1], program="HH") + stage_owners(parsed[3], program="HOSPICE")
    plan = ChowPlan(
        events=events,
        owners=owners,
        files=[_file_meta(item) for item in parsed],
    )
    plan.qa_errors = audit_plan(events, owners, parsed, expected_sha256=expected_sha256)
    return plan
