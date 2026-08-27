export const PROVIDER_INTEL_VERSION = "provider-intel-v1";

export type ProviderIntelType = "nursing_home" | "home_health" | "hospice";
export type DirectoryProjection = "CURRENT_DIRECTORY" | "KNOWN_NOT_CURRENT" | "EVIDENCE_ONLY";
export type Availability = "AVAILABLE" | "NOT_REPORTED" | "NOT_APPLICABLE" | "UNSUPPORTED";

export interface ProviderIntelParty {
  display_name: string;
  party_kind: "organization" | "individual";
  party_id: string;
  organization_id: string | null;
  relationship_type: string;
  raw_cms_role: string;
  ownership_percentage: number | null;
  temporal_status: "CURRENT" | "HISTORICAL" | "UNKNOWN";
  effective_from: string | null;
  confidence: string;
  person_publication_policy: string | null;
  public_profile: boolean;
}

export interface ProviderIntelChowEvent {
  event_id: string;
  effective_date: string | null;
  cms_raw_type_code: string | null;
  cms_raw_type_text: string | null;
  normalized_type: string | null;
  buyer_legal_entity: string | null;
  seller_legal_entity: string | null;
  source_dataset_key: string | null;
  source_dataset_id: string | null;
  confidence: string | null;
  safe_language: string | null;
  not_labeled_sale: boolean;
}

export interface ProviderIntelCmsStars {
  overall: number | null;
  health_inspection: number | null;
  staffing: number | null;
  quality_measure: number | null;
  label: string;
  not_trust_hub_rating: true;
  availability: string;
}

export interface NursingHomeProviderIntelligence {
  contract_version: string;
  canonical_id: string;
  provider_type: "nursing_home";
  identifier_type: "CCN";
  profile_intelligence_status: "READY" | "PARTIAL" | "EVIDENCE_ONLY" | "BLOCKED";
  directory: {
    official_status: string | null;
    projection: DirectoryProjection;
  };
  common: {
    display_name: string | null;
    legal_name: string | null;
    office: {
      address: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
      phone: string | null;
    };
  };
  nursing_home: {
    cms_stars?: ProviderIntelCmsStars;
    has_core_evidence?: boolean;
  } | null;
  quality_summary: {
    cms_stars: ProviderIntelCmsStars | null;
    nh_evidence_flags: {
      mds: boolean;
      pbj: boolean;
      fire: boolean;
      inspection: boolean;
      sff: boolean;
    } | null;
    synthetic_trust_hub_rating: false;
  };
  ownership_summary: {
    current_owners: ProviderIntelParty[];
    operators: ProviderIntelParty[];
    managers: ProviderIntelParty[];
    enrollment_organizations: ProviderIntelParty[];
    historical_ownership_observations: ProviderIntelParty[];
    unknown_ownership_observations: ProviderIntelParty[];
    counts: Record<string, number>;
    unresolved_edges_included: false;
  };
  chow: {
    ownership_change_history_available: boolean;
    confirmed_event_count?: number | null;
    events?: ProviderIntelChowEvent[] | null;
    reason?: string | null;
    zero_does_not_mean_no_change_occurred?: boolean;
  };
  evidence_as_of_by_family: Record<
    string,
    { band: string | null; source_modified_at: string | null; age_days: number | null }
  >;
  availability: Record<string, Availability | string>;
  limitations: string[];
  person_publication_policy: string;
  organization_public_route: false;
  fingerprint: string;
  profile_generated_at?: string;
}

export function isProviderIntelV1(value: unknown): value is NursingHomeProviderIntelligence {
  if (!value || typeof value !== "object") return false;
  const obj = value as NursingHomeProviderIntelligence;
  return (
    obj.contract_version === PROVIDER_INTEL_VERSION &&
    obj.provider_type === "nursing_home" &&
    obj.identifier_type === "CCN"
  );
}

export function cmsStarConsumerLabel(): string {
  return "CMS star rating";
}

export function directoryBanner(projection: DirectoryProjection): string | null {
  if (projection === "KNOWN_NOT_CURRENT") {
    return "This provider is known from CMS records but is not listed in the current CMS nursing-home directory. Absence from the current directory is not proof the facility stopped operating.";
  }
  return null;
}

export function chowAbsenceCopy(): string {
  return "No CMS ownership-change event is currently attached to this profile in the Trust Hub research graph. That is not proof that ownership never changed.";
}

export function partyCapCopy(shown: number, total: number): string | null {
  if (total <= shown) return null;
  return `Showing ${shown} of ${total} relationships from CMS/PECOS evidence.`;
}

export function currentOwnedByStatement(party: ProviderIntelParty): string | null {
  if (party.relationship_type !== "OWNED_BY" || party.temporal_status !== "CURRENT") return null;
  return `CMS/PECOS current ownership evidence lists ${party.display_name}.`;
}
