import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RegulatoryIntelligence } from "./regulatory-intelligence";
import type { CareRegulatoryIntelligence } from "@/server/care/types";

const source = {
  sourceOrganization: "Centers for Medicare & Medicaid Services",
  datasetName: "Nursing Home Health Deficiencies",
  cmsDatasetIdentifier: "r5ix-sfxw",
  officialSourceUrl: "https://data.cms.gov/provider-data/dataset/r5ix-sfxw",
  releaseIdentifier: "2026-07-01",
  sourceModifiedAt: "2026-07-01T00:00:00.000Z",
  retrievedAt: "2026-08-14T00:00:00.000Z",
  providerIdentifier: "12A345",
  sourceRecordLocator: "row:2",
};

const intelligence: CareRegulatoryIntelligence = {
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
          officialDescription: "CMS-published description",
          scopeSeverity: {
            code: "J",
            scope: "Isolated",
            severity: "Immediate jeopardy to resident health or safety",
            severityLevel: 4,
            immediateJeopardy: true,
          },
          correctionStatus: null,
          correctionDate: null,
          underIdr: false,
          underIidr: false,
          source,
        },
      ],
      highestScopeSeverity: {
        code: "J",
        scope: "Isolated",
        severity: "Immediate jeopardy to resident health or safety",
        severityLevel: 4,
        immediateJeopardy: true,
      },
      source: {
        ...source,
        datasetName: "Nursing Home Inspection Dates",
        cmsDatasetIdentifier: "svdt-c123",
      },
    },
  ],
  penalties: [],
  repeatTags: [],
  timeline: [
    {
      id: "inspection-inspection-1",
      eventDate: "2026-06-01",
      kind: "inspection",
      title: "Health Standard",
      detail: "1 linked deficiency finding",
    },
  ],
};

describe("regulatory intelligence", () => {
  it("uses official terminology, accessible disclosure, and precise no-penalty language", () => {
    render(<RegulatoryIntelligence intelligence={intelligence} />);
    expect(screen.getByRole("heading", { name: "What CMS inspection records show" })).toBeVisible();
    expect(
      screen.getAllByText(/Immediate jeopardy to resident health or safety/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/No penalty records were found/)).toBeVisible();
    expect(screen.getAllByText("View source details").length).toBeGreaterThan(0);
    expect(screen.queryByText(/raw_record/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/failed inspection/i)).not.toBeInTheDocument();
  });
});
