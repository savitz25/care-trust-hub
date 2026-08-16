"""Transactional loading for CMS chain snapshots and membership."""
# ruff: noqa: E501

from __future__ import annotations

import csv
import json
import time
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

from .chain import CHAIN_VERSION
from .database import _raw_object, _verified_release, iter_normalized_records
from .manifest import ReleaseManifest, sha256_file
from .registry import SourceDefinition

CHAIN_NS = uuid.UUID("9849ce1e-06cd-5d07-8b53-3b38188dfa69")


@dataclass(frozen=True, slots=True)
class ChainLoadResult:
    dataset_key: str
    release_key: str
    rows_read: int
    rows_loaded: int
    chains: int
    memberships: int
    matched_providers: int
    unmatched_memberships: int
    ingest_run_id: str
    idempotent: bool
    duration_seconds: float

    def to_json(self):
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def chain_uuid(value: str) -> str:
    return str(uuid.uuid5(CHAIN_NS, f"CMS_CHAIN:{value}"))


def load_chain_source(
    database_url: str,
    source: SourceDefinition,
    manifest: ReleaseManifest,
    source_file: Path,
    normalized_file: Path,
) -> ChainLoadResult:
    if sha256_file(source_file) != manifest.sha256:
        raise ValueError("chain source checksum mismatch")
    records = list(iter_normalized_records(normalized_file))
    started = time.perf_counter()
    with psycopg.connect(database_url) as con, con.cursor() as cur:
        release_id, _ = _verified_release(cur, source, manifest)
        raw_id = _raw_object(cur, release_id, manifest)
        prior = cur.execute(
            "SELECT id,report FROM ingest_run WHERE source_release_id=%s AND transformation_version=%s AND status='succeeded'",
            (release_id, CHAIN_VERSION),
        ).fetchone()
        if prior:
            r = prior[1]
            return ChainLoadResult(
                source.dataset_key,
                manifest.source_release_date or manifest.sha256,
                r["rows"],
                r["rows"],
                r["chains"],
                0,
                0,
                0,
                str(prior[0]),
                True,
                time.perf_counter() - started,
            )
        run = str(
            cur.execute(
                "INSERT INTO ingest_run(source_release_id,transformation_version,status,started_at) VALUES(%s,%s,'running',now()) RETURNING id",
                (release_id, CHAIN_VERSION),
            ).fetchone()[0]
        )
        with con.pipeline():
            for record in records:
                cid = chain_uuid(record["chain_id"])
                cur.execute(
                    "INSERT INTO cms_chain(id,cms_chain_id) VALUES(%s,%s) ON CONFLICT DO NOTHING",
                    (cid, record["chain_id"]),
                )
                cur.execute(
                    """INSERT INTO cms_chain_performance_snapshot(chain_id,source_release_id,raw_object_id,ingest_run_id,release_month,chain_name,published_facility_count,published_state_count,metrics,source_record_locator,raw_record,transformation_version) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                    (
                        cid,
                        release_id,
                        raw_id,
                        run,
                        record["release_month"],
                        record["chain_name"],
                        record["published_facility_count"],
                        record["published_state_count"],
                        Jsonb(record["metrics"]),
                        record["source_record_locator"],
                        Jsonb(record["raw_record"]),
                        CHAIN_VERSION,
                    ),
                )
        report = {"rows": len(records), "chains": len({r["chain_id"] for r in records})}
        cur.execute(
            "UPDATE ingest_run SET status='succeeded',completed_at=now(),rows_read=%s,valid_rows=%s,report=%s WHERE id=%s",
            (len(records), len(records), Jsonb(report), run),
        )
    return ChainLoadResult(
        source.dataset_key,
        manifest.source_release_date or manifest.sha256,
        len(records),
        len(records),
        report["chains"],
        0,
        0,
        0,
        run,
        False,
        time.perf_counter() - started,
    )


def load_chain_membership(
    database_url: str, source: SourceDefinition, manifest: ReleaseManifest, source_file: Path
) -> ChainLoadResult:
    started = time.perf_counter()
    version = "cms-chain-membership-v1"
    with psycopg.connect(database_url) as con, con.cursor() as cur:
        release_id, _ = _verified_release(cur, source, manifest)
        raw_id = _raw_object(cur, release_id, manifest)
        prior = cur.execute(
            "SELECT id,report FROM ingest_run WHERE source_release_id=%s AND transformation_version=%s AND status='succeeded'",
            (release_id, version),
        ).fetchone()
        if prior:
            r = prior[1]
            return ChainLoadResult(
                source.dataset_key,
                manifest.source_release_date or manifest.sha256,
                r["rows"],
                r["rows"],
                r["chains"],
                r["memberships"],
                r["matched"],
                r["unmatched"],
                str(prior[0]),
                True,
                time.perf_counter() - started,
            )
        run = str(
            cur.execute(
                "INSERT INTO ingest_run(source_release_id,transformation_version,status,started_at) VALUES(%s,%s,'running',now()) RETURNING id",
                (release_id, version),
            ).fetchone()[0]
        )
        providers = dict(
            cur.execute(
                "SELECT identifier_value,provider_id FROM provider_identifier WHERE issuer='CMS' AND identifier_type='CCN' AND valid_from IS NULL"
            ).fetchall()
        )
        orgs = dict(
            cur.execute(
                "SELECT identifier_value,organization_id FROM organization_identifier WHERE issuer='CMS_PECOS' AND identifier_type='PAC_ID'"
            ).fetchall()
        )
        n = matched = unmatched = 0
        chains = set()
        with source_file.open("r", encoding="utf-8-sig", newline="") as handle, con.pipeline():
            for line, row in enumerate(csv.DictReader(handle), start=2):
                chain_id = (row.get("AFFILIATION ENTITY ID") or "").strip()
                chain_name = (row.get("AFFILIATION ENTITY NAME") or "").strip()
                ccn = (row.get("CCN") or "").strip().upper()
                enrollment = (row.get("ENROLLMENT ID") or "").strip()
                if not chain_id:
                    continue
                if not chain_name or not ccn or not enrollment:
                    raise ValueError(f"invalid chain membership row {line}")
                cid = chain_uuid(chain_id)
                chains.add(chain_id)
                provider = providers.get(ccn)
                matched += provider is not None
                unmatched += provider is None
                n += 1
                cur.execute(
                    "INSERT INTO cms_chain(id,cms_chain_id) VALUES(%s,%s) ON CONFLICT DO NOTHING",
                    (cid, chain_id),
                )
                cur.execute(
                    """INSERT INTO cms_chain_provider(chain_id,provider_id,provider_identifier,enrollment_id,source_release_id,raw_object_id,ingest_run_id,chain_name,source_record_locator,raw_record,transformation_version) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                    (
                        cid,
                        provider,
                        ccn,
                        enrollment,
                        release_id,
                        raw_id,
                        run,
                        chain_name,
                        f"csv-row:{line}",
                        Jsonb(row),
                        version,
                    ),
                )
                org = orgs.get((row.get("ASSOCIATE ID") or "").strip())
                if org:
                    cur.execute(
                        "INSERT INTO cms_chain_organization(chain_id,organization_id,source_release_id,source_record_locator,relationship_role) VALUES(%s,%s,%s,%s,'CMS-enrolled organization participating in chain') ON CONFLICT DO NOTHING",
                        (cid, org, release_id, f"csv-row:{line}"),
                    )
        report = {
            "rows": n,
            "chains": len(chains),
            "memberships": n,
            "matched": matched,
            "unmatched": unmatched,
        }
        cur.execute(
            "UPDATE ingest_run SET status='succeeded',completed_at=now(),rows_read=%s,valid_rows=%s,report=%s WHERE id=%s",
            (n, n, Jsonb(report), run),
        )
    return ChainLoadResult(
        source.dataset_key,
        manifest.source_release_date or manifest.sha256,
        n,
        n,
        len(chains),
        n,
        matched,
        unmatched,
        run,
        False,
        time.perf_counter() - started,
    )
