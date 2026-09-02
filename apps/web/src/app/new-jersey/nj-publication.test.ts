import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NJ_PUBLIC_FINGERPRINT, NJ_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("New Jersey page publication", () => {
  it("uses launch-gated index,follow and the /new-jersey canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/new-jersey"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).not.toMatch(/\/new-jersey\/[a-z]/);
  });

  it("lists /new-jersey exactly once in core.xml and never lists counties", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/new-jersey"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/bergen|essex|ocean|monmouth/i);
    expect(block).not.toMatch(/\/new-jersey\//);
  });

  it("keeps the NJ-SEN-005 public snapshot fingerprint deterministic", () => {
    expect(NJ_PUBLIC_SNAPSHOT.version).toBe("nj-sen-005-public-v1");
    expect(NJ_PUBLIC_SNAPSHOT.fingerprint).toBe(NJ_PUBLIC_FINGERPRINT);
  });
});
