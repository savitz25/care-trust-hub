import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const run = process.env.CARE_DATABASE_URL ? describe : describe.skip;

run("family workspace bounded comparison read", () => {
  afterAll(async () => {
    const { closeCareDatabasePool } = await import("./db");
    await closeCareDatabasePool();
  });

  it("loads five facilities without multiplying connections", async () => {
    const { loadFamilyWorkspaceComparison } = await import("./family-workspace-repository");
    const comparison = await loadFamilyWorkspaceComparison([
      "015009",
      "015010",
      "015012",
      "01A193",
      "105001",
    ]);
    expect(comparison.facilities.length).toBeGreaterThan(0);
    expect(comparison.facilities.length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(comparison)).not.toMatch(/EMAXCONNSESSION|google_|workspace score/i);
  });
});
