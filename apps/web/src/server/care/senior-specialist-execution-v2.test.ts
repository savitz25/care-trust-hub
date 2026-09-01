import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let contract: typeof import("./senior-specialist-execution-v2");

beforeAll(async () => {
  contract = await import("./senior-specialist-execution-v2");
});

describe("Senior specialist execution V2 request contract", () => {
  it("builds a class-separated Florida Nursing Home plan", () => {
    const result = contract.normalizeSeniorSpecialistRequest({
      providerClass: "nursing_home",
      geography: { type: "state", value: "fl" },
      page: 2,
    });
    expect(result.query).toMatchObject({
      mode: "entity",
      providerClass: "nursing_home",
      geography: { type: "state", value: "FL" },
      sort: "name",
      page: 2,
    });
    expect(result.query.geography?.meaning).toMatch(/not service area or availability/i);
  });

  it("keeps source-native filters scoped to the correct provider class", () => {
    expect(() =>
      contract.normalizeSeniorSpecialistRequest({
        providerClass: "hospice",
        filters: { overallStars: [5] },
      }),
    ).toThrowError(/do not apply/i);
    expect(() =>
      contract.normalizeSeniorSpecialistRequest({
        providerClass: "nursing_home",
        filters: { qpcStars: [5] },
      }),
    ).toThrowError(/Home Health/i);
  });

  it("returns a typed unsupported capability for Home Health county", () => {
    try {
      contract.normalizeSeniorSpecialistRequest({
        providerClass: "home_health",
        geography: { type: "county", value: "Palm Beach" },
      });
      throw new Error("expected unsupported capability");
    } catch (error) {
      expect(error).toBeInstanceOf(contract.SeniorSpecialistRequestError);
      expect(error).toMatchObject({
        code: "unsupported_home_health_county_geography",
        status: 422,
      });
    }
  });

  it("accepts exact labeled CMS CCN identity without selecting a class", () => {
    const result = contract.normalizeSeniorSpecialistRequest({ identifier: "105502" });
    expect(result.query).toMatchObject({
      mode: "identifier",
      identifier: { type: "ccn", value: "105502" },
    });
  });

  it("fails closed on unknown fields, invalid pagination, and invalid geography", () => {
    expect(() =>
      contract.normalizeSeniorSpecialistRequest({ providerClass: "nursing_home", ranking: "best" }),
    ).toThrowError(/unsupported fields/i);
    expect(() =>
      contract.normalizeSeniorSpecialistRequest({ providerClass: "nursing_home", page: 0 }),
    ).toThrowError(/page must/i);
    expect(() =>
      contract.normalizeSeniorSpecialistRequest({
        providerClass: "nursing_home",
        geography: { type: "zip", value: "abc" },
      }),
    ).toThrowError(/five digits/i);
  });

  it("advertises no combined total, ranking, or invented deep anchors", () => {
    expect(contract.SENIOR_SPECIALIST_CAPABILITIES.contract).toBe(
      "trusthub-specialist-execution-v2",
    );
    expect(contract.SENIOR_SPECIALIST_CAPABILITIES.limitations.join(" ")).toMatch(
      /never combined/i,
    );
    expect(contract.SENIOR_SPECIALIST_CAPABILITIES.limitations.join(" ")).toMatch(
      /not a TrustHub score or ranking/i,
    );
    expect(contract.SENIOR_SPECIALIST_CAPABILITIES.destinationTemplates.sections).toMatch(
      /no section anchors/i,
    );
  });
});
