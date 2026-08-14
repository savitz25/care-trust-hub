import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CareProviderDetail, CareProviderSearchResult } from "@/server/care/types";
import { CmsStarRating, RealProviderCard, RealSourceDisclosure } from "./real-provider";
import { RealProviderDetail } from "./real-provider-detail";

const source = {
  sourceOrganization: "Centers for Medicare & Medicaid Services (CMS)",
  datasetName: "Nursing Home Provider Information",
  cmsDatasetIdentifier: "4pq5-n9py",
  releaseIdentifier: "2026-07-29",
  officialSourceUrl: "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
  providerIdentifier: "01A193",
  sourceRecordLocator: "csv-row:2:ccn:01A193",
  freshness: {
    sourceModifiedAt: "2026-07-29T00:00:00.000Z",
    sourcePublishedAt: null,
    retrievedAt: "2026-08-14T00:00:00.000Z",
    ingestCompletedAt: "2026-08-14T00:01:00.000Z",
  },
};

const provider: CareProviderSearchResult = {
  ccn: "01A193",
  providerName: "Mapped Provider",
  location: {
    address: "1 Main St",
    city: "Example",
    state: "AL",
    zipCode: "35004",
    county: null,
    latitude: 33.5,
    longitude: -86.8,
  },
  certifiedBeds: null,
  ratings: { overall: null, healthInspection: 2, staffing: 5, qualityMeasure: 3 },
  ownershipType: null,
  participationType: "Medicare and Medicaid",
  participatesMedicare: true,
  participatesMedicaid: true,
  source,
};
const detailProvider: CareProviderDetail = {
  ...provider,
  legalBusinessName: null,
  telephone: null,
};

describe("real provider presentation", () => {
  it("gives stars and missing ratings accessible text equivalents", () => {
    render(
      <>
        <CmsStarRating value={5} />
        <CmsStarRating value={null} />
      </>,
    );
    expect(screen.getByText("5 of 5 CMS stars")).toBeInTheDocument();
    expect(screen.getByText("Not reported in this CMS release")).toBeInTheDocument();
  });

  it("renders only approved fields and no raw record or secret", () => {
    const { container } = render(<RealProviderCard provider={provider} />);
    expect(screen.getByRole("link", { name: "Mapped Provider" })).toHaveAttribute(
      "href",
      "/facility/cms/01A193/mapped-provider",
    );
    expect(container.textContent).not.toContain("raw_record");
    expect(container.textContent).not.toContain("CARE_DATABASE_URL");
  });

  it("renders dated, keyboard-native source disclosure", () => {
    render(<RealSourceDisclosure source={source} />);
    expect(screen.getByText("July 29, 2026")).toBeInTheDocument();
    expect(screen.getByText("August 14, 2026")).toBeInTheDocument();
    expect(screen.getByText("View source details").closest("details")).toBeInTheDocument();
  });

  it("renders a conservative real facility detail without unavailable findings", () => {
    const { container } = render(<RealProviderDetail provider={detailProvider} />);
    expect(screen.getByRole("heading", { level: 1, name: "Mapped Provider" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Four published dimensions, not a proprietary score" }),
    ).toBeInTheDocument();
    expect(screen.getByText("CMS reports a 5-star staffing rating.")).toBeInTheDocument();
    expect(screen.getByText("Inspection and deficiency history")).toBeInTheDocument();
    expect(container.textContent).not.toContain("Recent enforcement activity");
    expect(container.textContent).not.toContain("raw_record");
  });
});
