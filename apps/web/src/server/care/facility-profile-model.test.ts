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

const regulatory = {
  inspections: [
    {
      id: "i1",
      surveyDate: "2026-03-12",
      surveyType: "Health Standard",
      surveyCycle: 1,
      findings: Array.from({ length: 8 }, (_, index) => ({ id: String(index) })),
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
} as CareRegulatoryIntelligence;

const staffing = {
  latest: { totalNurseHprd: 3.8, quarter: "2026Q1" },
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
