# ruff: noqa: E501
from pathlib import Path

from care_ingest.nj_doh_enforcement import (
    IdentityRecord,
    assemble_documents,
    classify_remedy,
    document_fingerprint,
    event_identity,
    extract_pdf_fields,
    inspect_index,
    match_document,
    normalize_pdf_url,
    parse_index_date,
    parse_penalty_amount,
    parse_penalty_index,
    sha256_bytes,
)
from care_ingest.nj_doh_inspection import parse_inspection_html_fixture
from care_ingest.nj_doh_ltc import parse_facility_rows
from care_ingest.state_enforcement import parse_california_events
from care_ingest.state_regulator import load_state_regulator_sources

FIXTURE_DIR = Path(__file__).parent / "fixtures"
INDEX_HTML = (FIXTURE_DIR / "nj_doh_enforcement_index.html").read_text(encoding="utf-8")
LTC_ROWS = __import__("json").loads(
    (FIXTURE_DIR / "nj_doh_ltc_sample.json").read_text(encoding="utf-8")
)


def _identities() -> list[IdentityRecord]:
    parsed, _ = parse_facility_rows(LTC_ROWS["rows"])
    records = [
        IdentityRecord(
            source_facility_id=row.source_facility_id,
            license_number=row.license_number,
            official_name=row.official_name,
            alpha_name=row.alpha_name,
            street=row.street,
            city=row.city,
            county=row.county,
            zip_code=row.zip_code,
            licensed_owner=row.licensed_owner,
            canonical_type=row.facility_type_canonical,
        )
        for row in parsed
    ]
    records.append(
        IdentityRecord(
            source_facility_id="BAY001",
            license_number="NJBAY001",
            official_name="Unique Bay Home",
            alpha_name="Unique Bay Home",
            street="9 Harbor Road",
            city="Toms River",
            county="OCEAN",
            zip_code="08753",
            licensed_owner="Bay Homes LLC",
            canonical_type="NJ_ALR",
        )
    )
    records.append(
        IdentityRecord(
            source_facility_id="HOLD1",
            license_number="NJHOLD1",
            official_name="Holdings Site One",
            alpha_name=None,
            street="1 Corporate Way",
            city="Newark",
            county="ESSEX",
            zip_code="07102",
            licensed_owner="Oceanview Holdings LLC",
            canonical_type="NJ_ALR",
        )
    )
    records.append(
        IdentityRecord(
            source_facility_id="HOLD2",
            license_number="NJHOLD2",
            official_name="Holdings Site Two",
            alpha_name=None,
            street="2 Corporate Way",
            city="Newark",
            county="ESSEX",
            zip_code="07102",
            licensed_owner="Oceanview Holdings LLC",
            canonical_type="NJ_ALR",
        )
    )
    records.append(
        IdentityRecord(
            source_facility_id="CEDAR1",
            license_number="NJCEDAR1",
            official_name="Cedar Ridge SNF",
            alpha_name="Cedar Ridge of Toms River",
            street="3 Cedar Lane",
            city="Toms River",
            county="OCEAN",
            zip_code="08753",
            licensed_owner="Cedar Ridge LLC",
            canonical_type="NJ_NF_SNF",
        )
    )
    return records


OCEANVIEW_TEXT = """
In Re Licensure Violation:
Oceanview Care Center
(NJ Facility ID# SNF001)
TO: Jane Administrator
Oceanview Care Center
100 Main Street
Toms River, New Jersey 08753
The Department is assessing a total penalty of $40,500 pursuant to N.J.S.A. 26:2H-46.1
and N.J.A.C. 8:43E-3.4.
"""

SHORE_TEXT = """
Shore Dementia Home
50 Bay Avenue
Toms River, New Jersey 08753
Notice of Assessment of Penalties
beginning January 1, 2026 through March 1, 2026
"""

BAY_TEXT = """
Unique Bay Home
9 Harbor Road
Toms River, New Jersey 08753
Notice of Conditional License effective May 1, 2026
"""


def test_index_parsing_year_sections_and_dirty_dates() -> None:
    rows, modified = parse_penalty_index(INDEX_HTML)
    assert modified == "09/01/2026"
    assert any(row.year_section == "2026" for row in rows)
    assert any(row.year_section == "2016" for row in rows)
    dirty = [row for row in rows if row.document_date is None]
    assert len(dirty) == 1
    assert dirty[0].date_raw == "4/22/200"
    assert parse_index_date("9/1/2026") == __import__("datetime").date(2026, 9, 1)


def test_pdf_url_normalization() -> None:
    from care_ingest.nj_doh_enforcement import encode_url_path

    relative = normalize_pdf_url("/health/healthfacilities/surveys-insp/ea-x-09012026.pdf")
    assert relative == "https://www.nj.gov/health/healthfacilities/surveys-insp/ea-x-09012026.pdf"
    http = normalize_pdf_url("http://www.nj.gov/health/healthfacilities/surveys-insp/ea-x.pdf")
    assert http == "https://www.nj.gov/health/healthfacilities/surveys-insp/ea-x.pdf"
    spaced = normalize_pdf_url(
        "/health/healthfacilities/surveys-insp/ea-aster-creek%20nursing-1224.pdf "
    )
    assert " " not in spaced
    assert "aster-creek%20nursing" in spaced
    already = encode_url_path("/health/ea%20file.pdf")
    assert already == "/health/ea%20file.pdf"
    assert "%2520" not in already
    with_query = normalize_pdf_url("https://www.nj.gov/health/x.pdf?download=1")
    assert with_query.endswith("x.pdf?download=1")


def test_document_hashing_and_stable_event_id() -> None:
    payload = b"%PDF-1.4 sample"
    digest = sha256_bytes(payload)
    assert len(digest) == 64
    fingerprint = document_fingerprint(
        source_document_id="ea-x-09012026.pdf",
        source_document_url="https://www.nj.gov/health/healthfacilities/surveys-insp/ea-x-09012026.pdf",
        document_date=__import__("datetime").date(2026, 9, 1),
        facility_name="Oceanview Care Center",
        action="Notice of Assessment of Penalties",
        content_sha256=digest,
    )
    again = document_fingerprint(
        source_document_id="ea-x-09012026.pdf",
        source_document_url="https://www.nj.gov/health/healthfacilities/surveys-insp/ea-x-09012026.pdf",
        document_date=__import__("datetime").date(2026, 9, 1),
        facility_name="Oceanview Care Center",
        action="Notice of Assessment of Penalties",
        content_sha256=digest,
    )
    assert fingerprint == again
    event = event_identity(
        "ea-x-09012026.pdf", __import__("datetime").date(2026, 9, 1), fingerprint
    )
    assert event == "ea-x-09012026.pdf|2026-09-01"


def test_duplicate_document_prevention_and_idempotent_second_run() -> None:
    identities = _identities()
    first = assemble_documents(
        parse_penalty_index(INDEX_HTML)[0],
        identities,
        extracted_text={"ea-oceanview-care-center-09012026.pdf": OCEANVIEW_TEXT},
    )
    second = assemble_documents(
        parse_penalty_index(INDEX_HTML)[0],
        identities,
        extracted_text={"ea-oceanview-care-center-09012026.pdf": OCEANVIEW_TEXT},
    )
    ids = [item.source_document_id for item in first]
    assert ids.count("ea-oceanview-care-center-09012026.pdf") == 1
    assert [item.event_identity for item in first] == [item.event_identity for item in second]
    assert [item.document_fingerprint for item in first] == [
        item.document_fingerprint for item in second
    ]


def test_exact_license_and_facid_match() -> None:
    identities = _identities()
    exact_facid = match_document(
        printed_license=None,
        printed_facid="SNF001",
        printed_name="Oceanview Care Center",
        printed_street=None,
        printed_city=None,
        identities=identities,
    )
    assert exact_facid.bucket == "EXACT"
    assert exact_facid.method == "facid"
    exact_license = match_document(
        printed_license="NJ360001",
        printed_facid=None,
        printed_name="Wrong Name",
        printed_street=None,
        printed_city=None,
        identities=identities,
    )
    assert exact_license.bucket == "EXACT"
    assert exact_license.method == "license_number"


def test_name_address_high_confidence_and_name_only_rejection() -> None:
    identities = _identities()
    high = match_document(
        printed_license=None,
        printed_facid=None,
        printed_name="Unique Bay Home",
        printed_street="9 Harbor Road",
        printed_city="Toms River",
        identities=identities,
    )
    assert high.bucket == "HIGH_CONFIDENCE"
    rejected = match_document(
        printed_license=None,
        printed_facid=None,
        printed_name="Shore Dementia Home",
        printed_street=None,
        printed_city=None,
        identities=identities,
    )
    assert rejected.bucket == "UNSAFE_REJECTED"
    assert rejected.method == "name_only"
    suffixed = match_document(
        printed_license=None,
        printed_facid=None,
        printed_name="Manahawkin Health and Rehabilitation Center",
        printed_street=None,
        printed_city=None,
        identities=[
            IdentityRecord(
                source_facility_id="NJ61520",
                license_number="NJ61520",
                official_name="MANAHAWKIN HEALTH AND REHABILITATION CENTER (NJ61520)",
                alpha_name=None,
                street="1211 RT 72 WEST",
                city="MANAHAWKIN",
                county="OCEAN",
                zip_code="08050",
                licensed_owner=None,
                canonical_type="NJ_NF_SNF",
            )
        ],
    )
    assert suffixed.bucket == "UNSAFE_REJECTED"
    assert suffixed.method == "name_only"
    alias = match_document(
        printed_license=None,
        printed_facid=None,
        printed_name="Cedar Ridge of Toms River",
        printed_street=None,
        printed_city=None,
        identities=identities,
    )
    assert alias.bucket == "HIGH_CONFIDENCE"
    assert alias.method == "documented_alias"


def test_multi_facility_campus_is_review_required() -> None:
    identities = _identities()
    campus = match_document(
        printed_license=None,
        printed_facid=None,
        printed_name="Oceanview Care Center",
        printed_street="100 Main Street",
        printed_city="Toms River",
        identities=identities,
    )
    assert campus.bucket == "REVIEW_REQUIRED"
    assert campus.method == "campus_name_address"
    assert campus.candidate_count == 2


def test_owner_company_is_not_attached_to_portfolio() -> None:
    identities = _identities()
    owner = match_document(
        printed_license=None,
        printed_facid=None,
        printed_name="Oceanview Holdings LLC",
        printed_street=None,
        printed_city=None,
        identities=identities,
    )
    assert owner.bucket == "REVIEW_REQUIRED"
    assert owner.method == "owner_company"
    assert owner.facility_id_key is None
    assert owner.candidate_count == 2


def test_penalty_amount_and_curtailment_and_conditional_parsing() -> None:
    assert parse_penalty_amount("assessing a total penalty of $40,500") == 4_050_000
    assert parse_penalty_amount("civil monetary penalty of $199,500") == 19_950_000
    fields = extract_pdf_fields(SHORE_TEXT)
    assert fields["printed_street"] == "50 Bay Avenue"
    assert fields["printed_city"] == "Toms River"
    assert fields["printed_zip"] == "08753"
    assert fields["curtail_start"].isoformat() == "2026-01-01"
    assert fields["curtail_end"].isoformat() == "2026-03-01"
    assert classify_remedy("Notice of Conditional License") == "CONDITIONAL_LICENSE"
    assert classify_remedy("Notice of Curtailment of Admissions") == "ADMISSION_CURTAILMENT"
    assert classify_remedy("Order Lifting Curtailment of Admissions") == "ORDER_LIFTING_CURTAILMENT"


def test_final_versus_unknown_status_preservation() -> None:
    docs = assemble_documents(
        parse_penalty_index(INDEX_HTML)[0],
        _identities(),
        extracted_text={
            "ea-oceanview-care-center-09012026.pdf": OCEANVIEW_TEXT,
            "ea-lifting-03012026.pdf": "Order Lifting Curtailment of Admissions",
        },
    )
    by_id = {item.source_document_id: item for item in docs}
    assert by_id["ea-oceanview-care-center-09012026.pdf"].is_final is None
    assert by_id["ea-oceanview-care-center-09012026.pdf"].status_raw == "unknown"
    assert by_id["ea-lifting-03012026.pdf"].status_raw == "resolved"
    final_fields = extract_pdf_fields("This is a Final Order of the Department.")
    assert final_fields["mentions_final_order"] is True


def test_first_snapshot_baseline_and_assembled_match_buckets() -> None:
    identities = _identities()
    docs = assemble_documents(
        parse_penalty_index(INDEX_HTML)[0],
        identities,
        extracted_text={
            "ea-oceanview-care-center-09012026.pdf": OCEANVIEW_TEXT,
            "ea-shore-dementia-home-08152026.pdf": SHORE_TEXT,
            "ea-unique-bay-05012026.pdf": BAY_TEXT,
        },
    )
    by_id = {item.source_document_id: item for item in docs}
    assert by_id["ea-oceanview-care-center-09012026.pdf"].match.bucket == "EXACT"
    assert by_id["ea-shore-dementia-home-08152026.pdf"].match.bucket == "HIGH_CONFIDENCE"
    assert by_id["ea-unique-bay-05012026.pdf"].conditional_license is True
    assert by_id["ea-unknown-only-name-07012026.pdf"].match.bucket == "UNRESOLVED"
    assert by_id["ea-oceanview-holdings-06152026.pdf"].match.bucket == "REVIEW_REQUIRED"
    census = inspect_index(INDEX_HTML)
    assert census["historical_documents_reachable"] is True
    assert census["duplicate_index_rows"] == 1


def test_inspection_index_fixture_is_facid_exact() -> None:
    html = (FIXTURE_DIR / "nj_doh_inspection_sample.html").read_text(encoding="utf-8")
    rows = parse_inspection_html_fixture(html, "NJ60A000")
    assert [row.survey_id for row in rows] == ["X6JM11", "M1XI11"]
    assert rows[0].survey_url.endswith("fssurvey.aspx?survey-id=X6JM11.pdf&facid=NJ60A000")
    from care_ingest.nj_doh_inspection import inspection_documents

    identities = [
        IdentityRecord(
            source_facility_id="NJ60A000",
            license_number="NJ60A000",
            official_name="Brookdale Florham Park",
            alpha_name=None,
            street="1 Park Place",
            city="Florham Park",
            county="MORRIS",
            zip_code="07932",
            licensed_owner=None,
            canonical_type="NJ_ALR",
        )
    ]
    docs = inspection_documents(rows, identities)
    assert docs[0].match.bucket == "EXACT"
    assert docs[0].document_kind == "inspection_index"
    assert docs[0].evidence_track == "UNKNOWN"


def test_existing_cms_and_florida_behavior_unchanged() -> None:
    events = parse_california_events(
        [
            {
                "FACID": "10000102",
                "FAC_TYPE_CODE": "SNF",
                "PENALTY_ISSUE_DATE": "2024-05-12 00:00:00",
                "PENALTY_NUMBER": "CA-1",
                "PENALTY_TYPE": "Citation",
                "TOTAL_AMOUNT_DUE_FINAL": "12000",
            }
        ]
    )
    assert events[0].event_type == "STATE_FINE"
    sources = load_state_regulator_sources()
    implemented = {source.state_code for source in sources if source.implemented}
    assert implemented == {"CA", "NY", "TX"}
    nj = next(source for source in sources if source.state_code == "NJ")
    assert nj.implemented is False


def test_scope_and_proposed_versus_final() -> None:
    from care_ingest.nj_doh_enforcement import (
        DocumentMatch,
        classify_document_class,
        classify_scope,
        is_proposed_penalty,
    )

    assert classify_document_class("NOTICE_OF_ASSESSMENT_OF_PENALTIES") == "penalty_letter"
    assert classify_document_class("ADMISSION_CURTAILMENT") == "admission_curtailment"
    assert classify_document_class("CONDITIONAL_LICENSE") == "conditional_license"
    assert is_proposed_penalty("Notice of Assessment of Penalties") is True
    assert is_proposed_penalty("Final Order") is False
    exact = DocumentMatch("EXACT", "facid", "x", "NJ1", 1)
    assert (
        classify_scope(
            match=exact,
            facility_name="X",
            canonical="NOTICE_OF_ASSESSMENT_OF_PENALTIES",
            downloaded=True,
        )
        == "NJ_LTC_FACILITY_MATCHED"
    )
    none = DocumentMatch("UNRESOLVED", "no_overlap", "x", None, 0)
    assert (
        classify_scope(
            match=none,
            facility_name="East Orange General Hospital",
            canonical="DIRECTED_PLAN_OF_CORRECTION",
            downloaded=True,
        )
        == "NJ_ACUTE_OR_OTHER_HEALTH_FACILITY"
    )
    assert (
        classify_scope(
            match=none,
            facility_name="Jane Doe",
            canonical="PERSON_OR_PROGRAM_CREDENTIAL",
            downloaded=True,
        )
        == "NON_FACILITY_OR_AGENCY_DOCUMENT"
    )
    assert (
        classify_scope(
            match=none,
            facility_name="X",
            canonical="NOTICE_OF_ASSESSMENT_OF_PENALTIES",
            downloaded=False,
        )
        == "SOURCE_DOCUMENT_UNAVAILABLE"
    )


def test_existing_hashed_pdf_is_skipped(tmp_path: Path) -> None:
    from care_ingest.nj_doh_enforcement import IndexRow
    from care_ingest.nj_doh_enforcement_acquire import acquire_pdfs

    pdf_dir = tmp_path / "pdfs"
    pdf_dir.mkdir()
    (pdf_dir / "ea-x.pdf").write_bytes(b"%PDF-1.4 existing")
    rows = [
        IndexRow(
            year_section="2026",
            date_raw="1/1/2026",
            document_date=__import__("datetime").date(2026, 1, 1),
            facility_name="Example",
            action_raw="Notice of Assessment of Penalties",
            href="/health/healthfacilities/surveys-insp/ea-x.pdf",
            source_document_url="https://www.nj.gov/health/healthfacilities/surveys-insp/ea-x.pdf",
            source_document_id="ea-x.pdf",
        )
    ]
    report = acquire_pdfs(rows, pdf_dir, retry_missing_only=True, pause_seconds=0)
    assert report.skipped_existing == 1
    assert report.attempted == 0
    assert report.records[0].final_acquisition_status == "EXISTING_HASH_VERIFIED"


def test_http_404_remains_in_index(monkeypatch, tmp_path: Path) -> None:
    from care_ingest.nj_doh_enforcement import IndexRow
    from care_ingest.nj_doh_enforcement_acquire import FetchResult, acquire_pdfs

    def boom(url: str, timeout: float = 90) -> FetchResult:
        return FetchResult(
            "HTTP_404_SOURCE_DOCUMENT_UNAVAILABLE",
            http_status=404,
            error_category="http_404",
            error_detail="404",
        )

    monkeypatch.setattr("care_ingest.nj_doh_enforcement_acquire.fetch_pdf", boom)
    rows = [
        IndexRow(
            year_section="2018",
            date_raw="1/1/2018",
            document_date=__import__("datetime").date(2018, 1, 1),
            facility_name="Missing Facility",
            action_raw="Notice of Assessment of Penalties",
            href="/health/missing.pdf",
            source_document_url="https://www.nj.gov/health/missing.pdf",
            source_document_id="missing.pdf",
        )
    ]
    report = acquire_pdfs(rows, tmp_path, retry_missing_only=True, pause_seconds=0)
    assert report.http_404 == 1
    assert report.records[0].source_listed_facility_name == "Missing Facility"
    assert report.records[0].final_acquisition_status == "HTTP_404_SOURCE_DOCUMENT_UNAVAILABLE"


def test_duplicate_content_across_urls_shares_event_identity() -> None:
    identities = _identities()
    rows, _ = parse_penalty_index(INDEX_HTML)
    payload = b"%PDF-1.4 same-bytes"
    docs = assemble_documents(
        rows,
        identities,
        pdf_payloads={
            "ea-oceanview-care-center-09012026.pdf": payload,
            "ea-shore-dementia-home-08152026.pdf": payload,
        },
    )
    hashed = [item for item in docs if item.content_sha256]
    assert len({item.content_sha256 for item in hashed}) == 1
    assert all(item.event_identity.startswith(item.content_sha256 or "") for item in hashed)


def test_non_pdf_and_image_only_extraction() -> None:
    from care_ingest.nj_doh_enforcement import extract_pdf_text

    assert extract_pdf_text(b"<html>not a pdf</html>")[2] == "failed"
    text, pages, status = extract_pdf_text(b"%PDF-1.4\n1 0 obj<<>>endobj\n")
    assert status in {"failed", "corrupt", "no_text_layer", "extracted", "partial"}
