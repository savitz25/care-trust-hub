"""Load the authoritative Census ZCTA Gazetteer as supporting search geography."""

from __future__ import annotations

import csv
import hashlib
import io
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import psycopg

SOURCE_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip"
SOURCE_VERSION = "2025 Census Gazetteer"
METHODOLOGY = (
    "Census ZCTAs are approximate statistical representations of USPS ZIP Code service areas; "
    "not every USPS ZIP Code has a ZCTA. The representative internal point supports nearby search."
)


def parse_zcta_gazetteer(payload: bytes) -> list[tuple[str, float, float]]:
    with zipfile.ZipFile(io.BytesIO(payload)) as bundle:
        member = next(name for name in bundle.namelist() if name.lower().endswith(".txt"))
        text = io.TextIOWrapper(bundle.open(member), encoding="utf-8-sig")
        rows = list(csv.DictReader(text, delimiter="|"))
    return [
        (row["GEOID"].strip(), float(row["INTPTLAT"].strip()), float(row["INTPTLONG"].strip()))
        for row in rows
    ]


def load_zcta_gazetteer(database_url: str, archive: Path) -> int:
    payload = archive.read_bytes()
    checksum = hashlib.sha256(payload).hexdigest()
    retrieved_at = datetime.now(UTC)
    values = [
        (code, lat, lon, checksum, retrieved_at) for code, lat, lon in parse_zcta_gazetteer(payload)
    ]
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        cursor.executemany(
            """
            INSERT INTO location_reference (
              location_type,location_code,latitude,longitude,location,
              source_organization,source_name,source_version,source_url,
              source_sha256,retrieved_at,methodology_note
            ) VALUES (
              'CENSUS_ZCTA',%s,%s,%s,
              ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography,
              'U.S. Census Bureau','ZIP Code Tabulation Areas Gazetteer',%s,%s,%s,%s,%s
            )
            ON CONFLICT (location_type,location_code,source_version) DO UPDATE SET
              latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,location=EXCLUDED.location,
              source_sha256=EXCLUDED.source_sha256,retrieved_at=EXCLUDED.retrieved_at
            """,
            [
                (
                    code,
                    lat,
                    lon,
                    lon,
                    lat,
                    SOURCE_VERSION,
                    SOURCE_URL,
                    checksum,
                    retrieved_at,
                    METHODOLOGY,
                )
                for code, lat, lon, checksum, retrieved_at in values
            ],
        )
    return len(values)
