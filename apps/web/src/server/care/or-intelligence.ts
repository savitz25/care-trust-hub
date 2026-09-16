import "server-only";
import { assertOrIntelligence, OR_PUBLIC_SNAPSHOT, type OrPublicSnapshot } from "@care/domain";

export function getOrIntelligence(): OrPublicSnapshot {
  return assertOrIntelligence(OR_PUBLIC_SNAPSHOT);
}
