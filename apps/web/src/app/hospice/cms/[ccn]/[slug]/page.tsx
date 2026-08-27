import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AgencyProfilePage } from "@/components/agency-profile-page";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import { getHospiceProviderIntelligenceForPage } from "@/server/care/cached-repository";
import { hospiceHref, hospiceResearchDocumentTitle, providerSlug } from "@/server/care/consumer";
import { isHospiceProfileIntelEnabled } from "@/server/care/feature-flags";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ccn: string; slug: string }>;
}): Promise<Metadata> {
  if (!isHospiceProfileIntelEnabled()) {
    return { title: "Hospice provider not found", robots: { index: false, follow: false } };
  }
  const { ccn } = await params;
  const intel = await getHospiceProviderIntelligenceForPage(ccn).catch(() => null);
  if (!intel?.common.display_name) {
    return { title: "Hospice provider not found", robots: { index: false, follow: false } };
  }
  const title = hospiceResearchDocumentTitle(intel.common.display_name);
  const location = [intel.common.office.city, intel.common.office.state].filter(Boolean).join(", ");
  const description = `Research ${intel.common.display_name}${location ? ` in ${location}` : ""} using published CMS Hospice quality, CAHPS Hospice Survey, ownership, and coverage evidence. No Trust Hub score.`;
  const href = hospiceHref(intel.canonical_id, intel.common.display_name);
  return {
    title,
    description,
    alternates: canonicalUrl(href) ? { canonical: canonicalUrl(href) } : undefined,
    robots: publicRobots(false),
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function HospiceProfileRoute({
  params,
}: {
  params: Promise<{ ccn: string; slug: string }>;
}) {
  if (!isHospiceProfileIntelEnabled()) notFound();
  const { ccn, slug } = await params;
  const intel = await getHospiceProviderIntelligenceForPage(ccn);
  if (!intel?.common.display_name) notFound();
  if (providerSlug(intel.common.display_name) !== slug) {
    permanentRedirect(hospiceHref(intel.canonical_id, intel.common.display_name));
  }
  return <AgencyProfilePage intel={intel} />;
}
