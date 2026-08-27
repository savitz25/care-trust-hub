import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  HUB_PROHIBITED_LANGUAGE,
  assertSeniorHubIntelligence,
  coverageShare,
  formatHubCount,
  type SeniorNationalIntelligence,
} from "./senior-hub-intelligence";

const payload = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../apps/web/src/data/senior-national-intelligence.json",
    ),
    "utf8",
  ),
) as SeniorNationalIntelligence;

describe("national hub intelligence contract", () => {
  it("reconciles current class denominators and geography", () => {
    const intel = assertSeniorHubIntelligence(payload);
    expect(intel.nursingHome.current).toBe(14690);
    expect(intel.homeHealth.current).toBe(12460);
    expect(intel.hospice.current).toBe(6669);
    expect(intel.hospice.evidenceOnly).toBe(242);
    expect(intel.score).toBeNull();
    expect(intel.ranking).toBeNull();
    expect(intel.combinedProviderDenominator.publishAsHeadline).toBe(false);
  });

  it("keeps CHOW unsupported for Home Health and Hospice", () => {
    expect(payload.homeHealth.chow.status).toBe("UNSUPPORTED");
    expect(payload.hospice.chow.status).toBe("UNSUPPORTED");
    expect(payload.nursingHome.chow.status).toBe("SUPPORTED");
    expect(payload.homeHealth.chow.reason).not.toMatch(/0/);
  });

  it("does not use prohibited ranking language", () => {
    const blob = JSON.stringify(payload);
    expect(blob).not.toMatch(HUB_PROHIBITED_LANGUAGE);
    expect(coverageShare(12562, 14690)).toContain("12,562 of 14,690");
    expect(formatHubCount(6669)).toBe("6,669");
  });
});
