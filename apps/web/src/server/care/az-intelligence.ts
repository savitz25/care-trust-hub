import "server-only";
import { assertAzIntelligence, AZ_PUBLIC_SNAPSHOT, type AzPublicSnapshot } from "@care/domain";

export function getAzIntelligence(): AzPublicSnapshot {
  return assertAzIntelligence(AZ_PUBLIC_SNAPSHOT);
}
