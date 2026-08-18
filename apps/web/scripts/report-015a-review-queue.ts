import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const STATES = ["FL", "NJ", "NY", "CA", "TX", "PA", "OH", "NC"];

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
      // ignore
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
    const result = await client.query(
      `WITH latest AS (
         SELECT DISTINCT ON (rp.provider_id)
           rp.provider_id, rp.final_resolution_state
         FROM facility_intelligence_run_provider rp
         WHERE rp.final_resolution_state IS NOT NULL
         ORDER BY rp.provider_id, rp.completed_at DESC NULLS LAST
       ), current_ccn AS (
         SELECT DISTINCT ON (pi.provider_id) pi.provider_id, fs.state_code
         FROM provider_identifier pi
         JOIN facility_snapshot fs ON fs.provider_id = pi.provider_id
         JOIN ingest_run ir ON ir.id = fs.ingest_run_id AND ir.status = 'succeeded'
         WHERE pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
         ORDER BY pi.provider_id, ir.completed_at DESC
       )
       SELECT c.state_code,
         count(*) FILTER (WHERE l.final_resolution_state = 'REVIEW_REQUIRED')::int AS review_required,
         count(*) FILTER (WHERE l.final_resolution_state = 'VERIFIED')::int AS verified,
         count(*) FILTER (WHERE l.final_resolution_state = 'PROBABLE')::int AS probable,
         count(*) FILTER (WHERE l.final_resolution_state = 'UNRESOLVED')::int AS unresolved,
         count(*)::int AS enriched
       FROM latest l
       JOIN current_ccn c ON c.provider_id = l.provider_id
       WHERE c.state_code = ANY($1::text[])
       GROUP BY c.state_code
       ORDER BY review_required DESC`,
      [STATES],
    );
    const totals = await client.query(
      `SELECT count(*) FILTER (WHERE final_resolution_state='REVIEW_REQUIRED')::int AS review_required
       FROM (
         SELECT DISTINCT ON (provider_id) final_resolution_state
         FROM facility_intelligence_run_provider
         WHERE final_resolution_state IS NOT NULL
         ORDER BY provider_id, completed_at DESC NULLS LAST
       ) latest`,
    );
    console.log(
      JSON.stringify(
        { nationalReviewRequired: totals.rows[0]?.review_required, byState: result.rows },
        null,
        2,
      ),
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
