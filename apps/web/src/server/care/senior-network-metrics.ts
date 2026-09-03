import "server-only";
import {
  assertNetworkMetricsMatchHubIntel,
  assertSeniorNetworkMetrics,
  type SeniorNetworkMetricsV1,
} from "@care/domain";
import payload from "@/data/senior-network-metrics-v1.json";
import { getSeniorHubIntelligence } from "./senior-hub-intelligence";

export function getSeniorNetworkMetrics(): SeniorNetworkMetricsV1 {
  const manifest = assertSeniorNetworkMetrics(payload as SeniorNetworkMetricsV1);
  assertNetworkMetricsMatchHubIntel(manifest, getSeniorHubIntelligence());
  return manifest;
}
