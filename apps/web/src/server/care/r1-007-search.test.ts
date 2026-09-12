import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("./db", () => ({ getCareDatabasePool: () => database }));
import { interpretSeniorAskQuery } from "./senior-ask-parse";
import {
  executeSeniorResearchQuery,
  executeSeniorRequest,
  executeSeniorResearchPlan,
} from "./senior-ask-execute";

import { planSeniorRequest, seniorRequestParams } from "./senior-ask-request";
import { normalizeSeniorSpecialistRequest } from "./senior-specialist-execution-v2";
import { GET } from "@/app/api/ask/route";

// Independent source fixture and SQL-boundary interpreter. It reads emitted predicates,
// not the production plan, and deliberately admits distractors when either predicate is absent.
const fixtures = [
  {
    ccn: "T00001",
    provider_name: "Austin One",
    city: "AUSTIN",
    state_code: "TX",
    kind: "nursing_home",
    current: true,
  },
  {
    ccn: "T00002",
    provider_name: "Burleson Distractor",
    city: "BURLESON",
    state_code: "TX",
    kind: "nursing_home",
    current: true,
  },
  {
    ccn: "T00003",
    provider_name: "Austin Other State",
    city: "AUSTIN",
    state_code: "MN",
    kind: "nursing_home",
    current: true,
  },
  {
    ccn: "T00004",
    provider_name: "Historic Austin",
    city: "AUSTIN",
    state_code: "TX",
    kind: "nursing_home",
    current: false,
  },
  {
    ccn: "T00005",
    provider_name: "Tampa One",
    city: "TAMPA",
    state_code: "FL",
    kind: "nursing_home",
    current: true,
  },
  {
    ccn: "T00006",
    provider_name: "Tampa Other State",
    city: "TAMPA",
    state_code: "KS",
    kind: "nursing_home",
    current: true,
  },
  {
    ccn: "H00001",
    provider_name: "Houston Home Health",
    city: "HOUSTON",
    state_code: "TX",
    kind: "home_health",
    current: true,
  },
  ...["VA", "FL", "CA", "MN"].map((state_code, i) => ({
    ccn: `H0001${i}`,
    provider_name: `Other Office ${i}`,
    city: i === 3 ? "HOUSTON" : "OTHER",
    state_code,
    kind: "home_health",
    current: true,
  })),
  {
    ccn: "H00020",
    provider_name: "Historic Houston",
    city: "HOUSTON",
    state_code: "TX",
    kind: "home_health",
    current: false,
  },
  {
    ccn: "P00001",
    provider_name: "Houston Hospice",
    city: "HOUSTON",
    state_code: "TX",
    kind: "hospice",
    current: true,
  },
];
const clock = {
  display_name: "Synthetic CMS fixture",
  source_organization: "CMS fixture",
  source_modified_at: new Date("2026-01-01T00:00:00Z"),
};
async function fixtureDatabase(sql: string, values: unknown[] = []) {
  if (sql.includes("SELECT sd.display_name")) return { rows: [clock] };
  const kind = sql.includes("FROM current_snapshots")
    ? "nursing_home"
    : sql.includes("home_health_snapshot")
      ? "home_health"
      : "hospice";
  let rows = fixtures.filter((r) => r.kind === kind);
  if (sql.includes("ingest_run_id") && sql.includes("status='succeeded'"))
    rows = rows.filter((r) => r.current);
  const cityParam = sql.match(/upper\(trim\((?:c\.)?city\)\)=\$(\d+)/);
  const stateParam = sql.match(/(?:c\.)?state_code=\$(\d+)/);
  if (cityParam) rows = rows.filter((r) => r.city === values[Number(cityParam[1]) - 1]);
  if (stateParam) rows = rows.filter((r) => r.state_code === values[Number(stateParam[1]) - 1]);
  if (sql.includes("count(*)"))
    return { rows: [{ n: String(rows.length), as_of: clock.source_modified_at }] };
  const limit = sql.match(/LIMIT \$(\d+)/),
    offset = sql.match(/OFFSET \$(\d+)/);
  const start = offset ? Number(values[Number(offset[1]) - 1]) : 0;
  rows = rows.slice(start, limit ? start + Number(values[Number(limit[1]) - 1]) : undefined);
  return {
    rows: rows.map((r) => ({
      ...r,
      cms_ccn: r.ccn,
      overall_rating: 4,
      staffing_rating: 3,
      health_inspection_rating: null,
      quality_of_patient_care_star: 3,
      source_modified_at: clock.source_modified_at,
      county_name: null,
      ownership_type: null,
      quality_available: true,
      experience_available: false,
      ownership_available: false,
      service_evidence_available: false,
    })),
  };
}

describe("R1-007 recorded location integrity", () => {
  beforeEach(() => {
    database.query.mockReset().mockImplementation(fixtureDatabase);
  });
  it.each([
    ["Nursing homes in Austin Texas", "nursing_home", "AUSTIN", "TX"],
    ["Home health agencies in Houston Texas", "home_health", "HOUSTON", "TX"],
    ["Nursing homes in Tampa Florida", "nursing_home", "TAMPA", "FL"],
    ["Nursing homes in Portland, OR", "nursing_home", "PORTLAND", "OR"],
  ])("preserves compound scope: %s", (raw, providerClass, city, state) => {
    const plan = interpretSeniorAskQuery(raw);
    expect(plan.providerClass).toBe(providerClass);
    expect(plan.geography).toMatchObject({ type: "city", value: city, state });
  });
  it("binds the requested city and state before SQL pagination", async () => {
    await executeSeniorResearchQuery("Nursing homes in Austin Texas");
    const call = database.query.mock.calls.find(([sql]) =>
      String(sql).includes("FROM current_snapshots cs"),
    );
    expect(call).toBeDefined();
    expect(call![1]).toContain("AUSTIN");
    expect(call![1]).toContain("TX");
  });
  it.each([
    ["Nursing homes in Austin Texas", ["T00001"]],
    ["Home health agencies in Houston Texas", ["H00001"]],
    ["Nursing homes in Tampa Florida", ["T00005"]],
    ["Hospice providers in Houston Texas", ["P00001"]],
  ])("executes current compound predicates, excludes distractors: %s", async (raw, expected) => {
    const result = await executeSeniorResearchQuery(raw);
    expect(result.failClosed).toBeUndefined();
    expect(result.entities.map((e) => e.ccn)).toEqual(expected);
    for (const e of result.entities) {
      expect(e.whyMatched.toUpperCase()).toContain(e.recordedLocation!.city!);
      expect(e.whyMatched).toContain(e.recordedLocation!.state);
    }
  });
  it("counts the same current agency cohort and retains a sourced zero", async () => {
    expect(
      (await executeSeniorResearchQuery("How many home health agencies in Houston Texas?")).count
        ?.n,
    ).toBe(1);
    const miss = await executeSeniorResearchQuery(
      "How many home health agencies in Imaginaryville Texas?",
    );
    expect(miss.count?.n).toBe(0);
    expect(miss.failClosed).toBeUndefined();
  });
  it("does not lose city-only, multiple or unsupported proximity requirements", async () => {
    for (const raw of [
      "Home health agencies in Houston",
      "Nursing homes near me",
      "Nursing homes within 10 miles of Austin Texas",
      "Nursing homes in Austin Texas and Tampa Florida",
    ]) {
      const result = await executeSeniorResearchQuery(raw);
      expect(result.failClosed).toBeDefined();
      expect(result.entities).toEqual([]);
      expect(result.query.locationRequirement).toBeDefined();
    }
    expect(database.query).not.toHaveBeenCalled();
  });
  it("state selection resolves a city-only question; conflicting state cannot erase a city", async () => {
    const chosen = await executeSeniorRequest({
      q: "Home health agencies in Houston",
      state: "TX",
    });
    expect(chosen.entities.map((e) => e.ccn)).toEqual(["H00001"]);
    expect(
      (await executeSeniorRequest({ q: "Nursing homes in Austin Texas", state: "FL" })).failClosed,
    ).toBeDefined();
  });
  it("explicit broader search retains state and records the user's change", async () => {
    const result = await executeSeniorRequest({
      q: "Nursing homes in Austin Texas",
      broaden: "state",
    });
    expect(result.query.geography).toMatchObject({ type: "state", value: "TX" });
    expect(result.query.locationRequirement?.outcome).toBe("USER_APPROVED_RELAXATION");
    expect(result.entities.map((e) => e.ccn)).toEqual(["T00001", "T00002"]);
  });
  it.each([
    { q: "Nursing homes in Austin Texas" + " ".repeat(180) + " or Florida" },
    { q: ["Nursing homes in Austin Texas", "Nursing homes in Florida"] },
    { q: "Nursing homes in Texas", page: "1.5" },
    { q: "Nursing homes in Texas", state: "ZZ" },
    { q: "Nursing homes in Texas", stars: "banana" },
  ])("rejects malformed full request before lookup: %j", async (input) => {
    expect((await executeSeniorRequest(input)).query.terminalState).toBe("INVALID_INPUT");
    expect(database.query).not.toHaveBeenCalled();
  });
  it("preserves a named provider containing location words as identity", () => {
    const q = interpretSeniorAskQuery('Find "Austin Nursing Home"');
    expect(q.identityQuery).toBe("Austin Nursing Home");
    expect(q.geography).toBeUndefined();
  });
  it("shared API, native boundary and structured plan return the same cohort", async () => {
    const params = new URLSearchParams({
      q: "Nursing homes in Austin Texas",
      class: "nursing_home",
    });
    const native = await executeSeniorRequest(seniorRequestParams(params));
    const api = await (await GET(new Request("https://example.test/api/ask?" + params))).json();
    const structured = normalizeSeniorSpecialistRequest({
      providerClass: "nursing_home",
      geography: { type: "city", value: "AUSTIN", state: "TX" },
    });
    const third = await executeSeniorResearchPlan(structured.query);
    expect(api.results.map((x: { ccn: string }) => x.ccn)).toEqual(
      native.entities.map((e) => e.ccn),
    );
    expect(third.entities.map((e) => e.ccn)).toEqual(native.entities.map((e) => e.ccn));
    expect(api.results[0].recordedLocation).toMatchObject({ city: "AUSTIN", state: "TX" });
  });
  it("source outage is unavailable, never a valid empty cohort", async () => {
    database.query.mockRejectedValue(new Error("synthetic outage"));
    const r = await executeSeniorResearchQuery("Nursing homes in Austin Texas");
    expect(r.query.terminalState).toBe("SOURCE_UNAVAILABLE");
    expect(r.count).toBeUndefined();
    expect(r.query.geography?.value).toBe("AUSTIN");
  });
  it("incompatible overrides preserve the request and clarify", () => {
    const q = planSeniorRequest({
      q: "Home health agencies in Houston Texas",
      evidence: "deficiencies",
    }).query;
    expect(q.providerClass).toBe("home_health");
    expect(q.geography).toMatchObject({ value: "HOUSTON", state: "TX" });
    expect(q.mode).toBe("fail_closed");
  });
});
