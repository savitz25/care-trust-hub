import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FAMILY_WORKSPACE_STORAGE_KEY, buildFamilyWorkspaceComparison } from "@care/domain";
import { addFacilityToWorkspace } from "./family-workspace-storage";
import { FamilyComparisonWorkspace } from "./family-comparison-workspace";

const comparison = buildFamilyWorkspaceComparison([
  {
    ccn: "015009",
    facilityName: "Example Manor",
    city: "Example",
    state: "AL",
    facilityHref: "/facility/cms/015009/example-manor",
    ratings: { overall: 3, staffing: 2, healthInspection: 3, qualityMeasure: 3 },
    cmsOwnershipType: "For profit",
    staffingQuarter: "2026Q1",
    totalNurseHprd: 3.4,
    rnHprd: 0.4,
    latestInspectionDate: "2026-01-15",
    latestInspectionDeficiencyCount: 2,
    latestPenaltyType: "Fine",
    latestFineAmount: 12000,
    chainName: null,
    chainFacilityCount: null,
    organizationName: null,
    organizationHref: null,
    organizationFacilityCount: null,
    historyEvents: [],
    historyTotalCount: 0,
    stateIntelligence: null,
  },
]);

describe("family comparison workspace", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => comparison,
      }),
    );
  });

  it("shows an empty state without login or Google", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/family-comparison-workspace.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/google|GOOGLE_PLACES|place details/i);
    expect(source).not.toMatch(/mailto:|type="email"|invite family|share live workspace/i);
    render(<FamilyComparisonWorkspace />);
    expect(screen.getByRole("heading", { name: "Family Comparison Workspace" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Search nursing facilities/i })).toHaveAttribute(
      "href",
      "/search",
    );
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("loads published evidence for a saved facility and keeps notes local", async () => {
    addFacilityToWorkspace("015009");
    render(<FamilyComparisonWorkspace interviewBuilderEnabled plannerEnabled />);
    await waitFor(() => {
      expect(screen.getAllByText("Example Manor").length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole("heading", { name: "Things that differ" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: /Build questions for this facility/i })[0],
    ).toHaveAttribute("href", "/tools/facility-tour-interview-builder?ccn=015009");
    expect(screen.getByRole("link", { name: /Compare general care costs/i })).toHaveAttribute(
      "href",
      "/tools/senior-care-cost-planner",
    );
    fireEvent.change(screen.getAllByLabelText("Your notes")[0]!, {
      target: { value: "Liked rehab gym" },
    });
    expect(localStorage.getItem(FAMILY_WORKSPACE_STORAGE_KEY)).toContain("Liked rehab gym");
    expect(fetch).toHaveBeenCalledWith(
      "/api/workspace/comparison",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
