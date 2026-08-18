"""Cheap 015B QA, conflict, integrity, and Google-overlap metrics."""

from __future__ import annotations

import json
import random
import re
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services" / "ingest" / "src"))


def load_env() -> None:
    import os

    for relative in (".env.local", "apps/web/.env.local", "services/ingest/.env.local"):
        path = ROOT / relative
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key, value.strip().strip("'\""))


def norm_name(value: str | None) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", " ", (value or "").lower())
    cleaned = re.sub(r"\b(llc|inc|corp|co|ltd|the)\b", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def norm_addr(value: str | None) -> str:
    cleaned = re.sub(r"\.", "", (value or "").lower())
    cleaned = re.sub(
        r"\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln)\b",
        " ",
        cleaned,
    )
    return re.sub(r"[^a-z0-9]+", " ", cleaned).strip()


def digits(value: str | None) -> str:
    return re.sub(r"\D", "", value or "")[-10:]


def main() -> None:
    load_env()
    import os

    url = os.environ.get("CARE_DATABASE_URL")
    if not url:
        raise SystemExit("CARE_DATABASE_URL is required")
    rng = random.Random(15)
    report: dict = {}
    with psycopg.connect(url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT count(DISTINCT provider_id), count(DISTINCT identifier_value)
                FROM provider_identifier
                WHERE issuer='CMS' AND identifier_type='CCN' AND valid_to IS NULL
                """
            )
            facilities, ccns = cursor.fetchone()
            cursor.execute(
                """
                SELECT count(*) FILTER (WHERE publication_eligible AND claim_type LIKE 'STATE_%'),
                       count(*) FILTER (WHERE claim_type LIKE 'STATE_%')
                FROM facility_claim
                """
            )
            public_claims, state_claims = cursor.fetchone()
            cursor.execute("SELECT count(*) FROM facility_claim WHERE claim_type LIKE 'google_%'")
            google_claims = cursor.fetchone()[0]
            report["integrity"] = {
                "facilities": facilities,
                "unique_ccns": ccns,
                "public_state_claims": public_claims,
                "state_claims": state_claims,
                "google_claims": google_claims,
            }

            for state, source in (
                ("CA", "ca-cdph-healthcare-facility-locations"),
                ("NY", "ny-doh-hfis-general-information"),
                ("TX", "tx-hhsc-nursing-facility-directory"),
            ):
                cursor.execute(
                    """
                    SELECT c.provider_id, c.resolution_state::text, c.resolution_reason,
                           fs.provider_name, fs.address, fs.telephone, fs.certified_beds,
                           (SELECT observed_value #>> '{}' FROM facility_source_observation o
                             WHERE o.provider_id=c.provider_id AND o.source_type=%s
                               AND o.observation_type='STATE_LICENSE_ID' LIMIT 1),
                           (SELECT observed_address FROM facility_source_observation o
                             WHERE o.provider_id=c.provider_id AND o.source_type=%s
                               AND o.observation_type='STATE_ADDRESS' LIMIT 1),
                           (SELECT observed_value #>> '{}' FROM facility_source_observation o
                             WHERE o.provider_id=c.provider_id AND o.source_type=%s
                               AND o.observation_type='STATE_PHONE' LIMIT 1),
                           (SELECT observed_value #>> '{}' FROM facility_source_observation o
                             WHERE o.provider_id=c.provider_id AND o.source_type=%s
                               AND o.observation_type='STATE_LICENSE_CAPACITY' LIMIT 1)
                    FROM facility_claim c
                    JOIN facility_snapshot fs ON fs.provider_id=c.provider_id
                    JOIN ingest_run ir ON ir.id=fs.ingest_run_id AND ir.status='succeeded'
                    WHERE c.claim_type='STATE_LICENSE_ID' AND c.resolver_reference LIKE %s
                    """,
                    (source, source, source, source, f"%{source.split('-')[0]}-%"),
                )
                # Simpler: get verified license claims joined to latest snapshot
            cursor.execute(
                """
                SELECT DISTINCT ON (c.provider_id)
                  c.provider_id, left(c.resolver_reference, 40), c.resolution_state::text,
                  fs.provider_name, fs.address, fs.telephone, fs.certified_beds, fs.state_code
                FROM facility_claim c
                JOIN LATERAL (
                  SELECT provider_name, address, telephone, certified_beds, state_code
                  FROM facility_snapshot s
                  JOIN ingest_run ir ON ir.id=s.ingest_run_id AND ir.status='succeeded'
                  WHERE s.provider_id=c.provider_id
                  ORDER BY ir.completed_at DESC LIMIT 1
                ) fs ON true
                WHERE c.claim_type='STATE_LICENSE_ID' AND c.resolution_state='VERIFIED'
                  AND fs.state_code=%s
                """,
                ("CA",),
            )

        qa = {}
        with connection.cursor() as cursor:
            for state in ("CA", "NY", "TX"):
                cursor.execute(
                    """
                    SELECT c.provider_id, fs.provider_name, fs.address, fs.telephone,
                           fs.certified_beds,
                           addr.observed_address, phone.observed_value #>> '{}',
                           cap.observed_value #>> '{}', nam.observed_name
                    FROM facility_claim c
                    JOIN LATERAL (
                      SELECT provider_name, address, telephone, certified_beds
                      FROM facility_snapshot s
                      JOIN ingest_run ir ON ir.id=s.ingest_run_id AND ir.status='succeeded'
                      WHERE s.provider_id=c.provider_id
                      ORDER BY ir.completed_at DESC LIMIT 1
                    ) fs ON true
                    LEFT JOIN LATERAL (
                      SELECT observed_address FROM facility_source_observation o
                      WHERE o.provider_id=c.provider_id AND o.observation_type='STATE_ADDRESS'
                      ORDER BY o.created_at DESC LIMIT 1
                    ) addr ON true
                    LEFT JOIN LATERAL (
                      SELECT observed_value FROM facility_source_observation o
                      WHERE o.provider_id=c.provider_id AND o.observation_type='STATE_PHONE'
                      ORDER BY o.created_at DESC LIMIT 1
                    ) phone ON true
                    LEFT JOIN LATERAL (
                      SELECT observed_value FROM facility_source_observation o
                      WHERE o.provider_id=c.provider_id AND o.observation_type='STATE_LICENSE_CAPACITY'
                      ORDER BY o.created_at DESC LIMIT 1
                    ) cap ON true
                    LEFT JOIN LATERAL (
                      SELECT observed_name FROM facility_source_observation o
                      WHERE o.provider_id=c.provider_id AND o.source_type LIKE %s
                      ORDER BY o.created_at DESC LIMIT 1
                    ) nam ON true
                    WHERE c.claim_type='STATE_LICENSE_ID' AND c.resolution_state='VERIFIED'
                      AND c.resolver_reference LIKE %s
                    """,
                    (
                        f"%{ {'CA':'ca','NY':'ny','TX':'tx'}[state] }%",
                        f"%{ {'CA':'ca','NY':'ny','TX':'tx'}[state] }-%",
                    ),
                )
                rows = cursor.fetchall()
                sample_n = {"CA": 30, "NY": 50, "TX": 40}[state]
                sample = rows if len(rows) <= sample_n else rng.sample(rows, sample_n)
                failures = []
                name_diff = addr_diff = phone_diff = cap_diff = 0
                for row in rows:
                    cms_name, cms_addr, cms_phone, cms_beds = row[1], row[2], row[3], row[4]
                    st_addr, st_phone, st_cap, st_name = row[5], row[6], row[7], row[8]
                    if st_name and cms_name and norm_name(st_name) != norm_name(cms_name):
                        name_diff += 1
                    if st_addr and cms_addr and norm_addr(st_addr) != norm_addr(cms_addr):
                        addr_diff += 1
                    if st_phone and cms_phone and digits(st_phone) != digits(cms_phone):
                        if digits(st_phone) and digits(cms_phone):
                            phone_diff += 1
                    if st_cap and cms_beds is not None and str(cms_beds) != str(st_cap).split(".")[0]:
                        cap_diff += 1
                for row in sample:
                    cms_addr, st_addr = row[2], row[5]
                    cms_name, st_name = row[1], row[8]
                    # Critical wrong-facility: verified but neither name nor address agrees
                    name_ok = not st_name or norm_name(st_name) == norm_name(cms_name)
                    addr_ok = not st_addr or norm_addr(st_addr) == norm_addr(cms_addr)
                    if not name_ok and not addr_ok:
                        failures.append({"cms": cms_name, "state": st_name, "cms_addr": cms_addr})
                qa[state] = {
                    "verified_links": len(rows),
                    "audited": len(sample),
                    "audit_failures": len(failures),
                    "critical_wrong_facility": len(failures),
                    "name_differences": name_diff,
                    "address_differences": addr_diff,
                    "phone_differences": phone_diff,
                    "capacity_differences": cap_diff,
                    "failure_examples": failures[:5],
                }

            overlap = {}
            for state in ("CA", "NY", "TX"):
                cursor.execute(
                    """
                    WITH latest AS (
                      SELECT DISTINCT ON (rp.provider_id)
                        rp.provider_id, rp.final_resolution_state
                      FROM facility_intelligence_run_provider rp
                      JOIN facility_snapshot fs ON fs.provider_id=rp.provider_id
                      WHERE rp.final_resolution_state IS NOT NULL AND fs.state_code=%s
                      ORDER BY rp.provider_id, rp.completed_at DESC NULLS LAST
                    )
                    SELECT
                      count(*) FILTER (WHERE final_resolution_state='REVIEW_REQUIRED'),
                      count(*) FILTER (
                        WHERE final_resolution_state='REVIEW_REQUIRED'
                          AND EXISTS (
                            SELECT 1 FROM facility_claim c
                            WHERE c.provider_id=latest.provider_id
                              AND c.claim_type='STATE_LICENSE_ID'
                              AND c.resolution_state='VERIFIED'
                          )
                      )
                    FROM latest
                    """,
                    (state,),
                )
                review, with_state = cursor.fetchone()
                overlap[state] = {
                    "google_review_required": review,
                    "now_verified_state_identity": with_state,
                }

        report["qa"] = qa
        report["google_overlap"] = overlap
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()
