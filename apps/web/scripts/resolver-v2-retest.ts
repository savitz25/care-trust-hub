import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import {
  FACILITY_IDENTITY_RESOLVER_V2,
  resolveIdentityCandidateV2,
  type ClaimResolutionV2,
  type IdentityResolutionContextV2,
  type MatchFeature,
  type ResolutionState,
  type WebsiteClassification,
} from "../../../packages/domain/src/facility-intelligence";

const V1_RESOLVER = "facility-identity-pilot-v1";
const V2_ADAPTER = "persisted-google-evidence-v2";
const V2_COHORT = "FACILITY_IDENTITY_RESOLVER_V2_RETEST_2026_08_V1";
const NEW_GOOGLE_REQUEST_LIMIT = 25;

type CandidateRow = {
  id: string;
  provider_id: string;
  external_identifier_value: string;
  candidate_name: string | null;
  candidate_address: string | null;
  candidate_phone: string | null;
  candidate_website: string | null;
  business_status: string | null;
  matching_features: MatchFeature[];
  conflicts: string[];
  confidence: string;
  resolution_state: ResolutionState;
  source_observation_id: string;
};

type ManifestRow = {
  provider_id: string;
  cms_ccn: string;
  ordinal: number;
  selection_metadata: Record<string, unknown>;
  final_resolution_state: ResolutionState;
  reason_codes: string[];
  verified_audit_status: string | null;
};

function loadEnvironment(): void {
  for (const relative of [
    ".env.local",
    "../../.env.local",
    "services/ingest/.env.local",
    "apps/web/.env.local",
  ]) {
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
      // Local env files are optional; CI/managed jobs inject variables.
    }
  }
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

async function findV1Run(client: PoolClient): Promise<string> {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM facility_intelligence_run
     WHERE resolver_version=$1 AND run_mode='pilot' AND requested_facility_count=200
     ORDER BY created_at DESC LIMIT 1`,
    [V1_RESOLVER],
  );
  if (!result.rowCount) throw new Error("Resolver V1 pilot run was not found");
  return result.rows[0].id;
}

async function createV2Run(client: PoolClient, v1RunId: string): Promise<string> {
  const source = await client.query<{
    requested_facility_count: number;
    requested_facility_fingerprint: string;
  }>(
    `SELECT requested_facility_count,requested_facility_fingerprint
     FROM facility_intelligence_run WHERE id=$1`,
    [v1RunId],
  );
  if (!source.rowCount) throw new Error("Source evidence run was not found");
  const expectedCount = source.rows[0].requested_facility_count;
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM facility_intelligence_run
     WHERE resolver_version=$1 AND requested_facility_fingerprint=$2
     ORDER BY created_at DESC LIMIT 1`,
    [FACILITY_IDENTITY_RESOLVER_V2, source.rows[0].requested_facility_fingerprint],
  );
  if (existing.rowCount) return existing.rows[0].id;
  const v1Rows = await client.query<ManifestRow>(
    `SELECT provider_id,cms_ccn,ordinal,selection_metadata,final_resolution_state,
       reason_codes,verified_audit_status
     FROM facility_intelligence_run_provider WHERE run_id=$1 ORDER BY ordinal`,
    [v1RunId],
  );
  if (v1Rows.rowCount !== expectedCount)
    throw new Error(`Expected ${expectedCount} source manifest rows; got ${v1Rows.rowCount}`);
  const fingerprint = sha256(v1Rows.rows.map((row) => row.cms_ccn).join("|"));
  const run = await client.query<{ id: string }>(
    `INSERT INTO facility_intelligence_run
      (source_type,adapter_version,resolver_version,run_mode,status,requested_facility_count,
       maximum_requests,requested_facility_fingerprint,started_at)
     VALUES ('google_places',$1,$2,'pilot','planned',$3,$4,$5,now()) RETURNING id`,
    [
      V2_ADAPTER,
      FACILITY_IDENTITY_RESOLVER_V2,
      expectedCount,
      NEW_GOOGLE_REQUEST_LIMIT,
      fingerprint,
    ],
  );
  const runId = run.rows[0].id;
  for (const row of v1Rows.rows) {
    const metadata = {
      ...row.selection_metadata,
      resolverRetestVersion: V2_COHORT,
      v1: {
        runId: v1RunId,
        state: row.final_resolution_state,
        reasons: row.reason_codes,
        auditStatus: row.verified_audit_status,
      },
      focusGroups: [
        row.final_resolution_state === "VERIFIED" ? "V1_VERIFIED_CONTROL" : null,
        row.selection_metadata.falseNegativeAudit &&
        (row.selection_metadata.falseNegativeAudit as { result?: string }).result ===
          "LIKELY_VALID_CONSERVATIVE"
          ? "LIKELY_VALID_CONSERVATIVE"
          : null,
        ...row.reason_codes,
      ].filter(Boolean),
    };
    await client.query(
      `INSERT INTO facility_intelligence_run_provider
        (run_id,provider_id,cms_ccn,ordinal,status,selection_metadata,reason_codes)
       VALUES ($1,$2,$3,$4,'pending',$5,$6)`,
      [runId, row.provider_id, row.cms_ccn, row.ordinal, metadata, row.reason_codes],
    );
  }
  return runId;
}

function websiteClaim(
  metadata: Record<string, unknown>,
  candidate: CandidateRow,
): ClaimResolutionV2 {
  const prior = (metadata.fieldAudit as { website?: string } | undefined)?.website;
  if (!candidate.candidate_website)
    return { state: "UNRESOLVED", confidence: 0, reason: "No typed HTTPS website candidate" };
  if (prior === "AUDIT_PASS")
    return {
      state: "VERIFIED",
      confidence: 0.99,
      reason: "V1 bounded official-site audit corroborated the URL",
    };
  return {
    state: "REVIEW_REQUIRED",
    confidence: 0,
    reason: "Place identity does not independently verify website role or official status",
  };
}

function classifyWebsite(
  metadata: Record<string, unknown>,
  candidate: CandidateRow,
): WebsiteClassification {
  if (!candidate.candidate_website) return "UNKNOWN";
  let url: URL;
  try {
    url = new URL(candidate.candidate_website);
  } catch {
    return "UNKNOWN";
  }
  if (url.protocol !== "https:") return "INSECURE_HTTP";
  const host = url.hostname.toLowerCase();
  if (/facebook|instagram|linkedin|youtube/.test(host)) return "SOCIAL_MEDIA";
  if (/nursinghomes|caring|senioradvisor|yelp|yellowpages|mapquest/.test(host))
    return "THIRD_PARTY_DIRECTORY";
  if (/aplaceformom|seniorly|assistedliving/.test(host)) return "LEAD_GENERATION";
  const prior = (metadata.fieldAudit as { website?: string } | undefined)?.website;
  if (prior !== "AUDIT_PASS") return "UNKNOWN";
  const facilityName = String(metadata.canonicalName ?? "").toLowerCase();
  if (/hospital|medical center|health system/.test(facilityName))
    return "HEALTH_SYSTEM_FACILITY_PAGE";
  if (url.pathname !== "/" && url.pathname.length > 1) return "OPERATOR_FACILITY_PAGE";
  return "FACILITY_OFFICIAL";
}

function auditIdentity(
  features: MatchFeature[],
  context: IdentityResolutionContextV2,
): { status: "AUDIT_PASS" | "AUDIT_FAIL" | "AUDIT_REQUIRES_REVIEW"; reason: string } {
  const byKey = new Map(features.map((item) => [item.key, item.outcome]));
  const locationMatches =
    byKey.get("street_number") === "match" ||
    byKey.get("address") === "match" ||
    byKey.get("coordinates") === "match";
  const unsafe =
    context.rejectedCandidate ||
    context.careTypeConflict ||
    context.competingPlausibleCandidates > 1 ||
    context.sharedPlaceScope !== "facility_specific" ||
    (context.campusAmbiguity && !context.priorIndependentAuditPass);
  if (unsafe)
    return {
      status: "AUDIT_REQUIRES_REVIEW",
      reason:
        "Independent gate found care-type, campus, shared-identity, rejection, or competitor ambiguity",
    };
  if (byKey.get("facility_name") === "match" && byKey.get("state") === "match" && locationMatches)
    return {
      status: "AUDIT_PASS",
      reason:
        "Independent audit confirmed compatible name, state, physical location, and no unsafe competing identity",
    };
  return {
    status: "AUDIT_REQUIRES_REVIEW",
    reason:
      "Independent audit lacked the required name, state, and physical-location corroboration",
  };
}

function businessStatusClaim(candidate: CandidateRow): ClaimResolutionV2 {
  if (!candidate.business_status)
    return {
      state: "UNRESOLVED",
      confidence: 0,
      reason: "Google business status was not returned",
    };
  if (candidate.business_status === "CLOSED_PERMANENTLY")
    return {
      state: "REVIEW_REQUIRED",
      confidence: 0,
      reason:
        "Commercial closure status conflicts with authority policy until government corroboration",
    };
  return {
    state: "PROBABLE",
    confidence: 0.8,
    reason: "Google operational status is commercial corroboration, not regulatory truth",
  };
}

function placeScope(
  candidate: CandidateRow,
  shared: Map<string, Array<{ providerId: string; confidence: number }>>,
): IdentityResolutionContextV2["sharedPlaceScope"] {
  const uses = shared.get(candidate.external_identifier_value) ?? [];
  if (uses.length <= 1) return "facility_specific";
  const competitors = uses.filter(
    (use) => use.providerId !== candidate.provider_id && use.confidence >= 0.72,
  );
  return competitors.length ? "ambiguous" : "facility_specific";
}

async function insertClaim(
  client: PoolClient,
  runId: string,
  manifest: ManifestRow,
  candidate: CandidateRow,
  claimType: string,
  value: unknown,
  claim: ClaimResolutionV2,
  matchingFeatures: MatchFeature[],
): Promise<void> {
  const resolverReference = `system:${FACILITY_IDENTITY_RESOLVER_V2}:${runId}`;
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO facility_claim
      (provider_id,claim_type,claim_value,normalized_value,resolution_state,confidence,
       resolution_method,resolution_reason,matching_features,conflicts,threshold_version,
       resolved_at,resolver_reference,review_state,publication_eligible)
     VALUES ($1,$2,$3,$4,$5,$6,'claim_specific_identity_v2',$7,$8,$9,$10,now(),$11,$12,false)
     RETURNING id`,
    [
      manifest.provider_id,
      claimType,
      JSON.stringify(value),
      typeof value === "string" ? value.toLowerCase() : null,
      claim.state,
      claim.confidence,
      claim.reason,
      JSON.stringify(matchingFeatures),
      JSON.stringify(candidate.conflicts),
      FACILITY_IDENTITY_RESOLVER_V2,
      resolverReference,
      claim.state === "VERIFIED" ? "decided" : "open",
    ],
  );
  await client.query(
    `INSERT INTO facility_claim_observation(claim_id,observation_id,evidence_role)
     VALUES ($1,$2,$3)`,
    [
      inserted.rows[0].id,
      candidate.source_observation_id,
      claim.state === "REVIEW_REQUIRED" ? "conflicting" : "supporting",
    ],
  );
}

async function runV2(client: PoolClient, v1RunId: string, runId: string): Promise<void> {
  const manifest = await client.query<ManifestRow>(
    `SELECT provider_id,cms_ccn,ordinal,selection_metadata,
       (selection_metadata->'v1'->>'state')::facility_resolution_state final_resolution_state,
       reason_codes,verified_audit_status
     FROM facility_intelligence_run_provider WHERE run_id=$1 AND status='pending' ORDER BY ordinal`,
    [runId],
  );
  const candidates = await client.query<CandidateRow>(
    `SELECT c.* FROM facility_identity_candidate c
     JOIN facility_intelligence_run_provider rp ON rp.provider_id=c.provider_id AND rp.run_id=$1
     WHERE c.source_type='google_places' ORDER BY c.provider_id,c.confidence DESC NULLS LAST,c.created_at DESC`,
    [v1RunId],
  );
  const byProvider = new Map<string, CandidateRow[]>();
  const shared = new Map<string, Array<{ providerId: string; confidence: number }>>();
  for (const candidate of candidates.rows) {
    byProvider.set(candidate.provider_id, [
      ...(byProvider.get(candidate.provider_id) ?? []),
      candidate,
    ]);
    shared.set(candidate.external_identifier_value, [
      ...(shared.get(candidate.external_identifier_value) ?? []),
      { providerId: candidate.provider_id, confidence: Number(candidate.confidence) },
    ]);
  }
  await client.query("UPDATE facility_intelligence_run SET status='running' WHERE id=$1", [runId]);
  for (const row of manifest.rows) {
    const providerCandidates = byProvider.get(row.provider_id) ?? [];
    const top = providerCandidates[0];
    if (!top) throw new Error(`No persisted candidate for pilot CCN ${row.cms_ccn}`);
    const plausible = providerCandidates.filter(
      (candidate) =>
        candidate.resolution_state !== "REJECTED" && Number(candidate.confidence) >= 0.72,
    ).length;
    const context: IdentityResolutionContextV2 = {
      competingPlausibleCandidates: row.reason_codes.includes("MULTIPLE_PLAUSIBLE_RESULTS")
        ? Math.max(2, plausible)
        : Math.max(1, plausible),
      campusAmbiguity: row.reason_codes.includes("CAMPUS_AMBIGUITY"),
      sharedPlaceScope: placeScope(top, shared),
      careTypeConflict: row.reason_codes.includes("CARE_TYPE_CONFLICT"),
      rejectedCandidate: top.resolution_state === "REJECTED",
      priorIndependentAuditPass:
        row.final_resolution_state === "VERIFIED" &&
        (row.selection_metadata.v1 as { auditStatus?: string } | undefined)?.auditStatus ===
          "AUDIT_PASS",
    };
    const features = [...top.matching_features];
    const priorWebsite = (row.selection_metadata.fieldAudit as { website?: string } | undefined)
      ?.website;
    features.push({
      key: "official_domain",
      outcome:
        priorWebsite === "AUDIT_PASS" ? "match" : top.candidate_website ? "missing" : "missing",
      weight: 2,
      reason:
        priorWebsite === "AUDIT_PASS"
          ? "Bounded V1 website audit corroborated official relevance"
          : "Website role remains unverified",
    });
    const decision = resolveIdentityCandidateV2(features, context);
    decision.fieldClaims.website = websiteClaim(row.selection_metadata, top);
    decision.fieldClaims.businessStatus = businessStatusClaim(top);
    const v1State = row.final_resolution_state;
    const newlyPromoted = v1State !== "VERIFIED" && decision.state === "VERIFIED";
    const retainedControl = v1State === "VERIFIED" && decision.state === "VERIFIED";
    const independentAudit = auditIdentity(features, context);
    const auditStatus =
      (newlyPromoted || retainedControl) && independentAudit.status === "AUDIT_PASS"
        ? "AUDIT_PASS"
        : decision.state === "VERIFIED"
          ? independentAudit.status
          : null;
    if (decision.state === "VERIFIED" && auditStatus !== "AUDIT_PASS") {
      decision.state = "REVIEW_REQUIRED";
      decision.reason = `${decision.reason}; independentAudit=${independentAudit.status}`;
    }
    const websiteClassification = classifyWebsite(row.selection_metadata, top);
    const metadata = {
      ...row.selection_metadata,
      v2: {
        state: decision.state,
        confidence: decision.confidence,
        reason: decision.reason,
        context,
        candidateId: top.id,
        placeId: top.external_identifier_value,
        fieldClaims: decision.fieldClaims,
        auditStatus,
        auditReason: independentAudit.reason,
        websiteClassification,
        changedPlaceId: false,
      },
    };
    await client.query(
      `UPDATE facility_intelligence_run_provider SET status=$3,completed_at=now(),
         final_resolution_state=$4,verified_audit_status=$5,selection_metadata=$6,
         candidate_count=$7,reason_codes=$8
       WHERE run_id=$1 AND provider_id=$2`,
      [
        runId,
        row.provider_id,
        decision.state === "VERIFIED" ? "succeeded" : "review_required",
        decision.state,
        auditStatus,
        metadata,
        providerCandidates.length,
        row.reason_codes,
      ],
    );
    const identityClaim: ClaimResolutionV2 = {
      state: decision.state,
      confidence: decision.confidence,
      reason: decision.reason,
    };
    await insertClaim(
      client,
      runId,
      row,
      top,
      "google_place_identity",
      top.external_identifier_value,
      identityClaim,
      features,
    );
    await insertClaim(
      client,
      runId,
      row,
      top,
      "google_public_name",
      top.candidate_name,
      decision.fieldClaims.publicName,
      features,
    );
    await insertClaim(
      client,
      runId,
      row,
      top,
      "google_physical_address",
      top.candidate_address,
      decision.fieldClaims.address,
      features,
    );
    await insertClaim(
      client,
      runId,
      row,
      top,
      "google_public_phone",
      top.candidate_phone,
      decision.fieldClaims.phone,
      features,
    );
    await insertClaim(
      client,
      runId,
      row,
      top,
      "google_official_website",
      top.candidate_website,
      decision.fieldClaims.website,
      features,
    );
    await insertClaim(
      client,
      runId,
      row,
      top,
      "google_business_status",
      top.business_status,
      decision.fieldClaims.businessStatus,
      features,
    );
    await client.query(
      `INSERT INTO facility_resolution_audit_event
        (provider_id,candidate_id,previous_state,new_state,resolver_kind,resolver_reference,
         resolution_method,reason,rule_version,supporting_observation_ids)
       VALUES ($1,$2,$3,$4,'system',$5,'claim_specific_identity_v2',$6,$5,ARRAY[$7]::uuid[])`,
      [
        row.provider_id,
        top.id,
        v1State,
        decision.state,
        FACILITY_IDENTITY_RESOLVER_V2,
        decision.reason,
        top.source_observation_id,
      ],
    );
    if (newlyPromoted) {
      const reviews = await client.query<{ id: string }>(
        `SELECT id FROM facility_review_item WHERE provider_id=$1 AND status IN ('open','in_review','deferred')`,
        [row.provider_id],
      );
      for (const review of reviews.rows) {
        await client.query(
          `INSERT INTO facility_review_action
            (review_item_id,action,previous_state,new_state,actor_kind,actor_reference,
             reason,rule_version,supporting_observation_ids)
           VALUES ($1,'verify','REVIEW_REQUIRED','VERIFIED','system',$2,$3,$2,ARRAY[$4]::uuid[])`,
          [review.id, FACILITY_IDENTITY_RESOLVER_V2, decision.reason, top.source_observation_id],
        );
        await client.query(
          "UPDATE facility_review_item SET status='decided',decided_at=now() WHERE id=$1",
          [review.id],
        );
      }
    }
  }
  const cacheRows = await client.query<{ count: string }>(
    "SELECT count(*)::text count FROM facility_external_request_cache WHERE source_type='google_places'",
  );
  await client.query(
    `UPDATE facility_intelligence_run SET status='succeeded',completed_at=now(),used_requests=0,
       discovery_requests=0,details_requests=0,retry_requests=0,cache_hits=$2,
       successes=(SELECT count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 AND final_resolution_state='VERIFIED'),
       failures=0,unresolved=(SELECT count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 AND final_resolution_state='UNRESOLVED'),
       review_required=(SELECT count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 AND final_resolution_state='REVIEW_REQUIRED'),
       release_fingerprint=$3 WHERE id=$1`,
    [runId, Number(cacheRows.rows[0].count), sha256(`${V2_COHORT}|${runId}|0-google-requests`)],
  );
}

async function report(client: PoolClient, runId: string): Promise<void> {
  const queries = [
    ["run", "SELECT row_to_json(r) FROM facility_intelligence_run r WHERE id=$1"],
    [
      "v1_v2",
      "SELECT selection_metadata->'v1'->>'state' v1,final_resolution_state v2,count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 GROUP BY 1,2 ORDER BY 1,2",
    ],
    [
      "focus",
      "SELECT focus,count(*) FROM facility_intelligence_run_provider CROSS JOIN LATERAL jsonb_array_elements_text(selection_metadata->'focusGroups') focus WHERE run_id=$1 GROUP BY 1 ORDER BY 2 DESC",
    ],
    [
      "focus_state",
      "SELECT focus,final_resolution_state,count(*) FROM facility_intelligence_run_provider CROSS JOIN LATERAL jsonb_array_elements_text(selection_metadata->'focusGroups') focus WHERE run_id=$1 GROUP BY 1,2 ORDER BY 1,2",
    ],
    [
      "selection_groups",
      "SELECT selection_metadata->>'selectedBy' selection_group,count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 GROUP BY 1 ORDER BY 1",
    ],
    [
      "primary_review_reasons",
      `SELECT CASE
         WHEN reason_codes @> ARRAY['CARE_TYPE_CONFLICT']::text[] THEN 'CARE_TYPE_CONFLICT'
         WHEN reason_codes @> ARRAY['MULTIPLE_PLAUSIBLE_RESULTS']::text[] THEN 'MULTIPLE_PLAUSIBLE_RESULTS'
         WHEN reason_codes @> ARRAY['CAMPUS_AMBIGUITY']::text[] THEN 'CAMPUS_AMBIGUITY'
         WHEN reason_codes @> ARRAY['ADDRESS_CONFLICT']::text[] THEN 'ADDRESS_CONFLICT'
         WHEN reason_codes @> ARRAY['NAME_CONFLICT']::text[] THEN 'NAME_CONFLICT'
         WHEN reason_codes @> ARRAY['PHONE_CONFLICT']::text[] THEN 'PHONE_CONFLICT'
         WHEN reason_codes @> ARRAY['INSUFFICIENT_EVIDENCE']::text[] THEN 'INSUFFICIENT_EVIDENCE'
         ELSE 'INSUFFICIENT_EVIDENCE' END primary_reason,count(*)
       FROM facility_intelligence_run_provider WHERE run_id=$1 AND final_resolution_state='REVIEW_REQUIRED'
       GROUP BY 1 ORDER BY 2 DESC`,
    ],
    [
      "fields",
      "SELECT claim_type,resolution_state,count(*) FROM facility_claim WHERE resolver_reference=$1 GROUP BY 1,2 ORDER BY 1,2",
    ],
    [
      "audit",
      "SELECT verified_audit_status,count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 GROUP BY 1 ORDER BY 1",
    ],
    [
      "website_classes",
      "SELECT selection_metadata#>>'{v2,websiteClassification}' class,count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 GROUP BY 1 ORDER BY 2 DESC",
    ],
    [
      "shared_scope",
      "SELECT selection_metadata#>>'{v2,context,sharedPlaceScope}' scope,final_resolution_state,count(*) FROM facility_intelligence_run_provider WHERE run_id=$1 GROUP BY 1,2 ORDER BY 1,2",
    ],
    [
      "rejected_controls",
      "SELECT count(*) FILTER (WHERE c.resolution_state='REJECTED') rejected, count(*) FILTER (WHERE c.resolution_state='REJECTED' AND rp.selection_metadata#>>'{v2,candidateId}'=c.id::text) resurrected FROM facility_identity_candidate c JOIN facility_intelligence_run_provider rp ON rp.provider_id=c.provider_id AND rp.run_id=$1",
    ],
    [
      "integrity",
      "SELECT (SELECT count(DISTINCT provider_id) FROM provider_identifier WHERE issuer='CMS' AND identifier_type='CCN' AND valid_to IS NULL) facilities,(SELECT count(DISTINCT identifier_value) FROM provider_identifier WHERE issuer='CMS' AND identifier_type='CCN' AND valid_to IS NULL) unique_ccns,(SELECT count(*) FROM provider_ownership_relationship) ownership,(SELECT count(*) FROM cms_chain_provider) chains,(SELECT count(*) FROM pbj_staffing_quarter_summary) staffing,(SELECT count(*) FROM facility_claim WHERE resolver_reference LIKE 'system:facility-identity-pilot-v2.%' AND publication_eligible) published_v2_claims",
    ],
    ["reviews", "SELECT status,count(*) FROM facility_review_item GROUP BY 1 ORDER BY 1"],
  ] as const;
  const reference = `system:${FACILITY_IDENTITY_RESOLVER_V2}:${runId}`;
  for (const [name, sql] of queries) {
    const parameters = name === "fields" ? [reference] : sql.includes("$1") ? [runId] : [];
    console.log(`${name}=${JSON.stringify((await client.query(sql, parameters)).rows)}`);
  }
}

async function main(): Promise<void> {
  loadEnvironment();
  if (!process.env.CARE_DATABASE_URL) throw new Error("CARE_DATABASE_URL is required");
  const pool = new Pool({
    connectionString: process.env.CARE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 15_000,
  });
  const client = await pool.connect();
  try {
    const command = process.argv[2];
    const sourceRunId = process.argv[3];
    if (command === "run") {
      const v1RunId = await findV1Run(client);
      await client.query("BEGIN");
      try {
        const runId = await createV2Run(client, v1RunId);
        await runV2(client, v1RunId, runId);
        await client.query("COMMIT");
        console.log(`v2_run_id=${runId} new_google_requests=0`);
        await report(client, runId);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    } else if (command === "holdout" && sourceRunId) {
      await client.query("BEGIN");
      try {
        const runId = await createV2Run(client, sourceRunId);
        await runV2(client, sourceRunId, runId);
        await client.query("COMMIT");
        console.log(`v2_holdout_run_id=${runId} new_google_requests=0`);
        await report(client, runId);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    } else if (command === "report") {
      const run = await client.query<{ id: string }>(
        "SELECT id FROM facility_intelligence_run WHERE resolver_version=$1 ORDER BY created_at DESC LIMIT 1",
        [FACILITY_IDENTITY_RESOLVER_V2],
      );
      if (!run.rowCount) throw new Error("Resolver V2 run not found");
      await report(client, run.rows[0].id);
    } else if (command === "regressions") {
      const rows = await client.query(
        `SELECT cms_ccn,selection_metadata->>'canonicalName' facility,
           selection_metadata#>>'{v2,finalState}' v2_state,
           selection_metadata#>>'{v2,confidence}' confidence,
           selection_metadata#>>'{v2,context,careTypeConflict}' care_conflict,
           selection_metadata#>>'{v2,context,campusAmbiguity}' campus,
           selection_metadata#>>'{v2,context,competingPlausibleCandidates}' competitors,
           selection_metadata#>>'{v2,context,sharedPlaceScope}' shared_scope,
           selection_metadata#>>'{v2,reason}' reason
         FROM facility_intelligence_run_provider
         WHERE run_id=(SELECT id FROM facility_intelligence_run WHERE resolver_version=$1 ORDER BY created_at DESC LIMIT 1)
           AND selection_metadata#>>'{v1,state}'='VERIFIED'
           AND final_resolution_state<>'VERIFIED'
         ORDER BY cms_ccn`,
        [FACILITY_IDENTITY_RESOLVER_V2],
      );
      console.log(JSON.stringify(rows.rows));
    } else
      throw new Error(
        "Usage: resolver-v2-retest.ts run|holdout <source-run-id>|report|regressions",
      );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown Resolver V2 failure");
  process.exitCode = 1;
});
