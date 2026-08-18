import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const query = vi.fn();
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));

describe("ownership repository", () => {
  beforeEach(() => query.mockReset());

  it("returns bounded public evidence without billing or raw records", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "party-1",
            party_kind: "organization",
            organization_id: "org-1",
            display_name: "EXAMPLE LLC",
            relationship_role_code: "34",
            relationship_role_text: "DIRECT OWNERSHIP",
            association_date: "2020-01-01",
            ownership_percentage: "25.0000",
            classifications: { reit: true },
            connected_provider_count: "2",
            connected_states: ["AL"],
            source_organization: "CMS",
            dataset_name: "Skilled Nursing Facility All Owners",
            dataset_identifier: "afe44b85-cc6d-40d7-b5df-00ae8910d1d2",
            official_url: "https://data.cms.gov/owners",
            release_key: "2026-07-27",
            source_modified_at: new Date("2026-07-27T00:00:00Z"),
            retrieved_at: new Date("2026-08-15T00:00:00Z"),
            total_party_count: "82",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    const { getProviderOwnershipIntelligence } = await import("./ownership-repository");
    const result = await getProviderOwnershipIntelligence("12a345");
    expect(result.parties[0]?.ownershipPercentage).toBe(25);
    expect(result.parties[0]?.connectedProviderCount).toBe(2);
    expect(result.totalPartyCount).toBe(82);
    expect(JSON.stringify(result)).not.toMatch(/raw_record|subscription|billing|entitlement/);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain("r.raw_record->>'ORGANIZATION NAME'");
    expect(query.mock.calls[0]?.[0]).toContain("r.raw_record->>'Owner Name'");
  });

  it("validates provider identity before querying", async () => {
    const { getProviderOwnershipIntelligence } = await import("./ownership-repository");
    await expect(getProviderOwnershipIntelligence("bad")).rejects.toThrow(RangeError);
    expect(query).not.toHaveBeenCalled();
  });
});
