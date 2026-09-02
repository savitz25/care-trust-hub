import json
from pathlib import Path

from care_ingest.nj_doh_ltc import (
    ADAPTER_VERSION,
    TYPE_MAP,
    CanonicalCmsFacility,
    excel_serial_date,
    identity_state_for,
    map_facility_type,
    match_cms,
    normalize_address,
    normalize_license_number,
    parse_facility_rows,
    parse_xlsx,
)
from care_ingest.state_regulator import load_state_regulator_sources

FIXTURE = json.loads(
    Path(__file__).parent.joinpath("fixtures/nj_doh_ltc_sample.json").read_text(encoding="utf-8")
)


def _cms() -> CanonicalCmsFacility:
    return CanonicalCmsFacility(
        cms_ccn="315001",
        name="Oceanview Care Center",
        address="100 Main Street",
        city="Toms River",
        state="NJ",
        zip_code="08753",
        phone="7325550100",
    )


def test_every_observed_official_type_is_mapped_and_unknown_is_quarantined() -> None:
    assert "ASSISTED LIVING RESIDENCE" in TYPE_MAP
    assert TYPE_MAP["ASSISTED LIVING RESIDENCE"][0] == "NJ_ALR"
    assert TYPE_MAP["ASSISTED LIVING RESIDENCE"][1] is False
    assert TYPE_MAP["LONG TERM CARE FACILITY SNF/NF"][1] is True
    assert TYPE_MAP["RESIDENTIAL DEMENTIA CARE HOME"][0] == "NJ_RDCH"
    assert "official njdoh" in TYPE_MAP["RESIDENTIAL DEMENTIA CARE HOME"][2].lower()
    assert map_facility_type("MADE UP MEMORY CARE LICENSE") is None
    parsed, quarantined = parse_facility_rows(FIXTURE["rows"])
    assert {row.source_facility_id for row in parsed} == {"SNF001", "ALR001", "RDCH01"}
    assert len(quarantined) == 1
    assert quarantined[0]["FACILITY_TYPE"] == "MADE UP MEMORY CARE LICENSE"


def test_license_and_address_normalization() -> None:
    assert normalize_license_number(" nj-360-001 ") == "NJ360001"
    assert normalize_address("100 Main Street\nToms River, NJ 08753") == "100 main"
    assert excel_serial_date("46265").isoformat() == "2026-08-31"
    assert excel_serial_date("46477").isoformat() == "2027-03-31"


def test_exact_ccn_and_high_confidence_name_address() -> None:
    parsed, _ = parse_facility_rows(FIXTURE["rows"])
    snf = next(row for row in parsed if row.facility_type_canonical == "NJ_NF_SNF")
    exact_row = parsed[0]
    exact_raw = dict(exact_row.raw)
    exact_raw["CCN"] = "315001"
    from dataclasses import replace

    with_ccn = replace(snf, raw=exact_raw)
    exact = match_cms(with_ccn, [_cms()])
    assert exact.bucket == "EXACT"
    high = match_cms(snf, [_cms()])
    assert high.bucket == "HIGH_CONFIDENCE"
    assert high.cms_ccn == "315001"


def test_name_only_is_rejected_and_alr_does_not_inherit_cms() -> None:
    parsed, _ = parse_facility_rows(FIXTURE["rows"])
    snf = next(row for row in parsed if row.facility_type_canonical == "NJ_NF_SNF")
    from dataclasses import replace

    nameless = replace(snf, street=None, phone=None, city="Toms River")
    rejected = match_cms(nameless, [_cms()])
    assert rejected.bucket == "UNSAFE_REJECTED"
    alr = next(row for row in parsed if row.facility_type_canonical == "NJ_ALR")
    alr_match = match_cms(alr, [_cms()])
    assert alr_match.bucket == "UNRESOLVED"
    assert alr_match.method == "non_cms_class"


def test_owner_and_administrator_roles_are_preserved() -> None:
    parsed, _ = parse_facility_rows(FIXTURE["rows"])
    snf = next(row for row in parsed if row.source_facility_id == "SNF001")
    assert snf.licensed_owner == "Oceanview Care Center LLC"
    assert snf.administrator == "Jane Administrator"
    assert snf.licensed_owner != snf.administrator


def test_duplicate_source_ids_and_fingerprints_are_stable() -> None:
    parsed, _ = parse_facility_rows(FIXTURE["rows"][:1] + FIXTURE["rows"][:1])
    assert len({row.source_facility_id for row in parsed}) == 1
    first, _quarantine = parse_facility_rows(FIXTURE["rows"][:1])
    second, _ = parse_facility_rows(FIXTURE["rows"][:1])
    assert first[0].record_fingerprint == second[0].record_fingerprint
    assert len(first[0].record_fingerprint) == 64


def test_baseline_identity_state_and_no_cms_on_dementia_home() -> None:
    parsed, _ = parse_facility_rows(FIXTURE["rows"])
    rdch = next(row for row in parsed if row.facility_type_canonical == "NJ_RDCH")
    match = match_cms(rdch, [_cms()])
    assert match.bucket == "UNRESOLVED"
    assert identity_state_for(match) == "UNRESOLVED"
    assert rdch.cms_nursing_eligible is False


def test_ca_ny_tx_remain_the_only_implemented_ingest_state_adapters() -> None:
    sources = load_state_regulator_sources()
    implemented = {source.state_code for source in sources if source.implemented}
    assert implemented == {"CA", "NY", "TX"}
    nj = next(source for source in sources if source.state_code == "NJ")
    assert "All_LTC.xlsx" in nj.download_or_api_url
    assert nj.implemented is False


def test_florida_state_table_contract_is_unchanged() -> None:
    sql = (
        Path(__file__).resolve().parents[3]
        / "db"
        / "migrations"
        / "0028_florida_state_licensed_provider.sql"
    ).read_text(encoding="utf-8")
    assert "CHECK (state_code = 'FL')" in sql
    assert "CHECK (regulator_code = 'FL_AHCA')" in sql
    assert "NJ_DOH" not in sql
    assert "MEMORY_CARE" not in sql


def test_real_workbook_schema_when_archived_locally() -> None:
    path = Path(__file__).resolve().parents[3] / "data" / "raw" / "nj-doh-ltc" / "All_LTC.xlsx"
    if not path.is_file():
        return
    headers, rows, sheets = parse_xlsx(path.read_bytes())
    assert sheets == ["All_LTC"]
    assert "FACILITY_TYPE" in headers
    parsed, quarantined = parse_facility_rows(rows)
    assert len(rows) == 893
    assert len(parsed) == 893
    assert quarantined == []
    assert "NJ_ALR" in {row.facility_type_canonical for row in parsed}
    assert "NJ_NF_SNF" in {row.facility_type_canonical for row in parsed}
