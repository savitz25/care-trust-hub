import "server-only";
import {
  FLORIDA_PHASE1_PUBLIC_COUNTS,
  FLORIDA_PUBLICATION_CONTRACT,
  isFloridaPhase1PublicKind,
  publicFloridaContacts,
} from "@care/domain";
import { isPublicLaunchEnabled } from "@/config/deployment";
import manifest from "@/data/florida-provider-publication.json";
import { getCareDatabasePool } from "./db";
import { isFloridaAlfAfchPublicationEnabled, isFloridaProviderIndexEnabled } from "./feature-flags";

export type FloridaPublicationEntry = (typeof manifest.profiles)[number];

export type FloridaProfilePayload = {
  contract_version: string;
  identity: {
    external_key: string;
    provider_class: string;
    profile_kind: string;
    official_name: string;
    ahca_file_number: string;
    healthfinder_lid: string | null;
    locator_status: string;
    license_status_raw: string | null;
    license_status_normalized: string | null;
    cms_confirmed: boolean;
  };
  licensing: {
    license_effective_on: string | null;
    license_expires_on: string | null;
    licensed_capacity: number | null;
    capacity_is_occupancy: boolean;
  };
  credentials: Array<{
    credential_type: string;
    raw_label: string | null;
    credential_code: string | null;
    source_field: string;
  }>;
  contacts: Array<{
    contact_kind: string;
    value_text: string;
    title: string | null;
    source_field: string;
    display_tier: string;
  }>;
  geography: Array<{
    geography_kind: string;
    raw: string;
    canonical: string | null;
    mapping: string | null;
    source_field: string;
  }>;
  regulatory: {
    observation_count: number;
    has_connected_event: boolean;
    absence_language: string | null;
    counts: {
      inspection: number;
      deficiency: number;
      legal_action: number;
      fine: number;
      final_order: number;
      emergency_action: number;
    };
    earliest: string | null;
    latest: string | null;
    fine_usd: string;
    recent: Array<{
      event_family: string;
      event_type: string | null;
      event_date: string | null;
      case_number: string | null;
      is_final: boolean | null;
      source_locator: string | null;
    }>;
    recent_fines: Array<{
      event_date: string | null;
      case_number: string | null;
      amount: string | number | null;
      source_locator: string | null;
    }>;
    recent_final_orders: Array<{
      event_date: string | null;
      case_number: string | null;
      document_url: string | null;
    }>;
  };
  sources: {
    provider_source_as_of: string | null;
    provider_retrieved_at: string | null;
    adapter_version: string | null;
  };
  limitations: string[];
  publication: { state: string; indexable: boolean };
};

export type FloridaPublicProfileView = {
  path: string;
  payload: FloridaProfilePayload;
};

export const floridaPublicationManifest = manifest;

export function floridaPublicationEntries(): readonly FloridaPublicationEntry[] {
  return manifest.profiles;
}

export function findFloridaPublicationEntry(
  kind: string,
  fileNumber: string,
): FloridaPublicationEntry | null {
  return (
    manifest.profiles.find(
      (row) => row.profile_kind === kind && row.ahca_file_number === fileNumber,
    ) ?? null
  );
}

export function resolveFloridaPublicationRoute(input: {
  kind: string;
  fileNumber: string;
  slug: string;
  publicationEnabled: boolean;
}):
  | { status: "not_found" }
  | { status: "redirect"; path: string }
  | { status: "ok"; entry: FloridaPublicationEntry } {
  if (!input.publicationEnabled) return { status: "not_found" };
  if (!isFloridaPhase1PublicKind(input.kind)) return { status: "not_found" };
  const entry = findFloridaPublicationEntry(input.kind, input.fileNumber);
  if (!entry) return { status: "not_found" };
  if (entry.name_slug !== input.slug) return { status: "redirect", path: entry.future_path };
  return { status: "ok", entry };
}

export function isFloridaCohortIndexable(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return isPublicLaunchEnabled(environment) && isFloridaProviderIndexEnabled(environment);
}

export function getFloridaProviderSitemapPaths(): readonly string[] {
  if (!isFloridaCohortIndexable()) return [];
  return manifest.profiles.map((row) => row.future_path);
}

export function assertFloridaPublicationManifest(): void {
  if (manifest.contract_version !== FLORIDA_PUBLICATION_CONTRACT) {
    throw new Error("florida publication contract mismatch");
  }
  if (manifest.profiles.length !== 25) throw new Error("florida publication cohort must be 25");
  const kinds = manifest.profiles.reduce<Record<string, number>>((acc, row) => {
    acc[row.profile_kind] = (acc[row.profile_kind] ?? 0) + 1;
    return acc;
  }, {});
  if (kinds["assisted-living"] !== FLORIDA_PHASE1_PUBLIC_COUNTS["assisted-living"]) {
    throw new Error("ALF cohort mismatch");
  }
  if (kinds["adult-family-care"] !== FLORIDA_PHASE1_PUBLIC_COUNTS["adult-family-care"]) {
    throw new Error("AFCH cohort mismatch");
  }
}

export function toPublicFloridaPayload(payload: FloridaProfilePayload): FloridaProfilePayload {
  return {
    ...payload,
    contacts: publicFloridaContacts(payload.contacts).map((contact) => ({
      contact_kind: contact.contact_kind,
      value_text: contact.value_text,
      title: contact.title,
      source_field: contact.source_field,
      display_tier: "public_candidate",
    })),
    publication: { state: "phase1_manifest", indexable: false },
  };
}

export async function loadPublishedFloridaProfile(
  kind: string,
  fileNumber: string,
  slug: string,
): Promise<{ redirectTo: string } | FloridaPublicProfileView | null> {
  const resolved = resolveFloridaPublicationRoute({
    kind,
    fileNumber,
    slug,
    publicationEnabled: isFloridaAlfAfchPublicationEnabled(),
  });
  if (resolved.status === "not_found") return null;
  if (resolved.status === "redirect") return { redirectTo: resolved.path };
  const result = await getCareDatabasePool().query<{
    payload: FloridaProfilePayload;
    future_path: string;
  }>(
    `select payload, future_path
       from state_provider_profile
      where provider_id = $1::uuid
      limit 1`,
    [resolved.entry.provider_id],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.future_path !== resolved.entry.future_path) return null;
  return {
    path: resolved.entry.future_path,
    payload: toPublicFloridaPayload(row.payload),
  };
}
