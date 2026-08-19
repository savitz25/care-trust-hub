import { describe, expect, it } from "vitest";
import {
  assistedLivingStatusCopy,
  isExplicitMemoryDesignation,
  memoryCarePublicLabel,
  publishedAssistedLivingPath,
} from "./assisted-living-presentation";

describe("assisted living consumer presentation", () => {
  it("keeps probation visible and does not invent NY or TX standing", () => {
    expect(
      assistedLivingStatusCopy({
        stateCode: "CA",
        licenseStatusReported: true,
        consumerStatus: "ON PROBATION",
        sourceDirectoryContext: "ccl_listing",
      }),
    ).toMatchObject({ headline: "Regulator status: On Probation", prominent: true });
    expect(
      assistedLivingStatusCopy({
        stateCode: "NY",
        licenseStatusReported: false,
        consumerStatus: null,
        sourceDirectoryContext: "current_hfis_listing",
      }).detail,
    ).toMatch(/current NYS DOH Adult Care Facility dataset/i);
    expect(
      assistedLivingStatusCopy({
        stateCode: "TX",
        licenseStatusReported: true,
        consumerStatus: "LICENSED",
        sourceDirectoryContext: "active_alf_directory",
      }).detail,
    ).toMatch(/current HHSC Assisted Living Facility directory/i);
  });

  it("labels memory care only from explicit designations", () => {
    expect(isExplicitMemoryDesignation("not_reported")).toBe(false);
    expect(memoryCarePublicLabel("not_reported")).toBeNull();
    expect(memoryCarePublicLabel("specialty_endorsement")).toMatch(/alzheimer/i);
    expect(
      publishedAssistedLivingPath({
        stateCode: "CA",
        id: "11111111-1111-4111-8111-111111111111",
        officialName: "Example RCFE",
      }),
    ).toBe("/assisted-living/ca/11111111-1111-4111-8111-111111111111/example-rcfe");
  });
});
