import "server-only";
import { getSeniorNetworkMetrics } from "./senior-network-metrics";
export function getSeniorHomeIntel() {
  const homepage = getSeniorNetworkMetrics().homepage;
  if (!homepage) throw new Error("Generated Senior homepage projection missing");
  return homepage.intel;
}
