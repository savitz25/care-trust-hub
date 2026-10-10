import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  normalizedPublishedStatePath,
  PUBLISHED_STATEWIDE_SLUGS,
} from "@/lib/published-state-path";
import {
  PUBLISHED_STATE_COUNT,
  PUBLISHED_STATES,
  publishedStateHref,
} from "@/lib/published-states";
import { PUBLISHED_STATE_NAVIGATION } from "@/components/published-state-navigation";

const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
const coreStart = sitemap.indexOf("const corePaths");
const core = sitemap.slice(coreStart, sitemap.indexOf("];", coreStart) + 2);

describe("Published state discovery", () => {
  it("publishes Utah through the shared state list", () => {
    expect(PUBLISHED_STATEWIDE_SLUGS).toContain("utah");
    expect(PUBLISHED_STATES.some((state) => state.slug === "utah" && state.code === "UT")).toBe(
      true,
    );
    expect(publishedStateHref("UT")).toBe("/utah");
    expect(PUBLISHED_STATE_NAVIGATION).toContainEqual({ href: "/utah", label: "Utah" });
    expect(normalizedPublishedStatePath("/Utah")).toBe("/utah");
    expect(normalizedPublishedStatePath("/utah")).toBeNull();
    expect([...core.matchAll(/"\/utah"/g)]).toHaveLength(1);
  });

  it("counts every published state route exactly once", () => {
    expect(PUBLISHED_STATEWIDE_SLUGS).toHaveLength(39);
    expect(PUBLISHED_STATE_COUNT).toBe(39);
    expect(new Set(PUBLISHED_STATEWIDE_SLUGS).size).toBe(PUBLISHED_STATEWIDE_SLUGS.length);
    for (const slug of PUBLISHED_STATEWIDE_SLUGS) {
      expect(fs.existsSync(`src/app/${slug}/page.tsx`)).toBe(true);
      expect([...core.matchAll(new RegExp(`"/${slug}"`, "g"))]).toHaveLength(1);
    }
  });

  it("publishes Iowa in every list, exactly like Utah", () => {
    expect(PUBLISHED_STATEWIDE_SLUGS).toContain("iowa");
    expect(PUBLISHED_STATES.map((state) => state.slug)).toContain("iowa");
    expect(PUBLISHED_STATE_NAVIGATION).toContainEqual({ href: "/iowa", label: "Iowa" });
    expect([...core.matchAll(/"\/iowa"/g)]).toHaveLength(1);
  });

  it("serves a self-canonical, indexable /states index from the shared list", () => {
    const page = fs.readFileSync("src/app/states/page.tsx", "utf8");
    expect(page).toContain('canonicalUrl("/states")');
    expect(page).toContain("publicRobots(true)");
    expect(page).toContain("PUBLISHED_STATES.map");
    expect(page).not.toMatch(/"use client"|AggregateRating|ratingValue/);
    expect([...core.matchAll(/"\/states"/g)]).toHaveLength(1);
  });

  it("links /states from the header state menu and the footer", () => {
    const nav = fs.readFileSync("src/components/published-state-navigation.tsx", "utf8");
    const footer = fs.readFileSync("../../packages/ui/src/index.tsx", "utf8");
    expect(nav).toContain('href="/states"');
    expect(footer).toContain('<a href="/states">All states</a>');
  });

  it("keeps the four New Jersey county routes intact", () => {
    expect([...core.matchAll(/"\/new-jersey\/[a-z-]+"/g)].map((match) => match[0])).toEqual([
      '"/new-jersey/monmouth-county"',
      '"/new-jersey/middlesex-county"',
      '"/new-jersey/somerset-county"',
      '"/new-jersey/union-county"',
    ]);
  });
});
