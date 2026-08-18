import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FAMILY_WORKSPACE_MAX_FACILITIES,
  FAMILY_WORKSPACE_NOTE_LIMIT,
  FAMILY_WORKSPACE_VERSION,
  addWorkspaceFacility,
  emptyFamilyWorkspace,
  parseFamilyWorkspace,
  removeWorkspaceFacility,
  serializeFamilyWorkspace,
  updateWorkspaceAnnotation,
  workspaceCcns,
} from "./family-workspace";

const NOW = new Date("2026-08-18T12:00:00.000Z");

describe("family workspace storage model", () => {
  it("adds, deduplicates, and removes validated CCNs", () => {
    let result = addWorkspaceFacility(emptyFamilyWorkspace(), "015009", NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyPresent).toBe(false);
    expect(workspaceCcns(result.state)).toEqual(["015009"]);

    const duplicate = addWorkspaceFacility(result.state, "015009", NOW);
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) return;
    expect(duplicate.alreadyPresent).toBe(true);
    expect(duplicate.state.entries).toHaveLength(1);

    const removed = removeWorkspaceFacility(result.state, "015009");
    expect(removed.entries).toEqual([]);
  });

  it("rejects malformed CCNs and never treats them as query fragments", () => {
    const injected = addWorkspaceFacility(emptyFamilyWorkspace(), "015009'; DROP TABLE x;--", NOW);
    expect(injected).toEqual({
      ok: false,
      reason: "invalid_ccn",
      state: emptyFamilyWorkspace(),
    });
    expect(addWorkspaceFacility(emptyFamilyWorkspace(), "bad", NOW).ok).toBe(false);
  });

  it("caps the shortlist at five facilities", () => {
    let state = emptyFamilyWorkspace();
    for (const ccn of ["015009", "015010", "015012", "055001", "335004"]) {
      const added = addWorkspaceFacility(state, ccn, NOW);
      expect(added.ok).toBe(true);
      if (added.ok) state = added.state;
    }
    expect(state.entries).toHaveLength(FAMILY_WORKSPACE_MAX_FACILITIES);
    const sixth = addWorkspaceFacility(state, "105001", NOW);
    expect(sixth).toMatchObject({ ok: false, reason: "max_reached" });
    expect(workspaceCcns(sixth.state)).not.toContain("105001");
  });

  it("recovers from corrupted localStorage and unknown versions", () => {
    expect(parseFamilyWorkspace("not-json")).toEqual(emptyFamilyWorkspace());
    expect(parseFamilyWorkspace('{"entries":[{"ccn":"nope"}]}')).toEqual(emptyFamilyWorkspace());
    expect(
      parseFamilyWorkspace(JSON.stringify({ version: "other", entries: [{ ccn: "015009" }] }))
        .entries[0]?.ccn,
    ).toBe("015009");
  });

  it("round-trips annotations locally without medical fields", () => {
    const added = addWorkspaceFacility(emptyFamilyWorkspace(), "01a193", NOW);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const updated = updateWorkspaceAnnotation(added.state, "01A193", {
      researchStage: "planning_visit",
      notes: "Liked rehab gym",
      visitNotes: "Family tour Thursday",
      quotedAmount: 420,
      quotedCadence: "daily",
    });
    const raw = serializeFamilyWorkspace(updated);
    const restored = parseFamilyWorkspace(raw);
    expect(restored.version).toBe(FAMILY_WORKSPACE_VERSION);
    expect(restored.entries[0]).toMatchObject({
      ccn: "01A193",
      researchStage: "planning_visit",
      notes: "Liked rehab gym",
      quotedAmount: 420,
      quotedCadence: "daily",
    });
    expect(raw).not.toMatch(/diagnosis|wandering|toileting|wound care/i);
  });

  it("clips oversized notes and ignores invalid quotes", () => {
    const added = addWorkspaceFacility(emptyFamilyWorkspace(), "015009", NOW);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const updated = updateWorkspaceAnnotation(added.state, "015009", {
      notes: "x".repeat(FAMILY_WORKSPACE_NOTE_LIMIT + 50),
      quotedAmount: -12,
    });
    expect(updated.entries[0]?.notes).toHaveLength(FAMILY_WORKSPACE_NOTE_LIMIT);
    expect(updated.entries[0]?.quotedAmount).toBeNull();
  });

  it("does not store regulatory snapshots in the workspace payload", () => {
    const source = readFileSync(path.join(__dirname, "family-workspace.ts"), "utf8");
    expect(source).not.toMatch(/google|GOOGLE_PLACES|place details/i);
    expect(source).not.toMatch(/staffingRating|deficiency|penalty_enforcement/i);
    expect(source).toMatch(/CCNs and user annotations only/);
  });
});
