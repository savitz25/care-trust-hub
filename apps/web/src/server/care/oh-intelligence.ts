import "server-only";
import { assertOhIntelligence, OH_PUBLIC_SNAPSHOT, type OhPublicSnapshot } from "@care/domain";

export function getOhIntelligence(): OhPublicSnapshot {
  return assertOhIntelligence(OH_PUBLIC_SNAPSHOT);
}
