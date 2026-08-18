/** Ask Network V2 — checked-in registry. Do not fetch from Ask at runtime. */

export const ASK_NETWORK_STANDARD_VERSION = "2026.08.18-network-v2";
export const ASK_NETWORK_STANDARD_URL = "https://www.asktrusthub.com/methodology";
export const ASK_NETWORK_OWNERSHIP_SHORT =
  "Common ownership · Separated research and listing order · No paid placements";

export const NETWORK_HUBS = [
  {
    id: "ask" as const,
    name: "Ask Trust Hub",
    href: "https://www.asktrusthub.com",
    blurb: "Parent research & standards layer",
  },
  {
    id: "move" as const,
    name: "Move Trust Hub",
    href: "https://www.movetrusthub.com",
    blurb: "FMCSA / SAFER mover research",
  },
  {
    id: "lender" as const,
    name: "Lender Trust Hub",
    href: "https://www.lendertrusthub.com",
    blurb: "NMLS / CFPB / FDIC financing research",
  },
  {
    id: "insurance" as const,
    name: "Insurance Trust Hub",
    href: "https://www.insurancetrusthub.com",
    blurb: "State DOI / NAIC coverage research",
  },
  {
    id: "contractor" as const,
    name: "Contractor Trust Hub",
    href: "https://www.contractortrusthub.com",
    blurb: "State licensing-board contractor research",
  },
  {
    id: "senior" as const,
    name: "SeniorTrustHub",
    href: "https://www.seniortrusthub.com",
    blurb: "CMS / supported state senior-care research",
  },
  {
    id: "investor" as const,
    name: "InvestorTrustHub",
    href: "https://www.investortrusthub.com",
    blurb: "SEC / IARD investment-firm research",
  },
] as const;

export type NetworkHubId = (typeof NETWORK_HUBS)[number]["id"];
export const CURRENT_NETWORK_HUB_ID: NetworkHubId = "senior";
