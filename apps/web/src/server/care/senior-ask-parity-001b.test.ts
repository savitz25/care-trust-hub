import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("./db", () => ({ getCareDatabasePool: () => database }));

import { executeSeniorResearchQuery } from "./senior-ask-execute";

// TH-DISCOVERY-PARITY-001B fresh regression fixtures. Deliberately different providers/states from
// both the production audit strings and the r1-007-search.test.ts fixture corpus. This file
// specifically exercises the two DANGEROUS wrong-state bugs' GENERAL fix -- county-name resolution
// against the real corpus, and geography-scoped class previews -- plus the brand-identity fallback,
// each against a hand-built corpus where a wrong answer is unambiguous and easy to detect.
const NH_FIXTURES = [
  // Newark, NJ: the real, current record a "senior care homes Newark NJ" preview must show.
  {
    ccn: "NJ0001",
    provider_name: "NEWARK CARE CENTER",
    city: "NEWARK",
    state_code: "NJ",
    county_name: "Essex",
  },
  // Alphabetically-first, wrong-state distractor. If a preview panel is ever built as an
  // unfiltered/alphabetical national slice instead of a real geography filter, this row leaks in.
  {
    ccn: "HI0001",
    provider_name: "AAA HONOLULU DISTRACTOR",
    city: "HONOLULU",
    state_code: "HI",
    county_name: "Honolulu",
  },
  // Sacramento County is unique nationally in this fixture set: a bare "Sacramento County" (no
  // state given) must resolve to exactly CA, matching the real production bug this ticket blocks.
  {
    ccn: "CA0001",
    provider_name: "SACRAMENTO CARE CENTER",
    city: "SACRAMENTO",
    state_code: "CA",
    county_name: "Sacramento",
  },
  // "Washington" County is deliberately NOT unique -- it exists in both PA and OH here -- so a bare
  // "Washington County" must ask for the state explicitly, never guess either one.
  {
    ccn: "PA0002",
    provider_name: "WASHINGTON COUNTY PA HOME",
    city: "WASHINGTON",
    state_code: "PA",
    county_name: "Washington",
  },
  {
    ccn: "OH0002",
    provider_name: "WASHINGTON COUNTY OH HOME",
    city: "MARIETTA",
    state_code: "OH",
    county_name: "Washington",
  },
  // National brand facility indexed under its own registered name, not the parent brand -- the
  // exact phrase "Brookdale Senior Living" must not literally match this row.
  {
    ccn: "ID0001",
    provider_name: "BROOKDALE BOISE",
    city: "BOISE",
    state_code: "ID",
    county_name: "Ada",
  },
  // A name that DOES contain the full searched phrase, so the brand-prefix fallback must never
  // fire when the exact search already found a real match.
  {
    ccn: "FL0009",
    provider_name: "EXACT MATCH SENIOR LIVING OF MIAMI",
    city: "MIAMI",
    state_code: "FL",
    county_name: "Miami-Dade",
  },
];
const HOME_HEALTH_FIXTURES = [
  // Same brand, different class and state -- proves the brand fallback is not nursing-home-only.
  {
    cms_ccn: "NV9001",
    provider_name: "BROOKDALE HOME HEALTH OF RENO",
    city: "RENO",
    state_code: "NV",
    zip_code: "89501",
  },
];
const clock = {
  display_name: "Synthetic PARITY-001B fixture",
  source_organization: "CMS fixture",
  source_modified_at: new Date("2026-03-01T00:00:00Z"),
};

function likeValue(pattern: unknown): string {
  return String(pattern).replace(/^%|%$/g, "").toUpperCase();
}

async function fixtureDatabase(sql: string, values: unknown[] = []) {
  if (sql.includes("SELECT sd.display_name")) return { rows: [clock] };

  // resolveCountyGeography: a distinct-states-for-this-county lookup, general and not keyed to any
  // one county name.
  if (sql.includes("DISTINCT state_code")) {
    const needle = likeValue(values[0]);
    const states = [
      ...new Set(
        NH_FIXTURES.filter((r) => r.county_name.toUpperCase().includes(needle)).map(
          (r) => r.state_code,
        ),
      ),
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
      rows = rows.filter((r) => r.provider_name.toUpperCase().includes(needle));
    }
    if (sql.includes("count(*)"))
      return { rows: [{ n: String(rows.length), as_of: clock.source_modified_at }] };
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
    let rows = sql.includes("home_health_snapshot") ? [...HOME_HEALTH_FIXTURES] : [];
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

describe("TH-DISCOVERY-PARITY-001B execute-level regression corpus", () => {
  beforeEach(() => {
    database.query.mockReset().mockImplementation(fixtureDatabase);
  });

  describe("county resolution never guesses a wrong state", () => {
    it("a nationally-unique county with no explicit state auto-resolves to its real state", async () => {
      const result = await executeSeniorResearchQuery("nursing home Sacramento County");
      expect(result.failClosed).toBeUndefined();
      expect(result.query.geography).toMatchObject({
        type: "county",
        value: "SACRAMENTO",
        state: "CA",
      });
      expect(result.entities.map((e) => e.ccn)).toEqual(["CA0001"]);
      // The wrong-state, wrong-record production bug this ticket blocks: never a distractor.
      expect(result.entities.map((e) => e.ccn)).not.toContain("HI0001");
    });
    it("a county name shared by more than one state asks for the state explicitly, never guesses", async () => {
      const result = await executeSeniorResearchQuery("nursing home Washington County");
      expect(result.entities).toEqual([]);
      expect(result.failClosed).toBeDefined();
      expect(result.query.terminalState).toBe("NEEDS_CLARIFICATION");
      expect(result.failClosed?.reason).toMatch(/OH, PA|PA, OH/);
    });
    it("a county with zero current matches fails closed honestly instead of defaulting anywhere", async () => {
      const result = await executeSeniorResearchQuery("nursing home Atlantis County");
      expect(result.entities).toEqual([]);
      expect(result.query.terminalState).toBe("UNSUPPORTED");
    });
    it("an explicit state on an unrecognized county is trusted directly, no DB round trip needed", async () => {
      const result = await executeSeniorResearchQuery("nursing home Washington County PA");
      expect(result.query.geography).toMatchObject({
        type: "county",
        value: "WASHINGTON",
        state: "PA",
      });
      expect(result.entities.map((e) => e.ccn)).toEqual(["PA0002"]);
    });
  });

  describe("class-chooser previews never leak cross-state or cross-class garbage", () => {
    it("a no-preposition city+state ambiguous class query scopes every class preview to that state", async () => {
      const result = await executeSeniorResearchQuery("senior care homes Newark NJ");
      expect(result.query.clarification).toBe("provider_class");
      expect(result.query.geography).toMatchObject({ type: "city", value: "NEWARK", state: "NJ" });
      const nursing = result.classPreviews?.find((g) => g.providerClass === "nursing_home");
      expect(nursing?.entities.map((e) => e.ccn)).toEqual(["NJ0001"]);
      expect(nursing?.entities.map((e) => e.ccn)).not.toContain("HI0001");
      // Zero real Home Health/Hospice rows in Newark is an honest zero, not a wrong-state fill-in.
      expect(
        result.classPreviews?.find((g) => g.providerClass === "home_health")?.entities,
      ).toEqual([]);
      expect(result.classPreviews?.find((g) => g.providerClass === "hospice")?.entities).toEqual(
        [],
      );
    });
  });

  describe("unsupported senior-care classes show broader CMS options instead of a dead end", () => {
    // Ohio has no dedicated state-specific adult-day-care research page (unlike the existing
    // Pennsylvania-specific override), so this exercises the new GENERAL unsupported-class handler.
    it("an unsupported class with a resolved county still shows real, geography-scoped CMS previews", async () => {
      const result = await executeSeniorResearchQuery("adult day care Washington County OH");
      expect(result.query.clarification).toBe("provider_class");
      expect(result.query.providerClass).toBeUndefined();
      const nursing = result.classPreviews?.find((g) => g.providerClass === "nursing_home");
      expect(nursing?.entities.map((e) => e.ccn)).toEqual(["OH0002"]);
      expect(nursing?.entities.map((e) => e.ccn)).not.toContain("PA0002");
    });
  });

  describe("brand-name identity search falls back to a name-fragment match instead of a bare dead end", () => {
    it("a full brand phrase that matches no exact record retries the bare brand across every class", async () => {
      const result = await executeSeniorResearchQuery("Brookdale Senior Living");
      expect(result.candidateSelection).toBe(true);
      const ccns = result.entities.map((e) => e.ccn);
      expect(ccns).toContain("ID0001");
      expect(ccns).toContain("NV9001");
      expect(result.limitations.join(" ")).toMatch(/name-fragment/i);
    });
    it("does not broaden when the exact phrase already matches a real current record", async () => {
      const result = await executeSeniorResearchQuery("Exact Match Senior Living");
      expect(result.candidateSelection).toBeUndefined();
      expect(result.entities.map((e) => e.ccn)).toEqual(["FL0009"]);
    });
  });
});
