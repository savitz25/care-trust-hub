import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TN_PUBLIC_FINGERPRINT, TN_PUBLIC_SNAPSHOT } from "@care/domain";
import lists from "@/data/tennessee-facility-lists.json";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const view = readFileSync(join(here, "../../components/tn-intelligence.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Tennessee /tennessee publication", () => {
  it("uses index,follow and the /tennessee canonical without rating schema", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/tennessee"\)/);
    expect(source + view).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(/An Assisted Care Living Facility\s+is not a Nursing Home/);
    expect(source + view).not.toMatch(/all Tennessee senior facilities|best nursing home|safest/i);
  });

  it("lists /tennessee exactly once in core.xml and never lists city routes", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/tennessee"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/tennessee\/[a-z-]+/);
    expect(block).not.toMatch(/nashville|memphis/);
  });

  it("serves only rows tied to the accepted snapshot, without abuse-registry names", () => {
    expect(TN_PUBLIC_SNAPSHOT.fingerprint).toBe(TN_PUBLIC_FINGERPRINT);
    expect(lists.fingerprint).toBe(TN_PUBLIC_FINGERPRINT);
    expect(lists.aclf).toHaveLength(TN_PUBLIC_SNAPSHOT.aclf.reportRows);
    expect(lists.rha).toHaveLength(TN_PUBLIC_SNAPSHOT.rha.reportRows);
    expect(lists.nursingHomes).toHaveLength(TN_PUBLIC_SNAPSHOT.nursingHomes.reportRows);
    expect(lists.actions).toHaveLength(TN_PUBLIC_SNAPSHOT.facilityActions.seniorClassActionRows);
    expect(JSON.stringify(lists)).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}|Abuse Registry|Name:/);
    expect(
      lists.actions.every(
        (a) =>
          a.attachedLicenseNumber === null ||
          a.attribution === "attached_exact_license_number_and_name_agrees",
      ),
    ).toBe(true);
  });
});
