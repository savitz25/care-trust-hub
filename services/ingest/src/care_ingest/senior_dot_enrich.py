"""Senior DOT enrichment loader for facility_source_observation.

The publish candidate identifies each facility by its six-character CMS
certification number in ``provider_id``. Nursing homes use identifier type
``CCN``. Home health uses ``HOME_HEALTH_CCN``. Hospice uses ``HOSPICE_CCN``.
Matches are exact. Short numbers are not padded, and names are not used.

``facility_source_observation.ingest_run_id`` is a uuid foreign key, so the
slug ``senior-enrich-001-2026-10-16`` is stored on the ingest run's
transformation version, the observation release identifier, and
``provenance.ingest_run_slug``. The uuid itself is created in the same
transaction.

The observation table rejects UPDATE and DELETE. This loader only inserts.
A dry run rolls the transaction back. A commit renderer exists for a later
founder load and is not invoked by the dry-run path.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

RELEASE_SLUG = "senior-enrich-001-2026-10-16"
SOURCE_TYPE = "dot_enrich"
SOURCE_AUTHORITY = "commercial_corroboration"
SOURCE_IDENTIFIER = "final-publish-candidate-2026-10-14"
ADAPTER_VERSION = "senior-dot-enrich-v1"
DATASET_KEY = "senior_dot_enrich"
EXPECTED_SHA256 = "c1b0d9a4baeecab37a57fc977750d09a66c330208b3df6129fba2c7db6a525bc"
EXPECTED_PROVIDER_ROWS = 1910
MAX_PUBLISHABLE_EMAILS = 725
HELD_EMAIL_FILENAME = "final-email-held-2026-10-14.csv"
GO_PHRASE = "GO SENIOR ENRICH LOAD"
RETRIEVED_AT = "2026-10-14T00:00:00Z"
RUN_AT = "2026-10-16T00:00:00Z"

HEADER = (
    "provider_id",
    "provider_type",
    "display_name",
    "state",
    "city",
    "grade",
    "website",
    "phone_primary_cms",
    "phone_secondary_website",
    "email",
    "address",
    "dot_match_confidence",
    "source_file",
    "source_row",
    "flags",
    "dot_source_pages",
)
CONTACT_FIELDS = (
    "website",
    "phone_primary_cms",
    "phone_secondary_website",
    "email",
)
IDENTIFIER_TYPE_BY_PROVIDER = {
    "nursing_home": "CCN",
    "home_health": "HOME_HEALTH_CCN",
    "hospice": "HOSPICE_CCN",
}
PHONE_ROLES = {
    "phone_primary_cms": "cms_primary",
    "phone_secondary_website": "website_secondary",
}
_COMMIT_STATEMENT = re.compile(r"(?im)(?:^|;)\s*COMMIT\b")


class SeniorEnrichReject(ValueError):
    """The candidate or the requested execution mode is not loadable."""


@dataclass(frozen=True, slots=True)
class Candidate:
    provider_id: str
    provider_type: str
    state: str
    grade: str
    website: str
    phone_primary_cms: str
    phone_secondary_website: str
    email: str
    source_row: str


@dataclass(frozen=True, slots=True)
class OpenIdentifier:
    provider_key: str
    provider_type: str
    identifier_type: str
    identifier_value: str


@dataclass(frozen=True, slots=True)
class CurrentFacilityState:
    provider_key: str
    state_codes: frozenset[str]
    snapshot_ccns: frozenset[str] | None


@dataclass(frozen=True, slots=True)
class ObservationPlan:
    provider_id: str
    provider_type: str
    state: str
    grade: str
    observation_type: str
    value: str
    observed_phone: str | None
    observed_url: str | None
    evidence_fingerprint: str
    provenance: dict[str, str]


def require_production_authorization(phrase: str | None) -> None:
    if phrase != GO_PHRASE:
        raise SeniorEnrichReject("production load is not authorized")


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_candidate_csv(text: str) -> list[Candidate]:
    reader = csv.DictReader(io.StringIO(text))
    if tuple(reader.fieldnames or ()) != HEADER:
        raise SeniorEnrichReject("candidate header does not match the publish contract")
    candidates: list[Candidate] = []
    for row in reader:
        provider_type = row["provider_type"]
        provider_id = row["provider_id"]
        state = row["state"]
        grade = row["grade"]
        if provider_type not in IDENTIFIER_TYPE_BY_PROVIDER:
            raise SeniorEnrichReject("candidate provider_type is not a Senior CMS class")
        if not re.fullmatch(r"[A-Z0-9]{6}", provider_id):
            raise SeniorEnrichReject("candidate CMS CCN is not an exact 6-character value")
        if not re.fullmatch(r"[A-Z]{2}", state):
            raise SeniorEnrichReject("candidate state is not an exact 2-letter code")
        if grade not in {"strict", "partial"}:
            raise SeniorEnrichReject("candidate grade is not strict or partial")
        source_row = row["source_row"]
        if not re.fullmatch(r"[0-9]+", source_row):
            raise SeniorEnrichReject("candidate source_row is not an integer")
        candidates.append(
            Candidate(
                provider_id=provider_id,
                provider_type=provider_type,
                state=state,
                grade=grade,
                website=row["website"],
                phone_primary_cms=row["phone_primary_cms"],
                phone_secondary_website=row["phone_secondary_website"],
                email=row["email"],
                source_row=source_row,
            )
        )
    return candidates


def validate_production_contract(
    filename: str, digest: str, candidates: Sequence[Candidate]
) -> None:
    if Path(filename).name == HELD_EMAIL_FILENAME:
        raise SeniorEnrichReject("held email file is excluded")
    if digest != EXPECTED_SHA256:
        raise SeniorEnrichReject("candidate sha256 does not match the publish contract")
    if len(candidates) != EXPECTED_PROVIDER_ROWS:
        raise SeniorEnrichReject("candidate provider count does not match the publish contract")
    identities = {(row.provider_type, row.provider_id) for row in candidates}
    if len(identities) != len(candidates):
        raise SeniorEnrichReject("candidate CMS CCN is duplicated inside a provider class")
    email_rows = sum(1 for row in candidates if row.email != "")
    if email_rows > MAX_PUBLISHABLE_EMAILS:
        raise SeniorEnrichReject("publishable email count exceeds 725")


def load_publishable_candidate(path: Path) -> list[Candidate]:
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    candidates = parse_candidate_csv(raw.decode("utf-8"))
    validate_production_contract(path.name, digest, candidates)
    return candidates


def classify_identity(
    candidates: Sequence[Candidate],
    identifiers: Sequence[OpenIdentifier],
    states: Mapping[str, CurrentFacilityState],
) -> dict[str, int]:
    buckets = {
        "EXACT_PROVIDER_MATCHES": 0,
        "PROVIDER_NOT_FOUND": 0,
        "MULTIPLE_PROVIDER_MATCHES": 0,
        "CCN_MISMATCHES": 0,
        "STATE_MISMATCHES": 0,
        "AMBIGUOUS_IDENTITIES": 0,
    }
    for candidate in candidates:
        buckets[_bucket_for_candidate(candidate, identifiers, states)] += 1
    buckets["INPUT_PROVIDERS"] = len(candidates)
    return buckets


def _bucket_for_candidate(
    candidate: Candidate,
    identifiers: Sequence[OpenIdentifier],
    states: Mapping[str, CurrentFacilityState],
) -> str:
    expected_type = IDENTIFIER_TYPE_BY_PROVIDER[candidate.provider_type]
    class_hits = [
        row
        for row in identifiers
        if row.identifier_type == expected_type and row.identifier_value == candidate.provider_id
    ]
    provider_keys = {row.provider_key for row in class_hits}
    if len(provider_keys) > 1:
        return "MULTIPLE_PROVIDER_MATCHES"
    if not provider_keys:
        other = any(
            row.identifier_value == candidate.provider_id and row.identifier_type != expected_type
            for row in identifiers
        )
        return "CCN_MISMATCHES" if other else "PROVIDER_NOT_FOUND"
    provider_key = next(iter(provider_keys))
    hit = next(row for row in class_hits if row.provider_key == provider_key)
    if hit.provider_type != candidate.provider_type:
        return "CCN_MISMATCHES"
    current_values = {
        row.identifier_value
        for row in identifiers
        if row.provider_key == provider_key and row.identifier_type == expected_type
    }
    if current_values != {candidate.provider_id}:
        return "CCN_MISMATCHES"
    current = states.get(provider_key)
    if current is None:
        return "AMBIGUOUS_IDENTITIES"
    if candidate.provider_type in {"home_health", "hospice"}:
        if not current.snapshot_ccns:
            return "AMBIGUOUS_IDENTITIES"
        if current.snapshot_ccns != {candidate.provider_id}:
            return "CCN_MISMATCHES"
    if len(current.state_codes) != 1:
        return "AMBIGUOUS_IDENTITIES"
    if next(iter(current.state_codes)) != candidate.state:
        return "STATE_MISMATCHES"
    return "EXACT_PROVIDER_MATCHES"


def evidence_fingerprint(provider_id: str, observation_type: str, value: str) -> str:
    payload = "\n".join((SOURCE_TYPE, RELEASE_SLUG, provider_id, observation_type, value))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def plan_observations(candidates: Sequence[Candidate]) -> list[ObservationPlan]:
    planned: list[ObservationPlan] = []
    for candidate in candidates:
        for field in CONTACT_FIELDS:
            value = getattr(candidate, field)
            if value == "":
                continue
            observed_url = value if field == "website" and value.startswith("https://") else None
            observed_phone = value if field in PHONE_ROLES else None
            provenance = {
                "ingest_run_slug": RELEASE_SLUG,
                "grade": candidate.grade,
                "source_file": SOURCE_IDENTIFIER,
                "source_row": candidate.source_row,
            }
            if field in PHONE_ROLES:
                provenance["phone_role"] = PHONE_ROLES[field]
            planned.append(
                ObservationPlan(
                    provider_id=candidate.provider_id,
                    provider_type=candidate.provider_type,
                    state=candidate.state,
                    grade=candidate.grade,
                    observation_type=field,
                    value=value,
                    observed_phone=observed_phone,
                    observed_url=observed_url,
                    evidence_fingerprint=evidence_fingerprint(candidate.provider_id, field, value),
                    provenance=provenance,
                )
            )
    email_rows = sum(1 for row in planned if row.observation_type == "email")
    if email_rows > MAX_PUBLISHABLE_EMAILS:
        raise SeniorEnrichReject("publishable email count exceeds 725")
    return planned


def mask_value(observation_type: str, value: str) -> str:
    if observation_type == "email":
        local, separator, domain = value.partition("@")
        if separator == "" or local == "" or domain == "":
            return f"email:len={len(value)}"
        suffix = domain.rsplit(".", 1)[-1] if "." in domain else "invalid"
        return f"{local[:1]}***@{domain[:1]}***.{suffix}"
    if observation_type in PHONE_ROLES:
        digits = "".join(character for character in value if character.isdigit())
        if len(digits) < 4:
            return "phone:masked"
        return f"phone:***{digits[-2:]}"
    if observation_type == "website":
        scheme = "https" if value.startswith("https://") else "other"
        return f"{scheme}://*** len={len(value)}"
    return "masked"


def select_masked_samples(
    observations: Sequence[ObservationPlan], limit: int = 10
) -> list[dict[str, str]]:
    quotas = (
        ("website", 3),
        ("phone_primary_cms", 3),
        ("phone_secondary_website", 2),
        ("email", 2),
    )
    ordered = sorted(observations, key=lambda row: (row.observation_type, row.evidence_fingerprint))
    chosen: list[ObservationPlan] = []
    used: set[int] = set()
    for observation_type, quota in quotas:
        matches = [row for row in ordered if row.observation_type == observation_type]
        for row in matches[:quota]:
            chosen.append(row)
            used.add(id(row))
    if len(chosen) < limit:
        for row in ordered:
            if id(row) in used:
                continue
            chosen.append(row)
            if len(chosen) == limit:
                break
    samples: list[dict[str, str]] = []
    for index, row in enumerate(chosen[:limit], start=1):
        samples.append(
            {
                "n": str(index),
                "provider_type": row.provider_type,
                "grade": row.grade,
                "observation_type": row.observation_type,
                "masked_value": mask_value(row.observation_type, row.value),
            }
        )
    return samples


def summarize(
    candidates: Sequence[Candidate], observations: Sequence[ObservationPlan]
) -> dict[str, Any]:
    def observation_count(observation_type: str) -> int:
        return sum(1 for row in observations if row.observation_type == observation_type)

    return {
        "providers": len(candidates),
        "strict_providers": sum(1 for row in candidates if row.grade == "strict"),
        "partial_providers": sum(1 for row in candidates if row.grade == "partial"),
        "observations": len(observations),
        "website": observation_count("website"),
        "phone_primary_cms": observation_count("phone_primary_cms"),
        "phone_secondary_website": observation_count("phone_secondary_website"),
        "email": observation_count("email"),
        "strict_observations": sum(1 for row in observations if row.grade == "strict"),
        "partial_observations": sum(1 for row in observations if row.grade == "partial"),
        "held_email_rows_loaded": 0,
        "samples": select_masked_samples(observations),
    }


def render_dry_run_sql(
    candidates: Sequence[Candidate], observations: Sequence[ObservationPlan]
) -> str:
    report = summarize(candidates, observations)
    if report["email"] > MAX_PUBLISHABLE_EMAILS:
        raise SeniorEnrichReject("publishable email count exceeds 725")
    if report["providers"] != EXPECTED_PROVIDER_ROWS:
        raise SeniorEnrichReject("dry run requires the 1910-row publish candidate")
    samples = _sql_literal(json.dumps(report["samples"], separators=(",", ":")))
    sql = "\n".join(
        (
            "DO $senior_enrich_body$",
            "DECLARE",
            "  input_n integer;",
            "  exact_n integer;",
            "  email_n integer;",
            "  bad_type integer;",
            "  obs_n integer;",
            "  result jsonb;",
            "BEGIN",
            _payload_tables_sql(candidates),
            _classification_sql(),
            "  SELECT count(*) INTO input_n FROM senior_enrich_in;",
            "  SELECT count(*) INTO exact_n FROM senior_enrich_classified",
            "  WHERE bucket = 'EXACT_PROVIDER_MATCHES';",
            "  SELECT count(*) INTO email_n FROM senior_enrich_obs",
            "  WHERE observation_type = 'email';",
            "  SELECT count(*) INTO bad_type FROM senior_enrich_obs",
            "  WHERE observation_type NOT IN (",
            "    'website', 'phone_primary_cms', 'phone_secondary_website', 'email'",
            "  );",
            "  IF input_n IS DISTINCT FROM "
            f"{EXPECTED_PROVIDER_ROWS} OR exact_n IS DISTINCT FROM input_n",
            f"     OR email_n IS DISTINCT FROM {report['email']} OR email_n > "
            f"{MAX_PUBLISHABLE_EMAILS}",
            "     OR bad_type IS DISTINCT FROM 0 OR (SELECT count(*) FROM senior_enrich_obs) "
            f"IS DISTINCT FROM {report['observations']} THEN",
            "    RAISE EXCEPTION",
            "      'senior enrich dry run gate failed input=% exact=% email=% bad=%',",
            "      input_n, exact_n, email_n, bad_type;",
            "  END IF;",
            _insert_sql(),
            "  SELECT jsonb_build_object(",
            "    'inserted_all', count(*),",
            "    'inserted_website', count(*) FILTER (WHERE observation_type = 'website'),",
            "    'inserted_phone_primary_cms', count(*) FILTER (",
            "      WHERE observation_type = 'phone_primary_cms'),",
            "    'inserted_phone_secondary_website', count(*) FILTER (",
            "      WHERE observation_type = 'phone_secondary_website'),",
            "    'inserted_email', count(*) FILTER (WHERE observation_type = 'email'),",
            "    'inserted_strict_observations', count(*) FILTER (",
            "      WHERE provenance->>'grade' = 'strict'),",
            "    'inserted_partial_observations', count(*) FILTER (",
            "      WHERE provenance->>'grade' = 'partial')",
            "  ) INTO result",
            "  FROM facility_source_observation",
            f"  WHERE release_identifier = '{RELEASE_SLUG}';",
            "  result := result || jsonb_build_object(",
            "    'obs_returning', obs_n,",
            f"    'samples', {samples}::jsonb",
            "  );",
            "  RAISE EXCEPTION 'SENIOR_ENRICH_DRY_RUN %', result::text;",
            "END",
            "$senior_enrich_body$;",
        )
    )
    if _COMMIT_STATEMENT.search(sql):
        raise SeniorEnrichReject("dry run sql contains COMMIT")
    if "SENIOR_ENRICH_DRY_RUN" not in sql:
        raise SeniorEnrichReject("dry run sql does not abort")
    return sql + "\n"


def render_commit_sql(
    phrase: str | None,
    candidates: Sequence[Candidate],
    observations: Sequence[ObservationPlan],
) -> str:
    require_production_authorization(phrase)
    dry_run = render_dry_run_sql(candidates, observations)
    marker = "RAISE EXCEPTION 'SENIOR_ENRICH_DRY_RUN %', result::text;"
    if marker not in dry_run:
        raise SeniorEnrichReject("commit sql was not isolated from the dry run")
    return dry_run.replace(marker, "result := result;", 1)


def assert_outside_git(path: Path) -> None:
    resolved = path.resolve()
    for parent in (resolved, *resolved.parents):
        if not (parent / ".git").exists():
            continue
        product_checkout = parent.name in {"care-trust-hub", "senior-enrich-001"} or (
            (parent / "services" / "ingest" / "src" / "care_ingest").is_dir()
            and (parent / "db" / "migrations").is_dir()
        )
        if product_checkout:
            raise SeniorEnrichReject("refusing to write enrichment output inside a git checkout")
        return


def write_rollback_manifest(path: Path, observations: Sequence[ObservationPlan]) -> None:
    assert_outside_git(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=(
                "canonical_ccn",
                "provider_type",
                "state_code",
                "grade",
                "observation_type",
                "evidence_fingerprint",
                "source_type",
                "release_identifier",
                "ingest_run_slug",
                "rollback_method",
            ),
        )
        writer.writeheader()
        for row in observations:
            writer.writerow(
                {
                    "canonical_ccn": row.provider_id,
                    "provider_type": row.provider_type,
                    "state_code": row.state,
                    "grade": row.grade,
                    "observation_type": row.observation_type,
                    "evidence_fingerprint": row.evidence_fingerprint,
                    "source_type": SOURCE_TYPE,
                    "release_identifier": RELEASE_SLUG,
                    "ingest_run_slug": RELEASE_SLUG,
                    "rollback_method": "append_only_backup_restore",
                }
            )


def write_prestate_csv(path: Path, metrics: Mapping[str, str]) -> None:
    assert_outside_git(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        writer = csv.writer(handle)
        writer.writerow(("metric", "value"))
        for key in sorted(metrics):
            writer.writerow((key, metrics[key]))


def sql_literal(value: str) -> str:
    return _sql_literal(value)


def _sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _sequence_names() -> tuple[str, ...]:
    return (
        "senior_enrich_dry_all",
        "senior_enrich_dry_website",
        "senior_enrich_dry_phone_primary",
        "senior_enrich_dry_phone_secondary",
        "senior_enrich_dry_email",
        "senior_enrich_dry_strict",
        "senior_enrich_dry_partial",
    )


def _sequence_preamble() -> str:
    create = "\n".join(f"CREATE TEMP SEQUENCE IF NOT EXISTS {name};" for name in _sequence_names())
    reset = "\n".join(f"SELECT setval('{name}', 1, false);" for name in _sequence_names())
    return create + "\n" + reset


def _payload_tables_sql(candidates: Sequence[Candidate]) -> str:
    records = []
    for row in candidates:
        fields = (
            row.provider_id,
            row.provider_type,
            row.state,
            row.grade,
            row.website,
            row.phone_primary_cms,
            row.phone_secondary_website,
            row.email,
            row.source_row,
        )
        if any(separator in field for field in fields for separator in ("\n", "\r", "|")):
            raise SeniorEnrichReject("candidate field conflicts with the SQL record separator")
        records.append("|".join(fields))
    payload = "\n".join(records)
    tag = "$senior_enrich_payload$"
    reserved = (tag, "__PAYLOAD__", "__FINGERPRINT__", "__RELEASE_SLUG__", "__SOURCE_IDENTIFIER__")
    if any(token in payload for token in reserved):
        raise SeniorEnrichReject("candidate payload conflicts with the SQL delimiter")
    fingerprint = (
        "encode(digest(convert_to("
        f"'{SOURCE_TYPE}' || chr(10) || '{RELEASE_SLUG}' || chr(10) || "
        "fields[1] || chr(10) || field.observation_type || chr(10) || field.value"
        ", 'UTF8'), 'sha256'), 'hex')"
    )
    statement = """
CREATE TEMP TABLE senior_enrich_raw AS
SELECT ordinality::integer AS ord,
  string_to_array(record, '|') AS fields
FROM unnest(string_to_array(__PAYLOAD__, chr(10)))
  WITH ORDINALITY AS candidate_row(record, ordinality)
WHERE record <> '';

CREATE TEMP TABLE senior_enrich_in AS
SELECT ord,
  fields[1] AS ccn,
  fields[3] AS state_code,
  fields[2] AS provider_type,
  fields[4] AS grade
FROM senior_enrich_raw;

CREATE TEMP TABLE senior_enrich_obs AS
SELECT fields[1] AS ccn,
  fields[2] AS provider_type,
  fields[4] AS grade,
  field.observation_type,
  jsonb_build_object('field', field.observation_type, 'value', field.value) AS observed_value,
  field.value AS normalized_value,
  CASE
    WHEN field.observation_type IN ('phone_primary_cms', 'phone_secondary_website')
      THEN field.value
  END AS observed_phone,
  CASE
    WHEN field.observation_type = 'website' AND field.value LIKE 'https://%' THEN field.value
  END AS observed_url,
  __FINGERPRINT__ AS evidence_fingerprint,
  jsonb_strip_nulls(jsonb_build_object(
    'grade', fields[4],
    'ingest_run_slug', '__RELEASE_SLUG__',
    'phone_role', CASE field.observation_type
      WHEN 'phone_primary_cms' THEN 'cms_primary'
      WHEN 'phone_secondary_website' THEN 'website_secondary'
    END,
    'source_file', '__SOURCE_IDENTIFIER__',
    'source_row', fields[9]
  )) AS provenance
FROM senior_enrich_raw
CROSS JOIN LATERAL (
  VALUES
    ('website', fields[5]),
    ('phone_primary_cms', fields[6]),
    ('phone_secondary_website', fields[7]),
    ('email', fields[8])
) AS field(observation_type, value)
WHERE field.value <> '';
"""
    return (
        statement.replace("__PAYLOAD__", tag + payload + tag)
        .replace("__FINGERPRINT__", fingerprint)
        .replace("__RELEASE_SLUG__", RELEASE_SLUG)
        .replace("__SOURCE_IDENTIFIER__", SOURCE_IDENTIFIER)
        .strip()
    )


def _classification_sql() -> str:
    return """
CREATE TEMP TABLE senior_enrich_classified AS
WITH expected AS (
  SELECT ord, ccn, state_code, provider_type, grade,
    CASE provider_type
      WHEN 'nursing_home' THEN 'CCN'
      WHEN 'home_health' THEN 'HOME_HEALTH_CCN'
      WHEN 'hospice' THEN 'HOSPICE_CCN'
    END AS identifier_type
  FROM senior_enrich_in
),
class_hits AS (
  SELECT e.ord, pi.provider_id
  FROM expected e
  JOIN provider_identifier pi
    ON pi.issuer = 'CMS'
   AND pi.valid_to IS NULL
   AND pi.identifier_type = e.identifier_type
   AND pi.identifier_value = e.ccn
),
class_counts AS (
  SELECT ord,
    count(DISTINCT provider_id) AS provider_n,
    CASE WHEN count(DISTINCT provider_id) = 1
      THEN (array_agg(DISTINCT provider_id))[1]
    END AS provider_id
  FROM class_hits
  GROUP BY ord
),
other_hits AS (
  SELECT e.ord, count(DISTINCT pi.provider_id) AS provider_n
  FROM expected e
  JOIN provider_identifier pi
    ON pi.issuer = 'CMS'
   AND pi.valid_to IS NULL
   AND pi.identifier_value = e.ccn
   AND pi.identifier_type IS DISTINCT FROM e.identifier_type
  GROUP BY e.ord
),
matched AS (
  SELECT e.ord, e.ccn, e.state_code, e.provider_type, e.grade, e.identifier_type,
    COALESCE(cc.provider_n, 0) AS provider_n,
    cc.provider_id,
    p.provider_type AS db_type
  FROM expected e
  LEFT JOIN class_counts cc ON cc.ord = e.ord
  LEFT JOIN provider p ON p.id = cc.provider_id
),
extra_ccn AS (
  SELECT m.ord, count(DISTINCT pi.identifier_value) AS value_n
  FROM matched m
  JOIN provider_identifier pi
    ON pi.provider_id = m.provider_id
   AND pi.issuer = 'CMS'
   AND pi.valid_to IS NULL
   AND pi.identifier_type = m.identifier_type
  WHERE m.provider_n = 1
  GROUP BY m.ord
),
fs_current AS (
  SELECT provider_id, state_code
  FROM (
    SELECT fs.provider_id, fs.state_code, fs.observed_at,
      max(fs.observed_at) OVER (PARTITION BY fs.provider_id) AS max_observed
    FROM facility_snapshot fs
    WHERE fs.provider_id IN (
      SELECT provider_id FROM matched
      WHERE provider_n = 1 AND provider_type = 'nursing_home'
    )
  ) current_rows
  WHERE observed_at IS NOT DISTINCT FROM max_observed
),
fs_state AS (
  SELECT provider_id, count(DISTINCT state_code) AS state_n, min(state_code) AS state_code
  FROM fs_current
  GROUP BY provider_id
),
hh_current AS (
  SELECT provider_id, state_code, cms_ccn
  FROM (
    SELECT h.provider_id, h.state_code, h.cms_ccn, sr.retrieved_at,
      max(sr.retrieved_at) OVER (PARTITION BY h.provider_id) AS max_retrieved
    FROM home_health_snapshot h
    JOIN source_release sr ON sr.id = h.source_release_id
    WHERE h.provider_id IN (
      SELECT provider_id FROM matched
      WHERE provider_n = 1 AND provider_type = 'home_health'
    )
  ) current_rows
  WHERE retrieved_at IS NOT DISTINCT FROM max_retrieved
),
hh_state AS (
  SELECT provider_id,
    count(DISTINCT state_code) AS state_n,
    min(state_code) AS state_code,
    count(DISTINCT cms_ccn) AS ccn_n,
    min(cms_ccn) AS cms_ccn
  FROM hh_current
  GROUP BY provider_id
),
hs_current AS (
  SELECT provider_id, state_code, cms_ccn
  FROM (
    SELECT h.provider_id, h.state_code, h.cms_ccn, sr.retrieved_at,
      max(sr.retrieved_at) OVER (PARTITION BY h.provider_id) AS max_retrieved
    FROM hospice_snapshot h
    JOIN source_release sr ON sr.id = h.source_release_id
    WHERE h.provider_id IN (
      SELECT provider_id FROM matched
      WHERE provider_n = 1 AND provider_type = 'hospice'
    )
  ) current_rows
  WHERE retrieved_at IS NOT DISTINCT FROM max_retrieved
),
hs_state AS (
  SELECT provider_id,
    count(DISTINCT state_code) AS state_n,
    min(state_code) AS state_code,
    count(DISTINCT cms_ccn) AS ccn_n,
    min(cms_ccn) AS cms_ccn
  FROM hs_current
  GROUP BY provider_id
)
SELECT m.ord, m.ccn, m.provider_type, m.provider_id,
  CASE
    WHEN m.provider_n > 1 THEN 'MULTIPLE_PROVIDER_MATCHES'
    WHEN m.provider_n = 0 AND COALESCE(o.provider_n, 0) > 0 THEN 'CCN_MISMATCHES'
    WHEN m.provider_n = 0 THEN 'PROVIDER_NOT_FOUND'
    WHEN m.db_type IS DISTINCT FROM m.provider_type THEN 'CCN_MISMATCHES'
    WHEN COALESCE(x.value_n, 0) <> 1 THEN 'CCN_MISMATCHES'
    WHEN m.provider_type = 'home_health'
      AND hh.provider_id IS NOT NULL
      AND (hh.ccn_n IS DISTINCT FROM 1 OR hh.cms_ccn IS DISTINCT FROM m.ccn)
      THEN 'CCN_MISMATCHES'
    WHEN m.provider_type = 'hospice'
      AND hs.provider_id IS NOT NULL
      AND (hs.ccn_n IS DISTINCT FROM 1 OR hs.cms_ccn IS DISTINCT FROM m.ccn)
      THEN 'CCN_MISMATCHES'
    WHEN m.provider_type = 'nursing_home' AND fs.provider_id IS NULL
      THEN 'AMBIGUOUS_IDENTITIES'
    WHEN m.provider_type = 'home_health' AND hh.provider_id IS NULL
      THEN 'AMBIGUOUS_IDENTITIES'
    WHEN m.provider_type = 'hospice' AND hs.provider_id IS NULL
      THEN 'AMBIGUOUS_IDENTITIES'
    WHEN m.provider_type = 'nursing_home' AND fs.state_n IS DISTINCT FROM 1
      THEN 'AMBIGUOUS_IDENTITIES'
    WHEN m.provider_type = 'home_health' AND hh.state_n IS DISTINCT FROM 1
      THEN 'AMBIGUOUS_IDENTITIES'
    WHEN m.provider_type = 'hospice' AND hs.state_n IS DISTINCT FROM 1
      THEN 'AMBIGUOUS_IDENTITIES'
    WHEN m.provider_type = 'nursing_home' AND fs.state_code IS DISTINCT FROM m.state_code
      THEN 'STATE_MISMATCHES'
    WHEN m.provider_type = 'home_health' AND hh.state_code IS DISTINCT FROM m.state_code
      THEN 'STATE_MISMATCHES'
    WHEN m.provider_type = 'hospice' AND hs.state_code IS DISTINCT FROM m.state_code
      THEN 'STATE_MISMATCHES'
    ELSE 'EXACT_PROVIDER_MATCHES'
  END AS bucket
FROM matched m
LEFT JOIN other_hits o ON o.ord = m.ord
LEFT JOIN extra_ccn x ON x.ord = m.ord
LEFT JOIN fs_state fs
  ON fs.provider_id = m.provider_id AND m.provider_type = 'nursing_home'
LEFT JOIN hh_state hh
  ON hh.provider_id = m.provider_id AND m.provider_type = 'home_health'
LEFT JOIN hs_state hs
  ON hs.provider_id = m.provider_id AND m.provider_type = 'hospice';
""".strip()


def _gate_sql(expected_observations: int | None = None, expected_email: int | None = None) -> str:
    observation_check = ""
    email_equality = ""
    if expected_observations is not None:
        observation_check = (
            "\n     OR (SELECT count(*) FROM senior_enrich_obs) "
            f"IS DISTINCT FROM {expected_observations}"
        )
    if expected_email is not None:
        email_equality = f"\n     OR email_n IS DISTINCT FROM {expected_email}"
    return f"""
DO $senior_enrich_gate$
DECLARE
  input_n integer;
  exact_n integer;
  email_n integer;
  bad_type integer;
BEGIN
  SELECT count(*) INTO input_n FROM senior_enrich_in;
  SELECT count(*) INTO exact_n
  FROM senior_enrich_classified
  WHERE bucket = 'EXACT_PROVIDER_MATCHES';
  SELECT count(*) INTO email_n
  FROM senior_enrich_obs
  WHERE observation_type = 'email';
  SELECT count(*) INTO bad_type
  FROM senior_enrich_obs
  WHERE observation_type NOT IN (
    'website', 'phone_primary_cms', 'phone_secondary_website', 'email'
  );
  IF input_n IS DISTINCT FROM {EXPECTED_PROVIDER_ROWS}
     OR exact_n IS DISTINCT FROM input_n
     OR email_n > {MAX_PUBLISHABLE_EMAILS}
     OR bad_type IS DISTINCT FROM 0{email_equality}{observation_check} THEN
    RAISE EXCEPTION
      'senior enrich dry run gate failed input=% exact=% email=% bad=%',
      input_n, exact_n, email_n, bad_type;
  END IF;
END
$senior_enrich_gate$;
""".strip()


def _insert_sql() -> str:
    return f"""
WITH dataset AS (
  INSERT INTO source_dataset (dataset_key, source_organization, display_name)
  VALUES (
    '{DATASET_KEY}',
    'Trust Hub',
    'Senior DOT enrichment publish candidate'
  )
  RETURNING id
),
release AS (
  INSERT INTO source_release (
    source_dataset_id, release_key, retrieved_at, content_sha256
  )
  SELECT id, '{RELEASE_SLUG}', timestamptz '{RUN_AT}', '{EXPECTED_SHA256}'
  FROM dataset
  RETURNING id
),
run AS (
  INSERT INTO ingest_run (
    source_release_id, transformation_version, status, started_at, completed_at,
    rows_read, valid_rows, rejected_rows, report
  )
  SELECT id, '{RELEASE_SLUG}', 'succeeded',
    timestamptz '{RUN_AT}', timestamptz '{RUN_AT}',
    {EXPECTED_PROVIDER_ROWS}, {EXPECTED_PROVIDER_ROWS}, 0,
    jsonb_build_object(
      'ingest_run_slug', '{RELEASE_SLUG}',
      'mode', 'rollback_dry_run',
      'source_type', '{SOURCE_TYPE}'
    )
  FROM release
  RETURNING id
),
inserted AS (
  INSERT INTO facility_source_observation (
    provider_id, canonical_ccn, source_type, source_authority, source_identifier,
    source_record_identifier, observation_type, observed_value, normalized_value,
    observed_phone, observed_url, retrieved_at, release_identifier, ingest_run_id,
    provenance, evidence_fingerprint, adapter_version
  )
  SELECT c.provider_id, o.ccn, '{SOURCE_TYPE}',
    '{SOURCE_AUTHORITY}'::facility_source_authority,
    '{SOURCE_IDENTIFIER}', o.ccn, o.observation_type, o.observed_value,
    o.normalized_value, o.observed_phone, o.observed_url,
    timestamptz '{RETRIEVED_AT}', '{RELEASE_SLUG}', run.id, o.provenance,
    o.evidence_fingerprint, '{ADAPTER_VERSION}'
  FROM senior_enrich_obs o
  JOIN senior_enrich_classified c
    ON c.ccn = o.ccn
   AND c.provider_type = o.provider_type
   AND c.bucket = 'EXACT_PROVIDER_MATCHES'
  JOIN run ON true
  RETURNING observation_type, provenance
)
SELECT count(*) INTO obs_n FROM inserted;
""".strip()


def _sequence_count(alias: str) -> str:
    return f"CASE WHEN {alias}.is_called THEN {alias}.last_value ELSE 0 END"


def _result_sql() -> str:
    names = _sequence_names()
    joins = ",\n  ".join(names)
    payload = ",\n    ".join(
        (
            f"'inserted_all', {_sequence_count(names[0])}",
            f"'inserted_website', {_sequence_count(names[1])}",
            f"'inserted_phone_primary_cms', {_sequence_count(names[2])}",
            f"'inserted_phone_secondary_website', {_sequence_count(names[3])}",
            f"'inserted_email', {_sequence_count(names[4])}",
            f"'inserted_strict_observations', {_sequence_count(names[5])}",
            f"'inserted_partial_observations', {_sequence_count(names[6])}",
            "'planned', report.report",
        )
    )
    return "\n".join(
        (
            "SELECT jsonb_build_object(",
            f"    {payload}",
            ") AS dry_run",
            "FROM senior_enrich_dry_report report,",
            f"  {joins};",
        )
    )


def execute_rendered_sql(connection: Any, sql: str, *, mode: str, phrase: str | None) -> None:
    if mode == "commit":
        require_production_authorization(phrase)
    elif mode == "dry_run":
        if _COMMIT_STATEMENT.search(sql) or "SENIOR_ENRICH_DRY_RUN" not in sql:
            raise SeniorEnrichReject("dry run sql does not abort")
    else:
        raise SeniorEnrichReject("unknown execution mode")
    connection.execute(sql)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prepare the Senior DOT enrichment load")
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--commit", action="store_true")
    parser.add_argument("--authorize", default="")
    parser.add_argument("--emit-sql", type=Path)
    parser.add_argument("--artifacts", type=Path)
    parser.add_argument("--prestate-json", type=Path)
    args = parser.parse_args(list(argv) if argv is not None else None)
    if args.commit:
        require_production_authorization(args.authorize)
        print("PRODUCTION_MUTATIONS=0")
        print("Commit execution is not run by this entrypoint.")
        return 2
    if not args.dry_run:
        raise SeniorEnrichReject("choose --dry-run")
    candidates = load_publishable_candidate(args.candidate)
    observations = plan_observations(candidates)
    report = summarize(candidates, observations)
    if args.emit_sql is not None:
        assert_outside_git(args.emit_sql)
        args.emit_sql.parent.mkdir(parents=True, exist_ok=True)
        args.emit_sql.write_text(
            render_dry_run_sql(candidates, observations), encoding="utf-8", newline="\n"
        )
    if args.artifacts is not None:
        assert_outside_git(args.artifacts)
        write_rollback_manifest(args.artifacts / "rollback-manifest.csv", observations)
        metrics: dict[str, str] = {
            "held_email_rows_loaded": "0",
            "planned_email": str(report["email"]),
            "planned_observations": str(report["observations"]),
            "planned_providers": str(report["providers"]),
            "release_identifier": RELEASE_SLUG,
            "source_type": SOURCE_TYPE,
        }
        if args.prestate_json is not None:
            loaded = json.loads(args.prestate_json.read_text(encoding="utf-8"))
            metrics.update({str(key): str(value) for key, value in loaded.items()})
        write_prestate_csv(args.artifacts / "prestate.csv", metrics)
    print(f"DRY_RUN_PROVIDERS={report['providers']}")
    print(f"DRY_RUN_TOTAL_OBSERVATIONS={report['observations']}")
    print(f"DRY_RUN_EMAIL={report['email']}")
    print("HELD_EMAIL_ROWS_LOADED=0")
    print("PRODUCTION_MUTATIONS=0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
