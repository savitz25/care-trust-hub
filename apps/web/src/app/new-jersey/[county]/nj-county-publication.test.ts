import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NJ_COUNTY_FINGERPRINTS, NJ_COUNTY_SLUGS, getNjCountySnapshot } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const view = readFileSync(join(here, "../../../components/nj-county-intelligence.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../../sitemaps/[file]/route.ts"), "utf8");

describe("New Jersey county page publication", () => {
  it("uses launch-gated index,follow and county canonicals", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(intel\.publicationGate\.indexable\)/);
    expect(source).toMatch(/canonicalUrl\(intel\.path\)/);
    expect(source).toMatch(/generateStaticParams/);
    expect(source).toMatch(/NJ_COUNTY_SLUGS/);
    expect(source).toMatch(/notFound\(\)/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).not.toMatch(/\/new-jersey\/[a-z-]+-township/);
  });

  it("keeps local resources visually separate from licensed identities", () => {
    expect(view).toMatch(/County resources — not licensed facilities/);
    expect(view).toMatch(/does not publish a Trust Score/);
    expect(view).toMatch(/There is no Verified by New Jersey badge/);
    expect(view).toMatch(/According to the county/);
    expect(view).toMatch(/planning inventory, not a license list/i);
    expect(view).not.toMatch(/aggregateRating|ratingValue/);
  });

  it("indexes exactly the four county routes and no municipality routes", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    for (const slug of NJ_COUNTY_SLUGS) {
      expect(block).toContain(`"/new-jersey/${slug}"`);
      const snap = getNjCountySnapshot(slug);
      expect(snap.fingerprint).toBe(NJ_COUNTY_FINGERPRINTS[slug]);
      expect(snap.publicationGate.indexable).toBe(true);
    }
    expect(block).not.toMatch(/township|borough|city of/i);
  });
});
