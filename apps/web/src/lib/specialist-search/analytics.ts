import type { SearchCapabilityState, SpecialistSearchIntent } from "./contract";

export type SeniorSearchAnalytics = {
  hub: "senior";
  intent: SpecialistSearchIntent;
  providerClass?: string;
  state?: string;
  hasCounty: boolean;
  hasIdentifier: boolean;
  hasEvidenceFilter: boolean;
  cmsMetric?: string;
  coverageState?: SearchCapabilityState;
};

export function resultCountBucket(count: number): string {
  return count === 0 ? "0" : count === 1 ? "1" : count <= 5 ? "2-5" : count <= 20 ? "6-20" : "21+";
}
