import { assertVaIntelligence, VA_PUBLIC_SNAPSHOT, type VaPublicSnapshot } from "@care/domain";

export function getVaIntelligence(): VaPublicSnapshot {
  return assertVaIntelligence(VA_PUBLIC_SNAPSHOT);
}
