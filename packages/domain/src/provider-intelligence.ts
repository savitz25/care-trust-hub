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
  observation_count?: number;
  observed_from?: string | null;
  observed_through?: string | null;
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

export type AgencyMeasureAvailability =
  | "REPORTED"
  | "SUPPRESSED"
  | "NOT_AVAILABLE"
  | "INSUFFICIENT_DATA"
  | "NOT_APPLICABLE";

export interface AgencyQualityMeasure {
  family: "hh_quality" | "hh_hhcahps" | "hospice_quality" | "hospice_cahps";
  measure_code: string;
  official_name: string;
  reporting_period: string | null;
  score: number | null;
  score_text: string | null;
  star_rating: number | null;
  availability: AgencyMeasureAvailability;
  footnote: string | null;
  statistic_type?: string | null;
  unit?: string | null;
  denominator?: string | null;
  suppression_state?: string | null;
}

export interface AgencyQualityFamily {
  family: AgencyQualityMeasure["family"];
  observation_count: number;
  by_availability: Record<string, number>;
  measures: AgencyQualityMeasure[];
}

export interface AgencyServiceOffering {
  code: string;
  official_field: string;
  offered: boolean | null;
}

interface AgencyIntelBase {
  contract_version: string;
  canonical_id: string;
  profile_intelligence_status: "READY" | "PARTIAL" | "EVIDENCE_ONLY" | "BLOCKED";
  directory: {
    official_status: string | null;
    projection: DirectoryProjection;
  };
  common: NursingHomeProviderIntelligence["common"];
  ownership_summary: NursingHomeProviderIntelligence["ownership_summary"];
  chow: {
    ownership_change_history_available: boolean;
    reason: "NOT_YET_LINKED" | "NO_PUBLIC_CMS_CHOW_SOURCE" | null;
    confirmed_event_count: number | null;
    events: ProviderIntelChowEvent[] | null;
    zero_does_not_mean_no_change_occurred: true;
    file_dated?: string | null;
  };
  geography: {
    coverage: {
      zip_observation_count: number;
      is_verified_county_service_area: false;
      is_verified_service_area: false;
    };
    county_service_area: "UNSUPPORTED";
  };
  evidence_as_of_by_family: NursingHomeProviderIntelligence["evidence_as_of_by_family"];
  availability: Record<string, Availability | string>;
  limitations: string[];
  person_publication_policy: string;
  organization_public_route: false;
  fingerprint: string;
  profile_generated_at?: string;
}

export interface CmsQualityOfPatientCareStar {
  value: number | null;
  footnote: string | null;
  label: "CMS Quality of Patient Care star";
  not_trust_hub_rating: true;
  availability: string;
}

export interface HomeHealthProviderIntelligence extends AgencyIntelBase {
  provider_type: "home_health";
  identifier_type: "HOME_HEALTH_CCN";
  home_health: {
    cms_quality_of_patient_care_star: CmsQualityOfPatientCareStar;
    ownership_type: string | null;
    has_core_evidence: boolean;
  } | null;
  quality_summary: {
    cms_quality_of_patient_care_star: CmsQualityOfPatientCareStar | null;
    families: AgencyQualityFamily[];
    synthetic_trust_hub_rating: false;
  };
  services: AgencyServiceOffering[];
}

export interface HospiceProviderIntelligence extends AgencyIntelBase {
  provider_type: "hospice";
  identifier_type: "HOSPICE_CCN";
  hospice: {
    ownership_type: string | null;
    office_county_name: string | null;
    office_county_is_not_service_area: true;
    has_core_evidence: boolean;
  } | null;
  quality_summary: {
    families: AgencyQualityFamily[];
    synthetic_trust_hub_rating: false;
  };
}

export function isHomeHealthIntelV1(value: unknown): value is HomeHealthProviderIntelligence {
  if (!value || typeof value !== "object") return false;
  const obj = value as HomeHealthProviderIntelligence;
  return (
    obj.contract_version === PROVIDER_INTEL_VERSION &&
    obj.provider_type === "home_health" &&
    obj.identifier_type === "HOME_HEALTH_CCN"
  );
}

export function isHospiceIntelV1(value: unknown): value is HospiceProviderIntelligence {
  if (!value || typeof value !== "object") return false;
  const obj = value as HospiceProviderIntelligence;
  return (
    obj.contract_version === PROVIDER_INTEL_VERSION &&
    obj.provider_type === "hospice" &&
    obj.identifier_type === "HOSPICE_CCN"
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

export function chowNotYetIntegratedCopy(providerType: "home_health" | "hospice"): string {
  const program = providerType === "home_health" ? "Home Health" : "Hospice";
  return `CMS publishes ${program} change-of-ownership (CHOW) files with its enrollment data. They are not yet linked to profiles on SeniorTrustHub. If no CHOW record is shown here, that does not prove ownership never changed.`;
}

export function chowLoadedCopy(fileDate: string, count: number): string {
  const noun = count === 1 ? "event" : "events";
  return `CMS CHOW records (enrollment data, file dated ${fileDate}) list ${count} ownership-change ${noun} for this enrollment. They only cover currently approved enrollments, so this is not a full ownership history.`;
}

/** @deprecated Use chowNotYetIntegratedCopy. Kept so existing imports stay valid. */
export function chowUnsupportedCopy(providerType: "home_health" | "hospice"): string {
  return chowNotYetIntegratedCopy(providerType);
}

export const SNF_CHOW_UPSTREAM_CATALOG_DATE = "2026-10-19";

const SNF_CHOW_FRESHNESS_KEYS = new Set([
  "skilled-nursing-facility-change-of-ownership",
  "skilled-nursing-facility-change-of-ownership-owner-information",
]);

export function observedUpstreamCatalogDate(datasetKey: string): string | null {
  return SNF_CHOW_FRESHNESS_KEYS.has(datasetKey) ? SNF_CHOW_UPSTREAM_CATALOG_DATE : null;
}

export function presentFreshnessBand(
  datasetKey: string,
  band: string | null,
  sourceModifiedAt: string | null,
  upstreamModifiedAt?: string | null,
): string | null {
  const upstream = upstreamModifiedAt ?? observedUpstreamCatalogDate(datasetKey);
  if (
    band === "CURRENT" &&
    upstream &&
    sourceModifiedAt &&
    upstream.slice(0, 10) > sourceModifiedAt.slice(0, 10)
  ) {
    return "AGING";
  }
  return band;
}

export function agencyDirectoryBanner(
  providerType: "home_health" | "hospice",
  projection: DirectoryProjection,
): string | null {
  if (projection === "KNOWN_NOT_CURRENT") {
    const directory =
      providerType === "home_health"
        ? "current CMS Home Health agency directory"
        : "current CMS Hospice General Information directory";
    return `This provider is known from CMS records but is not listed in the ${directory}. Absence from the current directory is not proof the provider stopped operating.`;
  }
  if (projection === "EVIDENCE_ONLY") {
    return "This CMS certification number has quality or other evidence on file but is not in the current Hospice General Information directory. That is not proof the provider stopped operating.";
  }
  return null;
}

export function cmsMeasureAvailabilityCopy(
  availability: AgencyQualityMeasure["availability"],
  score: number | null,
  scoreText: string | null,
  options?: { unit?: string | null; statisticType?: string | null },
): string {
  if (availability === "NOT_APPLICABLE") return "Not applicable";
  if (availability === "SUPPRESSED") return "Suppressed";
  if (availability === "INSUFFICIENT_DATA") return "Insufficient data";
  if (availability === "NOT_AVAILABLE") return "Not reported";
  if (options?.statisticType === "STAR_RATING" && score != null) return `${score} of 5 stars`;
  if (options?.unit === "percent" && score != null) return `${score}%`;
  if (scoreText?.trim()) return scoreText.trim();
  if (score == null) return "Not reported";
  return String(score);
}

export function statisticTypeLabel(statisticType: string | null | undefined): string | null {
  if (!statisticType) return null;
  const labels: Record<string, string> = {
    DENOMINATOR: "denominator",
    STAR_RATING: "star rating",
    TOP_BOX: "top box",
    MIDDLE_BOX: "middle box",
    BOTTOM_BOX: "bottom box",
    OBSERVED: "observed",
    LINEAR: "linear score",
    NATIONAL: "national",
    OTHER: "other",
  };
  return labels[statisticType] ?? statisticType.toLowerCase().replaceAll("_", " ");
}

export function partyCapCopy(shown: number, total: number): string | null {
  if (total <= shown) return null;
  return `Showing ${shown} of ${total} relationships from CMS/PECOS evidence.`;
}

export function currentOwnedByStatement(party: ProviderIntelParty): string | null {
  if (party.relationship_type !== "OWNED_BY" || party.temporal_status !== "CURRENT") return null;
  return `CMS/PECOS current ownership evidence lists ${party.display_name}.`;
}
