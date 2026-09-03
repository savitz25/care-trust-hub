import { createHash } from "node:crypto";
import type { SeniorNationalIntelligence } from "./senior-hub-intelligence";

export const SENIOR_NETWORK_METRICS_VERSION = "senior-network-metrics-v1";

export const HOMEPAGE_EVIDENCE_METRIC_KEYS = [
  "mds_observations",
  "fire_citations",
  "inspection_events",
  "health_deficiencies",
  "enforcement_records",
  "pbj_quarter_summaries",
  "chow_events",
] as const;

export type NetworkProviderClass =
  | "nursing_home"
  | "home_health"
  | "hospice"
  | "ownership_graph"
  | "cross_class";

export type NetworkPublicationStatus = "PUBLIC" | "INTERNAL" | "UNSUPPORTED" | "REJECTED";

export type NetworkMetricGrain =
  | "current_directory_provider"
  | "known_ccn_identity"
  | "evidence_only_identity"
  | "directory_exclusion"
  | "mds_observation"
  | "fire_citation"
  | "inspection_event"
  | "health_deficiency"
  | "enforcement_record"
  | "civil_monetary_penalty"
  | "payment_denial"
  | "pbj_quarter_summary"
  | "pbj_staffing_day"
  | "ownership_edge"
  | "organization"
  | "chow_event"
  | "quality_observation"
  | "service_zip"
  | "combined_provider_classes"
  | "combined_incompatible_evidence_grains";

export const PROVIDER_COUNT_GRAINS: ReadonlySet<NetworkMetricGrain> = new Set([
  "current_directory_provider",
  "known_ccn_identity",
  "evidence_only_identity",
  "directory_exclusion",
]);

export const EVIDENCE_ROW_GRAINS: ReadonlySet<NetworkMetricGrain> = new Set([
  "mds_observation",
  "fire_citation",
  "inspection_event",
  "health_deficiency",
  "enforcement_record",
  "civil_monetary_penalty",
  "payment_denial",
  "pbj_quarter_summary",
  "pbj_staffing_day",
  "ownership_edge",
  "organization",
  "chow_event",
  "quality_observation",
  "service_zip",
]);

export interface NetworkMetricTrace {
  method: string;
  payloadKey: string;
  components: Array<{ label: string; value: string; payloadKey: string }>;
  limitations: string[];
}

export interface NetworkMetric {
  key: string;
  label: string;
  value: number | null;
  unit: "count";
  grain: NetworkMetricGrain;
  denominator: string;
  providerClass: NetworkProviderClass;
  description: string;
  coverage: {
    numerator: number | null;
    denominator: number | null;
    display: string;
  };
  contributingSourceSystems: string[];
  sourceAsOf: string | null;
  generatedAt: string;
  trace: NetworkMetricTrace;
  publicationStatus: NetworkPublicationStatus;
}

export interface NetworkFreshnessSource {
  datasetKey: string;
  sourceAsOf: string | null;
  retrievedAt: string | null;
  sourcePeriod: string | null;
  freshnessBand: string | null;
}

export interface SeniorNetworkMetricsV1 {
  schemaVersion: typeof SENIOR_NETWORK_METRICS_VERSION;
  generatedAt: string;
  sourceFingerprint: string;
  canonicalSnapshotFingerprint: string;
  newestSourceAsOf: {
    value: string | null;
    semantics: string;
  };
  combinedProviderDenominator: {
    status: "UNSUPPORTED";
    classRecordSum: number;
    publishAsHeadline: false;
    semantics: string;
  };
  combinedEvidenceDepth: {
    status: "REJECTED";
    publishAsHeadline: false;
    candidateCurrentReleaseSum: number;
    enumeratedGrains: string[];
    reason: string;
  };
  providerUniverses: {
    nursingHome: {
      current: number;
      known: number;
      absentFromCurrentDirectory: number;
      identity: string;
      directory: string;
      publicationGate: string;
    };
    homeHealth: {
      current: number;
      known: number;
      identity: string;
      directory: string;
      publicationGate: string;
    };
    hospice: {
      current: number;
      typed: number;
      evidenceOnly: number;
      identity: string;
      directory: string;
      publicationGate: string;
    };
  };
  evidenceFamilies: Record<
    string,
    {
      key: string;
      grain: NetworkMetricGrain;
      currentReleaseCount: number | null;
      allIngestedReleasesCount: number | null;
      publicationStatus: NetworkPublicationStatus;
    }
  >;
  geography: {
    states: Array<{
      state: string;
      nursingHomes: number;
      homeHealth: number;
      hospice: number;
    }>;
    note: string;
  };
  freshness: {
    sources: NetworkFreshnessSource[];
    note: string;
  };
  metrics: NetworkMetric[];
}

export function publicNetworkMetrics(manifest: SeniorNetworkMetricsV1): NetworkMetric[] {
  return manifest.metrics.filter((metric) => metric.publicationStatus === "PUBLIC");
}

export function metricByKey(
  manifest: SeniorNetworkMetricsV1,
  key: string,
): NetworkMetric | undefined {
  return manifest.metrics.find((metric) => metric.key === key);
}

export function stableNetworkMetricsJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableNetworkMetricsJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableNetworkMetricsJson(record[key])}`)
    .join(",")}}`;
}

export function fingerprintSeniorNetworkMetrics(
  manifest: Omit<SeniorNetworkMetricsV1, "sourceFingerprint"> | SeniorNetworkMetricsV1,
): string {
  const copy = JSON.parse(JSON.stringify(manifest)) as Record<string, unknown>;
  delete copy.generatedAt;
  delete copy.sourceFingerprint;
  return createHash("sha256").update(stableNetworkMetricsJson(copy)).digest("hex");
}

function requireMetric(manifest: SeniorNetworkMetricsV1, key: string): NetworkMetric {
  const metric = metricByKey(manifest, key);
  if (!metric) {
    throw new Error(`Missing network metric ${key}`);
  }
  return metric;
}

export function assertSeniorNetworkMetrics(value: SeniorNetworkMetricsV1): SeniorNetworkMetricsV1 {
  if (value.schemaVersion !== SENIOR_NETWORK_METRICS_VERSION) {
    throw new Error(`Unexpected network metrics schema ${value.schemaVersion}`);
  }
  if (!value.generatedAt.includes("T")) {
    throw new Error("generatedAt must be a timestamp, not a source date");
  }
  if (value.combinedProviderDenominator.publishAsHeadline !== false) {
    throw new Error("Combined provider denominator must not be a headline");
  }
  if (value.combinedProviderDenominator.status !== "UNSUPPORTED") {
    throw new Error("Combined provider denominator must remain unsupported");
  }
  if (value.combinedEvidenceDepth.status !== "REJECTED") {
    throw new Error("Combined evidence depth must remain rejected");
  }
  if (value.combinedEvidenceDepth.publishAsHeadline !== false) {
    throw new Error("Combined evidence depth must not be a headline");
  }

  const nh = value.providerUniverses.nursingHome;
  const hh = value.providerUniverses.homeHealth;
  const hospice = value.providerUniverses.hospice;
  if (nh.known < nh.current) {
    throw new Error("Known nursing-home CCNs cannot be below current directory");
  }
  if (nh.absentFromCurrentDirectory !== nh.known - nh.current) {
    throw new Error("NH exclusions must equal known minus current");
  }
  if (hospice.evidenceOnly !== hospice.typed - hospice.current) {
    throw new Error("Hospice evidence-only must equal typed minus GI current");
  }
  if (
    value.combinedProviderDenominator.classRecordSum !==
    nh.current + hh.current + hospice.current
  ) {
    throw new Error("Unsupported class-record sum drifted from separate universes");
  }

  const geoNh = value.geography.states.reduce((sum, row) => sum + row.nursingHomes, 0);
  const geoHh = value.geography.states.reduce((sum, row) => sum + row.homeHealth, 0);
  const geoHospice = value.geography.states.reduce((sum, row) => sum + row.hospice, 0);
  if (geoNh !== nh.current || geoHh !== hh.current || geoHospice !== hospice.current) {
    throw new Error(`Geography does not reconcile: NH ${geoNh} HH ${geoHh} Hospice ${geoHospice}`);
  }

  const currentNh = requireMetric(value, "current_nursing_homes");
  const currentHh = requireMetric(value, "current_home_health_agencies");
  const currentHospice = requireMetric(value, "current_hospice_providers");
  if (currentNh.value !== nh.current || currentNh.grain !== "current_directory_provider") {
    throw new Error("Current nursing homes metric is mislabeled");
  }
  if (currentHh.value !== hh.current || currentHh.grain !== "current_directory_provider") {
    throw new Error("Current home health metric is mislabeled");
  }
  if (
    currentHospice.value !== hospice.current ||
    currentHospice.grain !== "current_directory_provider"
  ) {
    throw new Error("Current hospice metric is mislabeled");
  }
  const publicProviderKeys = publicNetworkMetrics(value)
    .filter((metric) => metric.grain === "current_directory_provider")
    .map((metric) => metric.key)
    .sort();
  if (
    JSON.stringify(publicProviderKeys) !==
    JSON.stringify([
      "current_home_health_agencies",
      "current_hospice_providers",
      "current_nursing_homes",
    ])
  ) {
    throw new Error("Public provider-grain metrics are mislabeled");
  }
  const lockedGrains: Array<[string, NetworkMetricGrain]> = [
    ["mds_observations", "mds_observation"],
    ["fire_citations", "fire_citation"],
    ["inspection_events", "inspection_event"],
    ["health_deficiencies", "health_deficiency"],
    ["enforcement_records", "enforcement_record"],
    ["chow_events", "chow_event"],
  ];
  for (const [key, grain] of lockedGrains) {
    if (requireMetric(value, key).grain !== grain) {
      throw new Error(`${key} metric is mislabeled`);
    }
  }

  const knownNh = requireMetric(value, "known_nursing_home_ccns");
  if (knownNh.publicationStatus !== "INTERNAL" || knownNh.value !== nh.known) {
    throw new Error("Known CCNs must stay internal and exactly labeled");
  }
  const evidenceOnly = requireMetric(value, "hospice_evidence_only");
  if (
    evidenceOnly.publicationStatus !== "INTERNAL" ||
    evidenceOnly.value !== hospice.evidenceOnly
  ) {
    throw new Error("Evidence-only hospice identities must stay internal");
  }
  const combinedProviders = requireMetric(value, "combined_cms_senior_providers");
  if (
    combinedProviders.publicationStatus !== "UNSUPPORTED" ||
    combinedProviders.value !== null ||
    combinedProviders.grain !== "combined_provider_classes"
  ) {
    throw new Error("Combined senior providers must remain an unsupported non-value");
  }
  const combinedEvidence = requireMetric(value, "combined_indexed_evidence_records");
  if (
    combinedEvidence.publicationStatus !== "REJECTED" ||
    combinedEvidence.value !== null ||
    combinedEvidence.grain !== "combined_incompatible_evidence_grains"
  ) {
    throw new Error("Combined evidence metric must remain rejected");
  }

  for (const metric of value.metrics) {
    if (metric.generatedAt !== value.generatedAt) {
      throw new Error(`Metric ${metric.key} generatedAt must match the manifest clock`);
    }
    if (metric.sourceAsOf && metric.sourceAsOf.includes("T")) {
      throw new Error(`Metric ${metric.key} sourceAsOf must be an official date, not a timestamp`);
    }
    if (
      metric.publicationStatus === "PUBLIC" &&
      PROVIDER_COUNT_GRAINS.has(metric.grain) &&
      metric.grain !== "current_directory_provider"
    ) {
      throw new Error(`Public provider metric ${metric.key} used a non-current grain`);
    }
    if (
      metric.publicationStatus === "PUBLIC" &&
      EVIDENCE_ROW_GRAINS.has(metric.grain) &&
      metric.grain === "current_directory_provider"
    ) {
      throw new Error(`Evidence metric ${metric.key} cannot use a provider grain`);
    }
    if (metric.unit !== "count") {
      throw new Error(`Metric ${metric.key} must keep count units`);
    }
  }

  const publicProviderSum = publicNetworkMetrics(value)
    .filter((metric) => metric.grain === "current_directory_provider")
    .reduce((sum, metric) => sum + (metric.value ?? 0), 0);
  if (publicProviderSum === nh.current + hh.current + hospice.current) {
    const publicProviderKeys = publicNetworkMetrics(value)
      .filter((metric) => metric.grain === "current_directory_provider")
      .map((metric) => metric.key);
    if (publicProviderKeys.includes("combined_cms_senior_providers")) {
      throw new Error("Public catalog silently summed provider classes");
    }
  }

  const expected = fingerprintSeniorNetworkMetrics(value);
  if (value.sourceFingerprint !== expected) {
    throw new Error("Network metrics fingerprint mismatch");
  }

  const publicAsOf = publicNetworkMetrics(value)
    .map((metric) => metric.sourceAsOf)
    .filter((value): value is string => Boolean(value))
    .sort();
  const newest = publicAsOf.at(-1) ?? null;
  if (value.newestSourceAsOf.value !== newest) {
    throw new Error("newestSourceAsOf does not match the newest public metric sourceAsOf");
  }
  if (!/not a (single )?network clock|not a deployment/i.test(value.newestSourceAsOf.semantics)) {
    throw new Error("newestSourceAsOf semantics must deny a single network/deploy clock");
  }
  return value;
}

export function assertNetworkMetricsMatchHubIntel(
  manifest: SeniorNetworkMetricsV1,
  intel: SeniorNationalIntelligence,
): void {
  assertSeniorNetworkMetrics(manifest);
  if (manifest.canonicalSnapshotFingerprint !== intel.sourceFingerprint) {
    throw new Error("Network metrics canonical snapshot fingerprint is stale versus hub intel");
  }
  if (manifest.providerUniverses.nursingHome.current !== intel.nursingHome.current) {
    throw new Error("Nursing Home current drifted from hub intel");
  }
  if (manifest.providerUniverses.homeHealth.current !== intel.homeHealth.current) {
    throw new Error("Home Health current drifted from hub intel");
  }
  if (manifest.providerUniverses.hospice.current !== intel.hospice.current) {
    throw new Error("Hospice current drifted from hub intel");
  }
  if (manifest.providerUniverses.hospice.evidenceOnly !== intel.hospice.evidenceOnly) {
    throw new Error("Hospice evidence-only drifted from hub intel");
  }
}

export const NETWORK_METRICS_PROHIBITED_LANGUAGE =
  /best nursing homes|worst nursing homes|highest trust|lowest trust|Trust Score|senior providers in America|1\.6M\+ indexed senior-care evidence records/i;
