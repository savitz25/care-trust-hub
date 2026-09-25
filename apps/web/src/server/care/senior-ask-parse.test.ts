import { describe, expect, it } from "vitest";
import { interpretSeniorAskQuery } from "./senior-ask-parse";

describe("interpretSeniorAskQuery", () => {
  it("parses Florida nursing homes as current NH entity", () => {
    const q = interpretSeniorAskQuery("Show nursing homes in Florida.");
    expect(q.mode).toBe("entity");
    expect(q.providerClass).toBe("nursing_home");
    expect(q.geography?.value).toBe("FL");
    expect(q.sort).toBe("name");
  });

  it("parses Palm Beach county as address county", () => {
    const q = interpretSeniorAskQuery("Show nursing homes in Palm Beach County.");
    expect(q.providerClass).toBe("nursing_home");
    expect(q.geography?.type).toBe("county");
    expect(q.geography?.value).toBe("PALM BEACH");
    expect(q.geography?.meaning).toMatch(/not service territory/i);
  });

  it("parses labeled CCN", () => {
    const q = interpretSeniorAskQuery("Find CMS CCN 105502");
    expect(q.mode).toBe("identifier");
    expect(q.identifier).toEqual({ type: "ccn", value: "105502" });
  });

  it("fails closed on bare digits", () => {
    const q = interpretSeniorAskQuery("105502");
    expect(q.mode).toBe("fail_closed");
  });

  it("fails closed on best nursing home", () => {
    const q = interpretSeniorAskQuery("What is the best nursing home in Florida?");
    expect(q.mode).toBe("fail_closed");
    expect(q.failReason).toMatch(/does not publish a “best/i);
  });

  it("fails closed on 5-star hospice", () => {
    const q = interpretSeniorAskQuery("Show 5-star hospice providers.");
    expect(q.mode).toBe("fail_closed");
    expect(q.failReason).toMatch(/overall CMS star/i);
  });

  it("fails closed on combined senior count", () => {
    const q = interpretSeniorAskQuery("How many senior providers total?");
    expect(q.mode).toBe("fail_closed");
  });

  it("fails closed on Home Health CHOW", () => {
    const q = interpretSeniorAskQuery("Show home health agencies with recent ownership changes.");
    expect(q.mode).toBe("fail_closed");
    expect(q.failReason).toMatch(/CHOW/i);
  });

  it("fails closed on Home Health county", () => {
    const q = interpretSeniorAskQuery("Show home health agencies in Miami-Dade County.");
    expect(q.mode).toBe("fail_closed");
  });

  it("parses 5 overall stars as NH quality filter", () => {
    const q = interpretSeniorAskQuery("Show Florida nursing homes with 5 CMS overall stars.");
    expect(q.providerClass).toBe("nursing_home");
    expect(q.qualityFilters?.overallStars).toEqual([5]);
  });

  it("preserves Colorado scope and requires a state for a city-only Denver request", () => {
    const q = interpretSeniorAskQuery("Show nursing homes in Colorado.");
    expect(q.mode).toBe("entity");
    expect(q.providerClass).toBe("nursing_home");
    expect(q.geography?.value).toBe("CO");
    const denver = interpretSeniorAskQuery("Show nursing homes in Denver.");
    expect(denver.geography?.value).toBe("DENVER");
    expect(denver.mode).toBe("fail_closed");
    expect(denver.locationRequirement?.outcome).toBe("NEEDS_CLARIFICATION");
  });

  it("keeps existing six-state search routes intact", () => {
    expect(interpretSeniorAskQuery("nursing homes in Florida").geography?.value).toBe("FL");
    expect(interpretSeniorAskQuery("nursing homes in New Jersey").geography?.value).toBe("NJ");
    expect(interpretSeniorAskQuery("nursing homes in California").geography?.value).toBe("CA");
    expect(interpretSeniorAskQuery("nursing homes in Texas").geography?.value).toBe("TX");
    expect(interpretSeniorAskQuery("nursing homes in Washington").geography?.value).toBe("WA");
    expect(interpretSeniorAskQuery("nursing homes in Arizona").geography?.value).toBe("AZ");
    expect(interpretSeniorAskQuery("nursing homes in Illinois").geography?.value).toBe("IL");
  });

  it("keeps Illinois classes and complaint/search-only paths fail-closed", () => {
    const nh = interpretSeniorAskQuery("nursing homes in Illinois");
    expect(nh.mode).toBe("entity");
    expect(nh.providerClass).toBe("nursing_home");
    expect(nh.geography?.value).toBe("IL");
    const count = interpretSeniorAskQuery(
      "How many nursing homes are currently indexed in Illinois?",
    );
    expect(count.mode).toBe("count");
    expect(count.providerClass).toBe("nursing_home");
    const al = interpretSeniorAskQuery("assisted living in Illinois");
    expect(al.mode).toBe("fail_closed");
    expect(al.coverageState).toBe("NOT_ACQUIRED");
    const slp = interpretSeniorAskQuery("supportive living in Illinois");
    expect(slp.mode).toBe("fail_closed");
    expect(slp.failReason).toMatch(/Supportive Living/i);
    const complaints = interpretSeniorAskQuery("complaints against a nursing home in Illinois");
    expect(complaints.mode).toBe("fail_closed");
    expect(complaints.failReason).toMatch(/not a survey deficiency/i);
    const best = interpretSeniorAskQuery("best nursing home in Illinois");
    expect(best.mode).toBe("fail_closed");
    const chicago = interpretSeniorAskQuery("safe nursing home in Chicago");
    expect(chicago.mode).toBe("fail_closed");
    const hha = interpretSeniorAskQuery("home health agencies in Illinois");
    expect(hha.providerClass).toBe("home_health");
    const hospice = interpretSeniorAskQuery("hospice in Illinois");
    expect(hospice.providerClass).toBe("hospice");
  });

  it("keeps Oregon ODHS classes, inspections, violations, and license-condition scope fail-closed", () => {
    const al = interpretSeniorAskQuery("Find assisted living facilities in Oregon.");
    expect(al.mode).toBe("fail_closed");
    expect(al.failReason).toMatch(/Assisted Living/i);
    const id = interpretSeniorAskQuery("Show the license conditions for provider 70M053.");
    expect(id.mode).toBe("fail_closed");
    expect(id.failReason).toMatch(/70M053/);
    expect(id.failReason).toMatch(/license conditions only|Provider ID is not a CMS CCN/i);
    const insp = interpretSeniorAskQuery(
      "What inspections has this nursing facility had in Oregon?",
    );
    expect(insp.mode).toBe("fail_closed");
    expect(insp.failReason).toMatch(/Event ID|not a complaint/i);
    const viol = interpretSeniorAskQuery(
      "Does this facility have substantiated violations in Oregon?",
    );
    expect(viol.mode).toBe("fail_closed");
    expect(viol.failReason).toMatch(/not a complaint/i);
    const actions = interpretSeniorAskQuery(
      "Were there regulatory actions against this provider in Oregon?",
    );
    expect(actions.mode).toBe("fail_closed");
    expect(actions.failReason).toMatch(/license conditions/i);
    const count = interpretSeniorAskQuery(
      "How many Oregon nursing facilities are in the ODHS snapshot?",
    );
    expect(count.mode).toBe("fail_closed");
    expect(count.failReason).toMatch(/128/);
    const cms = interpretSeniorAskQuery("Is this Oregon provider CMS-certified?");
    expect(cms.mode).toBe("fail_closed");
    expect(cms.failReason).toMatch(/0 in this snapshot|0 exact/);
    const licensed = interpretSeniorAskQuery("Is this Oregon facility licensed?");
    expect(licensed.mode).toBe("fail_closed");
    expect(licensed.failReason).toMatch(/class-specific|not CMS/i);
  });

  it("parses home health Florida entity", () => {
    const q = interpretSeniorAskQuery("Show home health agencies in Florida.");
    expect(q.mode).toBe("entity");
    expect(q.providerClass).toBe("home_health");
    expect(q.geography?.value).toBe("FL");
  });

  it("parses hospice Florida entity", () => {
    const q = interpretSeniorAskQuery("Show hospice providers in Florida.");
    expect(q.providerClass).toBe("hospice");
  });

  it("parses NH count", () => {
    const q = interpretSeniorAskQuery("How many nursing homes are currently indexed in Florida?");
    expect(q.mode).toBe("count");
    expect(q.providerClass).toBe("nursing_home");
  });

  it("parses ambiguous senior care as class choice", () => {
    const q = interpretSeniorAskQuery("Show senior care providers in Florida.");
    expect(q.mode).toBe("fail_closed");
    expect(q.alternatives?.join(" ")).toMatch(/Nursing homes/i);
  });

  it("parses CHOW as nursing home entity metric", () => {
    const q = interpretSeniorAskQuery("Show nursing homes with recent ownership-change evidence.");
    expect(q.providerClass).toBe("nursing_home");
    expect(q.metric).toBe("chow");
  });

  it("keeps Pennsylvania PCH, home care, LIFE, and local cities fail-closed", () => {
    const pch = interpretSeniorAskQuery("personal care homes Pennsylvania");
    expect(pch.mode).toBe("fail_closed");
    expect(pch.failReason).toMatch(/Personal Care Homes/i);
    const homeCare = interpretSeniorAskQuery("home care agencies Pennsylvania");
    expect(homeCare.mode).toBe("fail_closed");
    expect(homeCare.failReason).toMatch(/Home Care/i);
    const life = interpretSeniorAskQuery("LIFE program Pennsylvania");
    expect(life.mode).toBe("fail_closed");
    expect(life.failReason).toMatch(/LIFE\/PACE/i);
    const phl = interpretSeniorAskQuery("senior care Philadelphia");
    expect(phl.mode).toBe("fail_closed");
    expect(phl.failReason).toMatch(/Philadelphia/i);
    const pit = interpretSeniorAskQuery("assisted living Pittsburgh");
    expect(pit.mode).toBe("fail_closed");
    const sanc = interpretSeniorAskQuery("nursing home sanctions Pennsylvania");
    expect(sanc.mode).toBe("fail_closed");
    expect(sanc.failReason).toMatch(/sanction/i);
  });

  it("parses Pennsylvania nursing homes and a labeled CCN without inventing a local route", () => {
    const q = interpretSeniorAskQuery("nursing homes in Pennsylvania");
    expect(q.mode).toBe("entity");
    expect(q.providerClass).toBe("nursing_home");
    expect(q.geography?.value).toBe("PA");
    const ccn = interpretSeniorAskQuery("Find CMS CCN 395199");
    expect(ccn.mode).toBe("identifier");
    expect(ccn.identifier).toEqual({ type: "ccn", value: "395199" });
  });

  // TH-DISCOVERY-PARITY-001B fresh regression corpus. Distinct from the 7 FAIL + 2 DANGEROUS
  // production-audit strings that motivated this ticket -- these exercise the same GENERAL rules
  // (no-preposition geography, county-without-state deferral, unsupported-class detection, brand
  // identity) with different phrasing, states, prepositions and singular/plural forms so the fix
  // is verified as general rather than re-testing the exact audit strings.
  describe("no-preposition and mixed-preposition geography resolves the same as an explicit 'in <place>' clause", () => {
    it.each([
      ["nursing homes Trenton NJ", "city", "TRENTON", "NJ"],
      ["nursing home near Trenton, New Jersey", "city", "TRENTON", "NJ"],
      ["home health agency Round Rock TX", "city", "ROUND ROCK", "TX"],
      ["nursing home Fresno CA", "city", "FRESNO", "CA"],
      ["hospice providers in San Diego, CA", "city", "SAN DIEGO", "CA"],
      ["nursing homes Denver CO", "city", "DENVER", "CO"],
    ] as const)("%s -> %s %s, %s", (raw, type, value, state) => {
      const q = interpretSeniorAskQuery(raw);
      expect(q.geography).toMatchObject({ type, value, state });
      expect(q.mode).toBe("entity");
    });
    it.each([
      ["hospice King County WA", "KING", "WA"],
      ["nursing homes Snohomish County WA", "SNOHOMISH", "WA"],
    ] as const)("%s resolves a no-preposition county+state", (raw, value, state) => {
      const q = interpretSeniorAskQuery(raw);
      expect(q.geography).toMatchObject({ type: "county", value, state });
    });
    it("Home Health county stays fail-closed even with a no-preposition county+state", () => {
      expect(interpretSeniorAskQuery("home health agencies Boulder County CO").mode).toBe(
        "fail_closed",
      );
    });
    // A full state NAME mentioned anywhere in the query (as opposed to its two-letter code) is a
    // pre-existing, separately-established precedent that takes priority and resolves the whole
    // query to that state (see "preserves Colorado scope..." and the Boulder/Snohomish-with-full-
    // state-name cases below) -- it is not a new gap this ticket introduces, and it never produces
    // a WRONG state, only a less city/county-specific one.
    it("a full state name anywhere still resolves to that state, never a wrong one", () => {
      expect(interpretSeniorAskQuery("retirement community Boulder Colorado").geography).toEqual({
        type: "state",
        value: "CO",
        meaning: expect.any(String),
      });
      expect(
        interpretSeniorAskQuery("nursing homes Snohomish County Washington").geography,
      ).toEqual({ type: "state", value: "WA", meaning: expect.any(String) });
    });
  });

  it("Broward County, established without a state, still conflicts with an explicitly wrong state", () => {
    expect(interpretSeniorAskQuery("hospice Broward County FL").geography).toMatchObject({
      type: "county",
      value: "BROWARD",
      state: "FL",
    });
    const conflict = interpretSeniorAskQuery("nursing home Broward County TX");
    expect(conflict.mode).toBe("fail_closed");
    expect(conflict.terminalState).toBe("NEEDS_CLARIFICATION");
  });

  it("a general (non-Florida-established) county with no explicit state defers resolution instead of rejecting outright", () => {
    const q = interpretSeniorAskQuery("nursing homes Sacramento County");
    expect(q.mode).toBe("entity");
    expect(q.providerClass).toBe("nursing_home");
    expect(q.geography).toMatchObject({ type: "county", value: "SACRAMENTO" });
    expect(q.geography?.state).toBeUndefined();
    expect(q.locationRequirement?.outcome).toBe("APPLIED");
  });

  it("Home Health county stays unsupported regardless of preposition or established-county status", () => {
    expect(interpretSeniorAskQuery("home health agencies Miami-Dade County").mode).toBe(
      "fail_closed",
    );
    expect(interpretSeniorAskQuery("home health agency Sacramento County").mode).toBe(
      "fail_closed",
    );
  });

  it("a bare class with no location at all still resolves the class without crashing", () => {
    const q = interpretSeniorAskQuery("hospice providers");
    expect(q.providerClass).toBe("hospice");
    expect(q.geography).toBeUndefined();
    expect(q.mode).not.toBe("fail_closed");
  });

  describe("unsupported state-regulated classes never masquerade as a CMS class or a company-name search", () => {
    it.each([
      "assisted living options near Sarasota Florida",
      "memory care near Spokane Washington",
      "retirement communities in Scottsdale Arizona",
      "independent living Reno Nevada",
      "adult day services Trenton NJ",
      "adult daycare center in Fort Worth Texas",
      "in-home care options for seniors",
      "caregiver agency Tampa Florida",
      "companion care services in Denver Colorado",
      "continuing care retirement community in Naples Florida",
      "board and care home Fresno California",
      "home care agency Newark New Jersey",
      "elder care options",
    ])("%s", (raw) => {
      const q = interpretSeniorAskQuery(raw);
      expect(q.mode).toBe("fail_closed");
      // Never silently reinterpreted as a company-name/identity search.
      expect(q.identityQuery).toBeUndefined();
      // Always one of the two honest clarification paths, never a bare unexplained dead end.
      expect(["provider_class", "state_care"]).toContain(q.clarification);
      expect(q.failReason).toBeTruthy();
    });
  });

  // TH-SEARCH-R1-019E-R2: ranking/quality-INTENT wording ("top rated", "highest rated", a bare
  // "top" directly modifying a CMS category noun) must never collapse a category+geography request
  // into a literal identity/name search -- providerClass and geography must survive.
  describe("ranking/quality-intent wording stays a category request, never a literal name search", () => {
    it.each([
      "top rated nursing homes in Florida",
      "top nursing homes in Florida",
      "top rated hospice in Florida",
      "highly rated nursing homes in Texas",
      "highest rated nursing homes in Florida",
    ])("%s", (raw) => {
      const q = interpretSeniorAskQuery(raw);
      expect(q.mode).toBe("entity");
      expect(q.providerClass).toBeTruthy();
      expect(q.geography?.value).toBeTruthy();
      // Never silently reinterpreted as a literal-string provider-name search.
      expect(q.identityQuery).toBeUndefined();
    });

    it("'best rated home health agencies in New York' keeps providerClass and geography even though the honest answer declines to rank", () => {
      const q = interpretSeniorAskQuery("best rated home health agencies in New York");
      expect(q.providerClass).toBe("home_health");
      expect(q.geography?.value).toBe("NY");
      expect(q.identityQuery).toBeUndefined();
    });

    it("'nursing homes with 5 stars in Florida' (digit form) also keeps providerClass and geography", () => {
      const q = interpretSeniorAskQuery("nursing homes with 5 stars in Florida");
      expect(q.mode).toBe("entity");
      expect(q.providerClass).toBe("nursing_home");
      expect(q.geography?.value).toBe("FL");
      expect(q.identityQuery).toBeUndefined();
    });
  });

  // A real provider's own registered name commonly carries the exact bare adjectives that signal
  // ranking intent elsewhere ("Premier", "Five Star", "Top", "Best", "Quality") -- the fix above must
  // recognize ranking intent only in its idiomatic phrase shapes, never by treating those words as
  // free-floating generic vocabulary, or a genuine brand name built from them would be misread as a
  // bare category browse.
  describe("real provider names built from ranking-sounding words are never misread as category browses", () => {
    it.each([
      "AMERICAN PREMIER HOME HEALTH CARE",
      "FIVE STAR HOME HEALTH CARE",
      "A QUALITY HOME CARE, INC",
      "HOLLYWOOD PREMIER HEALTHCARE CENTER",
    ])("%s", (raw) => {
      const q = interpretSeniorAskQuery(raw);
      expect(q.mode).toBe("entity");
      expect(q.identityQuery).toBe(raw);
      expect(q.providerClass).toBeUndefined();
    });
  });

  describe("national senior-living brand identity controls", () => {
    it.each(["Sunrise Senior Living community", "Atria Senior Living facility"])(
      "%s is treated as an identity search, not an unsupported class",
      (raw) => {
        const q = interpretSeniorAskQuery(raw);
        expect(q.mode).toBe("entity");
        expect(q.identityQuery).toBeTruthy();
        expect(q.clarification).toBeUndefined();
      },
    );
    it("an explicit Find prefix keeps the exact brand+city phrase as one identity", () => {
      const q = interpretSeniorAskQuery("Find Brookdale of Boise");
      expect(q.mode).toBe("entity");
      expect(q.identityQuery).toBe("Brookdale of Boise");
      expect(q.geography).toBeUndefined();
    });
  });

  it("keeps North Carolina ACH, FCH, Home Care, Star Rating, and cities fail-closed", () => {
    const al = interpretSeniorAskQuery("assisted living North Carolina");
    expect(al.mode).toBe("fail_closed");
    expect(al.failReason).toMatch(/Adult Care Homes and Family Care Homes/i);
    expect(al.failReason).not.toMatch(/Nursing Home is synonymous/i);
    const ach = interpretSeniorAskQuery("adult care home North Carolina");
    expect(ach.mode).toBe("fail_closed");
    expect(ach.failReason).toMatch(/Adult Care Homes/i);
    const fch = interpretSeniorAskQuery("family care home North Carolina");
    expect(fch.mode).toBe("fail_closed");
    expect(fch.failReason).toMatch(/Family Care Homes/i);
    const star = interpretSeniorAskQuery("adult care star rating North Carolina");
    expect(star.mode).toBe("fail_closed");
    expect(star.failReason).toMatch(/NC DHSR/i);
    expect(star.failReason).toMatch(/not a TrustHub score/i);
    const best = interpretSeniorAskQuery("best assisted living North Carolina");
    expect(best.mode).toBe("fail_closed");
    expect(best.failReason).toMatch(/does not rank|Adult Care Homes and Family Care Homes/i);
    const hc = interpretSeniorAskQuery("home care agency North Carolina");
    expect(hc.mode).toBe("fail_closed");
    expect(hc.failReason).toMatch(/mixed/i);
    const clt = interpretSeniorAskQuery("senior care Charlotte");
    expect(clt.mode).toBe("fail_closed");
    expect(clt.failReason).toMatch(/Charlotte|statewide|North Carolina/i);
    const ral = interpretSeniorAskQuery("assisted living Raleigh");
    expect(ral.mode).toBe("fail_closed");
    expect(ral.failReason).not.toMatch(/\/north-carolina\/raleigh/);
    const hh = interpretSeniorAskQuery("home health agency North Carolina");
    expect(hh.mode).toBe("fail_closed");
    expect(hh.failReason).toMatch(/Home Health/i);
    const hos = interpretSeniorAskQuery("hospice North Carolina");
    expect(hos.mode).toBe("fail_closed");
    expect(hos.failReason).toMatch(/Hospice/i);
    const adc = interpretSeniorAskQuery("adult day care North Carolina");
    expect(adc.mode).toBe("fail_closed");
    expect(adc.failReason).toMatch(/Adult Day/i);
    const pace = interpretSeniorAskQuery("PACE North Carolina");
    expect(pace.mode).toBe("fail_closed");
    expect(pace.failReason).toMatch(/PACE/i);
    const ccrc = interpretSeniorAskQuery("CCRC North Carolina");
    expect(ccrc.mode).toBe("fail_closed");
    expect(ccrc.failReason).toMatch(/CCRC/i);
    const bestNh = interpretSeniorAskQuery("best nursing home North Carolina");
    expect(bestNh.mode).toBe("fail_closed");
    expect(bestNh.failReason).toMatch(/does not rank/i);
  });

  it("parses North Carolina nursing homes and a labeled NC CCN without inventing a local route", () => {
    const q = interpretSeniorAskQuery("nursing homes in North Carolina");
    expect(q.mode).toBe("entity");
    expect(q.providerClass).toBe("nursing_home");
    expect(q.geography?.value).toBe("NC");
    const ccn = interpretSeniorAskQuery("Find CMS CCN 345127");
    expect(ccn.mode).toBe("identifier");
    expect(ccn.identifier).toEqual({ type: "ccn", value: "345127" });
    const lic = interpretSeniorAskQuery("HAL-001-173 North Carolina");
    expect(lic.mode).toBe("fail_closed");
    expect(lic.failReason).toMatch(/HAL-001-173/i);
  });

  it("keeps Ohio RCF, Navigator, Home Health, cities, and ranking fail-closed", () => {
    const al = interpretSeniorAskQuery("assisted living Ohio");
    expect(al.mode).toBe("fail_closed");
    expect(al.failReason).toMatch(/Residential Care Facilit/i);
    expect(al.failReason).not.toMatch(/Nursing Home is synonymous/i);
    const rcf = interpretSeniorAskQuery("residential care facility Ohio");
    expect(rcf.mode).toBe("fail_closed");
    expect(rcf.failReason).toMatch(/Residential Care Facilit/i);
    const nav = interpretSeniorAskQuery("long term care quality navigator Ohio");
    expect(nav.mode).toBe("fail_closed");
    expect(nav.failReason).toMatch(/Navigator/i);
    expect(nav.failReason).toMatch(/not a TrustHub score/i);
    const insp = interpretSeniorAskQuery("nursing home inspection Ohio");
    expect(insp.mode).toBe("fail_closed");
    expect(insp.failReason).toMatch(/inspection is not a complaint/i);
    const def = interpretSeniorAskQuery("nursing home deficiencies Ohio");
    expect(def.mode).toBe("fail_closed");
    expect(def.failReason).toMatch(/deficienc/i);
    const viol = interpretSeniorAskQuery("assisted living violations Ohio");
    expect(viol.mode).toBe("fail_closed");
    const hh = interpretSeniorAskQuery("home health agency Ohio");
    expect(hh.mode).toBe("fail_closed");
    expect(hh.failReason).toMatch(/Skilled is not nonmedical/i);
    const skilled = interpretSeniorAskQuery("skilled home health Ohio");
    expect(skilled.mode).toBe("fail_closed");
    const nonmed = interpretSeniorAskQuery("nonmedical home health Ohio");
    expect(nonmed.mode).toBe("fail_closed");
    const hos = interpretSeniorAskQuery("hospice Ohio");
    expect(hos.mode).toBe("fail_closed");
    expect(hos.failReason).toMatch(/License is not location/i);
    const pace = interpretSeniorAskQuery("PACE Ohio");
    expect(pace.mode).toBe("fail_closed");
    expect(pace.failReason).toMatch(/PACE/i);
    const adc = interpretSeniorAskQuery("adult day care Ohio");
    expect(adc.mode).toBe("fail_closed");
    expect(adc.failReason).toMatch(/Adult Day/i);
    const bestNh = interpretSeniorAskQuery("best nursing home Ohio");
    expect(bestNh.mode).toBe("fail_closed");
    expect(bestNh.failReason).toMatch(/does not rank/i);
    expect(bestNh.failReason).toMatch(/does not select a winner/i);
    const bestAl = interpretSeniorAskQuery("best assisted living Ohio");
    expect(bestAl.mode).toBe("fail_closed");
    expect(bestAl.failReason).toMatch(/does not rank|Residential Care/i);
    const col = interpretSeniorAskQuery("senior care Columbus");
    expect(col.mode).toBe("fail_closed");
    expect(col.failReason).toMatch(/Columbus|statewide|Ohio|class-specific/i);
    const cle = interpretSeniorAskQuery("assisted living Cleveland");
    expect(cle.mode).toBe("fail_closed");
    expect(cle.failReason).not.toMatch(/\/ohio\/cleveland/);
    const senior = interpretSeniorAskQuery("senior care Ohio");
    expect(senior.mode).toBe("fail_closed");
    expect(senior.failReason).toMatch(/class-specific/i);
  });

  it("keeps Georgia classes, Atlanta, and CMS nursing homes apart", () => {
    const al = interpretSeniorAskQuery("assisted living in Georgia");
    expect(al.mode).toBe("fail_closed");
    expect(al.coverageState).toBe("NOT_ACQUIRED");
    expect(al.failReason).toMatch(/Assisted Living Community/);
    expect(al.failReason).toMatch(/Personal Care Home/);
    expect(al.failReason).toMatch(/2,910/);
    const pch = interpretSeniorAskQuery("personal care homes in Georgia");
    expect(pch.coverageState).toBe("NOT_ACQUIRED");
    expect(pch.failReason).toMatch(/111-8-62/);
    const insp = interpretSeniorAskQuery("Georgia assisted living inspections");
    expect(insp.coverageState).toBe("NOT_ACQUIRED");
    const complaint = interpretSeniorAskQuery("complaints about a Georgia nursing home");
    expect(complaint.coverageState).toBe("REQUEST_ONLY");
    const license = interpretSeniorAskQuery("is Savannah Manor licensed in Georgia");
    expect(license.mode).toBe("fail_closed");
    expect(license.failReason).toMatch(/not a CMS CCN/i);
    const senior = interpretSeniorAskQuery("senior care in Georgia");
    expect(senior.failReason).toMatch(/no combined Georgia/i);
    const atlanta = interpretSeniorAskQuery("senior care in Atlanta");
    expect(atlanta.failReason).toMatch(/not a Georgia license system/i);
    expect(atlanta.failReason).not.toMatch(/\/georgia\/atlanta/);
    const nh = interpretSeniorAskQuery("nursing homes in Georgia");
    expect(nh.mode).toBe("entity");
    expect(nh.providerClass).toBe("nursing_home");
    expect(nh.geography?.value).toBe("GA");
    const hh = interpretSeniorAskQuery("home health in Georgia");
    expect(hh.mode).toBe("entity");
    expect(hh.providerClass).toBe("home_health");
    const hospice = interpretSeniorAskQuery("hospice in Georgia");
    expect(hospice.mode).toBe("entity");
    expect(hospice.providerClass).toBe("hospice");
  });

  it("NV-SEN-001 keeps Nevada classes separate, endorsements exact, and leaves CMS classes to CMS research", () => {
    const fr = (q: string) => interpretSeniorAskQuery(q).failReason ?? "";
    for (const [q, cls] of [
      ["nursing homes Nevada", "nursing_home"],
      ["skilled nursing Nevada", "nursing_home"],
      ["nursing home Las Vegas", "nursing_home"],
      ["home health Nevada", "home_health"],
      ["home health agency Nevada", "home_health"],
      ["hospice Nevada", "hospice"],
      ["hospice care Nevada", "hospice"],
    ] as const) {
      const r = interpretSeniorAskQuery(q);
      expect(r.mode, q).toBe("entity");
      expect(r.providerClass, q).toBe(cls);
    }
    expect(interpretSeniorAskQuery("CCN 295102 Nevada").mode).toBe("identifier");
    expect(fr("CCN 295102 Nevada")).not.toMatch(/Nevada senior-care research/);
    expect(fr("assisted living Nevada")).toMatch(
      /assisted living is an endorsement, not a separate license/,
    );
    expect(fr("assisted living Nevada")).toMatch(
      /438 active RFGs .* 74 print the Assisted Living endorsement/,
    );
    expect(fr("assisted living facility Nevada")).toMatch(/Not every RFG is assisted living/);
    expect(fr("Residential Facility for Groups Nevada")).toMatch(/base state license/);
    expect(fr("RFG Nevada")).toMatch(/Residential Facility for Groups \(RFG\)/);
    expect(fr("assisted living Las Vegas")).toMatch(
      /270 RFGs list an address in Las Vegas, 32 of them with the Assisted Living endorsement/,
    );
    expect(fr("memory care Nevada")).toMatch(/223 of 438 RFGs print it/);
    expect(fr("dementia facility Nevada")).toMatch(
      /state-endorsed only if its license shows the endorsement/,
    );
    expect(fr("home for individual residential care Nevada")).toMatch(/145 active HIRCs/);
    expect(fr("senior facility inspections Nevada")).toMatch(/3,942 state inspections/);
    expect(interpretSeniorAskQuery("assisted living complaint Nevada").coverageState).toBe(
      "REQUEST_ONLY",
    );
    expect(interpretSeniorAskQuery("nursing home complaint Nevada").coverageState).toBe(
      "REQUEST_ONLY",
    );
    expect(fr("nursing home complaint Nevada")).toMatch(
      /not a deficiency and not an enforcement finding/,
    );
    expect(fr("116-AGC-41")).toMatch(/FIVE STAR PREMIER RESIDENCES OF RENO/);
    expect(fr("RFG license 116")).toMatch(/116-AGC-41/);
    expect(fr("license 116 Nevada")).toMatch(/does not say which Nevada facility class/);
    expect(fr("senior care in Nevada")).toMatch(/no combined Nevada senior-facility/i);
    expect(fr("best assisted living Nevada")).toMatch(/does not rank Nevada/);
    const all = ["assisted living Nevada", "memory care Nevada", "Nevada HCQC licenses"]
      .map(fr)
      .join(" ");
    expect(all).not.toMatch(/\b676\b|\b736\b|\b1,?017\b/); // no combined classes (SNF+SFD+RFG+HIRC+ADC etc.)
    expect(fr("memory care Tennessee")).toMatch(/Memory care is not a CMS provider class/);
    expect(fr("assisted living Las Vegas NM")).not.toMatch(/Residential Facility for Groups/);
    expect(interpretSeniorAskQuery("assisted living Tennessee").failReason).toMatch(/ACLF/);
  });

  it("TN-SEN-001 keeps Tennessee classes separate and leaves CMS classes to CMS research", () => {
    const fr = (q: string) => interpretSeniorAskQuery(q).failReason ?? "";
    for (const [q, cls] of [
      ["nursing homes Tennessee", "nursing_home"],
      ["nursing home Tennessee", "nursing_home"],
      ["nursing home Nashville Tennessee", "nursing_home"],
      ["home health Tennessee", "home_health"],
      ["home health agency Tennessee", "home_health"],
      ["hospice Tennessee", "hospice"],
      ["hospice provider Tennessee", "hospice"],
    ] as const) {
      const r = interpretSeniorAskQuery(q);
      expect(r.mode, q).toBe("entity");
      expect(r.providerClass, q).toBe(cls);
      expect(r.geography?.value ?? r.geography?.state, q).toBe("TN");
    }
    expect(interpretSeniorAskQuery("assisted living Tennessee").coverageState).toBe("KNOWN");
    expect(fr("assisted living Tennessee")).toMatch(/331 ACLFs/);
    expect(fr("assisted care living Tennessee")).toMatch(/Assisted Care Living Facility \(ACLF\)/);
    expect(fr("ACLF Tennessee")).toMatch(/not a Residential Home for the Aged/);
    expect(fr("assisted living Nashville")).toMatch(/18 list an address in Nashville/);
    expect(fr("home for the aged Tennessee")).toMatch(/39 RHAs/);
    expect(fr("residential home for the aged Tennessee")).toMatch(/not an Assisted Care Living/);
    expect(fr("nursing home inspections Tennessee")).toMatch(/Statements of Deficiencies/);
    expect(fr("Tennessee nursing home enforcement")).toMatch(/201 actions/);
    expect(fr("senior facility discipline Tennessee")).toMatch(/Facility Action and Abuse/);
    expect(interpretSeniorAskQuery("facility complaints Tennessee").coverageState).toBe(
      "REQUEST_ONLY",
    );
    expect(fr("Tennessee ACLF license 115")).toMatch(/Charter Senior Living of Cleveland/);
    expect(fr("TN nursing home license 127")).toMatch(/Briarwood Community Living Center/);
    expect(fr("senior care in Tennessee")).toMatch(/no combined Tennessee senior-facility/i);
    expect(fr("best nursing home Tennessee")).toMatch(/does not rank Tennessee/);
    const all = [
      "assisted living Tennessee",
      "home for the aged Tennessee",
      "nursing home license Tennessee",
    ].map(fr);
    expect(all.join(" ")).not.toMatch(/\b696\b|\b60,?606\b|\b23,?876\b/); // no combined classes or beds
    const ccn = interpretSeniorAskQuery("CCN 445001");
    expect(ccn.failReason ?? "").not.toMatch(/Tennessee senior-care research/);
    expect(interpretSeniorAskQuery("assisted living Massachusetts").failReason).toMatch(/AGE/);
  });

  it("MA-SEN-001 keeps Massachusetts classes separate and leaves CMS classes to CMS research", () => {
    const fr = (q: string) => interpretSeniorAskQuery(q).failReason ?? "";
    for (const [q, cls] of [
      ["nursing homes Massachusetts", "nursing_home"],
      ["nursing home Boston Massachusetts", "nursing_home"],
      ["home health Massachusetts", "home_health"],
      ["home health agency Massachusetts", "home_health"],
      ["hospice Massachusetts", "hospice"],
      ["hospice provider Massachusetts", "hospice"],
    ] as const) {
      const r = interpretSeniorAskQuery(q);
      expect(r.mode, q).toBe("entity");
      expect(r.providerClass, q).toBe(cls);
      expect(r.geography?.value, q).toBe("MA");
    }
    expect(interpretSeniorAskQuery("assisted living Massachusetts").coverageState).toBe("KNOWN");
    expect(fr("assisted living Massachusetts")).toMatch(/272 certified residences/);
    expect(fr("assisted living Massachusetts")).toMatch(/not a Rest Home/);
    expect(fr("assisted living Boston")).toMatch(/9 list an address in Boston/);
    expect(fr("assisted living Worcester")).toMatch(/6 list an address in Worcester/);
    expect(fr("certified assisted living Massachusetts")).toMatch(/certified by AGE/);
    expect(fr("special care assisted living Massachusetts")).toMatch(
      /204 residences report special-care units/,
    );
    expect(fr("rest homes Massachusetts")).toMatch(/58 Rest Homes/);
    expect(fr("Massachusetts rest home")).toMatch(/not a Nursing Home/);
    expect(fr("rest home Worcester")).toMatch(/8 list an address in Worcester/);
    expect(fr("nursing home license Massachusetts")).toMatch(/347 Nursing Homes/);
    expect(fr("nursing home license Massachusetts")).toMatch(/no CMS Certification Number/);
    expect(fr("nursing home inspections Massachusetts")).toMatch(/Survey Performance Tool/);
    expect(fr("Massachusetts nursing home survey")).toMatch(/not a TrustHub score/);
    expect(fr("DPH nursing home inspection Massachusetts")).toMatch(/343 surveyed nursing homes/);
    expect(interpretSeniorAskQuery("nursing home complaints Massachusetts").coverageState).toBe(
      "REQUEST_ONLY",
    );
    expect(fr("senior care in Massachusetts")).toMatch(
      /no combined Massachusetts senior-facility total/i,
    );
    expect(fr("best nursing home Massachusetts")).toMatch(/does not rank Massachusetts/);
    const all = [
      "assisted living Massachusetts",
      "rest homes Massachusetts",
      "nursing home license Massachusetts",
    ].map(fr);
    expect(all.join(" ")).not.toMatch(/\b1,?095\b|\b1,?167\b/); // no combined DPH + AGE total
    const ccn = interpretSeniorAskQuery("CCN 225001");
    expect(ccn.failReason ?? "").not.toMatch(/Massachusetts/);
  });

  it("parses Ohio nursing homes and a labeled CCN without inventing a local route", () => {
    const q = interpretSeniorAskQuery("nursing homes in Ohio");
    expect(q.mode).toBe("entity");
    expect(q.providerClass).toBe("nursing_home");
    expect(q.geography?.value).toBe("OH");
    const ccn = interpretSeniorAskQuery("Find CMS CCN 366000");
    expect(ccn.mode).toBe("identifier");
    expect(ccn.identifier).toEqual({ type: "ccn", value: "366000" });
    const lic = interpretSeniorAskQuery("OH00001");
    expect(lic.mode).toBe("fail_closed");
    expect(lic.failReason).toMatch(/OH00001/i);
    expect(lic.failReason).toMatch(/not a CMS CCN/i);
    const rcfId = interpretSeniorAskQuery("OHL01201 Ohio");
    expect(rcfId.mode).toBe("fail_closed");
    expect(rcfId.failReason).toMatch(/OHL01201/i);
  });
});
