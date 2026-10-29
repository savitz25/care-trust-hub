import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChainIntelligence } from "./chain-intelligence";
import { chainFacilitiesFromSources } from "@/server/care/cms-ccn";
import type { CareChainIntelligence } from "@/server/care/types";
const chain: CareChainIntelligence = {
  cmsChainId: "123",
  current: {
    releaseMonth: "2026-07-01",
    chainName: "EXAMPLE CHAIN",
    facilityCount: 7,
    stateCount: 2,
    metrics: { "Average staffing rating": 2.8, "Total number of fines": 0 },
  },
  history: [],
  facilities: [],
  source: {
    datasetIdentifier: "97ecfad1-d3f1-4d42-b774-d74661d830bc",
    versionIdentifier: "fixed",
    officialUrl: "https://data.cms.gov/chain",
    sourceModifiedAt: null,
    retrievedAt: "2026-08-15",
  },
  membershipSource: {
    datasetIdentifier: "5f2c306f-3b1c-42cd-b037-187b2ce22126",
    sourceModifiedAt: null,
    retrievedAt: "2026-08-15",
  },
};
describe("chain intelligence", () => {
  it("links chain facilities to canonical review URLs while preserving CCN leading zeros", () => {
    const chainWithFacility: CareChainIntelligence = {
      ...chain,
      facilities: [
        {
          ccn: "001234",
          providerName: "Example Facility",
          state: "NY",
          overallRating: 4,
        },
      ],
    };
    render(<ChainIntelligence chain={chainWithFacility} />);
    expect(screen.getByRole("link", { name: "Example Facility" })).toHaveAttribute(
      "href",
      "/facility/cms/001234/example-facility",
    );
  });

  it("links resolved six-character CCNs and leaves five-digit identifiers unresolved", () => {
    const chainWithFacilities: CareChainIntelligence = {
      ...chain,
      facilities: [
        { ccn: "015010", providerName: "Example Indiana Facility", state: "IN", overallRating: 3 },
        {
          ccn: "055170",
          providerName: "Example California Facility",
          state: "CA",
          overallRating: 3,
        },
        {
          ccn: "055305",
          providerName: "Sherwood Healthcare Center",
          state: "CA",
          overallRating: 2,
        },
        {
          ccn: "056158",
          providerName: "College Oak Nursing and Rehabilitation Center",
          state: "CA",
          overallRating: 3,
        },
        {
          ccn: "055640",
          providerName: "Grass Valley Healthcare Center",
          state: "CA",
          overallRating: 5,
        },
        {
          ccn: "555180",
          providerName: "Six Digit Facility",
          state: "CA",
          overallRating: 4,
        },
        { ccn: "01A193", providerName: "Example & Care, Inc.", state: "AL", overallRating: null },
        { ccn: "15010", providerName: "Unmatched Five Digit", state: "IN", overallRating: null },
        { ccn: "not-a-ccn", providerName: "Unlinked Facility", state: "CA", overallRating: null },
      ],
    };
    const { container } = render(<ChainIntelligence chain={chainWithFacilities} />);
    expect(screen.getByRole("link", { name: "Example Indiana Facility" })).toHaveAttribute(
      "href",
      "/facility/cms/015010/example-indiana-facility",
    );
    expect(screen.getByRole("link", { name: "Example California Facility" })).toHaveAttribute(
      "href",
      "/facility/cms/055170/example-california-facility",
    );
    expect(screen.getByRole("link", { name: "Sherwood Healthcare Center" })).toHaveAttribute(
      "href",
      "/facility/cms/055305/sherwood-healthcare-center",
    );
    expect(
      screen.getByRole("link", { name: "College Oak Nursing and Rehabilitation Center" }),
    ).toHaveAttribute("href", "/facility/cms/056158/college-oak-nursing-and-rehabilitation-center");
    expect(screen.getByRole("link", { name: "Grass Valley Healthcare Center" })).toHaveAttribute(
      "href",
      "/facility/cms/055640/grass-valley-healthcare-center",
    );
    expect(screen.getByRole("link", { name: "Six Digit Facility" })).toHaveAttribute(
      "href",
      "/facility/cms/555180/six-digit-facility",
    );
    expect(screen.getByRole("link", { name: "Example & Care, Inc." })).toHaveAttribute(
      "href",
      "/facility/cms/01A193/example-and-care-inc",
    );
    expect(screen.queryByRole("link", { name: "Unmatched Five Digit" })).not.toBeInTheDocument();
    expect(screen.getByText(/Unmatched Five Digit/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Unlinked Facility" })).not.toBeInTheDocument();
    expect(screen.getByText(/Unlinked Facility/)).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/\/facility\/cms\/(?:15010|55170|55305|56158)(?:\/|")/);
  });

  it("renders no profile link when 15010 and 015010 belong to different providers", () => {
    const facilities = chainFacilitiesFromSources(
      [
        {
          storedCcn: "15010",
          canonicalCcns: ["15010"],
          providerName: "Example Indiana Facility",
          state: "IN",
          overallRating: 3,
        },
        {
          storedCcn: "015010",
          canonicalCcns: ["015010"],
          providerName: "Second Indiana Facility",
          state: "IN",
          overallRating: 2,
        },
        {
          storedCcn: "055305",
          canonicalCcns: ["055305"],
          providerName: "Sherwood Healthcare Center",
          state: "CA",
          overallRating: 4,
        },
      ],
      [
        { providerId: "provider-a", identifierValue: "15010" },
        { providerId: "provider-b", identifierValue: "015010" },
        { providerId: "provider-c", identifierValue: "055305" },
      ],
    );
    const { container } = render(<ChainIntelligence chain={{ ...chain, facilities }} />);
    expect(
      screen.queryByRole("link", { name: "Example Indiana Facility" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Second Indiana Facility" })).not.toBeInTheDocument();
    expect(screen.getByText(/Example Indiana Facility/)).toBeInTheDocument();
    expect(screen.getByText(/Second Indiana Facility/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sherwood Healthcare Center" })).toHaveAttribute(
      "href",
      "/facility/cms/055305/sherwood-healthcare-center",
    );
    expect(container.innerHTML).not.toMatch(/\/facility\/cms\/015010\//);
    expect(container.innerHTML).not.toMatch(/\/facility\/cms\/15010(?:\/|")/);
  });

  it("renders no profile link when the conflicting provider is outside the chain page", () => {
    const facilities = chainFacilitiesFromSources(
      [
        {
          storedCcn: "015010",
          canonicalCcns: ["015010"],
          providerName: "Example Indiana Facility",
          state: "IN",
          overallRating: 3,
        },
      ],
      [
        { providerId: "provider-on-page", identifierValue: "015010" },
        { providerId: "provider-outside-page", identifierValue: "15010" },
      ],
    );
    render(<ChainIntelligence chain={{ ...chain, facilities }} />);
    expect(
      screen.queryByRole("link", { name: "Example Indiana Facility" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Example Indiana Facility/)).toBeInTheDocument();
  });

  it("labels CMS group evidence without a score or ranking", () => {
    const { container } = render(<ChainIntelligence chain={chain} facility />);
    expect(screen.getByText(/CMS groups this facility with EXAMPLE CHAIN/)).toBeInTheDocument();
    expect(screen.getByText(/grouping identifier, not a legal organization/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /TrustHub chain score|best chain|worst chain|subscription|billing/i,
    );
  });
});
