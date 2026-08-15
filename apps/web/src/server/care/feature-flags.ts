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
