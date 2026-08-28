"""FL-SEN-007: deterministic Phase 1 ALF/AFCH publication cohort."""

from __future__ import annotations

import hashlib
import json
import os
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_DATA = ROOT / "apps" / "web" / "src" / "data"
DOCS = ROOT / "docs"
CONTRACT = "fl-sen-pub-v1"
SEED = "fl-sen-pub-v1"
TARGETS = {"assisted-living": 20, "adult-family-care": 5}
ELIGIBLE = set(TARGETS)


def load_env() -> None:
    for raw in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if raw.strip() and not raw.startswith("#") and "=" in raw:
            key, _, value = raw.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def selection_hash(external_key: str) -> str:
    return hashlib.sha256(f"{SEED}|{external_key}".encode("utf-8")).hexdigest()


def main() -> int:
    load_env()
    import psycopg
    from psycopg.rows import dict_row

    conn = psycopg.connect(
        os.environ["CARE_DATABASE_URL"],
        sslmode=os.environ.get("CARE_DATABASE_SSL", "require"),
        row_factory=dict_row,
    )
    rows = conn.execute(
        """
        select p.provider_id::text, p.profile_kind, p.ahca_file_number, p.slug, p.future_path,
               p.publication_state, p.payload->'identity'->>'external_key' as external_key,
               p.payload->'identity'->>'official_name' as official_name,
               p.payload->'identity'->>'locator_status' as locator_status,
               p.payload->'identity'->>'license_status_raw' as license_status_raw,
               coalesce((p.payload->'identity'->>'cms_confirmed')::boolean, false) as cms_confirmed,
               (p.payload->'regulatory'->>'observation_count')::int as events
        from state_provider_profile p
        where p.profile_kind = any(%s)
        """,
        [list(ELIGIBLE)],
    ).fetchall()
    conn.close()

    eligible = []
    for row in rows:
        if not row["external_key"] or not row["future_path"] or not row["ahca_file_number"]:
            continue
        if row["locator_status"] != "CURRENT":
            continue
        if row["cms_confirmed"]:
            continue
        eligible.append(
            {
                **row,
                "selection_hash": selection_hash(row["external_key"]),
            }
        )
    by_kind: dict[str, list] = {kind: [] for kind in TARGETS}
    for row in eligible:
        by_kind[row["profile_kind"]].append(row)
    selected = []
    for kind, n in TARGETS.items():
        ranked = sorted(by_kind[kind], key=lambda r: (r["selection_hash"], r["ahca_file_number"]))
        selected.extend(ranked[:n])
    paths = [r["future_path"] for r in selected]
    if len(set(paths)) != len(paths):
        raise SystemExit("COHORT_PATH_COLLISION")
    if len(selected) != 25:
        raise SystemExit(f"COHORT_COUNT {len(selected)}")
    class_n = Counter(r["profile_kind"] for r in selected)
    if class_n["assisted-living"] != 20 or class_n["adult-family-care"] != 5:
        raise SystemExit(class_n)

    manifest = {
        "contract_version": CONTRACT,
        "seed": SEED,
        "algorithm": "sha256(seed|external_key) ascending within eligible Phase 1 class",
        "eligible_classes": ["FL_ALF", "FL_AFCH"],
        "indexable_default": False,
        "n": 25,
        "profiles": [
            {
                "provider_id": r["provider_id"],
                "provider_class": "FL_ALF" if r["profile_kind"] == "assisted-living" else "FL_AFCH",
                "profile_kind": r["profile_kind"],
                "ahca_file_number": r["ahca_file_number"],
                "name_slug": r["slug"],
                "future_path": r["future_path"],
                "publication_state": "phase1_manifest",
                "indexable": False,
                "manifest_version": CONTRACT,
            }
            for r in selected
        ],
    }
    qa = [
        {
            "provider_id": r["provider_id"],
            "kind": r["profile_kind"],
            "file": r["ahca_file_number"],
            "path": r["future_path"],
            "status": r["license_status_raw"],
            "events": r["events"],
            "name": r["official_name"],
            "selection_hash": r["selection_hash"],
        }
        for r in selected
    ]
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    DOCS.mkdir(exist_ok=True)
    (WEB_DATA / "florida-provider-publication.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    (DOCS / "fl-sen-007-publication-cohort.json").write_text(
        json.dumps({"n": 25, "classes": dict(class_n), "qa": qa}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"n": 25, "classes": dict(class_n), "path_collisions": 0}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
