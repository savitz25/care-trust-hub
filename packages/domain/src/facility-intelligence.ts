export const RESOLUTION_STATES = [
  "VERIFIED",
  "PROBABLE",
  "REVIEW_REQUIRED",
  "REJECTED",
  "UNRESOLVED",
] as const;

export type ResolutionState = (typeof RESOLUTION_STATES)[number];
export type SourceAuthority =
  | "federal_healthcare"
  | "state_healthcare_regulator"
  | "government_legal"
  | "official_organization"
  | "commercial_corroboration"
  | "consumer_reputation";

export type MatchFeatureKey =
  | "cms_ccn"
  | "state_license"
  | "address"
  | "street_number"
  | "street_name"
  | "city"
  | "state"
  | "zip"
  | "phone"
  | "facility_name"
  | "legal_name"
  | "coordinates"
  | "operator"
  | "official_domain";

export interface MatchFeature {
  key: MatchFeatureKey;
  outcome: "match" | "conflict" | "missing";
  weight: number;
  reason: string;
}

export interface ResolutionThresholds {
  version: string;
  verified: number;
  probable: number;
  rejected: number;
  minimumVerifiedMatches: number;
}

export const DEFAULT_RESOLUTION_THRESHOLDS: ResolutionThresholds = {
  version: "facility-identity-v1",
  verified: 0.92,
  probable: 0.72,
  rejected: 0.25,
  minimumVerifiedMatches: 3,
};

export interface ResolutionDecision {
  state: ResolutionState;
  confidence: number;
  thresholdVersion: string;
  matchingFeatures: MatchFeature[];
  conflicts: MatchFeature[];
  reason: string;
}

export function resolveIdentityCandidate(
  features: readonly MatchFeature[],
  thresholds: ResolutionThresholds = DEFAULT_RESOLUTION_THRESHOLDS,
): ResolutionDecision {
  const considered = features.filter((feature) => feature.outcome !== "missing");
  const positive = considered.filter((feature) => feature.outcome === "match");
  const conflicts = considered.filter((feature) => feature.outcome === "conflict");
  const availableWeight = considered.reduce((sum, feature) => sum + Math.abs(feature.weight), 0);
  const matchedWeight = positive.reduce((sum, feature) => sum + Math.abs(feature.weight), 0);
  const conflictWeight = conflicts.reduce((sum, feature) => sum + Math.abs(feature.weight), 0);
  const confidence =
    availableWeight === 0
      ? 0
      : Math.max(0, Math.min(1, (matchedWeight - conflictWeight) / availableWeight));

  const authoritativeConflict = conflicts.some((feature) =>
    ["cms_ccn", "state_license", "state"].includes(feature.key),
  );
  let state: ResolutionState;
  if (!considered.length) state = "UNRESOLVED";
  else if (authoritativeConflict) state = "REVIEW_REQUIRED";
  else if (confidence <= thresholds.rejected && conflicts.length > positive.length)
    state = "REJECTED";
  else if (
    confidence >= thresholds.verified &&
    positive.length >= thresholds.minimumVerifiedMatches &&
    conflicts.length === 0
  )
    state = "VERIFIED";
  else if (confidence >= thresholds.probable && conflicts.length === 0) state = "PROBABLE";
  else state = "REVIEW_REQUIRED";

  return {
    state,
    confidence: Number(confidence.toFixed(6)),
    thresholdVersion: thresholds.version,
    matchingFeatures: [...features],
    conflicts,
    reason: `${positive.length} matching, ${conflicts.length} conflicting, ${features.length - considered.length} missing features`,
  };
}

export const SOURCE_AUTHORITY_ORDER: Readonly<Record<SourceAuthority, number>> = {
  federal_healthcare: 1,
  state_healthcare_regulator: 2,
  government_legal: 3,
  official_organization: 4,
  commercial_corroboration: 5,
  consumer_reputation: 6,
};

export const CLAIM_AUTHORITY_POLICY = {
  regulatory_status: ["federal_healthcare", "state_healthcare_regulator"],
  state_license_status: ["state_healthcare_regulator"],
  closure_status: ["federal_healthcare", "state_healthcare_regulator"],
  ownership: ["federal_healthcare", "state_healthcare_regulator", "government_legal"],
  official_website: [
    "state_healthcare_regulator",
    "official_organization",
    "commercial_corroboration",
  ],
  public_phone: [
    "federal_healthcare",
    "state_healthcare_regulator",
    "official_organization",
    "commercial_corroboration",
  ],
} as const satisfies Readonly<Record<string, readonly SourceAuthority[]>>;

export type FreshnessClass = "nearly_static" | "moderate" | "release_driven";
export const FACILITY_INTELLIGENCE_FRESHNESS = {
  cms_ccn: { class: "nearly_static", maxAgeDays: null },
  google_place_id: { class: "nearly_static", maxAgeDays: 365 },
  state_license_id: { class: "nearly_static", maxAgeDays: 365 },
  website: { class: "moderate", maxAgeDays: 180 },
  phone: { class: "moderate", maxAgeDays: 90 },
  business_status: { class: "moderate", maxAgeDays: 90 },
  operator: { class: "moderate", maxAgeDays: 180 },
  ownership: { class: "release_driven", maxAgeDays: null },
  staffing: { class: "release_driven", maxAgeDays: null },
  inspections: { class: "release_driven", maxAgeDays: null },
} as const satisfies Readonly<Record<string, { class: FreshnessClass; maxAgeDays: number | null }>>;
