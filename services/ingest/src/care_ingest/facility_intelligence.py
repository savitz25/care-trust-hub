"""Contracts for versioned facility-intelligence source adapters and bounded jobs."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import date, datetime
from enum import StrEnum
from typing import Any, Protocol


class SourceAuthority(StrEnum):
    FEDERAL_HEALTHCARE = "federal_healthcare"
    STATE_HEALTHCARE_REGULATOR = "state_healthcare_regulator"
    GOVERNMENT_LEGAL = "government_legal"
    OFFICIAL_ORGANIZATION = "official_organization"
    COMMERCIAL_CORROBORATION = "commercial_corroboration"
    CONSUMER_REPUTATION = "consumer_reputation"


@dataclass(frozen=True, slots=True)
class FacilitySourceObservation:
    source_type: str
    source_authority: SourceAuthority
    source_identifier: str
    source_record_identifier: str
    observation_type: str
    observed_value: str | None
    normalized_value: str | None
    observed_at: datetime | None
    source_published_at: datetime | None
    retrieved_at: datetime
    source_reference: str | None
    release_identifier: str
    adapter_version: str
    canonical_ccn: str | None = None
    state_code: str | None = None
    state_license_identifier: str | None = None
    license_type: str | None = None
    license_status: str | None = None
    issue_date: date | None = None
    expiration_date: date | None = None
    operator_name: str | None = None
    legal_entity_name: str | None = None
    capacity: int | None = None
    address: str | None = None
    provenance: dict[str, Any] | None = None

    def fingerprint(self) -> str:
        payload = json.dumps(asdict(self), default=str, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(payload.encode()).hexdigest()


class FacilitySourceAdapter(Protocol):
    source_type: str
    source_authority: SourceAuthority
    adapter_version: str

    def observe(self, release_identifier: str) -> list[FacilitySourceObservation]: ...


@dataclass(slots=True)
class RequestBudget:
    maximum_requests: int
    used_requests: int = 0
    dry_run: bool = True

    def reserve(self, count: int = 1) -> bool:
        if count < 0:
            raise ValueError("request count cannot be negative")
        if self.used_requests + count > self.maximum_requests:
            return False
        if not self.dry_run:
            self.used_requests += count
        return True
