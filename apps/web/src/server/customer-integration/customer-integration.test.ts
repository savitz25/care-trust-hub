import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createHmac } from "node:crypto";
import { claimCtaEnabledFor } from "./eligibility";
import { HANDOFF_TTL_SECONDS, mintSeniorHandoff } from "./handoff";
import { parseBusinessProfile, parseReplies, fetchCustomerLayer } from "./public";
import { claimRedirect, safeBusinessWebsite } from "./security";
const ID = "fd0888cd-da1e-4dc3-8073-bedba0e8ce02",
  SECRET = "test-secret-that-is-at-least-32-characters";
const P = {
  nativeProfileId: ID,
  cmsCcn: "105411",
  providerClass: "nursing_home" as const,
  canonicalProfileUrl: "https://www.seniortrusthub.com/facility/cms/105411/abbey-delray-south",
  displayName: "Abbey Delray South",
};
describe("ATH-CUST-NET-002A", () => {
  it("mints an exact expiring class-bound signed v2 handoff", () => {
    const m = mintSeniorHandoff(SECRET, P, new Date("2026-09-02T00:00:00Z"));
    expect(m.payload.provider_class).toBe("nursing_home");
    expect(m.payload.external_key).toBe("105411");
    expect(m.payload.exp - m.payload.iat).toBe(HANDOFF_TTL_SECONDS);
    const [b, s] = m.token.split(".");
    expect(createHmac("sha256", SECRET).update(b!).digest("base64url")).toBe(s);
  });
  it("keeps CTA off by default and exact in canary", () => {
    expect(claimCtaEnabledFor(ID, { ATH_HANDOFF_SECRET: SECRET })).toBe(false);
    expect(
      claimCtaEnabledFor(ID, {
        ATH_HANDOFF_SECRET: SECRET,
        ATH_CLAIM_CTA_MODE: "canary",
        ATH_CLAIM_CANARY_PROFILE_IDS: ID,
      }),
    ).toBe(true);
    expect(
      claimCtaEnabledFor("81e89675-3ff4-4cd1-ab6e-11f92c63acc8", {
        ATH_HANDOFF_SECRET: SECRET,
        ATH_CLAIM_CTA_MODE: "canary",
        ATH_CLAIM_CANARY_PROFILE_IDS: ID,
      }),
    ).toBe(false);
  });
  it("allows only absolute HTTP websites", () => {
    expect(safeBusinessWebsite("https://example.com")).toBe("https://example.com/");
    expect(safeBusinessWebsite("http://example.com")).toBe("http://example.com/");
    for (const x of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,x",
      "vbscript:x",
      "//evil.example",
      "relative",
      "",
      "   ",
    ])
      expect(safeBusinessWebsite(x)).toBe(null);
  });
  it("makes token redirects private", () => {
    const r = claimRedirect("signed.token");
    expect(r.status).toBe(302);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-robots-tag")).toContain("noindex");
    expect(r.headers.get("location")).toContain("handoff=signed.token");
  });
  it("parses exact hub/profile DTOs and rejects HTML replies", () => {
    const dto = {
      contractVersion: 2,
      hub: "senior",
      nativeProfileId: ID,
      managed: true,
      source: "BUSINESS_SUPPLIED",
      freshness: {
        state: "CURRENT",
        lastConfirmedAt: "2026-09-01",
        label: "Current",
        mayBeOutdated: false,
      },
      fields: { description: "Business supplied" },
      services: [],
      serviceAreas: [],
      languages: [],
      hours: [],
    };
    expect(parseBusinessProfile(dto, ID)).not.toBeNull();
    expect(parseBusinessProfile({ ...dto, hub: "lender" }, ID)).toBeNull();
    const replies = {
      contractVersion: 2,
      hub: "senior",
      nativeProfileId: ID,
      replies: [
        {
          id: "r",
          body: "Approved context",
          source: "BUSINESS_RESPONSE",
          publishedAt: "2026-09-01",
        },
      ],
    };
    expect(parseReplies(replies, ID)).not.toBeNull();
    expect(
      parseReplies({ ...replies, replies: [{ ...replies.replies[0], body: "<b>x</b>" }] }, ID),
    ).toBeNull();
  });
  it("fails closed during Ask outage", async () => {
    const bad = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    expect(await fetchCustomerLayer(ID, bad)).toEqual({ profile: null, replies: null });
  });
});
