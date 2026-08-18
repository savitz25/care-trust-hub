import { describe, expect, it } from "vitest";
import {
  isStateClaimType,
  resolveStateLicenseToCms,
  type StateCmsIdentity,
} from "./state-regulator";

const cms: StateCmsIdentity = {
  cmsCcn: "555120",
  name: "Vineyard Post Acute",
  address: "101 Monroe St",
  city: "Petaluma",
  state: "CA",
  zip: "94954",
  phone: "(707) 763-4109",
};

describe("state regulator claim types and CMS bridge", () => {
  it("accepts the reusable state claim vocabulary and rejects invented types", () => {
    expect(isStateClaimType("STATE_LICENSE_STATUS")).toBe(true);
    expect(isStateClaimType("google_official_website")).toBe(false);
  });

  it("verifies a state license when the official source supplies the CMS CCN", () => {
    const decision = resolveStateLicenseToCms(
      {
        stateCode: "CA",
        stateLicenseId: "10000102",
        stateCcn: "555120",
        name: "Different Doing Business As",
        address: null,
        city: null,
        zip: null,
        phone: null,
      },
      cms,
    );
    expect(decision.state).toBe("VERIFIED");
    expect(decision.matchedOn).toEqual(["cms_ccn"]);
  });

  it("never verifies on facility name similarity alone", () => {
    const decision = resolveStateLicenseToCms(
      {
        stateCode: "CA",
        stateLicenseId: "10000102",
        stateCcn: null,
        name: "Vineyard Post Acute",
        address: "999 Other Ave",
        city: "Petaluma",
        zip: "94954",
        phone: null,
      },
      cms,
    );
    expect(decision.state).toBe("REVIEW_REQUIRED");
    expect(decision.matchedOn).toContain("name");
    expect(decision.matchedOn).not.toContain("address");
  });

  it("rejects a record from another state instead of overwriting CMS identity", () => {
    const decision = resolveStateLicenseToCms(
      {
        stateCode: "TX",
        stateLicenseId: "10000102",
        stateCcn: "555120",
        name: cms.name,
        address: cms.address,
        city: cms.city,
        zip: cms.zip,
        phone: cms.phone,
      },
      cms,
    );
    expect(decision.state).toBe("REJECTED");
  });
});
