import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { RealProviderDetail } from "@/components/real-provider-detail";
import { isCanonicalProviderSlug, providerHref } from "@/server/care/consumer";
import {
  getProviderByCcnForPage,
  getProviderChainIntelligenceForPage,
  getProviderOwnershipIntelligenceForPage,
  getProviderRegulatoryIntelligenceForPage,
  getProviderStaffingSummaryForPage,
  getApprovedProviderContextForPage,
  getPublishedFacilityEnrichmentForPage,
  getPublishedStateIntelligenceForPage,
  getPublishedFacilityHistoryForPage,
  getOwnershipOperationSummaryForPage,
} from "@/server/care/cached-repository";
import {
  isInspectionIntelligenceEnabled,
  isChainIntelligenceEnabled,
  isOwnershipIntelligenceEnabled,
  isRealProviderUiEnabled,
  isStaffingIntelligenceEnabled,
  isStateRegulatoryIntelligenceEnabled,
  isFacilityHistoryEnabled,
  isStateEnforcementIntelligenceEnabled,
  isOwnershipIntelligenceV2Enabled,
  isTrustParticipationEnabled,
  isVerifiedEnrichmentEnabled,
  isFacilityInterviewBuilderEnabled,
  isFamilyComparisonWorkspaceEnabled,
} from "@/server/care/feature-flags";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import { SHARE_HUB } from "@/config/share-hub";
import { JourneyNextStep } from "@/components/journey-next-step";
import { parseSeniorAskSearchContext } from "@care/domain";
import { AskBackToResults } from "@/components/ask-back-to-results";
import { parseNetworkJourney, resolveSeniorJourneyModule } from "@/lib/journey-handoff";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ccn: string; slug: string }>;
}): Promise<Metadata> {
  if (!isRealProviderUiEnabled())
    return { title: "Facility not found", robots: { index: false, follow: false } };
  const provider = await getProviderByCcnForPage((await params).ccn).catch(() => null);
  if (!provider) return { title: "Facility not found", robots: { index: false, follow: false } };
  const href = providerHref(provider);
  const location = [provider.location.city, provider.location.state].filter(Boolean).join(", ");
  const image = {
    url: `${SHARE_HUB.origin}${href}/share-og`,
    width: SHARE_HUB.ogWidth,
    height: SHARE_HUB.ogHeight,
    alt: `${provider.providerName} — senior care research on SeniorTrustHub`,
  };
  return {
    title: `${provider.providerName} Nursing Home Research`,
    description: `Research ${provider.providerName}${location ? ` in ${location}` : ""} using published CMS staffing, inspection, ownership, and enforcement evidence.`,
    alternates: canonicalUrl(href) ? { canonical: canonicalUrl(href) } : undefined,
    robots: publicRobots(true),
    openGraph: {
      title: `${provider.providerName} Nursing Home Research`,
      description: `Research ${provider.providerName}${location ? ` in ${location}` : ""} using published CMS staffing, inspection, ownership, and enforcement evidence.`,
      images: [image],
    },
    twitter: {
      card: SHARE_HUB.twitterCard,
      title: `${provider.providerName} Nursing Home Research`,
      description: `Research ${provider.providerName}${location ? ` in ${location}` : ""} using published CMS staffing, inspection, ownership, and enforcement evidence.`,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}

export default async function RealFacilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ ccn: string; slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isRealProviderUiEnabled()) notFound();
  const { ccn, slug } = await params;
  const provider = await getProviderByCcnForPage(ccn);
  if (!provider) notFound();
  if (!isCanonicalProviderSlug(provider, slug)) permanentRedirect(providerHref(provider));
  const regulatory = isInspectionIntelligenceEnabled()
    ? await getProviderRegulatoryIntelligenceForPage(provider.ccn)
    : undefined;
  const staffing = isStaffingIntelligenceEnabled()
    ? await getProviderStaffingSummaryForPage(provider.ccn)
    : undefined;
  const ownership = isOwnershipIntelligenceEnabled()
    ? await getProviderOwnershipIntelligenceForPage(provider.ccn)
    : undefined;
  const chain = isChainIntelligenceEnabled()
    ? await getProviderChainIntelligenceForPage(provider.ccn)
    : undefined;
  const trustParticipation = isTrustParticipationEnabled();
  const providerContext = trustParticipation
    ? await getApprovedProviderContextForPage(provider.ccn)
    : [];
  const publishedEnrichment = isVerifiedEnrichmentEnabled()
    ? await getPublishedFacilityEnrichmentForPage(provider.ccn, provider)
    : undefined;
  const stateIntelligence = isStateRegulatoryIntelligenceEnabled()
    ? ((await getPublishedStateIntelligenceForPage(provider.ccn, provider.location.state)) ??
      undefined)
    : undefined;
  const facilityHistory = isFacilityHistoryEnabled()
    ? await getPublishedFacilityHistoryForPage(provider.ccn, {
        includeStateEvents: isStateEnforcementIntelligenceEnabled(),
      })
    : undefined;
  const ownershipOperation =
    isOwnershipIntelligenceV2Enabled() && ownership
      ? await getOwnershipOperationSummaryForPage(provider, ownership, {
          stateIntelligence,
          chain,
        })
      : undefined;
  const resolvedSearch = searchParams ? await searchParams : {};
  const askContext = parseSeniorAskSearchContext(resolvedSearch);
  const journeyModule = resolveSeniorJourneyModule(
    parseNetworkJourney(resolvedSearch),
    "facility",
  );
  return (
    <>
      {askContext && !askContext.unsupported ? (
        <div className="page-shell" style={{ paddingBlock: "1rem 0" }}>
          <AskBackToResults context={askContext} />
        </div>
      ) : null}
      <RealProviderDetail
        provider={provider}
        regulatory={regulatory}
        staffing={staffing}
        ownership={ownership}
        chain={chain ?? undefined}
        providerContext={providerContext}
        trustParticipation={trustParticipation}
        publishedEnrichment={publishedEnrichment}
        stateIntelligence={stateIntelligence}
        facilityHistory={facilityHistory}
        ownershipOperation={ownershipOperation}
        interviewBuilderEnabled={isFacilityInterviewBuilderEnabled()}
        workspaceEnabled={isFamilyComparisonWorkspaceEnabled()}
      />
      <div className="page-shell" style={{ paddingBlock: "0 3rem" }}>
        <JourneyNextStep module={journeyModule} />
      </div>
    </>
  );
}
