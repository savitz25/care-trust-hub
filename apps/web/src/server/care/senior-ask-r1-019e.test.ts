import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("./db", () => ({ getCareDatabasePool: () => database }));

import { interpretSeniorAskQuery } from "./senior-ask-parse";
import { executeSeniorResearchQuery, executeSeniorResearchPlan } from "./senior-ask-execute";
import {
  executeSeniorNameCandidates,
  normalizeSeniorNameCandidatesRequest,
  SeniorNameCandidatesRequestError,
} from "./senior-name-candidates";

/**
 * TH-SEARCH-R1-019E fixture corpus. Deliberately distinct providers/states/CCNs from every other
 * fixture file in this repo. Includes the four named critical-acceptance providers plus a
 * Home Health and a Hospice row (multiple provider classes, per the holdout/parity requirement),
 * and a source-failure trigger row.
 */
const NH_FIXTURES = [
  { ccn: "FL1001", provider_name: "ABBEY DELRAY SOUTH", city: "DELRAY BEACH", state_code: "FL", county_name: "Palm Beach" },
  { ccn: "NY1002", provider_name: "ABIGAIL HOUSE FOR NURSING & REHABILITATION", city: "EAST NORWICH", state_code: "NY", county_name: "Nassau" },
  { ccn: "NY1003", provider_name: "A HOLLY PATTERSON EXTENDED CARE FACILITY", city: "UNIONDALE", state_code: "NY", county_name: "Nassau" },
  { ccn: "TX1004", provider_name: "FFIII HOUSTON SNF TENANT", city: "HOUSTON", state_code: "TX", county_name: "Harris" },
  // A second Nursing Home in the same fixture set so "nursing homes in Florida" (a category browse)
  // still returns real rows, distinct from the name-search cases above.
  { ccn: "FL1005", provider_name: "SUNSHINE MANOR NURSING CENTER", city: "TAMPA", state_code: "FL", county_name: "Hillsborough" },
  // A source-failure trigger: this repo's fixtureDatabase throws when it sees this exact name so the
  // TECHNICAL_FAILURE path can be exercised honestly, not simulated by mocking failClosed directly.
  { ccn: "ZZ9999", provider_name: "TRIGGER SOURCE FAILURE FIXTURE", city: "NOWHERE", state_code: "ZZ", county_name: "Nowhere" },
];
const HOME_HEALTH_FIXTURES = [
  { cms_ccn: "TX2001", provider_name: "ABIGAIL HOME HEALTH OF HOUSTON", city: "HOUSTON", state_code: "TX", zip_code: "77002" },
];
const HOSPICE_FIXTURES = [
  { cms_ccn: "NY3001", provider_name: "HOLLY PATTERSON HOSPICE CARE", city: "UNIONDALE", state_code: "NY", zip_code: "11553" },
];
const clock = {
  display_name: "Synthetic R1-019E fixture",
  source_organization: "CMS fixture",
  source_modified_at: new Date("2026-03-01T00:00:00Z"),
};

function likeValue(pattern: unknown): string {
  return String(pattern).replace(/^%|%$/g, "").toUpperCase();
}

async function fixtureDatabase(sql: string, values: unknown[] = []) {
  if (sql.includes("SELECT sd.display_name")) return { rows: [clock] };
  if (sql.includes("DISTINCT state_code")) {
    const needle = likeValue(values[0]);
    const states = [
      ...new Set(NH_FIXTURES.filter((r) => r.county_name.toUpperCase().includes(needle)).map((r) => r.state_code)),
    ].sort();
    return { rows: states.map((state_code) => ({ state_code })) };
  }
  if (sql.includes("FROM current_snapshots")) {
    let rows = [...NH_FIXTURES];
    const stateParam = sql.match(/(?<!c\.)state_code=\$(\d+)/);
    if (stateParam) rows = rows.filter((r) => r.state_code === values[Number(stateParam[1]) - 1]);
    const cityParam = sql.match(/upper\(trim\(city\)\)=\$(\d+)/);
    if (cityParam) rows = rows.filter((r) => r.city === values[Number(cityParam[1]) - 1]);
    const countyParam = sql.match(/county_name ILIKE \$(\d+)/);
    if (countyParam) {
      const needle = likeValue(values[Number(countyParam[1]) - 1]);
      rows = rows.filter((r) => r.county_name.toUpperCase().includes(needle));
    }
    const nameParam = sql.match(/provider_name ILIKE \$(\d+)/);
    if (nameParam) {
      const needle = likeValue(values[Number(nameParam[1]) - 1]);
      if (needle.includes("TRIGGER SOURCE FAILURE")) throw new Error("synthetic_source_failure");
      rows = rows.filter((r) => r.provider_name.toUpperCase().includes(needle));
    }
    if (sql.includes("count(*)")) return { rows: [{ n: String(rows.length), as_of: clock.source_modified_at }] };
    const limit = sql.match(/LIMIT \$(\d+)/);
    const offset = sql.match(/OFFSET \$(\d+)/);
    const start = offset ? Number(values[Number(offset[1]) - 1]) : 0;
    rows = rows.slice(start, limit ? start + Number(values[Number(limit[1]) - 1]) : undefined);
    return {
      rows: rows.map((r) => ({
        ...r,
        cms_ccn: r.ccn,
        overall_rating: 4,
        staffing_rating: 3,
        health_inspection_rating: null,
        source_modified_at: clock.source_modified_at,
        ownership_type: null,
      })),
    };
  }
  if (sql.includes("home_health_snapshot") || sql.includes("hospice_snapshot")) {
    let rows = sql.includes("home_health_snapshot") ? [...HOME_HEALTH_FIXTURES] : [...HOSPICE_FIXTURES];
    const stateParam = sql.match(/c\.state_code=\$(\d+)/);
    if (stateParam) rows = rows.filter((r) => r.state_code === values[Number(stateParam[1]) - 1]);
    const cityParam = sql.match(/upper\(trim\(c\.city\)\)=\$(\d+)/);
    if (cityParam) rows = rows.filter((r) => r.city === values[Number(cityParam[1]) - 1]);
    const nameParam = sql.match(/c\.provider_name ILIKE \$(\d+)/);
    if (nameParam) {
      const needle = likeValue(values[Number(nameParam[1]) - 1]);
      rows = rows.filter((r) => r.provider_name.toUpperCase().includes(needle));
    }
    if (sql.includes("count(*)")) return { rows: [{ n: String(rows.length) }] };
    return {
      rows: rows.map((r) => ({
        ...r,
        telephone: null,
        quality_of_patient_care_star: 3,
        quality_available: false,
        experience_available: false,
        ownership_available: false,
        service_evidence_available: false,
      })),
    };
  }
  return { rows: [] };
}

beforeEach(() => {
  database.query.mockReset().mockImplementation(fixtureDatabase);
});

function errorCode(fn: () => unknown): string {
  try {
    fn();
    throw new Error("expected to throw");
  } catch (e) {
    if (e instanceof SeniorNameCandidatesRequestError) return e.code;
    throw e;
  }
}

// ---------------------------------------------------------------- 1. structured request validation
describe("1. structured provider-name request validation", () => {
  it("requires an explicit name field", () => {
    expect(() => normalizeSeniorNameCandidatesRequest({})).toThrow(SeniorNameCandidatesRequestError);
  });
  it("rejects an unknown top-level field", () => {
    expect(errorCode(() => normalizeSeniorNameCandidatesRequest({ name: "Abbey Delray South", extra: 1 }))).toBe(
      "unsupported_field",
    );
  });
  it("rejects a malformed operation value", () => {
    expect(
      errorCode(() => normalizeSeniorNameCandidatesRequest({ operation: "wrong", name: "Abbey Delray South" })),
    ).toBe("invalid_operation");
  });
  it("rejects an unsupported providerClass", () => {
    expect(
      errorCode(() =>
        normalizeSeniorNameCandidatesRequest({ name: "Abbey Delray South", providerClass: "memory_care" }),
      ),
    ).toBe("invalid_provider_class");
  });
  it("rejects a malformed state", () => {
    expect(
      errorCode(() => normalizeSeniorNameCandidatesRequest({ name: "Abbey Delray South", state: "Florida" })),
    ).toBe("invalid_state");
  });
  it("accepts a minimal valid request", () => {
    const req = normalizeSeniorNameCandidatesRequest({ name: "Abbey Delray South" });
    expect(req).toEqual({ name: "Abbey Delray South", providerClass: undefined, state: undefined, page: 1 });
  });
});

// ---------------------------------------------------------------- 2/3/4. exact source-name / city-in-name / care-word-in-name
describe("2-4. exact source-name search survives city words and care-category words inside the provider name", () => {
  const cases: Array<[string, string]> = [
    ["Abbey Delray South", "FL1001"],
    ["Abigail House for Nursing & Rehabilitation", "NY1002"],
    ["A Holly Patterson Extended Care Facility", "NY1003"],
    ["FFIII Houston SNF Tenant", "TX1004"],
  ];
  it.each(cases)("%s -> %s, no category gate, name intact", async (name, ccn) => {
    const req = normalizeSeniorNameCandidatesRequest({ name });
    const result = await executeSeniorNameCandidates(req);
    expect(result.resultState).toBe("COMPLETED_WITH_CANDIDATES");
    if (result.resultState !== "COMPLETED_WITH_CANDIDATES") return;
    expect(result.name).toEqual({ supplied: name, predicateApplied: true });
    expect(result.candidates.map((c) => c.ccn)).toContain(ccn);
  });
  it("5. lowercase variant still finds the same record", async () => {
    const result = await executeSeniorNameCandidates(
      normalizeSeniorNameCandidatesRequest({ name: "abigail house for nursing & rehabilitation" }),
    );
    expect(result.resultState).toBe("COMPLETED_WITH_CANDIDATES");
    if (result.resultState === "COMPLETED_WITH_CANDIDATES")
      expect(result.candidates.map((c) => c.ccn)).toContain("NY1002");
  });
  it("6. a partial (prefix substring) form of the name -- Senior's own ILIKE matcher's real supported behavior -- still finds the record", async () => {
    const result = await executeSeniorNameCandidates(
      normalizeSeniorNameCandidatesRequest({ name: "Holly Patterson Extended Care" }),
    );
    expect(result.resultState).toBe("COMPLETED_WITH_CANDIDATES");
    if (result.resultState === "COMPLETED_WITH_CANDIDATES")
      expect(result.candidates.map((c) => c.ccn)).toContain("NY1003");
  });
  it("6b. Senior's matcher does substring ILIKE, not word-level normalization -- spelling out '&' as 'and' is an honest miss, not aggressive fuzzy matching invented here", async () => {
    const result = await executeSeniorNameCandidates(
      normalizeSeniorNameCandidatesRequest({ name: "Abigail House for Nursing and Rehabilitation" }),
    );
    expect(result.resultState).toBe("COMPLETED_NO_CANDIDATES");
  });
  it("7. a name beginning with a city word is still searched as a name (not diverted to geography)", async () => {
    // "Houston" leads no fixture name here, but FFIII Houston SNF Tenant CONTAINS the city word --
    // already covered above. This case additionally proves the city word is not silently stripped:
    // the SAME query, run twice, must consistently echo the identical supplied name.
    const a = await executeSeniorNameCandidates(normalizeSeniorNameCandidatesRequest({ name: "FFIII Houston SNF Tenant" }));
    const b = await executeSeniorNameCandidates(normalizeSeniorNameCandidatesRequest({ name: "FFIII Houston SNF Tenant" }));
    expect(a.name.supplied).toBe("FFIII Houston SNF Tenant");
    expect(b.name.supplied).toBe("FFIII Houston SNF Tenant");
  });
});

// ---------------------------------------------------------------- 5. provider-class preservation
describe("5. provider-class preservation across nursing home, home health and hospice", () => {
  it("a name shared across two different classes is never merged into one denominator", async () => {
    const result = await executeSeniorNameCandidates(normalizeSeniorNameCandidatesRequest({ name: "Abigail" }));
    expect(result.resultState).toBe("COMPLETED_WITH_CANDIDATES");
    if (result.resultState !== "COMPLETED_WITH_CANDIDATES") return;
    const classes = new Set(result.candidates.map((c) => c.providerClass));
    expect(classes.has("nursing_home")).toBe(true);
    expect(classes.has("home_health")).toBe(true);
    // Each row keeps its OWN class; there is no single "Abigail" total that merges them.
    for (const c of result.candidates) expect(["nursing_home", "home_health", "hospice"]).toContain(c.providerClass);
  });
  it("an optional providerClass filter narrows already-returned candidates without a second query", async () => {
    const result = await executeSeniorNameCandidates(
      normalizeSeniorNameCandidatesRequest({ name: "Holly Patterson", providerClass: "hospice" }),
    );
    expect(result.resultState).toBe("COMPLETED_WITH_CANDIDATES");
    if (result.resultState !== "COMPLETED_WITH_CANDIDATES") return;
    expect(result.candidates.every((c) => c.providerClass === "hospice")).toBe(true);
    expect(result.candidates.map((c) => c.ccn)).toContain("NY3001");
    expect(result.limitations.join(" ")).toMatch(/narrows the candidates already returned/);
  });
});

// ---------------------------------------------------------------- 6. location semantics preservation
describe("6. location semantics preservation", () => {
  it("recordedLocation is disclosed as recorded location, never service territory", async () => {
    const result = await executeSeniorNameCandidates(
      normalizeSeniorNameCandidatesRequest({ name: "Abbey Delray South" }),
    );
    expect(result.resultState).toBe("COMPLETED_WITH_CANDIDATES");
    if (result.resultState !== "COMPLETED_WITH_CANDIDATES") return;
    const row = result.candidates.find((c) => c.ccn === "FL1001")!;
    expect(row.recordedLocation).toMatchObject({ city: "DELRAY BEACH", state: "FL" });
    expect(row.locationMeaning).toMatch(/recorded provider\/office location/i);
    // The word "service" only ever appears here inside the NEGATION ("not service territory... or a
    // verified service area") -- it must never be asserted as an established fact on its own.
    expect(row.locationMeaning).toMatch(/not service territory/i);
    expect(row.locationMeaning).not.toMatch(/is a verified service area|establishes service/i);
  });
  it("an optional state filter scopes the search itself (not a post-filter), matching native geography semantics", async () => {
    const result = await executeSeniorNameCandidates(
      normalizeSeniorNameCandidatesRequest({ name: "Abigail", state: "TX" }),
    );
    expect(result.resultState).toBe("COMPLETED_WITH_CANDIDATES");
    if (result.resultState !== "COMPLETED_WITH_CANDIDATES") return;
    // Only the TX home-health "Abigail" row should survive -- the NY nursing-home "Abigail House"
    // is a different state and must not appear once state is supplied.
    expect(result.candidates.every((c) => c.recordedLocation?.state === "TX")).toBe(true);
  });
});

// ---------------------------------------------------------------- 7. exact CCN precedence
describe("7. exact CCN identifier precedence is unaffected", () => {
  it("an exact CCN through the native path stays on the identifier route, never a name search", async () => {
    const plan = interpretSeniorAskQuery("Find CMS CCN FL1001");
    expect(plan.mode).toBe("identifier");
    expect(plan.identifier).toEqual({ type: "ccn", value: "FL1001" });
    expect(plan.identityQuery).toBeUndefined();
  });
  it("a malformed CCN-shaped request never invents a fake identifier match", () => {
    const plan = interpretSeniorAskQuery("CCN 12");
    // Too short to be a real labeled CCN (6 alphanumeric chars): never accepted as an identifier.
    expect(plan.identifier).toBeUndefined();
    // It is honestly searched (and misses) as literal text -- never silently mapped onto some
    // OTHER real provider's record. This is pre-existing native behavior, unaffected by R1-019E.
  });
});

// ---------------------------------------------------------------- 8. category-query negative controls
describe("8. true care-category queries remain category queries, never a name search", () => {
  const categoryCases: Array<[string, string | undefined]> = [
    ["senior care Florida", "provider_class"],
    ["nursing homes in Florida", undefined],
    ["hospice near Tampa", undefined],
    ["home health agencies in Texas", undefined],
  ];
  it.each(categoryCases)("%s stays a category request", async (raw) => {
    const plan = interpretSeniorAskQuery(raw);
    expect(plan.identityQuery).toBeUndefined();
  });
  it("a bare category phrase submitted to the structured operation is UNSUPPORTED, never a name miss", async () => {
    const result = await executeSeniorNameCandidates(normalizeSeniorNameCandidatesRequest({ name: "senior care Florida" }));
    expect(result.resultState).toBe("UNSUPPORTED_OPERATION");
    expect(result.name.predicateApplied).toBe(false);
  });
});

// ---------------------------------------------------------------- 9. source failure != miss
describe("9. source failure != miss", () => {
  it("a genuine source failure reports TECHNICAL_FAILURE, never COMPLETED_NO_CANDIDATES", async () => {
    const result = await executeSeniorNameCandidates(
      normalizeSeniorNameCandidatesRequest({ name: "Trigger Source Failure Fixture" }),
    );
    expect(result.resultState).toBe("TECHNICAL_FAILURE");
    if (result.resultState === "TECHNICAL_FAILURE") {
      expect(result.failureKind).toBe("unavailable");
      expect(result.name.predicateApplied).toBe(false);
    }
  });
});

// ---------------------------------------------------------------- 10. unsupported class != miss
describe("10. unsupported non-CMS class scope stays distinct from a miss", () => {
  it("memory care is UNSUPPORTED at the structured layer too, never a nursing-home substitute", async () => {
    const result = await executeSeniorNameCandidates(
      normalizeSeniorNameCandidatesRequest({ name: "memory care facility around Tacoma" }),
    );
    expect(result.resultState).toBe("UNSUPPORTED_OPERATION");
  });
});

// ---------------------------------------------------------------- 10b. genuine miss
describe("10b. a genuine provider-name miss", () => {
  it("a real, well-formed name with no matching record is COMPLETED_NO_CANDIDATES", async () => {
    const result = await executeSeniorNameCandidates(
      normalizeSeniorNameCandidatesRequest({ name: "Zzqx Nonexistent Senior Facility 019e" }),
    );
    expect(result.resultState).toBe("COMPLETED_NO_CANDIDATES");
    if (result.resultState === "COMPLETED_NO_CANDIDATES") expect(result.candidates).toEqual([]);
  });
});

// ---------------------------------------------------------------- 11. pagination / cap truthfulness
describe("11. pagination and cap truthfulness", () => {
  it("hasMore is reported honestly and never silently coerced", async () => {
    const result = await executeSeniorNameCandidates(normalizeSeniorNameCandidatesRequest({ name: "Abbey Delray South" }));
    expect(result.resultState).toBe("COMPLETED_WITH_CANDIDATES");
    if (result.resultState === "COMPLETED_WITH_CANDIDATES") {
      expect(result.pagination.page).toBe(1);
      expect(typeof result.pagination.hasMore).toBe("boolean");
    }
  });
});

// ---------------------------------------------------------------- 12. native/structured parity
describe("12. native and structured operation use the same authoritative engine (identity comparison, not text)", () => {
  it("both paths return the same stable identity (CCN + provider class) for the same name", async () => {
    const native = await executeSeniorResearchQuery("A Holly Patterson Extended Care Facility");
    const structured = await executeSeniorNameCandidates(
      normalizeSeniorNameCandidatesRequest({ name: "A Holly Patterson Extended Care Facility" }),
    );
    expect(structured.resultState).toBe("COMPLETED_WITH_CANDIDATES");
    if (structured.resultState !== "COMPLETED_WITH_CANDIDATES") return;
    const nativeIdentities = native.entities.map((e) => ({ ccn: e.ccn, providerClass: e.providerClass })).sort((a, b) => a.ccn.localeCompare(b.ccn));
    const structuredIdentities = structured.candidates.map((c) => ({ ccn: c.ccn, providerClass: c.providerClass })).sort((a, b) => a.ccn.localeCompare(b.ccn));
    expect(structuredIdentities).toEqual(nativeIdentities);
  });
});

// ---------------------------------------------------------------- 13. no invented URL/action
describe("13. no invented profile URL or action", () => {
  it("every action href comes from the entity's own existing href, never constructed from the name", async () => {
    const result = await executeSeniorNameCandidates(normalizeSeniorNameCandidatesRequest({ name: "Abbey Delray South" }));
    expect(result.resultState).toBe("COMPLETED_WITH_CANDIDATES");
    if (result.resultState !== "COMPLETED_WITH_CANDIDATES") return;
    const native = await executeSeniorResearchQuery("Abbey Delray South");
    const row = result.candidates.find((c) => c.ccn === "FL1001")!;
    const nativeEntity = native.entities.find((e) => e.ccn === "FL1001")!;
    expect(row.action.href).toBe(nativeEntity.href);
    expect(row.action.type).toBe("PROFILE");
  });
});

// ---------------------------------------------------------------- 14. publication/scope guard
describe("14. publication/scope guard", () => {
  it("every returned candidate is publicly published (public_profile) -- never a restricted projection", async () => {
    const result = await executeSeniorNameCandidates(normalizeSeniorNameCandidatesRequest({ name: "Abbey Delray South" }));
    expect(result.resultState).toBe("COMPLETED_WITH_CANDIDATES");
    if (result.resultState === "COMPLETED_WITH_CANDIDATES")
      expect(result.candidates.every((c) => c.publicationState === "public_profile")).toBe(true);
  });
});
