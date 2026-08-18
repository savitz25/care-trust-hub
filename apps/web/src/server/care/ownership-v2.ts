import "server-only";
import {
  classifyOwnershipRole,
  computePortfolioMetrics,
  selectPortfolioOrganization,
  STATE_HISTORY_REGULATORS,
  whoIsBehindItems,
  type PublishableStateCode,
} from "@care/domain";
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

interface RelatedRow {
  ccn: string;
  provider_name: string;
  city: string | null;
  state_code: string;
  overall_rating: number | null;
  staffing_rating: number | null;
  health_inspection_rating: number | null;
  quality_measure_rating: number | null;
  had_penalty: boolean;
  penalty_amount: string | null;
  had_ownership_change: boolean;
  had_recent_state: boolean;
  rn_hprd: string | null;
  total_nurse_hprd: string | null;
  relationship_type: string;
}

function regulatorLabel(stateCode: string | undefined): string {
  if (stateCode === "CA" || stateCode === "NY" || stateCode === "TX") {
    return STATE_HISTORY_REGULATORS[stateCode as PublishableStateCode];
  }
  return "State regulator";
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
    portfolio: null,
  };
  const selected = selectPortfolioOrganization(ownership.parties);
  if (!selected?.organizationId) return summary;
  summary.portfolio = await loadPortfolio(
    selected.organizationId,
    selected.displayName,
    selected.roleText,
  );
  return summary;
}

async function loadPortfolio(
  organizationId: string,
  organizationName: string,
  relationshipType: string,
): Promise<CareOwnershipPortfolio | null> {
  const result = await getCareDatabasePool().query<RelatedRow>(
    `WITH members AS (
       SELECT DISTINCT rr.provider_id, rr.relationship_role_text
       FROM ownership_party p
       JOIN provider_ownership_relationship rr ON rr.ownership_party_id = p.id
       WHERE p.organization_id = $1 AND rr.provider_id IS NOT NULL
     )
     SELECT DISTINCT ON (pi.identifier_value)
       pi.identifier_value ccn, fs.provider_name, fs.city, fs.state_code,
       fs.overall_rating, fs.staffing_rating, fs.health_inspection_rating, fs.quality_measure_rating,
       EXISTS (SELECT 1 FROM penalty_enforcement pe WHERE pe.provider_id = m.provider_id) had_penalty,
       (SELECT sum(pe.fine_amount) FROM penalty_enforcement pe
         WHERE pe.provider_id = m.provider_id AND pe.penalty_type = 'Fine')::text penalty_amount,
       EXISTS (SELECT 1 FROM ownership_change_event oce WHERE oce.provider_id = m.provider_id) had_ownership_change,
       EXISTS (
         SELECT 1 FROM facility_history_event he
         WHERE he.provider_id = m.provider_id AND he.event_family = 'state'
           AND he.publication_eligible AND he.importance IN ('HIGH','MEDIUM')
           AND he.event_date >= (CURRENT_DATE - INTERVAL '18 months')
       ) had_recent_state,
       latest.rn_hprd::text, latest.total_nurse_hprd::text, m.relationship_role_text relationship_type
     FROM members m
     JOIN provider_identifier pi ON pi.provider_id = m.provider_id
       AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
     JOIN facility_snapshot fs ON fs.provider_id = m.provider_id
     LEFT JOIN LATERAL (
       SELECT s.rn_hprd, s.total_nurse_hprd
       FROM pbj_staffing_quarter_summary s
       WHERE s.provider_id = m.provider_id
       ORDER BY s.source_quarter DESC
       LIMIT 1
     ) latest ON true
     ORDER BY pi.identifier_value, fs.observed_at DESC NULLS LAST`,
    [organizationId],
  );
  if (result.rows.length < 3) return null;
  const relatedFacilities: CareRelatedFacility[] = [...result.rows]
    .sort((left, right) => left.provider_name.localeCompare(right.provider_name))
    .slice(0, 40)
    .map((row) => ({
      ccn: row.ccn,
      providerName: row.provider_name,
      city: row.city,
      state: row.state_code,
      overallRating: row.overall_rating,
      staffingRating: row.staffing_rating,
      hadPenalty: row.had_penalty,
      relationshipType: row.relationship_type,
    }));
  const states = [...new Set(result.rows.map((row) => row.state_code))].sort();
  const metrics = computePortfolioMetrics(
    result.rows.map((row) => ({
      overallRating: row.overall_rating,
      staffingRating: row.staffing_rating,
      healthInspectionRating: row.health_inspection_rating,
      qualityMeasureRating: row.quality_measure_rating,
      rnHprd: row.rn_hprd == null ? null : Number(row.rn_hprd),
      totalNurseHprd: row.total_nurse_hprd == null ? null : Number(row.total_nurse_hprd),
      hadPenalty: row.had_penalty,
      penaltyAmount: row.penalty_amount == null ? null : Number(row.penalty_amount),
      hadOwnershipChange: row.had_ownership_change,
      hadRecentStateEnforcement: row.had_recent_state,
    })),
    states.length,
  );
  return {
    organizationId,
    organizationName,
    relationshipType,
    facilityCount: metrics.facilityCount,
    stateCount: metrics.stateCount,
    states,
    relatedFacilities,
    overallAverage: metrics.overall.average,
    overallSampleSize: metrics.overall.sampleSize,
    overallDistribution: metrics.overall.distribution,
    staffingAverage: metrics.staffing.average,
    staffingSampleSize: metrics.staffing.sampleSize,
    healthInspectionAverage: metrics.healthInspection.average,
    healthInspectionSampleSize: metrics.healthInspection.sampleSize,
    qualityMeasureAverage: metrics.qualityMeasure.average,
    qualityMeasureSampleSize: metrics.qualityMeasure.sampleSize,
    averageRnHprd: metrics.averageRnHprd,
    rnSampleSize: metrics.rnSampleSize,
    averageTotalNurseHprd: metrics.averageTotalNurseHprd,
    totalNurseSampleSize: metrics.totalNurseSampleSize,
    facilitiesWithPenalty: metrics.facilitiesWithPenalty,
    totalFineAmount: metrics.totalFineAmount,
    facilitiesWithOwnershipChange: metrics.facilitiesWithOwnershipChange,
    facilitiesWithRecentStateEnforcement: metrics.facilitiesWithRecentStateEnforcement,
  };
}
