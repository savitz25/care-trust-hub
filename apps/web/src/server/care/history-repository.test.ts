import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const query = vi.fn();
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));

describe("published facility history reads", () => {
  beforeEach(() => query.mockReset());

  it("reads only the published history view and does not join ranking inputs", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "evt-1",
            event_type: "INSPECTION_COMPLETED",
            event_family: "inspection",
            event_date: "2026-05-14",
            date_precision: "day",
            date_basis: "occurred",
            importance: "MEDIUM",
            title: "Health inspection completed",
            summary: "8 deficiencies were recorded.",
            previous_value: null,
            new_value: null,
            evidence_href: "#inspections",
            source_dataset_key: "nursing-home-inspection-dates",
            source_record_locator: "row:1",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: "1" }] });
    const { getPublishedFacilityHistory } = await import("./history-repository");
    const history = await getPublishedFacilityHistory("055001");
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain("published_facility_history_event");
    expect(query.mock.calls[0][0]).not.toContain("google_");
    expect(query.mock.calls[0][0]).not.toMatch(/overall_rating DESC/);
    expect(history.events).toHaveLength(1);
    expect(history.coverageLabel).toBe("1 historical event available");
    expect(JSON.stringify(history)).not.toMatch(/Trust Score|risk score/i);
  });

  it("returns an empty history safely for a valid CCN with no events", async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: "0" }] });
    const { getPublishedFacilityHistory } = await import("./history-repository");
    const history = await getPublishedFacilityHistory("105001");
    expect(history.events).toEqual([]);
    expect(history.emptyRecentLabel).toMatch(/No major recent changes/);
  });
});
