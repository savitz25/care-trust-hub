import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const query = vi.fn();
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));

describe("published facility enrichment reads", () => {
  beforeEach(() => query.mockReset());

  it("loads only publication-eligible VERIFIED contact and name claims", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            claim_type: "google_official_website",
            resolution_state: "VERIFIED",
            publication_eligible: true,
            claim_value: "https://harborview.example",
            resolved_at: new Date("2026-08-18T15:00:00Z"),
          },
          {
            claim_type: "google_public_phone",
            resolution_state: "VERIFIED",
            publication_eligible: true,
            claim_value: "2055550100",
            resolved_at: new Date("2026-08-18T15:00:00Z"),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ resolution_state: "VERIFIED" }] });
    const { getPublishedFacilityEnrichment } = await import("./enrichment-publication");
    const published = await getPublishedFacilityEnrichment("01a193", {
      providerName: "Harborview Care And Rehab",
      telephone: "205-555-0100",
    });
    expect(query.mock.calls[0][1][0]).toBe("01A193");
    expect(query.mock.calls[0][0]).toContain("published_facility_claim");
    expect(query.mock.calls[0][0]).not.toContain("google_place_identity");
    expect(query.mock.calls[0][0]).not.toContain("google_business_status");
    expect(query.mock.calls[1][0]).not.toContain("claim_value");
    expect(published.website?.value).toBe("https://harborview.example");
    expect(published.phoneMatchesCms).toBe(true);
    expect(JSON.stringify(published)).not.toContain("ChIJ");
    expect(JSON.stringify(published)).not.toMatch(/CLOSED|OPERATIONAL/);
  });

  it("returns empty enrichment when identity is unsafe and fields are unpublished", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            claim_type: "google_official_website",
            resolution_state: "REVIEW_REQUIRED",
            publication_eligible: false,
            claim_value: "https://hidden.example",
            resolved_at: new Date("2026-08-18T15:00:00Z"),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ resolution_state: "PROBABLE" }] });
    const { getPublishedFacilityEnrichment } = await import("./enrichment-publication");
    const published = await getPublishedFacilityEnrichment("01A193", {
      providerName: "Example",
      telephone: null,
    });
    expect(published.website).toBeNull();
    expect(published.phone).toBeNull();
    expect(published.publicAlias).toBeNull();
  });
});
