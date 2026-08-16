import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { applyReviewedTrustHubOverride, validateTrustRequest } from "./trust-participation";

const valid = {
  requestType: "profile_claim",
  ccn: "01a193",
  organizationId: "19a83c7f-6432-4a1f-844b-fcbfe2badc52",
  submitterName: "Casey Reviewer",
  submitterRole: "Administrator",
  submitterOrganization: "Example Organization",
  submitterEmail: " CASEY@EXAMPLE.ORG ",
  description: "I am requesting a manual review of this profile relationship.",
  evidenceLinks: ["https://example.org/about"],
};

describe("trust participation validation", () => {
  it("normalizes bounded claim input without changing its evidence type", () => {
    const result = validateTrustRequest(valid);
    expect(result.errors).toEqual([]);
    expect(result.value).toMatchObject({
      requestType: "profile_claim",
      ccn: "01A193",
      organizationId: valid.organizationId,
      email: "casey@example.org",
      links: ["https://example.org/about"],
    });
  });

  it("rejects invalid types, identifiers, URLs, and underspecified details", () => {
    const result = validateTrustRequest({
      ...valid,
      requestType: "paid_verification",
      ccn: "123",
      organizationId: "not-an-id",
      submitterEmail: "not-an-email",
      description: "too short",
      evidenceLinks: ["http://example.org", "not a URL"],
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Choose a valid request type.",
        "CMS provider ID must contain six letters or numbers.",
        "Organization reference is invalid.",
        "Enter a valid email address.",
        "Provide at least 20 characters of factual detail.",
        "Evidence links must use HTTPS.",
        "Evidence links must be valid URLs.",
      ]),
    );
  });

  it("silently identifies the honeypot and bounds public link input", () => {
    const result = validateTrustRequest({
      ...valid,
      website: "bot content",
      evidenceLinks: [
        "https://example.org/1",
        "https://example.org/2",
        "https://example.org/3",
        "https://example.org/4",
      ],
    });
    expect(result.honeypot).toBe(true);
    expect(result.value.links).toHaveLength(3);
  });

  it("applies only an active reviewed override and restores the derived value on revocation", () => {
    expect(
      applyReviewedTrustHubOverride("Original mapping", {
        status: "active",
        correctedValue: "Reviewed mapping",
      }),
    ).toBe("Reviewed mapping");
    expect(
      applyReviewedTrustHubOverride("Original mapping", {
        status: "revoked",
        correctedValue: "Reviewed mapping",
      }),
    ).toBe("Original mapping");
    expect(applyReviewedTrustHubOverride("Original mapping", null)).toBe("Original mapping");
  });
});
