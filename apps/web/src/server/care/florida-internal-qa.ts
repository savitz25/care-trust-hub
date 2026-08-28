import "server-only";
import qaCohort from "@/data/florida-profile-qa-cohort.json";
import { isFloridaProfileInternalQaEnabled } from "@/server/care/feature-flags";

export type FloridaQaProfile = (typeof qaCohort.profiles)[number];

export function floridaInternalQaAllowed(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return isFloridaProfileInternalQaEnabled(environment);
}

export function floridaQaCohort(): readonly FloridaQaProfile[] {
  return qaCohort.profiles;
}

export function findFloridaQaProfile(
  kind: string,
  fileNumber: string,
  slug: string,
): FloridaQaProfile | null {
  return (
    qaCohort.profiles.find(
      (p) =>
        p.profile_kind === kind &&
        p.ahca_file_number === fileNumber &&
        p.name_slug === slug,
    ) ?? null
  );
}

export const FLORIDA_PROFILE_KIND_LABEL: Record<string, string> = {
  "assisted-living": "Assisted living",
  "adult-family-care": "Adult family care home",
  "home-health": "Home health",
  hospice: "Hospice",
  "nursing-home": "Nursing home",
};
