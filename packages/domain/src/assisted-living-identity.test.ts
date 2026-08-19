import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASSISTED_LIVING_CANDIDATE_STATES,
  ASSISTED_LIVING_PILOT_STATES,
  assistedLivingExternalKey,
  classifyMemoryCareDesignation,
  futureAssistedLivingPath,
  isCmsCcnIdentity,
  isPublishableAssistedLivingRecord,
  licensedCapacityLabel,
  mapOfficialTypeToConsumerCategory,
  organizationParty,
  resolveAssistedLivingIdentity,
} from "./assisted-living-identity";

describe("assisted living identity foundation", () => {
  it("builds a state-scoped key and refuses to treat it as a CCN", () => {
    const key = assistedLivingExternalKey({
      stateCode: "ca",
      regulatorCode: "CA_CDSS_CCL",
      sourceFacilityId: " 374600123 ",
    });
    expect(key).toBe("CA:CA_CDSS_CCL:374600123");
    expect(isCmsCcnIdentity(key)).toBe(false);
    expect(isCmsCcnIdentity("015009")).toBe(true);
    expect(() =>
      assistedLivingExternalKey({
        stateCode: "CA",
        regulatorCode: "CA_CDSS_CCL",
        sourceFacilityId: "",
      }),
    ).toThrow(/source facility ID/i);
  });

  it("never verifies identity from a facility name alone", () => {
    expect(
      resolveAssistedLivingIdentity({
        stateCode: "CA",
        regulatorCode: "CA_CDSS_CCL",
        sourceFacilityId: null,
        officialName: "Sunrise of Example",
      }).state,
    ).toBe("REVIEW_REQUIRED");
    expect(
      resolveAssistedLivingIdentity({
        stateCode: "NY",
        regulatorCode: "NY_DOH_ACF",
        sourceFacilityId: "1234",
        officialName: "Example Adult Home",
      }),
    ).toMatchObject({ state: "VERIFIED", key: "NY:NY_DOH_ACF:1234" });
  });

  it("does not infer memory care from a facility name", () => {
    expect(
      classifyMemoryCareDesignation({
        facilityName: "Sunrise Memory Care of Dallas",
      }),
    ).toBe("not_reported");
    expect(
      classifyMemoryCareDesignation({
        explicitLicenseOrCertification: "Special Needs Assisted Living Residence",
        facilityName: "Example Residence",
      }),
    ).toBe("explicit_memory_or_dementia_license");
    expect(
      classifyMemoryCareDesignation({
        securedOrSpecialCareUnit: true,
      }),
    ).toBe("secured_or_special_care_unit");
  });

  it("keeps official terminology beside a consumer category", () => {
    expect(
      mapOfficialTypeToConsumerCategory({
        officialType: "Residential Care Facility for the Elderly",
      }),
    ).toEqual({
      officialType: "Residential Care Facility for the Elderly",
      consumerCategory: "residential_care",
    });
    expect(
      mapOfficialTypeToConsumerCategory({
        officialType: "Assisted Living Residence",
        memory: "explicit_memory_or_dementia_license",
      }).consumerCategory,
    ).toBe("memory_supportive");
  });

  it("keeps licensee, operator, and management as separate roles", () => {
    expect(organizationParty("licensee", "Example Licensee LLC", "LICENSEE")).toMatchObject({
      role: "licensee",
    });
    expect(organizationParty("operator", "Example Operator Inc", "OPERATOR")?.role).toBe(
      "operator",
    );
    expect(organizationParty("management_company", "Example Mgmt", "MANAGEMENT")?.role).toBe(
      "management_company",
    );
    expect(organizationParty("owner", "   ", "OWNER")).toBeNull();
  });

  it("requires verified identity, place, category, and provenance to be publication-eligible", () => {
    expect(
      isPublishableAssistedLivingRecord({
        identityState: "VERIFIED",
        officialName: "Example RCFE",
        officialStreet: "1 Main St",
        officialCity: "Sacramento",
        officialZip: "95814",
        consumerCategory: "residential_care",
        retrievedAt: "2026-08-18T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      isPublishableAssistedLivingRecord({
        identityState: "PROBABLE",
        officialName: "Example RCFE",
        officialStreet: "1 Main St",
        officialCity: "Sacramento",
        officialZip: "95814",
        consumerCategory: "residential_care",
        retrievedAt: "2026-08-18T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(licensedCapacityLabel(42)).toBe("Licensed capacity 42");
    expect(licensedCapacityLabel(null)).toMatch(/not reported/i);
  });

  it("selects two to three pilots and documents all eight candidate states", () => {
    expect(ASSISTED_LIVING_CANDIDATE_STATES).toHaveLength(8);
    expect(ASSISTED_LIVING_PILOT_STATES).toEqual(["CA", "NY", "TX"]);
    expect(
      futureAssistedLivingPath({
        stateCode: "NY",
        sourceFacilityId: "1234",
        officialName: "Example Adult Home",
      }),
    ).toBe("/assisted-living/ny/1234/example-adult-home");
  });

  it("has no Google Places dependency", () => {
    const source = readFileSync(path.join(__dirname, "assisted-living-identity.ts"), "utf8");
    expect(source).not.toMatch(/google|GOOGLE_PLACES|place details|geocode/i);
    expect(source).not.toMatch(/Trust Score|best facility/i);
  });
});
