import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VA_PUBLIC_FINGERPRINT, VA_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));

describe("Virginia /virginia publication", () => {
  it("uses launch-gated index,follow and the /virginia canonical", () => {
    const source = readFileSync(join(here, "page.tsx"), "utf8");
    expect(source).toMatch(/canonicalUrl\("\/virginia"\)/);
    expect(source).toMatch(/publicRobots\(true\)/);
    expect(source).toMatch(/Virginia Senior Care Research/);
    expect(source).not.toMatch(/aggregateRating/);
    expect(source).not.toMatch(/\/virginia\/fairfax/);
    expect(source).not.toMatch(/Trust Score/);
  });

  it("lists /virginia exactly once in core.xml and never lists Virginia cities or counties", () => {
    const sitemap = readFileSync(join(here, "..", "sitemaps", "[file]", "route.ts"), "utf8");
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/virginia"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/virginia\/[a-z-]+/);
  });

  it("locks the accepted snapshot fingerprint", () => {
    expect(VA_PUBLIC_SNAPSHOT.version).toBe("senior-va-state-intel-v1");
    expect(VA_PUBLIC_SNAPSHOT.fingerprint).toBe(VA_PUBLIC_FINGERPRINT);
    expect(VA_PUBLIC_SNAPSHOT.publicationPath).toBe("/virginia");
  });
});
