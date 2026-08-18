import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { PublishedFacilityInterviewEvidence } from "@care/domain";
import { FacilityInterviewBuilder } from "./facility-interview-builder";
import {
  INTERVIEW_BUILDER_SEED_KEY,
  mapNavigatorSettingToInterview,
  storeInterviewBuilderSeed,
} from "./interview-builder-bridge";

const staffingDecline: PublishedFacilityInterviewEvidence = {
  facilityName: "Example Manor",
  ccn: "01A193",
  cmsStaffingRating: 2,
  latestStaffingChangeDirection: "decrease",
  hasRecentInspectionDeficiencies: false,
  recentInspectionCount: 0,
  hasRecentCmsPenalty: true,
  recentPenaltyCount: 1,
  hasRecentOwnershipChange: false,
  isMultiFacilityOrganization: false,
  organizationFacilityCount: 1,
  hasPublishedStateEnforcement: false,
  stateEnforcementRegulator: null,
  hasPublishedNyComplaintInspection: false,
};

function createChecklist(options?: { settingName?: string; facility?: boolean }) {
  render(
    <FacilityInterviewBuilder
      facilityName={options?.facility ? "Example Manor" : null}
      facilityCcn={options?.facility ? "01A193" : null}
      facilityHref={options?.facility ? "/facility/cms/01A193/example-manor" : null}
      facilityEvidence={options?.facility ? staffingDecline : null}
    />,
  );
  if (options?.settingName) {
    fireEvent.click(screen.getByLabelText(options.settingName));
  }
  fireEvent.click(screen.getByRole("button", { name: "Create checklist" }));
}

describe("facility interview builder", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("has no Google Places, login, lead capture, or score", () => {
    const source = [
      readFileSync(
        path.join(process.cwd(), "src/components/facility-interview-builder.tsx"),
        "utf8",
      ),
      readFileSync(path.join(process.cwd(), "src/components/interview-builder-bridge.ts"), "utf8"),
    ].join("\n");
    expect(source).not.toMatch(/google|GOOGLE_PLACES|place details|text search/i);
    expect(source).not.toMatch(/mailto:|type="email"|lead capture/i);
    expect(source).not.toMatch(/interview score|tour score|risk score/i);
  });

  it("builds a generic skilled-nursing checklist with must-ask groups and print", () => {
    createChecklist();
    expect(
      screen.getByRole("heading", { name: /Your care-provider interview checklist/i }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Must ask" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Important follow-ups" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeVisible();
    expect(screen.getByText(/does not create a score/i)).toBeVisible();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("discloses that assisted living checklists are general guidance", () => {
    createChecklist({ settingName: "Assisted living" });
    expect(
      screen.getByText(
        /does not yet provide equivalent national provider evidence for assisted living\/memory care/i,
      ),
    ).toBeVisible();
  });

  it("adds facility-record questions with evidence links and no accusation", () => {
    createChecklist({ facility: true });
    expect(screen.getByRole("heading", { name: "Questions for Example Manor" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /Questions based on this facility's public record/i }),
    ).toBeVisible();
    expect(screen.getByText(/CMS data shows nurse staffing declined/i)).toBeVisible();
    expect(screen.getAllByRole("link", { name: /View staffing history/i })[0]).toHaveAttribute(
      "href",
      "/facility/cms/01A193/example-manor#staffing",
    );
    expect(screen.getByRole("link", { name: /View penalties/i })).toHaveAttribute(
      "href",
      "/facility/cms/01A193/example-manor#penalties",
    );
    expect(screen.queryByText(/red flag|dangerous facility|bad owner/i)).not.toBeInTheDocument();
  });

  it("lets a user hide a question and restore it", () => {
    createChecklist();
    const hideButtons = screen.getAllByRole("button", { name: "Hide this question" });
    fireEvent.click(hideButtons[0]!);
    expect(screen.getByRole("button", { name: /Restore hidden questions/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Restore hidden questions/ }));
    expect(
      screen.queryByRole("button", { name: /Restore hidden questions/ }),
    ).not.toBeInTheDocument();
  });

  it("maps navigator settings and stores only a coarse seed", () => {
    expect(mapNavigatorSettingToInterview(["skilled_nursing", "home_care"])).toBe(
      "skilled_nursing",
    );
    storeInterviewBuilderSeed({ setting: "memory_care", concerns: ["cost"] });
    expect(sessionStorage.getItem(INTERVIEW_BUILDER_SEED_KEY)).toBe(
      JSON.stringify({ setting: "memory_care", concerns: ["cost"] }),
    );
    expect(sessionStorage.getItem(INTERVIEW_BUILDER_SEED_KEY)).not.toMatch(
      /wandering|toileting|wound|\$|dollar/i,
    );
  });

  it("can check a question without creating a facility rating", () => {
    createChecklist();
    const firstCheckbox = screen.getAllByRole("checkbox")[0];
    expect(firstCheckbox).toBeDefined();
    fireEvent.click(firstCheckbox!);
    expect(firstCheckbox).toBeChecked();
    expect(screen.queryByText(/readiness score|interview score/i)).not.toBeInTheDocument();
  });
});

describe("interview builder why-ask", () => {
  it("exposes why-ask as expandable content", () => {
    createChecklist();
    const why = screen.getAllByText("Why ask?")[0];
    expect(why).toBeVisible();
    fireEvent.click(why);
    const details = why.closest("details");
    expect(details).not.toBeNull();
    expect(details).toHaveAttribute("open");
    expect(details?.querySelector("p")?.textContent?.length).toBeGreaterThan(0);
  });
});
