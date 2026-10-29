import "server-only";
import {
  chainFacilitiesFromSources,
  cmsCcnAuthorityKeysFromSources,
  cmsCcnMembershipKeys,
  resolveChainMembership,
} from "./cms-ccn";
import { getCareDatabasePool } from "./db";
import type { CareChainIntelligence, CareChainSnapshot } from "./types";
const ID = "97ecfad1-d3f1-4d42-b774-d74661d830bc";
interface SnapshotRow {
  release_month: string | Date;
  chain_name: string;
  published_facility_count: string | number;
  published_state_count: string | number;
  metrics: Record<string, string | null>;
}
function snapshot(r: SnapshotRow): CareChainSnapshot {
  return {
    releaseMonth: String(r.release_month).slice(0, 10),
    chainName: r.chain_name,
    facilityCount: Number(r.published_facility_count),
    stateCount: Number(r.published_state_count),
    metrics: Object.fromEntries(
      Object.entries(r.metrics).map(([k, v]) => [k, v === null ? null : Number(v)]),
    ),
  };
}
export async function getProviderChainIntelligence(
  ccn: string,
): Promise<CareChainIntelligence | null> {
  const value = ccn.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(value)) throw new RangeError("Invalid CMS CCN");
  const pool = getCareDatabasePool();
  const membership = await pool.query<{
    provider_id: string | null;
    cms_chain_id: string;
    source_modified_at: Date | null;
    retrieved_at: Date | null;
  }>(
    `SELECT cp.provider_id,c.cms_chain_id,sr.source_modified_at,sr.retrieved_at FROM cms_chain_provider cp JOIN cms_chain c ON c.id=cp.chain_id JOIN source_release sr ON sr.id=cp.source_release_id WHERE btrim(cp.provider_identifier) = ANY($1::text[])`,
    [cmsCcnMembershipKeys(value)],
  );
  const resolved = resolveChainMembership(
    membership.rows.map((row) => ({
      providerId: row.provider_id,
      cmsChainId: row.cms_chain_id,
      sourceModifiedAt: row.source_modified_at,
      retrievedAt: row.retrieved_at,
    })),
  );
  if (!resolved) return null;
  return getChainIntelligence(resolved.cmsChainId, value);
}
export async function getChainIntelligence(
  cmsChainId: string,
  excludeCcn?: string,
): Promise<CareChainIntelligence | null> {
  if (!/^\d+$/.test(cmsChainId)) throw new RangeError("Invalid CMS Chain ID");
  const pool = getCareDatabasePool();
  const [snapshots, facilities, membership] = await Promise.all([
    pool.query(
      `SELECT s.*,sr.source_modified_at,sr.retrieved_at,sr.source_version_identifier,sd.official_url FROM cms_chain_performance_snapshot s JOIN cms_chain c ON c.id=s.chain_id JOIN source_release sr ON sr.id=s.source_release_id JOIN source_dataset sd ON sd.id=sr.source_dataset_id WHERE c.cms_chain_id=$1 ORDER BY s.release_month DESC LIMIT 6`,
      [cmsChainId],
    ),
    pool.query<{
      stored_ccn: string | null;
      canonical_ccns: unknown;
      provider_name: string;
      state_code: string;
      overall: string | number | null;
    }>(
      `SELECT DISTINCT ON (cp.provider_id) cp.provider_identifier stored_ccn,COALESCE((SELECT array_agg(DISTINCT btrim(pi.identifier_value)) FROM provider_identifier pi WHERE pi.provider_id=cp.provider_id AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL), ARRAY[]::text[]) canonical_ccns,fs.provider_name,fs.state_code,fs.overall_rating overall FROM cms_chain_provider cp JOIN cms_chain c ON c.id=cp.chain_id JOIN facility_snapshot fs ON fs.provider_id=cp.provider_id WHERE c.cms_chain_id=$1 ORDER BY cp.provider_id,fs.observed_at DESC NULLS LAST LIMIT 100`,
      [cmsChainId],
    ),
    pool.query(
      `SELECT sr.source_modified_at,sr.retrieved_at FROM cms_chain_provider cp JOIN cms_chain c ON c.id=cp.chain_id JOIN source_release sr ON sr.id=cp.source_release_id WHERE c.cms_chain_id=$1 ORDER BY sr.source_modified_at DESC LIMIT 1`,
      [cmsChainId],
    ),
  ]);
  const first = snapshots.rows[0];
  if (!first) return null;
  const sources = facilities.rows.map((row) => ({
    storedCcn: row.stored_ccn,
    canonicalCcns: row.canonical_ccns,
    providerName: row.provider_name,
    state: row.state_code,
    overallRating: row.overall === null ? null : Number(row.overall),
  }));
  const authorityKeys = cmsCcnAuthorityKeysFromSources(sources);
  const authority = authorityKeys.length
    ? await pool.query<{ provider_id: string; identifier_value: string }>(
        `SELECT pi.provider_id,pi.identifier_value FROM provider_identifier pi WHERE pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL AND pi.identifier_value = ANY($1::text[])`,
        [authorityKeys],
      )
    : { rows: [] };
  return {
    cmsChainId,
    current: snapshot(first),
    history: snapshots.rows.map(snapshot),
    facilities: chainFacilitiesFromSources(
      sources,
      authority.rows.map((row) => ({
        providerId: row.provider_id,
        identifierValue: row.identifier_value,
      })),
      excludeCcn,
    ),
    source: {
      datasetIdentifier: ID,
      versionIdentifier: first.source_version_identifier,
      officialUrl: first.official_url,
      sourceModifiedAt: first.source_modified_at?.toISOString() ?? null,
      retrievedAt: first.retrieved_at.toISOString(),
    },
    membershipSource: {
      datasetIdentifier: "5f2c306f-3b1c-42cd-b037-187b2ce22126",
      sourceModifiedAt: membership.rows[0]?.source_modified_at?.toISOString() ?? null,
      retrievedAt: membership.rows[0]?.retrieved_at?.toISOString() ?? "",
    },
  };
}
