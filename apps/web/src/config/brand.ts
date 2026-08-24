export const brand = {
  productKey: "care",
  publicName: "SeniorTrustHub",
  networkName: "Ask Trust Hub",
  tagline: "Research senior care without being sold senior care.",
  philosophy: "We cite. You decide.",
  description:
    "Independent senior care research using published government evidence. No paid placements.",
  publicContactEmail: "hello@asktrusthub.com",
  locale: "en_US",
  colors: {
    primary: "#681860",
    navy: "#082860",
  },
} as const;

export type BrandConfig = typeof brand;
