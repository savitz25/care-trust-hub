"""Conservative normalization for CMS-published ownership evidence."""

from __future__ import annotations

import codecs
import csv
import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from .manifest import ReleaseManifest

OWNERSHIP_KEYS = (
    "skilled-nursing-facility-enrollments",
    "skilled-nursing-facility-all-owners",
    "nursing-home-ownership",
    "skilled-nursing-facility-change-of-ownership",
    "skilled-nursing-facility-change-of-ownership-owner-information",
)
OWNERSHIP_TRANSFORMATION_VERSION = "cms-ownership-v1"


@dataclass(slots=True)
class OwnershipSummary:
    dataset_key: str
    source_rows: int = 0
    normalized_rows: int = 0
    rejected_rows: int = 0
    individual_parties: int = 0
    organizational_parties: int = 0
    unmatched_provider_candidates: int = 0

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def _value(row: dict[str, str], name: str) -> str:
    return (row.get(name) or "").strip()


def _source_encoding(path: Path) -> str:
    decoder = codecs.getincrementaldecoder("utf-8-sig")()
    try:
        with path.open("rb") as handle:
            while chunk := handle.read(1024 * 1024):
                decoder.decode(chunk)
            decoder.decode(b"", final=True)
        return "utf-8-sig"
    except UnicodeDecodeError:
        return "cp1252"


def _date(value: str) -> str | None:
    value = value.strip().removeprefix("since ")
    if not value or value.upper() in {"NO DATE PROVIDED", "NOT APPLICABLE"}:
        return None
    if "/" in value:
        month, day, year = value.split("/")
        return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    parts = value.split("-")
    if len(parts) != 3:
        raise ValueError(f"invalid date: {value}")
    return f"{int(parts[0]):04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"


def _percentage(value: str) -> float | None:
    value = value.strip().removesuffix("%").strip()
    if not value or value.upper() in {"NOT APPLICABLE", "NO PERCENTAGE PROVIDED"}:
        return None
    result = float(value)
    if not 0 <= result <= 100:
        raise ValueError("ownership percentage outside 0..100")
    return result


def _key(*values: str) -> str:
    return hashlib.sha256("|".join(values).encode()).hexdigest()


def _classifications(row: dict[str, str], suffix: str = " - OWNER") -> dict[str, bool | str]:
    labels = {
        "MANAGEMENT SERVICES COMPANY": "management_services_company",
        "HOLDING COMPANY": "holding_company",
        "INVESTMENT FIRM": "investment_firm",
        "PRIVATE EQUITY COMPANY": "private_equity_company",
        "REIT": "reit",
        "CHAIN HOME OFFICE": "chain_home_office",
        "PARENT COMPANY": "parent_company",
        "OWNED BY ANOTHER ORG OR IND": "owned_by_another_party",
    }
    result: dict[str, bool | str] = {}
    for field, output in labels.items():
        value = _value(row, f"{field}{suffix}")
        if value in {"Y", "N"}:
            result[output] = value == "Y"
        elif value:
            result[output] = value
    return result


def normalize_ownership_row(dataset_key: str, row: dict[str, str], line: int) -> dict[str, Any]:
    locator = f"csv-row:{line}"
    if dataset_key == "skilled-nursing-facility-enrollments":
        ccn = _value(row, "CCN").upper()
        pac = _value(row, "ASSOCIATE ID")
        enrollment = _value(row, "ENROLLMENT ID")
        name = _value(row, "ORGANIZATION NAME")
        if not (ccn and pac and enrollment and name):
            raise ValueError("enrollment row missing CCN, PAC ID, enrollment ID, or organization")
        return {
            "record_kind": "enrollment",
            "record_key": _key(dataset_key, enrollment, ccn),
            "ccn": ccn,
            "organization_pac_id": pac,
            "enrollment_id": enrollment,
            "organization_name": name,
            "dba_name": _value(row, "DOING BUSINESS AS NAME") or None,
            "npi": _value(row, "NPI") or None,
            "role_code": "ENROLLED_ORGANIZATION",
            "role_text": "Medicare-enrolled legal organization",
            "association_date": None,
            "ownership_percentage": None,
            "classifications": {"organization_type": _value(row, "ORGANIZATION TYPE STRUCTURE")},
            "source_record_locator": locator,
            "raw_record": row,
        }
    if dataset_key in {
        "skilled-nursing-facility-all-owners",
        "skilled-nursing-facility-change-of-ownership-owner-information",
    }:
        enrollment = _value(row, "ENROLLMENT ID")
        owner_pac = _value(row, "ASSOCIATE ID - OWNER")
        party_kind = "organization" if _value(row, "TYPE - OWNER") == "O" else "individual"
        display_name = (
            _value(row, "ORGANIZATION NAME - OWNER")
            if party_kind == "organization"
            else ", ".join(
                filter(None, [_value(row, "LAST NAME - OWNER"), _value(row, "FIRST NAME - OWNER")])
            )
        )
        if not (enrollment and owner_pac):
            raise ValueError("owner row missing enrollment or owner PAC ID")
        if not display_name:
            display_name = "Individual name not published by CMS"
        return {
            "record_kind": "owner",
            "record_key": _key(
                dataset_key, enrollment, owner_pac, _value(row, "ROLE CODE - OWNER")
            ),
            "enrollment_id": enrollment,
            "party_kind": party_kind,
            "party_pac_id": owner_pac,
            "party_name": display_name,
            "role_code": _value(row, "ROLE CODE - OWNER") or None,
            "role_text": _value(row, "ROLE TEXT - OWNER")
            or "CMS-reported ownership or control role",
            "association_date": _date(_value(row, "ASSOCIATION DATE - OWNER")),
            "ownership_percentage": _percentage(_value(row, "PERCENTAGE OWNERSHIP")),
            "classifications": _classifications(row),
            "source_record_locator": locator,
            "raw_record": row,
        }
    if dataset_key == "nursing-home-ownership":
        ccn = _value(row, "CMS Certification Number (CCN)").upper()
        owner_type = _value(row, "Owner Type").lower()
        party_kind = "individual" if owner_type == "individual" else "organization"
        name = _value(row, "Owner Name")
        role = _value(row, "Role played by Owner or Manager in Facility")
        if ccn and role == "Ownership Data Not Available" and not name:
            return {
                "record_kind": "unavailable",
                "record_key": _key(dataset_key, ccn, role, str(line)),
                "ccn": ccn,
                "notice_text": role,
                "source_record_locator": locator,
                "raw_record": row,
            }
        if not (ccn and name and role):
            raise ValueError("ownership row missing CCN, owner name, or role")
        return {
            "record_kind": "owner",
            "record_key": _key(dataset_key, ccn, name, role, str(line)),
            "ccn": ccn,
            "party_kind": party_kind,
            "party_pac_id": None,
            "party_name": name,
            "role_code": None,
            "role_text": role,
            "association_date": _date(_value(row, "Association Date")),
            "ownership_percentage": _percentage(_value(row, "Ownership Percentage")),
            "classifications": {"owner_type": _value(row, "Owner Type")},
            "source_record_locator": locator,
            "raw_record": row,
        }
    if dataset_key == "skilled-nursing-facility-change-of-ownership":
        buyer_pac = _value(row, "ASSOCIATE ID - BUYER")
        seller_pac = _value(row, "ASSOCIATE ID - SELLER")
        effective = _date(_value(row, "EFFECTIVE DATE"))
        ccn = (_value(row, "CCN - BUYER") or _value(row, "CCN - SELLER")).upper()
        if not (buyer_pac and seller_pac and effective and ccn):
            raise ValueError("CHOW row missing buyer, seller, effective date, or CCN")
        return {
            "record_kind": "change",
            "record_key": _key(dataset_key, buyer_pac, seller_pac, effective, ccn),
            "ccn": ccn,
            "buyer_pac_id": buyer_pac,
            "buyer_name": _value(row, "ORGANIZATION NAME - BUYER"),
            "seller_pac_id": seller_pac,
            "seller_name": _value(row, "ORGANIZATION NAME - SELLER"),
            "change_type_code": _value(row, "CHOW TYPE CODE"),
            "change_type_text": _value(row, "CHOW TYPE TEXT"),
            "effective_date": effective,
            "source_record_locator": locator,
            "raw_record": row,
        }
    raise ValueError(f"unsupported ownership source: {dataset_key}")


def ingest_ownership_source(
    source_file: Path,
    manifest: ReleaseManifest,
    data_root: Path,
    *,
    write_outputs: bool = True,
) -> OwnershipSummary:
    summary = OwnershipSummary(dataset_key=manifest.dataset_key)
    records: list[dict[str, Any]] = []
    with source_file.open("r", encoding=_source_encoding(source_file), newline="") as handle:
        for line, row in enumerate(csv.DictReader(handle), start=2):
            summary.source_rows += 1
            try:
                record = normalize_ownership_row(manifest.dataset_key, row, line)
                records.append(record)
                summary.normalized_rows += 1
                if record.get("party_kind") == "individual":
                    summary.individual_parties += 1
                elif record.get("party_kind") == "organization":
                    summary.organizational_parties += 1
            except (ValueError, TypeError):
                summary.rejected_rows += 1
    if write_outputs:
        release = manifest.source_release_date or manifest.sha256
        destination = data_root / "normalized" / "cms" / manifest.dataset_key / release
        destination.mkdir(parents=True, exist_ok=True)
        with (destination / "records.jsonl").open("w", encoding="utf-8", newline="\n") as handle:
            for record in records:
                handle.write(json.dumps(record, sort_keys=True) + "\n")
        report = data_root / "reports" / "cms" / manifest.dataset_key / release
        report.mkdir(parents=True, exist_ok=True)
        (report / "summary.json").write_text(summary.to_json(), encoding="utf-8")
    return summary
