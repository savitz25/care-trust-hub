import { describe, expect, it } from "vitest";
import { assertFloridaIntelligence, servedCountyMappingReport } from "./florida-intelligence";
import type { FloridaIntelligence } from "./florida-intelligence";

function sample(): FloridaIntelligence {
  return {
    contractVersion: "fl-sen-intel-v1",
    snapshotVersion: "fl-sen-intel-v1",
    sourceFingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    generatedAt: "2026-08-27T21:00:00.000Z",
    asOf: "2026-08-27T20:42:55.791075+00:00",
    score: null,
    ranking: null,
    cmsConfirmedLinks: 0,
    publication: {
      individualProviders: "NOT_CURRENTLY_PUBLISHABLE",
      pageIndex: false,
    },
    providers: {
      current: 6983,
      withConnectedEvent: 5317,
      withoutConnectedEvent: 1666,
      byClass: {
        FL_ALF: 3016,
        FL_AFCH: 228,
        FL_HOME_HEALTH_LICENSE: 2971,
        FL_HOSPICE_LICENSE: 74,
        FL_NH_LICENSE: 694,
      },
    },
    credentials: { observations: 15227, lmh: 702, lns: 389, ecc: 170 },
    contacts: {
      observations: 69903,
      streetAddressProviders: 6983,
      mailingAddressProviders: 6983,
      phoneProviders: 6964,
      ownerProviders: 6978,
      administratorProviders: 6908,
      financialOfficerProviders: 6906,
      websiteProviders: 4277,
    },
    geographyObservations: 32420,
    regulatory: {
      observations: 77219,
      families: {
        inspection: 19439,
        deficiency: 24083,
        legal_action: 4961,
        fine: 12951,
        final_order: 15712,
        emergency_action: 73,
      },
      coverage: {
        inspection: 4489,
        deficiency: 3736,
        legal_action: 892,
        fine: 3502,
        final_order: 3550,
        emergency_action: 67,
      },
      finality: { final: 33376, nonFinal: 321, unknown: 43522 },
      dateMin: "2003-12-22",
      dateMax: "2026-08-24",
      fineUsd: 39607312.57,
      chowHeld: 3716,
    },
    classes: {
      alf: {
        id: "FL_ALF",
        label: "Assisted Living Facilities",
        current: 3016,
        observations: 50555,
        inspectionProviders: 3016,
        deficiencyProviders: 2700,
        legalActionProviders: 217,
        fineProviders: 2029,
        finalOrderProviders: 2055,
        emergencyProviders: 37,
        identity: "AHCA file number",
        notes: [],
      },
      afch: {
        id: "FL_AFCH",
        label: "Adult Family Care Homes",
        current: 228,
        observations: 2044,
        inspectionProviders: 226,
        deficiencyProviders: 164,
        legalActionProviders: 0,
        fineProviders: 60,
        finalOrderProviders: 60,
        emergencyProviders: 0,
        identity: "AHCA file number",
        notes: [],
      },
      hha: {
        id: "FL_HOME_HEALTH_LICENSE",
        label: "Home Health Agencies",
        current: 2971,
        observations: 10026,
        inspectionProviders: 1194,
        deficiencyProviders: 824,
        legalActionProviders: 12,
        fineProviders: 746,
        finalOrderProviders: 746,
        emergencyProviders: 2,
        identity: "AHCA file number",
        notes: [],
      },
      hospice: {
        id: "FL_HOSPICE_LICENSE",
        label: "Hospice",
        current: 74,
        observations: 602,
        inspectionProviders: 53,
        deficiencyProviders: 48,
        legalActionProviders: 2,
        fineProviders: 12,
        finalOrderProviders: 14,
        emergencyProviders: 0,
        identity: "AHCA file number",
        notes: [],
      },
      nh: {
        id: "FL_NH_LICENSE",
        label: "Nursing Homes",
        current: 694,
        observations: 13992,
        inspectionProviders: 0,
        deficiencyProviders: 0,
        legalActionProviders: 661,
        fineProviders: 655,
        finalOrderProviders: 675,
        emergencyProviders: 28,
        identity: "AHCA file number overlay",
        notes: [],
      },
    },
    statusRaw: [{ label: "LICENSED", providers: 6041 }],
    capacity: { alf: 118744, afch: 1058, nh: 85548 },
    cmsOverlay: {
      nursingHome: {
        current: 694,
        starCounts: { "1": 92, "2": 141, "3": 125, "4": 159, "5": 174, missing: 3 },
      },
      homeHealth: { current: 1146, qualityStarMissing: 398 },
      hospiceGi: 61,
    },
    counties: { alfFacility: [], hhaOffice: [], servedCountyMappings: [] },
    sources: [],
    limitations: [],
  };
}

describe("assertFloridaIntelligence", () => {
  it("accepts the locked CURRENT foundation", () => {
    expect(assertFloridaIntelligence(sample()).providers.current).toBe(6983);
  });

  it("rejects a score", () => {
    expect(() => assertFloridaIntelligence({ ...sample(), score: 1 as unknown as null })).toThrow(
      /score or ranking/,
    );
  });
});

describe("servedCountyMappingReport", () => {
  it("reports every non-exact mapping", () => {
    const rows = servedCountyMappingReport([
      { raw: "Dade", observations: 529 },
      { raw: "Miami-Dade", observations: 13 },
    ]);
    expect(rows[0].mapping).toBe("Dade → Miami-Dade");
    expect(rows[1].mapping).toBeNull();
  });
});
