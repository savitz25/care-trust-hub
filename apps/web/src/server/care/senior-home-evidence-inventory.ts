import "server-only";
import { getSeniorNetworkMetrics } from "./senior-network-metrics";
function homepage() {
  const value = getSeniorNetworkMetrics().homepage;
  if (!value) throw new Error("Generated Senior homepage projection missing");
  return value;
}
export function getSeniorHomepageEvidenceInventory() {
  return homepage().evidenceInventory;
}
export function getSeniorHomepageStateCards() {
  return homepage().stateCards;
}
