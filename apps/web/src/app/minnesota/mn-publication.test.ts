import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MN_PUBLIC_FINGERPRINT, MN_PUBLIC_SNAPSHOT } from "@care/domain";
import lists from "@/data/minnesota-facility-lists.json";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const view = readFileSync(join(here, "../../components/mn-intelligence.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Minnesota /minnesota publication", () => {
  it("uses index,follow and the /minnesota canonical without rating schema", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/minnesota"\)/);
    expect(source + view).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source + view).not.toMatch(/all Minnesota senior facilities|best nursing home|safest/i);
    for (const heading of [
      "Nursing Homes",
      "Assisted Living",
      "Assisted Living with Dementia Care",
      "Boarding Care",
      "Home Care",
      "Home Health",
      "Hospice",
      "Inspections / Regulatory Evidence",
      "Complaints",
      "Limitations",
    ]) {
      expect(view, heading).toContain(`<p className="eyebrow">${heading}</p>`);
    }
  });

  it("lists /minnesota exactly once in core.xml and never lists city routes", () => {
    const start = sitemap.indexOf("const corePaths");
    const block = sitemap.slice(start, sitemap.indexOf("];", start) + 2);
    expect([...block.matchAll(/"\/minnesota"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/minnesota\/[a-z-]+/);
    expect(block).not.toMatch(/minneapolis|st-paul|saint-paul|duluth/);
  });

  it("serves only rows tied to the accepted snapshot, without administrators, phones, emails, or street addresses", () => {
    expect(MN_PUBLIC_SNAPSHOT.fingerprint).toBe(MN_PUBLIC_FINGERPRINT);
    expect(lists.fingerprint).toBe(MN_PUBLIC_FINGERPRINT);
    const by = (cls: string) => lists.facilities.filter((f) => f.cls === cls).length;
    expect(by("nursingHome")).toBe(MN_PUBLIC_SNAPSHOT.nursingHome.rows);
    expect(by("assistedLivingDementiaCare")).toBe(
      MN_PUBLIC_SNAPSHOT.assistedLivingDementiaCare.rows,
    );
    const text = JSON.stringify(lists);
    expect(text).not.toMatch(
      /[\w.+-]+@[\w-]+\.[a-z]{2,}|\b\d{3}-\d{3}-\d{4}\b|\(\d{3}\) ?\d{3}-\d{4}|adminstrator|administrator/i,
    );
    for (const f of lists.facilities) {
      expect(Object.keys(f)).not.toContain("address");
      expect(Object.keys(f)).not.toContain("telephone");
      expect(f.cmsBridge === null || f.medicareNumberAsPrinted === f.cmsBridge).toBe(true);
    }
  });
});
