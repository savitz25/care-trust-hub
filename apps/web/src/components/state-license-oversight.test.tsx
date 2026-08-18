import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublishedStateIntelligence } from "@care/domain";
import type { CareProviderDetail } from "@/server/care/types";
import { RealProviderDetail } from "./real-provider-detail";
import { StateLicenseOversight } from "./state-license-oversight";

const source = {
  sourceOrganization: "Centers for Medicare & Medicaid Services (CMS)",
  datasetName: "Nursing Home Provider Information",
  cmsDatasetIdentifier: "4pq5-n9py",
  releaseIdentifier: "2026-07-29",
  officialSourceUrl: "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
  providerIdentifier: "555120",
  sourceRecordLocator: "csv-row:ccn:555120",
  freshness: {
    sourceModifiedAt: "2026-07-29T00:00:00.000Z",
    sourcePublishedAt: null,
    retrievedAt: "2026-08-14T00:00:00.000Z",
    ingestCompletedAt: "2026-08-14T00:01:00.000Z",
  },
};

const provider: CareProviderDetail = {
  ccn: "555120",
  providerName: "Vineyard Post Acute",
  legalBusinessName: null,
  telephone: "707-763-4109",
  location: {
    address: "101 Monroe St",
    city: "Petaluma",
    state: "CA",
    zipCode: "94954",
    county: "Sonoma",
    latitude: 38.25,
    longitude: -122.62,
  },
  certifiedBeds: 110,
  ratings: { overall: 3, healthInspection: 2, staffing: 4, qualityMeasure: 3 },
  ownershipType: "For profit",
  participationType: "Medicare and Medicaid",
  participatesMedicare: true,
  participatesMedicaid: true,
  source,
};

const intelligence: PublishedStateIntelligence = {
  stateCode: "CA",
  regulator: "California Department of Public Health",
  datasetName: "Licensed and Certified Healthcare Facility Listing",
  officialUrl: "https://data.chhs.ca.gov/dataset/healthcare-facility-locations",
  licenseLabel: "State license",
  licenseId: {
    value: "10000102",
    resolvedAt: "2026-08-18T17:00:00.000Z",
    claimType: "STATE_LICENSE_ID",
  },
  licenseStatus: {
    value: "ACTIVE",
    resolvedAt: "2026-08-18T17:00:00.000Z",
    claimType: "STATE_LICENSE_STATUS",
  },
  licenseType: {
    value: "SNF",
    resolvedAt: "2026-08-18T17:00:00.000Z",
    claimType: "STATE_LICENSE_TYPE",
  },
  licensedCapacity: {
    value: "99",
    resolvedAt: "2026-08-18T17:00:00.000Z",
    claimType: "STATE_LICENSE_CAPACITY",
  },
  licensee: {
    value: "PETALUMAIDENCE OPCO, LLC",
    resolvedAt: "2026-08-18T17:00:00.000Z",
    claimType: "STATE_LICENSEE",
  },
  operator: null,
  administrator: {
    value: "BILLS, KEVAN",
    resolvedAt: "2026-08-18T17:00:00.000Z",
    claimType: "STATE_ADMINISTRATOR",
  },
  managementCompany: null,
  checkedAt: "2026-08-18T17:00:00.000Z",
  checkedLabel: "State regulatory data checked Aug 2026",
};

describe("state license oversight publication", () => {
  it("shows VERIFIED California fields without replacing CMS name or certified beds", () => {
    render(<StateLicenseOversight provider={provider} intelligence={intelligence} />);
    expect(screen.getByRole("heading", { name: /State License/ })).toBeInTheDocument();
    expect(screen.getByText("10000102")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("99 beds")).toBeInTheDocument();
    expect(screen.getByText("CMS certified beds: 110")).toBeInTheDocument();
    expect(screen.getByText("PETALUMAIDENCE OPCO, LLC")).toBeInTheDocument();
    expect(screen.getByText(/not automatically the owner or chain/i)).toBeInTheDocument();
  });

  it("keeps the CMS facility name when state intelligence is present", () => {
    render(<RealProviderDetail provider={provider} stateIntelligence={intelligence} />);
    expect(screen.getByRole("heading", { level: 1, name: "Vineyard Post Acute" })).toBeVisible();
    expect(screen.getAllByText("California Department of Public Health").length).toBeGreaterThan(0);
    expect(screen.getByText("CMS certified beds")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "PETALUMAIDENCE OPCO, LLC" }),
    ).not.toBeInTheDocument();
  });

  it("does not render a state section when intelligence is absent", () => {
    const { container } = render(<RealProviderDetail provider={provider} />);
    expect(container.querySelector("#state-license")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Vineyard Post Acute" })).toBeVisible();
  });

  it("lists the official state source without exposing resolver internals", () => {
    render(<RealProviderDetail provider={provider} stateIntelligence={intelligence} />);
    expect(
      screen.getByText("Licensed and Certified Healthcare Facility Listing"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View official state source" })).toHaveAttribute(
      "href",
      intelligence.officialUrl,
    );
    expect(screen.queryByText(/state-cms-bridge|resolver|run id/i)).not.toBeInTheDocument();
  });

  it("publishes New York operator evidence without manufacturing license status", () => {
    const ny: PublishedStateIntelligence = {
      ...intelligence,
      stateCode: "NY",
      regulator: "New York State Department of Health",
      datasetName: "Health Facility General Information (HFIS)",
      officialUrl:
        "https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r",
      licenseLabel: "Operating certificate",
      licenseId: {
        value: "2701364N",
        resolvedAt: "2026-08-18T17:00:00.000Z",
        claimType: "STATE_LICENSE_ID",
      },
      licenseStatus: null,
      licensee: null,
      operator: {
        value: "EXAMPLE OPERATOR LLC",
        resolvedAt: "2026-08-18T17:00:00.000Z",
        claimType: "STATE_OPERATOR",
      },
      administrator: null,
    };
    render(<StateLicenseOversight provider={provider} intelligence={ny} />);
    expect(screen.getByText("2701364N")).toBeInTheDocument();
    expect(screen.getByText("EXAMPLE OPERATOR LLC")).toBeInTheDocument();
    expect(screen.queryByText("License status")).not.toBeInTheDocument();
  });

  it("labels the administrator separately and does not treat it as owner", () => {
    render(<StateLicenseOversight provider={provider} intelligence={intelligence} />);
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("BILLS, KEVAN")).toBeInTheDocument();
    expect(screen.getByText("Named on the state license record")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "BILLS, KEVAN" })).not.toBeInTheDocument();
  });

  it("renders VERIFIED Texas license identity without inventing status or overwriting CMS beds", () => {
    const tx: PublishedStateIntelligence = {
      ...intelligence,
      stateCode: "TX",
      regulator: "Texas Health and Human Services Commission",
      datasetName: "Directory of Nursing Facilities with an Active License",
      officialUrl:
        "https://www.hhs.texas.gov/providers/long-term-care-providers/nursing-facilities-nf",
      licenseStatus: null,
      licensedCapacity: null,
      licensee: null,
      administrator: null,
      managementCompany: null,
    };
    const texasProvider = { ...provider, certifiedBeds: 214, providerName: "Avir at Beaumont" };
    render(<RealProviderDetail provider={texasProvider} stateIntelligence={tx} />);
    expect(screen.getByRole("heading", { level: 1, name: "Avir at Beaumont" })).toBeVisible();
    expect(
      screen.getAllByText("Texas Health and Human Services Commission").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("CMS certified beds")).toBeInTheDocument();
    expect(screen.queryByText("License status")).not.toBeInTheDocument();
    expect(screen.queryByText("Licensee")).not.toBeInTheDocument();
  });

  it("renders unsupported-state facilities as CMS-only records", () => {
    const florida = {
      ...provider,
      ccn: "105001",
      providerName: "Lake Eustis Healthcare",
      location: { ...provider.location, state: "FL", city: "Eustis" },
    };
    const { container } = render(<RealProviderDetail provider={florida} />);
    expect(screen.getByRole("heading", { level: 1, name: "Lake Eustis Healthcare" })).toBeVisible();
    expect(container.querySelector("#state-license")).not.toBeInTheDocument();
    expect(screen.getByText("CMS certified beds")).toBeInTheDocument();
  });

  it("keeps a management company label distinct from owner and chain when a safe value is present", () => {
    const withManagement: PublishedStateIntelligence = {
      ...intelligence,
      licenseStatus: null,
      licensee: null,
      operator: null,
      administrator: null,
      managementCompany: {
        value: "EXAMPLE MANAGEMENT INC",
        resolvedAt: "2026-08-18T17:00:00.000Z",
        claimType: "STATE_MANAGEMENT_ENTITY",
      },
    };
    render(<StateLicenseOversight provider={provider} intelligence={withManagement} />);
    expect(screen.getByText("Management company")).toBeInTheDocument();
    expect(screen.getByText("EXAMPLE MANAGEMENT INC")).toBeInTheDocument();
    expect(screen.getByText(/not automatically the owner or chain/i)).toBeInTheDocument();
  });
});
