import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CareStaffingIntelligence } from "@/server/care/types";
import { StaffingIntelligence } from "./staffing-intelligence";

const source = {
  sourceOrganization: "Centers for Medicare & Medicaid Services (CMS)",
  datasetName: "Payroll Based Journal Daily Nurse Staffing",
  cmsDatasetIdentifier: "7e0d53ba-8f02-4c66-98a5-14a1c997c50d",
  sourceVersionIdentifier: "6e5d5e28-66fd-41bc-a36c-db54dcbffd3e",
  officialSourceUrl:
    "https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing",
  releaseIdentifier: "2026-07-29",
  sourceQuarter: "2026Q1",
  sourceModifiedAt: "2026-07-29T00:00:00.000Z",
  sourcePublishedAt: null,
  retrievedAt: "2026-08-14T00:00:00.000Z",
  providerIdentifier: "12A345",
  sourceRecordLocator: "derived:quarter:2026Q1",
};

const intelligence: CareStaffingIntelligence = {
  latest: {
    quarter: "2026Q1",
    coverageStart: "2026-01-01",
    coverageEnd: "2026-03-31",
    daysRepresented: 90,
    positiveCensusDays: 90,
    missingCensusDays: 0,
    totalNurseHprd: 3.5,
    rnHprd: 0.75,
    lpnHprd: 0.65,
    cnaHprd: 1.9,
    weekdayTotalNurseHprd: 3.6,
    weekendTotalNurseHprd: 3.2,
    weekdayRnHprd: 0.8,
    weekendRnHprd: 0.6,
    contractNurseShare: 0.12,
    zeroReportedRnDays: 2,
    formulaVersion: "pbj-quarter-ratio-of-sums-v1",
    source,
  },
  history: [],
};
intelligence.history = [
  intelligence.latest!,
  { ...intelligence.latest!, quarter: "2025Q4", source: { ...source, sourceQuarter: "2025Q4" } },
];

describe("staffing intelligence", () => {
  it("separates CMS rating from calculations and provides accessible evidence", () => {
    const { container } = render(
      <StaffingIntelligence intelligence={intelligence} cmsStaffingRating={3} />,
    );
    expect(
      screen.getByRole("heading", { name: "Reported nursing staffing at a glance" }),
    ).toBeVisible();
    expect(screen.getByText(/CMS staffing rating: 3 of 5 stars/)).toBeVisible();
    expect(screen.getByText(/not CMS case-mix-adjusted staffing measures/)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Calculated reported hours/ })).toBeVisible();
    expect(screen.getByText(/lower calculated RN-category hours/)).toBeVisible();
    expect(screen.getByText(/12% of reported nursing hours/)).toBeVisible();
    expect(screen.getByText(/zero combined RN-category hours on 2 days/)).toBeVisible();
    expect(container.textContent).not.toMatch(/TrustHub staffing|staffing score|good|bad/i);
    expect(container.textContent).not.toContain("raw_record");
  });

  it("states when no matched staffing quarter is loaded", () => {
    render(
      <StaffingIntelligence
        intelligence={{ latest: null, history: [] }}
        cmsStaffingRating={null}
      />,
    );
    expect(screen.getByText(/No matched PBJ Daily Nurse Staffing quarter/)).toBeVisible();
  });
});
