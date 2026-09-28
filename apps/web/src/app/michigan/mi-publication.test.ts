import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import snapshot from "@/data/michigan-public-snapshot.json";
import { interpretMichiganAsk, michiganIntent } from "@/server/care/mi-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("MI-SEN-001 public source and routing boundary", () => {
  it("publishes canonical, indexable state research without ratings or city routes", () => {
    expect(page).toMatch(/canonicalUrl\("\/michigan"\)/);
    expect(page).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(page).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    const core = sitemap.slice(
      sitemap.indexOf("const corePaths"),
      sitemap.indexOf("];", sitemap.indexOf("const corePaths")) + 2,
    );
    expect([...core.matchAll(/"\/michigan"/g)]).toHaveLength(1);
    expect(core).not.toMatch(/\/michigan\/detroit|\/michigan\/lansing/);
  });

  it("keeps class grains and source clocks separate", () => {
    expect(snapshot.afcClassCounts.AS).toBe(2471);
    expect(snapshot.afcClassCounts.AH).toBe(351);
    expect(snapshot.afcClassCounts.XH).toBe(234);
    expect(snapshot.healthClassCounts["Nursing Home"]).toBe(426);
    expect(snapshot.healthClassCounts["Hospice Agency"]).toBe(191);
    expect(snapshot.exactHfaLegacyBridges).toEqual({ licensed: 349, exempt: 234 });
    expect(snapshot.exactCmsBridges).toBe(0);
    expect(snapshot.afcRetrievedAt).toBeTruthy();
    expect(snapshot.healthRetrievedAt).toBeTruthy();
  });

  it("does not name-attach closed-facility actions or widen claims", () => {
    expect(snapshot.disciplineRows).toBe(88);
    expect(snapshot.disciplineCurrentOpenAttachments).toBe(0);
    expect(snapshot.graphWrites).toBe(0);
    expect(page).toMatch(/name-only attachments: 0/);
  });

  it("routes statewide and city context but refuses rankings and leaves CCNs to CMS", () => {
    expect(michiganIntent("Detroit nursing home")).toBe(true);
    expect(michiganIntent("Grand Rapids nursing home")).toBe(true);
    expect(interpretMichiganAsk("Michigan AFC discipline")?.message).toMatch(/88 published rows/);
    expect(interpretMichiganAsk("best nursing home Michigan")?.coverage).toBe("UNSUPPORTED");
    expect(interpretMichiganAsk("CCN 123456 Michigan")).toBeNull();
    expect(michiganIntent("nursing home Minnesota", "MN")).toBe(false);
    expect(interpretSeniorAskQuery("Michigan AFC discipline").failReason).toMatch(/88 published rows/);
    expect(interpretSeniorAskQuery("best nursing home Michigan").mode).toBe("fail_closed");
    expect(interpretSeniorAskQuery("best nursing home Michigan").failReason).toMatch(/does not rank/);
    expect(interpretSeniorAskQuery("CCN 123456 Michigan").identifier).toEqual({ type: "ccn", value: "123456" });
  });
});
