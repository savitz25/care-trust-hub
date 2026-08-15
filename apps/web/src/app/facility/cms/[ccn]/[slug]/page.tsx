import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RealProviderDetail } from "@/components/real-provider-detail";
import { isCanonicalProviderSlug, providerHref } from "@/server/care/consumer";
import {
  getProviderByCcnForPage,
  getProviderRegulatoryIntelligenceForPage,
  getProviderStaffingSummaryForPage,
} from "@/server/care/cached-repository";
import {
  isInspectionIntelligenceEnabled,
  isRealProviderUiEnabled,
  isStaffingIntelligenceEnabled,
} from "@/server/care/feature-flags";

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
  return {
    title: `${provider.providerName} — CMS evidence review`,
    description: `Review current CMS Provider Information evidence for ${provider.providerName}.`,
    robots: { index: false, follow: false },
  };
}

export default async function RealFacilityPage({
  params,
}: {
  params: Promise<{ ccn: string; slug: string }>;
}) {
  if (!isRealProviderUiEnabled()) notFound();
  const { ccn, slug } = await params;
  const provider = await getProviderByCcnForPage(ccn);
  if (!provider) notFound();
  if (!isCanonicalProviderSlug(provider, slug)) redirect(providerHref(provider));
  const regulatory = isInspectionIntelligenceEnabled()
    ? await getProviderRegulatoryIntelligenceForPage(provider.ccn)
    : undefined;
  const staffing = isStaffingIntelligenceEnabled()
    ? await getProviderStaffingSummaryForPage(provider.ccn)
    : undefined;
  return <RealProviderDetail provider={provider} regulatory={regulatory} staffing={staffing} />;
}
