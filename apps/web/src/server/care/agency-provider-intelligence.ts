import "server-only";
import { createHash } from "node:crypto";
import {
  PROVIDER_INTEL_VERSION,
  type AgencyQualityFamily,
  type AgencyQualityMeasure,
  type HomeHealthProviderIntelligence,
  type HospiceProviderIntelligence,
  type ProviderIntelParty,
} from "@care/domain";
import { getCareDatabasePool } from "./db";

const PERSON_POLICY = "SOURCE_EVIDENCE_ONLY_NO_PUBLIC_PROFILE";
const OWNER_CAP = 25;
const MEASURE_CAP = 12;

function fingerprint(obj: Record<string, unknown>): string {
  const body = {
    canonical_id: obj.canonical_id,
    provider_type: obj.provider_type,
    directory: obj.directory,
    quality_summary: obj.quality_summary,
    ownership_summary: obj.ownership_summary,
    chow: obj.chow,
    geography: obj.geography,
    freshness: obj.evidence_as_of_by_family,
    limitations: obj.limitations,
    availability: obj.availability,
  };
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

function bucketOwners(
  rows: Array<{
    relationship_type: string;
    temporal_status: "CURRENT" | "HISTORICAL" | "UNKNOWN";
    party_kind: "organization" | "individual";
    raw_role_text: string;
    ownership_percentage: string | null;
    effective_from: string | null;
    display_name: string;
    party_id: string;
    organization_id: string | null;
    confidence: string;
  }>,
) {
  const buckets = {
    current_owners: [] as ProviderIntelParty[],
    operators: [] as ProviderIntelParty[],
    managers: [] as ProviderIntelParty[],
    enrollment_organizations: [] as ProviderIntelParty[],
    historical_ownership_observations: [] as ProviderIntelParty[],
    unknown_ownership_observations: [] as ProviderIntelParty[],
  };
  const counts: Record<string, number> = {
    current_owners: 0,
    operators: 0,
    managers: 0,
    enrollment_organizations: 0,
    historical_ownership_observations: 0,
    unknown_ownership_observations: 0,
  };
  for (const row of rows) {
    const item: ProviderIntelParty = {
      display_name: row.display_name,
      party_kind: row.party_kind,
      party_id: row.party_id,
      organization_id: row.organization_id,
      relationship_type: row.relationship_type,
      raw_cms_role: row.raw_role_text,
      ownership_percentage: row.ownership_percentage ? Number(row.ownership_percentage) : null,
      temporal_status: row.temporal_status,
      effective_from: row.effective_from,
      confidence: row.confidence,
      person_publication_policy: row.party_kind === "individual" ? PERSON_POLICY : null,
      public_profile: false,
    };
    const key =
      row.relationship_type === "OWNED_BY" && row.temporal_status === "CURRENT"
        ? "current_owners"
        : row.relationship_type === "OWNED_BY" && row.temporal_status === "HISTORICAL"
          ? "historical_ownership_observations"
          : row.relationship_type === "OWNED_BY"
            ? "unknown_ownership_observations"
            : row.relationship_type === "OPERATED_BY"
              ? "operators"
              : row.relationship_type === "MANAGED_BY"
                ? "managers"
                : "enrollment_organizations";
    counts[key] += 1;
    if (buckets[key as keyof typeof buckets].length < OWNER_CAP) {
      buckets[key as keyof typeof buckets].push(item);
    }
  }
  return { ...buckets, counts, unresolved_edges_included: false as const };
}

const unsupportedChow = {
  ownership_change_history_available: false as const,
  reason: "NO_PUBLIC_CMS_CHOW_SOURCE" as const,
  confirmed_event_count: null,
  events: null,
  zero_does_not_mean_no_change_occurred: true as const,
};

async function loadAgencyCore(providerType: "home_health" | "hospice", ccn: string) {
  const canonical = ccn.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(canonical)) throw new RangeError("Invalid CMS CCN");
  const identifierType = providerType === "home_health" ? "HOME_HEALTH_CCN" : "HOSPICE_CCN";
  const pool = getCareDatabasePool();
  const resolved = await pool.query<{
    id: string;
    provider_type: string;
    identifier_type: string;
    identifier_value: string;
  }>(
    `SELECT p.id, p.provider_type, i.identifier_type, i.identifier_value
     FROM provider p
     JOIN provider_identifier i ON i.provider_id=p.id
     WHERE p.provider_type=$1 AND i.identifier_type=$2 AND i.identifier_value=$3`,
    [providerType, identifierType, canonical],
  );
  const identity = resolved.rows[0];
  if (!identity) return null;
  const id = identity.id;
  const freshnessKeys =
    providerType === "home_health"
      ? [
          "home-health-care-agencies",
          "home-health-patient-survey-hhcahps",
          "home-health-agency-all-owners",
          "home-health-zip-codes",
        ]
      : [
          "hospice-general-information",
          "hospice-provider-data",
          "hospice-provider-cahps",
          "hospice-all-owners",
          "hospice-zip-data",
        ];
  const [directory, owners, quality, zipCount, freshness] = await Promise.all([
    pool.query<{ directory_status: string | null }>(
      `SELECT directory_status FROM provider_directory_status
       WHERE provider_id=$1::uuid ORDER BY observed_at DESC, ingested_at DESC LIMIT 1`,
      [id],
    ),
    pool.query<{
      relationship_type: string;
      temporal_status: "CURRENT" | "HISTORICAL" | "UNKNOWN";
      party_kind: "organization" | "individual";
      raw_role_text: string;
      ownership_percentage: string | null;
      effective_from: string | null;
      display_name: string;
      party_id: string;
      organization_id: string | null;
      confidence: string;
    }>(
      `SELECT e.relationship_type, e.temporal_status, e.party_kind, e.raw_role_text,
              e.ownership_percentage::text, e.effective_from::text, op.display_name, op.id AS party_id,
              e.organization_id::text, e.confidence
       FROM provider_organization_edge e
       JOIN ownership_party op ON op.id=e.ownership_party_id
       WHERE e.provider_id=$1::uuid
         AND e.relationship_type IN ('OWNED_BY','OPERATED_BY','MANAGED_BY','ENROLLED_UNDER')
       ORDER BY e.relationship_type, e.temporal_status, op.display_name`,
      [id],
    ),
    pool.query<AgencyQualityMeasure>(
      `SELECT measure_family AS family, measure_code, official_name, reporting_period,
              score::float8 AS score, score_text, star_rating, availability, footnote
       FROM cms_agency_quality_observation
       WHERE provider_id=$1::uuid
       ORDER BY measure_family, official_name`,
      [id],
    ),
    pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM cms_agency_service_zip WHERE provider_id=$1::uuid`,
      [id],
    ),
    pool.query<{
      dataset_key: string;
      freshness_band: string | null;
      source_modified_at: string | null;
      age_days: number | null;
    }>(
      `SELECT dataset_key, freshness_band, source_modified_at::text, age_days
       FROM cms_source_freshness WHERE dataset_key = ANY($1) ORDER BY dataset_key`,
      [freshnessKeys],
    ),
  ]);
  const families = new Map<string, AgencyQualityFamily>();
  for (const row of quality.rows) {
    const item = families.get(row.family) ?? {
      family: row.family,
      observation_count: 0,
      by_availability: {},
      measures: [],
    };
    item.observation_count += 1;
    item.by_availability[row.availability] = (item.by_availability[row.availability] ?? 0) + 1;
    if (item.measures.length < MEASURE_CAP) item.measures.push(row);
    families.set(row.family, item);
  }
  const official = directory.rows[0]?.directory_status ?? null;
  const ownership = bucketOwners(owners.rows);
  const evidence_as_of_by_family = Object.fromEntries(
    freshness.rows.map((row) => [
      row.dataset_key,
      {
        band: row.freshness_band,
        source_modified_at: row.source_modified_at,
        age_days: row.age_days,
      },
    ]),
  );
  return {
    identity,
    id,
    official,
    ownership,
    families: [...families.values()],
    zipCount: Number(zipCount.rows[0]?.n ?? 0),
    evidence_as_of_by_family,
  };
}

export async function getHomeHealthProviderIntelligence(
  ccn: string,
): Promise<HomeHealthProviderIntelligence | null> {
  const core = await loadAgencyCore("home_health", ccn);
  if (!core) return null;
  const pool = getCareDatabasePool();
  const [snapshot, services] = await Promise.all([
    pool.query<{
      provider_name: string;
      address: string | null;
      city: string | null;
      state_code: string;
      zip_code: string | null;
      telephone: string | null;
      quality_of_patient_care_star: number | null;
      quality_of_patient_care_star_footnote: string | null;
      ownership_type: string | null;
    }>(
      `SELECT provider_name, address, city, state_code, zip_code, telephone,
              quality_of_patient_care_star, quality_of_patient_care_star_footnote, ownership_type
       FROM home_health_snapshot WHERE provider_id=$1::uuid ORDER BY id DESC LIMIT 1`,
      [core.id],
    ),
    pool.query<{ code: string; official_field: string; offered: boolean | null }>(
      `SELECT service_code AS code, official_field, offered
       FROM cms_agency_service_offering WHERE provider_id=$1::uuid ORDER BY service_code`,
      [core.id],
    ),
  ]);
  const snap = snapshot.rows[0];
  const star = {
    value: snap?.quality_of_patient_care_star ?? null,
    footnote: snap?.quality_of_patient_care_star_footnote ?? null,
    label: "CMS Quality of Patient Care star" as const,
    not_trust_hub_rating: true as const,
    availability: snap?.quality_of_patient_care_star == null ? "NOT_REPORTED" : "AVAILABLE",
  };
  const projection =
    core.official === "CURRENT_ACTIVE" || snap
      ? "CURRENT_DIRECTORY"
      : core.official === "ABSENT_FROM_CURRENT_DIRECTORY"
        ? "KNOWN_NOT_CURRENT"
        : "KNOWN_NOT_CURRENT";
  const intel: HomeHealthProviderIntelligence = {
    contract_version: PROVIDER_INTEL_VERSION,
    canonical_id: core.identity.identifier_value,
    provider_type: "home_health",
    identifier_type: "HOME_HEALTH_CCN",
    profile_intelligence_status: projection === "KNOWN_NOT_CURRENT" ? "PARTIAL" : snap ? "READY" : "PARTIAL",
    directory: { official_status: core.official, projection },
    common: {
      display_name: snap?.provider_name ?? null,
      legal_name: null,
      office: {
        address: snap?.address ?? null,
        city: snap?.city ?? null,
        state: snap?.state_code ?? null,
        zip: snap?.zip_code ?? null,
        phone: snap?.telephone ?? null,
      },
    },
    home_health: snap
      ? {
          cms_quality_of_patient_care_star: star,
          ownership_type: snap.ownership_type,
          has_core_evidence: true,
        }
      : null,
    quality_summary: {
      cms_quality_of_patient_care_star: star,
      families: core.families,
      synthetic_trust_hub_rating: false,
    },
    services: services.rows,
    ownership_summary: core.ownership,
    chow: unsupportedChow,
    geography: {
      coverage: {
        zip_observation_count: core.zipCount,
        is_verified_county_service_area: false,
        is_verified_service_area: false,
      },
      county_service_area: "UNSUPPORTED",
    },
    evidence_as_of_by_family: core.evidence_as_of_by_family,
    availability: {
      QUALITY: star.value != null || core.families.length ? "AVAILABLE" : "NOT_REPORTED",
      OWNERSHIP: core.ownership.counts.current_owners ? "AVAILABLE" : "NOT_REPORTED",
      CHOW: "UNSUPPORTED",
      ZIP_COVERAGE: core.zipCount ? "AVAILABLE" : "NOT_REPORTED",
      SERVICES: services.rows.length ? "AVAILABLE" : "NOT_REPORTED",
    },
    limitations: [
      "Ownership evidence is not a quality measure.",
      "Missing evidence is not a zero score.",
      "CMS ratings are CMS ratings, not Trust Hub ratings.",
      "CMS ZIP coverage records are not a verified county service area.",
      "CMS does not publish a Home Health ownership-change event file.",
    ],
    person_publication_policy: PERSON_POLICY,
    organization_public_route: false,
    fingerprint: "",
    profile_generated_at: new Date().toISOString(),
  };
  intel.fingerprint = fingerprint(intel as unknown as Record<string, unknown>);
  return intel;
}

export async function getHospiceProviderIntelligence(
  ccn: string,
): Promise<HospiceProviderIntelligence | null> {
  const core = await loadAgencyCore("hospice", ccn);
  if (!core) return null;
  const pool = getCareDatabasePool();
  const snapshot = await pool.query<{
    provider_name: string;
    address_line_1: string | null;
    city: string | null;
    state_code: string;
    zip_code: string | null;
    telephone: string | null;
    ownership_type: string | null;
    county_name: string | null;
  }>(
    `SELECT provider_name, address_line_1, city, state_code, zip_code, telephone,
            ownership_type, county_name
     FROM hospice_snapshot WHERE provider_id=$1::uuid ORDER BY id DESC LIMIT 1`,
    [core.id],
  );
  const snap = snapshot.rows[0];
  const projection =
    core.official === "CURRENT_ACTIVE" || snap
      ? "CURRENT_DIRECTORY"
      : snap
        ? "CURRENT_DIRECTORY"
        : core.families.length
          ? "EVIDENCE_ONLY"
          : "KNOWN_NOT_CURRENT";
  const intel: HospiceProviderIntelligence = {
    contract_version: PROVIDER_INTEL_VERSION,
    canonical_id: core.identity.identifier_value,
    provider_type: "hospice",
    identifier_type: "HOSPICE_CCN",
    profile_intelligence_status:
      projection === "EVIDENCE_ONLY"
        ? "EVIDENCE_ONLY"
        : projection === "KNOWN_NOT_CURRENT"
          ? "PARTIAL"
          : snap
            ? "READY"
            : "PARTIAL",
    directory: { official_status: core.official, projection },
    common: {
      display_name: snap?.provider_name ?? null,
      legal_name: null,
      office: {
        address: snap?.address_line_1 ?? null,
        city: snap?.city ?? null,
        state: snap?.state_code ?? null,
        zip: snap?.zip_code ?? null,
        phone: snap?.telephone ?? null,
      },
    },
    hospice: snap
      ? {
          ownership_type: snap.ownership_type,
          office_county_name: snap.county_name,
          office_county_is_not_service_area: true,
          has_core_evidence: true,
        }
      : null,
    quality_summary: {
      families: core.families,
      synthetic_trust_hub_rating: false,
    },
    ownership_summary: core.ownership,
    chow: unsupportedChow,
    geography: {
      coverage: {
        zip_observation_count: core.zipCount,
        is_verified_county_service_area: false,
        is_verified_service_area: false,
      },
      county_service_area: "UNSUPPORTED",
    },
    evidence_as_of_by_family: core.evidence_as_of_by_family,
    availability: {
      QUALITY: core.families.length ? "AVAILABLE" : "NOT_REPORTED",
      OWNERSHIP: core.ownership.counts.current_owners ? "AVAILABLE" : "NOT_REPORTED",
      CHOW: "UNSUPPORTED",
      ZIP_COVERAGE: core.zipCount ? "AVAILABLE" : "NOT_REPORTED",
    },
    limitations: [
      "Ownership evidence is not a quality measure.",
      "Missing evidence is not a zero score.",
      "CMS ratings are CMS ratings, not Trust Hub ratings.",
      "The Hospice General Information directory is the current-provider denominator.",
      "Quality-only typed CCNs are not current-directory providers.",
      "CMS ZIP coverage records are not a verified county service area.",
      "CMS does not publish a Hospice ownership-change event file.",
    ],
    person_publication_policy: PERSON_POLICY,
    organization_public_route: false,
    fingerprint: "",
    profile_generated_at: new Date().toISOString(),
  };
  intel.fingerprint = fingerprint(intel as unknown as Record<string, unknown>);
  return intel;
}
