import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSeniorHubIntelligence } = await import("./senior-hub-intelligence");

describe("senior hub intelligence loader", () => {
  it("loads the published snapshot without a score field", () => {
    const intel = getSeniorHubIntelligence();
    expect(intel.nursingHome.current).toBe(14690);
    expect(intel.score).toBeNull();
    expect(intel.homeHealth.chow.status).toBe("UNSUPPORTED");
  });
});
