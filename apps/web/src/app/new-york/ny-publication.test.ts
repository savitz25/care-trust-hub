import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NY_PUBLIC_FINGERPRINT, NY_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));

describe("New York /new-york publication", () => {
  it("uses launch-gated index,follow and the /new-york canonical", () => {
    const source = readFileSync(join(here, "page.tsx"), "utf8");
    expect(source).toMatch(/canonicalUrl\("\/new-york"\)/);
    expect(source).toMatch(/publicRobots\(true\)/);
    expect(source).toMatch(/New York Senior Care Research/);
    expect(source).not.toMatch(/aggregateRating/);
    expect(source).not.toMatch(/\/new-york\/manhattan/);
    expect(source).not.toMatch(/Trust Score/);
  });

  it("lists /new-york exactly once in core.xml and never lists local New York routes", () => {
    const sitemap = readFileSync(join(here, "..", "sitemaps", "[file]", "route.ts"), "utf8");
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/new-york"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/new-york\/[a-z-]+/);
    expect(existsSync(join(here, "manhattan"))).toBe(false);
    expect(existsSync(join(here, "brooklyn"))).toBe(false);
  });

  it("locks the accepted snapshot fingerprint and UI binding", () => {
    expect(NY_PUBLIC_SNAPSHOT.version).toBe("senior-ny-state-intel-v1");
    expect(NY_PUBLIC_SNAPSHOT.fingerprint).toBe(NY_PUBLIC_FINGERPRINT);
    expect(NY_PUBLIC_SNAPSHOT.publicationPath).toBe("/new-york");
    const ui = readFileSync(join(here, "..", "..", "components", "ny-intelligence.tsx"), "utf8");
    expect(ui).toContain("acf.acfFacilities");
    expect(ui).toContain("nh.sourceRows");
    expect(ui).toContain("nh.surveyRows");
    expect(ui).toContain("dnr.observationCount");
    expect(ui).toMatch(/Do Not Refer/);
    expect(ui).toMatch(/Adult Care Facility identities/);
  });
});
