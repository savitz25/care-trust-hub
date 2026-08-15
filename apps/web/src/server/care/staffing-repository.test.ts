import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const query = vi.fn();
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));

const row = {
  ccn: "12A345",
  source_quarter: "2026Q1",
  coverage_start: "2026-01-01",
  coverage_end: "2026-03-31",
  days_represented: 90,
  positive_census_days: 90,
  missing_census_days: 0,
  total_nurse_hprd: "3.500000",
  rn_hprd: "0.750000",
  lpn_hprd: "0.650000",
  cna_hprd: "1.900000",
  weekday_total_nurse_hprd: "3.600000",
  weekend_total_nurse_hprd: "3.200000",
  weekday_rn_hprd: "0.800000",
  weekend_rn_hprd: "0.600000",
  contract_nurse_share: "0.12000000",
  zero_reported_rn_days: 2,
  formula_version: "pbj-quarter-ratio-of-sums-v1",
  source_record_locator: "derived:quarter:2026Q1",
  source_organization: "Centers for Medicare & Medicaid Services (CMS)",
  dataset_name: "Payroll Based Journal Daily Nurse Staffing",
  official_url: "https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing",
  release_key: "2026-07-29",
  source_version_identifier: "6e5d5e28-66fd-41bc-a36c-db54dcbffd3e",
  source_modified_at: new Date("2026-07-29T00:00:00Z"),
  source_published_at: null,
  retrieved_at: new Date("2026-08-14T00:00:00Z"),
};

describe("staffing repository", () => {
  beforeEach(() => query.mockReset());

  it("returns bounded consumer-safe multi-quarter summaries", async () => {
    query.mockResolvedValueOnce({ rows: [row, { ...row, source_quarter: "2025Q4" }] });
    const { getProviderStaffingSummary } = await import("./staffing-repository");
    const result = await getProviderStaffingSummary("12a345");
    expect(result.latest?.quarter).toBe("2026Q1");
    expect(result.latest?.totalNurseHprd).toBe(3.5);
    expect(result.latest?.contractNurseShare).toBe(0.12);
    expect(result.history).toHaveLength(2);
    expect(result.latest?.source.sourceVersionIdentifier).toBe(
      "6e5d5e28-66fd-41bc-a36c-db54dcbffd3e",
    );
    expect(JSON.stringify(result)).not.toMatch(/raw_record|CARE_DATABASE_URL/);
    expect(query.mock.calls[0]?.[1]).toEqual(["12A345", 8]);
  });

  it("bounds history and validates CCN and quarter before querying", async () => {
    const { getProviderDailyStaffing, getProviderStaffingHistory } = await import(
      "./staffing-repository"
    );
    await expect(getProviderStaffingHistory("bad")).rejects.toThrow(RangeError);
    await expect(getProviderStaffingHistory("12A345", 100)).rejects.toThrow(RangeError);
    await expect(getProviderDailyStaffing("12A345", "2026Q5")).rejects.toThrow(RangeError);
    expect(query).not.toHaveBeenCalled();
  });

  it("returns at most one quarter of safe daily calculations", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          work_date: "2026-01-03",
          resident_census: 10,
          total_nurse_hprd: "3.500000",
          rn_hprd: "0.750000",
          lpn_hprd: "0.650000",
          cna_hprd: "1.900000",
          is_weekend: true,
        },
      ],
    });
    const { getProviderDailyStaffing } = await import("./staffing-repository");
    const result = await getProviderDailyStaffing("12A345", "2026Q1");
    expect(result).toEqual([
      {
        workDate: "2026-01-03",
        residentCensus: 10,
        totalNurseHprd: 3.5,
        rnHprd: 0.75,
        lpnHprd: 0.65,
        cnaHprd: 1.9,
        isWeekend: true,
      },
    ]);
    expect(query.mock.calls[0]?.[1]).toEqual(["12A345", "2026Q1"]);
  });
});
