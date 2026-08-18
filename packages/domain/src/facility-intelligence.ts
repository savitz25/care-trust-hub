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

export const FACILITY_IDENTITY_RESOLVER_V2 = "facility-identity-pilot-v2.2";

export type WebsiteClassification =
  | "FACILITY_OFFICIAL"
  | "OPERATOR_FACILITY_PAGE"
  | "HEALTH_SYSTEM_FACILITY_PAGE"
  | "CHAIN_SITE"
  | "CORPORATE_HOME"
  | "THIRD_PARTY_DIRECTORY"
  | "LEAD_GENERATION"
  | "SOCIAL_MEDIA"
  | "INSECURE_HTTP"
  | "UNKNOWN";

export interface IdentityResolutionContextV2 {
  competingPlausibleCandidates: number;
  campusAmbiguity: boolean;
  sharedPlaceScope: "facility_specific" | "campus_level" | "organization_level" | "ambiguous";
  careTypeConflict: boolean;
  rejectedCandidate: boolean;
  /** Applies only when the same candidate identity passed the separate V1 evidence audit. */
  priorIndependentAuditPass?: boolean;
}

export interface ClaimResolutionV2 {
  state: ResolutionState;
  confidence: number;
  reason: string;
}

export interface IdentityResolutionV2 extends ResolutionDecision {
  fieldClaims: {
    publicName: ClaimResolutionV2;
    address: ClaimResolutionV2;
    phone: ClaimResolutionV2;
    website: ClaimResolutionV2;
    businessStatus: ClaimResolutionV2;
  };
}

function claimFromFeature(
  feature: MatchFeature | undefined,
  matchConfidence: number,
): ClaimResolutionV2 {
  if (!feature || feature.outcome === "missing")
    return { state: "UNRESOLVED", confidence: 0, reason: feature?.reason ?? "No evidence" };
  if (feature.outcome === "conflict")
    return { state: "REVIEW_REQUIRED", confidence: 0, reason: feature.reason };
  return { state: "VERIFIED", confidence: matchConfidence, reason: feature.reason };
}

export function resolveIdentityCandidateV2(
  features: readonly MatchFeature[],
  context: IdentityResolutionContextV2,
): IdentityResolutionV2 {
  const byKey = new Map(features.map((feature) => [feature.key, feature]));
  const name = byKey.get("facility_name");
  const state = byKey.get("state");
  const street = byKey.get("street_number") ?? byKey.get("address");
  const coordinates = byKey.get("coordinates");
  const zip = byKey.get("zip");
  const phone = byKey.get("phone");
  const website = byKey.get("official_domain");
  const identityFeatures = features.filter(
    (feature) => !["phone", "official_domain"].includes(feature.key),
  );
  const considered = identityFeatures.filter((feature) => feature.outcome !== "missing");
  const positive = considered.filter((feature) => feature.outcome === "match");
  const conflicts = considered.filter((feature) => feature.outcome === "conflict");
  const totalWeight = considered.reduce((sum, feature) => sum + Math.abs(feature.weight), 0);
  const signedWeight = considered.reduce(
    (sum, feature) =>
      sum + (feature.outcome === "match" ? Math.abs(feature.weight) : -Math.abs(feature.weight)),
    0,
  );
  const confidence = totalWeight ? Math.max(0, Math.min(1, signedWeight / totalWeight)) : 0;
  const strongLocation = street?.outcome === "match" || coordinates?.outcome === "match";
  const hardGate =
    context.rejectedCandidate ||
    context.careTypeConflict ||
    (context.campusAmbiguity && !context.priorIndependentAuditPass) ||
    context.competingPlausibleCandidates > 1 ||
    context.sharedPlaceScope !== "facility_specific" ||
    state?.outcome !== "match";
  const strongIdentity =
    name?.outcome === "match" && strongLocation && (zip?.outcome ?? "match") !== "conflict";
  let identityState: ResolutionState;
  if (context.rejectedCandidate) identityState = "REJECTED";
  else if (hardGate) identityState = "REVIEW_REQUIRED";
  else if (strongIdentity && confidence >= 0.9) identityState = "VERIFIED";
  else if (strongIdentity && confidence >= 0.72) identityState = "PROBABLE";
  else if (!considered.length) identityState = "UNRESOLVED";
  else identityState = "REVIEW_REQUIRED";

  return {
    state: identityState,
    confidence: Number(confidence.toFixed(6)),
    thresholdVersion: FACILITY_IDENTITY_RESOLVER_V2,
    matchingFeatures: [...features],
    conflicts,
    reason: `entity identity evaluated independently from phone/website; strongIdentity=${strongIdentity}; hardGate=${hardGate}; priorAudit=${Boolean(context.priorIndependentAuditPass)}`,
    fieldClaims: {
      publicName: claimFromFeature(name, 0.99),
      address:
        street?.outcome === "match" &&
        (state?.outcome === "match" || coordinates?.outcome === "match")
          ? { state: "VERIFIED", confidence: 0.99, reason: "Street/location evidence agrees" }
          : claimFromFeature(street, 0.95),
      phone: claimFromFeature(phone, 0.99),
      website: claimFromFeature(website, 0.98),
      businessStatus: {
        state: "UNRESOLVED",
        confidence: 0,
        reason: "Commercial business status is resolved separately from regulatory status",
      },
    },
  };
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
