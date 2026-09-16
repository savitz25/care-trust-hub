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
});
