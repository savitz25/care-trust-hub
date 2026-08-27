export const SENIOR_HUB_INTEL_VERSION = "senior-hub-intel-v1";

export interface StarDistribution {
  counts: Record<"1" | "2" | "3" | "4" | "5" | "missing", number>;
  percentsOfReported: Record<"1" | "2" | "3" | "4" | "5", number | null>;
  reported: number;
  missing: number;
  directory: number;
  label: string;
}

export interface ChowSupported {
  status: "SUPPORTED";
  events: number;
  providersWithHistory: number;
  sourceFamily: string;
}

export interface ChowUnsupported {
  status: "UNSUPPORTED";
  reason: string;
}

export interface GeographyRow {
  state: string;
  nursingHomes: number;
  homeHealth: number;
  hospice: number;
}

export interface HubSourceRow {
  datasetKey: string;
  displayName: string;
  sourceAgency: string;
  cmsIdentifier: string | null;
  sourceModifiedAt: string | null;
  sourcePeriod: string | null;
  retrievedAt: string | null;
  lastIngestSuccessAt: string | null;
  freshnessBand: string | null;
  officialUrl: string | null;
  refreshCadence: string | null;
  limitation: string;
}

export interface SeniorNationalIntelligence {
  contractVersion: string;
  snapshotVersion: string;
  sourceFingerprint: string;
  generatedAt: string;
  generationMs: number;
  score: null;
  ranking: null;
  combinedProviderDenominator: {
    status: "UNSUPPORTED";
    classRecordSum: number;
    semantics: string;
    publishAsHeadline: false;
  };
  providerClasses: Array<{
    id: "nursing_home" | "home_health" | "hospice";
    label: string;
    current: number;
    known: number | null;
    evidenceOnly?: number;
    identity: string;
    directory: string;
  }>;
  nursingHome: {
    current: number;
    known: number;
    starDistribution: StarDistribution;
    coverage: {
      mdsQualityProviders: number;
      mdsQualityMissing: number;
      staffingPbjProviders: number;
      inspectionProviders: number;
      fireSafetyProviders: number;
      ownedByProviders: number;
      chowHistoryProviders: number;
    };
    chow: ChowSupported;
  };
  homeHealth: {
    current: number;
    starDistribution: StarDistribution;
    coverage: {
      qualityOfPatientCareProviders: number;
      hhcahpsProviders: number;
      ownedByProviders: number;
      zipCoverageProviders: number;
    };
    chow: ChowUnsupported;
  };
  hospice: {
    current: number;
    typed: number;
    evidenceOnly: number;
    coverage: {
      qualityMeasureProviders: number;
      cahpsProviders: number;
      ownedByProviders: number;
      zipCoverageProviders: number;
    };
    chow: ChowUnsupported;
  };
  ownership: {
    organizations: number;
    unknownEdges: number;
    unresolvedEdges: number;
    currentOwnedByProviders: {
      nursingHome: number;
      homeHealth: number;
      hospice: number;
    };
    networkSize: Record<string, number>;
    multiStateFootprint: Record<string, number>;
    crossClassOrganizations: Record<string, number>;
    personEquityOwners: number;
  };
  regulatory: {
    class: "nursing_home";
    inspection: {
      observations: number;
      currentProvidersWithObservation: number;
      dateMin: string | null;
      dateMax: string | null;
    };
    deficiencies: {
      observations: number;
      currentProvidersWithObservation: number;
      complaintObservations: number;
    };
    enforcement: {
      observations: number;
      currentProvidersWithObservation: number;
      fines: number;
      paymentDenials: number;
      dateMin: string | null;
      dateMax: string | null;
    };
  };
  geography: GeographyRow[];
  sources: HubSourceRow[];
  limitations: string[];
}

const EXPECTED = {
  nh: 14690,
  hh: 12460,
  hospice: 6669,
} as const;

export function formatHubCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatHubPercent(value: number | null | undefined): string {
  if (value == null) return "Not reported";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function coverageShare(part: number, whole: number): string {
  const share = whole > 0 ? (100 * part) / whole : 0;
  return `${formatHubCount(part)} of ${formatHubCount(whole)} (${share.toFixed(1)}%)`;
}

export function assertSeniorHubIntelligence(
  value: SeniorNationalIntelligence,
): SeniorNationalIntelligence {
  if (value.contractVersion !== SENIOR_HUB_INTEL_VERSION) {
    throw new Error(`Unexpected hub contract ${value.contractVersion}`);
  }
  if (value.score !== null || value.ranking !== null) {
    throw new Error("Hub intelligence must not contain a score or ranking");
  }
  if (value.combinedProviderDenominator.publishAsHeadline !== false) {
    throw new Error("Combined class-record sum must not be a headline");
  }
  if (value.nursingHome.current !== EXPECTED.nh) {
    throw new Error(`NH current ${value.nursingHome.current} != ${EXPECTED.nh}`);
  }
  if (value.homeHealth.current !== EXPECTED.hh) {
    throw new Error(`HH current ${value.homeHealth.current} != ${EXPECTED.hh}`);
  }
  if (value.hospice.current !== EXPECTED.hospice) {
    throw new Error(`Hospice current ${value.hospice.current} != ${EXPECTED.hospice}`);
  }
  if (value.hospice.evidenceOnly !== value.hospice.typed - value.hospice.current) {
    throw new Error("EVIDENCE_ONLY hospice must equal typed minus GI current");
  }
  const nhGeo = value.geography.reduce((sum, row) => sum + row.nursingHomes, 0);
  const hhGeo = value.geography.reduce((sum, row) => sum + row.homeHealth, 0);
  const hospiceGeo = value.geography.reduce((sum, row) => sum + row.hospice, 0);
  if (nhGeo !== EXPECTED.nh || hhGeo !== EXPECTED.hh || hospiceGeo !== EXPECTED.hospice) {
    throw new Error(`Geography does not reconcile: NH ${nhGeo} HH ${hhGeo} Hospice ${hospiceGeo}`);
  }
  if (
    value.homeHealth.chow.status !== "UNSUPPORTED" ||
    value.hospice.chow.status !== "UNSUPPORTED"
  ) {
    throw new Error("HH and Hospice CHOW must remain unsupported");
  }
  assertStar(value.nursingHome.starDistribution, EXPECTED.nh);
  assertStar(value.homeHealth.starDistribution, EXPECTED.hh);
  return value;
}

function assertStar(dist: StarDistribution, directory: number) {
  const sum =
    dist.counts["1"] +
    dist.counts["2"] +
    dist.counts["3"] +
    dist.counts["4"] +
    dist.counts["5"] +
    dist.counts.missing;
  if (sum !== directory || dist.directory !== directory) {
    throw new Error(`Star distribution ${sum} != directory ${directory}`);
  }
}

export const HUB_PROHIBITED_LANGUAGE =
  /best nursing homes|worst nursing homes|highest trust|lowest trust|risk ranking|quality ranking|Trust Score|composite score|top hospice|best home health/i;

export const STATE_NAMES: Record<string, string> = {
  AK: "Alaska",
  AL: "Alabama",
  AR: "Arkansas",
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DC: "District of Columbia",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  GU: "Guam",
  HI: "Hawaii",
  IA: "Iowa",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  MA: "Massachusetts",
  MD: "Maryland",
  ME: "Maine",
  MI: "Michigan",
  MN: "Minnesota",
  MO: "Missouri",
  MP: "Northern Mariana Islands",
  MS: "Mississippi",
  MT: "Montana",
  NC: "North Carolina",
  ND: "North Dakota",
  NE: "Nebraska",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NV: "Nevada",
  NY: "New York",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  PR: "Puerto Rico",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VA: "Virginia",
  VI: "U.S. Virgin Islands",
  VT: "Vermont",
  WA: "Washington",
  WI: "Wisconsin",
  WV: "West Virginia",
  WY: "Wyoming",
};
