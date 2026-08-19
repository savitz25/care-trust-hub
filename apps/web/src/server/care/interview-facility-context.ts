import "server-only";
import {
  deriveFacilityInterviewEvidence,
  isExplicitMemoryDesignation,
  regulatorDisplayName,
  type AssistedLivingInterviewEvidence,
  type PublishedFacilityInterviewEvidence,
} from "@care/domain";
import { providerHref } from "./consumer";
import {
  getOwnershipOperationSummaryForPage,
  getProviderByCcnForPage,
  getProviderOwnershipIntelligenceForPage,
  getPublishedFacilityHistoryForPage,
} from "./cached-repository";
import { getPublishedAssistedLivingProvider } from "./assisted-living-publication";
import {
  isAssistedLivingIntelligenceEnabled,
  isFacilityHistoryEnabled,
  isOwnershipIntelligenceEnabled,
  isOwnershipIntelligenceV2Enabled,
  isRealProviderUiEnabled,
  isStateEnforcementIntelligenceEnabled,
} from "./feature-flags";

export interface InterviewFacilityContext {
  readonly ccn: string | null;
  readonly assistedLivingId: string | null;
  readonly facilityName: string;
  readonly facilityHref: string;
  readonly evidence: PublishedFacilityInterviewEvidence | null;
  readonly assistedLivingEvidence: AssistedLivingInterviewEvidence | null;
}

function normalizeCcn(value: string): string | null {
  const ccn = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(ccn) ? ccn : null;
}

export async function loadAssistedLivingInterviewContext(
  rawId: string | undefined,
): Promise<InterviewFacilityContext | null> {
  if (!isAssistedLivingIntelligenceEnabled() || !rawId) return null;
  const provider = await getPublishedAssistedLivingProvider(rawId);
  if (!provider) return null;
  return {
    ccn: null,
    assistedLivingId: provider.id,
    facilityName: provider.officialName,
    facilityHref: `/assisted-living/${provider.stateCode.toLowerCase()}/${provider.id}`,
    evidence: null,
    assistedLivingEvidence: {
      providerId: provider.id,
      facilityName: provider.officialName,
      officialType: provider.officialType,
      licensedCapacity: provider.licensedCapacity,
      regulatorName: regulatorDisplayName(provider.stateCode),
      memoryDesignation: provider.memoryDesignation,
      explicitMemory: isExplicitMemoryDesignation(provider.memoryDesignation),
      onProbation: (provider.consumerStatus ?? "").toUpperCase() === "ON PROBATION",
      regulatorStatus: provider.consumerStatus,
    },
  };
}

export async function loadInterviewFacilityContext(
  rawCcn: string | undefined,
): Promise<InterviewFacilityContext | null> {
  if (!isRealProviderUiEnabled()) return null;
  const ccn = rawCcn ? normalizeCcn(rawCcn) : null;
  if (!ccn) return null;

  const provider = await getProviderByCcnForPage(ccn).catch(() => null);
  if (!provider) return null;

  const history = isFacilityHistoryEnabled()
    ? await getPublishedFacilityHistoryForPage(provider.ccn, {
        includeStateEvents: isStateEnforcementIntelligenceEnabled(),
      }).catch(() => null)
    : null;

  let organizationFacilityCount: number | null = null;
  if (isOwnershipIntelligenceV2Enabled() && isOwnershipIntelligenceEnabled()) {
    const ownership = await getProviderOwnershipIntelligenceForPage(provider.ccn).catch(() => null);
    if (ownership) {
      const summary = await getOwnershipOperationSummaryForPage(provider, ownership).catch(
        () => null,
      );
      organizationFacilityCount = summary?.portfolio?.facilityCount ?? null;
    }
  }

  return {
    ccn: provider.ccn,
    assistedLivingId: null,
    facilityName: provider.providerName,
    facilityHref: providerHref(provider),
    assistedLivingEvidence: null,
    evidence: deriveFacilityInterviewEvidence({
      facilityName: provider.providerName,
      ccn: provider.ccn,
      cmsStaffingRating: provider.ratings.staffing,
      historyEvents: history?.events ?? [],
      currentOrganizationFacilityCount: organizationFacilityCount,
    }),
  };
}
