import { productionOrigin } from "@/config/deployment";
import type {
  CareProviderDetail,
  CareRegulatoryIntelligence,
  CareStaffingIntelligence,
} from "./types";
import { providerSlug } from "./consumer";

export const FACILITY_NEARBY_LIMIT = 10;

const STATE_PAGES: Record<string, { name: string; slug: string }> = {
  AL: { name: "Alabama", slug: "alabama" },
  AK: { name: "Alaska", slug: "alaska" },
  AZ: { name: "Arizona", slug: "arizona" },
  AR: { name: "Arkansas", slug: "arkansas" },
  CA: { name: "California", slug: "california" },
  CO: { name: "Colorado", slug: "colorado" },
  CT: { name: "Connecticut", slug: "connecticut" },
  DE: { name: "Delaware", slug: "delaware" },
  FL: { name: "Florida", slug: "florida" },
  GA: { name: "Georgia", slug: "georgia" },
  HI: { name: "Hawaii", slug: "hawaii" },
  ID: { name: "Idaho", slug: "idaho" },
  IL: { name: "Illinois", slug: "illinois" },
  IN: { name: "Indiana", slug: "indiana" },
  IA: { name: "Iowa", slug: "iowa" },
  KS: { name: "Kansas", slug: "kansas" },
  KY: { name: "Kentucky", slug: "kentucky" },
  LA: { name: "Louisiana", slug: "louisiana" },
  ME: { name: "Maine", slug: "maine" },
  MD: { name: "Maryland", slug: "maryland" },
  MA: { name: "Massachusetts", slug: "massachusetts" },
  MI: { name: "Michigan", slug: "michigan" },
  MN: { name: "Minnesota", slug: "minnesota" },
  MS: { name: "Mississippi", slug: "mississippi" },
  MO: { name: "Missouri", slug: "missouri" },
  MT: { name: "Montana", slug: "montana" },
  NE: { name: "Nebraska", slug: "nebraska" },
  NV: { name: "Nevada", slug: "nevada" },
  NH: { name: "New Hampshire", slug: "new-hampshire" },
  NJ: { name: "New Jersey", slug: "new-jersey" },
  NM: { name: "New Mexico", slug: "new-mexico" },
  NY: { name: "New York", slug: "new-york" },
  NC: { name: "North Carolina", slug: "north-carolina" },
  ND: { name: "North Dakota", slug: "north-dakota" },
  OH: { name: "Ohio", slug: "ohio" },
  OK: { name: "Oklahoma", slug: "oklahoma" },
  OR: { name: "Oregon", slug: "oregon" },
  PA: { name: "Pennsylvania", slug: "pennsylvania" },
  RI: { name: "Rhode Island", slug: "rhode-island" },
  SC: { name: "South Carolina", slug: "south-carolina" },
  SD: { name: "South Dakota", slug: "south-dakota" },
  TN: { name: "Tennessee", slug: "tennessee" },
  TX: { name: "Texas", slug: "texas" },
  UT: { name: "Utah", slug: "utah" },
  VT: { name: "Vermont", slug: "vermont" },
  VA: { name: "Virginia", slug: "virginia" },
  WA: { name: "Washington", slug: "washington" },
  WV: { name: "West Virginia", slug: "west-virginia" },
  WI: { name: "Wisconsin", slug: "wisconsin" },
  WY: { name: "Wyoming", slug: "wyoming" },
};

export type FacilityNearby = {
  ccn: string;
  name: string;
  city: string | null;
  href: string;
};

export type FacilityFine = { amount: number; date: string };

export type FacilityComparisons = {
  overallStateAverage: number | null;
  healthStateAverage: number | null;
  deficiencyStateAverage: number | null;
  staffingHoursStateAverage: number | null;
  nearby: Array<{ ccn: string; name: string; city: string | null }>;
};

export type FacilityProfileModel = {
  lead: string;
  stateName: string;
  stateHref: string | null;
  nearby: FacilityNearby[];
  organization: Record<string, unknown>;
  breadcrumb: Record<string, unknown>;
};

export function ratingText(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${value} of 5`;
}

function mediumDate(iso: string): string {
  const [year, month, date] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !date) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, date)),
  );
}

function dollars(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  });
}

function hours(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function compared(stateName: string, average: number | null, digits: number): string {
  if (average == null || !Number.isFinite(average)) return "";
  const printed = average.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `, compared with the ${stateName} average of ${printed}`;
}

export function statePage(stateCode: string): { name: string; href: string } | null {
  const page = STATE_PAGES[stateCode.trim().toUpperCase()];
  if (!page) return null;
  return { name: page.name, href: `/${page.slug}` };
}

function latestStandard(regulatory?: CareRegulatoryIntelligence | null): {
  count: number | null;
  date: string | null;
} {
  const standard = (regulatory?.inspections ?? []).filter(
    (inspection) =>
      /standard|health/i.test(inspection.surveyType) &&
      !/complaint|fire/i.test(inspection.surveyType),
  );
  standard.sort((a, b) => b.surveyDate.localeCompare(a.surveyDate));
  const latest = standard[0];
  if (!latest) return { count: null, date: null };
  return { count: latest.findings.length, date: latest.surveyDate };
}

function finesFrom(regulatory?: CareRegulatoryIntelligence | null): FacilityFine[] {
  return (regulatory?.penalties ?? [])
    .filter(
      (penalty) => penalty.penaltyType === "Fine" && penalty.penaltyDate && penalty.fineAmount,
    )
    .map((penalty) => ({ amount: Number(penalty.fineAmount), date: penalty.penaltyDate }))
    .filter((fine) => Number.isFinite(fine.amount) && fine.amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
}

export function buildFacilityLead(input: {
  name: string;
  city: string | null;
  stateName: string;
  beds: number | null;
  overall: number | null;
  overallStateAverage: number | null;
  healthInspection: number | null;
  healthStateAverage: number | null;
  staffingRating: number | null;
  deficiencyCount: number | null;
  deficiencyDate: string | null;
  deficiencyStateAverage: number | null;
  fines: FacilityFine[];
  staffingHours: number | null;
  staffingQuarter: string | null;
  staffingHoursStateAverage: number | null;
}): string {
  const place = [input.city, input.stateName].filter(Boolean).join(", ");
  const sentences: string[] = [];
  if (input.beds != null && input.beds > 0) {
    sentences.push(
      `${input.name} has ${input.beds.toLocaleString("en-US")} certified beds${place ? ` in ${place}` : ""}.`,
    );
  } else {
    sentences.push(
      place
        ? `${input.name} is a CMS nursing home in ${place}.`
        : `${input.name} is a CMS nursing home.`,
    );
  }
  const overall = ratingText(input.overall);
  if (overall) {
    sentences.push(
      `The CMS overall rating is ${overall}${compared(input.stateName, input.overallStateAverage, 1)}.`,
    );
  }
  const health = ratingText(input.healthInspection);
  if (health) {
    sentences.push(
      `The CMS health inspection rating is ${health}${compared(input.stateName, input.healthStateAverage, 1)}.`,
    );
  }
  const staffing = ratingText(input.staffingRating);
  if (staffing) sentences.push(`The CMS staffing rating is ${staffing}.`);
  if (input.deficiencyCount != null) {
    const dated = input.deficiencyDate ? ` on ${mediumDate(input.deficiencyDate)}` : "";
    sentences.push(
      `The latest standard health survey${dated} lists ${input.deficiencyCount.toLocaleString("en-US")} deficiencies${compared(input.stateName, input.deficiencyStateAverage, 1)}.`,
    );
  }
  for (const fine of input.fines) {
    sentences.push(`CMS records a fine of ${dollars(fine.amount)} dated ${mediumDate(fine.date)}.`);
  }
  if (input.staffingHours != null && input.staffingHours > 0) {
    const quarter = input.staffingQuarter ? ` in ${input.staffingQuarter}` : "";
    sentences.push(
      `Total nurse staffing is ${hours(input.staffingHours)} hours per resident day${quarter}${compared(input.stateName, input.staffingHoursStateAverage, 2)}.`,
    );
  }
  return sentences.join(" ");
}

function absolute(path: string): string {
  return new URL(path, productionOrigin).href;
}

export function buildFacilityProfile(input: {
  provider: Pick<
    CareProviderDetail,
    "ccn" | "providerName" | "telephone" | "certifiedBeds" | "ratings" | "location"
  >;
  regulatory?: CareRegulatoryIntelligence | null;
  staffing?: CareStaffingIntelligence | null;
  comparisons?: FacilityComparisons | null;
}): FacilityProfileModel {
  const page = statePage(input.provider.location.state);
  const stateName = page?.name ?? input.provider.location.state;
  const survey = latestStandard(input.regulatory);
  const nearby = (input.comparisons?.nearby ?? [])
    .filter((facility) => facility.ccn && facility.name && facility.ccn !== input.provider.ccn)
    .slice(0, FACILITY_NEARBY_LIMIT)
    .map((facility) => ({
      ccn: facility.ccn,
      name: facility.name,
      city: facility.city,
      href: `/facility/cms/${facility.ccn}/${providerSlug(facility.name)}`,
    }));
  const href = `/facility/cms/${input.provider.ccn}/${providerSlug(input.provider.providerName)}`;
  const address: Record<string, unknown> = { "@type": "PostalAddress" };
  if (input.provider.location.address) address.streetAddress = input.provider.location.address;
  if (input.provider.location.city) address.addressLocality = input.provider.location.city;
  if (input.provider.location.state) address.addressRegion = input.provider.location.state;
  if (input.provider.location.zipCode) address.postalCode = input.provider.location.zipCode;
  const organization: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["NursingHome", "MedicalOrganization"],
    name: input.provider.providerName,
    url: absolute(href),
    address,
    identifier: {
      "@type": "PropertyValue",
      propertyID: "CCN",
      value: input.provider.ccn,
    },
  };
  if (input.provider.telephone) organization.telephone = input.provider.telephone;
  const crumbs: Array<Record<string, unknown>> = [
    { "@type": "ListItem", position: 1, name: "Home", item: absolute("/") },
  ];
  if (page) {
    crumbs.push({
      "@type": "ListItem",
      position: crumbs.length + 1,
      name: page.name,
      item: absolute(page.href),
    });
  }
  crumbs.push({
    "@type": "ListItem",
    position: crumbs.length + 1,
    name: input.provider.providerName,
    item: absolute(href),
  });
  return {
    lead: buildFacilityLead({
      name: input.provider.providerName,
      city: input.provider.location.city,
      stateName,
      beds: input.provider.certifiedBeds,
      overall: input.provider.ratings.overall,
      overallStateAverage: input.comparisons?.overallStateAverage ?? null,
      healthInspection: input.provider.ratings.healthInspection,
      healthStateAverage: input.comparisons?.healthStateAverage ?? null,
      staffingRating: input.provider.ratings.staffing,
      deficiencyCount: survey.count,
      deficiencyDate: survey.date,
      deficiencyStateAverage: input.comparisons?.deficiencyStateAverage ?? null,
      fines: finesFrom(input.regulatory),
      staffingHours: input.staffing?.latest?.totalNurseHprd ?? null,
      staffingQuarter: input.staffing?.latest?.quarter ?? null,
      staffingHoursStateAverage: input.comparisons?.staffingHoursStateAverage ?? null,
    }),
    stateName,
    stateHref: page?.href ?? null,
    nearby,
    organization,
    breadcrumb: {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs,
    },
  };
}
