import "server-only";

export type EnvironmentVariableScope = "public" | "server-only";
export type EnvironmentVariableStatus = "present" | "missing";

export type EnvironmentAuditEntry = {
  name: string;
  scope: EnvironmentVariableScope;
  status: EnvironmentVariableStatus;
  usage: "required" | "optional" | "legacy-valid";
};

const VARIABLES = [
  ["CARE_DATABASE_URL", "server-only", "required"],
  ["CARE_DATABASE_SSL", "server-only", "required"],
  ["CARE_DATABASE_SSL_CA", "server-only", "optional"],
  ["GOOGLE_PLACES_API_KEY", "server-only", "required"],
  ["SUPABASE_SERVICE_ROLE_KEY", "server-only", "legacy-valid"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "public", "legacy-valid"],
  ["NEXT_PUBLIC_SITE_URL", "public", "required"],
  ["CARE_ENABLE_PUBLIC_LAUNCH", "server-only", "required"],
  ["CARE_ENABLE_REAL_PROVIDER_UI", "server-only", "required"],
  ["CARE_ENABLE_INSPECTION_INTELLIGENCE", "server-only", "required"],
  ["CARE_ENABLE_STAFFING_INTELLIGENCE", "server-only", "required"],
  ["CARE_ENABLE_OWNERSHIP_INTELLIGENCE", "server-only", "required"],
  ["CARE_ENABLE_CHAIN_INTELLIGENCE", "server-only", "required"],
  ["CARE_ENABLE_TRUST_PARTICIPATION", "server-only", "required"],
] as const satisfies ReadonlyArray<
  readonly [string, EnvironmentVariableScope, EnvironmentAuditEntry["usage"]]
>;

export function auditEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): EnvironmentAuditEntry[] {
  return VARIABLES.map(([name, scope, usage]) => ({
    name,
    scope,
    usage,
    status: environment[name]?.trim() ? "present" : "missing",
  }));
}
