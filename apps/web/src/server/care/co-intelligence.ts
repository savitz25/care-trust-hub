import "server-only";
import { assertCoIntelligence, CO_PUBLIC_SNAPSHOT, type CoPublicSnapshot } from "@care/domain";

export function getCoIntelligence(): CoPublicSnapshot {
  return assertCoIntelligence(CO_PUBLIC_SNAPSHOT);
}
