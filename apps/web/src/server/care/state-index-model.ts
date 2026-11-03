import { productionOrigin } from "@/config/deployment";
import { providerSlug } from "./consumer";

export const STATE_INDEX_ROW_LIMIT = 25;
export const STATE_INDEX_PLACE_LIMIT = 10;

export type StateIndexFacility = {
  ccn: string;
  name: string;
  city: string | null;
  href: string;
  overall: number | null;
  healthInspection: number | null;
  staffing: number | null;
  deficiencyCount: number | null;
  fineAmount: number | null;
};

export type StateIndexPlace = {
  name: string;
  count: number;
  href: string;
};

export type StateIndexFactsInput = {
  stateName: string;
  facilityCount: number;
  ratedCount: number;
  averageOverall: number | null;
  highOverallCount: number;
  staffingRatedCount: number;
  topCity: { name: string; count: number } | null;
};

export type StateIndexModel = StateIndexFactsInput & {
  stateCode: string;
  facilities: StateIndexFacility[];
  places: StateIndexPlace[];
  facts: string[];
  about: string;
};

const NEGATION = /\b(not|no|never|none|without|isn't|don't|doesn't|cannot|can't)\b|≠/gi;

export function stateIndexAbout(): string {
  return [
    "These rows are CMS-certified nursing homes from the current Medicare Provider Information release, listed A to Z.",
    "The city and the three star columns are the CMS fields in that release.",
    "The deficiency column counts findings on the latest standard health survey when that survey is present.",
    "The fine column shows the latest CMS penalty amount when a penalty is present.",
    "A blank cell means that field was empty in the release.",
    "State license classes remain in the research sections on this page.",
  ].join(" ");
}

export function negationTokensPer100Words(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const negations = text.match(NEGATION)?.length ?? 0;
  if (words === 0) return 0;
  return (negations / words) * 100;
}

export function buildStateIndexFacts(input: StateIndexFactsInput): string[] {
  const facts = [
    `CMS lists ${input.facilityCount.toLocaleString("en-US")} nursing homes in ${input.stateName} on the current Provider Information release.`,
  ];
  if (input.topCity) {
    facts.push(
      `${input.topCity.name} has ${input.topCity.count.toLocaleString("en-US")} of those CMS nursing homes, the largest city count in ${input.stateName}.`,
    );
  }
  if (input.averageOverall != null && input.ratedCount > 0) {
    facts.push(
      `Among ${input.ratedCount.toLocaleString("en-US")} homes with an overall star, the average in ${input.stateName} is ${input.averageOverall}.`,
    );
  }
  if (facts.length < 4 && input.highOverallCount > 0) {
    facts.push(
      `${input.highOverallCount.toLocaleString("en-US")} ${input.stateName} homes show an overall star of 4 or 5.`,
    );
  }
  if (facts.length < 4 && input.staffingRatedCount > 0) {
    facts.push(
      `${input.staffingRatedCount.toLocaleString("en-US")} ${input.stateName} homes publish a staffing star.`,
    );
  }
  return facts.slice(0, 4);
}

export function facilityIndexHref(ccn: string, name: string): string {
  return `/facility/cms/${ccn}/${providerSlug(name)}`;
}

export function cityIndexHref(stateCode: string, city: string): string {
  const params = new URLSearchParams({ search: "1", state: stateCode, city });
  return `/search?${params.toString()}`;
}

export function stateIndexItemList(model: Pick<StateIndexModel, "stateName" | "facilities">) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `CMS nursing homes in ${model.stateName}`,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: model.facilities.length,
    itemListElement: model.facilities.map((facility, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: facility.name,
      url: new URL(facility.href, productionOrigin).href,
    })),
  };
}

export function dollar(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  });
}
