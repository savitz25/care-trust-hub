import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AgencyProfilePage } from "@/components/agency-profile-page";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import { getHospiceProviderIntelligenceForPage } from "@/server/care/cached-repository";
import { hospiceResearchDescription } from "@care/domain";
import { hospiceHref, hospiceResearchDocumentTitle, providerSlug } from "@/server/care/consumer";
import { isAgencyProfileIndexableForPage } from "@/server/care/agency-publication";
import { isHospiceProfileIntelEnabled } from "@/server/care/feature-flags";
import { SeniorCustomerLayer } from "@/components/senior-customer-layer";
import { seniorClaimProfile, claimCtaEnabledFor } from "@/server/customer-integration/eligibility";
import { fetchCustomerLayer } from "@/server/customer-integration/public";

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
  const description = hospiceResearchDescription(
    intel.common.display_name,
    location,
    intel.quality_summary.families.length > 0,
  );
  const href = hospiceHref(intel.canonical_id, intel.common.display_name);
  const indexable = isAgencyProfileIndexableForPage("hospice", {
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
  const claimProfile = await seniorClaimProfile("hospice", ccn).catch(() => null);
  const customer = claimProfile
    ? await fetchCustomerLayer(claimProfile.nativeProfileId)
    : { profile: null, replies: null };
  return (
    <>
      <AgencyProfilePage intel={intel} />
      <SeniorCustomerLayer
        providerClass="hospice"
        ccn={ccn}
        enabled={!!claimProfile && claimCtaEnabledFor(claimProfile.nativeProfileId)}
        {...customer}
      />
    </>
  );
}
