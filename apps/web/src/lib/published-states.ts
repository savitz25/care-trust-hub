import { PUBLISHED_STATEWIDE_SLUGS } from "./published-state-path";

/**
 * Single local list behind homepage state counts, state links, and the header state menu.
 * Derived from PUBLISHED_STATEWIDE_SLUGS (the published /<state> routes), so a newly
 * published state appears without a hand-entered count.
 */
export type PublishedState = {
  slug: string;
  code: string;
  name: string;
  href: string;
  /** Present only for the newest state pages; restates that page's own published scope. */
  newestSummary?: string;
};

const CODES: Record<(typeof PUBLISHED_STATEWIDE_SLUGS)[number], string> = {
  arizona: "AZ",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  florida: "FL",
  illinois: "IL",
  "new-jersey": "NJ",
  "new-york": "NY",
  "north-carolina": "NC",
  ohio: "OH",
  georgia: "GA",
  massachusetts: "MA",
  minnesota: "MN",
  michigan: "MI",
  maryland: "MD",
  wisconsin: "WI",
  indiana: "IN",
  tennessee: "TN",
  nevada: "NV",
  oregon: "OR",
  pennsylvania: "PA",
  texas: "TX",
  virginia: "VA",
  washington: "WA",
  louisiana: "LA",
  alabama: "AL",
  kentucky: "KY",
  "south-carolina": "SC",
  mississippi: "MS",
  oklahoma: "OK",
  missouri: "MO",
  arkansas: "AR",
  "new-mexico": "NM",
  nebraska: "NE",
};

/** Newest state pages first. */
const NEWEST: Partial<Record<(typeof PUBLISHED_STATEWIDE_SLUGS)[number], string>> = {
  nebraska:
    "DHHS September 15, 2026 rosters for assisted living, long-term care, and adult day, counted separately",
  "new-mexico":
    "Health Care Authority Division of Health Improvement: nursing facilities, assisted living, adult residential care, home health, hospice, adult day, and ICF/IID were not acquired as state rosters",
  arkansas:
    "DHS SFY 2022 narrative for nursing facilities, ICF/IID, and psychiatric residential care, kept separate from surveys and complaints",
  oklahoma:
    "OSDH April 2026 facility directories and the August 26, 2026 provider-call counts, kept on separate clocks",
  missouri:
    "DHSS long-term care directory: SNF, ICF, RCF, RCF*, ALF and ALF** licensure levels kept separate",
  mississippi:
    "MSDH 18 Sep 2026 directory: nursing facilities, personal care homes, home health, hospice, and ICF/IID providers, counted separately",
  "south-carolina":
    "DPH nursing home, community residential care, home health, hospice, adult day, in-home care, and intermediate care license rows, counted separately",
  kentucky:
    "OIG long-term care, assisted living, personal care, family care, adult day, home health, hospice, and personal services directories, counted separately",
  alabama:
    "ADPH nursing home, assisted living, specialty care assisted living, home health, and hospice directory exports, counted separately",
  louisiana:
    "LDH Health Standards nursing home, adult residential care, home health, hospice, adult day health care and ICF/IID directories, counted separately",
  indiana:
    "Department of Health Comprehensive Care, Residential Care, Home Health Agency and Hospice license directories",
  wisconsin: "DHS statewide AFH, CBRF, RCAC, nursing home, hospice and home health directories",
  connecticut: "DPH facility-license classes, exact credential status and selected facility orders",
  maryland:
    "OHCQ assisted living, long term care, home health, hospice and adult medical day care license directories",
  michigan:
    "LARA/BCHS AFC, Home for the Aged, nursing home and hospice license snapshots and discipline evidence",
};

function nameFor(slug: string): string {
  return slug
    .split("-")
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

export const PUBLISHED_STATES: PublishedState[] = PUBLISHED_STATEWIDE_SLUGS.map((slug) => ({
  slug,
  code: CODES[slug],
  name: nameFor(slug),
  href: `/${slug}`,
  newestSummary: NEWEST[slug],
})).sort((a, b) => a.name.localeCompare(b.name));

export const PUBLISHED_STATE_COUNT = PUBLISHED_STATES.length;

export const NEWEST_PUBLISHED_STATES: PublishedState[] = Object.keys(NEWEST)
  .map((slug) => PUBLISHED_STATES.find((state) => state.slug === slug))
  .filter((state): state is PublishedState => Boolean(state));

const HREF_BY_CODE = new Map(PUBLISHED_STATES.map((state) => [state.code, state.href]));

export function publishedStateHref(code: string): string | null {
  return HREF_BY_CODE.get(code.toUpperCase()) ?? null;
}
