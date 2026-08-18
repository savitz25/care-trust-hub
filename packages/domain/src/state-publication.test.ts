import { describe, expect, it } from "vitest";
import type { ResolutionState } from "./facility-intelligence";
import {
  isConsumerPublishableStateClaim,
  selectPublishedStateIntelligence,
  type StateClaimRecord,
} from "./state-publication";

const claim = (
  claimType: string,
  value: string,
  resolutionState: ResolutionState = "VERIFIED",
): StateClaimRecord => ({
  claimType,
  resolutionState,
  value,
  resolvedAt: "2026-08-18T17:00:00.000Z",
});

describe("state regulatory publication selector", () => {
  it("publishes VERIFIED California license fields without treating licensee as owner", () => {
    const published = selectPublishedStateIntelligence({
      stateCode: "CA",
      claims: [
        claim("STATE_LICENSE_ID", "10000102"),
        claim("STATE_LICENSE_STATUS", "ACTIVE"),
        claim("STATE_LICENSE_CAPACITY", "99"),
        claim("STATE_LICENSEE", "PETALUMAIDENCE OPCO, LLC"),
        claim("STATE_ADMINISTRATOR", "BILLS, KEVAN"),
      ],
    });
    expect(published?.regulator).toContain("California");
    expect(published?.licenseId?.value).toBe("10000102");
    expect(published?.licenseStatus?.value).toBe("ACTIVE");
    expect(published?.licensedCapacity?.value).toBe("99");
    expect(published?.licensee?.value).toBe("PETALUMAIDENCE OPCO, LLC");
    expect(published?.checkedLabel).toMatch(/State regulatory data · checked Aug 2026/);
  });

  it("hides REVIEW_REQUIRED, PROBABLE, and UNRESOLVED license identities", () => {
    for (const state of ["REVIEW_REQUIRED", "PROBABLE", "UNRESOLVED", "REJECTED"] as const) {
      expect(
        selectPublishedStateIntelligence({
          stateCode: "NY",
          claims: [
            claim("STATE_LICENSE_ID", "2701364N", state),
            claim("STATE_OPERATOR", "Example"),
          ],
        }),
      ).toBeNull();
    }
  });

  it("does not manufacture New York or Texas license status", () => {
    const ny = selectPublishedStateIntelligence({
      stateCode: "NY",
      claims: [claim("STATE_LICENSE_ID", "2701364N"), claim("STATE_LICENSE_STATUS", "Active")],
    });
    const tx = selectPublishedStateIntelligence({
      stateCode: "TX",
      claims: [claim("STATE_LICENSE_ID", "147890"), claim("STATE_LICENSE_STATUS", "Licensed")],
    });
    expect(ny?.licenseStatus).toBeNull();
    expect(tx?.licenseStatus).toBeNull();
    expect(isConsumerPublishableStateClaim(claim("STATE_LICENSE_STATUS", "Active"), "NY")).toBe(
      false,
    );
  });

  it("does not publish state intelligence for other states", () => {
    expect(
      selectPublishedStateIntelligence({
        stateCode: "FL",
        claims: [claim("STATE_LICENSE_ID", "123")],
      }),
    ).toBeNull();
  });

  it("publishes a partial VERIFIED record when only the license identity is present", () => {
    const published = selectPublishedStateIntelligence({
      stateCode: "CA",
      claims: [claim("STATE_LICENSE_ID", "10000102")],
    });
    expect(published?.licenseId?.value).toBe("10000102");
    expect(published?.licenseStatus).toBeNull();
    expect(published?.licensee).toBeNull();
    expect(published?.administrator).toBeNull();
  });

  it("does not publish management company as operator or owner", () => {
    const published = selectPublishedStateIntelligence({
      stateCode: "TX",
      claims: [
        claim("STATE_LICENSE_ID", "147890"),
        claim("STATE_LICENSEE", "Example LLC"),
        claim("STATE_MANAGEMENT_ENTITY", "Manager Inc"),
      ],
    });
    expect(published?.licensee?.value).toBe("Example LLC");
    expect(published?.operator).toBeNull();
    expect(published?.managementCompany?.value).toBe("Manager Inc");
  });
});
