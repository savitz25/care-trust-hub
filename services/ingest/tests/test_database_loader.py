import csv
import json
import os
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

import psycopg
import pytest

from care_ingest.database import ReleaseChecksumConflict, load_provider_information
from care_ingest.manifest import ReleaseManifest, sha256_file
from care_ingest.provider_information import normalize_row
from care_ingest.registry import get_source
from care_ingest.regulatory import ingest_regulatory_source
from care_ingest.regulatory_database import load_regulatory_source

FIXTURE = Path(__file__).parent / "fixtures" / "provider_information.csv"
DATABASE_URL = os.environ.get("CARE_DATABASE_URL")
pytestmark = pytest.mark.integration


def _manifest(raw_file: Path, release: str) -> ReleaseManifest:
    return ReleaseManifest(
        manifest_version=2,
        dataset_key="nursing-home-provider-information",
        source_organization="Centers for Medicare & Medicaid Services (CMS)",
        cms_identifier="4pq5-n9py",
        official_source_url="https://data.cms.gov/provider-data/dataset/4pq5-n9py",
        retrieval_timestamp=datetime(2026, 8, 14, tzinfo=UTC).isoformat(),
        source_release_date=release,
        original_filename=raw_file.name,
        byte_size=raw_file.stat().st_size,
        sha256=sha256_file(raw_file),
        content_type="text/csv",
        transformation_version="provider-information-v2",
        ingestion_status="ingested",
        source_modified_at=release,
        published_at=None,
        source_period=None,
    )


def _normalized(raw_file: Path, manifest: ReleaseManifest, destination: Path) -> Path:
    records = []
    with raw_file.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            records.append(normalize_row(row, reader.line_num, manifest))
    destination.write_text(
        "".join(json.dumps(record) + "\n" for record in records), encoding="utf-8"
    )
    return destination


@pytest.fixture(autouse=True)
def clean_database() -> None:
    if not DATABASE_URL:
        pytest.skip("CARE_DATABASE_URL is not configured")
    with psycopg.connect(DATABASE_URL) as connection:
        connection.execute(
            "TRUNCATE evidence_assertion, facility_snapshot, provider_identifier, provider, "
            "ingest_run, raw_object, source_release, source_dataset CASCADE"
        )


def test_idempotency_history_lineage_and_postgis(tmp_path: Path) -> None:
    source = get_source("nursing-home-provider-information")
    first_manifest = _manifest(FIXTURE, "2026-07-29")
    first_normalized = _normalized(FIXTURE, first_manifest, tmp_path / "first.jsonl")
    first = load_provider_information(
        DATABASE_URL, source, first_manifest, FIXTURE, first_normalized
    )
    second = load_provider_information(
        DATABASE_URL, source, first_manifest, FIXTURE, first_normalized
    )
    assert first.provider_count == 2
    assert first.snapshot_count == 2
    assert not first.idempotent
    assert first.phase_seconds is not None
    assert set(first.phase_seconds) == {
        "copy",
        "identity_resolution",
        "snapshot_insert",
        "transaction_total",
    }
    assert second.idempotent
    assert second.ingest_run_id == first.ingest_run_id

    newer_raw = tmp_path / "provider_information_aug.csv"
    newer_raw.write_bytes(FIXTURE.read_bytes())
    newer_manifest = _manifest(newer_raw, "2026-08-29")
    newer_normalized = _normalized(newer_raw, newer_manifest, tmp_path / "second.jsonl")
    load_provider_information(DATABASE_URL, source, newer_manifest, newer_raw, newer_normalized)

    with psycopg.connect(DATABASE_URL) as connection:
        counts = connection.execute(
            """
            SELECT (SELECT count(*) FROM provider),
                   (SELECT count(*) FROM provider_identifier),
                   (SELECT count(*) FROM facility_snapshot),
                   (SELECT count(*) FROM ingest_run)
            """
        ).fetchone()
        assert counts == (2, 2, 4, 2)
        lineage = connection.execute(
            """
            SELECT pi.identifier_value, fs.provider_name, fs.source_record_locator,
                   fs.raw_record->>'CMS Certification Number (CCN)', ro.content_sha256,
                   sr.release_key, sd.dataset_key, ir.status,
                   ST_SRID(fs.location::geometry), fs.attributes = fs.raw_record
            FROM facility_snapshot fs
            JOIN provider_identifier pi ON pi.provider_id = fs.provider_id
            JOIN ingest_run ir ON ir.id = fs.ingest_run_id
            JOIN raw_object ro ON ro.id = fs.raw_object_id
            JOIN source_release sr ON sr.id = fs.source_release_id
            JOIN source_dataset sd ON sd.id = sr.source_dataset_id
            WHERE pi.identifier_value = '015001'
            ORDER BY sr.release_key
            """
        ).fetchall()
        assert len(lineage) == 2
        assert lineage[0][0] == lineage[0][3] == "015001"
        assert lineage[0][2] == "csv-row:2:ccn:015001"
        assert lineage[0][6:9] == ("nursing-home-provider-information", "succeeded", 4326)
        assert lineage[0][9] is False
        assert (
            connection.execute(
                "SELECT count(*) FROM facility_snapshot WHERE state_code = 'AL'"
            ).fetchone()[0]
            == 4
        )


def test_conflicting_release_checksum_rolls_back(tmp_path: Path) -> None:
    source = get_source("nursing-home-provider-information")
    manifest = _manifest(FIXTURE, "2026-07-29")
    normalized = _normalized(FIXTURE, manifest, tmp_path / "first.jsonl")
    load_provider_information(DATABASE_URL, source, manifest, FIXTURE, normalized)
    changed_raw = tmp_path / FIXTURE.name
    changed_raw.write_bytes(FIXTURE.read_bytes() + b"\n")
    conflicting = replace(
        _manifest(changed_raw, "2026-07-29"), original_filename=manifest.original_filename
    )
    with pytest.raises(ReleaseChecksumConflict):
        load_provider_information(DATABASE_URL, source, conflicting, changed_raw, normalized)
    with psycopg.connect(DATABASE_URL) as connection:
        assert connection.execute("SELECT count(*) FROM source_release").fetchone()[0] == 1
        assert connection.execute("SELECT count(*) FROM facility_snapshot").fetchone()[0] == 2


def test_malformed_normalized_record_rolls_back_entire_load(tmp_path: Path) -> None:
    source = get_source("nursing-home-provider-information")
    manifest = _manifest(FIXTURE, "2026-09-29")
    malformed = tmp_path / "malformed.jsonl"
    malformed.write_text(json.dumps({"provider_identity": {"value": "37E109"}}) + "\n")
    with pytest.raises((KeyError, ValueError)):
        load_provider_information(DATABASE_URL, source, manifest, FIXTURE, malformed)
    with psycopg.connect(DATABASE_URL) as connection:
        assert connection.execute("SELECT count(*) FROM source_dataset").fetchone()[0] == 0
        assert connection.execute("SELECT count(*) FROM ingest_run").fetchone()[0] == 0


def test_alphanumeric_ccn_and_missing_values_round_trip_as_null(tmp_path: Path) -> None:
    raw = tmp_path / "alpha_missing.csv"
    content = FIXTURE.read_text(encoding="utf-8").replace("015001", "37E109", 1)
    content = content.replace("2026-07-29,4,3,5,4,33.5,-86.8", "2026-07-29,,,,,,", 1)
    raw.write_text(content, encoding="utf-8")
    manifest = _manifest(raw, "2026-10-29")
    normalized = _normalized(raw, manifest, tmp_path / "alpha.jsonl")
    result = load_provider_information(
        DATABASE_URL,
        get_source("nursing-home-provider-information"),
        manifest,
        raw,
        normalized,
    )
    assert result.provider_count == 2
    with psycopg.connect(DATABASE_URL) as connection:
        row = connection.execute(
            """
            SELECT pi.identifier_value, fs.overall_rating, fs.source_latitude, fs.location
            FROM provider_identifier pi
            JOIN facility_snapshot fs ON fs.provider_id = pi.provider_id
            WHERE pi.identifier_value = '37E109'
            """
        ).fetchone()
        assert row == ("37E109", None, None, None)


def test_regulatory_set_based_load_idempotency_relationships_and_lineage(tmp_path: Path) -> None:
    provider_manifest = _manifest(FIXTURE, "2026-07-29")
    provider_normalized = _normalized(FIXTURE, provider_manifest, tmp_path / "providers.jsonl")
    load_provider_information(
        DATABASE_URL,
        get_source("nursing-home-provider-information"),
        provider_manifest,
        FIXTURE,
        provider_normalized,
    )
    fixtures = {
        "nursing-home-inspection-dates": (
            "CMS Certification Number (CCN),Survey Date,Type of Survey,"
            "Survey Cycle,Processing Date\n"
            "015001,2026-01-02,Health Standard,1,2026-06-01\n",
        ),
        "nursing-home-health-deficiencies": (
            "CMS Certification Number (CCN),Survey Date,Survey Type,Deficiency Prefix,"
            "Deficiency Category,Deficiency Tag Number,Deficiency Description,Scope Severity Code,"
            "Deficiency Corrected,Correction Date,Inspection Cycle,Standard Deficiency,"
            "Complaint Deficiency,Infection Control Inspection Deficiency,Citation under IDR,"
            "Citation under IIDR,Processing Date\n"
            "015001,2026-01-02,Health,F,Care,0880,Official CMS description,J,"
            "Past Non-Compliance,2026-01-03,1,Y,N,N,N,N,2026-06-01\n",
        ),
        "nursing-home-penalties": (
            "CMS Certification Number (CCN),Penalty Date,Penalty Type,Fine ID,Fine Amount,"
            "Payment Denial Start Date,Payment Denial Length in Days,Processing Date\n"
            "015001,2026-02-03,Fine,77,12400.00,,,2026-06-01\n",
        ),
    }
    results = []
    for dataset_key, content in fixtures.items():
        raw = tmp_path / f"{dataset_key}.csv"
        raw.write_text(content, encoding="utf-8")
        manifest = replace(
            _manifest(raw, "2026-06-01"),
            dataset_key=dataset_key,
            cms_identifier=get_source(dataset_key).cms_identifier,
            official_source_url=get_source(dataset_key).official_landing_page,
        )
        ingest_regulatory_source(raw, manifest, tmp_path)
        normalized = tmp_path / "normalized" / "cms" / dataset_key / "2026-06-01" / "records.jsonl"
        first = load_regulatory_source(
            DATABASE_URL, get_source(dataset_key), manifest, raw, normalized
        )
        second = load_regulatory_source(
            DATABASE_URL, get_source(dataset_key), manifest, raw, normalized
        )
        assert second.idempotent
        assert second.ingest_run_id == first.ingest_run_id
        results.append(first)
    assert [result.rows_loaded for result in results] == [1, 1, 1]
    with psycopg.connect(DATABASE_URL) as connection:
        row = connection.execute(
            """
            SELECT d.deficiency_tag, d.scope_severity_code, i.survey_type,
                   p.fine_amount::text, d.raw_record->>'Deficiency Tag Number',
                   d.source_record_locator, ir.status, sd.dataset_key
            FROM deficiency_finding d
            JOIN inspection_event i ON i.id=d.inspection_event_id
            JOIN ingest_run ir ON ir.id=d.ingest_run_id
            JOIN source_release sr ON sr.id=d.source_release_id
            JOIN source_dataset sd ON sd.id=sr.source_dataset_id
            CROSS JOIN penalty_enforcement p
            """
        ).fetchone()
        assert row == (
            "0880",
            "J",
            "Health Standard",
            "12400.00",
            "0880",
            "csv-row:2:ccn:015001",
            "succeeded",
            "nursing-home-health-deficiencies",
        )
