"""Live current-directory search checks for SEN-NAT-014. Read-only."""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

EXPECTED = {"hh": 12460, "hospice": 6669, "evidence_only": 242}


def compact(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "", value.upper())


started = time.perf_counter()
with psycopg.connect(os.environ["CARE_DATABASE_URL"], autocommit=True) as conn:
    conn.execute("SET statement_timeout = '60s'")
    hh = conn.execute("SELECT count(DISTINCT cms_ccn) FROM home_health_snapshot").fetchone()[0]
    hospice = conn.execute("SELECT count(DISTINCT cms_ccn) FROM hospice_snapshot").fetchone()[0]
    typed = conn.execute("SELECT count(*) FROM provider WHERE provider_type='hospice'").fetchone()[0]
    centerwell = conn.execute(
        """
        SELECT count(*) FROM (
          SELECT DISTINCT ON (cms_ccn) cms_ccn, provider_name
          FROM home_health_snapshot ORDER BY cms_ccn, id DESC
        ) t WHERE regexp_replace(upper(provider_name), '[^A-Z0-9]+', '', 'g') LIKE %s
        """,
        (f"%{compact('CENTERWELL HOME HEALTH')}%",),
    ).fetchone()[0]
    exact_ccn = conn.execute(
        """
        SELECT cms_ccn, provider_name, city, state_code
        FROM home_health_snapshot WHERE cms_ccn='017013' ORDER BY id DESC LIMIT 1
        """
    ).fetchone()
    hospice_ccn = conn.execute(
        """
        SELECT cms_ccn, provider_name FROM hospice_snapshot
        WHERE cms_ccn='001513' ORDER BY id DESC LIMIT 1
        """
    ).fetchone()
    evidence_in_gi = conn.execute(
        """
        SELECT count(*) FROM provider p
        WHERE p.provider_type='hospice'
          AND NOT EXISTS (SELECT 1 FROM hospice_snapshot s WHERE s.provider_id=p.id)
        """
    ).fetchone()[0]
    al_hh = conn.execute(
        """
        SELECT count(*) FROM (
          SELECT DISTINCT ON (cms_ccn) state_code FROM home_health_snapshot ORDER BY cms_ccn, id DESC
        ) t WHERE state_code='AL'
        """
    ).fetchone()[0]
    office_zip = conn.execute(
        """
        SELECT count(*) FROM (
          SELECT DISTINCT ON (cms_ccn) zip_code FROM home_health_snapshot ORDER BY cms_ccn, id DESC
        ) t WHERE zip_code='36330'
        """
    ).fetchone()[0]

elapsed = round((time.perf_counter() - started) * 1000, 1)
report = {
    "ok": hh == EXPECTED["hh"] and hospice == EXPECTED["hospice"] and evidence_in_gi == EXPECTED["evidence_only"],
    "latencyMs": elapsed,
    "hh": hh,
    "hospice": hospice,
    "typed": typed,
    "evidenceOnly": evidence_in_gi,
    "centerwellRows": centerwell,
    "hh017013": list(exact_ccn) if exact_ccn else None,
    "hospice001513": list(hospice_ccn) if hospice_ccn else None,
    "alHomeHealth": al_hh,
    "officeZip36330": office_zip,
}
if not report["ok"]:
    raise SystemExit(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
