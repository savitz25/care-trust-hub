import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const query = vi.fn();
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));

const row = {
  provider_id: "provider-1",
  ccn: "01A193",
  provider_name: "Provider name from database",
  legal_business_name: null,
  address: "1 Example Street",
  city: "Example City",
  state_code: "AL",
  zip_code: "35004",
  county_name: "Example County",
  telephone: null,
  ownership_type: "Non profit - Corporation",
  certified_beds: null,
  participation_type: "Medicare and Medicaid",
  participates_medicare: true,
  participates_medicaid: true,
  overall_rating: null,
  health_inspection_rating: 3,
  staffing_rating: 4,
  quality_measure_rating: 5,
  source_latitude: 33.5,
  source_longitude: -86.8,
  release_key: "2026-07-29",
  source_modified_at: new Date("2026-07-29T00:00:00Z"),
  source_published_at: null,
  source_retrieved_at: new Date("2026-08-14T00:00:00Z"),
  source_organization: "Centers for Medicare & Medicaid Services (CMS)",
  dataset_name: "Nursing Home Provider Information",
  official_url: "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
  source_record_locator: "csv-row:2:ccn:01A193",
  transformation_version: "provider-information-v2",
  ingest_completed_at: new Date("2026-08-14T00:10:00Z"),
};

describe("server-only care repository", () => {
  beforeEach(() => query.mockReset());

  it("maps an alphanumeric CCN without exposing raw records and preserves nulls", async () => {
    query.mockResolvedValue({ rows: [row] });
    const { getProviderByCcn } = await import("./repository");
    const provider = await getProviderByCcn("01a193");
    expect(query.mock.calls[0][1]).toEqual(["01A193"]);
    expect(provider?.ratings.overall).toBeNull();
    expect(provider?.certifiedBeds).toBeNull();
    expect(provider?.source.sourceRecordLocator).toBe("csv-row:2:ccn:01A193");
    expect(JSON.stringify(provider)).not.toContain("raw_record");
    expect(query.mock.calls[0][0]).toContain("ir.status='succeeded'");
    expect(query.mock.calls[0][0]).toContain("sr.source_modified_at DESC NULLS LAST");
    expect(query.mock.calls[0][0]).not.toContain("sr.created_at");
  });

  it("bounds state and development searches", async () => {
    query.mockResolvedValue({ rows: [row] });
    const { getProvidersByState, searchProvidersDevelopmentOnly } = await import("./repository");
    await getProvidersByState("al", 10);
    expect(query.mock.calls[0][1]).toEqual(["AL", 10]);
    await searchProvidersDevelopmentOnly({
      query: "Provider",
      state: "al",
      city: "Example",
      zip: "35004",
      limit: 5,
    });
    expect(query.mock.calls[1][1]).toEqual(["", "%Provider%", "AL", "%Example%", "35004", 5]);
    await expect(getProvidersByState("Alabama", 10)).rejects.toThrow(RangeError);
    await expect(searchProvidersDevelopmentOnly({ limit: 51 })).rejects.toThrow(RangeError);
  });

  it("validates radius inputs before querying and returns miles", async () => {
    query.mockResolvedValue({ rows: [{ ...row, distance_miles: 2.25 }] });
    const { providersWithinRadius } = await import("./repository");
    await expect(providersWithinRadius(91, 0, 5)).rejects.toThrow(RangeError);
    await expect(providersWithinRadius(0, 181, 5)).rejects.toThrow(RangeError);
    await expect(providersWithinRadius(0, 0, 251)).rejects.toThrow(RangeError);
    const result = await providersWithinRadius(33.5, -86.8, 10, 5);
    expect(result[0]?.distanceMiles).toBe(2.25);
    expect(query.mock.calls[0][1]).toEqual([33.5, -86.8, 10, 5]);
  });

  it("builds a bounded consumer query from approved filters only", async () => {
    query.mockResolvedValue({ rows: [row] });
    const { searchProvidersConsumer } = await import("./repository");
    const results = await searchProvidersConsumer({
      query: "01a193",
      state: "al",
      zip: "35004",
      overallRating: 5,
      staffingRating: 4,
      healthInspectionRating: 3,
      ownership: "non profit",
      medicare: true,
      medicaid: true,
      sort: "cms-overall-desc",
      limit: 25,
    });
    expect(results[0]?.ccn).toBe("01A193");
    expect(JSON.stringify(results)).not.toContain("raw_record");
    expect(query.mock.calls[0][1]).toEqual([
      "01A193",
      "%01a193%",
      "AL",
      "35004",
      5,
      4,
      3,
      "%non profit%",
      true,
      true,
      25,
    ]);
    await expect(searchProvidersConsumer({ overallRating: 0 })).rejects.toThrow(RangeError);
    await expect(searchProvidersConsumer({ sort: "distance" })).rejects.toThrow(RangeError);
  });
});
