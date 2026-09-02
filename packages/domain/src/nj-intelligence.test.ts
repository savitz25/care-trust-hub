import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  NJ_LOCKED,
  NJ_LTC_TYPE_KEYS,
  NJ_PUBLIC_FINGERPRINT,
  NJ_PUBLIC_SNAPSHOT,
  NJ_SOURCE_CATALOG,
  assertNjIntelligence,
  njTraceMetrics,
  selectNjProfileEvidence,
} from "./nj-intelligence";

const dir = dirname(fileURLToPath(import.meta.url));

describe("NJ-SEN-005 public snapshot", () => {
  it("is deterministic and locked to the published fingerprint", () => {
    const asserted = assertNjIntelligence(NJ_PUBLIC_SNAPSHOT);
    expect(asserted.fingerprint).toBe(NJ_PUBLIC_FINGERPRINT);
    expect(asserted.asOf).toBe("2026-09-02");
    expect(asserted.ltcAsOf).toBe("2026-08-31");
    expect(asserted.acuteAsOf).toBe("2026-08-31");
    const artifact = JSON.parse(
      readFileSync(join(dir, "../../../artifacts/nj-sen-005-public-snapshot.json"), "utf8"),
    ) as { fingerprint: string };
    expect(artifact.fingerprint).toBe(NJ_PUBLIC_FINGERPRINT);
  });

  it("reconciles All_LTC and All_Acute without a combined senior-provider denominator", () => {
    const snap = assertNjIntelligence(NJ_PUBLIC_SNAPSHOT);
    expect(snap.ltc.rows).toBe(NJ_LOCKED.ltcRows);
    expect(snap.ltc.types).toBe(NJ_LOCKED.ltcTypes);
    expect(snap.ltc.byType).toHaveLength(19);
    expect(snap.acute.rows).toBe(NJ_LOCKED.acuteRows);
    expect(snap.acute.types).toBe(NJ_LOCKED.acuteTypes);
    expect(snap.acute.byType).toHaveLength(26);
    expect(NJ_LTC_TYPE_KEYS).toHaveLength(19);
    expect(snap.acute.hha).toBe(39);
    expect(snap.acute.hospiceProgram).toBe(68);
    expect(snap.acute.hospiceBranch).toBe(27);
    expect(snap.acute.hospiceInpatient).toBe(9);
    expect(JSON.stringify(snap)).not.toMatch(/senior-care providers|Trust Score|ranking of/i);
    expect(snap.ltc.rows + snap.acute.rows).toBe(NJ_LOCKED.inventoryRows);
  });

  it("keeps Home Health office, Hospice Program, Branch, and Inpatient separate", () => {
    const snap = assertNjIntelligence(NJ_PUBLIC_SNAPSHOT);
    const labels = snap.acute.byType.map((row) => row.label);
    expect(labels).toContain("HOME HEALTH AGENCY");
    expect(labels).toContain("HOSPICE CARE PROGRAM");
    expect(labels).toContain("HOSPICE CARE BRANCH");
    expect(labels).toContain("HOSPICE CARE - INPATIENT");
    expect(snap.acute.hospiceBranch).not.toBe(snap.acute.hospiceProgram);
    expect(snap.staffing.notAttachedTo).toEqual(
      expect.arrayContaining(["Home Health", "Hospice", "ALR", "PACE", "CCRC"]),
    );
  });

  it("preserves staffing residents-per-staff semantics and does not treat missing as zero", () => {
    const snap = assertNjIntelligence(NJ_PUBLIC_SNAPSHOT);
    expect(snap.staffing.populatedQuarters).toBe(30);
    expect(snap.staffing.latest).toBe("2026 Q2");
    expect(snap.staffing.semantics).toMatch(/residents per one staff member/i);
    const latest = snap.staffing.trend.at(-1);
    expect(latest?.dayRn).toBeGreaterThan(Number(latest?.dayLpn));
    expect(latest?.dayLpn).toBeGreaterThan(Number(latest?.dayCna));
    expect(
      snap.staffing.trend.every((row) => row.dayRn > 0 && row.dayLpn > 0 && row.dayCna > 0),
    ).toBe(true);
  });

  it("reconciles enforcement occurrences, hashes, and identity buckets", () => {
    const snap = assertNjIntelligence(NJ_PUBLIC_SNAPSHOT);
    expect(snap.enforcement.indexed).toBe(1146);
    expect(snap.enforcement.downloaded).toBe(1144);
    expect(snap.enforcement.uniqueHashes).toBe(1131);
    expect(snap.enforcement.indexed).not.toBe(snap.enforcement.uniqueHashes);
    expect(snap.enforcement.matchBuckets.EXACT).toBe(300);
    expect(snap.enforcement.matchBuckets.HIGH_CONFIDENCE).toBe(76);
    expect(snap.enforcement.matchBuckets.REVIEW_REQUIRED).toBe(3);
    expect(snap.enforcement.matchBuckets.UNSAFE_REJECTED).toBe(291);
    expect(snap.enforcement.matchBuckets.UNRESOLVED).toBe(476);
    expect(snap.enforcement.exactFacilities).toBe(224);
  });

  it("treats Medicaid listed rates as schedule rows, not participation or quality", () => {
    const snap = assertNjIntelligence(NJ_PUBLIC_SNAPSHOT);
    expect(snap.medicaid.listedRows).toBe(236);
    expect(snap.medicaid.minRate).toBe(81.1);
    expect(snap.medicaid.maxRate).toBe(126.1);
    expect(snap.medicaid.defaults.ALP).toBe(99.1);
  });

  it("keeps PACE organization, center, operating, and awarded distinct", () => {
    const snap = assertNjIntelligence(NJ_PUBLIC_SNAPSHOT);
    expect(snap.pace.organizations).toBe(8);
    expect(snap.pace.operatingOrganizations).toBe(6);
    expect(snap.pace.awardedOrganizations).toBe(2);
    expect(snap.pace.operatingCenters).toBe(10);
    expect(snap.pace.partialCounties).toBe(3);
    expect(snap.pace.organizations).not.toBe(snap.pace.operatingCenters);
  });

  it("does not publish a zero CCRC count", () => {
    const snap = assertNjIntelligence(NJ_PUBLIC_SNAPSHOT);
    expect(snap.ccrc.countPublished).toBeNull();
    expect(snap.ccrc.coverage).toBe("SOURCE_AVAILABLE_BY_REQUEST");
    const ccrcTrace = njTraceMetrics(snap).find((row) => row.id === "ccrc-roster");
    expect(ccrcTrace?.value).toBeNull();
    expect(ccrcTrace?.display).toBe("Unknown");
  });

  it("catalogs source coverage and identity linkage without silent zeros", () => {
    expect(NJ_SOURCE_CATALOG).toHaveLength(10);
    const byId = Object.fromEntries(NJ_SOURCE_CATALOG.map((row) => [row.id, row]));
    expect(byId["njdoh-all-ltc"]?.identityLinkage).toBe("exact");
    expect(byId["njdoh-enforcement"]?.identityLinkage).toBe("partial");
    expect(byId["cms-home-health"]?.identityLinkage).toBe("unavailable");
    expect(byId["ccrc-framework"]?.coverage).toBe("SOURCE_AVAILABLE_BY_REQUEST");
    expect(byId["ccrc-framework"]?.asOf).toBeNull();
  });

  it("withholds unresolved enforcement from profiles and has no current attachments", () => {
    const empty = selectNjProfileEvidence({ ccn: "315000", state: "NJ" });
    expect(empty.render).toBe(false);
    expect(empty.attachments).toEqual([]);
    expect(empty.withheldReviewOrUnresolved).toBe(479);
    expect(empty.match).toBe("NONE");
  });
});
