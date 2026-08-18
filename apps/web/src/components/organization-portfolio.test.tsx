import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrganizationPortfolio } from "./organization-portfolio";
import type { CareOrganizationPortfolioPage } from "@/server/care/types";

const page: CareOrganizationPortfolioPage = {
  historicalFacilities: [
    {
      ccn: "055099",
      providerName: "Former Care",
      city: "Fresno",
      state: "CA",
      overallRating: 2,
      staffingRating: 2,
      hadPenalty: false,
      relationshipType: "DIRECT OWNERSHIP",
      membershipStatus: "historical",
    },
  ],
  ownershipChanges: [
    {
      effectiveDate: "2024-03-01",
      changeTypeText: "Change of ownership",
      facilityName: "Alpha Care",
      ccn: "055001",
    },
  ],
  portfolio: {
    organizationId: "11111111-1111-4111-8111-111111111111",
    organizationName: "Example LLC",
    relationshipType: "DIRECT OWNERSHIP",
    href: "/ownership/11111111-1111-4111-8111-111111111111/example-llc",
    indexable: true,
    facilityCount: 3,
    historicalFacilityCount: 1,
    stateCount: 1,
    states: ["CA"],
    relationshipRoles: ["DIRECT OWNERSHIP"],
    relatedFacilities: [
      {
        ccn: "055001",
        providerName: "Alpha Care",
        city: "Redlands",
        state: "CA",
        overallRating: 3,
        staffingRating: 2,
        hadPenalty: true,
        relationshipType: "DIRECT OWNERSHIP",
        membershipStatus: "current",
      },
    ],
    overallAverage: 3.2,
    overallSampleSize: 3,
    overallDistribution: { 1: 0, 2: 1, 3: 1, 4: 1, 5: 0 },
    staffingAverage: 2.7,
    staffingSampleSize: 3,
    healthInspectionAverage: 2.3,
    healthInspectionSampleSize: 3,
    qualityMeasureAverage: 3.1,
    qualityMeasureSampleSize: 3,
    averageRnHprd: 0.55,
    rnSampleSize: 3,
    averageTotalNurseHprd: 3.2,
    totalNurseSampleSize: 3,
    facilitiesWithPenalty: 1,
    totalFineAmount: 15000,
    facilitiesWithOwnershipChange: 1,
    facilitiesWithRecentStateEnforcement: 0,
    facilitiesWithRecentCmsPenalty: 1,
    facilitiesWithRecentHighValueEnforcement: 0,
    facilitiesWithRecentComplaintInspection: 1,
    disclaimer: "These figures summarize currently connected CMS-certified nursing homes.",
  },
};

describe("organization portfolio page", () => {
  it("shows current members, historical members, and no owner score", () => {
    render(<OrganizationPortfolio page={page} />);
    expect(screen.getByRole("heading", { name: "Example LLC" })).toBeVisible();
    expect(screen.getByText("Portfolio Snapshot")).toBeInTheDocument();
    expect(screen.getByText("Alpha Care")).toBeInTheDocument();
    expect(screen.getByText(/Former Care/)).toBeInTheDocument();
    expect(screen.getByText(/not treated as an acquisition/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /Owner Trust Score|Portfolio Risk Score|best owner badge/i,
    );
  });
});
