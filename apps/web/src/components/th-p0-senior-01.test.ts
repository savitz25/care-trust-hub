import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * TH-P0-SENIOR-01 regression guard.
 *
 * Confirmed live production contradiction (fixed by this ticket):
 *   A nursing-home facility page could simultaneously show "Represent this
 *   facility? Submit a profile claim" (RealProviderDetail, unconditional)
 *   and "Profile management is not currently available." (SeniorCustomerLayer,
 *   gated on customerEnabled) — two independently-gated UI pieces asserting
 *   opposite things about the same capability.
 *
 * Fix: RealProviderDetail now accepts `profileManagementEnabled` and, when
 * false, labels the claim link as a manually-reviewed "representation claim"
 * (not "profile management") and explicitly discloses that live
 * profile-management tools are not yet enabled for that facility.
 */
const here = dirname(fileURLToPath(import.meta.url));
const detailSource = readFileSync(join(here, "real-provider-detail.tsx"), "utf8");
const pageSource = readFileSync(join(here, "../app/facility/cms/[ccn]/[slug]/page.tsx"), "utf8");

describe("nursing home facility page: claim vs. profile-management consistency", () => {
  it("RealProviderDetail no longer claims to accept a 'profile claim' unconditionally", () => {
    expect(detailSource).not.toMatch(/Represent this facility\? Submit a profile claim/);
    expect(detailSource).toMatch(/Represent this facility\? Submit a representation claim/);
  });

  it("RealProviderDetail accepts a profileManagementEnabled flag and uses it to gate the disclosure", () => {
    expect(detailSource).toMatch(/profileManagementEnabled/);
    expect(detailSource).toMatch(/profile-management tools are not\s*\n?\s*yet enabled/);
  });

  it("the facility page wires the same customerEnabled value into both RealProviderDetail and SeniorCustomerLayer", () => {
    expect(pageSource).toMatch(/profileManagementEnabled=\{customerEnabled\}/);
    expect(pageSource).toMatch(/enabled=\{customerEnabled\}/);
  });
});
