import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssistedLivingSearch } from "@/components/assisted-living-search";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import {
  isAssistedLivingIntelligenceEnabled,
  isFamilyComparisonWorkspaceEnabled,
} from "@/server/care/feature-flags";
import { searchPublishedAssistedLivingProviders } from "@/server/care/assisted-living-publication";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  if (!isAssistedLivingIntelligenceEnabled()) {
    return { title: "Page not found", robots: publicRobots(false) };
  }
  const params = await searchParams;
  const filtered = Object.keys(params).some((key) => key !== "search" && params[key]);
  return {
    title: "Assisted living in California, New York, and Texas",
    description:
      "Research state-licensed assisted living and residential care in California, New York, and Texas using official regulator listings. No scores or paid placement.",
    alternates: canonicalUrl("/assisted-living")
      ? { canonical: canonicalUrl("/assisted-living") }
      : undefined,
    robots: publicRobots(!filtered),
  };
}

export default async function AssistedLivingSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isAssistedLivingIntelligenceEnabled()) notFound();
  const params = await searchParams;
  const page = Math.max(Number(typeof params.page === "string" ? params.page : 1) || 1, 1);
  const submitted = params.search === "1";
  const found = submitted
    ? await searchPublishedAssistedLivingProviders({
        stateCode: typeof params.state === "string" ? params.state : undefined,
        city: typeof params.city === "string" ? params.city : undefined,
        zip: typeof params.zip === "string" ? params.zip : undefined,
        consumerCategory: typeof params.category === "string" ? params.category : undefined,
        explicitMemory: params.memory === "1",
        limit: 20,
        offset: (page - 1) * 20,
      })
    : { results: [], total: 0, hasMore: false };
  return (
    <div className="page-shell">
      <AssistedLivingSearch
        searchParams={params}
        results={found.results}
        total={found.total}
        hasMore={found.hasMore}
        page={page}
        workspaceEnabled={isFamilyComparisonWorkspaceEnabled()}
      />
    </div>
  );
}
