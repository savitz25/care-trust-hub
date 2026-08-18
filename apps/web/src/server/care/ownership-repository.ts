import "server-only";
import type { QueryResultRow } from "pg";
import { getCareDatabasePool } from "./db";
import type {
  CareOwnershipChange,
  CareOwnershipIntelligence,
  CareOwnershipParty,
  CareOwnershipSourceDisclosure,
} from "./types";

function validateCcn(ccn: string): string {
  const value = ccn.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(value)) throw new RangeError("Invalid CMS CCN");
  return value;
}

interface PartyRow extends QueryResultRow {
  id: string;
  party_kind: "organization" | "individual";
  organization_id: string | null;
  display_name: string;
  relationship_role_code: string | null;
  relationship_role_text: string;
  association_date: string | null;
  ownership_percentage: string | null;
  classifications: Record<string, boolean | string>;
  connected_provider_count: string | null;
  connected_states: string[] | null;
  source_organization: string;
  dataset_name: string;
  dataset_identifier: string;
  official_url: string;
  release_key: string;
  source_modified_at: Date | null;
  retrieved_at: Date;
  total_party_count: string;
}

interface ChangeRow extends QueryResultRow {
  id: string;
  effective_date: string;
  change_type_code: string;
  change_type_text: string;
  buyer_name: string;
  seller_name: string;
  source_organization: string;
  dataset_name: string;
  dataset_identifier: string;
  official_url: string;
  release_key: string;
  source_modified_at: Date | null;
  retrieved_at: Date;
}

function source(row: PartyRow | ChangeRow): CareOwnershipSourceDisclosure {
  return {
    sourceOrganization: row.source_organization,
    datasetName: row.dataset_name,
    cmsDatasetIdentifier: row.dataset_identifier,
    officialSourceUrl: row.official_url,
    releaseIdentifier: row.release_key,
    sourceModifiedAt: row.source_modified_at?.toISOString() ?? null,
    retrievedAt: row.retrieved_at.toISOString(),
  };
}

const latestReleases = `SELECT DISTINCT ON (sr.source_dataset_id) sr.id
  FROM source_release sr JOIN ingest_run ir ON ir.source_release_id=sr.id AND ir.status='succeeded'
  JOIN source_dataset sd ON sd.id=sr.source_dataset_id
  WHERE sd.dataset_key IN ('skilled-nursing-facility-enrollments','skilled-nursing-facility-all-owners','nursing-home-ownership')
  ORDER BY sr.source_dataset_id, sr.source_modified_at DESC NULLS LAST,
    sr.source_release_date DESC NULLS LAST, sr.release_key DESC`;

export async function getProviderOwnershipIntelligence(
  ccn: string,
): Promise<CareOwnershipIntelligence> {
  const identifier = validateCcn(ccn);
  const pool = getCareDatabasePool();
  const [partyResult, changeResult] = await Promise.all([
    pool.query<PartyRow>(
      `WITH latest AS (${latestReleases}), target AS (
         SELECT provider_id FROM provider_identifier WHERE issuer='CMS' AND identifier_type='CCN'
           AND identifier_value=$1 AND valid_from IS NULL
       )
       SELECT r.id, p.party_kind, p.organization_id, count(*) OVER()::text total_party_count,
         CASE sd.dataset_key
           WHEN 'skilled-nursing-facility-enrollments' THEN
             COALESCE(NULLIF(r.raw_record->>'ORGANIZATION NAME',''),p.display_name)
           WHEN 'skilled-nursing-facility-all-owners' THEN
             COALESCE(NULLIF(r.raw_record->>'ORGANIZATION NAME - OWNER',''),
               NULLIF(concat_ws(', ',NULLIF(r.raw_record->>'LAST NAME - OWNER',''),
                 NULLIF(r.raw_record->>'FIRST NAME - OWNER','')),''),p.display_name)
           WHEN 'nursing-home-ownership' THEN
             COALESCE(NULLIF(r.raw_record->>'Owner Name',''),p.display_name)
           ELSE p.display_name
         END display_name, r.relationship_role_code,
         r.relationship_role_text, r.association_date::text, r.ownership_percentage::text,
         r.classifications, sd.source_organization, sd.display_name dataset_name,
         CASE sd.dataset_key
           WHEN 'nursing-home-ownership' THEN 'y2hd-n93e'
           WHEN 'skilled-nursing-facility-enrollments' THEN '5f2c306f-3b1c-42cd-b037-187b2ce22126'
           WHEN 'skilled-nursing-facility-all-owners' THEN 'afe44b85-cc6d-40d7-b5df-00ae8910d1d2'
         END dataset_identifier,
         sd.official_url, sr.release_key, sr.source_modified_at, sr.retrieved_at,
         CASE WHEN p.organization_id IS NULL THEN NULL ELSE
           (SELECT count(DISTINCT rr.provider_id)::text FROM provider_ownership_relationship rr
            WHERE rr.ownership_party_id IN
              (SELECT id FROM ownership_party WHERE organization_id=p.organization_id)
              AND rr.provider_id IS NOT NULL) END connected_provider_count,
         CASE WHEN p.organization_id IS NULL THEN ARRAY[]::text[] ELSE
           COALESCE((SELECT array_agg(DISTINCT fs.attributes->>'state' ORDER BY fs.attributes->>'state')
             FROM provider_ownership_relationship rr
             JOIN ownership_party pp ON pp.id=rr.ownership_party_id
             JOIN LATERAL (SELECT attributes FROM facility_snapshot f
               WHERE f.provider_id=rr.provider_id ORDER BY observed_at DESC NULLS LAST LIMIT 1) fs ON true
             WHERE pp.organization_id=p.organization_id AND rr.provider_id IS NOT NULL), ARRAY[]::text[]) END connected_states
       FROM provider_ownership_relationship r JOIN target t ON t.provider_id=r.provider_id
       JOIN latest l ON l.id=r.source_release_id JOIN ownership_party p ON p.id=r.ownership_party_id
       JOIN source_release sr ON sr.id=r.source_release_id JOIN source_dataset sd ON sd.id=sr.source_dataset_id
       ORDER BY sd.display_name, r.relationship_role_text, p.display_name LIMIT 75`,
      [identifier],
    ),
    pool.query<ChangeRow>(
      `WITH target AS (SELECT provider_id FROM provider_identifier WHERE issuer='CMS'
        AND identifier_type='CCN' AND identifier_value=$1 AND valid_from IS NULL)
       SELECT e.id, e.effective_date::text, e.change_type_code, e.change_type_text,
         COALESCE(e.raw_record->>'ORGANIZATION NAME - BUYER','Not reported') buyer_name,
         COALESCE(e.raw_record->>'ORGANIZATION NAME - SELLER','Not reported') seller_name,
         sd.source_organization, sd.display_name dataset_name,
         'f557a6ed-95b3-4a22-8433-4175db2dec1c' dataset_identifier,
         sd.official_url, sr.release_key, sr.source_modified_at, sr.retrieved_at
       FROM ownership_change_event e JOIN target t ON t.provider_id=e.provider_id
       JOIN source_release sr ON sr.id=e.source_release_id JOIN source_dataset sd ON sd.id=sr.source_dataset_id
       ORDER BY e.effective_date DESC, e.id LIMIT 20`,
      [identifier],
    ),
  ]);
  const parties: CareOwnershipParty[] = partyResult.rows.map((row) => ({
    id: row.id,
    kind: row.party_kind,
    organizationId: row.organization_id,
    displayName: row.display_name,
    roleCode: row.relationship_role_code,
    roleText: row.relationship_role_text,
    associationDate: row.association_date,
    ownershipPercentage:
      row.ownership_percentage === null ? null : Number(row.ownership_percentage),
    classifications: row.classifications,
    connectedProviderCount:
      row.connected_provider_count === null ? null : Number(row.connected_provider_count),
    connectedStates: row.connected_states ?? [],
    source: source(row),
  }));
  const changes: CareOwnershipChange[] = changeResult.rows.map((row) => ({
    id: row.id,
    effectiveDate: row.effective_date,
    changeTypeCode: row.change_type_code,
    changeTypeText: row.change_type_text,
    buyerName: row.buyer_name,
    sellerName: row.seller_name,
    source: source(row),
  }));
  return {
    parties,
    totalPartyCount: partyResult.rows[0] ? Number(partyResult.rows[0].total_party_count) : 0,
    changes,
  };
}
