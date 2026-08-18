import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CareProviderDetail, CarePublishedFacilityEnrichment } from "@/server/care/types";
import { RealProviderDetail } from "./real-provider-detail";
import { VerifiedPublicContact } from "./verified-public-contact";

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

const provider: CareProviderDetail = {
  ccn: "01A193",
  providerName: "Harborview Care And Rehab",
  legalBusinessName: null,
  telephone: "205-555-0100",
  location: {
    address: "1 Main St",
    city: "Example",
    state: "AL",
    zipCode: "35004",
    county: null,
    latitude: 33.5,
    longitude: -86.8,
  },
  certifiedBeds: 80,
  ratings: { overall: 3, healthInspection: 2, staffing: 4, qualityMeasure: 3 },
  ownershipType: "For profit",
  participationType: "Medicare and Medicaid",
  participatesMedicare: true,
  participatesMedicaid: true,
  source,
};

const empty: CarePublishedFacilityEnrichment = {
  website: null,
  phone: null,
  publicAlias: null,
  phoneMatchesCms: false,
};

describe("verified public contact publication", () => {
  it("renders a VERIFIED website and matching phone without duplicating CMS", () => {
    const enrichment: CarePublishedFacilityEnrichment = {
      website: {
        value: "https://harborview.example",
        resolvedAt: "2026-08-18T15:00:00.000Z",
        claimType: "google_official_website",
      },
      phone: {
        value: "2055550100",
        resolvedAt: "2026-08-18T15:00:00.000Z",
        claimType: "google_public_phone",
      },
      publicAlias: null,
      phoneMatchesCms: true,
    };
    render(<VerifiedPublicContact provider={provider} enrichment={enrichment} />);
    expect(screen.getByRole("link", { name: "Visit facility website" })).toHaveAttribute(
      "href",
      "https://harborview.example",
    );
    expect(screen.getByRole("link", { name: "205-555-0100" })).toHaveAttribute(
      "href",
      "tel:+12055550100",
    );
    expect(screen.queryByText("Public contact")).not.toBeInTheDocument();
    expect(screen.getAllByText(/checked Aug 2026/).length).toBeGreaterThan(0);
  });

  it("renders a distinct VERIFIED phone without replacing the CMS number", () => {
    render(
      <VerifiedPublicContact
        provider={provider}
        enrichment={{
          ...empty,
          phone: {
            value: "205-555-0199",
            resolvedAt: "2026-08-18T15:00:00.000Z",
            claimType: "google_public_phone",
          },
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "205-555-0100" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "205-555-0199" })).toBeInTheDocument();
    expect(screen.getByText("Public contact")).toBeInTheDocument();
  });

  it("does not render unpublished enrichment, Place IDs, or Google business status", () => {
    const { container } = render(
      <RealProviderDetail
        provider={provider}
        publishedEnrichment={{
          ...empty,
          publicAlias: {
            value: "Harborview",
            resolvedAt: "2026-08-18T15:00:00.000Z",
            claimType: "google_public_name",
          },
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Harborview Care And Rehab" }),
    ).toBeVisible();
    expect(screen.getByText(/Also known publicly as Harborview/)).toBeInTheDocument();
    expect(container.textContent).not.toContain("ChIJ");
    expect(container.textContent).not.toMatch(/Permanently closed|OPERATIONAL|CLOSED_PERMANENTLY/);
    expect(container.textContent).not.toContain("google_place_identity");
    expect(screen.getByText("CMS provider ID 01A193")).toBeInTheDocument();
  });

  it("keeps REVIEW_REQUIRED and PROBABLE facilities on CMS-only contact", () => {
    const { container } = render(
      <RealProviderDetail
        provider={{ ...provider, telephone: null }}
        publishedEnrichment={empty}
      />,
    );
    expect(container.querySelector("#contact")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Visit facility website" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Harborview Care And Rehab" }),
    ).toBeVisible();
  });
});
