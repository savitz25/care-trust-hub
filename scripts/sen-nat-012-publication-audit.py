from __future__ import annotations

import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def slug(name: str) -> str:
    value = name.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")[:80].strip("-")
    return value or "provider"


def eligible(ccn: str, name: str | None, city: str | None, state: str | None) -> bool:
    return bool(
        re.fullmatch(r"[A-Z0-9]{6}", ccn or "")
        and (name or "").strip()
        and (city or "").strip()
        and re.fullmatch(r"[A-Z]{2}", state or "")
    )


with psycopg.connect(os.environ["CARE_DATABASE_URL"], autocommit=True) as conn:
    conn.execute("SET statement_timeout = '60s'")
    hh = conn.execute(
        """
        SELECT DISTINCT ON (cms_ccn)
          cms_ccn, provider_name, city, state_code, zip_code, telephone,
          quality_of_patient_care_star, provider_id
        FROM home_health_snapshot
        ORDER BY cms_ccn, id DESC
        """
    ).fetchall()
    hospice = conn.execute(
        """
        SELECT DISTINCT ON (cms_ccn)
          cms_ccn, provider_name, city, state_code, zip_code, telephone,
          county_name, provider_id
        FROM hospice_snapshot
        ORDER BY cms_ccn, id DESC
        """
    ).fetchall()
    typed_h = conn.execute(
        "SELECT count(*) FROM provider WHERE provider_type='hospice'"
    ).fetchone()[0]
    nh_ccns = {
        r[0]
        for r in conn.execute(
            """
            SELECT identifier_value FROM provider_identifier
            WHERE identifier_type='CCN' AND issuer='CMS'
            """
        ).fetchall()
    }
    hh_ids = {r[7] for r in hh if r[7]}
    hos_ids = {r[7] for r in hospice if r[7]}
    owner_hh = {
        r[0]
        for r in conn.execute(
            """
            SELECT DISTINCT s.cms_ccn
            FROM home_health_snapshot s
            JOIN provider_organization_edge e ON e.provider_id=s.provider_id
            WHERE e.relationship_type='OWNED_BY' AND e.temporal_status='CURRENT'
            """
        ).fetchall()
    }
    owner_hos = {
        r[0]
        for r in conn.execute(
            """
            SELECT DISTINCT s.cms_ccn
            FROM hospice_snapshot s
            JOIN provider_organization_edge e ON e.provider_id=s.provider_id
            WHERE e.relationship_type='OWNED_BY' AND e.temporal_status='CURRENT'
            """
        ).fetchall()
    }
    q_hh = {
        r[0]
        for r in conn.execute(
            """
            SELECT DISTINCT cms_ccn FROM cms_agency_quality_observation
            WHERE provider_type='home_health'
            """
        ).fetchall()
    }
    q_hos = {
        r[0]
        for r in conn.execute(
            """
            SELECT DISTINCT cms_ccn FROM cms_agency_quality_observation
            WHERE provider_type='hospice'
            """
        ).fetchall()
    }
    quality_only_hospice = conn.execute(
        """
        SELECT count(*) FROM provider p
        WHERE p.provider_type='hospice'
          AND NOT EXISTS (SELECT 1 FROM hospice_snapshot s WHERE s.provider_id=p.id)
        """
    ).fetchone()[0]


def classify(rows, quality_set, owner_set, star_idx=None):
    elig = []
    buckets = Counter()
    empty_name = 0
    empty_city = 0
    empty_state = 0
    dup_slug = defaultdict(list)
    titles = Counter()
    for row in rows:
        ccn, name, city, state = row[0], row[1], row[2], row[3]
        if not (name or "").strip():
            empty_name += 1
        if not (city or "").strip():
            empty_city += 1
        if not re.fullmatch(r"[A-Z]{2}", state or ""):
            empty_state += 1
        ok = eligible(ccn, name, city, state)
        if ok:
            elig.append(row)
            s = slug(name)
            dup_slug[s].append(ccn)
            titles[f"{name} —"] += 1
        has_q = ccn in quality_set or (
            star_idx is not None and row[star_idx] is not None
        )
        has_o = ccn in owner_set
        if not ok:
            buckets["ineligible"] += 1
        elif has_q and has_o:
            buckets["identity_quality_ownership"] += 1
        elif has_q:
            buckets["identity_quality"] += 1
        elif has_o:
            buckets["identity_ownership"] += 1
        else:
            buckets["identity_only"] += 1
        if ok and has_q and has_o and (star_idx is None or row[star_idx] is not None):
            buckets["rich"] += 1
    colliding_slugs = {k: v for k, v in dup_slug.items() if len(v) > 1}
    return {
        "total": len(rows),
        "eligible": len(elig),
        "empty_name": empty_name,
        "empty_city": empty_city,
        "empty_state": empty_state,
        "buckets": dict(buckets),
        "slug_collisions": len(colliding_slugs),
        "duplicate_titles": sum(1 for n in titles.values() if n > 1),
        "eligible_rows": elig,
        "colliding_slug_samples": dict(list(colliding_slugs.items())[:8]),
    }


hh_stats = classify(hh, q_hh, owner_hh, star_idx=6)
hos_stats = classify(hospice, q_hos, owner_hos)
hh_ccns = {r[0] for r in hh}
hos_ccns = {r[0] for r in hospice}
overlap_nh_hh = len(hh_ccns & nh_ccns)
overlap_nh_hos = len(hos_ccns & nh_ccns)
overlap_hh_hos = len(hh_ccns & hos_ccns)

SEED_HH = ["017013", "017009", "017000", "368489", "297230", "747129"]
SEED_HOS = [
    "001513",
    "001504",
    "001502",
    "001508",
    "001500",
    "331537",
    "361582",
    "671562",
    "051751",
]


def pick_cohort(rows, seeds, limit=250):
    chosen = []
    seen = set()
    by_state = defaultdict(list)
    for row in rows:
        if eligible(row[0], row[1], row[2], row[3]):
            by_state[row[3]].append(row)
    for ccn in seeds:
        for row in rows:
            if row[0] == ccn and ccn not in seen:
                chosen.append(row)
                seen.add(ccn)
                break
    round_n = 0
    while len(chosen) < limit:
        added = 0
        for state in sorted(by_state):
            if len(chosen) >= limit:
                break
            bucket = by_state[state]
            if round_n < len(bucket):
                row = bucket[round_n]
                if row[0] not in seen:
                    chosen.append(row)
                    seen.add(row[0])
                    added += 1
        if added == 0:
            break
        round_n += 1
    return chosen


hh_cohort = pick_cohort(hh_stats["eligible_rows"], SEED_HH, 250)
hos_cohort = pick_cohort(hos_stats["eligible_rows"], SEED_HOS, 250)


def serialize(rows, kind):
    return [
        {
            "ccn": r[0],
            "name": r[1],
            "city": r[2],
            "state": r[3],
            "slug": slug(r[1]),
        }
        for r in rows
    ]


payload = {
    "home_health": serialize(hh_cohort, "hh"),
    "hospice": serialize(hos_cohort, "hos"),
}
out = ROOT / "apps" / "web" / "src" / "data" / "agency-index-cohort.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

hh_states = Counter(r[3] for r in hh_cohort)
hos_states = Counter(r[3] for r in hos_cohort)
print(
    json.dumps(
        {
            "hh_snapshot": hh_stats["total"],
            "hh_eligible": hh_stats["eligible"],
            "hh_empty_name": hh_stats["empty_name"],
            "hh_empty_city": hh_stats["empty_city"],
            "hh_empty_state": hh_stats["empty_state"],
            "hh_buckets": hh_stats["buckets"],
            "hh_slug_collisions": hh_stats["slug_collisions"],
            "hh_duplicate_titles": hh_stats["duplicate_titles"],
            "hh_slug_collision_samples": hh_stats["colliding_slug_samples"],
            "hospice_gi": hos_stats["total"],
            "hospice_typed": typed_h,
            "hospice_eligible": hos_stats["eligible"],
            "hospice_empty_name": hos_stats["empty_name"],
            "hospice_empty_city": hos_stats["empty_city"],
            "hospice_empty_state": hos_stats["empty_state"],
            "hospice_buckets": hos_stats["buckets"],
            "hospice_slug_collisions": hos_stats["slug_collisions"],
            "hospice_quality_only": quality_only_hospice,
            "overlap_nh_hh_ccn_strings": overlap_nh_hh,
            "overlap_nh_hospice_ccn_strings": overlap_nh_hos,
            "overlap_hh_hospice_ccn_strings": overlap_hh_hos,
            "cohort_hh": len(hh_cohort),
            "cohort_hh_states": len(hh_states),
            "cohort_hh_by_state": dict(sorted(hh_states.items())),
            "cohort_hos": len(hos_cohort),
            "cohort_hos_states": len(hos_states),
            "cohort_hos_by_state": dict(sorted(hos_states.items())),
            "cohort_file": str(out),
        },
        indent=2,
    )
)
