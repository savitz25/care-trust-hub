import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("./db", () => ({ getCareDatabasePool: () => database }));

import { executeSeniorRequest, executeSeniorResearchQuery } from "./senior-ask-execute";

// TH-DISCOVERY-FINAL-REPAIR-B fresh regression fixtures, deliberately distinct providers/states from
// the TH-DISCOVERY-PARITY-001B corpus. This file exercises two things:
//
//  1. The Results-First fix: an unsupported/non-CMS class (memory care, retirement community, adult
//     day care...) combined with a genuinely ambiguous/unresolved city (e.g. "Tacoma" -- many states
//     could have a same-named city, and this system cannot prove otherwise) now shows a real,
//     HONESTLY-LABELED nationwide sample instead of a dead end -- never a silently-guessed state.
//  2. A live-audit DANGEROUS finding reported mid-ticket: "senior care Springfield" (a bare place
//     name with no preposition, no state code, no "County" keyword) previously vanished entirely at
//     the parsing stage, so the class-chooser's "See all nursing homes" (and the direct class
//     selection) ran an UNFILTERED NATIONAL query with zero disclosure that "Springfield" was ever
//     typed. Fixed generally (detectUnrecognizedBarePlace in senior-location.ts), not by
//     string-keying "Springfield".
const NH_FIXTURES = [
  {
    ccn: "CO0001",
    provider_name: "DENVER CARE CENTER",
    city: "DENVER",
    state_code: "CO",
    county_name: "Denver",
  },
  {
    ccn: "TX0001",
    provider_name: "AUSTIN CARE CENTER",
    city: "AUSTIN",
    state_code: "TX",
    county_name: "Travis",
  },
  {
    ccn: "WA0001",
    provider_name: "OLYMPIA CARE CENTER",
    city: "OLYMPIA",
    state_code: "WA",
    county_name: "Thurston",
  },
  {
    ccn: "FL0001",
    provider_name: "TAMPA CARE CENTER",
    city: "TAMPA",
    state_code: "FL",
    county_name: "Hillsborough",
  },
  // Real, obscure, same-named-city collisions this ticket's safety re-verification queries target --
  // each state's fixture must never leak into another state's query.
  {
    ccn: "FL0002",
    provider_name: "HOLLYWOOD FL CARE CENTER",
    city: "HOLLYWOOD",
    state_code: "FL",
    county_name: "Broward",
  },
  {
    ccn: "MD0001",
    provider_name: "HOLLYWOOD MD CARE CENTER",
    city: "HOLLYWOOD",
    state_code: "MD",
    county_name: "St. Marys",
  },
  {
    ccn: "CA0002",
    provider_name: "WEST HOLLYWOOD CARE CENTER",
    city: "WEST HOLLYWOOD",
    state_code: "CA",
    county_name: "Los Angeles",
  },
  {
    ccn: "CO0002",
    provider_name: "WELLINGTON CO CARE CENTER",
    city: "WELLINGTON",
    state_code: "CO",
    county_name: "Larimer",
  },
  {
    ccn: "FL0003",
    provider_name: "WELLINGTON FL CARE CENTER",
    city: "WELLINGTON",
    state_code: "FL",
    county_name: "Palm Beach",
  },
];
const HOSPICE_FIXTURES = [
  {
    cms_ccn: "FL0001H",
    provider_name: "TAMPA HOSPICE CARE",
    city: "TAMPA",
    state_code: "FL",
    zip_code: "33602",
  },
];
const clock = {
  display_name: "Synthetic FINAL-REPAIR-B fixture",
  source_organization: "CMS fixture",
  source_modified_at: new Date("2026-04-01T00:00:00Z"),
};

function likeValue(pattern: unknown): string {
  return String(pattern).replace(/^%|%$/g, "").toUpperCase();
}

async function fixtureDatabase(sql: string, values: unknown[] = []) {
  if (sql.includes("SELECT sd.display_name")) return { rows: [clock] };

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
        overall_rating: 4,
        staffing_rating: 3,
        health_inspection_rating: null,
        source_modified_at: clock.source_modified_at,
        ownership_type: null,
      })),
    };
  }

  if (sql.includes("home_health_snapshot") || sql.includes("hospice_snapshot")) {
    let rows = sql.includes("hospice_snapshot") ? [...HOSPICE_FIXTURES] : [];
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

describe("TH-DISCOVERY-FINAL-REPAIR-B", () => {
  beforeEach(() => {
    database.query.mockReset().mockImplementation(fixtureDatabase);
  });

  describe("ambiguous city + unsupported class shows an honest nationwide preview instead of a dead end", () => {
    it.each([
      ["memory care facility around Tacoma", "state_care"],
      ["retirement community around Tacoma", "provider_class"],
      ["adult day care around Tacoma", "provider_class"],
    ] as const)(
      "%s (clarification: %s) never guesses a state for Tacoma",
      async (q, clarification) => {
        const result = await executeSeniorResearchQuery(q);
        expect(result.query.clarification).toBe(clarification);
        // The state must never be guessed: geography stays an unresolved city.
        expect(result.query.geography).toMatchObject({ type: "city", value: "TACOMA" });
        expect(result.query.geography?.state).toBeUndefined();
        // The dead end this ticket fixes: a real, non-empty Results-First preview instead of nothing.
        expect(result.classPreviewsScoped).toBe(false);
        const nursing = result.classPreviews?.find((g) => g.providerClass === "nursing_home");
        expect(nursing?.entities.length).toBeGreaterThan(0);
        // No entity's "why matched" text claims a match to Tacoma -- these are disclosed as a broader
        // nationwide sample, never implying a Tacoma-area match.
        for (const entity of result.classPreviews?.flatMap((g) => g.entities) ?? []) {
          expect(entity.whyMatched.toUpperCase()).not.toContain("TACOMA");
        }
      },
    );

    // A second ambiguous city, distinct from Tacoma, proving the fix is general and not
    // string-keyed to one place name.
    it("a second ambiguous city ('Springfield', with an explicit 'near' clause) also gets an honest nationwide preview", async () => {
      const result = await executeSeniorResearchQuery("memory care near Springfield");
      expect(result.query.clarification).toBe("state_care");
      expect(result.query.geography).toMatchObject({ type: "city", value: "SPRINGFIELD" });
      expect(result.query.geography?.state).toBeUndefined();
      expect(result.classPreviewsScoped).toBe(false);
      const allPreviewEntities = result.classPreviews?.flatMap((g) => g.entities) ?? [];
      expect(allPreviewEntities.length).toBeGreaterThan(0);
      for (const entity of allPreviewEntities) {
        expect(entity.whyMatched.toUpperCase()).not.toContain("SPRINGFIELD");
      }
    });
  });

  describe("the nationwide preview is never silently scoped to one guessed state", () => {
    it("the nursing-home preview query for an ambiguous city carries no state/city/county filter at all", async () => {
      const result = await executeSeniorResearchQuery("memory care facility around Tacoma");
      expect(result.classPreviewsScoped).toBe(false);
      const nursing = result.classPreviews?.find((g) => g.providerClass === "nursing_home");
      // Genuinely nationwide: rows from more than one distinct state are present in a single
      // preview, which could never happen if one candidate state had been quietly picked.
      const states = new Set(nursing?.entities.map((e) => e.recordedLocation?.state));
      expect(states.size).toBeGreaterThan(1);
      // Direct proof at the SQL layer: the preview fetch itself applied no state/city/county
      // condition (excluding resolveCountyGeography's own unrelated "DISTINCT state_code" lookup,
      // which never runs here since Tacoma is a city, not a county).
      const previewCalls = database.query.mock.calls.filter(
        ([sql]) =>
          typeof sql === "string" &&
          sql.includes("FROM current_snapshots") &&
          !sql.includes("DISTINCT state_code"),
      );
      expect(previewCalls.length).toBeGreaterThan(0);
      for (const [sql] of previewCalls) {
        expect(sql).not.toMatch(/state_code=\$/);
        expect(sql).not.toMatch(/upper\(trim\(city\)\)=/);
        expect(sql).not.toMatch(/county_name ILIKE/);
      }
    });
  });

  // TH-DISCOVERY-FINAL-REPAIR-B DANGEROUS finding (found by an independent parallel audit mid-ticket):
  // "senior care Springfield" -- no preposition, no state code, no "County" keyword -- silently
  // dropped "Springfield" entirely at the parsing stage, so the class-chooser's "See all nursing
  // homes" link (classPreviews treating an entirely-absent geography as trivially "safe") and the
  // direct class-selection request (executeSeniorResearchPlan's own city-without-state guard never
  // firing because there was no geography object to catch) both ran an UNFILTERED NATIONAL query
  // with zero disclosure that "Springfield" was ever typed. Fixed generally via
  // detectUnrecognizedBarePlace() (senior-location.ts), gated on an already-detected CMS/senior-care
  // class signal so it never touches a plain provider-name/brand search.
  describe("a bare, unrecognized place name is never silently dropped into an undisclosed national query", () => {
    it("'senior care Springfield' discloses the place and keeps the class-chooser preview honestly empty (never a leaked nationwide list)", async () => {
      const result = await executeSeniorResearchQuery("senior care Springfield");
      expect(result.query.clarification).toBe("provider_class");
      // The place was NOT silently dropped: it is now disclosed as an unresolved city.
      expect(result.query.geography).toMatchObject({ type: "city", value: "SPRINGFIELD" });
      expect(result.query.locationRequirement?.outcome).toBe("NEEDS_CLARIFICATION");
      // This is a genuine CMS-trio ambiguity (Nursing/Home Health/Hospice ARE the literal requested
      // options), so it correctly stays a dead-end-safe EMPTY preview rather than substituting an
      // unscoped national sample that would misrepresent "Springfield".
      const allPreviewEntities = result.classPreviews?.flatMap((g) => g.entities) ?? [];
      expect(allPreviewEntities).toEqual([]);
    });

    it("'nursing home Springfield' (a concrete class, bare place, no preposition) never returns an undisclosed nationwide entity list", async () => {
      const result = await executeSeniorResearchQuery("nursing home Springfield");
      // Must fail closed asking for the state -- never silently run and return unrelated entities.
      expect(result.entities).toEqual([]);
      expect(result.failClosed).toBeDefined();
      expect(result.query.geography).toMatchObject({ type: "city", value: "SPRINGFIELD" });
      expect(result.query.locationRequirement).toBeDefined();
    });

    it("reproduces the exact production repro: picking 'Nursing Homes' from the class-chooser for 'senior care Springfield' never leaks a national entity list", async () => {
      // This mirrors the real request the class-chooser's link issues: the same raw question, plus
      // the `class` override, exactly as `seniorRequestHref` builds it.
      const result = await executeSeniorRequest({
        q: "senior care Springfield",
        class: "nursing_home",
        page: "1",
      });
      expect(result.entities).toEqual([]);
      expect(result.failClosed).toBeDefined();
      // Never silently answered as though "Springfield" resolved to any state.
      expect(result.query.geography?.state).toBeUndefined();
    });

    it("a plain provider-name/brand search is never reinterpreted as a location query by the new bare-place detector", async () => {
      const result = await executeSeniorResearchQuery("Denver Springs Senior Living");
      // No CMS/senior-care class signal is present, so this must remain an identity search, not a
      // location clarification -- proving the fix is gated correctly and does not overreach.
      expect(result.query.clarification).toBeUndefined();
      expect(result.query.geography).toBeUndefined();
    });
  });

  // The 7 production safety re-verification queries from this ticket, exercised here wherever a
  // dedicated fixture proves the exact same-named-city/state distinction matters. "senior care homes
  // Newark NJ" and "nursing home Sacramento County" (the two original DANGEROUS bugs) are already
  // covered by senior-ask-parity-001b.test.ts and are not duplicated here.
  describe("safety re-verification: same-named cities in different states never leak into each other", () => {
    it("'hospice near Tampa' resolves FL unambiguously and returns only the real Tampa FL hospice", async () => {
      const result = await executeSeniorResearchQuery("hospice near Tampa");
      expect(result.query.geography).toMatchObject({ type: "city", value: "TAMPA", state: "FL" });
      expect(result.entities.map((e) => e.ccn)).toEqual(["FL0001H"]);
    });

    it("'nursing home in West Hollywood California' resolves the real CA facility, never the FL or MD Hollywood fixtures", async () => {
      const result = await executeSeniorResearchQuery("nursing home in West Hollywood California");
      expect(result.query.geography).toMatchObject({
        type: "city",
        value: "WEST HOLLYWOOD",
        state: "CA",
      });
      expect(result.entities.map((e) => e.ccn)).toEqual(["CA0002"]);
      expect(result.entities.map((e) => e.ccn)).not.toContain("FL0002");
      expect(result.entities.map((e) => e.ccn)).not.toContain("MD0001");
    });

    it("'nursing home in Hollywood Florida' resolves the real FL facility, never the West Hollywood CA or Hollywood MD fixtures", async () => {
      const result = await executeSeniorResearchQuery("nursing home in Hollywood Florida");
      expect(result.query.geography).toMatchObject({
        type: "city",
        value: "HOLLYWOOD",
        state: "FL",
      });
      expect(result.entities.map((e) => e.ccn)).toEqual(["FL0002"]);
      expect(result.entities.map((e) => e.ccn)).not.toContain("CA0002");
      expect(result.entities.map((e) => e.ccn)).not.toContain("MD0001");
    });

    it("'nursing home in Hollywood Maryland' respects the explicit state and never defaults to the more famous Hollywood", async () => {
      const result = await executeSeniorResearchQuery("nursing home in Hollywood Maryland");
      expect(result.query.geography).toMatchObject({
        type: "city",
        value: "HOLLYWOOD",
        state: "MD",
      });
      expect(result.entities.map((e) => e.ccn)).toEqual(["MD0001"]);
      expect(result.entities.map((e) => e.ccn)).not.toContain("FL0002");
      expect(result.entities.map((e) => e.ccn)).not.toContain("CA0002");
    });

    it("'nursing home in Wellington Colorado' resolves the real CO town, never the better-known Wellington FL", async () => {
      const result = await executeSeniorResearchQuery("nursing home in Wellington Colorado");
      expect(result.query.geography).toMatchObject({
        type: "city",
        value: "WELLINGTON",
        state: "CO",
      });
      expect(result.entities.map((e) => e.ccn)).toEqual(["CO0002"]);
      expect(result.entities.map((e) => e.ccn)).not.toContain("FL0003");
    });

    it("a bare 'West Hollywood' with no state and no preposition-based resolution fails closed instead of guessing CA", async () => {
      const result = await executeSeniorResearchQuery("nursing home in West Hollywood");
      expect(result.entities).toEqual([]);
      expect(result.query.geography).toMatchObject({ type: "city", value: "WEST HOLLYWOOD" });
      expect(result.query.geography?.state).toBeUndefined();
    });
  });
});
