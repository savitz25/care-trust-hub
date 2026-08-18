import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

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
        if (key && !process.env[key])
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
    const sql = readFileSync(
      resolve(process.cwd(), "db/migrations/0014_publish_verified_consumer_enrichment.sql"),
      "utf8",
    );
    await client.query(sql);
    const report = await client.query(
      `SELECT
         (SELECT count(DISTINCT provider_id) FROM provider_identifier
           WHERE issuer='CMS' AND identifier_type='CCN' AND valid_to IS NULL) AS facilities,
         (SELECT count(DISTINCT identifier_value) FROM provider_identifier
           WHERE issuer='CMS' AND identifier_type='CCN' AND valid_to IS NULL) AS unique_ccns,
         (SELECT count(DISTINCT provider_id) FROM published_facility_claim
           WHERE claim_type='google_official_website') AS websites,
         (SELECT count(DISTINCT provider_id) FROM published_facility_claim
           WHERE claim_type='google_public_phone') AS phones,
         (SELECT count(DISTINCT provider_id) FROM published_facility_claim
           WHERE claim_type='google_public_name') AS aliases,
         (SELECT count(*) FROM published_facility_claim
           WHERE claim_type IN
             ('google_place_identity','google_business_status','google_physical_address')) AS leaked_internal,
         (SELECT pi.identifier_value FROM published_facility_claim c
           JOIN provider_identifier pi ON pi.provider_id=c.provider_id
             AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_to IS NULL
           WHERE c.claim_type='google_official_website' LIMIT 1) AS sample_website_ccn,
         (SELECT rp.cms_ccn FROM facility_intelligence_run_provider rp
           WHERE rp.final_resolution_state='REVIEW_REQUIRED'
             AND NOT EXISTS (
               SELECT 1 FROM published_facility_claim c WHERE c.provider_id=rp.provider_id
             ) LIMIT 1) AS sample_review_ccn,
         (SELECT rp.cms_ccn FROM facility_intelligence_run_provider rp
           WHERE rp.final_resolution_state='PROBABLE' LIMIT 1) AS sample_probable_ccn`,
    );
    console.log(JSON.stringify(report.rows[0], null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
