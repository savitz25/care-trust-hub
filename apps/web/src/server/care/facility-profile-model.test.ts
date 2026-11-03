import { describe, expect, it } from "vitest";
import { buildFacilityProfile, ratingText } from "./facility-profile-model";
import type {
  CareProviderDetail,
  CareRegulatoryIntelligence,
  CareStaffingIntelligence,
} from "./types";

const provider = {
  ccn: "105678",
  providerName: "Gulf Breeze Care",
  telephone: "(850) 555-0142",
  certifiedBeds: 120,
  ratings: { overall: 4, healthInspection: 3, staffing: 5, qualityMeasure: 2 },
  location: {
    address: "100 Bay Street",
    city: "Pensacola",
    state: "FL",
    zipCode: "32501",
    county: "Escambia",
    latitude: null,
    longitude: null,
  },
} satisfies Pick<
  CareProviderDetail,
  "ccn" | "providerName" | "telephone" | "certifiedBeds" | "ratings" | "location"
>;

const regulatorySource = {
  sourceOrganization: "Centers for Medicare & Medicaid Services",
  datasetName: "CMS inspection and penalty files",
  cmsDatasetIdentifier: "test",
  officialSourceUrl: "https://data.cms.gov/",
  releaseIdentifier: "test",
  sourceModifiedAt: null,
  retrievedAt: "2026-03-12T00:00:00Z",
  providerIdentifier: "105678",
  sourceRecordLocator: "105678",
} satisfies CareRegulatoryIntelligence["inspections"][number]["source"];

function finding(
  id: string,
): CareRegulatoryIntelligence["inspections"][number]["findings"][number] {
  return {
    id,
    tag: "F689",
    category: null,
    officialDescription: null,
    scopeSeverity: {
      code: "D",
      scope: "Isolated",
      severity: "No actual harm",
      severityLevel: 2,
      immediateJeopardy: false,
    },
    correctionStatus: null,
    correctionDate: null,
    underIdr: null,
    underIidr: null,
    source: regulatorySource,
  };
}

const staffingLatest = {
  quarter: "2026Q1",
  coverageStart: "2026-01-01",
  coverageEnd: "2026-03-31",
  daysRepresented: 90,
  positiveCensusDays: 90,
  missingCensusDays: 0,
  totalNurseHprd: 3.8,
  rnHprd: null,
  lpnHprd: null,
  cnaHprd: null,
  weekdayTotalNurseHprd: null,
  weekendTotalNurseHprd: null,
  weekdayRnHprd: null,
  weekendRnHprd: null,
  contractNurseShare: null,
  zeroReportedRnDays: 0,
  formulaVersion: "test",
  source: {
    sourceOrganization: "Centers for Medicare & Medicaid Services",
    datasetName: "Payroll Based Journal",
    cmsDatasetIdentifier: "test",
    sourceVersionIdentifier: null,
    officialSourceUrl: "https://data.cms.gov/",
    releaseIdentifier: "test",
    sourceQuarter: "2026Q1",
    sourceModifiedAt: null,
    sourcePublishedAt: null,
    retrievedAt: "2026-03-12T00:00:00Z",
    providerIdentifier: "105678",
    sourceRecordLocator: "105678",
  },
} satisfies NonNullable<CareStaffingIntelligence["latest"]>;

const regulatory = {
  inspections: [
    {
      id: "i1",
      surveyDate: "2026-03-12",
      surveyType: "Health Standard",
      surveyCycle: 1,
      findings: Array.from({ length: 8 }, (_, index) => finding(String(index))),
      highestScopeSeverity: null,
      source: regulatorySource,
    },
  ],
  penalties: [
    {
      id: "p1",
      penaltyDate: "2025-11-02",
      penaltyType: "Fine",
      fineAmount: "8500",
      paymentDenialStartDate: null,
      paymentDenialDays: null,
      source: regulatorySource,
    },
  ],
  repeatTags: [],
  timeline: [],
} as CareRegulatoryIntelligence;

const staffing = {
  latest: staffingLatest,
  history: [],
} as CareStaffingIntelligence;

describe("facility profile model", () => {
  it("writes a lead from this facility's numbers and nearby links", () => {
    const model = buildFacilityProfile({
      provider,
      regulatory,
      staffing,
      comparisons: {
        overallStateAverage: 3.2,
        healthStateAverage: 2.8,
        deficiencyStateAverage: 6.4,
        staffingHoursStateAverage: 3.55,
        nearby: [
          { ccn: "105111", name: "Bay Oaks", city: "Pensacola" },
          { ccn: "105222", name: "Escambia Manor", city: "Pensacola" },
        ],
      },
    });
    expect(model.lead).toContain("Gulf Breeze Care has 120 certified beds in Pensacola, Florida.");
    expect(model.lead).toContain(
      "The CMS overall rating is 4 of 5, compared with the Florida average of 3.2.",
    );
    expect(model.lead).toContain("lists 8 deficiencies, compared with the Florida average of 6.4.");
    expect(model.lead).toContain("fine of $8,500 dated Nov 2, 2025");
    expect(model.lead).toContain(
      "Total nurse staffing is 3.80 hours per resident day in 2026Q1, compared with the Florida average of 3.55.",
    );
    expect(model.lead).not.toMatch(/n\/a|0 facilities/i);
    expect(model.nearby.map((facility) => facility.href)).toEqual([
      "/facility/cms/105111/bay-oaks",
      "/facility/cms/105222/escambia-manor",
    ]);
    expect(model.stateHref).toBe("/florida");
    expect(model.organization).toMatchObject({
      name: "Gulf Breeze Care",
      telephone: "(850) 555-0142",
      identifier: { propertyID: "CCN", value: "105678" },
    });
    expect(JSON.stringify(model.organization)).not.toContain("AggregateRating");
    expect(model.breadcrumb["@type"]).toBe("BreadcrumbList");
    expect(ratingText(null)).toBeNull();
    expect(ratingText(4)).toBe("4 of 5");
  });

  it("omits blank ratings, fines, and nearby homes", () => {
    const model = buildFacilityProfile({
      provider: {
        ...provider,
        certifiedBeds: null,
        telephone: null,
        ratings: { overall: null, healthInspection: null, staffing: null, qualityMeasure: null },
      },
      regulatory: null,
      staffing: null,
      comparisons: null,
    });
    expect(model.lead).toBe("Gulf Breeze Care is a CMS nursing home in Pensacola, Florida.");
    expect(model.nearby).toEqual([]);
    expect(model.organization.telephone).toBeUndefined();
    expect(JSON.stringify(model)).not.toMatch(/n\/a|AggregateRating|0 facilities/i);
  });
});
