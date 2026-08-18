import "server-only";
import {
  classifyOwnershipRole,
  corroboratesGovernmentSources,
  PORTFOLIO_METRICS_DISCLAIMER,
  selectPortfolioOrganization,
  STATE_HISTORY_REGULATORS,
  whoIsBehindItems,
  type PublishableStateCode,
} from "@care/domain";
import { organizationHref } from "./consumer";
import { getCareDatabasePool } from "./db";
import type { PublishedStateIntelligence } from "@care/domain";
import type {
  CareChainIntelligence,
  CareOwnershipIntelligence,
  CareOwnershipOperationSummary,
  CareOwnershipPortfolio,
  CareProviderDetail,
  CareRelatedFacility,
} from "./types";

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

interface MemberRow {
  ccn: string;
  provider_name: string;
  city: string | null;
  state_code: string;
  overall_rating: number | null;
  staffing_rating: number | null;
  had_penalty: boolean;
  relationship_type: string;
  membership_status: "current" | "historical" | "uncertain";
}

function regulatorLabel(stateCode: string | undefined): string {
  if (stateCode === "CA" || stateCode === "NY" || stateCode === "TX") {
    return STATE_HISTORY_REGULATORS[stateCode as PublishableStateCode];
  }
  return "State regulator";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function countOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function distribution(value: unknown): Record<1 | 2 | 3 | 4 | 5, number> {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    1: countOrZero(record["1"]),
    2: countOrZero(record["2"]),
    3: countOrZero(record["3"]),
    4: countOrZero(record["4"]),
    5: countOrZero(record["5"]),
  };
}

export function mapPortfolioRow(
  row: PortfolioRow,
  relationshipType: string,
  relatedFacilities: CareRelatedFacility[],
): CareOwnershipPortfolio {
  const snapshot = row.snapshot ?? {};
  return {
    organizationId: row.organization_id,
    organizationName: row.display_name,
    relationshipType,
    href: organizationHref({
      organizationId: row.organization_id,
      organizationName: row.display_name,
    }),
    indexable: row.indexable,
    facilityCount: row.current_facility_count,
    historicalFacilityCount: row.historical_facility_count,
    stateCount: row.state_count,
    states: row.states ?? [],
    relationshipRoles: row.relationship_roles ?? [],
    relatedFacilities,
    overallAverage: numberOrNull(snapshot.overallAverage),
    overallSampleSize: countOrZero(snapshot.overallSampleSize),
    overallDistribution: distribution(snapshot.overallDistribution),
    staffingAverage: numberOrNull(snapshot.staffingAverage),
    staffingSampleSize: countOrZero(snapshot.staffingSampleSize),
    healthInspectionAverage: numberOrNull(snapshot.healthInspectionAverage),
    healthInspectionSampleSize: countOrZero(snapshot.healthInspectionSampleSize),
    qualityMeasureAverage: numberOrNull(snapshot.qualityMeasureAverage),
    qualityMeasureSampleSize: countOrZero(snapshot.qualityMeasureSampleSize),
    averageRnHprd: numberOrNull(snapshot.averageRnHprd),
    rnSampleSize: countOrZero(snapshot.rnSampleSize),
    averageTotalNurseHprd: numberOrNull(snapshot.averageTotalNurseHprd),
    totalNurseSampleSize: countOrZero(snapshot.totalNurseSampleSize),
    facilitiesWithPenalty: countOrZero(snapshot.facilitiesWithPenalty),
    totalFineAmount: numberOrNull(snapshot.totalFineAmount),
    facilitiesWithOwnershipChange: countOrZero(snapshot.facilitiesWithOwnershipChange),
    facilitiesWithRecentStateEnforcement: countOrZero(
      snapshot.facilitiesWithRecentStateEnforcement,
    ),
    facilitiesWithRecentCmsPenalty: countOrZero(snapshot.facilitiesWithRecentCmsPenalty),
    facilitiesWithRecentHighValueEnforcement: countOrZero(
      snapshot.facilitiesWithRecentHighValueEnforcement,
    ),
    facilitiesWithRecentComplaintInspection: countOrZero(
      snapshot.facilitiesWithRecentComplaintInspection,
    ),
    disclaimer: PORTFOLIO_METRICS_DISCLAIMER,
  };
}

export async function getOwnershipOperationSummary(
  provider: CareProviderDetail,
  ownership: CareOwnershipIntelligence,
  options: {
    stateIntelligence?: PublishedStateIntelligence | null;
    chain?: CareChainIntelligence | null;
  } = {},
): Promise<CareOwnershipOperationSummary> {
  const organizations = ownership.parties.filter((party) => party.kind === "organization");
  const individuals = ownership.parties.filter((party) => party.kind === "individual");
  const organizationOwners = organizations.filter((party) => {
    const role = classifyOwnershipRole(party);
    return role === "organization_owner" || role === "indirect_owner";
  }).length;
  const state = options.stateIntelligence;
  const operator = state?.operator?.value
    ? { value: state.operator.value, source: regulatorLabel(state.stateCode) }
    : null;
  const licensee = state?.licensee?.value
    ? { value: state.licensee.value, source: regulatorLabel(state.stateCode) }
    : null;
  const managementCompany = state?.managementCompany?.value
    ? { value: state.managementCompany.value, source: regulatorLabel(state.stateCode) }
    : null;
  const chainName = options.chain?.current.chainName ?? null;
  const supportedByMultipleGovernmentSources = corroboratesGovernmentSources({
    cmsOrganizationNames: organizations.map((party) => party.displayName),
    stateOperator: operator?.value ?? null,
    stateLicensee: licensee?.value ?? null,
  });
  const summary: CareOwnershipOperationSummary = {
    operator,
    licensee,
    managementCompany,
    cmsOwnershipType: provider.ownershipType,
    organizationCount: organizations.length,
    individualCount: individuals.length,
    chainName,
    ownershipChangeCount: ownership.changes.length,
    whoIsBehind: whoIsBehindItems({
      operator: operator?.value ?? null,
      licensee: licensee?.value ?? null,
      organizationOwners,
      individuals: individuals.length,
      chainName,
      ownershipChanges: ownership.changes.length,
    }),
    supportedByMultipleGovernmentSources,
    portfolio: null,
  };
  const organizationIds = [
    ...new Set(
      organizations
        .map((party) => party.organizationId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  if (!organizationIds.length) return summary;
  const published = await loadPublishedPortfolios(organizationIds);
  const selected = selectPortfolioOrganization(
    organizations.map((party) => ({
      ...party,
      connectedProviderCount: party.organizationId
        ? (published.get(party.organizationId)?.current_facility_count ?? 0)
        : 0,
    })),
  );
  if (!selected?.organizationId) return summary;
  const row = published.get(selected.organizationId);
  if (!row) return summary;
  const relatedFacilities = await loadPortfolioMembers(selected.organizationId, "current", 12);
  summary.portfolio = mapPortfolioRow(row, selected.roleText, relatedFacilities);
  return summary;
}

async function loadPublishedPortfolios(
  organizationIds: string[],
): Promise<Map<string, PortfolioRow>> {
  const result = await getCareDatabasePool().query<PortfolioRow>(
    `SELECT organization_id, display_name, current_facility_count, historical_facility_count,
       state_count, states, relationship_roles, publication_eligible, indexable, snapshot
     FROM ownership_portfolio
     WHERE organization_id = ANY($1::uuid[]) AND publication_eligible`,
    [organizationIds],
  );
  return new Map(result.rows.map((row) => [row.organization_id, row]));
}

export async function loadPortfolioMembers(
  organizationId: string,
  membershipStatus: "current" | "historical",
  limit = 200,
): Promise<CareRelatedFacility[]> {
  const result = await getCareDatabasePool().query<MemberRow>(
    `SELECT pi.identifier_value ccn, fs.provider_name, fs.city, fs.state_code,
       fs.overall_rating, fs.staffing_rating,
       EXISTS (SELECT 1 FROM penalty_enforcement pe WHERE pe.provider_id = mem.provider_id) had_penalty,
       coalesce(array_to_string(mem.relationship_roles, ', '), 'CMS ownership relationship') relationship_type,
       mem.membership_status
     FROM ownership_portfolio_member mem
     JOIN provider_identifier pi ON pi.provider_id = mem.provider_id
       AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
     JOIN LATERAL (
       SELECT provider_name, city, state_code, overall_rating, staffing_rating
       FROM facility_snapshot fs
       WHERE fs.provider_id = mem.provider_id
       ORDER BY fs.observed_at DESC NULLS LAST
       LIMIT 1
     ) fs ON true
     WHERE mem.organization_id = $1 AND mem.membership_status = $2
     ORDER BY fs.provider_name, pi.identifier_value
     LIMIT $3`,
    [organizationId, membershipStatus, limit],
  );
  return result.rows.map(mapMember);
}

function mapMember(row: MemberRow): CareRelatedFacility {
  return {
    ccn: row.ccn,
    providerName: row.provider_name,
    city: row.city,
    state: row.state_code,
    overallRating: row.overall_rating,
    staffingRating: row.staffing_rating,
    hadPenalty: row.had_penalty,
    relationshipType: row.relationship_type,
    membershipStatus: row.membership_status,
  };
}
