import "server-only";
import { assertCaIntelligence, CA_PUBLIC_SNAPSHOT, type CaPublicSnapshot } from "@care/domain";

export function getCaIntelligence(): CaPublicSnapshot {
  return assertCaIntelligence(CA_PUBLIC_SNAPSHOT);
}
