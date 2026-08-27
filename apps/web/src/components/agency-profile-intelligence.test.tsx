import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HomeHealthProviderIntelligence, HospiceProviderIntelligence } from "@care/domain";
import {
  HomeHealthProfileIntelligence,
  HospiceProfileIntelligence,
} from "./agency-profile-intelligence";

const ownership = {
  current_owners: [
    {
      display_name: "LONG EXAMPLE HOME HEALTH HOLDINGS LLC",
      party_kind: "organization" as const,
      party_id: "p1",
      organization_id: "o1",
      relationship_type: "OWNED_BY",
      raw_cms_role: "5% OR GREATER DIRECT OWNERSHIP INTEREST",
      ownership_percentage: 100,
      temporal_status: "CURRENT" as const,
      effective_from: null,
      confidence: "CONFIRMED",
      person_publication_policy: null,
      public_profile: false,
    },
  ],
  operators: [],
  managers: [],
  enrollment_organizations: [],
  historical_ownership_observations: [],
  unknown_ownership_observations: [
    {
      display_name: "Unknown Party",
      party_kind: "organization" as const,
      party_id: "p2",
      organization_id: "o2",
      relationship_type: "OWNED_BY",
      raw_cms_role: "OWNER",
      ownership_percentage: null,
      temporal_status: "UNKNOWN" as const,
      effective_from: null,
      confidence: "CONFIRMED",
      person_publication_policy: null,
      public_profile: false,
    },
  ],
  counts: {
    current_owners: 1,
    operators: 0,
    managers: 0,
    enrollment_organizations: 0,
    historical_ownership_observations: 0,
    unknown_ownership_observations: 1,
  },
  unresolved_edges_included: false as const,
};

const chow = {
  ownership_change_history_available: false as const,
  reason: "NO_PUBLIC_CMS_CHOW_SOURCE" as const,
  confirmed_event_count: null,
  events: null,
  zero_does_not_mean_no_change_occurred: true as const,
};

const hh = {
  contract_version: "provider-intel-v1",
  canonical_id: "017000",
  provider_type: "home_health" as const,
  identifier_type: "HOME_HEALTH_CCN" as const,
  profile_intelligence_status: "READY" as const,
  directory: { official_status: "CURRENT_ACTIVE", projection: "CURRENT_DIRECTORY" as const },
  common: {
    display_name: "Example Home Health",
    legal_name: null,
    office: { address: "1 Main", city: "Town", state: "AL", zip: "35004", phone: "555-0100" },
  },
  home_health: {
    cms_quality_of_patient_care_star: {
      value: 4,
      footnote: null,
      label: "CMS Quality of Patient Care star" as const,
      not_trust_hub_rating: true as const,
      availability: "AVAILABLE",
    },
    ownership_type: "Proprietary",
    has_core_evidence: true,
  },
  quality_summary: {
    cms_quality_of_patient_care_star: {
      value: null,
      footnote: null,
      label: "CMS Quality of Patient Care star" as const,
      not_trust_hub_rating: true as const,
      availability: "NOT_REPORTED",
    },
    families: [
      {
        family: "hh_quality" as const,
        observation_count: 1,
        by_availability: { NOT_AVAILABLE: 1 },
        measures: [
          {
            family: "hh_quality" as const,
            measure_code: "M1",
            official_name: "Example quality measure",
            reporting_period: "2024",
            score: null,
            score_text: null,
            star_rating: null,
            availability: "NOT_AVAILABLE" as const,
            footnote: null,
          },
        ],
      },
    ],
    synthetic_trust_hub_rating: false as const,
  },
  services: [],
  ownership_summary: ownership,
  chow,
  geography: {
    coverage: {
      zip_observation_count: 12,
      is_verified_county_service_area: false as const,
      is_verified_service_area: false as const,
    },
    county_service_area: "UNSUPPORTED" as const,
  },
  evidence_as_of_by_family: {},
  availability: { CHOW: "UNSUPPORTED" },
  limitations: ["CMS does not publish a Home Health ownership-change event file."],
  person_publication_policy: "SOURCE_EVIDENCE_ONLY_NO_PUBLIC_PROFILE",
  organization_public_route: false as const,
  fingerprint: "x",
} satisfies HomeHealthProviderIntelligence;

const hospice = {
  ...hh,
  provider_type: "hospice" as const,
  identifier_type: "HOSPICE_CCN" as const,
  home_health: undefined,
  hospice: {
    ownership_type: "Non-profit",
    office_county_name: "Example",
    office_county_is_not_service_area: true as const,
    has_core_evidence: true,
  },
  quality_summary: {
    families: [
      {
        family: "hospice_cahps" as const,
        observation_count: 1,
        by_availability: { SUPPRESSED: 1 },
        measures: [
          {
            family: "hospice_cahps" as const,
            measure_code: "C1",
            official_name: "Example CAHPS measure",
            reporting_period: "2024",
            score: 0,
            score_text: null,
            star_rating: null,
            availability: "SUPPRESSED" as const,
            footnote: null,
          },
        ],
      },
    ],
    synthetic_trust_hub_rating: false as const,
  },
  limitations: ["CMS does not publish a Hospice ownership-change event file."],
} as HospiceProviderIntelligence;

describe("agency profile intelligence", () => {
  it("labels Home Health CMS stars and does not invent a Trust Hub score or zero", () => {
    render(<HomeHealthProfileIntelligence intel={hh} />);
    expect(screen.getByText(/CMS Quality of Patient Care star/i)).toBeTruthy();
    expect(screen.getByText(/CMS Home Health CCN/)).toBeTruthy();
    expect(screen.getAllByText("Not reported").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Trust Score/i)).toBeNull();
    expect(screen.queryByText(/was sold/i)).toBeNull();
    expect(screen.getAllByText(/not proof that ownership never changed/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/LONG EXAMPLE HOME HEALTH HOLDINGS LLC/)).toBeTruthy();
  });

  it("keeps Hospice CAHPS separate and does not call UNKNOWN a former owner or closed", () => {
    render(<HospiceProfileIntelligence intel={hospice} />);
    expect(screen.getAllByText(/CMS CAHPS Hospice Survey/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Suppressed")).toBeTruthy();
    expect(screen.getByText(/UNKNOWN does not mean former owner/i)).toBeTruthy();
    expect(screen.queryByText(/\bclosed\b/i)).toBeNull();
    expect(screen.getByText(/CMS Hospice CCN/)).toBeTruthy();
  });
});
