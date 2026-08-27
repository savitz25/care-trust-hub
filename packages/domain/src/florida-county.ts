/** Explicit Florida county aliases. Exact match only. No fuzzy mapping. */

export const FLORIDA_COUNTIES = [
  "Alachua",
  "Baker",
  "Bay",
  "Bradford",
  "Brevard",
  "Broward",
  "Calhoun",
  "Charlotte",
  "Citrus",
  "Clay",
  "Collier",
  "Columbia",
  "DeSoto",
  "Dixie",
  "Duval",
  "Escambia",
  "Flagler",
  "Franklin",
  "Gadsden",
  "Gilchrist",
  "Glades",
  "Gulf",
  "Hamilton",
  "Hardee",
  "Hendry",
  "Hernando",
  "Highlands",
  "Hillsborough",
  "Holmes",
  "Indian River",
  "Jackson",
  "Jefferson",
  "Lafayette",
  "Lake",
  "Lee",
  "Leon",
  "Levy",
  "Liberty",
  "Madison",
  "Manatee",
  "Marion",
  "Martin",
  "Miami-Dade",
  "Monroe",
  "Nassau",
  "Okaloosa",
  "Okeechobee",
  "Orange",
  "Osceola",
  "Palm Beach",
  "Pasco",
  "Pinellas",
  "Polk",
  "Putnam",
  "St. Johns",
  "St. Lucie",
  "Santa Rosa",
  "Sarasota",
  "Seminole",
  "Sumter",
  "Suwannee",
  "Taylor",
  "Union",
  "Volusia",
  "Wakulla",
  "Walton",
  "Washington",
] as const;

export type FloridaCounty = (typeof FLORIDA_COUNTIES)[number];

/** Documented exact aliases from AHCA served-county strings. */
export const FLORIDA_COUNTY_ALIASES: Record<string, FloridaCounty> = {
  Dade: "Miami-Dade",
  Desoto: "DeSoto",
  Hillsborou: "Hillsborough",
};

export interface CountyNormalization {
  raw: string;
  canonical: FloridaCounty | null;
  mapped: boolean;
  mapping: string | null;
}

const CANONICAL = new Set<string>(FLORIDA_COUNTIES);

export function normalizeFloridaCounty(raw: string): CountyNormalization {
  const value = raw.trim();
  if (CANONICAL.has(value)) {
    return { raw: value, canonical: value as FloridaCounty, mapped: false, mapping: null };
  }
  const alias = FLORIDA_COUNTY_ALIASES[value];
  if (alias) {
    return {
      raw: value,
      canonical: alias,
      mapped: true,
      mapping: `${value} → ${alias}`,
    };
  }
  return { raw: value, canonical: null, mapped: false, mapping: null };
}
