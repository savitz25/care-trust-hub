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

describe("facility profile server markup", () => {
  it("renders the lead paragraph and nearby facility links", () => {
    const model = buildFacilityProfile({
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
            findings: [{ id: "f1" }, { id: "f2" }],
            highestScopeSeverity: null,
            source: {} as CareRegulatoryIntelligence["inspections"][number]["source"],
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
            source: {} as CareRegulatoryIntelligence["penalties"][number]["source"],
          },
        ],
        repeatTags: [],
        timeline: [],
      } as CareRegulatoryIntelligence,
      staffing: {
        latest: { totalNurseHprd: 3.8, quarter: "2026Q1" },
        history: [],
      } as CareStaffingIntelligence,
      comparisons: {
        overallStateAverage: 3.2,
        healthStateAverage: 2.8,
        deficiencyStateAverage: 6.4,
        staffingHoursStateAverage: 3.55,
        nearby,
      },
    });
    const html = renderToStaticMarkup(<FacilityProfileView model={model} />);
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
});
