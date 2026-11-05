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
 * The facility record no longer renders claim buttons next to the customer
 * layer. Corrections, source concerns, and representation claims are one link
 * to /trust/corrections, which keeps those actions off the profile.
 */
const here = dirname(fileURLToPath(import.meta.url));
const detailSource = readFileSync(join(here, "real-provider-detail.tsx"), "utf8");
const pageSource = readFileSync(join(here, "../app/facility/cms/[ccn]/[slug]/page.tsx"), "utf8");

describe("nursing home facility page: claim vs. profile-management consistency", () => {
  it("RealProviderDetail no longer renders claim buttons on the facility record", () => {
    expect(detailSource).not.toMatch(/Represent this facility\? Submit a profile claim/);
    expect(detailSource).not.toMatch(/Submit a representation claim/);
    expect(detailSource).not.toMatch(/profile-management tools are not/);
    expect(detailSource).toMatch(/See something that needs correction\?/);
    expect(detailSource).toMatch(/CORRECTIONS_HREF/);
  });

  it("the facility page wires the same customerEnabled value into both RealProviderDetail and SeniorCustomerLayer", () => {
    expect(pageSource).toMatch(/profileManagementEnabled=\{customerEnabled\}/);
    expect(pageSource).toMatch(/enabled=\{customerEnabled\}/);
  });
});
