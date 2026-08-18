import io
import zipfile

from care_ingest.state_enforcement import (
    _date,
    parse_california_events,
    parse_new_york_profile,
)


def test_excel_serial_and_iso_dates() -> None:
    assert _date("2026-05-12 00:00:00").isoformat() == "2026-05-12"
    assert _date("7/18/2022").isoformat() == "2022-07-18"
    assert _date("46213") is not None
    assert _date("46213").year == 2026


def test_california_parser_keeps_snf_citations_and_skips_other_types() -> None:
    events = parse_california_events(
        [
            {
                "FACID": "10000102",
                "FAC_TYPE_CODE": "SNF",
                "PENALTY_ISSUE_DATE": "2024-05-12 00:00:00",
                "PENALTY_NUMBER": "CA-1",
                "PENALTY_TYPE": "Citation",
                "PENALTY_DETAIL": "Citation A (HSC 1424)",
                "CLASS_ASSESSED_INITIAL": "A",
                "TOTAL_AMOUNT_DUE_FINAL": "12000",
                "DEATH_RELATED": "N",
            },
            {
                "FACID": "999",
                "FAC_TYPE_CODE": "HOSP",
                "PENALTY_ISSUE_DATE": "2024-05-12 00:00:00",
                "PENALTY_NUMBER": "HOSP-1",
            },
        ]
    )
    assert len(events) == 1
    assert events[0].event_type == "STATE_FINE"
    assert events[0].amount == "$12,000"
    assert events[0].license_id == "10000102"


def test_new_york_profile_links_surveys_and_fines_to_operating_certificate() -> None:
    def csv_bytes(name: str, header: str, *rows: str) -> tuple[str, bytes]:
        body = header + "\n" + "\n".join(rows) + "\n"
        return name, body.encode("utf-8")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(
            *csv_bytes(
                "Facility_Info.csv",
                "FACILITY_ID,CERTIFICATION_NUMBER,FACILITY_NAME",
                "0027,0101305N,Example NH",
            )
        )
        archive.writestr(
            *csv_bytes(
                "Surveys.csv",
                "FACILITY_ID,SURVEY_ID,INITIAL_SURVEY_DATE,SURVEY_TYPE",
                "0027,UYPG,5/12/2026,COMPLAINT",
                "0027,ABCD,3/03/2026,STANDARD",
            )
        )
        archive.writestr(
            *csv_bytes(
                "ENFORCEMENTS.csv",
                "FACILITY_ID,STIP_NUMBER,STIP_DATE,FINE_ASSESSED,"
                "DEFICIENCY CATEGORY,MANUAL_EXCLUDE",
                "27,NH_26_001,7/12/2026,$24500.00,Quality of Care,",
            )
        )
    events = parse_new_york_profile(buffer.getvalue())
    types = {event.event_type for event in events}
    assert types == {"STATE_COMPLAINT_INSPECTION", "STATE_INSPECTION", "STATE_FINE"}
    assert all(event.license_id == "0101305N" for event in events)
    fine = next(event for event in events if event.event_type == "STATE_FINE")
    assert fine.amount == "$24,500"
