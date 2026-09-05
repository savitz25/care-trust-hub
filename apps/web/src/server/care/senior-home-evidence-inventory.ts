import "server-only";
import { buildSeniorHomepageEvidenceInventory, SENIOR_HOMEPAGE_STATE_CARDS } from "@care/domain";
import florida from "@/data/florida-intelligence.json";
import { getSeniorNetworkMetrics } from "./senior-network-metrics";

export function getSeniorHomepageEvidenceInventory() {
  return buildSeniorHomepageEvidenceInventory({
    networkMetrics: getSeniorNetworkMetrics(),
    floridaIdentities: florida.providers.current,
    floridaRegulatoryObservations: florida.regulatory.observations,
    floridaSourceAsOf: florida.asOf.slice(0, 10),
  });
}

export function getSeniorHomepageStateCards() {
  return SENIOR_HOMEPAGE_STATE_CARDS;
}
