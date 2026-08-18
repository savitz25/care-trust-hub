import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CareFacilityHistory } from "@/server/care/types";
import { FacilityHistory } from "./facility-history";
import { RealProviderDetail } from "./real-provider-detail";
import type { CareProviderDetail } from "@/server/care/types";

const history: CareFacilityHistory = {
  totalCount: 2,
  coverageLabel: "2 historical events available",
  emptyRecentLabel: "No major recent changes were identified in the available history.",
  recentHighlights: [
    {
      title: "Health inspection completed",
      summary: "CMS recorded a health inspection in May 2026.",
    },
  ],
  events: [
    {
      id: "insp",
      eventType: "INSPECTION_COMPLETED",
      eventFamily: "inspection",
      eventDate: "2026-05-14",
      datePrecision: "day",
      dateBasis: "occurred",
      importance: "MEDIUM",
      title: "Health inspection completed",
      summary: "8 deficiencies were recorded.",
      previousValue: null,
      newValue: null,
      evidenceHref: "#inspections",
      sourceDatasetName: "nursing-home-inspection-dates",
      sourceRecordLocator: "row:1",
      sourceLabel: "CMS",
      regulator: null,
    },
    {
      id: "own",
      eventType: "OWNERSHIP_CHANGED",
      eventFamily: "ownership",
      eventDate: "2025-11-08",
      datePrecision: "day",
      dateBasis: "occurred",
      importance: "HIGH",
      title: "Ownership change recorded",
      summary: "An ownership change was recorded. New organization: ABC Healthcare LLC.",
      previousValue: null,
      newValue: "ABC Healthcare LLC",
      evidenceHref: "#ownership",
      sourceDatasetName: "skilled-nursing-facility-enrollments",
      sourceRecordLocator: "row:2",
      sourceLabel: "CMS",
      regulator: null,
    },
    {
      id: "state",
      eventType: "STATE_FINE",
      eventFamily: "state",
      eventDate: "2026-07-12",
      datePrecision: "day",
      dateBasis: "occurred",
      importance: "HIGH",
      title: "State fine recorded",
      summary: "California Department of Public Health recorded a state fine on 2026-07-12.",
      previousValue: null,
      newValue: "$12,000",
      evidenceHref: "#state-license",
      sourceDatasetName: "ca-cdph-state-enforcement-actions",
      sourceRecordLocator: "ca:CA-1",
      sourceLabel: "California Department of Public Health",
      regulator: "California Department of Public Health",
    },
  ],
};

const source = {
  sourceOrganization: "Centers for Medicare & Medicaid Services (CMS)",
  datasetName: "Nursing Home Provider Information",
  cmsDatasetIdentifier: "4pq5-n9py",
  releaseIdentifier: "2026-07-29",
  officialSourceUrl: "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
  providerIdentifier: "055001",
  sourceRecordLocator: "csv-row:ccn:055001",
  freshness: {
    sourceModifiedAt: "2026-07-29T00:00:00.000Z",
    sourcePublishedAt: null,
    retrievedAt: "2026-08-14T00:00:00.000Z",
    ingestCompletedAt: "2026-08-14T00:01:00.000Z",
  },
};

const provider: CareProviderDetail = {
  ccn: "055001",
  providerName: "Redlands Healthcare Center",
  legalBusinessName: null,
  telephone: null,
  location: {
    address: "1 Main",
    city: "Redlands",
    state: "CA",
    zipCode: "92373",
    county: "San Bernardino",
    latitude: 34.05,
    longitude: -117.18,
  },
  certifiedBeds: 78,
  ratings: { overall: 3, healthInspection: 2, staffing: 3, qualityMeasure: 4 },
  ownershipType: "For profit",
  participationType: "Medicare and Medicaid",
  participatesMedicare: true,
  participatesMedicaid: true,
  source,
};

describe("facility history", () => {
  it("renders grouped events and recent changes without a score", () => {
    render(<FacilityHistory history={history} />);
    expect(screen.getByRole("heading", { name: "Facility History" })).toBeInTheDocument();
    expect(screen.getByText("What changed recently?")).toBeInTheDocument();
    expect(screen.getAllByText("Health inspection completed").length).toBeGreaterThan(0);
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
    expect(screen.getAllByText(/California Department of Public Health/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/Trust Score|risk score|DANGEROUS/i);
  });

  it("filters to ownership without treating the organization as a chain score", () => {
    render(<FacilityHistory history={history} />);
    fireEvent.click(screen.getByRole("button", { name: "Ownership" }));
    expect(screen.getByText("Ownership change recorded")).toBeInTheDocument();
    expect(screen.queryByText("8 deficiencies were recorded.")).not.toBeInTheDocument();
  });

  it("renders a facility with no history safely", () => {
    render(
      <RealProviderDetail
        provider={provider}
        facilityHistory={{
          events: [],
          totalCount: 0,
          coverageLabel: "Limited historical data is available for this facility.",
          recentHighlights: [],
          emptyRecentLabel: "No major recent changes were identified in the available history.",
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Redlands Healthcare Center" }),
    ).toBeVisible();
    expect(screen.getByText(/Limited historical data/)).toBeInTheDocument();
    expect(screen.getByText(/No major recent changes/)).toBeInTheDocument();
  });
});
