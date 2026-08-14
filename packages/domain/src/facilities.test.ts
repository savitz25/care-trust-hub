import { describe, expect, it } from "vitest";
import {
  getComparisonObservations,
  getEvidenceDimensions,
  getQuestionsToAsk,
  getStandoutObservations,
  syntheticFacilities,
} from "./facilities";

describe("synthetic facility fixtures", () => {
  it("uses unique fictional slugs and explicit demo sources", () => {
    expect(syntheticFacilities).toHaveLength(10);
    expect(new Set(syntheticFacilities.map(({ slug }) => slug)).size).toBe(10);
    for (const facility of syntheticFacilities) {
      expect(facility.source.record).toMatch(/fictional demo/i);
      expect(facility.source.release).toMatch(/demonstration/i);
    }
  });

  it("creates transparent dimensions without a proprietary score", () => {
    const dimensions = getEvidenceDimensions(syntheticFacilities[0]);
    expect(dimensions.map(({ label }) => label)).toContain("Staffing");
    expect(dimensions.map(({ label }) => label)).not.toContain("Care score");
  });

  it("derives standouts and questions from structured evidence", () => {
    const willow = syntheticFacilities.find(({ slug }) => slug === "willow-harbor")!;
    expect(getStandoutObservations(willow).map(({ category }) => category)).toContain(
      "Enforcement",
    );
    expect(
      getQuestionsToAsk(willow)
        .map(({ evidence }) => evidence)
        .join(" "),
    ).toMatch(/penalty/i);
  });

  it("generates one deterministic comparison observation per facility", () => {
    const selected = syntheticFacilities.slice(0, 3);
    expect(getComparisonObservations(selected)).toHaveLength(selected.length);
    expect(getComparisonObservations(selected)).toEqual(getComparisonObservations(selected));
  });
});
