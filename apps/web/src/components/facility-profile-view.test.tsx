import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildFacilityProfile } from "@/server/care/facility-profile-model";
import type {
  CareProviderDetail,
  CareRegulatoryIntelligence,
  CareStaffingIntelligence,
} from "@/server/care/types";
import { FacilityProfileView } from "./facility-profile-view";

const nearby = Array.from({ length: 6 }, (_, index) => ({
  ccn: String(105200 + index),
  name: `Pensacola Home ${index}`,
  city: "Pensacola",
}));

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

function profile(homes: typeof nearby) {
  return buildFacilityProfile({
    provider: {
      ccn: "105678",
      providerName: "Gulf Breeze Care",
      telephone: "(850) 555-0142",
      certifiedBeds: 120,
      ratings: { overall: 4, healthInspection: 3, staffing: 5, qualityMeasure: null },
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
    >,
    regulatory: {
      inspections: [
        {
          id: "i1",
          surveyDate: "2026-03-12",
          surveyType: "Health Standard",
          surveyCycle: 1,
          findings: [finding("f1"), finding("f2")],
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
    } as CareRegulatoryIntelligence,
    staffing: {
      latest: staffingLatest,
      history: [],
    } as CareStaffingIntelligence,
    comparisons: {
      overallStateAverage: 3.2,
      healthStateAverage: 2.8,
      deficiencyStateAverage: 6.4,
      staffingHoursStateAverage: 3.55,
      nearby: homes,
    },
  });
}

describe("facility profile server markup", () => {
  it("renders the lead paragraph and nearby facility links", () => {
    const html = renderToStaticMarkup(<FacilityProfileView model={profile(nearby)} />);
    expect(html).toContain("Gulf Breeze Care has 120 certified beds in Pensacola, Florida.");
    expect(html).toContain("4 of 5");
    expect(html).toContain('href="/facility/cms/105200/pensacola-home-0"');
    expect(html).toContain('href="/facility/cms/105205/pensacola-home-5"');
    expect(html).toContain('href="/florida"');
    expect(html).toContain('"@type":["NursingHome","MedicalOrganization"]');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"propertyID":"CCN"');
    expect(html).not.toContain("AggregateRating");
    expect(html).not.toContain("★");
    expect(html).not.toContain("☆");
    expect(html).not.toMatch(/0 facilities|n\/a/i);
  });

  it("omits nearby facilities unless five to ten CMS profiles are linked", () => {
    const hidden = renderToStaticMarkup(
      <FacilityProfileView model={profile(nearby.slice(0, 4))} />,
    );
    expect(hidden).toContain("Gulf Breeze Care has 120 certified beds in Pensacola, Florida.");
    expect(hidden).not.toContain("Nearby facilities");
    expect(hidden).not.toContain('href="/facility/cms/105200/pensacola-home-0"');
    expect(hidden).toContain('href="/florida"');
    expect(hidden).toContain('"@type":["NursingHome","MedicalOrganization"]');

    const shown = renderToStaticMarkup(<FacilityProfileView model={profile(nearby.slice(0, 5))} />);
    expect(shown).toContain("Nearby facilities");
    expect(shown).toContain('href="/facility/cms/105204/pensacola-home-4"');
  });
});
