import { describe, expect, it } from "vitest";
import { formatEvidenceDate, formatFreshnessLabels, formatMissingCmsValue } from "./freshness";

describe("CMS freshness and missingness language", () => {
  it("distinguishes source modification from retrieval", () => {
    expect(
      formatFreshnessLabels({
        sourceModifiedAt: "2026-07-29T00:00:00.000Z",
        sourcePublishedAt: null,
        retrievedAt: "2026-08-14T12:00:00.000Z",
        ingestCompletedAt: "2026-08-14T12:05:00.000Z",
      }),
    ).toEqual({
      sourceUpdated: "CMS source updated July 29, 2026",
      retrieved: "Retrieved by Ask Trust Hub August 14, 2026",
    });
  });

  it("does not manufacture dates or values", () => {
    expect(formatEvidenceDate(null)).toBe("Not documented by CMS");
    expect(formatMissingCmsValue(null)).toBe("Not available in this CMS release");
    expect(formatMissingCmsValue(0)).toBe("0");
  });
});
