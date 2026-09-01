import { normalizeFloridaCounty } from "./florida-county";

export const FLORIDA_INTEL_VERSION = "fl-sen-intel-v1";

export interface FloridaClassCard {
  id: string;
  label: string;
  current: number;
  observations: number;
  inspectionProviders: number;
  deficiencyProviders: number;
  legalActionProviders: number;
  fineProviders: number;
  finalOrderProviders: number;
  emergencyProviders: number;
  identity: string;
  notes: string[];
}

export interface FloridaCountyRow {
  county: string;
  providers: number;
}

export interface FloridaIntelligence {
  contractVersion: string;
  snapshotVersion: string;
  sourceFingerprint: string;
  generatedAt: string;
  asOf: string;
  score: null;
  ranking: null;
  cmsConfirmedLinks: 0;
  publication: {
    individualProviders: "NOT_CURRENTLY_PUBLISHABLE";
    pageIndex: false;
  };
  providers: {
    current: 6983;
    withConnectedEvent: 5317;
    withoutConnectedEvent: 1666;
    byClass: {
      FL_ALF: 3016;
      FL_AFCH: 228;
      FL_HOME_HEALTH_LICENSE: 2971;
      FL_HOSPICE_LICENSE: 74;
      FL_NH_LICENSE: 694;
    };
  };
  credentials: {
    observations: 15227;
    lmh: 702;
    lns: 389;
    ecc: 170;
  };
  contacts: {
    observations: 69903;
    streetAddressProviders: 6983;
    mailingAddressProviders: 6983;
    phoneProviders: 6964;
    ownerProviders: 6978;
    administratorProviders: 6908;
    financialOfficerProviders: 6906;
    websiteProviders: 4277;
  };
  geographyObservations: 32420;
  regulatory: {
    observations: 77219;
    families: {
      inspection: 19439;
      deficiency: 24083;
      legal_action: 4961;
      fine: 12951;
      final_order: 15712;
      emergency_action: 73;
    };
    coverage: {
      inspection: 4489;
      deficiency: 3736;
      legal_action: 892;
      fine: 3502;
      final_order: 3550;
      emergency_action: 67;
    };
    finality: { final: 33376; nonFinal: 321; unknown: 43522 };
    dateMin: "2003-12-22";
    dateMax: "2026-08-24";
    fineUsd: 39607312.57;
    chowHeld: 3716;
  };
  classes: Record<"alf" | "afch" | "hha" | "hospice" | "nh", FloridaClassCard>;
  statusRaw: Array<{ label: string; providers: number }>;
  capacity: { alf: 118744; afch: 1058; nh: 85548 };
  cmsOverlay: {
    nursingHome: {
      current: 694;
      starCounts: Record<"1" | "2" | "3" | "4" | "5" | "missing", number>;
    };
    homeHealth: { current: 1146; qualityStarMissing: 398 };
    hospiceGi: 61;
  };
  counties: {
    alfFacility: FloridaCountyRow[];
    hhaOffice: FloridaCountyRow[];
    servedCountyMappings: Array<{ raw: string; canonical: string; observations: number }>;
  };
  sources: Array<{
    name: string;
    agency: string;
    asOf: string | null;
    retrievedAt: string | null;
    role: string;
  }>;
  limitations: string[];
}

const LOCKED_CURRENT = 6983;

export function assertFloridaIntelligence(value: FloridaIntelligence): FloridaIntelligence {
  if (value.contractVersion !== FLORIDA_INTEL_VERSION) {
    throw new Error(`Unexpected Florida contract ${value.contractVersion}`);
  }
  if (value.snapshotVersion !== FLORIDA_INTEL_VERSION) {
    throw new Error(`Unexpected Florida snapshot ${value.snapshotVersion}`);
  }
  if (!/^[0-9a-f]{64}$/.test(value.sourceFingerprint)) {
    throw new Error("Florida snapshot fingerprint must be sha256 hex");
  }
  if (value.score !== null || value.ranking !== null) {
    throw new Error("Florida intelligence must not contain a score or ranking");
  }
  if (value.cmsConfirmedLinks !== 0) {
    throw new Error("Florida CMS confirmed links must remain 0");
  }
  if (value.providers.current !== LOCKED_CURRENT) {
    throw new Error("Florida CURRENT P0 count drifted");
  }
  if (
    value.providers.withConnectedEvent + value.providers.withoutConnectedEvent !==
    LOCKED_CURRENT
  ) {
    throw new Error("Event coverage must partition CURRENT providers");
  }
  if (value.publication.individualProviders !== "NOT_CURRENTLY_PUBLISHABLE") {
    throw new Error("Individual Florida providers must stay unpublished");
  }
  if (value.publication.pageIndex !== false) {
    throw new Error("Florida page remains noindex until a later gate");
  }
  const familySum = Object.values(value.regulatory.families).reduce((a, b) => a + b, 0);
  if (familySum !== value.regulatory.observations) {
    throw new Error("Family observations must sum to total observations");
  }
  if (value.contacts.observations !== 69903) {
    throw new Error("Florida contact observations drifted");
  }
  return value;
}

export function servedCountyMappingReport(
  rows: Array<{ raw: string; observations: number }>,
): Array<{ raw: string; canonical: string; observations: number; mapping: string | null }> {
  return rows.map((row) => {
    const result = normalizeFloridaCounty(row.raw);
    return {
      raw: row.raw,
      canonical: result.canonical ?? row.raw,
      observations: row.observations,
      mapping: result.mapping,
    };
  });
}
