import "server-only";
import { assertGaIntelligence, GA_PUBLIC_SNAPSHOT, type GaPublicSnapshot } from "@care/domain";

export function getGaIntelligence(): GaPublicSnapshot {
  return assertGaIntelligence(GA_PUBLIC_SNAPSHOT);
}
