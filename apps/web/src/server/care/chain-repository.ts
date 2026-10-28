import "server-only";
import { chainFacilityCcn, cmsCcnMembershipKeys, normalizeLinkableCmsCcn } from "./cms-ccn";
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
  const membership = await pool.query(
    `SELECT cp.chain_id,c.cms_chain_id,sr.source_modified_at,sr.retrieved_at FROM cms_chain_provider cp JOIN cms_chain c ON c.id=cp.chain_id JOIN source_release sr ON sr.id=cp.source_release_id WHERE btrim(cp.provider_identifier) = ANY($1::text[]) ORDER BY sr.source_modified_at DESC LIMIT 1`,
    [cmsCcnMembershipKeys(value)],
  );
  if (!membership.rows[0]) return null;
  return getChainIntelligence(membership.rows[0].cms_chain_id, value);
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
    pool.query(
      `SELECT DISTINCT ON (cp.provider_id) cp.provider_identifier stored_ccn,(SELECT pi.identifier_value FROM provider_identifier pi WHERE pi.provider_id=cp.provider_id AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL ORDER BY pi.identifier_value LIMIT 1) canonical_ccn,fs.provider_name,fs.state_code,fs.overall_rating overall FROM cms_chain_provider cp JOIN cms_chain c ON c.id=cp.chain_id JOIN facility_snapshot fs ON fs.provider_id=cp.provider_id WHERE c.cms_chain_id=$1 ORDER BY cp.provider_id,fs.observed_at DESC NULLS LAST LIMIT 100`,
      [cmsChainId],
    ),
    pool.query(
      `SELECT sr.source_modified_at,sr.retrieved_at FROM cms_chain_provider cp JOIN cms_chain c ON c.id=cp.chain_id JOIN source_release sr ON sr.id=cp.source_release_id WHERE c.cms_chain_id=$1 ORDER BY sr.source_modified_at DESC LIMIT 1`,
      [cmsChainId],
    ),
  ]);
  const first = snapshots.rows[0];
  if (!first) return null;
  const exclude = normalizeLinkableCmsCcn(excludeCcn);
  return {
    cmsChainId,
    current: snapshot(first),
    history: snapshots.rows.map(snapshot),
    facilities: facilities.rows.flatMap((r) => {
      const resolved = chainFacilityCcn(r.canonical_ccn, r.stored_ccn);
      const storedIdentity = normalizeLinkableCmsCcn(r.stored_ccn);
      const canonicalIdentity = normalizeLinkableCmsCcn(r.canonical_ccn);
      if (
        exclude !== null &&
        (resolved === exclude || storedIdentity === exclude || canonicalIdentity === exclude)
      ) {
        return [];
      }
      const preserved = resolved ?? (typeof r.stored_ccn === "string" ? r.stored_ccn.trim() : "");
      if (!preserved) return [];
      return [
        {
          ccn: preserved,
          providerName: r.provider_name,
          state: r.state_code,
          overallRating: r.overall === null ? null : Number(r.overall),
        },
      ];
    }),
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
