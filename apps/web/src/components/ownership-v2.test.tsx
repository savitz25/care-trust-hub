import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CareOwnershipOperationSummary } from "@/server/care/types";
import { OwnershipOperation } from "./ownership-v2";

const summary: CareOwnershipOperationSummary = {
  operator: { value: "Operator LLC", source: "New York State Department of Health" },
  licensee: { value: "Licensee LLC", source: "California Department of Public Health" },
  managementCompany: null,
  cmsOwnershipType: "For profit - Corporation",
  organizationCount: 2,
  individualCount: 6,
  chainName: "Example Group",
  ownershipChangeCount: 1,
  supportedByMultipleGovernmentSources: true,
  whoIsBehind: [
    "an operating organization identified by the state regulator",
    "a state licensee",
    "2 CMS-reported ownership organizations",
    "CMS reports 6 individual ownership interests",
    "a CMS chain / common-control group",
  ],
  portfolio: {
    organizationId: "11111111-1111-4111-8111-111111111111",
    organizationName: "Example LLC",
    relationshipType: "DIRECT OWNERSHIP",
    href: "/ownership/11111111-1111-4111-8111-111111111111/example-llc",
    indexable: true,
    historicalFacilityCount: 0,
    relationshipRoles: ["DIRECT OWNERSHIP"],
    facilityCount: 3,
    stateCount: 1,
    states: ["CA"],
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

describe("ownership operation v2", () => {
  it("keeps operator, licensee, and chain distinct and does not rank related facilities", () => {
    render(<OwnershipOperation summary={summary} />);
    expect(screen.getByRole("heading", { name: "Ownership & Operation" })).toBeVisible();
    expect(screen.getByText("Operator")).toBeInTheDocument();
    expect(screen.getByText("Operator LLC")).toBeInTheDocument();
    expect(screen.getByText("Licensee")).toBeInTheDocument();
    expect(screen.getByText("Chain")).toBeInTheDocument();
    expect(screen.getByText(/Supported by multiple government sources/)).toBeInTheDocument();
    expect(screen.getByText(/Explore ownership network/)).toBeInTheDocument();
    expect(screen.getByText(/6 individual ownership interests/)).toBeInTheDocument();
    expect(screen.getByText("Alpha Care")).toBeInTheDocument();
    expect(screen.getByText(/3.2 stars across 3 reporting facilities/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ultimate owner|Trust Score|best facility/i);
  });
});
