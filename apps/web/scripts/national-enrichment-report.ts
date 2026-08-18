import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const ACQUISITION = "facility-identity-pilot-v2.2-national-acquisition";
const RESOLVER = "facility-identity-pilot-v2.2";

function loadEnvironment(): void {
  for (const relative of [
    ".env.local",
    "../../.env.local",
    "apps/web/.env.local",
    "services/ingest/.env.local",
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
      // Production jobs may inject configuration directly.
    }
  }
}

async function main(): Promise<void> {
  loadEnvironment();
  if (!process.env.CARE_DATABASE_URL) throw new Error("CARE_DATABASE_URL is required");
  const pool = new Pool({
    connectionString: process.env.CARE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 15_000,
  });
  const client = await pool.connect();
  try {
    const report = await client.query<{ report: unknown }>(
      `WITH acquisition AS (
         SELECT * FROM facility_intelligence_run
         WHERE resolver_version=$1 AND status='succeeded'
       ), final_runs AS (
         SELECT DISTINCT ON (f.requested_facility_fingerprint) f.*
         FROM facility_intelligence_run f JOIN acquisition a
           USING (requested_facility_fingerprint)
         WHERE f.resolver_version=$2 AND f.status='succeeded'
         ORDER BY f.requested_facility_fingerprint,f.created_at DESC
       ), final_rows AS (
         SELECT rp.*,f.requested_facility_fingerprint
         FROM final_runs f JOIN facility_intelligence_run_provider rp ON rp.run_id=f.id
       ), qa AS (
         SELECT count(*) FILTER (WHERE selection_metadata#>>'{batchQa,auditKind}'='high_risk') high_risk,
                count(*) FILTER (WHERE selection_metadata#>>'{batchQa,auditKind}'='deterministic_random') random_audits,
                count(*) FILTER (WHERE selection_metadata#>>'{batchQa,auditStatus}'<>'AUDIT_PASS') audit_failures
         FROM final_rows WHERE selection_metadata ? 'batchQa'
       ), request_distribution AS (
         SELECT rp.discovery_requests+rp.details_requests+rp.retry_requests requests
         FROM facility_intelligence_run_provider rp JOIN acquisition a ON a.id=rp.run_id
       ), states AS (
         SELECT final_resolution_state::text state,count(*)::int count FROM final_rows GROUP BY 1
       ), fields AS (
         SELECT c.claim_type,c.resolution_state::text state,count(*)::int count
         FROM final_runs f JOIN facility_claim c
           ON c.resolver_reference='system:' || $2 || ':' || f.id::text
         GROUP BY 1,2
       )
       SELECT jsonb_build_object(
         'runs',jsonb_build_object(
           'batches',(SELECT count(*) FROM acquisition),
           'facilities',(SELECT sum(requested_facility_count) FROM acquisition),
           'startedAt',(SELECT min(started_at) FROM acquisition),
           'completedAt',(SELECT max(completed_at) FROM final_runs)),
         'google',jsonb_build_object(
           'realRequests',(SELECT sum(used_requests) FROM acquisition),
           'discovery',(SELECT sum(discovery_requests) FROM acquisition),
           'details',(SELECT sum(details_requests) FROM acquisition),
           'retries',(SELECT sum(retry_requests) FROM acquisition),
           'cacheHits',(SELECT sum(cache_hits) FROM acquisition),
           'p50',(SELECT percentile_disc(.5) WITHIN GROUP (ORDER BY requests) FROM request_distribution),
           'p95',(SELECT percentile_disc(.95) WITHIN GROUP (ORDER BY requests) FROM request_distribution),
           'maximum',(SELECT max(requests) FROM request_distribution)),
         'resolution',(SELECT coalesce(jsonb_object_agg(state,count),'{}') FROM states),
         'fields',(SELECT coalesce(jsonb_object_agg(claim_type || ':' || state,count),'{}') FROM fields),
         'auditedWebsites',(SELECT count(*) FROM final_runs f JOIN facility_claim c
           ON c.resolver_reference='system:facility-identity-batch-qa-v1:' || f.id::text
           WHERE c.claim_type='google_official_website' AND c.resolution_state='VERIFIED'),
         'qa',(SELECT to_jsonb(qa) FROM qa),
         'integrity',(
           SELECT jsonb_build_object(
             'facilities',count(DISTINCT provider_id),'uniqueCcns',count(DISTINCT identifier_value),
             'publicClaims',(SELECT count(*) FROM facility_claim c
               WHERE c.resolver_reference=$2 AND c.publication_eligible))
           FROM provider_identifier
           WHERE issuer='CMS' AND identifier_type='CCN' AND valid_to IS NULL),
         'reviewReasons',(
           SELECT coalesce(jsonb_object_agg(reason,count),'{}') FROM (
             SELECT CASE
               WHEN reason_codes @> ARRAY['CARE_TYPE_CONFLICT']::text[] THEN 'CARE_TYPE_CONFLICT'
               WHEN reason_codes @> ARRAY['MULTIPLE_PLAUSIBLE_RESULTS']::text[] THEN 'MULTIPLE_PLAUSIBLE_RESULTS'
               WHEN reason_codes @> ARRAY['CAMPUS_AMBIGUITY']::text[] THEN 'CAMPUS_AMBIGUITY'
               WHEN reason_codes @> ARRAY['ADDRESS_CONFLICT']::text[] THEN 'ADDRESS_CONFLICT'
               WHEN reason_codes @> ARRAY['NAME_CONFLICT']::text[] THEN 'NAME_CONFLICT'
               WHEN reason_codes @> ARRAY['PHONE_CONFLICT']::text[] THEN 'PHONE_CONFLICT'
               ELSE 'INSUFFICIENT_EVIDENCE' END reason,count(*)::int count
             FROM final_rows WHERE final_resolution_state='REVIEW_REQUIRED' GROUP BY 1
           ) r),
         'geography',(
           SELECT jsonb_build_object('states',count(DISTINCT p.state),
             'byState',jsonb_object_agg(p.state,p.total),
             'byRegion',(SELECT jsonb_object_agg(region,total) FROM (
               SELECT selection_metadata->>'region' region,count(*)::int total
               FROM final_rows GROUP BY 1) regions))
           FROM (SELECT selection_metadata->>'state' state,count(*)::int total
                 FROM final_rows GROUP BY 1) p)
       ) report`,
      [ACQUISITION, RESOLVER],
    );
    process.stdout.write(`${JSON.stringify(report.rows[0].report, null, 2)}\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
