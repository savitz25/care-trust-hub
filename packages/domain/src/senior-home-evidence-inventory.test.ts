import { describe, expect, it } from "vitest";
import metricsPayload from "../../../apps/web/src/data/senior-network-metrics-v1.json";
import type { SeniorNetworkMetricsV1 } from "./senior-network-metrics";
import {
  SENIOR_HOMEPAGE_STATE_CARDS,
  assertSeniorHomepageEvidenceInventory,
  buildSeniorHomepageEvidenceInventory,
} from "./senior-home-evidence-inventory";

const inventory = buildSeniorHomepageEvidenceInventory({
  networkMetrics: metricsPayload as SeniorNetworkMetricsV1,
  floridaIdentities: 6983,
  floridaRegulatoryObservations: 77219,
  floridaSourceAsOf: "2026-08-27",
});

describe("SEN-HOME-003 homepage evidence inventory", () => {
  it("retains incompatible grains as independently traceable measures", () => {
    expect(assertSeniorHomepageEvidenceInventory(inventory)).toBe(inventory);
    expect(inventory.length).toBeGreaterThanOrEqual(30);
    expect(new Set(inventory.map((row) => row.grain)).size).toBeGreaterThan(12);
    expect(inventory.some((row) => /combined|grand total/i.test(row.key))).toBe(false);
  });

  it("publishes accepted national measures but withholds internal graph and staffing grains", () => {
    expect(inventory.find((row) => row.key === "cms-health_deficiencies")?.value).toBe(419479);
    expect(inventory.find((row) => row.key === "cms-pbj_quarter_summaries")?.value).toBe(14487);
    expect(inventory.some((row) => row.key.includes("staffing_days"))).toBe(false);
    expect(inventory.some((row) => row.key.includes("ownership_graph_edges"))).toBe(false);
    expect(inventory.some((row) => row.key.includes("canonical_organizations"))).toBe(false);
  });

  it("represents every completed state with source-native semantics", () => {
    expect(SENIOR_HOMEPAGE_STATE_CARDS.map((row) => row.href)).toEqual([
      "/florida",
      "/new-jersey",
      "/california",
      "/texas",
      "/washington",
      "/arizona",
    ]);
    expect(inventory.find((row) => row.key === "fl-regulatory-observations")?.value).toBe(77219);
    expect(inventory.find((row) => row.key === "nj-enforcement-indexed")?.doesNotCount).toMatch(
      /unique actions/i,
    );
    expect(inventory.find((row) => row.key === "tx-hcssa")?.doesNotCount).toMatch(
      /CMS Home Health/i,
    );
    expect(inventory.find((row) => row.key === "wa-afh")?.doesNotCount).toMatch(/Assisted Living/i);
    expect(inventory.find((row) => row.key === "az-gis-all")?.doesNotCount).toMatch(
      /senior facilities/i,
    );
    expect(inventory.find((row) => row.key === "ca-rcfe")?.doesNotCount).toMatch(
      /CMS certification/i,
    );
  });

  it("distinguishes source clocks from generated clocks", () => {
    const mds = inventory.find((row) => row.key === "cms-mds_observations");
    expect(mds?.sourceAsOf).not.toBe(mds?.generatedOrRetrievedAt);
    expect(mds?.acceptedArtifact).toBe("senior-network-metrics-v1.json");
  });
});
