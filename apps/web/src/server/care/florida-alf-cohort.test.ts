import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const query = vi.fn();
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));

import manifest from "@/data/florida-provider-publication.json";
import { FLORIDA_PHASE1_PUBLIC_COUNTS } from "@care/domain";
import { floridaPublishedAlfRecords, loadFloridaPublishedAlf } from "./florida-alf-cohort";

describe("Florida published ALF cohort loader", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("keeps the 20 manifest ALF identities and leaves adult family care out", () => {
    const records = floridaPublishedAlfRecords();
    const manifestAlf = manifest.profiles.filter((row) => row.profile_kind === "assisted-living");
    expect(records).toHaveLength(FLORIDA_PHASE1_PUBLIC_COUNTS["assisted-living"]);
    expect(records.map((row) => row.providerId).sort()).toEqual(
      manifestAlf.map((row) => row.provider_id).sort(),
    );
    const daniella = records.find((row) => row.ahcaFileNumber === "11966552");
    expect(daniella).toMatchObject({
      officialName: "DANIELLA'S CARE CENTER INC",
      path: "/florida/assisted-living/11966552/daniella-s-care-center-inc",
      facilityCounties: [],
    });
    expect(records.some((row) => row.path.includes("/adult-family-care/"))).toBe(false);
    expect(new Set(records.map((row) => row.ahcaFileNumber)).size).toBe(records.length);
  });

  it("loads facility county only for the published ALF provider ids", async () => {
    const records = floridaPublishedAlfRecords();
    const daniella = records.find((row) => row.ahcaFileNumber === "11966552");
    query.mockResolvedValueOnce({
      rows: [
        {
          provider_id: daniella?.providerId,
          geography: [
            { geography_kind: "facility_county", canonical: "Miami-Dade", raw: "Miami-Dade" },
          ],
        },
        {
          provider_id: "00000000-0000-4000-8000-000000000000",
          geography: [{ geography_kind: "facility_county", canonical: "Leon", raw: "Leon" }],
        },
      ],
    });
    const loaded = await loadFloridaPublishedAlf();
    expect(loaded.countyFilterAvailable).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, string[][]];
    expect(sql).toMatch(/payload->'geography'/);
    expect(sql).not.toMatch(/contacts|limitations|payload,/);
    expect(params[0]).toEqual(records.map((row) => row.providerId));
    expect(params[0]).not.toContain("00000000-0000-4000-8000-000000000000");
    expect(
      loaded.records.find((row) => row.ahcaFileNumber === "11966552")?.facilityCounties,
    ).toEqual(["Miami-Dade"]);
    expect(
      loaded.records.find((row) => row.ahcaFileNumber === "11966425")?.facilityCounties,
    ).toEqual([]);
    expect(loaded.records).toHaveLength(records.length);
  });

  it("keeps name and file lookup when facility county does not load", async () => {
    query.mockRejectedValueOnce(new Error("postgres://secret-host/care"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const loaded = await loadFloridaPublishedAlf();
    expect(loaded.countyFilterAvailable).toBe(false);
    expect(loaded.records).toHaveLength(FLORIDA_PHASE1_PUBLIC_COUNTS["assisted-living"]);
    expect(warn).toHaveBeenCalledWith(JSON.stringify({ event: "florida_alf_county_unavailable" }));
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/postgres:|secret-host/);
    warn.mockRestore();
  });
});
