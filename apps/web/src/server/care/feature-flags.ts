import "server-only";

export function isRealProviderUiEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.CARE_ENABLE_REAL_PROVIDER_UI === "true";
}

export function isInspectionIntelligenceEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.CARE_ENABLE_INSPECTION_INTELLIGENCE === "true";
}

export function isStaffingIntelligenceEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.CARE_ENABLE_REAL_PROVIDER_UI === "true" &&
    environment.CARE_ENABLE_STAFFING_INTELLIGENCE === "true"
  );
}

export function isOwnershipIntelligenceEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.CARE_ENABLE_REAL_PROVIDER_UI === "true" &&
    environment.CARE_ENABLE_OWNERSHIP_INTELLIGENCE === "true"
  );
}
export function isChainIntelligenceEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.CARE_ENABLE_REAL_PROVIDER_UI === "true" &&
    environment.CARE_ENABLE_CHAIN_INTELLIGENCE === "true"
  );
}
export function isTrustParticipationEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.CARE_ENABLE_REAL_PROVIDER_UI === "true" &&
    environment.CARE_ENABLE_TRUST_PARTICIPATION === "true"
  );
}

/** Field-level VERIFIED enrichment. On with real provider UI unless explicitly disabled. */
export function isVerifiedEnrichmentEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.CARE_ENABLE_REAL_PROVIDER_UI === "true" &&
    environment.CARE_ENABLE_VERIFIED_ENRICHMENT !== "false"
  );
}

/** Fail-closed national facility-history publication. Requires an explicit opt-in. */
export function isFacilityHistoryEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.CARE_ENABLE_REAL_PROVIDER_UI === "true" &&
    environment.CARE_ENABLE_FACILITY_HISTORY === "true"
  );
}

/** Fail-closed CA/NY/TX state enforcement/inspection history. Independent of license UI. */
export function isStateEnforcementIntelligenceEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.CARE_ENABLE_REAL_PROVIDER_UI === "true" &&
    environment.CARE_ENABLE_STATE_ENFORCEMENT_INTELLIGENCE === "true"
  );
}

/** Fail-closed ownership V2 summary/portfolio. Requires ownership intelligence. */
export function isOwnershipIntelligenceV2Enabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.CARE_ENABLE_REAL_PROVIDER_UI === "true" &&
    environment.CARE_ENABLE_OWNERSHIP_INTELLIGENCE === "true" &&
    environment.CARE_ENABLE_OWNERSHIP_INTELLIGENCE_V2 === "true"
  );
}

/** Fail-closed Care Needs Navigator. Independent of facility-evidence flags. */
export function isCareNeedsNavigatorEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.CARE_ENABLE_CARE_NEEDS_NAVIGATOR === "true";
}

/** Fail-closed Senior Care Cost Planner. Independent of facility-evidence flags. */
export function isSeniorCareCostPlannerEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.CARE_ENABLE_SENIOR_CARE_COST_PLANNER === "true";
}

/** Fail-closed Facility Tour & Interview Builder. Independent of other tools. */
export function isFacilityInterviewBuilderEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.CARE_ENABLE_FACILITY_INTERVIEW_BUILDER === "true";
}

/** Fail-closed Family Comparison Workspace. Independent of other tools. */
export function isFamilyComparisonWorkspaceEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.CARE_ENABLE_FAMILY_COMPARISON_WORKSPACE === "true";
}

/** Fail-closed assisted-living intelligence for CA/NY/TX regulator listings. */
export function isAssistedLivingIntelligenceEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.CARE_ENABLE_ASSISTED_LIVING_INTELLIGENCE === "true";
}

/** Nursing Home Profile Intelligence UI. On with real provider UI unless disabled. */
export function isNhProfileIntelEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.CARE_ENABLE_REAL_PROVIDER_UI === "true" &&
    environment.CARE_ENABLE_NH_PROFILE_INTEL !== "false"
  );
}

/** Home Health profile UI. Fail-closed until explicitly enabled. */
export function isHhProfileIntelEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.CARE_ENABLE_REAL_PROVIDER_UI === "true" &&
    environment.CARE_ENABLE_HH_PROFILE_INTEL === "true"
  );
}

/** Hospice profile UI. Fail-closed until explicitly enabled. */
export function isHospiceProfileIntelEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.CARE_ENABLE_REAL_PROVIDER_UI === "true" &&
    environment.CARE_ENABLE_HOSPICE_PROFILE_INTEL === "true"
  );
}

/** Controlled HH/Hospice search indexation. Independent of profile render flags. */
export function isAgencyProfileIndexEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.CARE_ENABLE_AGENCY_PROFILE_INDEX === "true";
}

/** Fail-closed CA/NY/TX state-license publication. Requires an explicit opt-in. */
export function isStateRegulatoryIntelligenceEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.CARE_ENABLE_REAL_PROVIDER_UI === "true" &&
    environment.CARE_ENABLE_STATE_REGULATORY_INTELLIGENCE === "true"
  );
}
