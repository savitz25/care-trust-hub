import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  CareProviderDetail,
  CareProviderSearchResult,
  CareRegulatoryIntelligence,
  CareStaffingIntelligence,
} from "@/server/care/types";
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
const regulatorySource = {
  sourceOrganization: source.sourceOrganization,
  datasetName: "Nursing Home Inspection Dates",
  cmsDatasetIdentifier: "inspection-dataset",
  officialSourceUrl: "https://data.cms.gov/inspection-dataset",
  releaseIdentifier: "inspection-release",
  sourceModifiedAt: "2026-07-20T00:00:00.000Z",
  retrievedAt: "2026-08-13T00:00:00.000Z",
  providerIdentifier: provider.ccn,
  sourceRecordLocator: "source-row",
};
const regulatory: CareRegulatoryIntelligence = {
  inspections: [
    {
      id: "inspection-1",
      surveyDate: "2026-06-01",
      surveyType: "Health Standard",
      surveyCycle: 1,
      findings: [
        {
          id: "finding-1",
          tag: "F880",
          category: "Infection Control",
          officialDescription: "CMS description",
          scopeSeverity: {
            code: "D",
            scope: "Isolated",
            severity: "No actual harm with potential for more than minimal harm",
            severityLevel: 2,
            immediateJeopardy: false,
          },
          correctionStatus: null,
          correctionDate: null,
          underIdr: false,
          underIidr: false,
          source: {
            ...regulatorySource,
            datasetName: "Nursing Home Health Deficiencies",
            cmsDatasetIdentifier: "deficiency-dataset",
          },
        },
      ],
      highestScopeSeverity: null,
      source: regulatorySource,
    },
  ],
  penalties: [
    {
      id: "penalty-1",
      penaltyDate: "2026-05-01",
      penaltyType: "Fine",
      fineAmount: "1000.00",
      paymentDenialStartDate: null,
      paymentDenialDays: null,
      source: {
        ...regulatorySource,
        datasetName: "Nursing Home Penalties",
        cmsDatasetIdentifier: "penalty-dataset",
      },
    },
  ],
  repeatTags: [],
  timeline: [],
};
const staffingSource = {
  sourceOrganization: source.sourceOrganization,
  datasetName: "Payroll Based Journal Daily Nurse Staffing",
  cmsDatasetIdentifier: "pbj-dataset",
  sourceVersionIdentifier: "pbj-version",
  officialSourceUrl: "https://data.cms.gov/pbj-dataset",
  releaseIdentifier: "pbj-release",
  sourceQuarter: "2026Q1",
  sourceModifiedAt: "2026-07-29T00:00:00.000Z",
  sourcePublishedAt: null,
  retrievedAt: "2026-08-14T00:00:00.000Z",
  providerIdentifier: provider.ccn,
  sourceRecordLocator: "derived-quarter",
};
const staffingSummary = {
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
  contractNurseShare: 0.1,
  zeroReportedRnDays: 0,
  formulaVersion: "formula-v1",
  source: staffingSource,
};
const staffing: CareStaffingIntelligence = { latest: staffingSummary, history: [staffingSummary] };

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

  it("renders truthful preview copy, complete sources, and working section anchors", () => {
    const { container } = render(
      <RealProviderDetail provider={detailProvider} regulatory={regulatory} staffing={staffing} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Mapped Provider" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CMS rating overview" })).toBeInTheDocument();
    expect(screen.getByText(/No proprietary TrustHub score/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Save to shortlist" })).toHaveAttribute(
      "href",
      "/shortlist",
    );
    expect(
      screen.getByRole("navigation", { name: "Facility record sections" }),
    ).toBeInTheDocument();
    expect(screen.getByText("CMS reports a 5-star staffing rating.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What to review" })).toBeInTheDocument();
    expect(
      screen.getByText(/RN staffing was 0.75 hours per resident day in 2026Q1/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/latest standard inspection on Jun 1, 2026 cited 1 deficiencies/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/combines verified CMS datasets and transparent calculations/),
    ).toBeVisible();
    expect(container.textContent).not.toContain("Provider Information fields only");
    expect(container.textContent).not.toContain("Detailed staffing trends");
    expect(container.textContent).not.toContain("Evidence layers still being integrated");
    expect(container.querySelector(".future-source-list")).not.toHaveTextContent(
      "Facility history",
    );
    for (const dataset of [
      "Nursing Home Provider Information",
      "Nursing Home Inspection Dates",
      "Nursing Home Health Deficiencies",
      "Nursing Home Penalties",
      "Payroll Based Journal Daily Nurse Staffing",
    ]) {
      expect(screen.getAllByText(dataset).length).toBeGreaterThan(0);
    }
    const sectionNav = screen.getByRole("navigation", { name: "Facility record sections" });
    for (const [name, href] of [
      ["Overview", "#overview"],
      ["Inspections", "#inspections"],
      ["Penalties", "#penalties"],
      ["History", "#history"],
      ["Staffing", "#staffing"],
      ["Sources", "#sources"],
    ]) {
      expect(sectionNav.querySelector(`a[href="${href}"]`)).toHaveTextContent(name);
      expect(container.querySelector(href)).toBeInTheDocument();
    }
    expect(container.textContent).not.toMatch(/TrustHub staffing rating|staffing score/i);
    expect(container.textContent).not.toContain("raw_record");
  });
});
