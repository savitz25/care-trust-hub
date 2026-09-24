import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MA_PUBLIC_FINGERPRINT, MA_PUBLIC_SNAPSHOT } from "@care/domain";
import lists from "@/data/massachusetts-facility-lists.json";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const view = readFileSync(join(here, "../../components/ma-intelligence.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Massachusetts /massachusetts publication", () => {
  it("uses index,follow and the /massachusetts canonical without rating schema", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/massachusetts"\)/);
    expect(source + view).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(/A Rest Home is not a Nursing\s+Home/);
    expect(source + view).not.toMatch(
      /all Massachusetts senior facilities|best nursing home|safest/i,
    );
  });

  it("lists /massachusetts exactly once in core.xml and never lists city routes", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/massachusetts"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/massachusetts\/[a-z-]+/);
    expect(block).not.toMatch(/boston/);
  });

  it("serves only sanitized rows tied to the accepted snapshot", () => {
    expect(MA_PUBLIC_SNAPSHOT.fingerprint).toBe(MA_PUBLIC_FINGERPRINT);
    expect(lists.fingerprint).toBe(MA_PUBLIC_FINGERPRINT);
    expect(lists.restHomes).toHaveLength(MA_PUBLIC_SNAPSHOT.restHomes.rows);
    expect(lists.assistedLivingResidences).toHaveLength(MA_PUBLIC_SNAPSHOT.assistedLiving.rows);
    expect(JSON.stringify(lists)).not.toMatch(
      /[\w.+-]+@[\w-]+\.[a-z]{2,}|Executive Director|Federal ID/i,
    );
  });
});
