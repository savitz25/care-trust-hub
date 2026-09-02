import type { SeniorProviderClass } from "@/server/care/senior-ask-contract";
import { getSeniorClaimProfile } from "@/server/care/senior-customer-profile-validation";
export function claimCtaEnabledFor(
  id: string,
  env: Record<string, string | undefined> = process.env,
) {
  if ((env.ATH_HANDOFF_SECRET || "").length < 32) return false;
  const mode = (env.ATH_CLAIM_CTA_MODE || "off").toLowerCase();
  if (mode === "all") return true;
  if (mode !== "canary") return false;
  return new Set(
    (env.ATH_CLAIM_CANARY_PROFILE_IDS || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  ).has(id.toLowerCase());
}
export async function seniorClaimProfile(providerClass: SeniorProviderClass, ccn: string) {
  return getSeniorClaimProfile(providerClass, ccn);
}
