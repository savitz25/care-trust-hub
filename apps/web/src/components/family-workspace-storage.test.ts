import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { FAMILY_WORKSPACE_STORAGE_KEY } from "@care/domain";
import {
  addFacilityToWorkspace,
  clearFamilyWorkspace,
  familyWorkspaceCount,
  isFacilityInWorkspace,
  readFamilyWorkspace,
  removeFacilityFromWorkspace,
  updateFacilityWorkspaceAnnotation,
} from "./family-workspace-storage";

describe("family workspace browser storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists add/remove across a simulated reload", () => {
    expect(addFacilityToWorkspace("015009").ok).toBe(true);
    expect(addFacilityToWorkspace("015010").ok).toBe(true);
    expect(familyWorkspaceCount()).toBe(2);
    const reloaded = parseReload();
    expect(reloaded).toEqual(["015009", "015010"]);
    removeFacilityFromWorkspace("015009");
    expect(isFacilityInWorkspace("015009")).toBe(false);
    expect(parseReload()).toEqual(["015010"]);
  });

  it("keeps notes, stage, and quotes in localStorage only", () => {
    addFacilityToWorkspace("015009");
    updateFacilityWorkspaceAnnotation("015009", {
      researchStage: "visited_or_spoke",
      notes: "Need to ask about weekend staffing",
      quotedAmount: 380,
      quotedCadence: "daily",
    });
    const raw = localStorage.getItem(FAMILY_WORKSPACE_STORAGE_KEY) ?? "";
    expect(raw).toContain("Need to ask about weekend staffing");
    expect(raw).toContain("380");
    expect(raw).not.toMatch(/analytics|workspace_facility_/i);
    const source = readFileSync(
      path.join(process.cwd(), "src/components/family-workspace-storage.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/fetch\(|navigator\.sendBeacon|gtag|analytics/i);
    expect(source).not.toMatch(/google|GOOGLE_PLACES/i);
  });

  it("clears the workspace and recovers from corrupt storage", () => {
    addFacilityToWorkspace("015009");
    clearFamilyWorkspace();
    expect(readFamilyWorkspace().entries).toEqual([]);
    localStorage.setItem(FAMILY_WORKSPACE_STORAGE_KEY, "{bad");
    expect(readFamilyWorkspace().entries).toEqual([]);
  });
});

function parseReload(): string[] {
  return readFamilyWorkspace().entries.map((entry) => entry.id);
}
