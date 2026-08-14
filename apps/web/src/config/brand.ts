export const brand = {
  productKey: "care",
  publicName: "Care intelligence platform",
  networkName: "Ask Trust Hub",
  tagline: "Research care without being sold care.",
  philosophy: "We cite. You decide.",
  description: "An independent development environment for evidence-led care research.",
  locale: "en_US",
  colors: {
    primary: "#1d5b4f",
  },
} as const;

export type BrandConfig = typeof brand;
