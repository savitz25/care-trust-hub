import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChainIntelligence } from "./chain-intelligence";
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

  it("pads reported five-digit membership CCNs and does not emit those short URLs", () => {
    const chainWithFacilities: CareChainIntelligence = {
      ...chain,
      facilities: [
        {
          ccn: "55305",
          providerName: "Sherwood Healthcare Center",
          state: "CA",
          overallRating: 2,
        },
        {
          ccn: "56158",
          providerName: "College Oak Nursing and Rehabilitation Center",
          state: "CA",
          overallRating: 3,
        },
        {
          ccn: "55491",
          providerName: "Oak Ridge Healthcare Center",
          state: "CA",
          overallRating: 4,
        },
        {
          ccn: "55417",
          providerName: "Saylor Lane Healthcare Center",
          state: "CA",
          overallRating: 1,
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
        { ccn: "not-a-ccn", providerName: "Unlinked Facility", state: "CA", overallRating: null },
      ],
    };
    const { container } = render(<ChainIntelligence chain={chainWithFacilities} />);
    expect(screen.getByRole("link", { name: "Sherwood Healthcare Center" })).toHaveAttribute(
      "href",
      "/facility/cms/055305/sherwood-healthcare-center",
    );
    expect(
      screen.getByRole("link", { name: "College Oak Nursing and Rehabilitation Center" }),
    ).toHaveAttribute("href", "/facility/cms/056158/college-oak-nursing-and-rehabilitation-center");
    expect(screen.getByRole("link", { name: "Oak Ridge Healthcare Center" })).toHaveAttribute(
      "href",
      "/facility/cms/055491/oak-ridge-healthcare-center",
    );
    expect(screen.getByRole("link", { name: "Saylor Lane Healthcare Center" })).toHaveAttribute(
      "href",
      "/facility/cms/055417/saylor-lane-healthcare-center",
    );
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
    expect(screen.queryByRole("link", { name: "Unlinked Facility" })).not.toBeInTheDocument();
    expect(screen.getByText(/Unlinked Facility/)).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/\/facility\/cms\/(?:55305|56158|55491|55417)(?:\/|")/);
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
