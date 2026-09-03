import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertSeniorHubIntelligence,
  type SeniorNationalIntelligence,
} from "./senior-hub-intelligence";
import {
  EVIDENCE_ROW_GRAINS,
  HOMEPAGE_EVIDENCE_METRIC_KEYS,
  NETWORK_METRICS_PROHIBITED_LANGUAGE,
  PROVIDER_COUNT_GRAINS,
  SENIOR_NETWORK_METRICS_VERSION,
  assertNetworkMetricsMatchHubIntel,
  assertSeniorNetworkMetrics,
  fingerprintSeniorNetworkMetrics,
  metricByKey,
  publicNetworkMetrics,
  type SeniorNetworkMetricsV1,
} from "./senior-network-metrics";

const dir = dirname(fileURLToPath(import.meta.url));

function loadManifest(): SeniorNetworkMetricsV1 {
  return JSON.parse(
    readFileSync(join(dir, "../../../apps/web/src/data/senior-network-metrics-v1.json"), "utf8"),
  ) as SeniorNetworkMetricsV1;
}

function loadHubIntel(): SeniorNationalIntelligence {
  return assertSeniorHubIntelligence(
    JSON.parse(
      readFileSync(
        join(dir, "../../../apps/web/src/data/senior-national-intelligence.json"),
        "utf8",
      ),
    ) as SeniorNationalIntelligence,
  );
}

function clone(manifest: SeniorNetworkMetricsV1): SeniorNetworkMetricsV1 {
  return JSON.parse(JSON.stringify(manifest)) as SeniorNetworkMetricsV1;
}

function resign(manifest: SeniorNetworkMetricsV1): SeniorNetworkMetricsV1 {
  manifest.sourceFingerprint = fingerprintSeniorNetworkMetrics(manifest);
  return manifest;
}

describe("senior-network-metrics-v1", () => {
  it("is a versioned production-derived contract with a stable fingerprint", () => {
    const manifest = assertSeniorNetworkMetrics(loadManifest());
    expect(manifest.schemaVersion).toBe(SENIOR_NETWORK_METRICS_VERSION);
    expect(manifest.sourceFingerprint).toBe(fingerprintSeniorNetworkMetrics(manifest));
    expect(manifest.sourceFingerprint).toHaveLength(64);
    expect(manifest.generatedAt).toMatch(/T/);
    expect(manifest.newestSourceAsOf.semantics).toMatch(/not a deployment/i);
  });

  it("keeps Nursing Home, Home Health, and Hospice as separate current universes", () => {
    const manifest = assertSeniorNetworkMetrics(loadManifest());
    const nh = metricByKey(manifest, "current_nursing_homes");
    const hh = metricByKey(manifest, "current_home_health_agencies");
    const hospice = metricByKey(manifest, "current_hospice_providers");
    expect(nh?.value).toBe(14690);
    expect(hh?.value).toBe(12460);
    expect(hospice?.value).toBe(6669);
    expect(nh?.grain).toBe("current_directory_provider");
    expect(hh?.grain).toBe("current_directory_provider");
    expect(hospice?.grain).toBe("current_directory_provider");
    expect(nh?.providerClass).toBe("nursing_home");
    expect(hh?.providerClass).toBe("home_health");
    expect(hospice?.providerClass).toBe("hospice");
    expect(manifest.combinedProviderDenominator.status).toBe("UNSUPPORTED");
    expect(manifest.combinedProviderDenominator.classRecordSum).toBe(33819);
    expect(publicNetworkMetrics(manifest).some((metric) => metric.value === 33819)).toBe(false);
  });

  it("does not silently sum NH + HHA + Hospice into a public provider total", () => {
    const manifest = clone(loadManifest());
    const combined = metricByKey(manifest, "combined_cms_senior_providers");
    expect(combined).toBeDefined();
    combined!.publicationStatus = "PUBLIC";
    combined!.value = 33819;
    resign(manifest);
    expect(() => assertSeniorNetworkMetrics(manifest)).toThrow(/unsupported|silently summed/i);
  });

  it("does not let evidence rows become provider counts", () => {
    const manifest = clone(loadManifest());
    const mds = metricByKey(manifest, "mds_observations");
    expect(mds?.grain).toBe("mds_observation");
    mds!.grain = "current_directory_provider";
    mds!.publicationStatus = "PUBLIC";
    resign(manifest);
    expect(() => assertSeniorNetworkMetrics(manifest)).toThrow(/mislabeled|provider grain/i);
  });

  it("does not promote evidence-only hospice rows into current hospice providers", () => {
    const manifest = clone(loadManifest());
    const current = metricByKey(manifest, "current_hospice_providers");
    const evidenceOnly = metricByKey(manifest, "hospice_evidence_only");
    expect(evidenceOnly?.publicationStatus).toBe("INTERNAL");
    expect(evidenceOnly?.value).toBe(242);
    current!.value = (current!.value ?? 0) + (evidenceOnly!.value ?? 0);
    manifest.providerUniverses.hospice.current = current!.value ?? 0;
    resign(manifest);
    expect(() => assertSeniorNetworkMetrics(manifest)).toThrow(/evidence-only|GI current/i);
  });

  it("does not label known CCNs as current providers", () => {
    const manifest = clone(loadManifest());
    const known = metricByKey(manifest, "known_nursing_home_ccns");
    expect(known?.publicationStatus).toBe("INTERNAL");
    expect(known?.value).toBe(14696);
    known!.publicationStatus = "PUBLIC";
    known!.grain = "current_directory_provider";
    resign(manifest);
    expect(() => assertSeniorNetworkMetrics(manifest)).toThrow(
      /internal|non-current grain|mislabeled/i,
    );
  });

  it("fails closed if the manifest is stale versus hub intelligence", () => {
    const manifest = clone(loadManifest());
    const intel = loadHubIntel();
    assertNetworkMetricsMatchHubIntel(manifest, intel);
    manifest.canonicalSnapshotFingerprint = "0".repeat(64);
    resign(manifest);
    expect(() => assertNetworkMetricsMatchHubIntel(manifest, intel)).toThrow(/stale/i);
  });

  it("does not substitute deployment or generation time for official sourceAsOf", () => {
    const manifest = assertSeniorNetworkMetrics(loadManifest());
    for (const metric of publicNetworkMetrics(manifest)) {
      expect(metric.sourceAsOf).not.toBeNull();
      expect(metric.sourceAsOf).not.toBe(manifest.generatedAt);
      expect(metric.sourceAsOf).not.toMatch(/T/);
      expect(metric.generatedAt).toBe(manifest.generatedAt);
    }
    const mutated = clone(manifest);
    const nh = metricByKey(mutated, "current_nursing_homes");
    nh!.sourceAsOf = mutated.generatedAt;
    resign(mutated);
    expect(() => assertSeniorNetworkMetrics(mutated)).toThrow(/official date|timestamp/i);
  });

  it("keeps inactive and evidence-only identities out of current populations", () => {
    const manifest = assertSeniorNetworkMetrics(loadManifest());
    expect(manifest.providerUniverses.nursingHome.absentFromCurrentDirectory).toBe(6);
    expect(
      metricByKey(manifest, "nursing_homes_absent_from_current_directory")?.publicationStatus,
    ).toBe("INTERNAL");
    expect(metricByKey(manifest, "nursing_homes_absent_from_current_directory")?.value).toBe(6);
    const mutated = clone(manifest);
    mutated.providerUniverses.nursingHome.current += 6;
    metricByKey(mutated, "current_nursing_homes")!.value =
      mutated.providerUniverses.nursingHome.current;
    resign(mutated);
    expect(() => assertSeniorNetworkMetrics(mutated)).toThrow(/exclusions|known minus current/i);
  });

  it("does not treat MDS, inspections, citations, enforcement, or ownership as interchangeable", () => {
    const manifest = assertSeniorNetworkMetrics(loadManifest());
    const grains = [
      "mds_observations",
      "fire_citations",
      "inspection_events",
      "health_deficiencies",
      "enforcement_records",
      "chow_events",
    ].map((key) => metricByKey(manifest, key)?.grain);
    expect(new Set(grains).size).toBe(6);
    for (const metric of publicNetworkMetrics(manifest)) {
      if (EVIDENCE_ROW_GRAINS.has(metric.grain)) {
        expect(PROVIDER_COUNT_GRAINS.has(metric.grain)).toBe(false);
      }
    }
    expect(manifest.combinedEvidenceDepth.status).toBe("REJECTED");
    expect(metricByKey(manifest, "combined_indexed_evidence_records")?.value).toBeNull();
    expect(JSON.stringify(manifest)).not.toMatch(NETWORK_METRICS_PROHIBITED_LANGUAGE);
  });

  it("exposes homepage evidence keys as public source-native grains", () => {
    const manifest = assertSeniorNetworkMetrics(loadManifest());
    for (const key of HOMEPAGE_EVIDENCE_METRIC_KEYS) {
      const metric = metricByKey(manifest, key);
      expect(metric?.publicationStatus).toBe("PUBLIC");
      expect(EVIDENCE_ROW_GRAINS.has(metric!.grain)).toBe(true);
    }
  });

  it("publishes current-release evidence grains, not stacked ingest history, for inspections and penalties", () => {
    const manifest = assertSeniorNetworkMetrics(loadManifest());
    expect(metricByKey(manifest, "mds_observations")?.value).toBe(1248650);
    expect(metricByKey(manifest, "fire_citations")?.value).toBe(200327);
    expect(metricByKey(manifest, "inspection_events")?.value).toBe(149978);
    expect(metricByKey(manifest, "health_deficiencies")?.value).toBe(419479);
    expect(metricByKey(manifest, "enforcement_records")?.value).toBe(15694);
    expect(metricByKey(manifest, "civil_monetary_penalties")?.value).toBe(13254);
    expect(metricByKey(manifest, "payment_denials")?.value).toBe(2440);
    expect(metricByKey(manifest, "pbj_quarter_summaries")?.value).toBe(14487);
    expect(
      metricByKey(manifest, "inspection_events_all_ingested_releases")?.publicationStatus,
    ).toBe("INTERNAL");
    expect(metricByKey(manifest, "inspection_events_all_ingested_releases")?.value).toBe(299683);
  });
});
