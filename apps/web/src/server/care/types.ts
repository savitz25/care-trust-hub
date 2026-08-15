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
  kind: "inspection" | "penalty";
  title: string;
  detail: string;
}

export interface CareRegulatoryIntelligence {
  inspections: CareInspection[];
  penalties: CarePenalty[];
  repeatTags: Array<{ tag: string; inspectionCount: number }>;
  timeline: CareHistoryEvent[];
}
