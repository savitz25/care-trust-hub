import { describe, expect, it } from "vitest";
import {
  TN_LOCKED,
  TN_PUBLIC_FINGERPRINT,
  TN_PUBLIC_SNAPSHOT,
  assertTnIntelligence,
  tnTraceMetrics,
} from "./tn-intelligence";

const text = JSON.stringify(TN_PUBLIC_SNAPSHOT);
const noNumber = (n: number) =>
  expect(text).not.toMatch(new RegExp(`\\b${n}\\b|\\b${n.toLocaleString("en-US")}\\b`));

describe("TN-SEN-001 public snapshot", () => {
  it("keeps Nursing Home, ACLF, RHA, Home Health, Hospice, and CMS separate and unsummed", () => {
    const snap = assertTnIntelligence();
    expect(snap.fingerprint).toBe(TN_PUBLIC_FINGERPRINT);
    expect(snap.nursingHomes.distinctLicenseNumbers).toBe(326);
    expect(snap.aclf.distinctLicenseNumbers).toBe(331);
    expect(snap.rha.distinctLicenseNumbers).toBe(39);
    noNumber(TN_LOCKED.hfcNursingHomeLicenses + TN_LOCKED.hfcAclfs + TN_LOCKED.hfcRhas); // 696
    noNumber(TN_LOCKED.hfcNursingHomeBeds + TN_LOCKED.hfcAclfBeds + TN_LOCKED.hfcRhaBeds);
    noNumber(TN_LOCKED.hfcAclfBeds + TN_LOCKED.hfcRhaBeds);
    noNumber(TN_LOCKED.hfcNursingHomeLicenses + TN_LOCKED.cmsNursingHomes); // 629
  });

  it("keeps beds as a capacity grain and counts a satellite's beds once", () => {
    const nh = TN_PUBLIC_SNAPSHOT.nursingHomes;
    expect(nh.bedGrain).toMatch(/not residents/);
    expect(nh.satelliteRows).toBe(1);
    expect(nh.bedsSumAllRowsAsListed - nh.licensedBeds).toBe(46);
    expect(nh.sourceAsOf).toBe("2026-07");
  });

  it("does not count Home Health or Hospice county rows as agencies", () => {
    const hh = TN_PUBLIC_SNAPSHOT.homeHealth;
    expect(hh.countyServiceRows).toBeGreaterThan(hh.distinctAgenciesAsPrinted * 10);
    expect(hh.distinctStateAgencyIds).toBeNull();
    expect(hh.agencyIdInSource).toBe(false);
    expect(hh.capability).toBe("PARTIAL");
    expect(hh.sourceAsOf).toBe("2024-02-07");
    expect(hh.exemptionListsAddedToMainList).toBe(false);
    expect(TN_PUBLIC_SNAPSHOT.hospice.sourceAsOf).toBe("2024-03-06");
  });

  it("does not claim a state-to-CMS bridge without a CCN", () => {
    expect(TN_PUBLIC_SNAPSHOT.crosswalk.exactStateToCmsBridges).toBe(0);
    expect(TN_PUBLIC_SNAPSHOT.crosswalk.reason).toMatch(/does not mean zero overlap/);
  });

  it("attaches actions only by exact license class and number, and withholds abuse-registry names", () => {
    const fa = TN_PUBLIC_SNAPSHOT.facilityActions;
    expect(Object.values(fa.byAttribution).reduce((a, b) => a + b, 0)).toBe(
      fa.seniorClassActionRows,
    );
    expect(fa.attachedToCmsProfile).toBe(0);
    expect(fa.abuseRegistryNamesPublished).toBe(false);
    expect(fa.abuseRegistryIsPersonLevel).toBe(true);
    expect(fa.capability).toBe("PARTIAL");
    expect(tnTraceMetrics().every((m) => m.value !== null)).toBe(true);
  });
});
