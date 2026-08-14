import { describe, expect, it } from "vitest";
import { isAuthoritativeEvidence, type EvidenceAssertion } from "./index";

const base: EvidenceAssertion = {
  id: "demo",
  origin: "derived",
  value: {},
  source: {
    sourceOrganization: "Synthetic test authority",
    datasetKey: "demo",
    releaseKey: "demo-release",
    sourceRecordLocator: "row-1",
    retrievedAt: "2026-01-01T00:00:00Z",
    observedAt: null,
    transformationVersion: "test",
  },
};

describe("evidence authority", () => {
  it("does not treat derived explanations as authoritative", () =>
    expect(isAuthoritativeEvidence(base)).toBe(false));
});
