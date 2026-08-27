import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NursingHomeProviderIntelligence } from "@care/domain";
import { NhProfileIntelligence } from "./nh-profile-intelligence";

const base = {
  contract_version: "provider-intel-v1",
  canonical_id: "056078",
  provider_type: "nursing_home" as const,
  identifier_type: "CCN" as const,
  profile_intelligence_status: "READY" as const,
  directory: { official_status: "CURRENT_ACTIVE", projection: "CURRENT_DIRECTORY" as const },
  common: {
    display_name: "Example Manor",
    legal_name: null,
    office: { address: "1 Main", city: "Town", state: "AL", zip: "35004", phone: "555-0100" },
  },
  nursing_home: { has_core_evidence: true },
  quality_summary: {
    cms_stars: {
      overall: 4,
      health_inspection: 3,
      staffing: null,
      quality_measure: 5,
      label: "CMS rating",
      not_trust_hub_rating: true as const,
      availability: "AVAILABLE",
    },
    nh_evidence_flags: { mds: true, pbj: true, fire: true, inspection: true, sff: false },
    synthetic_trust_hub_rating: false as const,
  },
  ownership_summary: {
    current_owners: [
      {
        display_name: "Example LLC",
        party_kind: "organization" as const,
        party_id: "p1",
        organization_id: "o1",
        relationship_type: "OWNED_BY",
        raw_cms_role: "5% OR GREATER DIRECT OWNERSHIP INTEREST",
        ownership_percentage: 5,
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
        party_kind: "individual" as const,
        party_id: "p2",
        organization_id: null,
        relationship_type: "OWNED_BY",
        raw_cms_role: "OWNER",
        ownership_percentage: null,
        temporal_status: "UNKNOWN" as const,
        effective_from: null,
        confidence: "CONFIRMED",
        person_publication_policy: "SOURCE_EVIDENCE_ONLY_NO_PUBLIC_PROFILE",
        public_profile: false,
      },
    ],
    counts: {
      current_owners: 47,
      operators: 0,
      managers: 0,
      enrollment_organizations: 0,
      historical_ownership_observations: 0,
      unknown_ownership_observations: 1,
    },
    unresolved_edges_included: false as const,
  },
  chow: {
    ownership_change_history_available: true,
    confirmed_event_count: 1,
    events: [
      {
        event_id: "e1",
        effective_date: "2024-06-01",
        cms_raw_type_code: "CH",
        cms_raw_type_text: "CHANGE OF OWNERSHIP",
        normalized_type: "CHANGE_OF_OWNERSHIP",
        buyer_legal_entity: "Buyer LLC",
        seller_legal_entity: "Seller LLC",
        source_dataset_key: "skilled-nursing-facility-change-of-ownership",
        source_dataset_id: "f557a6ed-95b3-4a22-8433-4175db2dec1c",
        confidence: "CONFIRMED",
        safe_language: "CMS records show an ownership change effective 2024-06-01.",
        not_labeled_sale: true as const,
      },
    ],
  },
  evidence_as_of_by_family: {
    "nursing-home-provider-information": {
      band: "CURRENT",
      source_modified_at: "2026-08-01",
      age_days: 10,
    },
  },
  availability: { QUALITY: "AVAILABLE" },
  limitations: ["Ownership evidence is not a quality measure."],
  person_publication_policy: "SOURCE_EVIDENCE_ONLY_NO_PUBLIC_PROFILE",
  organization_public_route: false as const,
  fingerprint: "abc",
  profile_generated_at: "2026-08-27T00:00:00.000Z",
} satisfies NursingHomeProviderIntelligence;

describe("NhProfileIntelligence", () => {
  it("labels CMS ratings and does not invent a Trust Hub score", () => {
    render(<NhProfileIntelligence intel={base} />);
    expect(screen.getAllByText(/CMS overall rating/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Trust Hub rating$/i)).toBeNull();
    expect(screen.queryByText(/Trust Score/i)).toBeNull();
  });

  it("renders CHOW as CMS change of ownership, not a sale", () => {
    render(<NhProfileIntelligence intel={base} />);
    expect(screen.getByText(/ownership change effective 2024-06-01/i)).toBeTruthy();
    expect(screen.getByText("CHANGE OF OWNERSHIP")).toBeTruthy();
    expect(screen.queryByText(/was sold/i)).toBeNull();
    expect(screen.queryByText(/acquired this facility/i)).toBeNull();
  });

  it("does not call UNKNOWN owners former owners", () => {
    render(<NhProfileIntelligence intel={base} />);
    expect(screen.getByText("Unknown Party")).toBeTruthy();
    expect(screen.getByText(/UNKNOWN does not mean former owner/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Unknown Party/i })).toBeNull();
  });

  it("reports party caps and known-not-current without closed", () => {
    const intel = {
      ...base,
      directory: {
        official_status: "ABSENT_FROM_CURRENT_DIRECTORY",
        projection: "KNOWN_NOT_CURRENT" as const,
      },
    };
    render(<NhProfileIntelligence intel={intel} />);
    expect(screen.getByText(/Showing 1 of 47 relationships/)).toBeTruthy();
    expect(screen.getByText(/not listed in the current CMS nursing-home directory/i)).toBeTruthy();
    expect(screen.queryByText(/\bclosed\b/i)).toBeNull();
  });

  it("does not say never changed ownership when there are no events", () => {
    const intel = {
      ...base,
      chow: { ownership_change_history_available: true, confirmed_event_count: 0, events: [] },
    };
    render(<NhProfileIntelligence intel={intel} />);
    expect(screen.getByText(/No CMS ownership-change event is currently attached/i)).toBeTruthy();
    expect(screen.queryByText(/never changed ownership/i)).toBeNull();
  });
});
