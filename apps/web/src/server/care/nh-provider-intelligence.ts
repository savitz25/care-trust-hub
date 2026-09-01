import "server-only";
import { createHash } from "node:crypto";
import {
  PROVIDER_INTEL_VERSION,
  type NursingHomeProviderIntelligence,
  type ProviderIntelParty,
} from "@care/domain";
import { getCareDatabasePool } from "./db";

const PERSON_POLICY = "SOURCE_EVIDENCE_ONLY_NO_PUBLIC_PROFILE";
const OWNER_CAP = 25;

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

export async function getNursingHomeProviderIntelligence(
  ccn: string,
): Promise<NursingHomeProviderIntelligence | null> {
  const canonical = ccn.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(canonical)) throw new RangeError("Invalid CMS CCN");
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
     WHERE p.provider_type='nursing_home' AND i.identifier_type='CCN' AND i.identifier_value=$1`,
    [canonical],
  );
  const identity = resolved.rows[0];
  if (!identity) return null;
  const id = identity.id;
  const [directory, snapshot, flags, owners, chow, freshness] = await Promise.all([
    pool.query<{ directory_status: string | null }>(
      `SELECT directory_status FROM provider_directory_status
       WHERE provider_id=$1::uuid ORDER BY observed_at DESC, ingested_at DESC LIMIT 1`,
      [id],
    ),
    pool.query<{
      provider_name: string | null;
      legal_business_name: string | null;
      address: string | null;
      city: string | null;
      state_code: string | null;
      zip_code: string | null;
      telephone: string | null;
      overall_rating: number | null;
      health_inspection_rating: number | null;
      staffing_rating: number | null;
      quality_measure_rating: number | null;
    }>(
      `SELECT provider_name, legal_business_name, address, city, state_code, zip_code, telephone,
              overall_rating, health_inspection_rating, staffing_rating, quality_measure_rating
       FROM facility_snapshot WHERE provider_id=$1::uuid
       ORDER BY observed_at DESC NULLS LAST, id DESC LIMIT 1`,
      [id],
    ),
    pool.query<{ mds: boolean; pbj: boolean; fire: boolean; inspection: boolean; sff: boolean }>(
      `SELECT
         exists(SELECT 1 FROM facility_quality_measure_observation WHERE provider_id=$1::uuid) AS mds,
         exists(SELECT 1 FROM pbj_staffing_day WHERE provider_id=$1::uuid) AS pbj,
         exists(SELECT 1 FROM fire_safety_citation WHERE provider_id=$1::uuid) AS fire,
         exists(SELECT 1 FROM inspection_event WHERE provider_id=$1::uuid) AS inspection,
         exists(SELECT 1 FROM cms_facility_designation
                WHERE provider_id=$1::uuid AND designation_kind='special_focus' AND is_current
                  AND official_status IN ('SFF','SFF_CANDIDATE')) AS sff`,
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
    pool.query<{
      id: string;
      effective_date: string | null;
      change_type_code: string | null;
      change_type_text: string | null;
      normalized_event_type: string | null;
      buyer: string | null;
      seller: string | null;
      source_dataset_key: string | null;
      source_dataset_id: string | null;
      confidence: string | null;
    }>(
      `SELECT e.id::text, e.effective_date::text, e.change_type_code, e.change_type_text,
              e.normalized_event_type, e.raw_record->>'ORGANIZATION NAME - BUYER' AS buyer,
              e.raw_record->>'ORGANIZATION NAME - SELLER' AS seller, e.source_dataset_key,
              e.source_dataset_id, e.confidence
       FROM ownership_change_event e WHERE e.provider_id=$1::uuid
       ORDER BY e.effective_date, e.id`,
      [id],
    ),
    pool.query<{
      dataset_key: string;
      freshness_band: string | null;
      source_modified_at: string | null;
      age_days: number | null;
    }>(
      `SELECT dataset_key, freshness_band, source_modified_at::text, age_days
       FROM cms_source_freshness
       WHERE dataset_key = ANY($1) ORDER BY dataset_key`,
      [
        [
          "nursing-home-provider-information",
          "skilled-nursing-facility-all-owners",
          "skilled-nursing-facility-change-of-ownership",
          "nursing-home-mds-quality-measures",
        ],
      ],
    ),
  ]);

  const official = directory.rows[0]?.directory_status ?? null;
  const projection =
    official === "CURRENT_ACTIVE"
      ? "CURRENT_DIRECTORY"
      : official === "ABSENT_FROM_CURRENT_DIRECTORY"
        ? "KNOWN_NOT_CURRENT"
        : snapshot.rows[0]
          ? "CURRENT_DIRECTORY"
          : "KNOWN_NOT_CURRENT";
  const snap = snapshot.rows[0];
  const evidence = flags.rows[0] ?? {
    mds: false,
    pbj: false,
    fire: false,
    inspection: false,
    sff: false,
  };
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
  for (const row of owners.rows) {
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
    if (buckets[key].length < OWNER_CAP) buckets[key].push(item);
  }
  const events = chow.rows.map((row) => ({
    event_id: row.id,
    effective_date: row.effective_date,
    cms_raw_type_code: row.change_type_code,
    cms_raw_type_text: row.change_type_text,
    normalized_type: row.normalized_event_type,
    buyer_legal_entity: row.buyer,
    seller_legal_entity: row.seller,
    source_dataset_key: row.source_dataset_key,
    source_dataset_id: row.source_dataset_id,
    confidence: row.confidence,
    safe_language: row.effective_date
      ? `CMS records show an ownership change effective ${row.effective_date}.`
      : null,
    not_labeled_sale: true as const,
  }));
  const stars = snap
    ? {
        overall: snap.overall_rating,
        health_inspection: snap.health_inspection_rating,
        staffing: snap.staffing_rating,
        quality_measure: snap.quality_measure_rating,
        label: "CMS rating",
        not_trust_hub_rating: true as const,
        availability: snap.overall_rating === null ? "NOT_REPORTED" : "AVAILABLE",
      }
    : null;
  const status = projection === "KNOWN_NOT_CURRENT" ? "PARTIAL" : snap ? "READY" : "PARTIAL";
  const intel: NursingHomeProviderIntelligence = {
    contract_version: PROVIDER_INTEL_VERSION,
    canonical_id: identity.identifier_value,
    provider_type: "nursing_home",
    identifier_type: "CCN",
    profile_intelligence_status: status,
    directory: { official_status: official, projection },
    common: {
      display_name: snap?.provider_name ?? null,
      legal_name: snap?.legal_business_name ?? null,
      office: {
        address: snap?.address ?? null,
        city: snap?.city ?? null,
        state: snap?.state_code ?? null,
        zip: snap?.zip_code ?? null,
        phone: snap?.telephone ?? null,
      },
    },
    nursing_home: snap ? { cms_stars: stars ?? undefined, has_core_evidence: true } : null,
    quality_summary: {
      cms_stars: stars,
      nh_evidence_flags: evidence,
      synthetic_trust_hub_rating: false,
    },
    ownership_summary: {
      ...buckets,
      counts,
      unresolved_edges_included: false,
    },
    chow: {
      ownership_change_history_available: true,
      confirmed_event_count: events.length,
      events,
    },
    evidence_as_of_by_family: Object.fromEntries(
      freshness.rows.map((row) => [
        row.dataset_key,
        {
          band: row.freshness_band,
          source_modified_at: row.source_modified_at,
          age_days: row.age_days,
        },
      ]),
    ),
    availability: {
      QUALITY: stars?.overall != null ? "AVAILABLE" : "NOT_REPORTED",
      OWNERSHIP: counts.current_owners > 0 ? "AVAILABLE" : "NOT_REPORTED",
      CHOW: events.length > 0 ? "AVAILABLE" : "NOT_REPORTED",
      STAFFING: evidence.pbj ? "AVAILABLE" : "NOT_REPORTED",
      FIRE: evidence.fire ? "AVAILABLE" : "NOT_REPORTED",
      INSPECTIONS: evidence.inspection ? "AVAILABLE" : "NOT_REPORTED",
    },
    limitations: [
      "Ownership evidence is not a quality measure.",
      "Missing evidence is not a zero score.",
      "CMS ratings are CMS ratings, not Trust Hub ratings.",
      "UNKNOWN ownership does not prove an owner left.",
      "CHOW records are CMS transaction records, not Trust Hub judgments or sales.",
    ],
    person_publication_policy: PERSON_POLICY,
    organization_public_route: false,
    fingerprint: "",
    profile_generated_at: new Date().toISOString(),
  };
  intel.fingerprint = fingerprint(intel as unknown as Record<string, unknown>);
  return intel;
}
