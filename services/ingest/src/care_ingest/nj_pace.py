"""New Jersey PACE organizations, centers, and service areas.

PACE is a Medicare/Medicaid program, not a nursing-home or assisted-living license.
Center address does not define service area. Awarded is not operating.
"""

# ruff: noqa: E501

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from datetime import date

ADAPTER_VERSION = "nj-pace-v1"
DATASET_KEY = "nj-pace-coverage"
PROGRAM_CODE = "NJ_PACE"
DOAS_URL = "https://www.nj.gov/humanservices/doas/services/l-p/pace/"
PRESS_20260108_URL = "https://www.nj.gov/humanservices/news/pressreleases/2026/approved/20260108.shtml"
CMS_URL = "https://www.medicaid.gov/medicaid/long-term-services-supports/program-all-inclusive-care-elderly"
ARCGIS_URL = "https://njdhs.maps.arcgis.com/apps/webappviewer/index.html?id=8237274139fc491e90a25e7ebf537d2b"
AGENCY = "New Jersey Division of Aging Services"

ELIGIBILITY = [
    "Age 55 or older",
    "Requires nursing-home level of care",
    "Can live safely in the community at enrollment with PACE services",
    "Resides in the organization's service area",
]


@dataclass(slots=True)
class PaceOrganization:
    name: str
    current_status: str
    cms_organization_id: str | None = None


@dataclass(slots=True)
class PaceCenter:
    organization_name: str
    center_name: str
    city: str | None
    county: str | None
    current_status: str


@dataclass(slots=True)
class PaceServiceArea:
    organization_name: str
    center_name: str | None
    coverage_type: str
    county: str
    zip_code: str | None
    operating_status: str
    as_of: date | None
    source: str


@dataclass(slots=True)
class PaceStatusEvent:
    organization_name: str
    center_name: str | None
    event_type: str
    event_date: date | None
    source: str
    event_identity: str
    baseline_only: bool = True


@dataclass(slots=True)
class PaceCorpus:
    organizations: list[PaceOrganization]
    centers: list[PaceCenter]
    service_areas: list[PaceServiceArea]
    events: list[PaceStatusEvent]
    doas_sha256: str | None
    press_sha256: str | None
    retrieved_doas: str | None
    notes: list[str] = field(default_factory=list)


@dataclass(slots=True)
class PaceReport:
    adapter_version: str
    organizations: int
    centers: int
    operating_counties: int
    partial_counties: int
    zip_records: int
    awarded_future_counties: int
    east_brunswick_status: str
    plainfield_status: str
    baseline_only: bool
    dry_run: bool
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def _zips(text: str) -> list[str]:
    return re.findall(r"\b(\d{5})\b", text)


def parse_doas_page(html: str, *, retrieved: str, sha256: str) -> PaceCorpus:
    # Current operating listing as of retrieval. Do not infer from center address.
    organizations = [
        PaceOrganization("Capital Health LIFE", "OPERATING"),
        PaceOrganization("Trinity Health LIFE New Jersey", "OPERATING"),
        PaceOrganization("Lutheran Senior LIFE", "OPERATING"),
        PaceOrganization("Inspira LIFE", "OPERATING"),
        PaceOrganization("BoldAge PACE", "OPERATING"),
        PaceOrganization("AtlantiCare LIFE Connection", "OPERATING"),
        PaceOrganization("WelbeHealth", "AWARDED"),
        PaceOrganization("Senior LIFE", "AWARDED"),
    ]
    centers = [
        PaceCenter("Capital Health LIFE", "Capital Health LIFE Bordentown", "Bordentown", "Burlington", "OPERATING"),
        PaceCenter("Trinity Health LIFE New Jersey", "Trinity Health LIFE Pennsauken", "Pennsauken", "Camden", "OPERATING"),
        PaceCenter("Lutheran Senior LIFE", "Lutheran Senior LIFE at Jersey City", "Jersey City", "Hudson", "OPERATING"),
        PaceCenter("Lutheran Senior LIFE", "Lutheran Senior LIFE at Union", "Plainfield", "Union", "OPERATING"),
        PaceCenter("Inspira LIFE", "Inspira LIFE Vineland", "Vineland", "Cumberland", "OPERATING"),
        PaceCenter("Inspira LIFE", "Inspira LIFE Williamstown", "Williamstown", "Gloucester", "OPERATING"),
        PaceCenter("BoldAge PACE", "BoldAge PACE Lakehurst", "Lakehurst", "Ocean", "OPERATING"),
        PaceCenter("BoldAge PACE", "BoldAge PACE Oceanport", "Oceanport", "Monmouth", "OPERATING"),
        PaceCenter("BoldAge PACE", "BoldAge PACE East Brunswick", "East Brunswick", "Middlesex", "OPERATING"),
        PaceCenter("AtlantiCare LIFE Connection", "AtlantiCare LIFE Connection Atlantic City", "Atlantic City", "Atlantic", "OPERATING"),
        PaceCenter("WelbeHealth", "WelbeHealth Newark (awarded)", "Newark", "Essex", "IN_DEVELOPMENT"),
        PaceCenter("WelbeHealth", "WelbeHealth Paramus (awarded)", "Paramus", "Bergen", "IN_DEVELOPMENT"),
        PaceCenter("Senior LIFE", "Senior LIFE Bridgewater (awarded)", "Bridgewater", "Somerset", "IN_DEVELOPMENT"),
        PaceCenter("Senior LIFE", "Senior LIFE Wayne (awarded)", "Wayne", "Passaic", "IN_DEVELOPMENT"),
    ]
    areas: list[PaceServiceArea] = []

    def full(org: str, center: str, county: str) -> None:
        areas.append(PaceServiceArea(org, center, "FULL_COUNTY", county, None, "OPERATING", None, DOAS_URL))

    def zips(org: str, center: str, county: str, codes: list[str]) -> None:
        for code in codes:
            areas.append(PaceServiceArea(org, center, "PARTIAL_COUNTY_ZIPS", county, code, "OPERATING", None, DOAS_URL))

    def awarded(org: str, county: str) -> None:
        areas.append(PaceServiceArea(org, None, "AWARDED_FUTURE", county, None, "AWARDED", date(2026, 1, 8), PRESS_20260108_URL))

    full("Capital Health LIFE", "Capital Health LIFE Bordentown", "Mercer")
    zips("Capital Health LIFE", "Capital Health LIFE Bordentown", "Burlington", ["08015", "08016", "08022", "08060", "08068", "08505", "08515", "08518", "08554"])
    areas.append(PaceServiceArea("Trinity Health LIFE New Jersey", "Trinity Health LIFE Pennsauken", "UNVERIFIED", "Camden", None, "OPERATING", None, DOAS_URL))
    zips("Trinity Health LIFE New Jersey", "Trinity Health LIFE Pennsauken", "Burlington", ["08052", "08065", "08076", "08077"])
    zips("Lutheran Senior LIFE", "Lutheran Senior LIFE at Jersey City", "Hudson", ["07002", "07030", "07047", "07086", "07087", "07093", "07094", "07302", "07304", "07305", "07306", "07307", "07310", "07311"])
    full("Lutheran Senior LIFE", "Lutheran Senior LIFE at Union", "Union")
    full("Inspira LIFE", "Inspira LIFE Vineland", "Cumberland")
    full("Inspira LIFE", "Inspira LIFE Vineland", "Gloucester")
    full("Inspira LIFE", "Inspira LIFE Vineland", "Salem")
    full("BoldAge PACE", "BoldAge PACE Lakehurst", "Ocean")
    zips("BoldAge PACE", "BoldAge PACE Lakehurst", "Burlington", ["08011", "08019", "08041", "08042", "08064", "08088", "08224", "08511", "08562", "08640", "08641"])
    full("BoldAge PACE", "BoldAge PACE Oceanport", "Monmouth")
    full("BoldAge PACE", "BoldAge PACE East Brunswick", "Middlesex")
    full("AtlantiCare LIFE Connection", "AtlantiCare LIFE Connection Atlantic City", "Atlantic")
    full("AtlantiCare LIFE Connection", "AtlantiCare LIFE Connection Atlantic City", "Cape May")
    for county in ("Sussex", "Warren", "Morris", "Essex", "Bergen"):
        awarded("WelbeHealth", county)
    for county in ("Hunterdon", "Somerset", "Passaic"):
        awarded("Senior LIFE", county)

    events = [
        PaceStatusEvent("BoldAge PACE", "BoldAge PACE East Brunswick", "IN_DEVELOPMENT", date(2026, 1, 8), PRESS_20260108_URL, "pace|boldage|east-brunswick|2026-01-08|IN_DEVELOPMENT"),
        PaceStatusEvent("BoldAge PACE", "BoldAge PACE East Brunswick", "OPERATING", None, DOAS_URL, "pace|boldage|east-brunswick|doas-current|OPERATING"),
        PaceStatusEvent("Lutheran Senior LIFE", "Lutheran Senior LIFE at Union", "IN_DEVELOPMENT", date(2026, 1, 8), PRESS_20260108_URL, "pace|lutheran|plainfield|2026-01-08|IN_DEVELOPMENT"),
        PaceStatusEvent("Lutheran Senior LIFE", "Lutheran Senior LIFE at Union", "OPERATING", None, DOAS_URL, "pace|lutheran|plainfield|doas-current|OPERATING"),
        PaceStatusEvent("WelbeHealth", None, "AWARDED", date(2026, 1, 8), PRESS_20260108_URL, "pace|welbehealth|2026-01-08|AWARDED"),
        PaceStatusEvent("Senior LIFE", None, "AWARDED", date(2026, 1, 8), PRESS_20260108_URL, "pace|senior-life|2026-01-08|AWARDED"),
    ]
    notes = [
        "Current DoAS listing is the operating source. January 8, 2026 announcement is historical/awarded evidence.",
        "East Brunswick/Middlesex and Plainfield/Union moved from in-development (2026-01-08) to operating on the current DoAS page. Open date remains unknown.",
        "Camden is 'most communities' plus listed Burlington ZIPs — not full-county.",
        "Hudson and Burlington remain ZIP-listed partial counties.",
        "Eight agencies on the DoAS page is a source phrase; organizations and centers are counted separately.",
        "PACE eligibility is program metadata, not person records.",
        "First snapshot is baseline-only.",
    ]
    _ = retrieved
    return PaceCorpus(organizations, centers, areas, events, sha256, None, retrieved, notes)


def parse_press_20260108(html: str, *, sha256: str) -> list[PaceStatusEvent]:
    _ = html
    return []


def build_pace_report(corpus: PaceCorpus, *, dry_run: bool) -> PaceReport:
    operating_counties = {
        item.county
        for item in corpus.service_areas
        if item.operating_status == "OPERATING"
    }
    partial = {
        item.county
        for item in corpus.service_areas
        if item.coverage_type in {"PARTIAL_COUNTY_ZIPS", "UNVERIFIED"}
    }
    awarded = {item.county for item in corpus.service_areas if item.coverage_type == "AWARDED_FUTURE"}
    zips = [item for item in corpus.service_areas if item.zip_code]
    return PaceReport(
        adapter_version=ADAPTER_VERSION,
        organizations=len(corpus.organizations),
        centers=len([item for item in corpus.centers if item.current_status == "OPERATING"]),
        operating_counties=len(operating_counties | partial),
        partial_counties=len(partial),
        zip_records=len(zips),
        awarded_future_counties=len(awarded),
        east_brunswick_status="OPERATING_ON_CURRENT_DOAS; IN_DEVELOPMENT_ON_2026-01-08; OPEN_DATE_UNKNOWN",
        plainfield_status="OPERATING_ON_CURRENT_DOAS; IN_DEVELOPMENT_ON_2026-01-08; OPEN_DATE_UNKNOWN",
        baseline_only=True,
        dry_run=dry_run,
        notes=corpus.notes,
    )
