import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NV_PUBLIC_FINGERPRINT, NV_PUBLIC_SNAPSHOT } from "@care/domain";
import lists from "@/data/nevada-facility-lists.json";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const view = readFileSync(join(here, "../../components/nv-intelligence.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Nevada /nevada publication", () => {
  it("uses index,follow and the /nevada canonical without rating schema", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/nevada"\)/);
    expect(source + view).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(
      /A Residential Facility for Groups is\s+not assisted living unless the state has endorsed it/,
    );
    expect(source + view).not.toMatch(/all Nevada senior facilities|best nursing home|safest/i);
    expect(view).toMatch(/Only endorsed RFGs may provide assisted living services/);
  });

  it("lists /nevada exactly once in core.xml and never lists city routes", () => {
    const start = sitemap.indexOf("const corePaths");
    const block = sitemap.slice(start, sitemap.indexOf("];", start) + 2);
    expect([...block.matchAll(/"\/nevada"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/nevada\/[a-z-]+/);
    expect(block).not.toMatch(/las-vegas|reno|henderson/);
  });

  it("serves only rows tied to the accepted snapshot, without contact names, phones, or street addresses", () => {
    expect(NV_PUBLIC_SNAPSHOT.fingerprint).toBe(NV_PUBLIC_FINGERPRINT);
    expect(lists.fingerprint).toBe(NV_PUBLIC_FINGERPRINT);
    const by = (cls: string) => lists.facilities.filter((f) => f.cls === cls).length;
    expect(by("AGC")).toBe(NV_PUBLIC_SNAPSHOT.rfg.distinctCredentialNumbers);
    expect(by("SNF")).toBe(NV_PUBLIC_SNAPSHOT.skilledNursing.distinctCredentialNumbers);
    expect(
      lists.facilities.filter((f) =>
        (f.endorsements as string[]).includes("ASSISTED LIVING SERVICES"),
      ),
    ).toHaveLength(NV_PUBLIC_SNAPSHOT.rfg.assistedLivingEndorsed);
    const text = JSON.stringify(lists);
    expect(text).not.toMatch(
      /[\w.+-]+@[\w-]+\.[a-z]{2,}|\b\d{3}-\d{3}-\d{4}\b|Administrator|Primary Contact/,
    );
    for (const f of lists.facilities) {
      expect(Object.keys(f)).not.toContain("address");
      expect(f.cmsBridge === null || f.federalProviderAsPrinted === f.cmsBridge).toBe(true);
    }
  });
});
