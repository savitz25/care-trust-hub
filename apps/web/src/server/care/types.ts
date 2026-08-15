export interface CareProviderLocation {
  address: string | null;
  city: string | null;
  state: string;
  zipCode: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface CareCmsRatingSummary {
  overall: number | null;
  healthInspection: number | null;
  staffing: number | null;
  qualityMeasure: number | null;
}

export interface CareFreshness {
  sourceModifiedAt: string | null;
  sourcePublishedAt: string | null;
  retrievedAt: string;
  ingestCompletedAt: string;
}

export interface CareSourceDisclosure {
  sourceOrganization: string;
  datasetName: string;
  cmsDatasetIdentifier: string;
  releaseIdentifier: string;
  officialSourceUrl: string;
  providerIdentifier: string;
  sourceRecordLocator: string;
  freshness: CareFreshness;
}

export interface CareProviderSummary {
  ccn: string;
  providerName: string;
  location: CareProviderLocation;
  certifiedBeds: number | null;
  ratings: CareCmsRatingSummary;
}

export interface CareProviderDetail extends CareProviderSummary {
  legalBusinessName: string | null;
  telephone: string | null;
  ownershipType: string | null;
  participationType: string | null;
  participatesMedicare: boolean | null;
  participatesMedicaid: boolean | null;
  source: CareSourceDisclosure;
}

export interface CareProviderSearchResult extends CareProviderSummary {
  ownershipType: string | null;
  participationType: string | null;
  participatesMedicare: boolean | null;
  participatesMedicaid: boolean | null;
  source: CareSourceDisclosure;
  distanceMiles?: number;
}

export type CareProviderSort = "name" | "cms-overall-desc" | "distance";

export interface ConsumerProviderSearch {
  query?: string;
  state?: string;
  city?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  overallRating?: number;
  staffingRating?: number;
  healthInspectionRating?: number;
  ownership?: string;
  medicare?: boolean;
  medicaid?: boolean;
  sort?: CareProviderSort;
  limit?: number;
}

export interface CareProviderHistoryMetadata {
  releaseIdentifier: string;
  sourceModifiedAt: string | null;
  retrievedAt: string;
  transformationVersion: string;
}

export interface DevelopmentProviderSearch {
  query?: string;
  state?: string;
  city?: string;
  zip?: string;
  limit?: number;
}

export interface ProviderDistanceResult extends CareProviderSummary {
  distanceMiles: number;
}

export interface CareRegulatorySourceDisclosure {
  sourceOrganization: string;
  datasetName: string;
  cmsDatasetIdentifier: string;
  officialSourceUrl: string;
  releaseIdentifier: string;
  sourceModifiedAt: string | null;
  retrievedAt: string;
  providerIdentifier: string;
  sourceRecordLocator: string;
}

export interface CareScopeSeverity {
  code: string;
  scope: "Isolated" | "Pattern" | "Widespread";
  severity: string;
  severityLevel: 1 | 2 | 3 | 4;
  immediateJeopardy: boolean;
}

export interface CareDeficiencyFinding {
  id: string;
  tag: string;
  category: string | null;
  officialDescription: string | null;
  scopeSeverity: CareScopeSeverity;
  correctionStatus: string | null;
  correctionDate: string | null;
  underIdr: boolean | null;
  underIidr: boolean | null;
  source: CareRegulatorySourceDisclosure;
}

export interface CareInspection {
  id: string;
  surveyDate: string;
  surveyType: string;
  surveyCycle: number;
  findings: CareDeficiencyFinding[];
  highestScopeSeverity: CareScopeSeverity | null;
  source: CareRegulatorySourceDisclosure;
}

export interface CarePenalty {
  id: string;
  penaltyDate: string;
  penaltyType: "Fine" | "Payment Denial";
  fineAmount: string | null;
  paymentDenialStartDate: string | null;
  paymentDenialDays: number | null;
  source: CareRegulatorySourceDisclosure;
}

export interface CareHistoryEvent {
  id: string;
  eventDate: string;
  kind: "inspection" | "penalty" | "ownership";
  title: string;
  detail: string;
}

export interface CareRegulatoryIntelligence {
  inspections: CareInspection[];
  penalties: CarePenalty[];
  repeatTags: Array<{ tag: string; inspectionCount: number }>;
  timeline: CareHistoryEvent[];
}

export interface CareStaffingSourceDisclosure {
  sourceOrganization: string;
  datasetName: string;
  cmsDatasetIdentifier: string;
  sourceVersionIdentifier: string | null;
  officialSourceUrl: string;
  releaseIdentifier: string;
  sourceQuarter: string;
  sourceModifiedAt: string | null;
  sourcePublishedAt: string | null;
  retrievedAt: string;
  providerIdentifier: string;
  sourceRecordLocator: string;
}

export interface CareStaffingQuarterSummary {
  quarter: string;
  coverageStart: string;
  coverageEnd: string;
  daysRepresented: number;
  positiveCensusDays: number;
  missingCensusDays: number;
  totalNurseHprd: number | null;
  rnHprd: number | null;
  lpnHprd: number | null;
  cnaHprd: number | null;
  weekdayTotalNurseHprd: number | null;
  weekendTotalNurseHprd: number | null;
  weekdayRnHprd: number | null;
  weekendRnHprd: number | null;
  contractNurseShare: number | null;
  zeroReportedRnDays: number;
  formulaVersion: string;
  source: CareStaffingSourceDisclosure;
}

export interface CareDailyStaffing {
  workDate: string;
  residentCensus: number | null;
  totalNurseHprd: number | null;
  rnHprd: number | null;
  lpnHprd: number | null;
  cnaHprd: number | null;
  isWeekend: boolean;
}

export interface CareStaffingIntelligence {
  latest: CareStaffingQuarterSummary | null;
  history: CareStaffingQuarterSummary[];
}

export interface CareOwnershipSourceDisclosure {
  sourceOrganization: string;
  datasetName: string;
  cmsDatasetIdentifier: string;
  officialSourceUrl: string;
  releaseIdentifier: string;
  sourceModifiedAt: string | null;
  retrievedAt: string;
}

export interface CareOwnershipParty {
  id: string;
  kind: "organization" | "individual";
  displayName: string;
  roleCode: string | null;
  roleText: string;
  associationDate: string | null;
  ownershipPercentage: number | null;
  classifications: Record<string, boolean | string>;
  connectedProviderCount: number | null;
  connectedStates: string[];
  source: CareOwnershipSourceDisclosure;
}

export interface CareOwnershipChange {
  id: string;
  effectiveDate: string;
  changeTypeCode: string;
  changeTypeText: string;
  buyerName: string;
  sellerName: string;
  source: CareOwnershipSourceDisclosure;
}

export interface CareOwnershipIntelligence {
  parties: CareOwnershipParty[];
  totalPartyCount: number;
  changes: CareOwnershipChange[];
}
