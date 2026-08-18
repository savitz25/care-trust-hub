import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const query = vi.fn();
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));

describe("published state intelligence reads", () => {
  beforeEach(() => query.mockReset());

  it("loads only the published_state_claim view for CA/NY/TX", async () => {
    query.mockResolvedValue({
      rows: [
        {
          claim_type: "STATE_LICENSE_ID",
          resolution_state: "VERIFIED",
          claim_value: "10000102",
          resolved_at: new Date("2026-08-18T17:00:00Z"),
        },
        {
          claim_type: "STATE_LICENSE_STATUS",
          resolution_state: "VERIFIED",
          claim_value: "ACTIVE",
          resolved_at: new Date("2026-08-18T17:00:00Z"),
        },
      ],
    });
    const { getPublishedStateIntelligence } = await import("./state-publication");
    const published = await getPublishedStateIntelligence("555120", "CA");
    expect(query.mock.calls[0][0]).toContain("published_state_claim");
    expect(query.mock.calls[0][0]).not.toContain("google_");
    expect(published?.licenseId?.value).toBe("10000102");
    expect(published?.licenseStatus?.value).toBe("ACTIVE");
    expect(published?.regulator).toContain("California");
  });

  it("returns nothing for unsupported states without querying unsafe tables as ranking inputs", async () => {
    const { getPublishedStateIntelligence } = await import("./state-publication");
    const published = await getPublishedStateIntelligence("105402", "FL");
    expect(published).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });
});
