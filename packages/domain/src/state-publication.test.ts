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

  it("hides REVIEW_REQUIRED, PROBABLE, UNRESOLVED, and REJECTED license identities", () => {
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

  it("does not publish sibling fields when the license identity is not VERIFIED", () => {
    const published = selectPublishedStateIntelligence({
      stateCode: "TX",
      claims: [
        claim("STATE_LICENSE_ID", "147890", "UNRESOLVED"),
        claim("STATE_LICENSEE", "Example LLC"),
        claim("STATE_LICENSE_CAPACITY", "120"),
      ],
    });
    expect(published).toBeNull();
  });

  it("publishes VERIFIED Texas identity and type without unsafe mapped fields", () => {
    const published = selectPublishedStateIntelligence({
      stateCode: "TX",
      claims: [
        claim("STATE_LICENSE_ID", "147890"),
        claim("STATE_LICENSE_TYPE", "Nursing Facility"),
        claim("STATE_LICENSE_CAPACITY", "0"),
        claim("STATE_LICENSEE", "TX"),
        claim("STATE_ADMINISTRATOR", "mark.mckenzie@fpacp.com"),
        claim("STATE_MANAGEMENT_ENTITY", "cmatheny@oakdalesa.com"),
      ],
    });
    expect(published?.regulator).toContain("Texas");
    expect(published?.licenseId?.value).toBe("147890");
    expect(published?.licenseType?.value).toBe("Nursing Facility");
    expect(published?.licenseStatus).toBeNull();
    expect(published?.licensedCapacity).toBeNull();
    expect(published?.licensee).toBeNull();
    expect(published?.administrator).toBeNull();
    expect(published?.managementCompany).toBeNull();
  });

  it("keeps VERIFIED capacity separate from unpublished REVIEW_REQUIRED sibling claims", () => {
    const published = selectPublishedStateIntelligence({
      stateCode: "CA",
      claims: [
        claim("STATE_LICENSE_ID", "10000102"),
        claim("STATE_LICENSE_CAPACITY", "99"),
        claim("STATE_LICENSEE", "UNSAFE LICENSEE", "REVIEW_REQUIRED"),
        claim("STATE_ADMINISTRATOR", "UNSAFE ADMIN", "PROBABLE"),
      ],
    });
    expect(published?.licensedCapacity?.value).toBe("99");
    expect(published?.licensee).toBeNull();
    expect(published?.administrator).toBeNull();
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
      stateCode: "NY",
      claims: [
        claim("STATE_LICENSE_ID", "2701364N"),
        claim("STATE_OPERATOR", "Example Operator LLC"),
        claim("STATE_MANAGEMENT_ENTITY", "Manager Inc"),
      ],
    });
    expect(published?.operator?.value).toBe("Example Operator LLC");
    expect(published?.managementCompany?.value).toBe("Manager Inc");
    expect(published?.licensee).toBeNull();
  });

  it("hides emails and two-letter codes in entity fields", () => {
    const published = selectPublishedStateIntelligence({
      stateCode: "CA",
      claims: [
        claim("STATE_LICENSE_ID", "10000102"),
        claim("STATE_LICENSEE", "CA"),
        claim("STATE_ADMINISTRATOR", "admin@example.com"),
      ],
    });
    expect(published?.licensee).toBeNull();
    expect(published?.administrator).toBeNull();
  });
});
