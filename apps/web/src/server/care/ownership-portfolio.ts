import "server-only";
import { loadPortfolioMembers, mapPortfolioRow } from "./ownership-v2";
import { getCareDatabasePool } from "./db";
import type { CareOrganizationPortfolioPage, CareOwnershipChangeRecord } from "./types";

interface PortfolioRow {
  organization_id: string;
  display_name: string;
  current_facility_count: number;
  historical_facility_count: number;
  state_count: number;
  states: string[];
  relationship_roles: string[];
  publication_eligible: boolean;
  indexable: boolean;
  snapshot: Record<string, unknown>;
}

export async function getPublishedOrganizationPortfolio(
  organizationId: string,
): Promise<CareOrganizationPortfolioPage | null> {
  const result = await getCareDatabasePool().query<PortfolioRow>(
    `SELECT organization_id, display_name, current_facility_count, historical_facility_count,
       state_count, states, relationship_roles, publication_eligible, indexable, snapshot
     FROM ownership_portfolio
     WHERE organization_id = $1 AND publication_eligible`,
    [organizationId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const [relatedFacilities, historicalFacilities, ownershipChanges] = await Promise.all([
    loadPortfolioMembers(organizationId, "current", 400),
    loadPortfolioMembers(organizationId, "historical", 100),
    loadOrganizationOwnershipChanges(organizationId),
  ]);
  return {
    portfolio: mapPortfolioRow(
      row,
      row.relationship_roles[0] ?? "CMS ownership relationship",
      relatedFacilities,
    ),
    historicalFacilities,
    ownershipChanges,
  };
}

async function loadOrganizationOwnershipChanges(
  organizationId: string,
): Promise<CareOwnershipChangeRecord[]> {
  const result = await getCareDatabasePool().query<{
    effective_date: string;
    change_type_text: string;
    provider_name: string;
    ccn: string;
  }>(
    `SELECT e.effective_date::text, e.change_type_text,
       coalesce(fs.provider_name, e.provider_identifier) provider_name,
       coalesce(pi.identifier_value, e.provider_identifier) ccn
     FROM ownership_change_event e
     LEFT JOIN provider_identifier pi ON pi.provider_id = e.provider_id
       AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
     LEFT JOIN LATERAL (
       SELECT provider_name FROM facility_snapshot s
       WHERE s.provider_id = e.provider_id
       ORDER BY s.observed_at DESC NULLS LAST
       LIMIT 1
     ) fs ON true
     WHERE e.buyer_organization_id = $1 OR e.seller_organization_id = $1
     ORDER BY e.effective_date DESC, e.id
     LIMIT 25`,
    [organizationId],
  );
  return result.rows.map((row) => ({
    effectiveDate: row.effective_date,
    changeTypeText: row.change_type_text,
    facilityName: row.provider_name,
    ccn: row.ccn,
  }));
}
