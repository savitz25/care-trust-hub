"""Fail closed if senior-network-metrics-v1 is stale versus hub intel or live canonical data.

File coupling always runs. Live database comparison runs when CARE_DATABASE_URL is set.
Does not print secrets. Does not write the manifest.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
METRICS_PATH = ROOT / "apps" / "web" / "src" / "data" / "senior-network-metrics-v1.json"
HUB_PATH = ROOT / "apps" / "web" / "src" / "data" / "senior-national-intelligence.json"

LIVE_SQL = """
WITH current_nh AS (
  SELECT latest.provider_id
  FROM (
    SELECT DISTINCT ON (pds.ccn) pds.provider_id, pds.directory_status
    FROM provider_directory_status pds
    JOIN provider p ON p.id = pds.provider_id
    WHERE p.provider_type='nursing_home'
    ORDER BY pds.ccn, pds.observed_at DESC, pds.ingested_at DESC
  ) latest
  WHERE latest.directory_status='CURRENT_ACTIVE'
),
latest AS (
  SELECT f.dataset_key, sr.id AS source_release_id
  FROM cms_source_freshness f
  JOIN source_dataset sd ON sd.dataset_key = f.dataset_key
  JOIN source_release sr ON sr.source_dataset_id = sd.id AND sr.release_key = f.current_release
)
SELECT jsonb_build_object(
  'snapshotFingerprint', (
    SELECT fingerprint FROM senior_intelligence_snapshot
    WHERE snapshot_version='senior-national-intel-v1'
    ORDER BY generated_at DESC LIMIT 1
  ),
  'nh_current', (SELECT count(*) FROM current_nh),
  'hh_current', (SELECT count(DISTINCT provider_id) FROM home_health_snapshot),
  'hospice_current', (SELECT count(DISTINCT provider_id) FROM hospice_snapshot),
  'hospice_typed', (SELECT count(*) FROM provider WHERE provider_type='hospice'),
  'mds_latest', (
    SELECT count(*) FROM facility_quality_measure_observation o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='nursing-home-mds-quality-measures'
  ),
  'fire_latest', (
    SELECT count(*) FROM fire_safety_citation o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='nursing-home-fire-safety-deficiencies'
  ),
  'inspection_latest', (
    SELECT count(*) FROM inspection_event o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='nursing-home-inspection-dates'
  ),
  'deficiency_latest', (
    SELECT count(*) FROM deficiency_finding o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='nursing-home-health-deficiencies'
  ),
  'penalty_latest', (
    SELECT count(*) FROM penalty_enforcement o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='nursing-home-penalties'
  ),
  'pbj_quarters_latest', (
    SELECT count(*) FROM pbj_staffing_quarter_summary o
    JOIN latest l ON l.source_release_id=o.source_release_id
    WHERE l.dataset_key='payroll-based-journal-daily-nurse-staffing'
  ),
  'chow_events', (SELECT count(*) FROM ownership_change_event)
)
"""


def load_env() -> None:
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def fingerprint(payload: dict[str, Any]) -> str:
    canonical = {
        key: value
        for key, value in payload.items()
        if key not in {"generatedAt", "sourceFingerprint"}
    }
    encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def metric_value(metrics: dict[str, Any], key: str) -> int | None:
    for item in metrics["metrics"]:
        if item["key"] == key:
            return item["value"]
    raise SystemExit(f"Missing metric {key}")


def check_files() -> dict[str, Any]:
    hub = json.loads(HUB_PATH.read_text(encoding="utf-8"))
    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    expected = fingerprint(metrics)
    errors: list[str] = []
    if metrics.get("schemaVersion") != "senior-network-metrics-v1":
        errors.append(f"schemaVersion {metrics.get('schemaVersion')}")
    if metrics.get("sourceFingerprint") != expected:
        errors.append("sourceFingerprint does not match deterministic payload hash")
    if metrics.get("canonicalSnapshotFingerprint") != hub.get("sourceFingerprint"):
        errors.append(
            "canonicalSnapshotFingerprint != senior-hub-intel sourceFingerprint; "
            "run scripts/sen-nat-013-hub-snapshot.py then scripts/build-senior-network-metrics.py"
        )
    if metrics.get("combinedProviderDenominator", {}).get("publishAsHeadline") is not False:
        errors.append("combined provider denominator must not be a headline")
    if metrics.get("combinedEvidenceDepth", {}).get("status") != "REJECTED":
        errors.append("combined evidence depth must remain REJECTED")
    if errors:
        raise SystemExit("STALE/INVALID senior-network-metrics-v1:\n- " + "\n- ".join(errors))
    return {"hub": hub, "metrics": metrics}


def check_live(metrics: dict[str, Any], hub: dict[str, Any]) -> None:
    import psycopg

    url = os.environ.get("CARE_DATABASE_URL")
    if not url:
        print("live check skipped: CARE_DATABASE_URL not set", flush=True)
        return
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute("SET statement_timeout = '180s'")
        live = conn.execute(LIVE_SQL).fetchone()[0]
    errors: list[str] = []
    live_fp = live.get("snapshotFingerprint")
    if live_fp != hub.get("sourceFingerprint"):
        errors.append(
            f"live senior_intelligence_snapshot fingerprint {live_fp} != "
            f"checked-in hub intel {hub.get('sourceFingerprint')}; "
            "run scripts/sen-nat-013-hub-snapshot.py"
        )
    if live_fp != metrics.get("canonicalSnapshotFingerprint"):
        errors.append(
            f"live snapshot fingerprint {live_fp} != network metrics canonicalSnapshotFingerprint; "
            "run scripts/build-senior-network-metrics.py"
        )
    expected = {
        "nh_current": metric_value(metrics, "current_nursing_homes"),
        "hh_current": metric_value(metrics, "current_home_health_agencies"),
        "hospice_current": metric_value(metrics, "current_hospice_providers"),
        "mds_latest": metric_value(metrics, "mds_observations"),
        "fire_latest": metric_value(metrics, "fire_citations"),
        "inspection_latest": metric_value(metrics, "inspection_events"),
        "deficiency_latest": metric_value(metrics, "health_deficiencies"),
        "penalty_latest": metric_value(metrics, "enforcement_records"),
        "pbj_quarters_latest": metric_value(metrics, "pbj_quarter_summaries"),
        "chow_events": metric_value(metrics, "chow_events"),
    }
    for key, published in expected.items():
        actual = int(live[key])
        if actual != published:
            errors.append(f"live {key}={actual} != published {published}")
    typed = int(live["hospice_typed"])
    current = int(live["hospice_current"])
    if metric_value(metrics, "hospice_evidence_only") != typed - current:
        errors.append("live hospice evidence-only drifted from typed minus GI current")
    if errors:
        raise SystemExit(
            "STALE senior-network-metrics-v1 versus canonical database:\n- "
            + "\n- ".join(errors)
            + "\nRegenerate with scripts/sen-nat-013-hub-snapshot.py "
            "(which now also rebuilds senior-network-metrics-v1)."
        )
    print("live canonical comparison ok", flush=True)


def main() -> int:
    load_env()
    files = check_files()
    print("file coupling ok", flush=True)
    check_live(files["metrics"], files["hub"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
