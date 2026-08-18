import "server-only";
import {
  FAMILY_WORKSPACE_MAX_FACILITIES,
  buildFamilyWorkspaceComparison,
  isPublishableStateCode,
  normalizeWorkspaceCcn,
  selectPublishedStateIntelligence,
  type FamilyWorkspaceComparison,
  type PublishedWorkspaceFacilityInput,
  type ResolutionState,
} from "@care/domain";
import { organizationHref, providerHref } from "./consumer";
import { getCareDatabasePool } from "./db";
import {
  isFacilityHistoryEnabled,
  isOwnershipIntelligenceV2Enabled,
  isRealProviderUiEnabled,
  isStateEnforcementIntelligenceEnabled,
  isStateRegulatoryIntelligenceEnabled,
} from "./feature-flags";
import { getPublishedFacilityHistoriesByCcns } from "./history-repository";
import { getDecisionSummariesByCcns, getProvidersByCcns } from "./repository";

interface StateClaimRow {
  ccn: string;
  state_code: string;
  claim_type: string;
  resolution_state: ResolutionState;
  claim_value: unknown;
  resolved_at: Date;
}

interface OrganizationRow {
  ccn: string;
  organization_id: string;
  display_name: string;
  current_facility_count: number;
  indexable: boolean;
}

function jsonbString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed !== "null" ? trimmed : null;
  }
  return null;
}

function normalizeCcns(raw: readonly string[]): string[] {
  const unique: string[] = [];
  for (const value of raw) {
    const ccn = normalizeWorkspaceCcn(value);
    if (!ccn || unique.includes(ccn)) continue;
    unique.push(ccn);
    if (unique.length === FAMILY_WORKSPACE_MAX_FACILITIES) break;
  }
  return unique;
}

async function loadPublishedStateByCcns(
  providers: Array<{ ccn: string; location: { state: string } }>,
): Promise<Map<string, NonNullable<PublishedWorkspaceFacilityInput["stateIntelligence"]>>> {
  const result = new Map<
    string,
    NonNullable<PublishedWorkspaceFacilityInput["stateIntelligence"]>
  >();
  const eligible = providers.filter((provider) => isPublishableStateCode(provider.location.state));
  if (eligible.length === 0) return result;
  const queryResult = await getCareDatabasePool().query<StateClaimRow>(
    `SELECT DISTINCT ON (pi.identifier_value, c.claim_type)
       pi.identifier_value AS ccn, fs.state_code, c.claim_type, c.resolution_state,
       c.claim_value, c.resolved_at
     FROM published_state_claim c
     JOIN provider_identifier pi ON pi.provider_id = c.provider_id
       AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
     JOIN LATERAL (
       SELECT state_code FROM facility_snapshot fs
        WHERE fs.provider_id = pi.provider_id
        ORDER BY fs.observed_at DESC NULLS LAST
        LIMIT 1
     ) fs ON true
     WHERE pi.identifier_value = ANY($1::text[])
     ORDER BY pi.identifier_value, c.claim_type, c.resolved_at DESC, c.created_at DESC`,
    [eligible.map((provider) => provider.ccn)],
  );
  const byCcn = new Map<string, StateClaimRow[]>();
  for (const row of queryResult.rows) {
    byCcn.set(row.ccn, [...(byCcn.get(row.ccn) ?? []), row]);
  }
  for (const provider of eligible) {
    const rows = byCcn.get(provider.ccn) ?? [];
    const intelligence = selectPublishedStateIntelligence({
      stateCode: provider.location.state,
      claims: rows.map((row) => ({
        claimType: row.claim_type,
        resolutionState: row.resolution_state,
        value: jsonbString(row.claim_value),
        resolvedAt: row.resolved_at.toISOString(),
      })),
    });
    if (intelligence) result.set(provider.ccn, intelligence);
  }
  return result;
}

async function loadPublishedOrganizationsByCcns(
  ccns: readonly string[],
): Promise<Map<string, OrganizationRow>> {
  const result = new Map<string, OrganizationRow>();
  if (ccns.length === 0) return result;
  const queryResult = await getCareDatabasePool().query<OrganizationRow>(
    `SELECT DISTINCT ON (pi.identifier_value)
       pi.identifier_value AS ccn, op.organization_id, op.display_name,
       op.current_facility_count, op.indexable
     FROM ownership_portfolio_member mem
     JOIN ownership_portfolio op ON op.organization_id = mem.organization_id
      AND op.publication_eligible
     JOIN provider_identifier pi ON pi.provider_id = mem.provider_id
      AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
     WHERE pi.identifier_value = ANY($1::text[])
       AND mem.membership_status = 'current'
     ORDER BY pi.identifier_value, op.current_facility_count DESC, op.organization_id`,
    [ccns],
  );
  for (const row of queryResult.rows) result.set(row.ccn, row);
  return result;
}

export async function loadFamilyWorkspaceComparison(
  rawCcns: readonly string[],
): Promise<FamilyWorkspaceComparison> {
  const ccns = normalizeCcns(rawCcns);
  if (ccns.length === 0 || !isRealProviderUiEnabled()) {
    return buildFamilyWorkspaceComparison([]);
  }

  const providers = await getProvidersByCcns(ccns);
  if (providers.length === 0) return buildFamilyWorkspaceComparison([]);

  const found = providers.map((provider) => provider.ccn);
  const [summaries, histories, stateByCcn, organizations] = await Promise.all([
    getDecisionSummariesByCcns(found),
    isFacilityHistoryEnabled()
      ? getPublishedFacilityHistoriesByCcns(found, {
          includeStateEvents: isStateEnforcementIntelligenceEnabled(),
        })
      : Promise.resolve(new Map()),
    isStateRegulatoryIntelligenceEnabled()
      ? loadPublishedStateByCcns(providers)
      : Promise.resolve(new Map()),
    isOwnershipIntelligenceV2Enabled()
      ? loadPublishedOrganizationsByCcns(found)
      : Promise.resolve(new Map()),
  ]);

  const summaryByCcn = new Map(summaries.map((item) => [item.ccn, item]));
  const inputs: PublishedWorkspaceFacilityInput[] = providers.map((provider) => {
    const summary = summaryByCcn.get(provider.ccn);
    const history = histories.get(provider.ccn);
    const organization = organizations.get(provider.ccn);
    return {
      ccn: provider.ccn,
      facilityName: provider.providerName,
      city: provider.location.city,
      state: provider.location.state,
      facilityHref: providerHref(provider),
      ratings: provider.ratings,
      cmsOwnershipType: provider.ownershipType,
      staffingQuarter: summary?.staffingQuarter ?? null,
      totalNurseHprd: summary?.totalNurseHprd ?? null,
      rnHprd: summary?.rnHprd ?? null,
      latestInspectionDate: summary?.inspectionDate ?? null,
      latestInspectionDeficiencyCount: summary?.deficiencyCount ?? null,
      latestPenaltyType: summary?.latestPenaltyType ?? null,
      latestFineAmount: summary?.latestFineAmount ?? null,
      chainName: summary?.chainName ?? null,
      chainFacilityCount: summary?.chainFacilityCount ?? null,
      organizationName: organization?.display_name ?? null,
      organizationHref:
        organization && organization.indexable
          ? organizationHref({
              organizationId: organization.organization_id,
              organizationName: organization.display_name,
            })
          : null,
      organizationFacilityCount: organization?.current_facility_count ?? null,
      historyEvents: history?.events ?? [],
      historyTotalCount: history?.totalCount ?? null,
      stateIntelligence: stateByCcn.get(provider.ccn) ?? null,
    };
  });

  return buildFamilyWorkspaceComparison(inputs);
}
