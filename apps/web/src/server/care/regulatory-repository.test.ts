import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const query = vi.fn();
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));

const common = {
  ccn: "12A345",
  source_record_locator: "csv-row:2:ccn:12A345",
  source_organization: "Centers for Medicare & Medicaid Services",
  dataset_name: "Nursing Home Inspection Dates",
  official_url: "https://data.cms.gov/provider-data/dataset/svdt-c123",
  release_key: "2026-07-01",
  source_modified_at: new Date("2026-07-01T00:00:00Z"),
  retrieved_at: new Date("2026-08-14T00:00:00Z"),
};

describe("regulatory repository", () => {
  beforeEach(() => query.mockReset());

  it("maps linked findings, exact money, repeat tags, and a descending timeline", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            ...common,
            id: "i1",
            survey_date: "2026-06-01",
            survey_type: "Health Standard",
            survey_cycle: 1,
          },
          {
            ...common,
            id: "i2",
            survey_date: "2025-06-01",
            survey_type: "Health Standard",
            survey_cycle: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: ["i1", "i2"].map((inspection_event_id, index) => ({
          ...common,
          id: `d${index}`,
          inspection_event_id,
          deficiency_prefix: "F",
          deficiency_tag: "880",
          deficiency_category: null,
          official_description: "Official description",
          scope_severity_code: "D",
          deficiency_corrected: null,
          correction_date: null,
          citation_under_idr: false,
          citation_under_iidr: false,
        })),
      })
      .mockResolvedValueOnce({
        rows: [
          {
            ...common,
            id: "p1",
            penalty_date: "2026-01-01",
            penalty_type: "Fine",
            fine_amount: "1234.50",
            payment_denial_start_date: null,
            payment_denial_days: null,
          },
        ],
      });
    const { getProviderRegulatoryIntelligence } = await import("./regulatory-repository");
    const result = await getProviderRegulatoryIntelligence("12a345");
    expect(result.repeatTags).toEqual([{ tag: "F880", inspectionCount: 2 }]);
    expect(result.penalties[0]?.fineAmount).toBe("1234.50");
    expect(result.timeline.map((event) => event.eventDate)).toEqual([
      "2026-06-01",
      "2026-01-01",
      "2025-06-01",
    ]);
    expect(JSON.stringify(result)).not.toContain("raw_record");
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.every((call) => call[1][0] === "12A345")).toBe(true);
  });

  it("rejects invalid CCNs before querying and unknown CMS severity codes", async () => {
    const { getProviderRegulatoryIntelligence } = await import("./regulatory-repository");
    await expect(getProviderRegulatoryIntelligence("bad")).rejects.toThrow(RangeError);
    expect(query).not.toHaveBeenCalled();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...common,
            id: "d1",
            inspection_event_id: null,
            deficiency_prefix: "F",
            deficiency_tag: "999",
            deficiency_category: null,
            official_description: null,
            scope_severity_code: "Z",
            deficiency_corrected: null,
            correction_date: null,
            citation_under_idr: null,
            citation_under_iidr: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(getProviderRegulatoryIntelligence("12A345")).rejects.toThrow(
      "Unsupported CMS scope/severity",
    );
  });
});
