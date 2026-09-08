/** Portable Trust Hub Specialist Search V1 contract. Senior supplies domain facts. */
export const SPECIALIST_SEARCH_VERSION = "trusthub-specialist-search-v1" as const;

export type SearchCapabilityState =
  | "KNOWN"
  | "UNKNOWN"
  | "PARTIAL"
  | "NOT_ACQUIRED"
  | "REQUEST_ONLY"
  | "UNSUPPORTED";

export type SpecialistSearchIntent =
  | "IDENTITY"
  | "DISCOVERY"
  | "EVIDENCE"
  | "EXPLAIN"
  | "COUNT"
  | "COMPARE"
  | "UNKNOWN";

export type SpecialistSearchRequest = {
  version: typeof SPECIALIST_SEARCH_VERSION;
  rawQuery: string;
  intent: SpecialistSearchIntent;
  entityType: string | null;
  identifiers: Array<{ type: string; value: string }>;
  geography: { state: string | null; county: string | null; city: string | null };
  classifications: string[];
  statusFilters: string[];
  evidenceFilters: string[];
  advancedFilters: Record<string, string | boolean>;
  page: number;
  pageSize: number;
};

export type SpecialistSearchInterpretation = {
  normalizedIntent: SpecialistSearchIntent;
  parsedEntities: Array<{ type: string; value: string }>;
  parsedIdentifiers: Array<{ type: string; value: string }>;
  parsedGeography: { state: string | null; county: string | null; city: string | null };
  parsedClassifications: string[];
  parsedStatuses: string[];
  parsedEvidence: string[];
  unresolvedTerms: string[];
  supported: boolean;
  limitations: string[];
};

export type SpecialistSearchCapability = {
  key: string;
  label: string;
  supportState: SearchCapabilityState;
  coverage: string;
  sourceSystems: string[];
  limitations: string[];
};

export type SpecialistSearchResult = {
  entityId: string;
  displayName: string;
  canonicalHref: string;
  entityClass: string;
  identitySummary: string;
  credentialSummary: string;
  geographySummary: string;
  matchReasons: string[];
  evidenceAvailable: Array<{ family: string; state: SearchCapabilityState }>;
  evidenceSummary: string;
  sourceAsOf: string | null;
  trace: {
    sourceSystems: string[];
    interpretationRules: string[];
    limitations: string[];
  };
};

export const SPECIALIST_SEARCH_ANALYTICS_EVENTS = [
  "specialist_search_submit",
  "specialist_search_interpreted",
  "specialist_search_results",
  "specialist_search_zero_results",
  "specialist_search_refine",
  "specialist_search_trace_open",
  "specialist_search_profile_open",
] as const;
