import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { isIP } from "node:net";
import { Pool } from "pg";

const DEFAULT_HOLDOUT_FINGERPRINT =
  "ab1984ff01960e5c6a6b398241c45e7f07da49034d4774f4b211d9981fefef47";
const TARGET_FINGERPRINT = process.argv[2] ?? DEFAULT_HOLDOUT_FINGERPRINT;
const RESOLVER = "facility-identity-pilot-v2.2";
const AUDITOR = "facility-identity-batch-qa-v1";

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
      // Managed jobs may inject environment variables directly.
    }
  }
}

const normalize = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "").slice(-10);
const stableRank = (value: string) =>
  createHash("sha256").update(`${TARGET_FINGERPRINT}|qa|${value}`).digest("hex");
const STOP = new Set([
  "and",
  "care",
  "center",
  "centre",
  "facility",
  "health",
  "home",
  "inc",
  "llc",
  "nursing",
  "rehab",
  "rehabilitation",
  "the",
]);

function publicHttpsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || host === "localhost" || host.endsWith(".local")) return null;
    const ip = isIP(host);
    if (ip && /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host))
      return null;
    return url;
  } catch {
    return null;
  }
}

async function corroborateWebsite(row: {
  candidate_website: string;
  canonical_name: string;
  cms_address: string | null;
  city: string | null;
  state: string;
  cms_phone: string | null;
}): Promise<{ pass: boolean; reason: string }> {
  const url = publicHttpsUrl(row.candidate_website);
  if (!url) return { pass: false, reason: "URL was not a safe public HTTPS target" };
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
      headers: { "user-agent": "SeniorTrustHub identity validation/1.0" },
    });
    if (!response.ok) return { pass: false, reason: `Official-site response ${response.status}` };
    const text = normalize((await response.text()).slice(0, 1_500_000));
    const distinctive = normalize(row.canonical_name)
      .split(" ")
      .filter((token) => token.length >= 4 && !STOP.has(token));
    const nameMatches = distinctive.filter((token) => text.includes(token)).length;
    const phoneMatch = digits(row.cms_phone).length === 10 && text.includes(digits(row.cms_phone));
    const street = normalize(row.cms_address).match(/^\d+[a-z]?/)?.[0];
    const locationMatch = Boolean(
      (street && text.includes(street) && text.includes(normalize(row.city))) ||
        (text.includes(normalize(row.city)) && text.includes(normalize(row.state))),
    );
    const pass = phoneMatch || (nameMatches >= Math.min(2, distinctive.length) && locationMatch);
    return {
      pass,
      reason: pass
        ? `Official-site content corroborated ${phoneMatch ? "CMS phone" : "facility name and location"}`
        : "Site did not independently corroborate CMS phone or facility name/location",
    };
  } catch {
    return { pass: false, reason: "Official-site validation timed out or failed safely" };
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
    const run = await client.query<{ id: string }>(
      `SELECT id FROM facility_intelligence_run
       WHERE resolver_version=$1 AND requested_facility_fingerprint=$2
       ORDER BY created_at DESC LIMIT 1`,
      [RESOLVER, TARGET_FINGERPRINT],
    );
    if (!run.rowCount) throw new Error("Frozen V2.2 batch run not found");
    const runId = run.rows[0].id;
    const verified = await client.query<{
      provider_id: string;
      candidate_id: string;
      reason_codes: string[];
      matching_features: Array<{ key: string; outcome: string }>;
    }>(
      `SELECT rp.provider_id,c.id candidate_id,rp.reason_codes,c.matching_features
       FROM facility_intelligence_run_provider rp
       JOIN facility_identity_candidate c ON c.id=(rp.selection_metadata#>>'{v2,candidateId}')::uuid
       WHERE rp.run_id=$1 AND rp.final_resolution_state='VERIFIED'`,
      [runId],
    );
    const highRiskCodes = new Set([
      "CAMPUS_AMBIGUITY",
      "MULTIPLE_PLAUSIBLE_RESULTS",
      "NAME_CONFLICT",
      "ADDRESS_CONFLICT",
      "CARE_TYPE_CONFLICT",
      "CORPORATE_VS_FACILITY",
      "WEBSITE_CONFLICT",
      "POSSIBLE_CLOSURE",
    ]);
    const highRisk = verified.rows.filter((row) =>
      row.reason_codes.some((code) => highRiskCodes.has(code)),
    );
    const highRiskIds = new Set(highRisk.map((row) => row.provider_id));
    const ordinary = verified.rows
      .filter((row) => !highRiskIds.has(row.provider_id))
      .sort((a, b) => stableRank(a.provider_id).localeCompare(stableRank(b.provider_id)));
    const randomTarget = Math.min(ordinary.length, Math.max(20, Math.ceil(ordinary.length * 0.02)));
    const sample = [...highRisk, ...ordinary.slice(0, randomTarget)];
    const auditFailures = sample.filter((row) => {
      const feature = new Map(row.matching_features.map((item) => [item.key, item.outcome]));
      return !(
        feature.get("facility_name") === "match" &&
        feature.get("state") === "match" &&
        (feature.get("street_number") === "match" || feature.get("coordinates") === "match")
      );
    });
    if (auditFailures.length)
      throw new Error(`QA_STOP: ${auditFailures.length} sampled VERIFIED identities failed audit`);
    const sampleIds = sample.map((row) => row.provider_id);
    const rows = await client.query<{
      provider_id: string;
      candidate_id: string;
      observation_id: string;
      candidate_website: string;
      canonical_name: string;
      cms_address: string | null;
      city: string | null;
      state: string;
      cms_phone: string | null;
      matching_features: unknown;
      conflicts: unknown;
      prior_claim_id: string;
    }>(
      `SELECT rp.provider_id,c.id candidate_id,c.source_observation_id observation_id,
         c.candidate_website,rp.selection_metadata->>'canonicalName' canonical_name,
         rp.selection_metadata->>'cmsAddress' cms_address,rp.selection_metadata->>'city' city,
         rp.selection_metadata->>'state' state,rp.selection_metadata->>'cmsPhone' cms_phone,
         c.matching_features,c.conflicts,fc.id prior_claim_id
       FROM facility_intelligence_run_provider rp
       JOIN facility_identity_candidate c ON c.id=(rp.selection_metadata#>>'{v2,candidateId}')::uuid
       JOIN facility_claim fc ON fc.provider_id=rp.provider_id
         AND fc.claim_type='google_official_website'
         AND fc.resolver_reference=$2
       WHERE rp.run_id=$1 AND rp.final_resolution_state='VERIFIED'
         AND rp.provider_id=ANY($4::uuid[])
         AND c.candidate_website IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM facility_claim audited
           WHERE audited.provider_id=rp.provider_id
             AND audited.claim_type='google_official_website'
             AND audited.resolver_reference=$3)
       ORDER BY rp.ordinal`,
      [runId, `system:${RESOLVER}:${runId}`, `system:${AUDITOR}:${runId}`, sampleIds],
    );
    let pass = 0;
    let withheld = 0;
    for (const row of rows.rows) {
      const audit = await corroborateWebsite(row);
      if (!audit.pass) {
        withheld += 1;
        continue;
      }
      pass += 1;
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO facility_claim
          (provider_id,claim_type,claim_value,normalized_value,resolution_state,confidence,
           resolution_method,resolution_reason,matching_features,conflicts,threshold_version,
           resolved_at,resolver_reference,review_state,publication_eligible,supersedes_claim_id)
         VALUES ($1,'google_official_website',$2,$3,'VERIFIED',0.99,
           'independent_official_site_corroboration',$4,$5,$6,$7,now(),$8,'decided',false,$9)
         RETURNING id`,
        [
          row.provider_id,
          JSON.stringify(row.candidate_website),
          row.candidate_website.toLowerCase(),
          audit.reason,
          JSON.stringify(row.matching_features),
          JSON.stringify(row.conflicts),
          AUDITOR,
          `system:${AUDITOR}:${runId}`,
          row.prior_claim_id,
        ],
      );
      await client.query(
        `INSERT INTO facility_claim_observation(claim_id,observation_id,evidence_role)
         VALUES ($1,$2,'supporting')`,
        [inserted.rows[0].id, row.observation_id],
      );
    }
    const phone = await client.query<{ verified: string }>(
      `SELECT count(*)::text verified FROM facility_intelligence_run_provider rp
       JOIN facility_identity_candidate c ON c.id=(rp.selection_metadata#>>'{v2,candidateId}')::uuid
       WHERE rp.run_id=$1 AND rp.final_resolution_state='VERIFIED'
         AND rp.provider_id=ANY($2::uuid[])
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.matching_features) f
           WHERE f->>'key'='phone' AND f->>'outcome'='match')`,
      [runId, sampleIds],
    );
    for (const row of sample) {
      await client.query(
        `UPDATE facility_intelligence_run_provider
         SET selection_metadata=jsonb_set(selection_metadata,'{batchQa}',$3::jsonb,true)
         WHERE run_id=$1 AND provider_id=$2`,
        [
          runId,
          row.provider_id,
          JSON.stringify({
            auditStatus: "AUDIT_PASS",
            auditKind: highRiskIds.has(row.provider_id) ? "high_risk" : "deterministic_random",
            auditorVersion: AUDITOR,
          }),
        ],
      );
    }
    console.log(
      `run_id=${runId} verified=${verified.rowCount} audited=${sample.length} high_risk=${highRisk.length} random=${randomTarget} audit_failures=0 websites_checked=${rows.rowCount} websites_verified=${pass} websites_withheld=${withheld} exact_phone_verified=${phone.rows[0].verified}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Holdout field audit failed");
  process.exitCode = 1;
});
