import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const query = vi.fn();
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));

describe("cms source freshness repository", () => {
  beforeEach(() => query.mockReset());

  it("maps per-source rows and does not invent a global last-updated date", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          dataset_key: "nursing-home-provider-information",
          display_name: "Provider Information",
          cms_identifier: "4pq5-n9py",
          refresh_cadence: "MONTHLY",
          check_frequency: "DAILY",
          freshness_sla_days: 45,
          current_release: "2026-07-29",
          source_modified_at: new Date("2026-07-29T00:00:00Z"),
          source_period: null,
          retrieved_at: new Date("2026-08-14T00:00:00Z"),
          last_success_at: new Date("2026-08-26T00:00:00Z"),
          last_ingest_status: "succeeded",
          freshness_band: "CURRENT",
          age_days: "28.0",
          last_source_run_status: "NO_CHANGE",
          last_failure_at: null,
          last_healthy_status: "NO_CHANGE",
          official_url: "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
        },
        {
          dataset_key: "payroll-based-journal-daily-nurse-staffing",
          display_name: "Payroll Based Journal Daily Nurse Staffing",
          cms_identifier: "7e0d53ba-8f02-4c66-98a5-14a1c997c50d",
          refresh_cadence: "QUARTERLY",
          check_frequency: "WEEKLY",
          freshness_sla_days: 120,
          current_release: "2026Q1",
          source_modified_at: new Date("2026-07-29T00:00:00Z"),
          source_period: "2026Q1",
          retrieved_at: new Date("2026-08-14T00:00:00Z"),
          last_success_at: new Date("2026-08-26T00:00:00Z"),
          last_ingest_status: "succeeded",
          freshness_band: "CURRENT",
          age_days: "28.0",
          last_source_run_status: "NO_CHANGE",
          last_failure_at: null,
          last_healthy_status: "NO_CHANGE",
          official_url:
            "https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing",
        },
      ],
    });
    const { loadCmsSourceFreshness } = await import("./cms-source-freshness");
    const rows = await loadCmsSourceFreshness();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.datasetKey).toBe("nursing-home-provider-information");
    expect(rows[0]?.freshnessBand).toBe("CURRENT");
    expect(rows[1]?.sourcePeriod).toBe("2026Q1");
    expect(rows[0]?.sourceModifiedAt).not.toBe(rows[1]?.sourcePeriod);
    expect(query.mock.calls[0]?.[0]).toContain("cms_source_freshness");
    expect(query.mock.calls[0]?.[0]).not.toContain("last updated");
  });
});
