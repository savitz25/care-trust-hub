import "server-only";
import {
  deriveFacilityInterviewEvidence,
  type PublishedFacilityInterviewEvidence,
} from "@care/domain";
import { providerHref } from "./consumer";
import {
  getOwnershipOperationSummaryForPage,
  getProviderByCcnForPage,
  getProviderOwnershipIntelligenceForPage,
  getPublishedFacilityHistoryForPage,
} from "./cached-repository";
import {
  isFacilityHistoryEnabled,
  isOwnershipIntelligenceEnabled,
  isOwnershipIntelligenceV2Enabled,
  isRealProviderUiEnabled,
  isStateEnforcementIntelligenceEnabled,
} from "./feature-flags";

export interface InterviewFacilityContext {
  readonly ccn: string;
  readonly facilityName: string;
  readonly facilityHref: string;
  readonly evidence: PublishedFacilityInterviewEvidence;
}

function normalizeCcn(value: string): string | null {
  const ccn = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(ccn) ? ccn : null;
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
    facilityName: provider.providerName,
    facilityHref: providerHref(provider),
    evidence: deriveFacilityInterviewEvidence({
      facilityName: provider.providerName,
      ccn: provider.ccn,
      cmsStaffingRating: provider.ratings.staffing,
      historyEvents: history?.events ?? [],
      currentOrganizationFacilityCount: organizationFacilityCount,
    }),
  };
}
