import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const query = vi.fn();
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));

describe("published organization portfolio pages", () => {
  beforeEach(() => query.mockReset());

  it("returns nothing for unpublished or thin organizations", async () => {
    query.mockResolvedValue({ rows: [] });
    const { getPublishedOrganizationPortfolio } = await import("./ownership-portfolio");
    await expect(
      getPublishedOrganizationPortfolio("11111111-1111-4111-8111-111111111111"),
    ).resolves.toBeNull();
    expect(query.mock.calls[0][0]).toContain("publication_eligible");
    expect(query.mock.calls[0][0]).not.toContain("google_");
  });

  it("loads a published portfolio without scanning raw ownership rows", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            organization_id: "11111111-1111-4111-8111-111111111111",
            display_name: "Example LLC",
            current_facility_count: 4,
            historical_facility_count: 1,
            state_count: 2,
            states: ["CA", "NY"],
            relationship_roles: ["DIRECT OWNERSHIP"],
            publication_eligible: true,
            indexable: true,
            snapshot: { overallAverage: 3.2, overallSampleSize: 4 },
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const { getPublishedOrganizationPortfolio } = await import("./ownership-portfolio");
    const page = await getPublishedOrganizationPortfolio("11111111-1111-4111-8111-111111111111");
    expect(page?.portfolio.facilityCount).toBe(4);
    expect(page?.portfolio.indexable).toBe(true);
    expect(
      query.mock.calls.some((call) => String(call[0]).includes("provider_ownership_relationship")),
    ).toBe(false);
  });
});
