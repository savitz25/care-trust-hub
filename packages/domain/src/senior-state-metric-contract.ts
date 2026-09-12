import type { SeniorHomeIntel } from "./senior-home-intel";
import type {
  SeniorHomepageEvidenceMeasure,
  SeniorHomepageStateCard,
} from "./senior-home-evidence-inventory";

export type SeniorCapabilityStatus =
  | "STATE_SOURCE_LIVE"
  | "STATE_SOURCE_ACQUIRED"
  | "SEARCH_ONLY"
  | "REQUEST_ONLY"
  | "FEDERAL_BASELINE"
  | "NOT_ACQUIRED"
  | "UNKNOWN"
  | "SPECIALIST_COMPLETE";
export interface SeniorStateMetric {
  key: string;
  state: string;
  value: number | null;
  grain: string;
  providerClass: string;
  sourceArtifact: string;
  sourceField: string;
  sourceAsOf: string | null;
  snapshotAsOf: string | null;
  retrievedAt: string | null;
  generatedAt: string | null;
  capabilityStatus: SeniorCapabilityStatus;
  aggregation: "SEPARATE_CLASS_OR_EVIDENCE_POPULATION_DO_NOT_ADD_TO_NATIONAL";
}
export interface SeniorReconciliation {
  acceptedSources: Array<{ path: string; sha256: string }>;
  stateMetrics: SeniorStateMetric[];
  stateCapabilities: Array<{
    state: string;
    route: string | null;
    routeExists: boolean;
    stateSourceAcquired: boolean;
    specialistComplete: null;
    metricKeys: string[];
  }>;
  census: { path: string; retrievedAt: string; sourceAsOf: null };
  noCombinedProviderDenominator: true;
}
export interface SeniorGeneratedHomepage {
  intel: SeniorHomeIntel;
  evidenceInventory: SeniorHomepageEvidenceMeasure[];
  stateCards: SeniorHomepageStateCard[];
}
