import { describe, expect, it } from "vitest";
import {
  agencyProfileIsIndexable,
  homeHealthResearchDescription,
  hospiceResearchDescription,
  isAgencyDirectoryEligible,
} from "./agency-publication";

const cohort = {
  home_health: [
    {
      ccn: "017013",
      name: "CENTERWELL HOME HEALTH",
      city: "ENTERPRISE",
      state: "AL",
      slug: "centerwell-home-health",
    },
  ],
  hospice: [
    {
      ccn: "001513",
      name: "EXPERT HOSPICE CARE INC",
      city: "PHOENIX",
      state: "AZ",
      slug: "expert-hospice-care-inc",
    },
  ],
};

describe("agency publication eligibility", () => {
  it("accepts current-directory identity without requiring quality", () => {
    expect(
      isAgencyDirectoryEligible({
        ccn: "368489",
        name: "1 AMAZING HOME HEALTH CARE LLC",
        city: "COLUMBUS",
        state: "OH",
        directoryProjection: "CURRENT_DIRECTORY",
      }),
    ).toBe(true);
  });

  it("rejects known-not-current and evidence-only providers", () => {
    const base = {
      ccn: "001513",
      name: "Example",
      city: "Town",
      state: "AZ",
      directoryProjection: "CURRENT_DIRECTORY" as const,
    };
    expect(isAgencyDirectoryEligible({ ...base, directoryProjection: "KNOWN_NOT_CURRENT" })).toBe(
      false,
    );
    expect(isAgencyDirectoryEligible({ ...base, directoryProjection: "EVIDENCE_ONLY" })).toBe(
      false,
    );
  });

  it("indexes only launch + UI + kill-switch + cohort members", () => {
    const input = {
      kind: "home_health" as const,
      ccn: "017013",
      name: "CENTERWELL HOME HEALTH",
      city: "ENTERPRISE",
      state: "AL",
      directoryProjection: "CURRENT_DIRECTORY" as const,
      publicLaunch: true,
      profileUiEnabled: true,
      indexKillSwitchEnabled: true,
      cohort,
    };
    expect(agencyProfileIsIndexable(input)).toBe(true);
    expect(agencyProfileIsIndexable({ ...input, ccn: "017009" })).toBe(false);
    expect(agencyProfileIsIndexable({ ...input, indexKillSwitchEnabled: false })).toBe(false);
    expect(
      agencyProfileIsIndexable({
        ...input,
        kind: "hospice",
        ccn: "001513",
        directoryProjection: "EVIDENCE_ONLY",
      }),
    ).toBe(false);
  });

  it("does not claim CMS quality in descriptions when quality is missing", () => {
    expect(homeHealthResearchDescription("Example HH", "Columbus, OH", false)).toContain(
      "not reported",
    );
    expect(homeHealthResearchDescription("Example HH", "Columbus, OH", false)).not.toMatch(
      /best|review|risk score|Trust Score/i,
    );
    expect(hospiceResearchDescription("Example Hospice", "Phoenix, AZ", true)).toContain(
      "CAHPS Hospice Survey",
    );
  });
});
