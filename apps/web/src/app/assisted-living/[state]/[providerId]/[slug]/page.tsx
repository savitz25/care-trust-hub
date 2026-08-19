import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { assistedLivingNameSlug, publishedAssistedLivingPath } from "@care/domain";
import { AssistedLivingProviderDetail } from "@/components/assisted-living-provider";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, isPublicLaunchEnabled, publicRobots } from "@/config/deployment";
import {
  isAssistedLivingIntelligenceEnabled,
  isFamilyComparisonWorkspaceEnabled,
  isFacilityInterviewBuilderEnabled,
} from "@/server/care/feature-flags";
import { getPublishedAssistedLivingProvider } from "@/server/care/assisted-living-publication";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; providerId: string; slug: string }>;
}): Promise<Metadata> {
  if (!isAssistedLivingIntelligenceEnabled()) {
    return { title: "Provider not found", robots: publicRobots(false) };
  }
  const { providerId } = await params;
  const provider = await getPublishedAssistedLivingProvider(providerId);
  if (!provider) return { title: "Provider not found", robots: publicRobots(false) };
  const href = publishedAssistedLivingPath({
    stateCode: provider.stateCode,
    id: provider.id,
    officialName: provider.officialName,
  });
  const location = [provider.officialCity, provider.stateCode].filter(Boolean).join(", ");
  return {
    title: `${provider.officialName} assisted living research`,
    description: `Research ${provider.officialName}${location ? ` in ${location}` : ""} using official ${provider.stateCode} licensing evidence. No scores or paid placement.`,
    alternates: canonicalUrl(href) ? { canonical: canonicalUrl(href) } : undefined,
    robots: publicRobots(true),
  };
}

export default async function AssistedLivingProviderPage({
  params,
}: {
  params: Promise<{ state: string; providerId: string; slug: string }>;
}) {
  if (!isAssistedLivingIntelligenceEnabled()) notFound();
  const { state, providerId, slug } = await params;
  const provider = await getPublishedAssistedLivingProvider(providerId);
  if (!provider) notFound();
  if (state.toLowerCase() !== provider.stateCode.toLowerCase()) {
    permanentRedirect(
      publishedAssistedLivingPath({
        stateCode: provider.stateCode,
        id: provider.id,
        officialName: provider.officialName,
      }),
    );
  }
  if (slug !== assistedLivingNameSlug(provider.officialName)) {
    permanentRedirect(
      publishedAssistedLivingPath({
        stateCode: provider.stateCode,
        id: provider.id,
        officialName: provider.officialName,
      }),
    );
  }
  const href = publishedAssistedLivingPath({
    stateCode: provider.stateCode,
    id: provider.id,
    officialName: provider.officialName,
  });
  const canonical = canonicalUrl(href);
  return (
    <div className="page-shell">
      {isPublicLaunchEnabled() && canonical ? (
        <StructuredData
          value={{
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: provider.officialName,
            url: canonical,
            address: {
              "@type": "PostalAddress",
              streetAddress: provider.officialStreet ?? undefined,
              addressLocality: provider.officialCity ?? undefined,
              addressRegion: provider.stateCode,
              postalCode: provider.officialZip ?? undefined,
            },
          }}
        />
      ) : null}
      <AssistedLivingProviderDetail
        provider={provider}
        workspaceEnabled={isFamilyComparisonWorkspaceEnabled()}
        interviewEnabled={isFacilityInterviewBuilderEnabled()}
      />
    </div>
  );
}
