import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { OrganizationPortfolio } from "@/components/organization-portfolio";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import { isOwnershipIntelligenceV2Enabled } from "@/server/care/feature-flags";
import { getPublishedOrganizationPortfolioForPage } from "@/server/care/cached-repository";
import { isValidOrganizationId, organizationHref, providerSlug } from "@/server/care/consumer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}): Promise<Metadata> {
  if (!isOwnershipIntelligenceV2Enabled()) {
    return { title: "Organization not found", robots: publicRobots(false) };
  }
  const { organizationId } = await params;
  if (!isValidOrganizationId(organizationId)) {
    return { title: "Organization not found", robots: publicRobots(false) };
  }
  const page = await getPublishedOrganizationPortfolioForPage(organizationId);
  if (!page) return { title: "Organization not found", robots: publicRobots(false) };
  const href = organizationHref({
    organizationId: page.portfolio.organizationId,
    organizationName: page.portfolio.organizationName,
  });
  return {
    title: `${page.portfolio.organizationName} Ownership Research`,
    description: `Review CMS ownership connections for ${page.portfolio.organizationName}, including ${page.portfolio.facilityCount} currently connected nursing homes.`,
    alternates: canonicalUrl(href) ? { canonical: canonicalUrl(href) } : undefined,
    robots: publicRobots(page.portfolio.indexable),
  };
}

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string; slug: string }>;
}) {
  if (!isOwnershipIntelligenceV2Enabled()) notFound();
  const { organizationId, slug } = await params;
  if (!isValidOrganizationId(organizationId)) notFound();
  const page = await getPublishedOrganizationPortfolioForPage(organizationId);
  if (!page) notFound();
  const expected = providerSlug(page.portfolio.organizationName);
  if (slug !== expected) {
    permanentRedirect(
      organizationHref({
        organizationId: page.portfolio.organizationId,
        organizationName: page.portfolio.organizationName,
      }),
    );
  }
  return (
    <main className="investigation-page">
      <div className="page-shell">
        <RealDataNotice />
        <OrganizationPortfolio page={page} />
      </div>
    </main>
  );
}
