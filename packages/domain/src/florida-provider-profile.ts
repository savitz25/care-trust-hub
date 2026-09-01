import { normalizeFloridaCounty } from "./florida-county";

export const FLORIDA_PROVIDER_CONTRACT = "fl-sen-provider-v1";
export const NO_EVENT_LANGUAGE =
  "No connected Florida regulatory event was observed in the acquired AHCA sources.";

export const FLORIDA_HHA_CMS_LIMITATION =
  "Florida AHCA tracks 2,971 CURRENT Home Health license identities; the separate CMS Florida Home Health universe contains 1,146 providers. No row-level AHCA↔CMS identity is inferred here.";

export const FLORIDA_HOSPICE_CMS_LIMITATION =
  "Florida AHCA tracks 74 CURRENT Hospice license identities; the separate CMS Florida Hospice GI universe contains 61 providers. No row-level AHCA↔CMS identity is inferred here. No Hospice star is assigned here.";

export const PROFILE_KIND_BY_CLASS = {
  FL_ALF: "assisted-living",
  FL_AFCH: "adult-family-care",
  FL_HOME_HEALTH_LICENSE: "home-health",
  FL_HOSPICE_LICENSE: "hospice",
  FL_NH_LICENSE: "nursing-home",
} as const;

export type FloridaProfileKind = (typeof PROFILE_KIND_BY_CLASS)[keyof typeof PROFILE_KIND_BY_CLASS];

export const PUBLIC_CANDIDATE_CONTACTS = [
  "street_address",
  "mailing_address",
  "phone",
  "website",
  "administrator",
  "owner_licensee",
  "management_company",
] as const;

export const REVIEW_BEFORE_PUBLIC_CONTACTS = [
  "financial_officer",
  "controlling_interest",
  "other_named_party",
] as const;

export function floridaNameSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/g, "");
  return slug || "provider";
}

export function floridaProfilePath(
  kind: FloridaProfileKind,
  ahcaFileNumber: string,
  officialName: string,
): string {
  return `/florida/${kind}/${encodeURIComponent(ahcaFileNumber)}/${floridaNameSlug(officialName)}`;
}

export const FLORIDA_PUBLICATION_CONTRACT = "fl-sen-pub-v1";
export const FLORIDA_PUBLICATION_SEED = "fl-sen-pub-v1";
export const FLORIDA_PHASE1_PUBLIC_KINDS = ["assisted-living", "adult-family-care"] as const;
export const FLORIDA_PHASE1_PUBLIC_COUNTS = {
  "assisted-living": 20,
  "adult-family-care": 5,
} as const;

export function contactDisplayTier(kind: string): "public_candidate" | "review_before_public" {
  if ((PUBLIC_CANDIDATE_CONTACTS as readonly string[]).includes(kind)) return "public_candidate";
  return "review_before_public";
}

export function isFloridaPhase1PublicKind(kind: string): boolean {
  return (FLORIDA_PHASE1_PUBLIC_KINDS as readonly string[]).includes(kind);
}

export function isPublicCandidateContactKind(kind: string): boolean {
  return (PUBLIC_CANDIDATE_CONTACTS as readonly string[]).includes(kind);
}

export function publicFloridaContacts<T extends { contact_kind: string }>(
  contacts: readonly T[],
): T[] {
  return contacts.filter((contact) => isPublicCandidateContactKind(contact.contact_kind));
}

export function inspectionDisplayLabel(family: string, type: string | null | undefined): string {
  if (family === "inspection" && (type || "").toLowerCase() === "complaint") {
    return "Complaint-triggered inspection";
  }
  if (family === "inspection") return "Inspection observation";
  if (family === "deficiency") return "Deficiency observation";
  if (family === "legal_action") return "Legal action";
  if (family === "fine") return "Florida AHCA fine";
  if (family === "final_order") return "Final order";
  if (family === "emergency_action") return "Emergency action";
  return family;
}

export function geographyWithExactMap(kind: string, raw: string) {
  const mapped = normalizeFloridaCounty(raw);
  return {
    geography_kind: kind,
    raw,
    canonical: mapped.canonical,
    mapping: mapped.mapping,
  };
}
