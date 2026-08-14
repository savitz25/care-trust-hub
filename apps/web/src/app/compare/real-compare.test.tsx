import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CareProviderDetail } from "@/server/care/types";
import { RealCompare } from "./real-compare";

function provider(ccn: string, name: string, overall: number | null): CareProviderDetail {
  return {
    ccn,
    providerName: name,
    location: {
      address: null,
      city: "Example",
      state: "AL",
      zipCode: "35004",
      county: null,
      latitude: null,
      longitude: null,
    },
    certifiedBeds: 80,
    ratings: { overall, healthInspection: 3, staffing: 4, qualityMeasure: 2 },
    legalBusinessName: null,
    telephone: null,
    ownershipType: "Non profit - Corporation",
    participationType: "Medicare and Medicaid",
    participatesMedicare: true,
    participatesMedicaid: true,
    source: {
      sourceOrganization: "Centers for Medicare & Medicaid Services (CMS)",
      datasetName: "Nursing Home Provider Information",
      cmsDatasetIdentifier: "4pq5-n9py",
      releaseIdentifier: "2026-07-29",
      officialSourceUrl: "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
      providerIdentifier: ccn,
      sourceRecordLocator: `csv-row:2:ccn:${ccn}`,
      freshness: {
        sourceModifiedAt: "2026-07-29T00:00:00.000Z",
        sourcePublishedAt: null,
        retrievedAt: "2026-08-14T00:00:00.000Z",
        ingestCompletedAt: "2026-08-14T00:01:00.000Z",
      },
    },
  };
}

describe("real provider comparison", () => {
  it("compares approved CMS fields without declaring a winner", () => {
    const { container } = render(
      <RealCompare
        providers={[
          provider("015009", "Provider One", 5),
          provider("01A193", "Provider Two", null),
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Provider One" })).toBeInTheDocument();
    expect(screen.getByText("Not reported in this CMS release")).toBeInTheDocument();
    expect(screen.getAllByText("Ownership descriptor")).toHaveLength(2);
    expect(container.textContent).not.toMatch(/penalt|deficien|turnover/i);
    expect(screen.getByText(/No proprietary ranking or winner is produced/)).toBeInTheDocument();
    expect(container.textContent).not.toContain("raw_record");
  });
});
