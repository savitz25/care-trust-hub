import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AgencyProfilePage } from "@/components/agency-profile-page";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import { getHomeHealthProviderIntelligenceForPage } from "@/server/care/cached-repository";
import { homeHealthResearchDescription } from "@care/domain";
import {
  homeHealthHref,
  homeHealthResearchDocumentTitle,
  providerSlug,
} from "@/server/care/consumer";
import { isAgencyProfileIndexableForPage } from "@/server/care/agency-publication";
import { isHhProfileIntelEnabled } from "@/server/care/feature-flags";
import { SeniorCustomerLayer } from "@/components/senior-customer-layer";
import { seniorClaimProfile, claimCtaEnabledFor } from "@/server/customer-integration/eligibility";
import { fetchCustomerLayer } from "@/server/customer-integration/public";

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
  const description = homeHealthResearchDescription(
    intel.common.display_name,
    location,
    intel.quality_summary.cms_quality_of_patient_care_star?.value != null,
  );
  const href = homeHealthHref(intel.canonical_id, intel.common.display_name);
  const indexable = isAgencyProfileIndexableForPage("home_health", {
    ccn: intel.canonical_id,
    name: intel.common.display_name,
    city: intel.common.office.city,
    state: intel.common.office.state,
    directoryProjection: intel.directory.projection,
  });
  return {
    title,
    description,
    alternates: canonicalUrl(href) ? { canonical: canonicalUrl(href) } : undefined,
    robots: publicRobots(indexable),
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
  const claimProfile = await seniorClaimProfile("home_health", ccn).catch(() => null);
  const customerEnabled = !!claimProfile && claimCtaEnabledFor(claimProfile.nativeProfileId);
  const customer = customerEnabled
    ? await fetchCustomerLayer(claimProfile.nativeProfileId)
    : { profile: null, replies: null };
  return (
    <>
      <AgencyProfilePage intel={intel} />
      <SeniorCustomerLayer
        providerClass="home_health"
        ccn={ccn}
        enabled={customerEnabled}
        {...customer}
      />
    </>
  );
}
