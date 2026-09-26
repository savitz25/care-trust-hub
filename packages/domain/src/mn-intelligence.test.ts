import { describe, expect, it } from "vitest";
import {
  MN_LOCKED,
  MN_PUBLIC_FINGERPRINT,
  MN_PUBLIC_SNAPSHOT,
  assertMnIntelligence,
  mnTraceMetrics,
} from "./mn-intelligence";

const text = JSON.stringify(MN_PUBLIC_SNAPSHOT);
const noNumber = (n: number) =>
  expect(text).not.toMatch(new RegExp(`\\b${n}\\b|\\b${n.toLocaleString("en-US")}\\b`));

describe("MN-SEN-001 public snapshot", () => {
  it("names MDH's Health Regulation Division and keeps the daily directory as the state source", () => {
    const snap = assertMnIntelligence();
    expect(snap.fingerprint).toBe(MN_PUBLIC_FINGERPRINT);
    expect(snap.regulatorMap.current.authority).toBe("Minnesota Department of Health");
    expect(snap.regulatorMap.current.division).toBe("Health Regulation Division");
    expect(snap.annualDirectory.usedFor).toMatch(/Cross-check only/);
    expect(snap.clocks.mdh_directory_updated).toMatch(/daily/);
  });

  it("keeps every MDH license type separate and never adds them", () => {
    const s = MN_PUBLIC_SNAPSHOT;
    expect(s.nursingHome.distinctLicenses).toBe(335);
    expect(s.assistedLiving.distinctLicenses).toBe(1571);
    expect(s.assistedLivingDementiaCare.distinctLicenses).toBe(601);
    expect(s.assistedLivingDementiaCare.separateLicenseType).toBe(true);
    expect(s.assistedLivingDementiaCare.inferredFromNameOrMarketing).toBe(false);
    expect(s.assistedLivingDementiaCare.providerType).toEqual([
      "ASSISTED LIVING FACILITY DEMENTIA CARE",
    ]);
    expect(s.boardingCare.distinctFromNursingHome).toBe(true);
    expect(s.homeHealthAgency.mnLicenseIsHomeCare).toBe(true);
    expect(s.homeCareBranch.branchesAreNotProviders).toBe(true);
    expect(s.residentialHospice.distinctFromHospiceProvider).toBe(true);
    const L = MN_LOCKED;
    noNumber(L.assistedLiving + L.assistedLivingDementiaCare);
    noNumber(
      L.assistedLiving +
        L.assistedLivingDementiaCare +
        L.provisionalAssistedLiving +
        L.provisionalAssistedLivingDementiaCare,
    );
    noNumber(L.nursingHome + L.boardingCare);
    noNumber(L.nursingHome + L.assistedLiving + L.assistedLivingDementiaCare + L.boardingCare);
    noNumber(L.homeHealthAgency + L.cmsHomeHealth);
    noNumber(L.comprehensiveHomeCare + L.homeHealthAgency);
    noNumber(L.hospiceProvider + L.cmsHospice);
    noNumber(L.nursingHome + L.cmsNursingHomes);
  });

  it("bridges to CMS only by an exact printed CCN of the same class and never by name", () => {
    const cw = MN_PUBLIC_SNAPSHOT.crosswalk;
    expect(cw.nameOnly).toBe("UNSAFE");
    expect(cw.zeroBridgesIsNotZeroOverlap).toBe(true);
    expect(cw.cmsNursingHomesBridged + cw.cmsNursingHomesNotBridged).toBe(
      MN_PUBLIC_SNAPSHOT.cmsOverlay.nursingHomes,
    );
    expect(cw.cmsHomeHealthBridged + cw.cmsHomeHealthNotBridged).toBe(
      MN_PUBLIC_SNAPSHOT.cmsOverlay.homeHealth,
    );
    expect(cw.boardingCareNursingFacilityNumbersAreNotCcns).toBe(true);
    expect(MN_PUBLIC_SNAPSHOT.boardingCare.medicareNumberStates.printed_not_a_ccn).toBe(8);
    expect(MN_PUBLIC_SNAPSHOT.cmsOverlay.addedToNationalTotals).toBe(false);
  });

  it("keeps evaluations, investigations, sanctions, and complaints in their own grains", () => {
    const s = MN_PUBLIC_SNAPSHOT;
    expect(s.findings.attachedByExactHfidInSameGroup).toBe(true);
    expect(s.findings.nameOnlyJoins).toBe(0);
    expect(s.findings.findingTextCopied).toBe(false);
    expect(s.findings.evaluationIsNotInvestigation).toBe(true);
    expect(s.findings.unattachedProviders).toBeGreaterThan(0);
    expect(s.sanctions.capability).toBe("NOT_ACQUIRED");
    expect(s.complaints.complaintIsNotDeficiency).toBe(true);
    expect(s.complaints.complaintIsNotSanction).toBe(true);
    expect(s.clocks.finding_concluded_dates_after_retrieval_as_printed).toEqual(["3021-12-12"]);
    expect(s.clocks.latest_finding_concluded! <= s.retrievedAt.slice(0, 10)).toBe(true);
    const caps = Object.fromEntries(s.capabilities.map((c) => [c.id, c.state]));
    expect(caps["combined-minnesota-senior-facilities"]).toBe("UNSUPPORTED");
    expect(caps["name-only-bridge"]).toBe("UNSUPPORTED");
    expect(caps["ohfc-investigations"]).toBe("PARTIAL");
    expect(caps["state-sanctions"]).toBe("NOT_ACQUIRED");
  });

  it("traces every headline metric to a source and caveat", () => {
    const traces = mnTraceMetrics();
    expect(traces.map((t) => t.id)).toContain("mdh-alfdc");
    for (const t of traces) {
      expect(t.source).toBeTruthy();
      expect(t.caveat.length).toBeGreaterThan(20);
    }
  });
});
