import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import {
  discoverGooglePlaceCandidates,
  getGooglePlaceDetails,
  GooglePlacesBudget,
  GooglePlacesError,
  type GooglePlaceCandidate,
  type GooglePlacesOperation,
} from "../src/server/places/google-places";
import { PostgresGooglePlacesCache } from "../src/server/places/postgres-google-places-cache";
import {
  resolveIdentityCandidate,
  type MatchFeature,
  type ResolutionDecision,
  type ResolutionState,
} from "../../../packages/domain/src/facility-intelligence";

const VERSION = "FACILITY_IDENTITY_PILOT_2026_08_V1";
const RESOLVER_VERSION = "facility-identity-pilot-v1";
const MAXIMUM_REQUESTS = 450;
const TARGET_SIZE = 200;
const GOOGLE_SOURCE = "google_places";

type Facility = {
  providerId: string;
  ccn: string;
  name: string;
  legalName: string | null;
  address: string | null;
  city: string | null;
  state: string;
  zip: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  ownershipType: string | null;
  chainId: string | null;
  chainName: string | null;
  chainSize: number;
  hasOwnershipChange: boolean;
  overallRating: number | null;
  similarMarketNames: number;
  marketFacilityCount: number;
};

type SelectedFacility = Facility & {
  strata: string[];
  selectedBy: string;
  region: string;
  selectionReason: string;
};

type RequestStats = {
  search: number;
  details: number;
  retries: number;
  cacheHits: number;
};

const REGION_STATES: Record<string, Set<string>> = {
  Northeast: new Set(["CT", "ME", "MA", "NH", "RI", "VT", "NJ", "NY", "PA"]),
  Southeast: new Set([
    "AL",
    "AR",
    "DC",
    "DE",
    "FL",
    "GA",
    "KY",
    "LA",
    "MD",
    "MS",
    "NC",
    "SC",
    "TN",
    "VA",
    "WV",
  ]),
  Midwest: new Set(["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"]),
  Southwest: new Set(["AZ", "NM", "OK", "TX"]),
  West: new Set(["AK", "CA", "CO", "HI", "ID", "MT", "NV", "OR", "UT", "WA", "WY"]),
};

type FailureCode =
  | "NO_GOOGLE_RESULT"
  | "MULTIPLE_PLAUSIBLE_RESULTS"
  | "NAME_CONFLICT"
  | "ADDRESS_CONFLICT"
  | "PHONE_CONFLICT"
  | "WEBSITE_CONFLICT"
  | "CAMPUS_AMBIGUITY"
  | "POSSIBLE_RENAME"
  | "POSSIBLE_CLOSURE"
  | "CORPORATE_VS_FACILITY"
  | "CARE_TYPE_CONFLICT"
  | "INSUFFICIENT_EVIDENCE"
  | "API_ERROR"
  | "OTHER";

function loadEnvironment(): void {
  for (const relative of [".env.local", "services/ingest/.env.local", "apps/web/.env.local"]) {
    try {
      for (const sourceLine of readFileSync(resolve(relative), "utf8").split(/\r?\n/)) {
        const line = sourceLine.trim();
        if (!line || line.startsWith("#") || !line.includes("=")) continue;
        const [key, ...parts] = line.split("=");
        if (!process.env[key])
          process.env[key] = parts
            .join("=")
            .trim()
            .replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Optional local files; CI and production jobs inject environment variables.
    }
  }
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const normalize = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(incorporated|corporation|corp|inc|llc|ltd)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "").slice(-10);
const tokens = (value: string | null | undefined) =>
  new Set(normalize(value).split(" ").filter(Boolean));
const regionFor = (state: string) =>
  Object.entries(REGION_STATES).find(([, states]) => states.has(state))?.[0] ?? "Other";
const stableRank = (ccn: string, salt: string) => sha256(`${VERSION}|${salt}|${ccn}`);

function jaccard(left: string | null, right: string | null): number {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((value) => b.has(value)).length;
  return intersection / new Set([...a, ...b]).size;
}

function distanceMeters(a: Facility, b: GooglePlaceCandidate): number | null {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null)
    return null;
  const radius = 6_371_000;
  const radians = (value: number) => (value * Math.PI) / 180;
  const lat = radians(b.latitude - a.latitude);
  const lon = radians(b.longitude - a.longitude);
  const value =
    Math.sin(lat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
}

function streetNumber(value: string | null | undefined): string | null {
  return normalize(value).match(/^\d+[a-z]?/)?.[0] ?? null;
}

function careTypeConflict(cmsName: string, candidateName: string | null): boolean {
  const cms = normalize(cmsName);
  const candidate = normalize(candidateName);
  const incompatible = ["assisted living", "home health", "hospice", "outpatient"];
  if (incompatible.some((term) => candidate.includes(term) && !cms.includes(term))) return true;
  return (
    candidate.includes("hospital") && !cms.includes("hospital") && !cms.includes("medical center")
  );
}

function evaluateCandidate(
  facility: Facility,
  candidate: GooglePlaceCandidate,
): {
  decision: ResolutionDecision;
  features: MatchFeature[];
  reasonCodes: FailureCode[];
  distance: number | null;
} {
  const similarity = Math.max(
    jaccard(facility.name, candidate.name),
    jaccard(facility.legalName, candidate.name),
  );
  const candidateAddress = normalize(candidate.address);
  const cmsStreet = streetNumber(facility.address);
  const googleStreet = streetNumber(candidate.address);
  const stateMatch = candidateAddress.includes(` ${facility.state.toLowerCase()} `);
  const zipMatch = Boolean(facility.zip && candidateAddress.includes(facility.zip.slice(0, 5)));
  const cityMatch = Boolean(facility.city && candidateAddress.includes(normalize(facility.city)));
  const streetMatch = Boolean(cmsStreet && googleStreet && cmsStreet === googleStreet);
  const meters = distanceMeters(facility, candidate);
  const phoneMatch = Boolean(
    digits(facility.phone) &&
      digits(candidate.phone) &&
      digits(facility.phone) === digits(candidate.phone),
  );
  const phoneConflict = Boolean(digits(facility.phone) && digits(candidate.phone) && !phoneMatch);
  const typeConflict = careTypeConflict(facility.name, candidate.name);
  const feature = (
    key: MatchFeature["key"],
    outcome: MatchFeature["outcome"],
    weight: number,
    reason: string,
  ): MatchFeature => ({ key, outcome, weight, reason });
  const features: MatchFeature[] = [
    feature(
      "facility_name",
      typeConflict || similarity < 0.25 ? "conflict" : similarity >= 0.52 ? "match" : "missing",
      4,
      `normalized token similarity ${similarity.toFixed(3)}${typeConflict ? "; incompatible care type" : ""}`,
    ),
    feature(
      "street_number",
      streetMatch ? "match" : cmsStreet && googleStreet ? "conflict" : "missing",
      3,
      `CMS ${cmsStreet ?? "missing"}; Google ${googleStreet ?? "missing"}`,
    ),
    feature(
      "city",
      cityMatch ? "match" : facility.city && candidate.address ? "conflict" : "missing",
      1,
      `city ${cityMatch ? "compatible" : "not corroborated"}`,
    ),
    feature(
      "state",
      stateMatch ? "match" : candidate.address ? "conflict" : "missing",
      5,
      `state ${stateMatch ? "matches" : "conflicts or missing"}`,
    ),
    feature(
      "zip",
      zipMatch ? "match" : facility.zip && candidate.address ? "conflict" : "missing",
      3,
      `ZIP ${zipMatch ? "matches" : "conflicts or missing"}`,
    ),
    feature(
      "coordinates",
      meters === null
        ? "missing"
        : meters <= 500
          ? "match"
          : meters > 5_000
            ? "conflict"
            : "missing",
      4,
      meters === null ? "coordinates missing" : `${Math.round(meters)} meters apart`,
    ),
    feature(
      "phone",
      phoneMatch ? "match" : phoneConflict ? "conflict" : "missing",
      4,
      phoneMatch
        ? "normalized phone matches"
        : phoneConflict
          ? "normalized phones conflict"
          : "phone unavailable",
    ),
  ];
  if (typeConflict)
    features.push(
      feature("legal_name", "conflict", 5, "candidate name indicates a different care type"),
    );
  const decision = resolveIdentityCandidate(features);
  const reasonCodes = new Set<FailureCode>();
  if (similarity < 0.25) reasonCodes.add("NAME_CONFLICT");
  if (!streetMatch && cmsStreet && googleStreet) reasonCodes.add("ADDRESS_CONFLICT");
  if (phoneConflict) reasonCodes.add("PHONE_CONFLICT");
  if (typeConflict) reasonCodes.add("CARE_TYPE_CONFLICT");
  if (/hospital|campus|medical center/i.test(facility.name) && similarity < 0.7)
    reasonCodes.add("CAMPUS_AMBIGUITY");
  if (candidate.businessStatus === "CLOSED_PERMANENTLY") reasonCodes.add("POSSIBLE_CLOSURE");
  return { decision, features, reasonCodes: [...reasonCodes], distance: meters };
}

function strataFor(facility: Facility): string[] {
  const name = normalize(facility.name);
  const result: string[] = [];
  if (!facility.chainId && !facility.hasOwnershipChange) result.push("straightforward_independent");
  if (facility.chainSize >= 50) result.push("large_national_chain");
  else if (facility.chainSize >= 5) result.push("regional_chain");
  if (
    /\b(heritage|riverside|oakwood|sunrise|care center|nursing|rehab|rehabilitation)\b/.test(name)
  )
    result.push("common_generic_name");
  if (facility.similarMarketNames > 1) result.push("similar_name_same_market");
  if (facility.hasOwnershipChange) result.push("recent_ownership_or_rename");
  if (/hospital|medical center|campus|health system/.test(name))
    result.push("hospital_campus_associated");
  if (!facility.chainId && facility.marketFacilityCount <= 3) result.push("rural_sparse_web_proxy");
  if (
    facility.phone === null ||
    facility.address === null ||
    facility.latitude === null ||
    (facility.legalName !== null && normalize(facility.legalName) !== normalize(facility.name))
  )
    result.push("address_phone_inconsistency_proxy");
  if (facility.overallRating === null || facility.hasOwnershipChange)
    result.push("business_status_complication_proxy");
  if (name.length > 65 || facility.similarMarketNames > 2 || facility.address === null)
    result.push("deliberately_difficult_edge");
  return result;
}

async function fetchFacilities(client: PoolClient): Promise<Facility[]> {
  const result = await client.query<{
    provider_id: string;
    ccn: string;
    provider_name: string;
    legal_business_name: string | null;
    address: string | null;
    city: string | null;
    state_code: string;
    zip_code: string | null;
    telephone: string | null;
    source_latitude: string | null;
    source_longitude: string | null;
    ownership_type: string | null;
    chain_id: string | null;
    chain_name: string | null;
    chain_size: string;
    has_change: boolean;
    overall_rating: number | null;
    similar_market_names: string;
    market_facility_count: string;
  }>(`
    WITH current_facility AS (
      SELECT DISTINCT ON (fs.provider_id)
        fs.provider_id, pi.identifier_value AS ccn, fs.provider_name, fs.legal_business_name,
        fs.address, fs.city, fs.state_code, fs.zip_code, fs.telephone,
        fs.source_latitude, fs.source_longitude, fs.ownership_type, fs.overall_rating
      FROM facility_snapshot fs
      JOIN provider_identifier pi ON pi.provider_id=fs.provider_id
        AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
      ORDER BY fs.provider_id, fs.observed_at DESC NULLS LAST, fs.created_at DESC
    ), chain_context AS (
      SELECT DISTINCT ON (cp.provider_id) cp.provider_id, cp.chain_id::text, cp.chain_name,
        count(*) OVER (PARTITION BY cp.chain_id) AS chain_size
      FROM cms_chain_provider cp WHERE cp.provider_id IS NOT NULL
      ORDER BY cp.provider_id, cp.source_release_id DESC
    ), named AS (
      SELECT f.*, lower(regexp_replace(f.provider_name,'[^a-zA-Z0-9]+',' ','g')) AS normalized_name
      FROM current_facility f
    )
    SELECT n.*, cc.chain_id, cc.chain_name, coalesce(cc.chain_size,0)::text AS chain_size,
      EXISTS(SELECT 1 FROM ownership_change_event oce WHERE oce.provider_id=n.provider_id) AS has_change,
      count(*) OVER (PARTITION BY n.state_code,n.city,left(n.normalized_name,18))::text AS similar_market_names
      ,count(*) OVER (PARTITION BY n.state_code,n.city)::text AS market_facility_count
    FROM named n LEFT JOIN chain_context cc ON cc.provider_id=n.provider_id
  `);
  return result.rows.map((row) => ({
    providerId: row.provider_id,
    ccn: row.ccn,
    name: row.provider_name,
    legalName: row.legal_business_name,
    address: row.address,
    city: row.city,
    state: row.state_code,
    zip: row.zip_code,
    phone: row.telephone,
    latitude: row.source_latitude === null ? null : Number(row.source_latitude),
    longitude: row.source_longitude === null ? null : Number(row.source_longitude),
    ownershipType: row.ownership_type,
    chainId: row.chain_id,
    chainName: row.chain_name,
    chainSize: Number(row.chain_size),
    hasOwnershipChange: row.has_change,
    overallRating: row.overall_rating,
    similarMarketNames: Number(row.similar_market_names),
    marketFacilityCount: Number(row.market_facility_count),
  }));
}

function selectCohort(facilities: Facility[]): SelectedFacility[] {
  const quotas: Array<[string, number]> = [
    ["straightforward_independent", 25],
    ["large_national_chain", 25],
    ["regional_chain", 20],
    ["common_generic_name", 25],
    ["similar_name_same_market", 20],
    ["recent_ownership_or_rename", 20],
    ["hospital_campus_associated", 15],
    ["rural_sparse_web_proxy", 15],
    ["address_phone_inconsistency_proxy", 15],
    ["business_status_complication_proxy", 10],
    ["deliberately_difficult_edge", 10],
  ];
  const decorated = facilities.map((facility) => ({ facility, strata: strataFor(facility) }));
  const selected = new Map<string, SelectedFacility>();
  for (const [stratum, quota] of quotas) {
    const regionCounts = new Map<string, number>();
    const eligible = decorated
      .filter(({ strata }) => strata.includes(stratum))
      .sort((a, b) =>
        stableRank(a.facility.ccn, stratum).localeCompare(stableRank(b.facility.ccn, stratum)),
      );
    let added = 0;
    for (const entry of eligible) {
      if (added >= quota) break;
      if (selected.has(entry.facility.ccn)) continue;
      const region = regionFor(entry.facility.state);
      if ((regionCounts.get(region) ?? 0) >= Math.ceil(quota / 2)) continue;
      selected.set(entry.facility.ccn, {
        ...entry.facility,
        strata: entry.strata,
        selectedBy: stratum,
        region,
        selectionReason: `Seeded ${VERSION} selection for ${stratum}; additional strata: ${entry.strata.join(", ")}`,
      });
      regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
      added += 1;
    }
    if (added < quota)
      throw new Error(`Insufficient unique facilities for ${stratum}: ${added}/${quota}`);
  }
  if (selected.size !== TARGET_SIZE)
    throw new Error(`Expected ${TARGET_SIZE} facilities; got ${selected.size}`);
  return [...selected.values()].sort((a, b) =>
    stableRank(a.ccn, "manifest").localeCompare(stableRank(b.ccn, "manifest")),
  );
}

function manifestMetadata(facility: SelectedFacility): Record<string, unknown> {
  return {
    cohortVersion: VERSION,
    canonicalName: facility.name,
    cmsAddress: facility.address,
    city: facility.city,
    state: facility.state,
    zip: facility.zip,
    coordinates:
      facility.latitude === null || facility.longitude === null
        ? null
        : { latitude: facility.latitude, longitude: facility.longitude },
    cmsPhone: facility.phone,
    ownershipType: facility.ownershipType,
    chain: facility.chainId
      ? { id: facility.chainId, name: facility.chainName, size: facility.chainSize }
      : null,
    strata: facility.strata,
    selectedBy: facility.selectedBy,
    region: facility.region,
    reason: facility.selectionReason,
  };
}

async function createRun(
  client: PoolClient,
  cohort: SelectedFacility[],
  dryRun: boolean,
): Promise<string> {
  const fingerprint = sha256(cohort.map((facility) => facility.ccn).join("|"));
  const run = await client.query<{ id: string }>(
    `INSERT INTO facility_intelligence_run
      (source_type,adapter_version,resolver_version,run_mode,status,requested_facility_count,
       maximum_requests,requested_facility_fingerprint,started_at)
     VALUES ('google_places','google-places-v1',$1,$2,$3,$4,$5,$6,now()) RETURNING id`,
    [
      RESOLVER_VERSION,
      dryRun ? "dry_run" : "pilot",
      dryRun ? "succeeded" : "planned",
      cohort.length,
      dryRun ? 0 : MAXIMUM_REQUESTS,
      fingerprint,
    ],
  );
  const runId = run.rows[0].id;
  for (const [index, facility] of cohort.entries()) {
    await client.query(
      `INSERT INTO facility_intelligence_run_provider
        (run_id,provider_id,cms_ccn,ordinal,status,selection_metadata)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        runId,
        facility.providerId,
        facility.ccn,
        index + 1,
        dryRun ? "succeeded" : "pending",
        manifestMetadata(facility),
      ],
    );
  }
  if (dryRun)
    await client.query("UPDATE facility_intelligence_run SET completed_at=now() WHERE id=$1", [
      runId,
    ]);
  return runId;
}

function queryFor(facility: Facility): string {
  return [facility.name, facility.address, facility.city, facility.state, facility.zip]
    .filter(Boolean)
    .join(", ");
}

function candidateFingerprint(candidate: GooglePlaceCandidate): string {
  return sha256(JSON.stringify(candidate, Object.keys(candidate).sort()));
}

function safeHttpsUrl(value: string | null | undefined): string | null {
  return value?.startsWith("https://") ? value : null;
}

async function persistCandidate(
  client: PoolClient,
  runId: string,
  facility: Facility,
  candidate: GooglePlaceCandidate,
  evaluation: ReturnType<typeof evaluateCandidate>,
): Promise<string> {
  const fingerprint = candidateFingerprint(candidate);
  let observation = await client.query<{ id: string }>(
    `INSERT INTO facility_source_observation
      (provider_id,canonical_ccn,source_type,source_authority,source_identifier,
       source_record_identifier,observation_type,observed_value,normalized_value,
       observed_name,observed_address,observed_phone,observed_url,observed_location,
       retrieved_at,release_identifier,intelligence_run_id,provenance,evidence_fingerprint,
       adapter_version)
     VALUES ($1,$2,$3,'commercial_corroboration','google_places_api',$4,
       'business_identity_candidate',$5,$6,$7,$8,$9,$10,
       CASE WHEN $11::double precision IS NULL OR $12::double precision IS NULL THEN NULL
         ELSE ST_SetSRID(ST_MakePoint($12,$11),4326)::geography END,
       now(),$13,$14,$15,$16,'google-places-v1')
     ON CONFLICT (source_type,source_identifier,source_record_identifier,observation_type,
       release_identifier,evidence_fingerprint) DO NOTHING
     RETURNING id`,
    [
      facility.providerId,
      facility.ccn,
      GOOGLE_SOURCE,
      candidate.placeId,
      candidate,
      normalize(candidate.name),
      candidate.name,
      candidate.address,
      candidate.phone ?? null,
      safeHttpsUrl(candidate.website),
      candidate.latitude,
      candidate.longitude,
      VERSION,
      runId,
      { fieldScope: "identity_contact_only", requestContainsCredential: false },
      fingerprint,
    ],
  );
  if (!observation.rowCount) {
    observation = await client.query<{ id: string }>(
      `SELECT id FROM facility_source_observation
       WHERE source_type=$1 AND source_identifier='google_places_api'
         AND source_record_identifier=$2 AND observation_type='business_identity_candidate'
         AND release_identifier=$3 AND evidence_fingerprint=$4`,
      [GOOGLE_SOURCE, candidate.placeId, VERSION, fingerprint],
    );
  }
  if (!observation.rowCount) throw new Error("Persisted Google observation could not be located");
  const candidateRow = await client.query<{ id: string }>(
    `INSERT INTO facility_identity_candidate
      (provider_id,canonical_ccn,source_type,external_identifier_namespace,
       external_identifier_value,candidate_name,candidate_address,candidate_phone,
       candidate_website,candidate_location,business_status,matching_features,conflicts,
       confidence,resolution_state,threshold_version,source_observation_id,discovered_at)
     VALUES ($1,$2,$3,'GOOGLE_PLACES',$4,$5,$6,$7,$8,
       CASE WHEN $9::double precision IS NULL OR $10::double precision IS NULL THEN NULL
         ELSE ST_SetSRID(ST_MakePoint($10,$9),4326)::geography END,
       $11,$12,$13,$14,$15,$16,$17,now())
     ON CONFLICT (provider_id,source_type,external_identifier_namespace,
       external_identifier_value,source_observation_id)
     DO UPDATE SET matching_features=EXCLUDED.matching_features,conflicts=EXCLUDED.conflicts,
       confidence=EXCLUDED.confidence,resolution_state=EXCLUDED.resolution_state,
       candidate_phone=EXCLUDED.candidate_phone,candidate_website=EXCLUDED.candidate_website,
       business_status=EXCLUDED.business_status
     RETURNING id`,
    [
      facility.providerId,
      facility.ccn,
      GOOGLE_SOURCE,
      candidate.placeId,
      candidate.name,
      candidate.address,
      candidate.phone ?? null,
      safeHttpsUrl(candidate.website),
      candidate.latitude,
      candidate.longitude,
      candidate.businessStatus ?? null,
      JSON.stringify(evaluation.features),
      JSON.stringify(evaluation.reasonCodes),
      evaluation.decision.confidence,
      evaluation.decision.state,
      RESOLVER_VERSION,
      observation.rows[0].id,
    ],
  );
  return candidateRow.rows[0].id;
}

async function createAudit(
  client: PoolClient,
  facility: Facility,
  candidateId: string,
  previous: ResolutionState,
  next: ResolutionState,
  reason: string,
  observationId?: string,
): Promise<void> {
  await client.query(
    `INSERT INTO facility_resolution_audit_event
      (provider_id,candidate_id,previous_state,new_state,resolver_kind,resolver_reference,
       resolution_method,reason,rule_version,supporting_observation_ids)
     VALUES ($1,$2,$3,$4,'system',$5,'explainable_identity_features',$6,$5,$7)`,
    [
      facility.providerId,
      candidateId,
      previous,
      next,
      RESOLVER_VERSION,
      reason,
      observationId ? [observationId] : [],
    ],
  );
}

async function createReview(
  client: PoolClient,
  facility: Facility,
  candidateId: string,
  evaluations: Array<ReturnType<typeof evaluateCandidate>>,
  reasonCodes: FailureCode[],
): Promise<void> {
  const reviewType = reasonCodes.includes("POSSIBLE_CLOSURE")
    ? "closure_conflict"
    : reasonCodes.includes("CAMPUS_AMBIGUITY")
      ? "authority_conflict"
      : reasonCodes.includes("PHONE_CONFLICT")
        ? "phone_conflict"
        : reasonCodes.includes("ADDRESS_CONFLICT")
          ? "address_conflict"
          : "multiple_candidates";
  await client.query(
    `INSERT INTO facility_review_item
      (provider_id,candidate_id,review_type,evidence_summary)
     SELECT $1,$2,$3,$4
     WHERE NOT EXISTS (SELECT 1 FROM facility_review_item WHERE provider_id=$1 AND candidate_id=$2 AND status IN ('open','in_review','deferred'))`,
    [
      facility.providerId,
      candidateId,
      reviewType,
      {
        canonical: {
          ccn: facility.ccn,
          name: facility.name,
          address: facility.address,
          city: facility.city,
          state: facility.state,
          zip: facility.zip,
          phone: facility.phone,
        },
        reasonCodes,
        sourceAuthority: "commercial_corroboration",
        resolverVersion: RESOLVER_VERSION,
        evaluations,
      },
    ],
  );
}

async function processFacility(
  client: PoolClient,
  runId: string,
  facility: SelectedFacility,
  budget: GooglePlacesBudget,
  cache: PostgresGooglePlacesCache,
): Promise<void> {
  const stats: RequestStats = { search: 0, details: 0, retries: 0, cacheHits: 0 };
  const options = {
    budget,
    cache,
    maximumCandidates: 5,
    retryLimit: 1,
    timeoutMs: 8_000,
    onRequest: ({ operation, attempt }: { operation: GooglePlacesOperation; attempt: number }) => {
      stats[operation] += 1;
      if (attempt > 0) stats.retries += 1;
    },
    onCacheHit: () => {
      stats.cacheHits += 1;
    },
  };
  await client.query(
    "UPDATE facility_intelligence_run_provider SET status='running',attempt_count=attempt_count+1 WHERE run_id=$1 AND provider_id=$2",
    [runId, facility.providerId],
  );
  try {
    const discovered = await discoverGooglePlaceCandidates(queryFor(facility), options);
    if (!discovered.length) {
      await client.query(
        `UPDATE facility_intelligence_run_provider SET status='unresolved',completed_at=now(),discovery_requests=discovery_requests+$3,details_requests=details_requests+$4,retry_requests=retry_requests+$5,cache_hits=cache_hits+$6,candidate_count=0,final_resolution_state='UNRESOLVED',reason_codes=ARRAY['NO_GOOGLE_RESULT'] WHERE run_id=$1 AND provider_id=$2`,
        [runId, facility.providerId, stats.search, stats.details, stats.retries, stats.cacheHits],
      );
      return;
    }
    const evaluated = discovered.map((candidate) => ({
      candidate,
      ...evaluateCandidate(facility, candidate),
    }));
    evaluated.sort((a, b) => b.decision.confidence - a.decision.confidence);
    const discoveryTop = evaluated[0];
    const plausible =
      discoveryTop.decision.state !== "REJECTED" &&
      !discoveryTop.reasonCodes.includes("CARE_TYPE_CONFLICT") &&
      (discoveryTop.distance === null || discoveryTop.distance <= 5_000);
    if (plausible) {
      const details = await getGooglePlaceDetails(discoveryTop.candidate.placeId, options);
      evaluated[0] = { candidate: details, ...evaluateCandidate(facility, details) };
      evaluated.sort((a, b) => b.decision.confidence - a.decision.confidence);
    }
    const persisted: Array<{ id: string; evaluation: (typeof evaluated)[number] }> = [];
    for (const entry of evaluated)
      persisted.push({
        id: await persistCandidate(client, runId, facility, entry.candidate, entry),
        evaluation: entry,
      });
    const top = persisted[0];
    const plausibleCount = persisted.filter(
      ({ evaluation }) =>
        evaluation.decision.state === "VERIFIED" || evaluation.decision.state === "PROBABLE",
    ).length;
    const reasonCodes = new Set<FailureCode>(top.evaluation.reasonCodes);
    let state = top.evaluation.decision.state;
    if (plausibleCount > 1) {
      state = "REVIEW_REQUIRED";
      reasonCodes.add("MULTIPLE_PLAUSIBLE_RESULTS");
    }
    if (state === "REVIEW_REQUIRED" && !reasonCodes.size) reasonCodes.add("INSUFFICIENT_EVIDENCE");
    await client.query("UPDATE facility_identity_candidate SET resolution_state=$2 WHERE id=$1", [
      top.id,
      state,
    ]);
    await createAudit(
      client,
      facility,
      top.id,
      "UNRESOLVED",
      state,
      `${top.evaluation.decision.reason}; ${[...reasonCodes].join(",") || "no conflicts"}`,
    );
    if (state === "REVIEW_REQUIRED")
      await createReview(
        client,
        facility,
        top.id,
        persisted.map(({ evaluation }) => evaluation),
        [...reasonCodes],
      );
    await client.query(
      `UPDATE facility_intelligence_run_provider SET status=$3,completed_at=now(),last_error_code=NULL,discovery_requests=discovery_requests+$4,details_requests=details_requests+$5,retry_requests=retry_requests+$6,cache_hits=cache_hits+$7,candidate_count=$8,final_resolution_state=$9,reason_codes=$10 WHERE run_id=$1 AND provider_id=$2`,
      [
        runId,
        facility.providerId,
        state === "VERIFIED" || state === "PROBABLE"
          ? "succeeded"
          : state === "REVIEW_REQUIRED"
            ? "review_required"
            : "unresolved",
        stats.search,
        stats.details,
        stats.retries,
        stats.cacheHits,
        persisted.length,
        state,
        [...reasonCodes],
      ],
    );
  } catch (error) {
    const code = error instanceof GooglePlacesError ? error.code : "OTHER";
    if (!(error instanceof GooglePlacesError)) {
      const databaseCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : "unknown";
      const constraint =
        typeof error === "object" && error !== null && "constraint" in error
          ? String((error as { constraint: unknown }).constraint)
          : "unknown";
      console.error(`Pilot persistence failure code=${databaseCode} constraint=${constraint}`);
    }
    await client.query(
      `UPDATE facility_intelligence_run_provider SET status='failed',completed_at=now(),last_error_code=$3,discovery_requests=discovery_requests+$4,details_requests=details_requests+$5,retry_requests=retry_requests+$6,cache_hits=cache_hits+$7,final_resolution_state='UNRESOLVED',reason_codes=ARRAY['API_ERROR'] WHERE run_id=$1 AND provider_id=$2`,
      [
        runId,
        facility.providerId,
        code,
        stats.search,
        stats.details,
        stats.retries,
        stats.cacheHits,
      ],
    );
    if (code === "BUDGET_EXCEEDED") throw error;
  }
}

async function runPilot(pool: Pool, runId: string, facilityLimit?: number): Promise<void> {
  const client = await pool.connect();
  try {
    const run = await client.query<{ maximum_requests: number; used_requests: number }>(
      "SELECT maximum_requests,used_requests FROM facility_intelligence_run WHERE id=$1 AND run_mode='pilot'",
      [runId],
    );
    if (!run.rowCount) throw new Error("Pilot run not found");
    const remainingBudget = run.rows[0].maximum_requests - run.rows[0].used_requests;
    const budget = new GooglePlacesBudget(remainingBudget, false);
    const cache = new PostgresGooglePlacesCache(pool, runId);
    await client.query(
      "UPDATE facility_intelligence_run SET status='running',started_at=coalesce(started_at,now()) WHERE id=$1",
      [runId],
    );
    const rows = await client.query<
      { selection_metadata: ReturnType<typeof manifestMetadata> } & {
        provider_id: string;
        cms_ccn: string;
      }
    >(
      `SELECT provider_id,cms_ccn,selection_metadata FROM facility_intelligence_run_provider WHERE run_id=$1 AND status IN ('pending','running','failed') ORDER BY ordinal`,
      [runId],
    );
    for (const row of rows.rows.slice(0, facilityLimit)) {
      const metadata = row.selection_metadata as Record<string, unknown>;
      const facility: SelectedFacility = {
        providerId: row.provider_id,
        ccn: row.cms_ccn,
        name: String(metadata.canonicalName),
        legalName: null,
        address: metadata.cmsAddress as string | null,
        city: metadata.city as string | null,
        state: String(metadata.state),
        zip: metadata.zip as string | null,
        phone: metadata.cmsPhone as string | null,
        latitude: (metadata.coordinates as { latitude?: number } | null)?.latitude ?? null,
        longitude: (metadata.coordinates as { longitude?: number } | null)?.longitude ?? null,
        ownershipType: metadata.ownershipType as string | null,
        chainId: (metadata.chain as { id?: string } | null)?.id ?? null,
        chainName: (metadata.chain as { name?: string } | null)?.name ?? null,
        chainSize: Number((metadata.chain as { size?: number } | null)?.size ?? 0),
        hasOwnershipChange: (metadata.strata as string[]).includes("recent_ownership_or_rename"),
        overallRating: null,
        similarMarketNames: 0,
        marketFacilityCount: 0,
        strata: metadata.strata as string[],
        selectedBy: String(metadata.selectedBy),
        region: String(metadata.region),
        selectionReason: String(metadata.reason),
      };
      try {
        await processFacility(client, runId, facility, budget, cache);
      } finally {
        await client.query(
          `UPDATE facility_intelligence_run r SET used_requests=x.requests,discovery_requests=x.discovery,details_requests=x.details,retry_requests=x.retries,cache_hits=x.cache_hits FROM (SELECT coalesce(sum(discovery_requests+details_requests),0)::int requests,coalesce(sum(discovery_requests),0)::int discovery,coalesce(sum(details_requests),0)::int details,coalesce(sum(retry_requests),0)::int retries,coalesce(sum(cache_hits),0)::int cache_hits FROM facility_intelligence_run_provider WHERE run_id=$1) x WHERE r.id=$1`,
          [runId],
        );
      }
    }
    await client.query(
      `UPDATE facility_intelligence_run r SET status=CASE WHEN EXISTS(SELECT 1 FROM facility_intelligence_run_provider WHERE run_id=$1 AND status='failed' AND last_error_code='BUDGET_EXCEEDED') THEN 'budget_exhausted' WHEN EXISTS(SELECT 1 FROM facility_intelligence_run_provider WHERE run_id=$1 AND status IN ('pending','running','failed')) THEN 'running' ELSE 'succeeded' END,completed_at=CASE WHEN EXISTS(SELECT 1 FROM facility_intelligence_run_provider WHERE run_id=$1 AND status IN ('pending','running','failed')) THEN NULL ELSE now() END,successes=(SELECT count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 AND status='succeeded'),failures=(SELECT count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 AND status='failed'),unresolved=(SELECT count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 AND final_resolution_state='UNRESOLVED'),review_required=(SELECT count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 AND final_resolution_state='REVIEW_REQUIRED'),release_fingerprint=$2 WHERE id=$1`,
      [runId, sha256(`${VERSION}|${RESOLVER_VERSION}|${budget.usedRequests}`)],
    );
  } finally {
    client.release();
  }
}

async function independentAudit(pool: Pool, runId: string): Promise<void> {
  const client = await pool.connect();
  try {
    const rows = await client.query<{
      provider_id: string;
      candidate_id: string;
      confidence: string;
      matching_features: MatchFeature[];
      conflicts: FailureCode[];
      business_status: string | null;
      candidate_name: string | null;
      candidate_address: string | null;
      candidate_phone: string | null;
      candidate_website: string | null;
      selection_metadata: Record<string, unknown>;
    }>(
      `
      SELECT rp.provider_id,c.id candidate_id,c.confidence::text,c.matching_features,c.conflicts,
        c.business_status,c.candidate_name,c.candidate_address,c.candidate_phone,c.candidate_website,
        rp.selection_metadata
      FROM facility_intelligence_run_provider rp
      JOIN LATERAL (SELECT * FROM facility_identity_candidate c WHERE c.provider_id=rp.provider_id AND c.source_type='google_places' ORDER BY confidence DESC NULLS LAST,created_at DESC LIMIT 1) c ON true
      WHERE rp.run_id=$1 AND rp.final_resolution_state='VERIFIED' ORDER BY rp.ordinal`,
      [runId],
    );
    for (const row of rows.rows) {
      const matches = row.matching_features.filter((feature) => feature.outcome === "match");
      const name = row.matching_features.find((feature) => feature.key === "facility_name");
      const address = row.matching_features.find((feature) => feature.key === "street_number");
      const state = row.matching_features.find((feature) => feature.key === "state");
      const coordinates = row.matching_features.find((feature) => feature.key === "coordinates");
      const metadata = row.selection_metadata;
      const typeConflict = careTypeConflict(String(metadata.canonicalName), row.candidate_name);
      const criticalConflict =
        typeConflict ||
        state?.outcome !== "match" ||
        (address?.outcome !== "match" && coordinates?.outcome !== "match");
      const strongIndependentEvidence =
        name?.outcome === "match" && matches.length >= 4 && !criticalConflict;
      const auditStatus = criticalConflict
        ? "AUDIT_FAIL"
        : strongIndependentEvidence
          ? "AUDIT_PASS"
          : "AUDIT_REQUIRES_REVIEW";
      const nextState: ResolutionState =
        auditStatus === "AUDIT_PASS" ? "VERIFIED" : "REVIEW_REQUIRED";
      await client.query(
        "UPDATE facility_identity_candidate SET resolution_state=$2,reviewed_at=now() WHERE id=$1",
        [row.candidate_id, nextState],
      );
      await client.query(
        "UPDATE facility_intelligence_run_provider SET final_resolution_state=$3::facility_resolution_state,verified_audit_status=$4,status=CASE WHEN $3::facility_resolution_state='VERIFIED' THEN 'succeeded' ELSE 'review_required' END WHERE run_id=$1 AND provider_id=$2",
        [runId, row.provider_id, nextState, auditStatus],
      );
      await client.query(
        `INSERT INTO facility_resolution_audit_event(provider_id,candidate_id,previous_state,new_state,resolver_kind,resolver_reference,resolution_method,reason,rule_version) VALUES($1,$2,'VERIFIED',$3,'system',$4,'independent_evidence_audit',$5,$4)`,
        [
          row.provider_id,
          row.candidate_id,
          nextState,
          `${RESOLVER_VERSION}-audit-v1`,
          `${auditStatus}: independently checked name, location, address, state, phone, care type, and competing-candidate handling`,
        ],
      );
      if (nextState === "REVIEW_REQUIRED") {
        const facility = {
          providerId: row.provider_id,
          ccn: "",
          name: String(metadata.canonicalName),
          address: metadata.cmsAddress as string | null,
          city: metadata.city as string | null,
          state: String(metadata.state),
          zip: metadata.zip as string | null,
          phone: metadata.cmsPhone as string | null,
        } as Facility;
        await createReview(
          client,
          facility,
          row.candidate_id,
          [],
          [criticalConflict ? "CARE_TYPE_CONFLICT" : "INSUFFICIENT_EVIDENCE"],
        );
      } else {
        const observation = await client.query<{ source_observation_id: string }>(
          "SELECT source_observation_id FROM facility_identity_candidate WHERE id=$1",
          [row.candidate_id],
        );
        await client.query(
          `INSERT INTO facility_external_identifier(provider_id,namespace,identifier_type,identifier_value,normalized_value,source_observation_id,verification_state,verified_at) SELECT $1,'GOOGLE_PLACES','PLACE_ID',external_identifier_value,external_identifier_value,$3,'VERIFIED',now() FROM facility_identity_candidate WHERE id=$2 ON CONFLICT DO NOTHING`,
          [row.provider_id, row.candidate_id, observation.rows[0].source_observation_id],
        );
      }
    }
    await client.query(
      `UPDATE facility_intelligence_run r SET successes=(SELECT count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 AND final_resolution_state IN ('VERIFIED','PROBABLE')),review_required=(SELECT count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 AND final_resolution_state='REVIEW_REQUIRED') WHERE id=$1`,
      [runId],
    );
  } finally {
    client.release();
  }
}

async function normalizeGoogleObservationScope(client: PoolClient, runId: string): Promise<number> {
  const rows = await client.query<{
    id: string;
    external_identifier_value: string;
    observed_value: unknown;
    normalized_value: string | null;
    observed_name: string | null;
    observed_address: string | null;
    observed_phone: string | null;
    observed_url: string | null;
    observed_location_wkt: string | null;
    retrieved_at: Date;
    evidence_fingerprint: string;
  }>(
    `
    SELECT DISTINCT ON (c.external_identifier_value)
      o.id,c.external_identifier_value,o.observed_value,o.normalized_value,o.observed_name,
      o.observed_address,o.observed_phone,o.observed_url,
      CASE WHEN o.observed_location IS NULL THEN NULL ELSE ST_AsText(o.observed_location::geometry) END observed_location_wkt,
      o.retrieved_at,o.evidence_fingerprint
    FROM facility_identity_candidate c
    JOIN facility_source_observation o ON o.id=c.source_observation_id
    JOIN facility_intelligence_run_provider rp ON rp.provider_id=c.provider_id AND rp.run_id=$1
    WHERE c.source_type='google_places' AND o.provider_id IS NOT NULL
    ORDER BY c.external_identifier_value,o.retrieved_at DESC`,
    [runId],
  );
  let changed = 0;
  for (const row of rows.rows) {
    const fingerprint = sha256(`${row.evidence_fingerprint}|source-scoped-v2`);
    const inserted = await client.query<{ id: string }>(
      `
      INSERT INTO facility_source_observation
        (provider_id,canonical_ccn,source_type,source_authority,source_identifier,
         source_record_identifier,observation_type,observed_value,normalized_value,
         observed_name,observed_address,observed_phone,observed_url,observed_location,
         retrieved_at,release_identifier,intelligence_run_id,provenance,evidence_fingerprint,
         adapter_version,supersedes_observation_id)
      VALUES (NULL,NULL,'google_places','commercial_corroboration','google_places_api',$1,
        'business_identity_candidate',$2,$3,$4,$5,$6,$7,
        CASE WHEN $8::text IS NULL THEN NULL ELSE ST_GeogFromText($8) END,
        $9,$10,$11,$12,$13,'google-places-v2',$14)
      ON CONFLICT (source_type,source_identifier,source_record_identifier,observation_type,
        release_identifier,evidence_fingerprint) DO NOTHING RETURNING id`,
      [
        row.external_identifier_value,
        row.observed_value,
        row.normalized_value,
        row.observed_name,
        row.observed_address,
        row.observed_phone,
        row.observed_url,
        row.observed_location_wkt,
        row.retrieved_at,
        VERSION,
        runId,
        { fieldScope: "source_identity_only", canonicalAssociation: "candidate_table" },
        fingerprint,
        row.id,
      ],
    );
    const observationId =
      inserted.rows[0]?.id ??
      (
        await client.query<{ id: string }>(
          `SELECT id FROM facility_source_observation WHERE source_type='google_places' AND source_record_identifier=$1 AND release_identifier=$2 AND evidence_fingerprint=$3`,
          [row.external_identifier_value, VERSION, fingerprint],
        )
      ).rows[0]?.id;
    if (!observationId) throw new Error("Source-scoped Google observation could not be located");
    await client.query(
      "UPDATE facility_identity_candidate SET source_observation_id=$2 WHERE source_type='google_places' AND external_identifier_value=$1",
      [row.external_identifier_value, observationId],
    );
    await client.query(
      "UPDATE facility_external_identifier SET source_observation_id=$2 WHERE namespace='GOOGLE_PLACES' AND identifier_value=$1",
      [row.external_identifier_value, observationId],
    );
    changed += 1;
  }
  return changed;
}

async function summary(client: PoolClient, runId: string): Promise<void> {
  const queries = [
    ["run", "SELECT row_to_json(r) FROM facility_intelligence_run r WHERE id=$1"],
    [
      "resolution",
      "SELECT final_resolution_state,count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 GROUP BY 1 ORDER BY 1",
    ],
    [
      "audit",
      "SELECT verified_audit_status,count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 GROUP BY 1 ORDER BY 1",
    ],
    [
      "requests",
      "SELECT discovery_requests+details_requests requests,count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 GROUP BY 1 ORDER BY 1",
    ],
    [
      "reasons",
      "SELECT reason,count(*) FROM facility_intelligence_run_provider CROSS JOIN unnest(reason_codes) reason WHERE run_id=$1 GROUP BY 1 ORDER BY 2 DESC",
    ],
    [
      "states",
      "SELECT selection_metadata->>'state' state,count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 GROUP BY 1 ORDER BY 2 DESC",
    ],
    [
      "regions",
      "SELECT selection_metadata->>'region' region,count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 GROUP BY 1 ORDER BY 1",
    ],
  ] as const;
  for (const [name, sql] of queries)
    console.log(`${name}=${JSON.stringify((await client.query(sql, [runId])).rows)}`);
}

async function main(): Promise<void> {
  loadEnvironment();
  if (!process.env.CARE_DATABASE_URL) throw new Error("CARE_DATABASE_URL is required");
  const command = process.argv[2];
  const argument = process.argv[3];
  const pool = new Pool({
    connectionString: process.env.CARE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 15_000,
  });
  const client = await pool.connect();
  try {
    if (command === "cohort") {
      const cohort = selectCohort(await fetchFacilities(client));
      if (argument === "--dry-run") {
        console.log(
          `dry_run=true facilities=${cohort.length} fingerprint=${sha256(cohort.map((f) => f.ccn).join("|"))}`,
        );
        console.log(
          `states=${new Set(cohort.map((f) => f.state)).size} regions=${new Set(cohort.map((f) => f.region)).size} external_requests=0`,
        );
      } else {
        await client.query("BEGIN");
        try {
          const runId = await createRun(client, cohort, argument === "--persist-dry-run");
          await client.query("COMMIT");
          console.log(`run_id=${runId} facilities=${cohort.length}`);
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    } else if (command === "run" && argument) {
      const limitArgument = process.argv[4];
      const facilityLimit = limitArgument?.startsWith("--limit=")
        ? Number(limitArgument.slice("--limit=".length))
        : undefined;
      if (facilityLimit !== undefined && (!Number.isInteger(facilityLimit) || facilityLimit < 1))
        throw new Error("--limit must be a positive integer");
      await runPilot(pool, argument, facilityLimit);
      const summaryClient = await pool.connect();
      try {
        await summary(summaryClient, argument);
      } finally {
        summaryClient.release();
      }
    } else if (command === "audit" && argument) {
      await independentAudit(pool, argument);
      const summaryClient = await pool.connect();
      try {
        await summary(summaryClient, argument);
      } finally {
        summaryClient.release();
      }
    } else if (command === "summary" && argument) await summary(client, argument);
    else if (command === "normalize-observations" && argument) {
      const changed = await normalizeGoogleObservationScope(client, argument);
      console.log(`source_scoped_google_observations=${changed}`);
    } else
      throw new Error(
        "Usage: cohort --dry-run|--persist-dry-run|--persist, run <run-id>, audit <run-id>, summary <run-id>",
      );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown pilot failure";
  console.error(message);
  process.exitCode = 1;
});
