from pathlib import Path

from care_ingest.quality import provider_information_quality


def test_quality_report_counts_missingness_and_ccn_shapes(tmp_path: Path) -> None:
    normalized = tmp_path / "providers.jsonl"
    normalized.write_text(
        '{"provider_identity":{"value":"015001"},"normalized":{"state":"AL",'
        '"address":null,"city":"X","zip_code":"35005","county":null,'
        '"telephone":null,"ownership_type":"Non profit","certified_beds":80,'
        '"latitude":null,"longitude":null,"ratings":{"overall":4,'
        '"health_inspection":null,"staffing":3,"quality_measure":5}}}\n'
        '{"provider_identity":{"value":"37E109"},"normalized":{"state":"TX",'
        '"address":"1 X","city":"Y","zip_code":"75001","county":"Z",'
        '"telephone":"555","ownership_type":null,"certified_beds":null,'
        '"latitude":30.0,"longitude":-97.0,"ratings":{"overall":null,'
        '"health_inspection":2,"staffing":null,"quality_measure":null}}}\n',
        encoding="utf-8",
    )
    report = provider_information_quality(normalized)
    assert report["total_providers"] == 2
    assert report["state_territory_count"] == 2
    assert report["ccn_shape_distribution"] == {"alphanumeric": 1, "numeric": 1}
    assert report["missing_fields"]["telephone"] == 1
    assert report["overall_rating_distribution"] == {"4": 1, "missing": 1}
