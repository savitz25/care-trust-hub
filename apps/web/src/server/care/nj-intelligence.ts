import "server-only";
import { assertNjIntelligence, NJ_PUBLIC_SNAPSHOT, type NjPublicSnapshot } from "@care/domain";

export function getNjIntelligence(): NjPublicSnapshot {
  return assertNjIntelligence(NJ_PUBLIC_SNAPSHOT);
}
