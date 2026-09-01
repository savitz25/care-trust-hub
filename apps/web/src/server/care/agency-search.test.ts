import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const query = vi.fn();
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));

describe("current agency directory search", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("searches Home Health snapshots by CCN and name without ranking", async () => {
    query.mockResolvedValue({
      rows: [
        {
          cms_ccn: "017013",
          provider_name: "CENTERWELL HOME HEALTH",
          city: "ENTERPRISE",
          state_code: "AL",
          zip_code: "36330",
          telephone: "3345550100",
          quality_of_patient_care_star: 4,
          quality_available: true,
          experience_available: true,
          ownership_available: true,
          service_evidence_available: true,
        },
      ],
    });
    const { searchCurrentAgencies } = await import("./agency-search");
    const results = await searchCurrentAgencies({
      providerClass: "home_health",
      query: "017013",
      state: "al",
      limit: 21,
    });
    expect(results).toEqual([
      expect.objectContaining({
        ccn: "017013",
        href: "/home-health/cms/017013/centerwell-home-health",
        cmsQualityStar: 4,
      }),
    ]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("home_health_snapshot");
    expect(sql).toContain("DISTINCT ON (cms_ccn)");
    expect(sql).not.toContain("google_");
    expect(sql).not.toContain("Trust");
    expect(query.mock.calls[0][1]).toContain("017013");
    expect(query.mock.calls[0][1]).toContain("AL");
  });

  it("rejects Hospice CMS-star filters and keeps Hospice routes class-specific", async () => {
    query.mockResolvedValue({
      rows: [
        {
          cms_ccn: "001513",
          provider_name: "EXPERT HOSPICE CARE INC",
          city: "PHOENIX",
          state_code: "AZ",
          zip_code: "85016",
          telephone: null,
          quality_of_patient_care_star: null,
          quality_available: true,
          experience_available: true,
          ownership_available: false,
          service_evidence_available: true,
        },
      ],
    });
    const { searchCurrentAgencies } = await import("./agency-search");
    await expect(searchCurrentAgencies({ providerClass: "hospice", cmsStar: 4 })).rejects.toThrow(
      /Home Health/,
    );
    const results = await searchCurrentAgencies({
      providerClass: "hospice",
      query: "EXPERT HOSPICE CARE INC",
    });
    expect(results[0]?.href).toBe("/hospice/cms/001513/expert-hospice-care-inc");
    expect(results[0]?.cmsQualityStar).toBeNull();
    expect(String(query.mock.calls[0][0])).toContain("hospice_snapshot");
  });

  it("matches office ZIP rather than service ZIP by default", async () => {
    query.mockResolvedValue({ rows: [] });
    const { searchCurrentAgencies } = await import("./agency-search");
    await searchCurrentAgencies({ providerClass: "home_health", zip: "36330" });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("c.zip_code=");
    expect(sql).not.toContain("cms_agency_service_zip z WHERE z.zip");
  });
});
