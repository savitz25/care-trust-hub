import type { SeniorResearchQuery } from "./senior-ask-contract";
export const SENIOR_OFFICIAL_RECOVERY = {
  agency: "Centers for Medicare & Medicaid Services",
  jurisdiction: "US",
  purpose:
    "Official Medicare provider comparison/search; choose a provider class and search the provider or CCN where supported.",
  url: "https://www.medicare.gov/care-compare/",
  checkedAt: "2026-09-12",
  deepLink: false,
  limitation:
    "A link is not a live provider verification. No unverified CCN deep-link parameter is constructed.",
} as const;
export function validSeniorOfficialRecovery(url: string) {
  return url === SENIOR_OFFICIAL_RECOVERY.url;
}
export function stateCareRecovery(query: SeniorResearchQuery) {
  const state = query.geography?.type === "state" ? query.geography.value : query.geography?.state;
  const routes: Record<string, { href: string; label: string }> = {
    VA: { href: "/virginia", label: "Open Virginia DSS assisted-living research" },
    NY: { href: "/new-york", label: "Open New York Adult Care / ALP / ALR research" },
    AZ: { href: "/arizona", label: "Open Arizona assisted-living research" },
    FL: { href: "/florida", label: "Open Florida care-setting intelligence" },
  };
  return state
    ? (routes[state] ?? null)
    : { href: "/assisted-living", label: "Explore state-specific assisted-living research" };
}
