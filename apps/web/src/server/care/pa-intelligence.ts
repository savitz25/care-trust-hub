import "server-only";
import { assertPaIntelligence, PA_PUBLIC_SNAPSHOT, type PaPublicSnapshot } from "@care/domain";

export function getPaIntelligence(): PaPublicSnapshot {
  return assertPaIntelligence(PA_PUBLIC_SNAPSHOT);
}
