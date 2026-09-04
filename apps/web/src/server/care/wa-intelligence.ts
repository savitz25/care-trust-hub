import "server-only";
import { assertWaIntelligence, WA_PUBLIC_SNAPSHOT, type WaPublicSnapshot } from "@care/domain";

export function getWaIntelligence(): WaPublicSnapshot {
  return assertWaIntelligence(WA_PUBLIC_SNAPSHOT);
}
