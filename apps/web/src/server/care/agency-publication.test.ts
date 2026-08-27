import { describe, expect, it, vi } from "vitest";
import cohort from "@/data/agency-index-cohort.json";
import { agencyIndexCohort, isAgencyProfileIndexableForPage } from "./agency-publication";

vi.mock("server-only", () => ({}));

describe("agency index cohort", () => {
  it("contains 250 unique current-directory identities per class", () => {
    const hh = new Set(cohort.home_health.map((row) => row.ccn));
    const hospice = new Set(cohort.hospice.map((row) => row.ccn));
    expect(hh.size).toBe(250);
    expect(hospice.size).toBe(250);
    expect(hh.size + hospice.size).toBe(
      agencyIndexCohort.home_health.length + agencyIndexCohort.hospice.length,
    );
    expect(cohort.home_health.some((row) => row.ccn === "017013")).toBe(true);
    expect(cohort.hospice.some((row) => row.ccn === "001513")).toBe(true);
  });

  it("indexes a cohort member only when launch, UI, and kill-switch are on", () => {
    const env = {
      VERCEL_ENV: "production",
      CARE_ENABLE_PUBLIC_LAUNCH: "true",
      CARE_ENABLE_REAL_PROVIDER_UI: "true",
      CARE_ENABLE_HH_PROFILE_INTEL: "true",
      CARE_ENABLE_AGENCY_PROFILE_INDEX: "true",
    };
    expect(
      isAgencyProfileIndexableForPage(
        "home_health",
        {
          ccn: "017013",
          name: "CENTERWELL HOME HEALTH",
          city: "ENTERPRISE",
          state: "AL",
          directoryProjection: "CURRENT_DIRECTORY",
        },
        env,
      ),
    ).toBe(true);
    expect(
      isAgencyProfileIndexableForPage(
        "home_health",
        {
          ccn: "999999",
          name: "Eligible but not in cohort",
          city: "Town",
          state: "TX",
          directoryProjection: "CURRENT_DIRECTORY",
        },
        env,
      ),
    ).toBe(false);
  });
});
