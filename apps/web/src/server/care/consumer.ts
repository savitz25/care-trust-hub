import type { CareCmsRatingSummary, CareProviderDetail } from "./types";

export const CMS_RATING_EXPLANATIONS = {
  overall:
    "The CMS overall rating summarizes health inspections, staffing, and quality measures within Medicare's Five-Star system.",
  healthInspection:
    "The CMS health inspection rating reflects findings from standard and complaint inspections used in Medicare's Five-Star system.",
  staffing:
    "The CMS staffing rating reflects staffing levels and related measures used in Medicare's Five-Star system.",
  qualityMeasure:
    "The CMS quality-measure rating summarizes selected resident assessment and claims-based measures used in Medicare's Five-Star system.",
} as const;

export function providerSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/g, "");
  return slug || "provider";
}

export function providerHref(provider: Pick<CareProviderDetail, "ccn" | "providerName">): string {
  return `/facility/cms/${provider.ccn}/${providerSlug(provider.providerName)}`;
}

export function isCanonicalProviderSlug(
  provider: Pick<CareProviderDetail, "providerName">,
  slug: string,
) {
  return providerSlug(provider.providerName) === slug;
}

export function cmsRatingText(value: number | null): string {
  return value === null ? "Not reported in this CMS release" : `${value} of 5 CMS stars`;
}

export function factualRatingObservations(ratings: CareCmsRatingSummary): string[] {
  const entries: Array<[string, number | null]> = [
    ["overall", ratings.overall],
    ["health inspection", ratings.healthInspection],
    ["staffing", ratings.staffing],
    ["quality-measure", ratings.qualityMeasure],
  ];
  return entries.map(([label, value]) =>
    value === null
      ? `CMS did not publish ${label === "overall" ? "an" : "a"} ${label} star rating for this provider in this release.`
      : `CMS reports a ${value}-star ${label} rating.`,
  );
}
