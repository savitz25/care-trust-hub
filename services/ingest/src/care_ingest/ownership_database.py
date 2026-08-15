"""Transactional loader and health audit for CMS ownership evidence."""

from __future__ import annotations

import json
import time
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from .database import _raw_object, _verified_release, iter_normalized_records
from .manifest import ReleaseManifest, sha256_file
from .ownership import OWNERSHIP_TRANSFORMATION_VERSION
from .registry import SourceDefinition

ORGANIZATION_NAMESPACE = uuid.UUID("4ac50a96-b25c-5b12-9ce3-dd54fe0147d3")
PARTY_NAMESPACE = uuid.UUID("ec13a6a9-3b09-579a-939d-a0797853d9d2")


@dataclass(frozen=True, slots=True)
class OwnershipLoadResult:
    dataset_key: str
    release_key: str
    rows_read: int
    rows_loaded: int
    unmatched_providers: int
    organizations: int
    individual_parties: int
    organizational_parties: int
    ingest_run_id: str
    idempotent: bool
    duration_seconds: float

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def _organization(
    cursor: psycopg.Cursor[Any],
    issuer: str,
    identifier_type: str,
    value: str,
    release_id: str,
    locator: str,
) -> str:
    organization_id = str(uuid.uuid5(ORGANIZATION_NAMESPACE, f"{issuer}:{identifier_type}:{value}"))
    cursor.execute(
        "INSERT INTO organization(id) VALUES (%s) ON CONFLICT (id) DO NOTHING",
        (organization_id,),
    )
    cursor.execute(
        """INSERT INTO organization_identifier
        (organization_id, issuer, identifier_type, identifier_value,
         source_release_id, source_record_locator)
        VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
        (organization_id, issuer, identifier_type, value, release_id, locator),
    )
    return organization_id


def _party(
    cursor: psycopg.Cursor[Any],
    kind: str,
    identity: str,
    name: str,
    organization_id: str | None,
) -> str:
    party_id = str(uuid.uuid5(PARTY_NAMESPACE, identity))
    cursor.execute(
        "INSERT INTO ownership_party "
        "(id,party_kind,organization_id,source_identity_key,display_name) "
        "VALUES (%s,%s,%s,%s,%s) ON CONFLICT (source_identity_key) DO UPDATE "
        "SET display_name=EXCLUDED.display_name",
        (party_id, kind, organization_id, identity, name),
    )
    return party_id


def _provider(providers: dict[str, str], ccn: str | None) -> str | None:
    if not ccn:
        return None
    return providers.get(ccn)


def _enrollment_providers(cursor: psycopg.Cursor[Any]) -> dict[str, tuple[str | None, str]]:
    identifiers = cursor.execute(
        "SELECT oi.identifier_value, r.provider_id, r.provider_identifier "
        "FROM organization_identifier oi JOIN ownership_party p "
        "ON p.organization_id=oi.organization_id JOIN provider_ownership_relationship r "
        "ON r.ownership_party_id=p.id WHERE oi.issuer='CMS_PECOS' "
        "AND oi.identifier_type='ENROLLMENT_ID' "
        "AND r.relationship_role_code='ENROLLED_ORGANIZATION'"
    ).fetchall()
    return {
        str(enrollment): (str(provider) if provider else None, str(identifier))
        for enrollment, provider, identifier in identifiers
    }


def load_ownership_source(
    database_url: str,
    source: SourceDefinition,
    manifest: ReleaseManifest,
    source_file: Path,
    normalized_file: Path,
) -> OwnershipLoadResult:
    if sha256_file(source_file) != manifest.sha256:
        raise ValueError("source bytes do not match immutable ownership manifest")
    records = list(iter_normalized_records(normalized_file))
    started = time.perf_counter()
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        release_id, _ = _verified_release(cursor, source, manifest)
        raw_object_id = _raw_object(cursor, release_id, manifest)
        prior = cursor.execute(
            "SELECT id,report FROM ingest_run WHERE source_release_id=%s "
            "AND transformation_version=%s AND status='succeeded'",
            (release_id, OWNERSHIP_TRANSFORMATION_VERSION),
        ).fetchone()
        if prior:
            report = prior[1]
            return OwnershipLoadResult(
                source.dataset_key,
                manifest.source_release_date or manifest.sha256,
                report["rows_read"],
                report["rows_loaded"],
                report["unmatched_providers"],
                report["organizations"],
                report["individual_parties"],
                report["organizational_parties"],
                str(prior[0]),
                True,
                time.perf_counter() - started,
            )
        run_id = str(
            cursor.execute(
                """INSERT INTO ingest_run
                (source_release_id, transformation_version, status, started_at)
                VALUES (%s,%s,'running',now()) RETURNING id""",
                (release_id, OWNERSHIP_TRANSFORMATION_VERSION),
            ).fetchone()[0]
        )
        providers = {
            str(ccn): str(provider_id)
            for ccn, provider_id in cursor.execute(
                "SELECT identifier_value,provider_id FROM provider_identifier "
                "WHERE issuer='CMS' AND identifier_type='CCN' AND valid_from IS NULL"
            ).fetchall()
        }
        enrollment_providers = _enrollment_providers(cursor)
        unmatched = individuals = organizational = loaded = 0
        with connection.pipeline():
            for record in records:
                locator = record["source_record_locator"]
                kind = record["record_kind"]
                if kind == "enrollment":
                    org_id = _organization(
                        cursor,
                        "CMS_PECOS",
                        "PAC_ID",
                        record["organization_pac_id"],
                        release_id,
                        locator,
                    )
                    cursor.execute(
                        """INSERT INTO organization_identifier
                    (organization_id, issuer, identifier_type, identifier_value,
                     source_release_id, source_record_locator)
                    VALUES (%s,'CMS_PECOS','ENROLLMENT_ID',%s,%s,%s)
                    ON CONFLICT DO NOTHING""",
                        (org_id, record["enrollment_id"], release_id, locator),
                    )
                    if record.get("npi"):
                        cursor.execute(
                            """INSERT INTO organization_identifier
                        (organization_id, issuer, identifier_type, identifier_value,
                         source_release_id, source_record_locator)
                        VALUES (%s,'NPPES','NPI',%s,%s,%s) ON CONFLICT DO NOTHING""",
                            (org_id, record["npi"], release_id, locator),
                        )
                    party_id = _party(
                        cursor,
                        "organization",
                        f"CMS_PECOS:PAC:{record['organization_pac_id']}",
                        record["organization_name"],
                        org_id,
                    )
                    ccn = record["ccn"]
                    provider_id = _provider(providers, ccn)
                    organizational += 1
                    if provider_id is None:
                        unmatched += 1
                    cursor.execute(
                        """INSERT INTO provider_ownership_relationship
                    (provider_id, provider_identifier, ownership_party_id, source_release_id,
                     raw_object_id, ingest_run_id, relationship_key, relationship_role_code,
                     relationship_role_text, association_date, ownership_percentage,
                     classifications, source_record_locator, raw_record, transformation_version)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT DO NOTHING""",
                        (
                            provider_id,
                            ccn,
                            party_id,
                            release_id,
                            raw_object_id,
                            run_id,
                            record["record_key"],
                            record["role_code"],
                            record["role_text"],
                            None,
                            None,
                            Jsonb(record["classifications"]),
                            locator,
                            Jsonb(record["raw_record"]),
                            OWNERSHIP_TRANSFORMATION_VERSION,
                        ),
                    )
                elif kind == "owner":
                    provider_id, ccn = (
                        (_provider(providers, record.get("ccn")), record.get("ccn"))
                        if record.get("ccn")
                        else enrollment_providers.get(
                            record["enrollment_id"], (None, record["enrollment_id"])
                        )
                    )
                    if provider_id is None:
                        unmatched += 1
                    party_kind = record["party_kind"]
                    pac = record.get("party_pac_id")
                    if party_kind == "organization":
                        identity_value = pac or f"{release_id}:{locator}"
                        org_id = _organization(
                            cursor,
                            "CMS_PECOS" if pac else "CMS_PROVIDER_DATA",
                            "PAC_ID" if pac else "SOURCE_RECORD",
                            identity_value,
                            release_id,
                            locator,
                        )
                        identity = (
                            f"CMS_PECOS:PAC:{pac}"
                            if pac
                            else f"CMS_PROVIDER_DATA:{release_id}:{locator}"
                        )
                        organizational += 1
                    else:
                        org_id = None
                        identity = (
                            f"CMS_PECOS:PERSON:{pac}"
                            if pac
                            else f"CMS_PROVIDER_DATA:PERSON:{release_id}:{locator}"
                        )
                        individuals += 1
                    party_id = _party(cursor, party_kind, identity, record["party_name"], org_id)
                    cursor.execute(
                        """INSERT INTO provider_ownership_relationship
                    (provider_id, provider_identifier, ownership_party_id, source_release_id,
                     raw_object_id, ingest_run_id, relationship_key, relationship_role_code,
                     relationship_role_text, association_date, ownership_percentage,
                     classifications, source_record_locator, raw_record, transformation_version)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT DO NOTHING""",
                        (
                            provider_id,
                            ccn or record.get("enrollment_id"),
                            party_id,
                            release_id,
                            raw_object_id,
                            run_id,
                            record["record_key"],
                            record.get("role_code"),
                            record["role_text"],
                            record.get("association_date"),
                            record.get("ownership_percentage"),
                            Jsonb(record["classifications"]),
                            locator,
                            Jsonb(record["raw_record"]),
                            OWNERSHIP_TRANSFORMATION_VERSION,
                        ),
                    )
                elif kind == "change":
                    buyer = _organization(
                        cursor, "CMS_PECOS", "PAC_ID", record["buyer_pac_id"], release_id, locator
                    )
                    seller = _organization(
                        cursor, "CMS_PECOS", "PAC_ID", record["seller_pac_id"], release_id, locator
                    )
                    for organization_id, enrollment_id in (
                        (buyer, record.get("buyer_enrollment_id")),
                        (seller, record.get("seller_enrollment_id")),
                    ):
                        if enrollment_id:
                            cursor.execute(
                                """INSERT INTO organization_identifier
                                (organization_id, issuer, identifier_type, identifier_value,
                                 source_release_id, source_record_locator)
                                VALUES (%s,'CMS_PECOS','ENROLLMENT_ID',%s,%s,%s)
                                ON CONFLICT DO NOTHING""",
                                (organization_id, enrollment_id, release_id, locator),
                            )
                    ccn = record["ccn"]
                    provider_id = _provider(providers, ccn)
                    if provider_id is None:
                        unmatched += 1
                    cursor.execute(
                        """INSERT INTO ownership_change_event
                    (provider_id, provider_identifier, buyer_organization_id,
                     seller_organization_id, source_release_id, raw_object_id, ingest_run_id,
                     event_key, change_type_code, change_type_text, effective_date,
                     source_record_locator, raw_record, transformation_version)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT DO NOTHING""",
                        (
                            provider_id,
                            ccn,
                            buyer,
                            seller,
                            release_id,
                            raw_object_id,
                            run_id,
                            record["record_key"],
                            record["change_type_code"],
                            record["change_type_text"],
                            record["effective_date"],
                            locator,
                            Jsonb(record["raw_record"]),
                            OWNERSHIP_TRANSFORMATION_VERSION,
                        ),
                    )
                elif kind == "unavailable":
                    ccn = record["ccn"]
                    provider_id = _provider(providers, ccn)
                    if provider_id is None:
                        unmatched += 1
                    cursor.execute(
                        """INSERT INTO ownership_source_notice
                    (provider_id, provider_identifier, notice_text, source_release_id,
                     raw_object_id, ingest_run_id, notice_key, source_record_locator,
                     raw_record, transformation_version)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                        (
                            provider_id,
                            ccn,
                            record["notice_text"],
                            release_id,
                            raw_object_id,
                            run_id,
                            record["record_key"],
                            locator,
                            Jsonb(record["raw_record"]),
                            OWNERSHIP_TRANSFORMATION_VERSION,
                        ),
                    )
                loaded += 1
        organizations = cursor.execute("SELECT count(*) FROM organization").fetchone()[0]
        report = {
            "rows_read": len(records),
            "rows_loaded": loaded,
            "unmatched_providers": unmatched,
            "organizations": organizations,
            "individual_parties": individuals,
            "organizational_parties": organizational,
        }
        cursor.execute(
            """UPDATE ingest_run SET status='succeeded', completed_at=now(),
            rows_read=%s, valid_rows=%s, report=%s WHERE id=%s""",
            (len(records), loaded, Jsonb(report), run_id),
        )
    return OwnershipLoadResult(
        source.dataset_key,
        manifest.source_release_date or manifest.sha256,
        len(records),
        loaded,
        unmatched,
        organizations,
        individuals,
        organizational,
        run_id,
        False,
        time.perf_counter() - started,
    )


def audit_ownership_database(database_url: str) -> dict[str, int]:
    with psycopg.connect(database_url) as connection:
        row = connection.execute(
            "SELECT (SELECT count(*) FROM organization),"
            "(SELECT count(*) FROM organization_identifier),"
            "(SELECT count(*) FROM ownership_party WHERE party_kind='individual'),"
            "(SELECT count(*) FROM ownership_party WHERE party_kind='organization'),"
            "(SELECT count(*) FROM provider_ownership_relationship),"
            "(SELECT count(*) FROM provider_ownership_relationship WHERE provider_id IS NULL),"
            "(SELECT count(*) FROM organization_relationship),"
            "(SELECT count(*) FROM ownership_change_event),"
            "(SELECT count(*) FROM ownership_change_event WHERE provider_id IS NULL),"
            "(SELECT count(*) FROM ingest_run WHERE status='running')"
        ).fetchone()
    return dict(
        zip(
            (
                "organizations",
                "organization_identifiers",
                "individual_parties",
                "organizational_parties",
                "provider_relationships",
                "unmatched_provider_relationships",
                "organization_relationships",
                "ownership_changes",
                "unmatched_ownership_changes",
                "running_ingests",
            ),
            row,
            strict=True,
        )
    )
