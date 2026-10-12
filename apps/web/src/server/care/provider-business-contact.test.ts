import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const query = vi.fn();
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));

const publicRow = {
  provider_type: "home_health",
  provider_key: "017000",
  website_url: "https://agency.example",
  email: "hello@agency.example",
  phone_override: null,
  source_urls: ["https://agency.example"],
  source_type: "enrichment_file",
  verified_at: new Date("2026-10-01T00:00:00.000Z"),
  is_public: true,
  updated_at: new Date("2026-10-02T00:00:00.000Z"),
};

describe("getPublicProviderBusinessContact", () => {
  beforeEach(() => query.mockReset());

  it("reads a public website and email by provider type and key", async () => {
    query.mockResolvedValueOnce({ rows: [publicRow] });
    const { getPublicProviderBusinessContact } = await import("./provider-business-contact");
    const contact = await getPublicProviderBusinessContact("home_health", "017000");
    expect(query.mock.calls[0][0]).toContain("provider_business_contact");
    expect(query.mock.calls[0][0]).toContain("is_public");
    expect(query.mock.calls[0][0]).not.toContain("facility_snapshot");
    expect(query.mock.calls[0][1]).toEqual(["home_health", "017000"]);
    expect(contact?.websiteUrl).toBe("https://agency.example/");
    expect(contact?.email).toBe("hello@agency.example");
  });

  it("returns nothing when no row is present", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const { getPublicProviderBusinessContact } = await import("./provider-business-contact");
    await expect(getPublicProviderBusinessContact("hospice", "3a1001")).resolves.toBeNull();
    expect(query.mock.calls[0][1]).toEqual(["hospice", "3A1001"]);
  });

  it("returns nothing when the row is not public", async () => {
    query.mockResolvedValueOnce({ rows: [{ ...publicRow, is_public: false }] });
    const { getPublicProviderBusinessContact } = await import("./provider-business-contact");
    await expect(getPublicProviderBusinessContact("home_health", "017000")).resolves.toBeNull();
  });

  it("does not query for a key the table cannot store", async () => {
    const { getPublicProviderBusinessContact } = await import("./provider-business-contact");
    await expect(
      getPublicProviderBusinessContact("assisted_living", "015600001"),
    ).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("returns nothing when the migration has not been applied", async () => {
    query.mockRejectedValueOnce(
      Object.assign(new Error("relation does not exist"), { code: "42P01" }),
    );
    const { getPublicProviderBusinessContact } = await import("./provider-business-contact");
    await expect(getPublicProviderBusinessContact("nursing_home", "01A193")).resolves.toBeNull();
  });
});
