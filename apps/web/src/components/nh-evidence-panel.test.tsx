import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NursingHomeEvidencePanel } from "./nh-evidence-panel";
import type { CareNhEvidence } from "@/server/care/types";

const evidence: CareNhEvidence = {
  directoryStatus: "CURRENT_ACTIVE",
  directoryNotes: "Listed in current PI.",
  designations: [
    {
      kind: "special_focus",
      officialStatus: "SFF_CANDIDATE",
      rawOfficialValue: "SFF Candidate",
      sourceField: "Special Focus Status",
      reportingPeriod: "2026-07-29",
      observedAt: "2026-07-29T00:00:00.000Z",
    },
    {
      kind: "abuse_icon",
      officialStatus: "DESIGNATED",
      rawOfficialValue: "Y",
      sourceField: "Abuse Icon",
      reportingPeriod: "2026-07-29",
      observedAt: "2026-07-29T00:00:00.000Z",
    },
  ],
  enrollmentNpis: [{ npi: "1234567890", enrollmentId: "O1", multipleNpiFlag: false }],
  mdsMeasures: [
    {
      measureCode: "401",
      officialName: "Pressure ulcers",
      stayType: "Long Stay",
      fourQuarterAverage: "2.2",
      suppressed: false,
      footnote: null,
      usedInFiveStarRating: true,
      measurePeriod: "2025Q1-2025Q4",
    },
  ],
  fireCitations: [],
  freshness: {
    providerInformationObservedAt: "2026-07-29T00:00:00.000Z",
    mdsRelease: "2026-08-01",
    fireRelease: null,
  },
};

describe("NursingHomeEvidencePanel", () => {
  it("does not render an SFF candidate as an SFF designation", () => {
    render(<NursingHomeEvidencePanel evidence={evidence} />);
    expect(screen.getByText("Special Focus Facility candidate")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Special Focus Facility" })).toBeNull();
    expect(screen.getByText(/not the same as being designated a Special Focus Facility/)).toBeInTheDocument();
  });

  it("does not call the abuse icon an abusive facility", () => {
    render(<NursingHomeEvidencePanel evidence={evidence} />);
    expect(screen.getAllByText(/abuse-icon designation/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/abusive facility/i)).toBeNull();
  });

  it("does not label enrollment NPI as facility NPI", () => {
    render(<NursingHomeEvidencePanel evidence={evidence} />);
    expect(screen.getByText(/Medicare enrollment organization NPI/)).toBeInTheDocument();
    expect(screen.queryByText("Facility NPI")).toBeNull();
  });

  it("keeps MDS measures distinct from star ratings", () => {
    render(<NursingHomeEvidencePanel evidence={evidence} />);
    expect(screen.getByText(/not the CMS quality-measure star rating/)).toBeInTheDocument();
  });
});
