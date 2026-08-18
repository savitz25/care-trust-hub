export type EvidenceOrigin = "official" | "facility_reported" | "derived";

export interface SourceReference {
  sourceOrganization: string;
  datasetKey: string;
  releaseKey: string;
  sourceRecordLocator: string;
  retrievedAt: string;
  observedAt: string | null;
  transformationVersion: string;
  providerIdentifier?: string;
}

export interface EvidenceAssertion<T = unknown> {
  id: string;
  origin: EvidenceOrigin;
  value: T;
  source: SourceReference;
}

export function isAuthoritativeEvidence(assertion: EvidenceAssertion): boolean {
  return assertion.origin === "official";
}

export * from "./facilities";
export * from "./facility-intelligence";
export * from "./enrichment-publication";
export * from "./state-regulator";
export * from "./state-publication";
export * from "./facility-history";
export * from "./ownership-intelligence";
export * from "./care-needs-navigator";
