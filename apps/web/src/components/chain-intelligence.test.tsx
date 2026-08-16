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
  it("labels CMS group evidence without a score or ranking", () => {
    const { container } = render(<ChainIntelligence chain={chain} facility />);
    expect(screen.getByText(/CMS groups this facility with EXAMPLE CHAIN/)).toBeInTheDocument();
    expect(screen.getByText(/grouping identifier, not a legal organization/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /TrustHub chain score|best chain|worst chain|subscription|billing/i,
    );
  });
});
