import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

function source(rel: string): string {
  return readFileSync(join(here, rel), "utf8");
}

describe("senior-network-metrics-v1 publication", () => {
  it("is loaded by the specialist homepage and class landings", () => {
    expect(source("../../app/page.tsx")).toMatch(/getSeniorNetworkMetrics/);
    expect(source("../../app/home-health/page.tsx")).toMatch(/getSeniorNetworkMetrics/);
    expect(source("../../app/hospice/page.tsx")).toMatch(/getSeniorNetworkMetrics/);
    expect(source("../../app/home-health/page.tsx")).not.toMatch(/Search 12,460 current/);
    expect(source("../../app/hospice/page.tsx")).not.toMatch(/Search 6,669 current/);
  });

  it("does not hardcode AskTrustHub consumption", () => {
    const loader = source("./senior-network-metrics.ts");
    expect(loader).toMatch(/assertNetworkMetricsMatchHubIntel/);
    expect(loader).not.toMatch(/ask-trust-hub|AskTrustHub|consumers-trust-hub/i);
  });
});
