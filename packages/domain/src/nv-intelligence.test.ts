import { describe, expect, it } from "vitest";
import {
  NV_LOCKED,
  NV_PUBLIC_FINGERPRINT,
  NV_PUBLIC_SNAPSHOT,
  assertNvIntelligence,
  nvTraceMetrics,
} from "./nv-intelligence";

const text = JSON.stringify(NV_PUBLIC_SNAPSHOT);
const noNumber = (n: number) =>
  expect(text).not.toMatch(new RegExp(`\b${n}\b|\b${n.toLocaleString("en-US")}\b`));

describe("NV-SEN-001 public snapshot", () => {
  it("represents the current regulator and keeps source-era names historical", () => {
    const snap = assertNvIntelligence();
    expect(snap.fingerprint).toBe(NV_PUBLIC_FINGERPRINT);
    expect(snap.regulatorMap.current.authority).toBe("Nevada Health Authority");
    expect(snap.regulatorMap.current.division).toBe(
      "Health Care Purchasing and Compliance Division",
    );
    expect(snap.regulatorMap.current.bureau).toMatch(/HCQC/);
    expect(snap.regulatorMap.historicalNames.join(" ")).toMatch(/DPBH/);
    expect(JSON.stringify(snap.regulatorMap.current)).not.toMatch(
      /DPBH|Public and Behavioral Health/,
    );
  });

  it("keeps RFG, assisted-living-endorsed RFG, Alzheimer-endorsed RFG, SNF, HIRC, Home Health, and Hospice separate", () => {
    const r = NV_PUBLIC_SNAPSHOT.rfg;
    expect(r.distinctCredentialNumbers).toBe(438);
    expect(r.assistedLivingEndorsed).toBe(74);
    expect(r.alzheimerEndorsed).toBe(223);
    expect(r.assistedLivingEndorsed).toBeLessThan(r.distinctCredentialNumbers);
    expect(r.everyRfgIsAssistedLiving).toBe(false);
    expect(r.endorsementCountsAsPrinted["ASSISTED LIVING SERVICES"]).toBe(74);
    expect(
      r.endorsementCountsAsPrinted["INDIVIDUALS WITH INTELLECTUAL DISABILITES"],
    ).toBeGreaterThan(0); // source spelling kept
    expect(NV_PUBLIC_SNAPSHOT.skilledNursing.distinctCredentialNumbers).toBe(58);
    expect(NV_PUBLIC_SNAPSHOT.hirc.distinctFromRfg).toBe(true);
    expect(NV_PUBLIC_SNAPSHOT.hospiceFacility.distinctFromHospiceProgram).toBe(true);
    expect(NV_PUBLIC_SNAPSHOT.homeHealthBranch.branchesAreNotAgencies).toBe(true);
    const L = NV_LOCKED;
    noNumber(L.snf + L.sfd + L.rfg + L.hirc + L.adc); // no combined facility total
    noNumber(L.snf + L.rfg + L.hirc);
    noNumber(L.hha + L.cmsHomeHealth);
    noNumber(L.hpc + L.cmsHospice);
    noNumber(L.snf + L.cmsNursingHomes);
    noNumber(L.hpc + L.hfs);
  });

  it("bridges to CMS only by an exact printed CCN of the same class and never by name", () => {
    const cw = NV_PUBLIC_SNAPSHOT.crosswalk;
    expect(cw.ccnInHcqcSource).toBe(true);
    expect(cw.nameOnly).toBe("UNSAFE");
    expect(cw.cmsNursingHomesBridged + cw.cmsNursingHomesNotBridged).toBe(
      NV_PUBLIC_SNAPSHOT.cmsOverlay.nursingHomes,
    );
    expect(cw.zeroBridgesIsNotZeroOverlap).toBe(true);
    expect(
      NV_PUBLIC_SNAPSHOT.hospiceProgram.federalProviderStates.printed_not_a_ccn,
    ).toBeGreaterThan(0);
    expect(NV_PUBLIC_SNAPSHOT.cmsOverlay.addedToNationalTotals).toBe(false);
  });

  it("keeps inspections, sanctions, and complaints in their own grains", () => {
    const s = NV_PUBLIC_SNAPSHOT;
    expect(s.inspections.findingsCopied).toBe(false);
    expect(s.inspections.stateInspectionIsNotCmsInspection).toBe(true);
    expect(s.stateSanctions.rows).toBe(40);
    expect(s.stateSanctions.gridFlagUnderstatesDetail).toBe(true);
    expect(s.complaints.records).toBe("REQUEST_ONLY");
    expect(s.complaints.complaintIsNotDeficiency).toBe(true);
    expect(s.clocks.retrievedAt_is_not_sourceAsOf).toBe(true);
    const caps = Object.fromEntries(s.capabilities.map((c) => [c.id, c.state]));
    expect(caps["combined-nevada-senior-facilities"]).toBe("UNSUPPORTED");
    expect(caps["name-only-bridge"]).toBe("UNSUPPORTED");
    expect(caps["complaint-records"]).toBe("REQUEST_ONLY");
  });

  it("traces every headline metric to a source and caveat", () => {
    const traces = nvTraceMetrics();
    expect(traces.map((t) => t.id)).toContain("hcqc-rfg-al");
    for (const t of traces) {
      expect(t.source).toBeTruthy();
      expect(t.caveat.length).toBeGreaterThan(20);
    }
  });
});
