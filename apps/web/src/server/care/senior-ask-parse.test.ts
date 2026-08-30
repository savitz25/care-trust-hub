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
