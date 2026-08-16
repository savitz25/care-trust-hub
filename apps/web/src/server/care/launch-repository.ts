import "server-only";
import { getCareDatabasePool } from "./db";

export const FACILITY_SITEMAP_PAGE_SIZE = 5000;

export async function getFacilitySitemapCount(): Promise<number> {
  const result = await getCareDatabasePool().query<{ count: string }>(
    `SELECT count(*) FROM provider_identifier
     WHERE issuer='CMS' AND identifier_type='CCN' AND valid_from IS NULL`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function getFacilitySitemapPage(page: number) {
  if (!Number.isInteger(page) || page < 0 || page > 100)
    throw new RangeError("Invalid sitemap page");
  const result = await getCareDatabasePool().query<{
    ccn: string;
    provider_name: string;
    observed_at: Date | null;
  }>(
    `SELECT DISTINCT ON (pi.identifier_value) pi.identifier_value ccn, fs.provider_name, fs.observed_at
     FROM provider_identifier pi
     JOIN facility_snapshot fs ON fs.provider_id=pi.provider_id
     JOIN ingest_run ir ON ir.id=fs.ingest_run_id AND ir.status='succeeded'
     WHERE pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
     ORDER BY pi.identifier_value,fs.observed_at DESC NULLS LAST,fs.id DESC
     LIMIT $1 OFFSET $2`,
    [FACILITY_SITEMAP_PAGE_SIZE, page * FACILITY_SITEMAP_PAGE_SIZE],
  );
  return result.rows;
}

export async function getChainSitemapRows() {
  const result = await getCareDatabasePool().query<{
    cms_chain_id: string;
    chain_name: string;
    release_month: Date;
  }>(
    `SELECT DISTINCT ON (c.cms_chain_id) c.cms_chain_id,s.chain_name,s.release_month
     FROM cms_chain c JOIN cms_chain_performance_snapshot s ON s.chain_id=c.id
     ORDER BY c.cms_chain_id,s.release_month DESC`,
  );
  return result.rows;
}
