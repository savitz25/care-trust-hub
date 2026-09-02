import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/server/care/senior-customer-profile-validation", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/care/senior-customer-profile-validation")
  >("@/server/care/senior-customer-profile-validation");
  return {
    ...actual,
    validateSeniorCustomerProfile: vi.fn(async (input) => ({
      ...actual.SENIOR_CUSTOMER_VALIDATION_CAPABILITIES,
      ...input,
      displayName: "Fixture",
      publicationState: "public",
      current: true,
      canonicalProfileUrl: (input as { canonicalProfileUrl: string }).canonicalProfileUrl,
      provenance: { sourceFamily: "CMS", sourceAsOf: null, identityMethod: "exact" },
    })),
  };
});
let route: typeof import("./route");
beforeAll(async () => {
  route = await import("./route");
});
describe("customer profile validation HTTP contract", () => {
  it("advertises explicit stable contract metadata", async () => {
    const r = await route.GET();
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j).toMatchObject({
      contract: "senior-customer-profile-validation-v1",
      contractVersion: "1.0.0",
      hub: "senior",
      providerClasses: ["nursing_home", "home_health", "hospice"],
    });
    expect(j.schemaFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(j.contractFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
  it("returns bounded public-safe exact validation", async () => {
    const input = {
      providerClass: "nursing_home",
      cmsCcn: "105411",
      nativeProfileId: "fd0888cd-da1e-4dc3-8073-bedba0e8ce02",
      canonicalProfileUrl: "https://www.seniortrusthub.com/facility/cms/105411/abbey-delray-south",
    };
    const r = await route.POST(
      new Request("https://www.seniortrusthub.com/api/customer-profile-validation/v1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ...input, publicationState: "public", current: true });
  });
  it("fails malformed JSON without backend details", async () => {
    const r = await route.POST(
      new Request("https://www.seniortrusthub.com/api/customer-profile-validation/v1", {
        method: "POST",
        body: "{",
      }),
    );
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({
      status: "invalid_request",
      errorCode: "invalid_request",
    });
  });
});
