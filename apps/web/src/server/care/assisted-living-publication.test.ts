import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
const isAssistedLivingIntelligenceEnabled = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));
vi.mock("./feature-flags", () => ({ isAssistedLivingIntelligenceEnabled }));

const ready = {
  identityState: "VERIFIED" as const,
  officialName: "Example RCFE",
  officialStreet: "1 Main St",
  officialCity: "Sacramento",
  officialZip: "95814",
  consumerCategory: "residential_care" as const,
  retrievedAt: "2026-08-18T00:00:00.000Z",
};

describe("assisted living consumer publication reads", () => {
  beforeEach(() => {
    query.mockReset();
    isAssistedLivingIntelligenceEnabled.mockReset();
  });

  it("fails closed while the public flag is off", async () => {
    isAssistedLivingIntelligenceEnabled.mockReturnValue(false);
    const { getPublishedAssistedLivingProvider, listPublishedAssistedLivingProviders } =
      await import("./assisted-living-publication");
    await expect(
      getPublishedAssistedLivingProvider("11111111-1111-4111-8111-111111111111"),
    ).resolves.toBeNull();
    await expect(listPublishedAssistedLivingProviders()).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it("hides closed, pending, and review-required identities from the selector", async () => {
    const { selectPublishedAssistedLivingProvider } = await import("./assisted-living-publication");
    expect(
      selectPublishedAssistedLivingProvider({
        ...ready,
        stateCode: "CA",
        licenseStatus: "CLOSED",
      }),
    ).toBeNull();
    expect(
      selectPublishedAssistedLivingProvider({
        ...ready,
        stateCode: "CA",
        licenseStatus: "PENDING",
      }),
    ).toBeNull();
    expect(
      selectPublishedAssistedLivingProvider({
        ...ready,
        identityState: "REVIEW_REQUIRED",
        stateCode: "CA",
        licenseStatus: "LICENSED",
      }),
    ).toBeNull();
    expect(
      selectPublishedAssistedLivingProvider({
        ...ready,
        stateCode: "CA",
        licenseStatus: "LICENSED",
      }),
    ).toMatchObject({ publicationState: "PUBLISHABLE_CURRENT" });
  });

  it("queries only discovery-eligible verified rows and never Google tables", async () => {
    isAssistedLivingIntelligenceEnabled.mockReturnValue(true);
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            state_code: "CA",
            regulator_code: "CA_CDSS_CCL",
            source_facility_id: "015600001",
            license_id: "015600001",
            official_name: "Example RCFE",
            official_street: "1 Main St",
            official_city: "Sacramento",
            official_state: "CA",
            official_zip: "95814",
            official_type: "RCFE",
            consumer_category: "residential_care",
            license_status: "LICENSED",
            license_status_reported: true,
            source_directory_context: "ccl_listing",
            licensed_capacity: 40,
            memory_designation: "not_reported",
            identity_state: "VERIFIED",
            publication_state: "PUBLISHABLE_CURRENT",
            discovery_eligible: true,
            retrieved_at: new Date("2026-08-18T00:00:00Z"),
            source_locator: "chhs:ccl-facilities:rcfe",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            provider_id: "11111111-1111-4111-8111-111111111111",
            role: "licensee",
            name: "Example Licensee LLC",
          },
        ],
      });
    const { getPublishedAssistedLivingProvider } = await import("./assisted-living-publication");
    const published = await getPublishedAssistedLivingProvider(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(query.mock.calls[0][0]).toContain("discovery_eligible");
    expect(query.mock.calls[0][0]).toContain("PUBLISHABLE_CURRENT");
    expect(query.mock.calls[0][0]).not.toMatch(/google|places|geocode/i);
    expect(query.mock.calls[0][0]).not.toContain("facility_snapshot");
    expect(published?.officialName).toBe("Example RCFE");
    expect(published?.organizations[0]).toEqual({
      role: "licensee",
      name: "Example Licensee LLC",
    });
    expect(JSON.stringify(published)).not.toMatch(/raw_|ingest|fingerprint/i);
  });
});
