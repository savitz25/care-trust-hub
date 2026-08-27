import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AgencyProfilePage } from "@/components/agency-profile-page";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import { getHomeHealthProviderIntelligenceForPage } from "@/server/care/cached-repository";
import {
  homeHealthHref,
  homeHealthResearchDocumentTitle,
  providerSlug,
} from "@/server/care/consumer";
import { isHhProfileIntelEnabled } from "@/server/care/feature-flags";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ccn: string; slug: string }>;
}): Promise<Metadata> {
  if (!isHhProfileIntelEnabled()) {
    return { title: "Home Health agency not found", robots: { index: false, follow: false } };
  }
  const { ccn } = await params;
  const intel = await getHomeHealthProviderIntelligenceForPage(ccn).catch(() => null);
  if (!intel?.common.display_name) {
    return { title: "Home Health agency not found", robots: { index: false, follow: false } };
  }
  const title = homeHealthResearchDocumentTitle(intel.common.display_name);
  const location = [intel.common.office.city, intel.common.office.state].filter(Boolean).join(", ");
  const description = `Research ${intel.common.display_name}${location ? ` in ${location}` : ""} using published CMS Home Health quality, HHCAHPS, ownership, and coverage evidence. No Trust Hub score.`;
  const href = homeHealthHref(intel.canonical_id, intel.common.display_name);
  return {
    title,
    description,
    alternates: canonicalUrl(href) ? { canonical: canonicalUrl(href) } : undefined,
    robots: publicRobots(false),
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function HomeHealthProfileRoute({
  params,
}: {
  params: Promise<{ ccn: string; slug: string }>;
}) {
  if (!isHhProfileIntelEnabled()) notFound();
  const { ccn, slug } = await params;
  const intel = await getHomeHealthProviderIntelligenceForPage(ccn);
  if (!intel?.common.display_name) notFound();
  if (providerSlug(intel.common.display_name) !== slug) {
    permanentRedirect(homeHealthHref(intel.canonical_id, intel.common.display_name));
  }
  return <AgencyProfilePage intel={intel} />;
}
