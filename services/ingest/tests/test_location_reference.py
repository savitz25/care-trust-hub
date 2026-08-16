import io
import zipfile

from care_ingest.location_reference import parse_zcta_gazetteer


def test_parse_zcta_gazetteer_preserves_leading_zero_and_coordinates():
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr(
            "gazetteer.txt",
            "GEOID|GEOIDFQ|ALAND|AWATER|ALAND_SQMI|AWATER_SQMI|INTPTLAT|INTPTLONG\n"
            "07001|860Z200US07001|1|0|1|0|40.583961|-74.269704\n",
        )
    assert parse_zcta_gazetteer(output.getvalue()) == [("07001", 40.583961, -74.269704)]
